# iOS 版をビルドして App Store に出す手順（Mac での作業）

暴走新幹線の iOS 版は、Android 版と同じ Capacitor で作っています（`ios/` フォルダ）。構成は JET STRIKE（techgymjp/jet-fighter）と同じです。
コードの準備はできているので、Mac では「ビルドして App Store Connect にアップロードする」作業だけを行います。

- Bundle ID：`jp.techgym.shinkansen`（Android のパッケージ名と同じ）
- チーム：Team ID `GNM3VTX9YG`（Xcode の設定に入れてあります）。Apple Developer には**個人で登録**しています（App Store の販売元は個人名になります）
- 対応端末：iPhone。縦画面・横画面のどちらでも遊べます。iPad では iPhone 用の画面で動きます
- アプリ名：日本語の端末では「暴走新幹線」、英語の端末では「Runaway Shinkansen」
- 広告：AdMob（iOS 用のアプリと広告ユニット）。起動時に「トラッキングの許可」の確認画面が出ます
  - バナー：タイトル画面と結果画面の下端
  - インタースティシャル：結果画面の「もう一度」「タイトルへ」、一時停止メニューの「セーブして中断」「セーブせずタイトルへ」
  - リワード：大爆発したあとの「広告を見て 300km/h から再出発」
- 車内放送は iPhone の読み上げ機能で話します（日本語・英語）

---

## 0. 先にやること（ブラウザ）

1. **Apple Developer**（developer.apple.com）→「Certificates, Identifiers & Profiles」→「Identifiers」→「＋」→「App IDs」→「App」
   - Description：`Runaway Shinkansen`（英数字で）
   - Bundle ID：「Explicit」で `jp.techgym.shinkansen`
   - Capabilities：何もチェックしない
2. **App Store Connect**（appstoreconnect.apple.com）→「アプリ」→「＋」→「新規 App」
   - プラットフォーム：iOS ／ 名前：`暴走新幹線` ／ プライマリ言語：日本語
   - バンドル ID：1 で登録した `jp.techgym.shinkansen` ／ SKU：`shinkansen`（あとから変更不可）／ ユーザアクセス：アクセス制限なし
3. **AdMob** で iOS 用のアプリを追加し（「ストアに掲載されていない」で登録）、バナー・インタースティシャル・リワードの広告ユニットを作る。アプリ ID と広告ユニット ID 3 つを Claude Code に渡す
   - 渡した ID は `ios/App/App/Info.plist` の `GADApplicationIdentifier` と、`js/ads.js` の `UNITS.ios.production` に入ります。**入るまではテスト用の ID のままです**（本番ビルドでもテスト広告になります）
   - 「プライバシーとメッセージ」→「欧州の規制」のメッセージに iOS アプリも追加する

---

## 1. Mac の準備（最初の1回だけ）

1. **Xcode** を App Store からインストールする（数十 GB あるので時間がかかります）。インストール後に一度起動し、追加コンポーネントのインストールを済ませる
2. Xcode の「Settings…」→「Accounts」→「＋」で、Apple Developer に登録している Apple ID でサインインする（チームが個人名で表示されれば OK）
3. **Node.js**（LTS 版）を https://nodejs.org/ からインストールする
4. ターミナルでリポジトリを取得する
   ```bash
   cd ~/Desktop   # 置きたい場所（どこでもよい）
   git clone https://github.com/techgymjp/shinkansen.git
   cd shinkansen
   npm ci
   ```
   `git` がないと言われたら、表示に従って「コマンドライン・デベロッパツール」をインストールしてから、もう一度実行します。

2回目以降は、`cd shinkansen` のあと `git pull` と `npm ci` で最新にします。

---

## 2. 自分の iPhone で動作確認する（テスト広告）

```bash
npm run ios:sync    # ゲームのファイルを iOS のプロジェクトにコピー（テスト広告）
npm run ios:open    # Xcode で開く
```

1. iPhone を USB ケーブルで Mac につなぎ、iPhone で「このコンピュータを信頼」を許可する
2. iPhone の「設定」→「プライバシーとセキュリティ」→「デベロッパモード」をオンにする（再起動を求められます。項目がない場合は、Xcode で一度 iPhone を選ぶと表示されます）
3. Xcode の上部で、実行先に自分の iPhone を選ぶ
4. 左の「App」→「Signing & Capabilities」で、「Automatically manage signing」がオン、Team に自分（個人名）のチームが選ばれていることを確認する
5. ▶（Run）を押すと、iPhone にアプリが入って起動する

確認すること：

- [ ] 全画面で表示され、縦画面・横画面どちらでも遊べる
- [ ] 起動時にトラッキングの確認画面が出る（日本語の説明文）
- [ ] 画面上部のボタンがカメラ（Dynamic Island）やノッチに隠れない
- [ ] 加速・左右の線路切り替え・視点切り替えができる
- [ ] 走行音・効果音が鳴り、車内放送（読み上げ）が聞こえる。**消音モード（本体横のスイッチ）だと音が出ない場合があるので、オフにして確認する**
- [ ] タイトル画面と結果画面の下に**テスト**のバナーが出る
- [ ] 結果画面の「もう一度」などで**テスト**の全画面広告、大爆発後の「広告を見る」で**テスト**のリワード広告が出る
- [ ] 結果のシェアで iPhone の共有メニューが開く
- [ ] 一時停止の「セーブして中断」→ タイトルの「続きから」で再開できる
- [ ] iPhone の言語を英語にすると、アプリ名と画面が英語になる

---

## 3. App Store 用にビルドしてアップロードする（本番広告）

```bash
git pull && npm ci
npm run ios:release   # 本番の広告 ID でコピーする（ここが ios:sync と違う）
npm run ios:open
```

1. Xcode の左で「App」→「General」→「Identity」を開き、**Build の番号を前回より大きくする**（初回は 1。アップロードのたびに 2、3…と上げる。同じ番号は二度アップロードできない）。Version はストアに表示されるバージョン（1.0.0）
2. 上部の実行先を「**Any iOS Device (arm64)**」にする
3. メニューの「Product」→「**Archive**」（「Xcode Cloud can automate…」が出たら「Remind Me Later」）
4. 終わると Organizer が開くので、「**Distribute App**」→「**App Store Connect**」→「Upload」で進める（途中の確認は既定のまま「Next」でよい）
5. 10〜30 分ほどで、App Store Connect の「TestFlight」タブにビルドが表示される

輸出コンプライアンス（暗号化）の質問は、Info.plist で「独自の暗号化は使っていない」と設定済みなので、聞かれません。

**注意**：`ios:release` でビルドしたアプリは本番の広告が出ます。TestFlight で確認するときも、**本番の広告はタップしない**でください（AdMob のアカウント停止の対象）。Xcode から iPhone に直接入れて試すときは、`npm run ios:sync` でテスト広告に戻してから実行します。

---

## 4. TestFlight で確認する

1. App Store Connect の「TestFlight」→「内部テスト」でグループを作り、自分を追加する
2. iPhone に「TestFlight」アプリを App Store から入れ、届いた招待から暴走新幹線をインストールする

---

## 5. 審査用の画面録画を用意する（提出前に必ず）

新しいデベロッパーアカウントは、初回の審査で「Guideline 2.1 - Information Needed」として**実機での操作の画面録画**を求められます（JET STRIKE でも求められました）。最初から用意して、審査に出すときに一緒に渡すと早く進みます。

**録画のしかた**

1. iPhone を最新の iOS にし、TestFlight で入れたアプリ（3 章のビルド）を使う
2. 「設定」→「コントロールセンター」に「画面収録」を追加する
3. コントロールセンターの「画面収録」で録画を始め、**ホーム画面からアプリを起動するところから**録る
4. 録画の流れ（3〜5 分が目安）
   1. ホーム画面でアプリのアイコンをタップして起動
   2. トラッキングの確認画面（許可・拒否のどちらでもよい）
   3. タイトル画面：出発「新横浜」・到着「小田原」、時間「8倍速」にする（短く終わる区間）
   4. 「出発進行!」→ 加速ボタンで加速、ポイントで左右の線路を切り替える、左窓・右窓に切り替える
   5. わざと対向列車にぶつかって大爆発 → 「広告を見て 300km/h から再出発」（広告が出るところ）
   6. 小田原に到着 → 結果画面 → 「シェア」で共有メニューを開いて閉じる
   7. 「もう一度」（全画面広告が出る）→ ⏸ →「セーブして中断」→ タイトルの「続きから」
5. 録画は「写真」アプリに保存される。**大きすぎると App Review への添付が失敗する**ので、Mac の Finder で右クリック →「選択したビデオファイルをエンコード」→ 720p で小さくするか、Google ドライブの共有リンクにする

**審査メモ（「App Review に関する情報」の「メモ」に貼る）**

```
・このアプリは、東京から博多までの新幹線を運転する 3D ゲームです。対象は一般の利用者（13 歳以上）です。
・ログインやアカウント登録は不要です。起動後すぐに遊べます。
・使い方：タイトル画面で出発駅と到着駅を選び「出発進行!」。右下の「加速」で加速し、黄色い「⇄」の信号の手前で左右のボタンを押すと線路を切り替えられます。短い区間（新横浜→小田原、8倍速）なら約1分で到着します。
・外部サービス：Google AdMob（バナー、インタースティシャル、リワード広告）。起動時に App Tracking Transparency の確認を行います。
・地域による機能の違いはありません（EU などでは Google の広告同意画面が表示されます）。
・規制のある業種のアプリではありません。線路の位置は国土交通省の「国土数値情報（鉄道データ）」を加工して使っています。画像・音はすべてアプリ内で生成しており、第三者の素材は使っていません。
・操作の画面録画：（録画のリンクをここに貼る）

This is a 3D game where you drive a bullet train from Tokyo to Hakata. No login or account is needed. Choose a start and end station on the title screen and tap "DEPART!". Hold "ACCEL" to speed up and tap the left/right buttons just before a yellow "⇄" signal to change tracks. Ads are provided by Google AdMob (banner, interstitial, rewarded), and App Tracking Transparency is requested at launch. Screen recording: (paste the link here)
```

---

## 6. App Store Connect で審査に出す

「配信」タブ（iOS App のバージョン 1.0.0）で入力します。**バージョンのページの「バージョン」は 1.0.0 にする**（1.0 のままだとアップロードしたビルドを選べない）。

| 項目 | 入力内容 |
| --- | --- |
| スクリーンショット | 「Dynamic Island 搭載 iPhone（中型ディスプレイ）」の欄に、`docs/store/ios/6.3inch/` の 2622 × 1206（横向き）を入れる。日本語版（ja-）と英語版（en-）各 4 枚。6.9 インチ（2868 × 1320）は受け付けられない |
| ヘッダ・検索結果 | 「ヘッダと検索結果」タブに `docs/store/ios/appstore-header-3840x1646.png` と `appstore-search-3840x2560.png`（ヘッダを入れたら検索結果も入れる） |
| プロモーション用テキスト・概要 | Google Play 用の文章（`docs/store/listing.md`、英語は `docs/store/listing-en.txt`）を流用 |
| キーワード（日本語） | `新幹線,電車,鉄道,運転,シミュレーター,のぞみ,東海道,山陽,博多,レース` |
| キーワード（英語） | `bullet train,shinkansen,train,railway,driving,simulator,japan,racing,tokyo` |
| サポート URL | https://techgym.jp/ |
| プライバシーポリシー URL（アプリのプライバシー） | https://techgym.jp/privacy-policy/ |
| 著作権 | 2026 TECH GYM K.K. |
| カテゴリ（アプリ情報） | ゲーム（サブカテゴリ：シミュレーション、レース） |
| コンテンツの配信権（アプリ情報） | 第三者のコンテンツ「いいえ」（線路データは国の公開データを加工したもの。画像・音はすべて自前） |
| ビルド | TestFlight で確認したビルドを選ぶ |
| 年齢制限 | 質問に答える（列車どうしの衝突・爆発の表現あり。人物・流血の描写なし） |
| App のプライバシー | AdMob が収集するデータを申告する（下記） |
| App Review に関する情報 | ログイン不要。連絡先を入力。メモに 5 章の審査メモを貼り、画面録画のリンクを入れる |

**App のプライバシー（AdMob を使うアプリの目安）**
Google の「Apple の App Store のデータ開示要件への準備」（AdMob のヘルプ）に、AdMob が収集するデータの一覧があります。必ずそちらを見て最終確認してください。目安は次のとおりです（アプリ自体は記録とセーブを端末の中だけに保存し、外には送りません）。

- 収集する：ID（デバイス ID）、使用状況データ（広告データ、製品の操作）、診断（クラッシュデータ、パフォーマンスデータ、その他の診断データ）、位置情報（おおよその場所）
- 目的：サードパーティ広告、アナリティクス
- ユーザーに関連付け：しない
- トラッキングに使用：デバイス ID と広告データは「する」

入力が終わったら「審査用に追加」→「審査へ提出」。

---

## 7. 公開後にやること

- AdMob で iOS アプリを App Store のアプリに紐づける（「アプリ」→ iOS の暴走新幹線 →「アプリの設定」）
- App Store からインストールして、起動・同意画面・トラッキングの確認・広告を確認する

---

## 8. 自動化の準備（2回目以降を GitHub Actions に任せる場合）

JET STRIKE と同じく、push するだけで GitHub Actions がビルドして TestFlight にアップロードするようにできます。API キーと証明書は Apple Developer のチーム共通なので、**JET STRIKE で作ったものをそのまま使い回せます**（作り方は techgymjp/jet-fighter の `docs/IOS_BUILD.md` 7 章）。

このリポジトリの Settings → Secrets and variables → Actions（https://github.com/techgymjp/shinkansen/settings/secrets/actions）に、次の 5 つを登録します。

| 名前 | 内容 |
| --- | --- |
| `IOS_DIST_CERT_P12_BASE64` | 配布用証明書（.p12）を `base64 -i 証明書.p12 \| tr -d '\n' \| pbcopy` で変換した文字列 |
| `IOS_DIST_CERT_PASSWORD` | .p12 を書き出したときのパスワード |
| `ASC_KEY_ID` | App Store Connect API キーのキー ID |
| `ASC_ISSUER_ID` | Issuer ID |
| `ASC_KEY_P8_BASE64` | API キー（.p8）を `base64 -i AuthKey_XXXXXXXXXX.p8 \| tr -d '\n' \| pbcopy` で変換した文字列 |

登録が終わったら、Claude Code に「iOS の自動アップロードのワークフローを作って」と頼みます。

**注意**：証明書（.p12）、そのパスワード、API キー（.p8）は、チャット・AI へのアップロード・リポジトリへのコミットで**絶対に共有しない**でください。

いまある `.github/workflows/ios.yml` は、push のたびに「署名なしでビルドできるか」だけを確認するものです（アップロードはしません）。

---

## つまずきやすいところ

| 症状 | 対処 |
| --- | --- |
| アップロードで「同じビルド番号がすでにある」 | General の Build の番号を上げてから Archive し直す |
| Signing でエラー（チームが選べない、証明書がない） | Xcode の Accounts で Apple ID にサインインし直し、Team に自分のチームを選ぶ。「Automatically manage signing」をオンにする |
| 実行先に iPhone が出ない | ケーブルをつなぎ直し、iPhone で「信頼」を許可。デベロッパモードをオンにする |
| 実行先に「iOS 26.x Not Installed」と出る | 「Get」で iOS のシミュレーターと部品をダウンロードする（Archive にも必要） |
| ビルドが古いゲームのまま | `npm run ios:sync`（または `ios:release`）を実行し忘れている。`git pull` してから実行し直す |
| 音が出ない | 本体横の消音スイッチをオフにする。音量を上げる |
| 車内放送の声が出ない | 「設定」→「アクセシビリティ」→「読み上げコンテンツ」→「声」で日本語の声が入っているか確認する |
| ビルドを選ぼうとしても出てこない | App Store Connect のバージョンが「1.0」のまま。「1.0.0」に直して保存する |
| 「審査用に追加できません」 | 「アプリ情報」の「コンテンツの配信権」と、「アプリのプライバシー」のプライバシーポリシー URL を入力する |
| 返信に動画を添付すると「エラーが発生しました」 | 動画が大きすぎる。720p にエンコードするか、Google ドライブの共有リンクを貼る |
| 本番広告とテスト広告の取り違え | App Store 用は必ず `npm run ios:release`。Xcode から実機で試すときは `npm run ios:sync` に戻す |
| App Store の審査で「Xcode が古い」と言われる | Xcode を最新版に更新してから Archive し直す |
