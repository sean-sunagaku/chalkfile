# Workers 配信の公開確認（2026-11-03）

これは記録。書いた日のことで、今の手順ではない。今の手順は、公開が [公開の順番](../operations/publish.md)、初回の設定が [初回の設定](../operations/setup.md)、戻し方が [戻し方](../operations/recovery.md)。配り方の設計は [配信の設計](../architecture/delivery.md)。

P-SUN-84 / SUN-1654〜1659。日本語9講座・通常版48本と字幕焼き込み12本をActionsで公開した確認結果。初回8講座の保存/移行/実通信断の証跡も保持し、GA4を含む9講座の再確認と区別する。M3/M4は含めない。iPhone実機は本人指示により今回の完了条件から除外した。

## 公開されたもの

- 正本: https://chalkfile.com/ 。同じWorkerのCustom Domainに www.chalkfile.com も接続。
- 検証対象の公開: main `76a9da98b921459bb00cd8a7012f6a22b5473c37`、[Actionsの成功したattempt 2](https://github.com/sean-sunagaku/chalkfile/actions/runs/41468738419/attempts/2)。Worker version: `c8dd8884-31b6-4dcc-b63a-80009158bd0f`。初回のローカルWrangler公開から、production secretを使うActions公開へ移行できた。
- 動画: Releasesの9タグ・60 assets、合計879,276,298 bytes。マニフェストのサイズ、提供されたSHA-256、手元60本のSHA-256が一致。
- サイト: 静的82 files、約5.0MB。静的公開物にMP4なし。Workerを先に通すのは `/media/*`。
- 旧Pages: `9dd4e82cf6bee4c4096bd84291825886ec987a8f`、移行案内13 files、約56KB。Pages buildはbuilt。旧版はローカルの `refs/chalkfile-backups/gh-pages-ad75d60` に保持。

PR: [土台 #13](https://github.com/sean-sunagaku/chalkfile/pull/13)、[Releases #14](https://github.com/sean-sunagaku/chalkfile/pull/14)、[中継 #15](https://github.com/sean-sunagaku/chalkfile/pull/15)、[保存 #16](https://github.com/sean-sunagaku/chalkfile/pull/16)、[公開と移行 #18](https://github.com/sean-sunagaku/chalkfile/pull/18)、[CI修正 #19](https://github.com/sean-sunagaku/chalkfile/pull/19)。

## 検証結果

| 対象 | 結果 |
|---|---|
| 型・単体・安全点検 | typecheck、単体68件（Editor発行不可時にAdminへ広げない回帰、CLIの最小権限/秘密値の受け渡し/失敗時失効/現行token形式を含む）、content自己検査/本検査に成功。秘密値は検出時も表示しない |
| ブラウザ回帰 | Chrome: 21成功、公開していない多言語4件skip。保存/更新/削除/不足/破損/Range/シーク/旧SW移行を含む |
| wrangler dev | `/` の全ページとSW scope `/`、CSP、中継206/HEAD/416/ダウンロードを確認 |
| 本番HTML | トップと9講座の全10ページが200、h1表示、CSP/JSエラーなし、SW scope `/`、no-transformを確認 |
| 本番動画 | 全60本の `Range: bytes=0-1` が206、Content-Range、video/mp4、2 bytes、attachmentなし。Actions内とMacからそれぞれ確認 |
| 本番保存 | 実際のchalkfile.comから新しい専用profileに9講座すべてを保存。ブラウザ終了後に同じprofileで再起動し、通信遮断下で9講座すべての表示/再生/30秒シークに成功。初回8講座のprofileと証跡は別名で保全 |
| 字幕と単体DL | Riveお笑い版の字幕オン/オフ、90秒シーク、オフラインでの通常版DLに成功。DLしたMP4のSHA-256がマニフェストと一致 |
| 旧保存の実移行 | 切替前の本物のgithub.ioでPstack講座を保存→移行SWへ更新→cache名一覧/ノート不変→オフライン再生/90秒シーク/128 bytesのRange一致→オンラインで同じpath/query/講義hashのapexに到達 |
| 旧URLとwww | トップ/9講座/404から新URLへ自動移動。queryと有効な講義hashを保持。wwwのHTMLからも同じpath/query/hashのapexへ移動。`www/media/` は301 |
| Mac Safari CLI | Safari 26.5.2 / macOS 26.5.2の実ブラウザで全10ページ、SW scope /、再生/シーク、Rive全4ファイルの保存に成功。初回にはWi-Fi断での新規タブ起動/再生/90秒シーク/字幕切替/Range206/ダウンロード応答のSHA-256一致も確認 |

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

## Actionsの実行結果と残作業

他の作業で追加されたGA4講座（3講義・通常版3本/字幕版3本）も公開対象に含めた。[ポスター不足で停止したActions](https://github.com/sean-sunagaku/chalkfile/actions/runs/41445266401)を受け、[PR23](https://github.com/sean-sunagaku/chalkfile/pull/23)でSHA-256照合済みの通常版から、render.shと同じ4.2秒地点・幅1280・JPEG品質3の画像を補い、目視した。全60本のSHA/サイズ、strict build、公開物点検、型・単体・Chrome回帰も成功。古い移行SW生成物を使う回帰サーバーの不備も修正し、意図的に旧生成物を置いた移行2件が成功、再生成SWと本番gh-pagesのSHAも一致した。

2026-11-03、専用account token `chalkfile-github-production` を1件作成し、GitHub productionの `CLOUDFLARE_API_TOKEN` に登録した。Workers Editorは対象account、Workers Routes Write / Zone Readはchalkfile.comだけ。cf beta.26のOAuth制約で最小権限のCLI発行が拒否されたため、Adminへ広げず公式管理画面で発行・登録した。値は隔離したブラウザ内の一時メモリから直接secret欄へ渡し、登録後に破棄。会話/ファイル/引数/ログへは残していない。既存の認証ファイルや個人のWrangler OAuthも読み出していない。初期設定専用のcf profileは `cf auth delete chalkfile-ci-bootstrap` で削除し、一覧が空であることを確認した。通常のWrangler認証は対象にしていない。

`setup_cloudflare_ci.ts apply` がmain限定policy、account ID、secret名の存在を読み戻して公開を開始した。[成功したActions](https://github.com/sean-sunagaku/chalkfile/actions/runs/41468738419/attempts/2)はinstall/型/単体/content/ffmpeg/素材取得/cached-only合成/Releases照合/strict build/公開物点検/Deploy/全60動画Rangeまで成功。最初のattemptはUbuntu配布ミラーの取得が7分以上進まず、Deploy前に中断した。新しいrunnerでの再実行は同じ検査を通過して成功した。以前のsecret未設定チェックによる停止も解消した。

この公開の後、Macから全10ページの200/CSP/JS/SW、全60動画の206を確認した。新しいChrome profileへ9講座すべてを保存し、完全終了後の別プロセスで通信を遮断して9講座の再生/30秒シーク、Riveの字幕切替/90秒シーク、単体DLのSHA-256一致に成功。旧github.ioからのトップ/9講座/404とwwwの移動もquery/hashを保って成功した。Mac Safariでも全10ページ、1920×1080の実デコード、再生/シーク、Rive全4ファイル保存が成功した。この再実行のdocumentはhiddenだったためDOM clickを使った。前記の初回実通信断と、解除後の通常pointer操作の証跡を別に保ち、今回それらを再実施したとは扱わない。

[非mainのworkflow_dispatch](https://github.com/sean-sunagaku/chalkfile/actions/runs/41412622989)はjob全体がskippedで、公開しなかった。productionはmain限定、Cloudflare secretはDeploy stepだけ。Action SHA固定、contents: read、npm ci --ignore-scripts、公開の直列化、機密情報/MP4の公開物混入防止を維持する。権限ヘルパーとDocs/Skillの更新は[PR33](https://github.com/sean-sunagaku/chalkfile/pull/33)にまとめ、公開するWorkerと静的ファイルのコードは変更していない。

M1/M2の実装・公開・今回の範囲の検証に残作業はない。iPhone実機は2026-11-02の本人指示「実機はしなくていい」により対象外で、未実施を成功に置き換えない。本人が判断する残件はドメインの商標確認（SUN-1653）。自動更新オフの方針は変更していない。SUN-1627のDone操作は本人の担当として触れていない。

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
