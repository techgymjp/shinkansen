// 表示言語 (日本語 / 英語)。端末の言語が日本語なら日本語、それ以外は英語。タイトル画面で切り替えも可能
// 構成は JET STRIKE と同じ: data-i18n (文字) / data-i18n-html (タグを含む) / data-i18n-href (リンク先)
const dict = {
  ja: {
    'doc.title': '暴走新幹線',
    'title.h1': '<span class="t-red">暴走</span>新幹線',
    'title.tag': '東京 → 博多 1,069km　最高時速 <b>603</b> km/h',
    'title.from': '出発', 'title.to': '到着', 'title.time': '時間',
    'scale.1': '等倍（リアル）', 'scale.2': '2倍速', 'scale.4': '4倍速', 'scale.8': '8倍速',
    'title.voice': '車内放送（音声合成）',
    'title.start': '出発進行!',
    'title.continue': '続きから',
    'title.howto': '操作',
    'howto.tc1': '<b>加速</b>ボタンを押し続けると加速（ブレーキはありません。離すとゆっくり減速）',
    'howto.tc2': '<b>◀ ▶</b>ボタンで左右の線路へ。<b>ポイント（⇄の信号）</b>の手前約200mで押す。のぞみ(300km/h)を追い抜き、対向列車が来る前に戻る!',
    'howto.rule': '大爆発すると速度0から再出発、1回につき<b>+3分</b>。記録は「タイム部門」と大爆発0回の「無事故部門」の2つ',
    'howto.tc4': '上の<b>左窓・前方・右窓</b>で視点を切り替え。<b>⏸</b>で一時停止・セーブ',
    'howto.kb1': '<kbd>↑</kbd> / <kbd>W</kbd> / <kbd>Space</kbd> 長押し … 加速（ブレーキはありません。離すとゆっくり減速）',
    'howto.kb2': '<kbd>→</kbd> / <kbd>D</kbd> … 右の線路（上り線）へ　<kbd>←</kbd> / <kbd>A</kbd> … 左の線路（下り線）へ',
    'howto.kb3': '線路の切り替えは<b>ポイント（⇄の信号）</b>の手前約200mで入力。のぞみ(300km/h)を追い抜き、対向列車が来る前に戻る!',
    'howto.kb5': '<kbd>Z</kbd> 左窓　<kbd>X</kbd> 前方　<kbd>C</kbd> 右窓　<kbd>H</kbd> 警笛　<kbd>M</kbd> 消音　<kbd>P</kbd> 一時停止',
    'title.credit': '線形・駅位置: 国土数値情報（鉄道データ）国土交通省 を加工して作成',
    'legal.privacy': 'プライバシーポリシー',
    'legal.adSettings': '広告の設定',
    'url.privacy': 'https://techgym.jp/privacy-policy/',
    'store.android': 'Android アプリ版（Google Play）',
    'url.play': 'https://play.google.com/store/apps/details?id=jp.techgym.shinkansen&hl=ja',
    'best.prefix': 'この区間の記録: ',
    'best.time': 'タイム部門 {t}（大爆発 {n}回）',
    'best.clean': '無事故部門 {t}',
    'cont.info': '{from}→{to}　{near}付近 {km}km・{t}',
    'station.opt': '{name}（{km}km）',
    'hud.dist': '走行', 'hud.remain': '残り', 'hud.next': '次駅', 'hud.time': '記録', 'hud.clock': '時刻',
    'hud.boom': '大爆発', 'hud.boomUnit': '回', 'hud.pen': '(+{n}分)',
    'hud.lane': '線路', 'hud.down': '下り', 'hud.up': '上り', 'hud.point': 'ポイント', 'hud.notch': 'ノッチ',
    'hud.passing': '通過中',
    'hud.onc': '対向列車 {d}km', 'hud.ahead': '先行のぞみ {d}km',
    'view.left': '◀ 左窓', 'view.front': '前方', 'view.right': '右窓 ▶',
    'tb.accel': '加速',
    'title.mute': '消音 (M)', 'title.pause': '一時停止 (P)',
    'alert.early': 'まだ早い!', 'alert.noPoint': 'ポイントがありません', 'alert.late': '間に合わない!',
    'alert.toUp': 'ポイント切替 ▶ 上り線へ', 'alert.toDown': '◀ 下り線へ ポイント切替',
    'alert.onc': '⚠ 対向列車接近!', 'alert.ahead': '⚠ のぞみ接近!',
    'cd.depart': '出発進行!', 'cd.restart': '再出発!', 'cd.loading': '線路を敷設中… {p}%',
    'crash.main': '大爆発!!', 'crash.sub': '{n}回目の大破　速度 {v}km/h で衝突　ペナルティ +3:00',
    'pause.title': '一時停止中', 'pause.resume': '再開', 'pause.save': 'セーブして中断', 'pause.quit': 'セーブせずタイトルへ',
    'pause.note': 'セーブは1つだけです。続きから再開すると消えます。',
    'ac.head': '広告を見て 300km/h から再出発',
    'ac.lead': '加速し直さずに走り出せます（1 回の運転で 1 回まで）。大爆発の回数とペナルティは変わりません',
    'ac.watch': '▶ 広告を見る', 'ac.skip': '速度 0 から再出発',
    'ac.loading': '広告を読み込んでいます…', 'ac.fail': '広告を読み込めませんでした', 'ac.skipped': '最後まで見ると 300km/h で再出発できます',
    'res.course': '区間', 'res.run': '走行時間', 'res.boom': '大爆発（1回 +3分）', 'res.time': '記録タイム',
    'res.pass': '追い抜いたのぞみ', 'res.max': '最高速度',
    'res.title': '{st} 到着!', 'res.courseV': '{from} → {to}（{km}km）', 'res.boomV': '{n} 回（+{p}）', 'res.passV': '{n} 本',
    'res.newTime': '★ タイム部門 記録更新!', 'res.recTime': 'タイム部門 記録: {t}',
    'res.newClean': '★ 無事故部門 記録更新!', 'res.recClean': '無事故部門 記録: {t}', 'res.cleanNote': '無事故部門は大爆発0回で記録されます',
    'res.again': 'もう一度', 'res.title2': 'タイトルへ',
    'share.title': '結果をシェア', 'share.x': 'X でポスト', 'share.copy': 'リンクをコピー', 'share.copied': 'コピーしました',
    'share.selected': '文章を選択しました', 'share.native': 'シェア', 'share.other': 'その他', 'share.textLabel': 'シェア用の文章',
    'share.boomZero': '大爆発ゼロの無事故運転', 'share.boomN': '大爆発{n}回',
    'share.text': '暴走新幹線で{from}→{to}（{km}km）を{t}で走破！{boom}、最高{v}km/h #暴走新幹線',
    'share.appTitle': '暴走新幹線',
    'telop.pass': '東京から {km}km　{clock} 通過',
    'telop.depart': '{to}ゆき　暴走新幹線', 'telop.departMain': '{st} 出発',
    'telop.resume': '{to}ゆき　{km}km から', 'telop.resumeMain': '運転再開',
    'telop.arrive': '{t}　大爆発 {n}回', 'telop.arriveMain': '{st} 到着',
    'ann.near': 'まもなく {st} を通過します',
    'ann.lake': '両側に {name} が広がります',
    'ann.see': '{side}に {name} が見えます',
    'ann.water': '{side}に {name}',
    'ann.bridge': '{name}橋梁　{m}m', 'ann.truss': '（トラス橋）',
    'ann.tunnel': '{name}　{m}m',
    'side.L': '左手', 'side.R': '右手', 'side.B': '両側',
    'voice.near': 'まもなく、{kana}を、通過します',
    'voice.lake': '両側に、{name}が広がります',
    'voice.see': '{side}に、{name}が見えます',
    'voice.arrive': '{kana}に到着しました',
    'voice.resume': 'お待たせしました。{kana}ゆき、運転を再開します',
    'voice.depart': 'この電車は、暴走新幹線、{kana}ゆきです',
    'voice.lang': 'ja-JP',
  },
  en: {
    'doc.title': 'Runaway Shinkansen',
    'title.h1': '<span class="t-red">RUNAWAY</span> SHINKANSEN',
    'title.tag': 'Tokyo → Hakata 1,069 km　Top speed <b>603</b> km/h',
    'title.from': 'From', 'title.to': 'To', 'title.time': 'Speed',
    'scale.1': 'Real time', 'scale.2': '2× speed', 'scale.4': '4× speed', 'scale.8': '8× speed',
    'title.voice': 'Conductor announcements (speech)',
    'title.start': 'DEPART!',
    'title.continue': 'Continue',
    'title.howto': 'Controls',
    'howto.tc1': 'Hold <b>ACCEL</b> to speed up (no brakes — let go to coast down slowly)',
    'howto.tc2': 'Tap <b>◀ ▶</b> to change tracks about 200 m before a <b>switch (⇄ signal)</b>. Overtake the Nozomi (300 km/h) and get back before an oncoming train arrives!',
    'howto.rule': 'A crash sends you back to 0 km/h and adds <b>+3 min</b>. Two records: Time, and No-Crash (0 crashes)',
    'howto.tc4': 'Use <b>Left / Front / Right</b> at the top to change the view. <b>⏸</b> to pause or save',
    'howto.kb1': 'Hold <kbd>↑</kbd> / <kbd>W</kbd> / <kbd>Space</kbd> … accelerate (no brakes — let go to coast down slowly)',
    'howto.kb2': '<kbd>→</kbd> / <kbd>D</kbd> … right track (up line)　<kbd>←</kbd> / <kbd>A</kbd> … left track (down line)',
    'howto.kb3': 'Change tracks about 200 m before a <b>switch (⇄ signal)</b>. Overtake the Nozomi (300 km/h) and get back before an oncoming train arrives!',
    'howto.kb5': '<kbd>Z</kbd> left window　<kbd>X</kbd> front　<kbd>C</kbd> right window　<kbd>H</kbd> horn　<kbd>M</kbd> mute　<kbd>P</kbd> pause',
    'title.credit': 'Track alignment and stations: based on National Land Numerical Information (railway data), MLIT Japan',
    'legal.privacy': 'Privacy Policy',
    'legal.adSettings': 'Ad settings',
    'url.privacy': 'https://techgym.jp/privacy-policy-en/',
    'store.android': 'Get the Android app (Google Play)',
    'url.play': 'https://play.google.com/store/apps/details?id=jp.techgym.shinkansen&hl=en',
    'best.prefix': 'Records for this route: ',
    'best.time': 'Time {t} ({n} crashes)',
    'best.clean': 'No-Crash {t}',
    'cont.info': '{from}→{to}　near {near} {km} km・{t}',
    'station.opt': '{name} ({km} km)',
    'hud.dist': 'Dist', 'hud.remain': 'Left', 'hud.next': 'Next', 'hud.time': 'Time', 'hud.clock': 'Clock',
    'hud.boom': 'Crashes', 'hud.boomUnit': '', 'hud.pen': '(+{n} min)',
    'hud.lane': 'Track', 'hud.down': 'Down', 'hud.up': 'Up', 'hud.point': 'Switch', 'hud.notch': 'Notch',
    'hud.passing': 'Now',
    'hud.onc': 'Oncoming {d} km', 'hud.ahead': 'Nozomi ahead {d} km',
    'view.left': '◀ Left', 'view.front': 'Front', 'view.right': 'Right ▶',
    'tb.accel': 'ACCEL',
    'title.mute': 'Mute (M)', 'title.pause': 'Pause (P)',
    'alert.early': 'Too early!', 'alert.noPoint': 'No switch here', 'alert.late': 'Too late!',
    'alert.toUp': 'Switch ▶ to the up line', 'alert.toDown': '◀ Switch to the down line',
    'alert.onc': '⚠ Oncoming train!', 'alert.ahead': '⚠ Nozomi ahead!',
    'cd.depart': 'DEPART!', 'cd.restart': 'RESTART!', 'cd.loading': 'Laying track… {p}%',
    'crash.main': 'KABOOM!!', 'crash.sub': 'Crash #{n} at {v} km/h　Penalty +3:00',
    'pause.title': 'Paused', 'pause.resume': 'Resume', 'pause.save': 'Save and quit', 'pause.quit': 'Quit without saving',
    'pause.note': 'There is one save slot. It is deleted when you continue.',
    'ac.head': 'Watch an ad to restart at 300 km/h',
    'ac.lead': 'Skip re-accelerating (once per run). Your crash count and penalty stay the same',
    'ac.watch': '▶ Watch ad', 'ac.skip': 'Restart from 0 km/h',
    'ac.loading': 'Loading the ad…', 'ac.fail': "Couldn't load the ad", 'ac.skipped': 'Watch to the end to restart at 300 km/h',
    'res.course': 'Route', 'res.run': 'Run time', 'res.boom': 'Crashes (+3 min each)', 'res.time': 'Record time',
    'res.pass': 'Nozomi overtaken', 'res.max': 'Top speed',
    'res.title': 'Arrived at {st}!', 'res.courseV': '{from} → {to} ({km} km)', 'res.boomV': '{n} (+{p})', 'res.passV': '{n}',
    'res.newTime': '★ New Time record!', 'res.recTime': 'Time record: {t}',
    'res.newClean': '★ New No-Crash record!', 'res.recClean': 'No-Crash record: {t}', 'res.cleanNote': 'No-Crash records need 0 crashes',
    'res.again': 'Play again', 'res.title2': 'Title',
    'share.title': 'Share your result', 'share.x': 'Post on X', 'share.copy': 'Copy link', 'share.copied': 'Copied',
    'share.selected': 'Text selected', 'share.native': 'Share', 'share.other': 'More', 'share.textLabel': 'Text to share',
    'share.boomZero': 'Zero crashes', 'share.boomN': '{n} crashes',
    'share.text': 'I ran {from}→{to} ({km} km) in {t} on Runaway Shinkansen! {boom}, top speed {v} km/h #RunawayShinkansen',
    'share.appTitle': 'Runaway Shinkansen',
    'telop.pass': '{km} km from Tokyo　Passing at {clock}',
    'telop.depart': 'Runaway Shinkansen for {to}', 'telop.departMain': 'Departing {st}',
    'telop.resume': 'For {to}　from {km} km', 'telop.resumeMain': 'Resuming',
    'telop.arrive': '{t}　{n} crashes', 'telop.arriveMain': 'Arrived: {st}',
    'ann.near': 'Now approaching {st}',
    'ann.lake': '{name} on both sides',
    'ann.see': '{name} on the {side}',
    'ann.water': '{name} on the {side}',
    'ann.bridge': '{name} Bridge　{m} m', 'ann.truss': ' (truss bridge)',
    'ann.tunnel': '{name}　{m} m',
    'side.L': 'left', 'side.R': 'right', 'side.B': 'both sides',
    'voice.near': 'We will soon be passing {name}.',
    'voice.lake': '{name} is on both sides.',
    'voice.see': 'You can see {name} on the {side}.',
    'voice.arrive': 'We have arrived at {name}.',
    'voice.resume': 'Thank you for waiting. This train for {name} is now resuming.',
    'voice.depart': 'This is the Runaway Shinkansen, bound for {name}.',
    'voice.lang': 'en-US',
  },
};

// 沿線の名所・川・トンネル・海の英語名 (日本語名 → 英語名)
const NAMES_EN = {
  // 名所
  '東京タワー': 'Tokyo Tower', '池上本門寺': 'Ikegami Honmonji Temple', '横浜ランドマークタワー': 'Yokohama Landmark Tower',
  '小田原城': 'Odawara Castle', '箱根山': 'Mt. Hakone', '愛鷹山': 'Mt. Ashitaka', '富士山': 'Mt. Fuji', '清見寺': 'Seikenji Temple',
  '浜松城': 'Hamamatsu Castle', '浜名湖': 'Lake Hamana', '豊川稲荷': 'Toyokawa Inari', '名古屋城': 'Nagoya Castle',
  '岐阜城（金華山）': 'Gifu Castle (Mt. Kinka)', '昼飯大塚古墳': 'Hirui Otsuka Kofun (burial mound)', '伊吹山': 'Mt. Ibuki',
  '彦根城': 'Hikone Castle', '三上山（近江富士）': 'Mt. Mikami (Omi Fuji)', '京都タワー': 'Kyoto Tower',
  '東寺 五重塔': 'Toji Five-Story Pagoda', '今城塚古墳': 'Imashirozuka Kofun (burial mound)',
  '太田茶臼山古墳': 'Ota Chausuyama Kofun (burial mound)', '姫路城': 'Himeji Castle', '両宮山古墳': 'Ryoguzan Kofun (burial mound)',
  '岡山城': 'Okayama Castle', '造山古墳': 'Tsukuriyama Kofun (burial mound)', '作山古墳': 'Tsukuriyama (Sakuzan) Kofun (burial mound)',
  '備中国分寺 五重塔': 'Bitchu Kokubunji Five-Story Pagoda', '福山城': 'Fukuyama Castle', '広島城': 'Hiroshima Castle', '小倉城': 'Kokura Castle',
  // 川
  '多摩川': 'Tama River', '相模川': 'Sagami River', '酒匂川': 'Sakawa River', '富士川': 'Fuji River', '安倍川': 'Abe River',
  '大井川': 'Oi River', '天竜川': 'Tenryu River', '豊川': 'Toyo River', '矢作川': 'Yahagi River', '庄内川': 'Shonai River',
  '木曽川': 'Kiso River', '長良川': 'Nagara River', '揖斐川': 'Ibi River', '瀬田川': 'Seta River', '鴨川': 'Kamo River',
  '桂川': 'Katsura River', '淀川': 'Yodo River', '神崎川': 'Kanzaki River', '武庫川': 'Muko River', '加古川': 'Kako River',
  '揖保川': 'Ibo River', '千種川': 'Chikusa River', '吉井川': 'Yoshii River', '旭川': 'Asahi River', '高梁川': 'Takahashi River',
  '芦田川': 'Ashida River', '沼田川': 'Nuta River', '太田川': 'Ota River', '錦川': 'Nishiki River', '佐波川': 'Saba River',
  '椹野川': 'Fushino River', '厚狭川': 'Asa River', '紫川': 'Murasaki River', '遠賀川': 'Onga River', '多々良川': 'Tatara River',
  // トンネル
  '石橋山トンネル': 'Ishibashiyama Tunnel', '南郷山トンネル': 'Nangozan Tunnel', '根府川トンネル': 'Nebukawa Tunnel',
  '泉越トンネル': 'Izumigoe Tunnel', '新丹那トンネル': 'Shin-Tanna Tunnel', '薩埵トンネル': 'Satta Tunnel',
  '日本坂トンネル': 'Nihonzaka Tunnel', '牧之原トンネル': 'Makinohara Tunnel', '小夜の中山トンネル': 'Sayo-no-Nakayama Tunnel',
  '音羽山トンネル': 'Otowayama Tunnel', '東山トンネル': 'Higashiyama Tunnel', '六甲トンネル': 'Rokko Tunnel',
  '神戸トンネル': 'Kobe Tunnel', '帆坂トンネル': 'Hosaka Tunnel', '船坂トンネル': 'Funasaka Tunnel', '備前トンネル': 'Bizen Tunnel',
  '尾道トンネル': 'Onomichi Tunnel', '三原トンネル': 'Mihara Tunnel', '竹原トンネル': 'Takehara Tunnel',
  '八本松トンネル': 'Hachihonmatsu Tunnel', '安芸トンネル': 'Aki Tunnel', '五日市トンネル': 'Itsukaichi Tunnel',
  '大竹トンネル': 'Otake Tunnel', '岩国トンネル': 'Iwakuni Tunnel', '欽明路トンネル': 'Kinmeiji Tunnel', '周防トンネル': 'Suo Tunnel',
  '戸田トンネル': 'Heta Tunnel', '福川トンネル': 'Fukugawa Tunnel', '富海トンネル': 'Tonomi Tunnel', '小郡トンネル': 'Ogori Tunnel',
  '石原トンネル': 'Ishihara Tunnel', '新関門トンネル': 'Shin-Kanmon Tunnel', '北九州トンネル': 'Kitakyushu Tunnel',
  '古賀トンネル': 'Koga Tunnel', '福岡トンネル': 'Fukuoka Tunnel',
  // 海
  '相模湾': 'Sagami Bay', '駿河湾': 'Suruga Bay', '遠州灘': 'Enshu-nada Sea', '瀬戸内海': 'Seto Inland Sea',
  '徳山湾': 'Tokuyama Bay', '周防灘': 'Suo-nada Sea',
};

const STORE_KEY = 'bousou_lang';
let saved = null;
try { saved = localStorage.getItem(STORE_KEY); } catch (e) { /* 保存不可 */ }
const deviceLang = (navigator.languages && navigator.languages[0]) || navigator.language || 'ja';
let lang = dict[saved] ? saved : (/^ja\b/i.test(deviceLang) ? 'ja' : 'en');
const listeners = [];

// t('crash.sub', { n: 2, v: 450 })
export function t(key, vars) {
  let s = dict[lang][key];
  if (s === undefined) s = dict.ja[key];
  if (s === undefined) return key;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m)) : s;
}

// 名所・川・トンネルなどの名前を表示言語で返す
export function nameOf(ja) {
  return lang === 'en' ? NAMES_EN[ja] || ja : ja;
}
// 駅名 (route-data の駅オブジェクト)
export function stationName(s) {
  return lang === 'en' ? s.en : s.name;
}

export function apply() {
  document.documentElement.lang = lang;
  document.title = t('doc.title');
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
  document.querySelectorAll('[data-i18n-href]').forEach((el) => { el.href = t(el.dataset.i18nHref); });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  document.querySelectorAll('[data-lang]').forEach((el) => el.classList.toggle('on', el.dataset.lang === lang));
}

export function setLang(l) {
  if (!dict[l] || l === lang) return;
  lang = l;
  try { localStorage.setItem(STORE_KEY, l); } catch (e) { /* 保存不可 */ }
  apply();
  listeners.forEach((f) => f(l));
}

export const getLang = () => lang;
export function onLangChange(f) { listeners.push(f); }
