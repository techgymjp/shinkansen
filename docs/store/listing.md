# Google Play ストア掲載情報（下書き）

Play Console の「ストアの掲載情報」に貼り付けて使います。既定の言語を日本語にし、「翻訳を管理」から英語（en-US）を追加してください。
英語版はコピーしやすいよう `listing-en.txt` にも同じ内容を入れています。

## 画像（このフォルダ）

| 用途 | ファイル | サイズ |
| --- | --- | --- |
| アプリのアイコン | `icon-512.png` | 512 × 512 |
| フィーチャー グラフィック（日本語） | `feature-graphic.png` | 1024 × 500 |
| フィーチャー グラフィック（英語） | `feature-graphic-en.png` | 1024 × 500 |
| スマートフォンのスクリーンショット（日本語） | `ja-1-fuji.png` 〜 `ja-6-crash.png` | 1920 × 1080 |
| スマートフォンのスクリーンショット（英語） | `en-1-fuji.png` 〜 `en-6-crash.png` | 1920 × 1080 |

スクリーンショットは次の順番で並べるのがおすすめです。

1. `1-fuji` 右の窓から富士山（車掌放送「右手に富士山が見えます」）
2. `2-overtake` 木曽川のトラス橋で、上り線からのぞみを追い抜く
3. `3-station` 名古屋駅を 590km/h で通過（駅名テロップ）
4. `4-kyoto` 左の窓から京都の街並みと東寺の五重塔
5. `5-himeji` 右の窓から姫路城
6. `6-crash` 対向列車に衝突して大爆発

---

## 日本語

**アプリ名**（30 文字以内）

```
暴走新幹線
```

**簡単な説明**（80 文字以内）

```
東京→博多1,069kmを最高時速603kmで爆走！ポイントで線路を切り替え、のぞみを追い抜け
```

**詳しい説明**

```
ブレーキのない新幹線で、東京から博多まで突っ走れ。

最高時速 603km/h。前を走る 300km/h ののぞみに追いついたら、ポイントで隣の線路へ。
でもそこは対向列車が向かってくる上り線。タイミングを外せば大爆発！
何回爆発しても博多までは行けるけれど、そのたびに速度 0 からやり直し。

■ 本物の東海道・山陽新幹線を走る
・線路の曲がり方と駅の位置は、国土交通省の「国土数値情報」の路線データから再現
・東京〜博多 1,069.1km（実キロ）、全 35 駅を実際の距離どおりに配置
・駅を通過するたびに駅名のテロップ
・新丹那・六甲・新関門などのトンネル、富士川・天竜川・木曽川などの橋梁
・木曽川・長良川・揖斐川はトラス橋の中を駆け抜ける

■ 車窓の名所
・富士山、東京タワー、小田原城、名古屋城、姫路城、広島城、小倉城
・東寺や備中国分寺の五重塔、お寺、造山古墳などの前方後円墳
・相模湾・駿河湾・浜名湖・瀬戸内海、田んぼ、茶畑、街並み、山並み
・「右手に富士山が見えます」車掌の放送が名所を案内
・運転台の前方だけでなく、左右の窓から景色を眺められる

■ 暴走新幹線のルール
・ブレーキはない。アクセルを離すと惰行でゆっくり減速（そのぶんタイムは伸びる）
・黄色い「⇄」の信号が線路切り替えのポイント。手前で左右のボタンを押す
・大爆発するとペナルティ +3 分
・記録は「タイム部門」と、大爆発 0 回で走り切る「無事故部門」の 2 つ
・全力で加速しながら追い抜けば、腕次第で無事故の博多到着も夢じゃない

■ その他
・好きな駅から駅まで走れる区間選択
・等倍（リアル）から 8 倍速まで選べる
・途中でセーブして、あとで続きから
・結果を友だちにシェア
・オフラインでも遊べる（広告・シェアは通信が必要）
・日本語・英語対応

さあ、出発進行！
```

---

## English

**App name** (max 30 characters)

```
Runaway Shinkansen
```

**Short description** (max 80 characters)

```
Race a brakeless bullet train 1,069 km from Tokyo to Hakata at up to 603 km/h!
```

**Full description**

```
A bullet train with no brakes. Tokyo to Hakata. How fast can you make it?

Your top speed is 603 km/h. When you catch up with the 300 km/h Nozomi ahead, switch to the other track — but that's the up line, where oncoming trains are heading straight for you. Miss your timing and KABOOM!
You can crash as many times as you like and still reach Hakata, but every crash puts you back at 0 km/h.

■ RIDE THE REAL TOKAIDO & SANYO SHINKANSEN
• Track curves and station locations recreated from official Japanese government railway data
• 1,069.1 km from Tokyo to Hakata, with all 35 stations at their real distances
• A station name banner every time you blast through a station
• Long tunnels like Shin-Tanna, Rokko and Shin-Kanmon, and big river bridges
• Thunder through the steel truss bridges over the Kiso, Nagara and Ibi rivers

■ SIGHTS OUT THE WINDOW
• Mt. Fuji, Tokyo Tower, and the castles of Odawara, Nagoya, Himeji, Hiroshima and Kokura
• Five-story pagodas at Toji and Bitchu Kokubunji, temples, and ancient keyhole-shaped burial mounds (kofun)
• Sagami Bay, Suruga Bay, Lake Hamana and the Seto Inland Sea, rice paddies, tea fields, towns and mountains
• The conductor announces the sights: "Mt. Fuji on the right"
• Watch from the driver's cab, or look out the left and right windows

■ RULES OF THE RUNAWAY
• No brakes. Let go of the throttle and you coast down slowly — but your time suffers
• The yellow "⇄" signal marks a track switch. Tap left or right just before it
• Every crash adds a 3-minute penalty
• Two records: Time, and No-Crash for runs with zero crashes
• Overtake at full throttle and a crash-free run to Hakata is within reach

■ FEATURES
• Pick any start and end station
• Play in real time or at up to 8× speed
• Save mid-run and continue later
• Share your result with friends
• Plays offline (ads and sharing need a connection)
• English and Japanese

All aboard — departure!
```

---

## Play Console「アプリのコンテンツ」の回答の目安

- **プライバシー ポリシー**: https://techgym.jp/privacy-policy/
- **広告**: 「はい、広告を含みます」
- **アプリのアクセス権**: 「制限なし（ログイン不要）」
- **広告 ID**: 「使用する」（目的は「広告またはマーケティング」と「アナリティクス」）
- **ターゲット ユーザー**: 13 歳以上（13 歳未満を含めると広告に制限がかかる）
- **データ セーフティ**: アプリ自体は個人情報を集めない（記録とセーブは端末の中だけに保存）。Google AdMob が「デバイスまたはその他の ID（広告 ID）」と「アプリの操作（広告の表示・クリック）」を広告とアナリティクスの目的で収集・共有する。通信は暗号化されている。※ AdMob の公式ガイドに従って最終確認すること
- **コンテンツのレーティング**: ゲーム → 暴力表現は「列車どうしの衝突・爆発（人物の描写・流血なし）」
- **カテゴリ**: ゲーム → シミュレーション（またはレース）

## リリースノート（初回）

```
<ja-JP>
暴走新幹線、出発進行！最初のリリースです。
</ja-JP>
<en-US>
Runaway Shinkansen is departing! First release.
</en-US>
```
