# Workers 配信の公開確認（2026-11-02）

P-SUN-84 / SUN-1654〜1659。日本語8講座・通常版45本と字幕焼き込み9本を対象とする。M3/M4は含めない。

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
| 型・単体・安全点検 | typecheck、単体63件、content自己検査/本検査に成功。秘密値は検出時も表示しない |
| ブラウザ回帰 | Chrome: 21成功、公開していない多言語4件skip。保存/更新/削除/不足/破損/Range/シーク/旧SW移行を含む |
| wrangler dev | `/` の全ページとSW scope `/`、CSP、中継206/HEAD/416/ダウンロードを確認 |
| 本番HTML | トップと8講座の200、h1表示、CSP/JSエラーなし、SW scope `/`、no-transformを確認 |
| 本番動画 | 全54本の `Range: bytes=0-1` が206、Content-Range、video/mp4、2 bytes、attachmentなし |
| 本番保存 | 実際のchalkfile.comから8講座すべてを保存。ブラウザ終了後に同じ専用profileで再起動し、オフラインで8講座すべての表示/再生/30秒シークに成功 |
| 字幕と単体DL | Riveお笑い版の字幕オン/オフ、90秒シーク、オフラインでの通常版DLに成功。DLしたMP4のSHA-256がマニフェストと一致 |
| 旧保存の実移行 | 切替前の本物のgithub.ioでPstack講座を保存→移行SWへ更新→cache名一覧/ノート不変→オフライン再生/90秒シーク/128 bytesのRange一致→オンラインで同じpath/query/講義hashのapexに到達 |
| 旧URLとwww | トップ/8講座/404から新URLへ自動移動。queryと有効な講義hashを保持。wwwのHTMLからも同じpath/query/hashのapexへ移動。`www/media/` は301 |

本番ブラウザはMacのGoogle Chrome `156.0.8078.48`、headless、1440×1000。音声はmutedで再生し、再生時刻とデコード済みフレームを確認した。音声の聴取、Mac Safari、iPhone実機の結果とは分ける。

www作成直後は端末の負のDNSキャッシュが残ったため、公開DNSと一致するIPを明示してTLS検証を保った確認も行った。その後、通常DNSでのwww移行にも成功した。HTMLのwww移行は静的assets内のCSP hash付きJSで行うため、最初のHTTP状態は200（不明pathは404）。

## 無料枠の測定

測定結果はCloudflare側の検証要求に限定したtailから記録する。ブラウザのページ要求とSWの上流要求を二重に数えない。通常の訪問者のログを取得せず、検証用の非秘密ヘッダーでサーバー側を絞り、生ログ・全ヘッダー・IP・署名URLを保存しない。

2026-11-02 08:22:07〜08:26:27 UTC、Mac Chrome `156.0.8078.48` の新規専用profileからRiveお笑い版 `R01.cc`（253.9秒）を通常速度1.0×で最後まで再生した。7,617フレームをデコードし、Workerで確認したGETは **2要求**（ともに206）。最初は `Range: bytes=0-` のメタデータ取得でブラウザが途中で接続を閉じ、続く `bytes=484450-11990845` で再生を完了した。中断された最初の要求も無料枠の消費として数える。測定接続確認用のHEADは別に除いた。

この条件の参考値は **floor(100,000 / 2) = 50,000再生/日**。まずは追加のCloudflareキャッシュを導入せず、実際の利用とSafariの測定結果を見て判断する。講座を開くだけでも動画メタデータの先読みが `/media/` を呼ぶため、再生しなかった訪問の分も別途加わる。アプリ内保存後のオフライン再生はWorkerへ接続しない。

100,000/日の枠はWorker要求の合計で、アプリ内保存、途中への移動、再試行、将来のチャットも枠を使う。静的assetsのページ/ポスター/VTTはこの枠を使わない。ブラウザ、動画の長さ、通信状態で要求数は変わるため、参考再生数は保証値ではない。[Cloudflareの制限](https://developers.cloudflare.com/workers/platform/limits/)・[静的assetsの料金](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)

## Actionsの実行結果と本人の残作業

[mainの公開workflow](https://github.com/sean-sunagaku/chalkfile/actions/runs/41411442324)では、install/型/単体/content/ffmpeg/素材取得/cached-only合成/Releases照合/strict build/公開物点検がすべて成功。Deployで未登録のAPI tokenを検出して停止した。現行本番は既存のローカルOAuthを使うWranglerから公開したもの。Actionsでの実公開成功は未確認。

[非mainのworkflow_dispatch](https://github.com/sean-sunagaku/chalkfile/actions/runs/41412622989)はjob全体がskippedで、公開しなかった。production environmentはmain限定、Cloudflare secretはDeploy stepだけに渡す。Action SHA固定、contents: read、npm ci --ignore-scripts、公開の直列化も検査対象。

本人が行う作業:

1. [配信手順](workers-delivery.md)の最小権限でCloudflare API tokenを作り、[GitHub production environment](https://github.com/sean-sunagaku/chalkfile/settings/environments)のsecret `CLOUDFLARE_API_TOKEN` へ直接登録する。値は会話/Issue/ファイルへ貼らない。account IDのvarとmain限定policyは設定済み。登録後、mainのdeployを実行して全動画の公開後検査まで成功を確認する。
2. Macのロック解除とWorkのブラウザ接続を有効にし、Mac Safariで下の手順を実施する。今回のUI接続はロック/無効で実行できなかった。
3. iPhone Safariで下の手順を実施する。Chromeの375px表示やWebKitの自動試験を実機成功として扱わない。
4. ドメインの商標確認（SUN-1653）は本人が判断する。登録済み/自動更新オフの方針は変更していない。

Safari確認手順: `https://chalkfile.com/rive-comedy/` を開く→再生→90秒へシーク→字幕オン/オフ→アプリ内保存完了→ブラウザを閉じる→通信を切る（iPhoneは機内モード、Wi-Fiもオフ）→同じURL/ホーム画面のアプリから開く→再生/シーク/字幕切替→動画ファイルDL→通信を戻す→保存削除と再保存。OS/Safari版、成否、最初に止まった手順をSUN-1659へ残す。

## 再実行と証跡

```bash
bun scripts/verify_public.ts
bun tests/worker-site-smoke.ts https://chalkfile.com/
bun tests/verify-production.ts offline
bun tests/verify-production.ts offline-restart
bun tests/verify-production.ts redirects
bun tests/measure-production.ts
```

`offline` と `offline-restart` は別プロセスで起動する。検証用profileとJSON/スクリーンショットは `.work/evidence/` にだけ置き、pushしない。保存プロファイルは認証情報のない専用品。`legacy-before` は旧サイト切替前だけ、`legacy-after` はそこで保存したprofileを使う。本番の現行移行を破壊して旧サイトを戻すことはしない。

ローカル証跡: `production-offline-restart.json`、`production-legacy-before.json`、`production-legacy-after.json`、`production-redirects.json`、`production-edge-measurement.json`、`site-smoke.json` と対応するスクリーンショット。公開できる要約だけを本書/Issueに残した。
