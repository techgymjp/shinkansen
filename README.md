# 暴走新幹線

東京駅から博多駅まで 1,069.1km（実キロ）を、最高時速 603km/h の暴走新幹線で駆け抜ける 3D ブラウザゲームです。
ブレーキはありません。アクセルを離すと惰行でゆっくり減速しますが、そのぶんタイムは伸びます。

## 遊び方

- `↑` / `W` / `Space` 長押し … 加速（0 → 603km/h）。離すとゆっくり減速
- `→` / `D` … 右の線路（上り線）へ　`←` / `A` … 左の線路（下り線）へ
- `Z` 左窓　`X` 前方（運転台）　`C` 右窓
- `H` 警笛　`M` 消音　`P` / `Esc` 一時停止
- 一時停止メニューの「セーブして中断」で途中から再開できます（タイトルの「続きから」）。走行中も20秒ごとと大爆発時に自動保存します。セーブは1つだけで、再開すると消えます。再開時は速度0から走り出し、周りの列車は配置し直されます
- スマホではタッチボタンで操作できます

下り線には 300km/h ののぞみが走っています。線路の **ポイント（⇄ の黄色い信号）** の手前約 200m で横に入力すると、渡り線を通って隣の線路に移れます。
上り線では対向ののぞみが向かってくるので、次のポイントで下り線へ戻りましょう。
ぶつかると大爆発して、その場から速度 0 で再出発です。大爆発 1 回につき記録タイムに 3 分加算されます。
記録は「タイム部門」（ペナルティ込みのタイム）と「無事故部門」（大爆発 0 回で走り切ったときのタイム）の 2 部門です。

対向列車は指令所が管理していて、全力で加速しながら追い抜けば、戻る前に対向列車とすれ違うことはありません（追い抜き中に間に合わない列車は、戻り地点より先の信号で止まります）。

## 実行方法

ビルドは不要です。静的ファイルとして配信してブラウザで `index.html` を開きます（ES Modules を使うため `file://` では動きません）。

```sh
python3 -m http.server 8000
# → http://localhost:8000/
```

GitHub Pages などにそのまま置いても動きます。

## Android 版

JET STRIKE（techgymjp/jet-fighter）と同じ構成で、Capacitor を使って Android アプリにしています。パッケージ名は `jp.techgym.shinkansen` です。

- ゲームのファイルはアプリに同梱し、オフラインでも遊べます（`npm run build` で `www/` にコピー）
- 縦画面・横画面のどちらでも遊べる（端末の自動回転の設定に従う）。システムバーを隠した全画面、プレイ中は画面を消さない
- 戻るボタン: プレイ中は一時停止、一時停止中は再開、タイトルと結果画面ではアプリを終了
- 別のアプリに切り替えると自動で一時停止し、音を止める
- 結果のシェアは Android の共有メニュー
- 車内放送は端末の読み上げ機能（@capacitor-community/text-to-speech）で話す（アプリの WebView はブラウザの音声合成に対応していないため）
- 広告（AdMob）
  - バナー: タイトル画面と結果画面の下端だけ（運転中は操作ボタンと重なるので出さない）。バナーの高さだけ画面の下に余白を取る
  - インタースティシャル: 結果画面の「もう一度」「タイトルへ」、一時停止メニューの「セーブして中断」「セーブせずタイトルへ」を押したとき（毎回）
  - リワード: 大爆発したあと「広告を見て 300km/h から再出発」（1 回の運転で 1 回、10 秒で自動的に速度 0 から再出発）。大爆発の回数とペナルティは変わりません
  - 起動時に Google の同意確認（UMP）。EU など必要な地域ではタイトルに「広告の設定」を表示
- タイトル画面にビルド番号とプライバシーポリシーへのリンク
- 日本語と英語に対応（端末の言語が日本語なら日本語、それ以外は英語。タイトル画面で切り替え可能）。英語の端末ではアプリ名も「Runaway Shinkansen」

### ビルド

クラウドの Claude Code からは Android SDK を入れられないので、ビルドは GitHub Actions（`.github/workflows/android.yml`）で行います。

1. `npm ci` → `npm run build` → `npx cap sync android` → `./gradlew assembleDebug`
2. 既定ブランチのビルドは、動作確認用 APK（テスト広告）を Release `android-latest` に載せます
   - ダウンロード: `https://github.com/techgymjp/shinkansen/releases/latest/download/bousou-shinkansen.apk`

   - リリースページ: `https://github.com/techgymjp/shinkansen/releases/latest`

     <img src="docs/apk-qr.png" alt="APK ダウンロードの QR コード" width="180"> <img src="docs/release-qr.png" alt="リリースページの QR コード" width="180">

     左: APK を直接ダウンロード　右: リリースページ

3. GitHub Secrets に署名鍵（`ANDROID_KEYSTORE_BASE64` `ANDROID_KEYSTORE_PASSWORD` `ANDROID_KEY_ALIAS` `ANDROID_KEY_PASSWORD`）があれば、本番広告で署名付き AAB を作り、Artifact に上げます

ローカルで Android Studio を使う場合:

```sh
npm ci
npm run android:sync
npm run android:open
```

### 広告 ID

- アプリ ID: `android/app/src/main/res/values/strings.xml` の `admob_app_id`
- 広告ユニット ID: `js/ads.js` の `UNITS.production`（バナー・インタースティシャル・リワード）

本番の広告は、Google Play 用のビルド（`ADMOB_MODE=production`）のときだけ使います。動作確認用 APK はいつもテスト広告です。`UNITS.production` が空の種類は、本番ビルドでもテスト広告になります。

## iOS 版

Android 版と同じ Capacitor のプロジェクトに `ios/` を足して作っています（JET STRIKE と同じ構成）。Bundle ID は `jp.techgym.shinkansen` です。

- iPhone 専用（iPad では iPhone 用の画面で動く）。縦画面・横画面のどちらでも遊べる
- 英語の端末ではアプリ名が「Runaway Shinkansen」
- 広告は Android と同じ出し方。起動時に Google の同意確認のあと、App Tracking Transparency の確認を出す
- AdMob の iOS 用 ID：`ios/App/App/Info.plist` の `GADApplicationIdentifier`（アプリ ID）と `js/ads.js` の `UNITS.ios.production`（広告ユニット ID）
- GitHub Actions（`.github/workflows/ios.yml`）で、push のたびに署名なしでビルドできるかを確認する
- ビルドと App Store への提出は Mac で行う：手順は [docs/IOS_BUILD.md](docs/IOS_BUILD.md)
- App Store 用の画像：`docs/store/ios/`（スクリーンショット 2622×1206 日英各 4 枚、ヘッダ 3840×1646、検索結果 3840×2560）

## 再現しているもの

| 要素 | データの出どころ |
| --- | --- |
| 線路の曲がり方 | 国土数値情報（鉄道データ N02）の東海道・山陽新幹線の線形を平滑化して使用 |
| 駅の位置 | 同データの駅位置を線路上に投影して実測。東京〜新大阪 515.4km、新大阪〜博多 553.7km の実キロに合わせて補正 |
| 市街地・住宅地・田畑の分布 | 同データの在来線駅の密度（線路から 3km 以内の駅数）から自動判定 |
| 富士山・城・五重塔・寺・古墳・東京タワーなど | 実際の緯度経度から、線路からの距離と左右を計算して配置（小さな名所は見える距離まで寄せています） |
| 川と橋梁 | 主要河川の位置と橋梁の長さ。木曽川・長良川・揖斐川はトラス橋 |
| トンネル | 新丹那・六甲・安芸・新関門など主なトンネル（位置はおおよそ）。山陽新幹線の山間部には短いトンネルを補完 |
| 海・湖 | 相模湾・駿河湾・浜名湖・瀬戸内海など車窓から見える区間 |

駅を通過するとテロップが表示され、車掌放送（音声合成）で名所や駅を案内します。

## 構成

```
index.html          画面と HUD
css/style.css
js/main.js          ゲームループ・入力・カメラ・HUD・テロップ
js/world.js         沿線の 3D 世界（0.5km ごとのチャンクを生成・破棄）
js/trains.js        のぞみ・対向列車・ポイント・衝突判定
js/models.js        N700 系風の車両、五重塔、寺、城、古墳、富士山などのモデル
js/route.js         線路データへのアクセス
js/route-data.js    自動生成された線路データ（tools/build_route.py）
js/scenery-data.js  トンネル・海・山地・橋梁などの区間データ
js/audio.js         走行音・効果音（WebAudio で合成）
js/effects.js       大爆発エフェクト
tools/              線路データ生成スクリプトと名所の座標
vendor/             three.js r160 (MIT License)
fonts/              数字用フォント DotGothic16 (SIL Open Font License)
js/native.js        Android アプリのネイティブ機能 (戻るボタン・共有)
js/i18n.js          日本語 / 英語の表示文言と、名所・川・トンネルの英語名
js/ads.js           AdMob 広告 (Android アプリのみ)
scripts/build-web.js  www/ へのコピーと ads-config.js / build-info.js の生成
android/            Capacitor の Android プロジェクト
ios/                Capacitor の iOS プロジェクト
assets/             アプリのアイコンと起動画面の元画像
```

### 線路データの再生成

```sh
python3 tools/build_route.py N02-19_RailroadSection.geojson N02-19_Station.geojson tools/landmarks.csv > js/route-data.js
```

## 出典

- 「国土数値情報（鉄道データ）」（国土交通省）を加工して作成 https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N02-v2_3.html
- three.js (MIT License) https://threejs.org/

## ライセンス

著作権はテックジム株式会社に帰属します（All rights reserved）。許可なく複製・改変・再配布すること、Web サイトやアプリ（Google Play、App Store など）として公開・販売すること、名前・ロゴ・アイコン・画像を使うことを禁止します。
テックジムの受講生が学習目的で複製・改変することは許可しますが、アプリストアでの公開、広告の掲載、販売などの商用利用は禁止し、著作権表示を残してください。詳しくは [LICENSE](LICENSE) を見てください。

同梱している three.js（MIT License）と DotGothic16 フォント（SIL Open Font License）は、それぞれのライセンスに従います。線路データは国土数値情報（国土交通省）を加工したものです。
