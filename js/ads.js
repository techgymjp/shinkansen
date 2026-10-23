// Google AdMob 広告（Android アプリのときだけ動く。Web 版では何もしない）
// 構成は JET STRIKE と同じ: 起動時に同意確認 (UMP)、広告は先読みし、失敗したら少し待って再挑戦する
const UNITS = {
  // Google 公式のテスト用広告ユニット
  test: {
    interstitial: 'ca-app-pub-3940256099942544/1033173712',
    rewarded: 'ca-app-pub-3940256099942544/5224354917',
  },
  // 本番の広告ユニット (AdMob で作成したら入れる。空のあいだは本番ビルドでもテスト広告を使う)
  production: {
    interstitial: '',
    rewarded: '',
  },
};
const RETRY_MS = 20000; // 読み込みに失敗したら少し待って再挑戦する

const cap = window.Capacitor;
const native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
const AdMob = native && cap.Plugins ? cap.Plugins.AdMob : null;
const hasProduction = !!(UNITS.production.interstitial && UNITS.production.rewarded);
const testing = window.AD_MODE !== 'production' || !hasProduction;
const ids = testing ? UNITS.test : UNITS.production;

let ready = false; // 広告をリクエストしてよい状態 (初期化と同意確認が済んだ)
let showing = false;
let privacyRequired = false; // 「広告の設定」を利用者が開けるようにする必要があるか (EU など)
const waiters = {};
let hooks = { suspend() {}, resume() {} }; // 広告表示中はゲームの音を止める

const slots = {
  inter: { loaded: false, pending: null, load: () => AdMob.prepareInterstitial({ adId: ids.interstitial, isTesting: testing }) },
  reward: { loaded: false, pending: null, load: () => AdMob.prepareRewardVideoAd({ adId: ids.rewarded, isTesting: testing }) },
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
  let rewarded = false;
  AdMob.addListener('interstitialAdDismissed', () => finish('inter'));
  AdMob.addListener('interstitialAdFailedToShow', () => finish('inter'));
  AdMob.addListener('onRewardedVideoAdShowed', () => { rewarded = false; });
  AdMob.addListener('onRewardedVideoAdReward', () => { rewarded = true; });
  AdMob.addListener('onRewardedVideoAdDismissed', () => finish('reward', rewarded));
  AdMob.addListener('onRewardedVideoAdFailedToShow', () => finish('reward', false));
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
  showPrivacyOptions,
};
