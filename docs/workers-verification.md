# Workers 配信の公開確認（2026-11-02）

P-SUN-84 / SUN-1654〜1659。初回公開の日本語8講座・通常版45本と字幕焼き込み9本を対象とした結果を記録する。後続mainで追加されたGA4講座の確認は下記の再開結果に分ける。M3/M4は含めない。

## 公開されたもの

- 正本: https://chalkfile.com/ 。同じWorkerのCustom Domainに www.chalkfile.com も接続。
- Worker version: `6a273b87-5429-449a-8b5b-21f8b28d2b1b`（PR18の `9d6f19e` を公開）。続くPR19はCIへのffmpeg追加のみ。
- 動画: Releasesの8タグ・54 assets、合計823,714,815 bytes。マニフェストのサイズ、提供されたSHA-256、手元54本のSHA-256が一致。
- サイト: 静的77 files、約4.7MB。静的公開物にMP4なし。Workerを先に通すのは `/media/*`。
- 旧Pages: `9dd4e82cf6bee4c4096bd84291825886ec987a8f`、移行案内13 files、約56KB。Pages buildはbuilt。旧版はローカルの `refs/chalkfile-backups/gh-pages-ad75d60` に保持。

PR: [土台 #13](https://github.com/sean-sunagaku/chalkfile/pull/13)、[Releases #14](https://github.com/sean-sunagaku/chalkfile/pull/14)、[中継 #15](https://github.com/sean-sunagaku/chalkfile/pull/15)、[保存 #16](https://github.com/sean-sunagaku/chalkfile/pull/16)、[公開と移行 #18](https://github.com/sean-sunagaku/chalkfile/pull/18)、[CI修正 #19](https://github.com/sean-sunagaku/chalkfile/pull/19)。

## 検証結果

| 対象 | 結果 |
|---|---|
| 型・単体・安全点検 | typecheck、単体67件（CLIの最小権限/秘密値の受け渡し/失敗時失効/現行token形式を含む）、content自己検査/本検査に成功。秘密値は検出時も表示しない |
| ブラウザ回帰 | Chrome: 21成功、公開していない多言語4件skip。保存/更新/削除/不足/破損/Range/シーク/旧SW移行を含む |
| wrangler dev | `/` の全ページとSW scope `/`、CSP、中継206/HEAD/416/ダウンロードを確認 |
| 本番HTML | トップと8講座の200、h1表示、CSP/JSエラーなし、SW scope `/`、no-transformを確認 |
| 本番動画 | 全54本の `Range: bytes=0-1` が206、Content-Range、video/mp4、2 bytes、attachmentなし |
| 本番保存 | 実際のchalkfile.comから8講座すべてを保存。ブラウザ終了後に同じ専用profileで再起動し、オフラインで8講座すべての表示/再生/30秒シークに成功 |
| 字幕と単体DL | Riveお笑い版の字幕オン/オフ、90秒シーク、オフラインでの通常版DLに成功。DLしたMP4のSHA-256がマニフェストと一致 |
| 旧保存の実移行 | 切替前の本物のgithub.ioでPstack講座を保存→移行SWへ更新→cache名一覧/ノート不変→オフライン再生/90秒シーク/128 bytesのRange一致→オンラインで同じpath/query/講義hashのapexに到達 |
| 旧URLとwww | トップ/8講座/404から新URLへ自動移動。queryと有効な講義hashを保持。wwwのHTMLからも同じpath/query/hashのapexへ移動。`www/media/` は301 |
| Mac Safari CLI | Safari 26.5.2 / macOS 26.5.2の実ブラウザで全9ページ、SW scope /、再生/シーク、Rive全4ファイルの保存、Wi-Fi断での新規タブ起動/再生/90秒シーク/字幕切替/Range206/ダウンロード応答のSHA-256一致に成功 |

本番ブラウザはMacのGoogle Chrome `156.0.8078.48`、headless、1440×1000。音声はmutedで再生し、再生時刻とデコード済みフレームを確認した。音声の聴取、Mac Safari、iPhone実機の結果とは分ける。

Mac Safariは本人のCLI実行指示を受け、Apple公式safaridriverをCLIで有効にして別途確認した。画面ロック中でもWebDriverの実セッションを作れるため、最初の「Macの手動解除待ち」は解消した。非表示documentではnative pointerのclickやcompositorのframe数が機能しなかったため、同じ保存/字幕ボタンのDOM clickを使い、実際の動画をCanvasへ取り出して非単色のデコード画像を確認した。Wi-Fiの電源オフ、独立した外部リクエストの失敗、Safariの未保存URLへのfetch失敗を照合して通信断を確認した。navigator.onLineはtrueのままだったため、これを通信の証拠には使っていない。

オフラインの起動は同じ隔離Safariセッション内の新規タブで行った。Safariプロセス全体の再起動と音声の聴取まで成功したとは主張しない。Wi-Fiはfinallyと45秒の独立watchdogで復旧し、終了後の通常HTTPS 200も確認した。全体のブラウザ終了/再起動は前記Chromeで確認済み。

その後、本人がMacを解除した状態でRive講座を新しい隔離Safariセッションから確認した。documentがvisibleであることを確認し、DOM clickへの切替を使わず、WebDriverの通常のelement clickでアプリ内保存と字幕切替に成功。30秒/90秒へのシークで再生時刻が進み、1920×1080・デコード済みフレーム数26/58を確認した。保存は全教材・全動画22.5MBの完了表示を読み戻した。この実行はオンラインの通常操作の確認で、初回の実通信断の結果と区別して記録する。

www作成直後は端末の負のDNSキャッシュが残ったため、公開DNSと一致するIPを明示してTLS検証を保った確認も行った。その後、通常DNSでのwww移行にも成功した。HTMLのwww移行は静的assets内のCSP hash付きJSで行うため、最初のHTTP状態は200（不明pathは404）。

## 無料枠の測定

測定結果はCloudflare側の検証要求に限定したtailから記録する。ブラウザのページ要求とSWの上流要求を二重に数えない。通常の訪問者のログを取得せず、検証用の非秘密ヘッダーでサーバー側を絞り、生ログ・全ヘッダー・IP・署名URLを保存しない。

2026-11-02 08:22:07〜08:26:27 UTC、Mac Chrome `156.0.8078.48` の新規専用profileからRiveお笑い版 `R01.cc`（253.9秒）を通常速度1.0×で最後まで再生した。7,617フレームをデコードし、Workerで確認したGETは **2要求**（ともに206）。最初は `Range: bytes=0-` のメタデータ取得でブラウザが途中で接続を閉じ、続く `bytes=484450-11990845` で再生を完了した。中断された最初の要求も無料枠の消費として数える。測定接続確認用のHEADは別に除いた。

この条件の参考値は **floor(100,000 / 2) = 50,000再生/日**。まずは追加のCloudflareキャッシュを導入せず、実際の利用とSafariの測定結果を見て判断する。講座を開くだけでも動画メタデータの先読みが `/media/` を呼ぶため、再生しなかった訪問の分も別途加わる。アプリ内保存後のオフライン再生はWorkerへ接続しない。

100,000/日の枠はWorker要求の合計で、アプリ内保存、途中への移動、再試行、将来のチャットも枠を使う。静的assetsのページ/ポスター/VTTはこの枠を使わない。ブラウザ、動画の長さ、通信状態で要求数は変わるため、参考再生数は保証値ではない。[Cloudflareの制限](https://developers.cloudflare.com/workers/platform/limits/)・[静的assetsの料金](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)

## Actionsの実行結果と本人の残作業

再開時の最新mainにはGA4講座（3講義・通常版3本/字幕版3本）が追加され、9講座・60動画になっていた。[新mainのActions](https://github.com/sean-sunagaku/chalkfile/actions/runs/41445266401)はG01〜G03のポスター不足を検出し、公開前に停止した。[PR23](https://github.com/sean-sunagaku/chalkfile/pull/23)で、SHA-256照合済みの通常版からrender.shと同じ4.2秒地点・幅1280・JPEG品質3の画像を補い、目視した。Releasesの全60本のサイズ/提供SHAと手元SHA、strict build（82 files・5.0MB・MP4なし）、公開物点検、typecheck、単体67件、Chrome回帰21成功/未公開言語4skipを確認した。

古いローカル移行SW生成物による回帰の失敗も修正した。テストサーバーは起動時に現在のソースから組み立てる。旧SWの生成物を意図的に置いてから起動した移行2件が成功し、再生成したSWは本番gh-pagesのものとSHA一致。PR23はmainの `978aef79f35a56f5e7104ed5e1c6fe702381559e` へマージ済み。[そのmainの公開workflow](https://github.com/sean-sunagaku/chalkfile/actions/runs/41450025967)はinstallからstrict build/公開物点検まで成功し、Deployのsecret未設定チェックで停止した。Cloudflareの最終認可確認を待っており、API token作成・production secret登録とActionsの実公開成功は未完了。現行本番へのGA4講座の追加はまだ成功と扱わない。

[mainの公開workflow](https://github.com/sean-sunagaku/chalkfile/actions/runs/41411442324)では、install/型/単体/content/ffmpeg/素材取得/cached-only合成/Releases照合/strict build/公開物点検がすべて成功。Deployで未登録のAPI tokenを検出して停止した。現行本番は既存のローカルOAuthを使うWranglerから公開したもの。Actionsでの実公開成功は未確認。

[非mainのworkflow_dispatch](https://github.com/sean-sunagaku/chalkfile/actions/runs/41412622989)はjob全体がskippedで、公開しなかった。production environmentはmain限定、Cloudflare secretはDeploy stepだけに渡す。Action SHA固定、contents: read、npm ci --ignore-scripts、公開の直列化も検査対象。

今回の確認範囲: 2026-11-02の本人指示「実機はしなくていい」により、iPhone実機はM1/M2の完了条件から除外した。Mac Safari/Chrome、実通信断、保存/Range/シーク/移行の検証は維持する。iPhone未検証を成功に置き換えない。

Cloudflareの表示済み権限については本人から続行許可を受領済み。トークン作成の実行許可を再度求める必要はないが、公式cfの本人認可が完了するまでは発行APIを呼ばない。Macのロック解除とCloudflareでの認可完了は別の状態として確認する。

本人が行う作業:

1. [配信手順](workers-delivery.md)の公式cf CLIの初回認可を本人が承認する。認可後のtoken作成/production secret登録/mainのdeploy開始は `setup_cloudflare_ci.ts apply` で進める。API tokenの値を会話やファイルへコピーする必要はない。再開時はブラウザに権限を表示し、新規の機密アクセスを与える最終確認を依頼した。Device Grantは確認待ちの間に期限切れになったため、同じコードを再利用しない。token作成は未実施、production secretの件数0を読み戻した。Actions経由の実公開成功は引き続き未確認。
2. ドメインの商標確認（SUN-1653）は本人が判断する。登録済み/自動更新オフの方針は変更していない。

除外前のiPhone接続確認では、CoreDeviceのiPhone 11はpaired/unavailable、利用可能なmobile inventoryはシミュレータだけで、Mirroringも接続不能だった。Apple WebDriverでも実機sessionを作れなかった。これらは接続確認の記録であり、実機Safariの動作確認ではない。今後、追加依頼があれば対象を再確認して実施する。

任意で追加検証する場合のSafari手順: `https://chalkfile.com/rive-comedy/` を開く→再生→90秒へシーク→字幕オン/オフ→アプリ内保存完了→ブラウザを閉じる→通信を切る（iPhoneは機内モード、Wi-Fiもオフ）→同じURL/ホーム画面のアプリから開く→再生/シーク/字幕切替→動画ファイルDL→通信を戻す→保存削除と再保存。OS/Safari版、成否、最初に止まった手順をSUN-1659へ残す。

## 再実行と証跡

```bash
bun scripts/verify_public.ts
bun tests/worker-site-smoke.ts https://chalkfile.com/
bun tests/verify-production.ts offline
bun tests/verify-production.ts offline-restart
bun tests/verify-production.ts redirects
bun tests/measure-production.ts
bun tests/verify-safari.ts # Mac Safariのオンライン/保存。safaridriverを自動起動して終了時に停止
bun tests/verify-safari.ts --disconnect-wifi=en1 # 明示したWi-Fiを短時間切り、復旧してオフラインを検証
```

`offline` と `offline-restart` は別プロセスで起動する。検証用profileとJSON/スクリーンショットは `.work/evidence/` にだけ置き、pushしない。保存プロファイルは認証情報のない専用品。`legacy-before` は旧サイト切替前だけ、`legacy-after` はそこで保存したprofileを使う。本番の現行移行を破壊して旧サイトを戻すことはしない。

ローカル証跡: `production-offline-restart.json`、`production-legacy-before.json`、`production-legacy-after.json`、`production-redirects.json`、`production-edge-measurement.json`、`site-smoke.json` と対応するスクリーンショット。公開できる要約だけを本書/Issueに残した。

今回のSafariの証跡は `.work/evidence/safari/verification-offline.json`（オンラインの確認も含む）と動画から取り出したフレーム画像。通信断を省略した実行は `verification-online.json` に分けて保存する。初回有効化は `sudo /usr/bin/safaridriver --enable` を使えるが、管理者認可がなければ本人がその端末で行う。パスワードを会話やファイルへ貼る方法は使わない。[Apple公式のCLI設定](https://developer.apple.com/documentation/safari-developer-tools/macos-enabling-webdriver)

Mac解除後の通常pointer操作の証跡は `.work/evidence/safari/verification-visible.json` と `visible-pointer.png`。個人のSafariウィンドウ、Cookie、ログイン状態を使わず、一時の自動試験セッションで確認して終了した。
