// Google AdMob 広告（Android / iOS アプリのときだけ動く。Web 版では何もしない）
// 構成は JET STRIKE と同じ: 起動時に同意確認 (UMP)、広告は先読みし、失敗したら少し待って再挑戦する
// AdMob では Android と iOS を別のアプリとして登録しているので、広告ユニットも OS ごとに分かれている
const UNITS = {
  android: {
    // Google 公式のテスト用広告ユニット
    test: {
      banner: 'ca-app-pub-3940256099942544/9214589741',
      interstitial: 'ca-app-pub-3940256099942544/1033173712',
      rewarded: 'ca-app-pub-3940256099942544/5224354917',
    },
    production: {
      banner: 'ca-app-pub-6411535997477460/1320325600',
      interstitial: 'ca-app-pub-6411535997477460/8578375236',
      rewarded: 'ca-app-pub-6411535997477460/7962675445',
    },
  },
  ios: {
    test: {
      banner: 'ca-app-pub-3940256099942544/2934735716',
      interstitial: 'ca-app-pub-3940256099942544/4411468910',
      rewarded: 'ca-app-pub-3940256099942544/1712485313',
    },
    production: {
      banner: 'ca-app-pub-6411535997477460/3552032424',
      interstitial: 'ca-app-pub-6411535997477460/3663501034',
      rewarded: 'ca-app-pub-6411535997477460/6604524994',
    },
  },
};
const RETRY_MS = 20000; // 読み込みに失敗したら少し待って再挑戦する

const cap = window.Capacitor;
const native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
const AdMob = native && cap.Plugins ? cap.Plugins.AdMob : null;
const platform = native && cap.getPlatform() === 'ios' ? 'ios' : 'android';
// 広告の種類ごとに、本番 ID があり本番ビルドのときだけ本番の広告を使う
const productionBuild = window.AD_MODE === 'production';
const unit = (kind) => {
  const prod = productionBuild && UNITS[platform].production[kind];
  return { adId: prod || UNITS[platform].test[kind], isTesting: !prod };
};
const testing = !productionBuild;

let ready = false; // 広告をリクエストしてよい状態 (初期化と同意確認が済んだ)
let showing = false;
let privacyRequired = false; // 「広告の設定」を利用者が開けるようにする必要があるか (EU など)
const waiters = {};
let hooks = { suspend() {}, resume() {}, bannerHeight() {} }; // 広告表示中はゲームの音を止める

const slots = {
  inter: { loaded: false, pending: null, load: () => AdMob.prepareInterstitial(unit('interstitial')) },
  reward: { loaded: false, pending: null, load: () => AdMob.prepareRewardVideoAd(unit('rewarded')) },
};

function prepare(kind) {
  const s = slots[kind];
  if (!ready) return Promise.resolve(false);
  if (s.loaded) return Promise.resolve(true);
  if (!s.pending) {
    s.pending = s.load()
      .then(() => { s.loaded = true; return true; })
      .catch(() => { setTimeout(() => prepare(kind), RETRY_MS); return false; })
      .finally(() => { s.pending = null; });
  }
  return s.pending;
}

function ensureLoaded(kind, timeout) {
  if (slots[kind].loaded) return Promise.resolve(true);
  return Promise.race([prepare(kind), new Promise((r) => setTimeout(() => r(false), timeout))]);
}

function finish(kind, result) {
  showing = false;
  hooks.resume();
  const w = waiters[kind];
  waiters[kind] = null;
  if (w) w(result);
}

async function init() {
  try {
    await AdMob.initialize({ initializeForTesting: testing });
  } catch (e) {
    return;
  }
  // EU・英国などで必要な広告の同意確認 (必要な地域でだけフォームが出る)。
  // 確認自体が失敗した場合は、同意不要の地域とみなして続ける (ここで止まると広告が一切出なくなる)
  try {
    let consent = await AdMob.requestConsentInfo();
    if (consent.status === 'REQUIRED' && consent.isConsentFormAvailable) consent = await AdMob.showConsentForm();
    ready = consent.canRequestAds !== false;
    privacyRequired = consent.privacyOptionsRequirementStatus === 'REQUIRED';
  } catch (e) {
    ready = true;
  }
  // iOS では、広告用の ID を使ってよいか (App Tracking Transparency) を利用者に確認する。
  // 同意確認のあとに一度だけ出る。断られても広告は出せる (パーソナライズされないだけ)
  if (platform === 'ios') {
    try {
      const { status } = await AdMob.trackingAuthorizationStatus();
      if (status === 'notDetermined') await AdMob.requestTrackingAuthorization();
    } catch (e) { /* 確認できなくても続ける */ }
  }
  let rewarded = false;
  AdMob.addListener('interstitialAdDismissed', () => finish('inter'));
  AdMob.addListener('interstitialAdFailedToShow', () => finish('inter'));
  AdMob.addListener('onRewardedVideoAdShowed', () => { rewarded = false; });
  AdMob.addListener('onRewardedVideoAdReward', () => { rewarded = true; });
  AdMob.addListener('onRewardedVideoAdDismissed', () => finish('reward', rewarded));
  AdMob.addListener('onRewardedVideoAdFailedToShow', () => finish('reward', false));
  AdMob.addListener('bannerAdSizeChanged', (size) => {
    bannerH = size && size.height ? size.height : 0;
    if (bannerState === 'shown') hooks.bannerHeight(bannerH);
  });
  prepare('inter');
  prepare('reward');
}

const initDone = AdMob ? init() : Promise.resolve();

// 全画面広告を表示し、閉じられたら resolve する (読み込めていないときは出さずにすぐ resolve)
function showInterstitial() {
  if (!AdMob || !ready || !slots.inter.loaded || showing) return Promise.resolve();
  showing = true;
  slots.inter.loaded = false;
  hooks.suspend();
  return new Promise((resolve) => {
    waiters.inter = () => { prepare('inter'); resolve(); };
    AdMob.showInterstitial().catch(() => finish('inter'));
  });
}

// リワード広告。結果は 'rewarded' (最後まで見た) / 'skipped' (途中で閉じた) / 'unavailable' (読み込めなかった)
async function showRewarded() {
  if (!AdMob || showing) return 'unavailable';
  await initDone;
  if (!ready || !(await ensureLoaded('reward', 8000))) return 'unavailable';
  showing = true;
  slots.reward.loaded = false;
  hooks.suspend();
  return new Promise((resolve) => {
    waiters.reward = (ok) => { prepare('reward'); resolve(ok ? 'rewarded' : 'skipped'); };
    AdMob.showRewardVideoAd().catch(() => finish('reward', false));
  });
}

// バナー: タイトル画面と結果画面の下端にだけ出す (運転中は操作ボタンと重なるので出さない)
let bannerState = 'none'; // none | shown | hidden
let bannerWanted = false;
let bannerBusy = false;
let bannerH = 0;
async function syncBanner() {
  if (!AdMob || bannerBusy) return;
  await initDone;
  if (!ready) return;
  bannerBusy = true;
  try {
    if (bannerWanted && bannerState !== 'shown') {
      if (bannerState === 'none') {
        await AdMob.showBanner({ ...unit('banner'), adSize: 'ADAPTIVE_BANNER', position: 'BOTTOM_CENTER', margin: 0 });
      } else {
        await AdMob.resumeBanner();
      }
      bannerState = 'shown';
      hooks.bannerHeight(bannerH);
    } else if (!bannerWanted && bannerState === 'shown') {
      await AdMob.hideBanner();
      bannerState = 'hidden';
      hooks.bannerHeight(0);
    }
  } catch (e) {
    if (bannerState !== 'hidden') bannerState = 'none';
    if (bannerWanted) setTimeout(syncBanner, RETRY_MS);
  } finally {
    bannerBusy = false;
  }
  // 処理中に表示・非表示の指示が変わっていたら合わせ直す
  if ((bannerWanted && bannerState !== 'shown') || (!bannerWanted && bannerState === 'shown')) syncBanner();
}
function showBanner() { bannerWanted = true; syncBanner(); }
function hideBanner() { bannerWanted = false; hooks.bannerHeight(0); syncBanner(); }

// 同意した内容をあとから変更するための Google のフォームを開く
function showPrivacyOptions() {
  if (!AdMob) return Promise.resolve();
  return AdMob.showPrivacyOptionsForm().catch(() => {});
}

export const Ads = {
  get available() { return !!AdMob; },
  get showing() { return showing; },
  get privacyOptionsRequired() { return privacyRequired; },
  setHooks(h) { hooks = { ...hooks, ...h }; },
  initDone,
  showInterstitial,
  showRewarded,
  showBanner,
  hideBanner,
  showPrivacyOptions,
};
