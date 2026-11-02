# Chalkfile の配信と移行

サイトの正本は `https://chalkfile.com/`。設定は `wrangler.jsonc`、動画の正本は `site/media-manifest.json`。日本語だけを公開し、M3/M4は別の作業で進める。

## 公開する順番

1. 手元のMacで台本・音声・動画を作り、`site/posters/` のJPGも確認する。
2. `bun scripts/media.ts push` → `bun scripts/media.ts check`。動画をReleasesへ先に置き、hash付きの一覧をコミットする。古いhashのassetは削除しない。更新前の一覧を `retained` に残し、Workerの許可リストにも保持する。開いている旧ページのシークを途中で404にしない。
3. 型・単体・安全点検・strict build・実ブラウザを確認してPRをmainへ入れる。
4. Actionsが素材pull・`synth --cached-only`・Releases照合・strict build・公開物点検を行ってから、固定版Wranglerで公開する。音声や動画が不足していれば公開しない。
5. 公開後、トップ200と全動画のRange 206を確認する。公開成功と、保存/実機確認の成功を分けて記録する。

```bash
npm ci --ignore-scripts
bun scripts/materials.ts pull
bun scripts/synth.ts --cached-only
bun scripts/media.ts check
bun scripts/build_site.ts --strict
bun scripts/build_migration.ts
bun scripts/check_delivery.ts site/dist
npm run typecheck
npm test
bun scripts/check_content.ts --self-test
bun scripts/check_content.ts
bun scripts/media.ts pull stripe-billing pstack-comedy # ブラウザ回帰用の実動画。変更済みの手元動画を上書きしない
npm run test:browser
npm run dev:worker
bun tests/worker-site-smoke.ts
```

JPGは小さな静的入力として `site/posters/` に入れる。MP4を取得しなくてもCIでサイトを作れる。素材ブランチのFLACをWAVへ可逆復元するため、CIではUbuntuの標準リポジトリからffmpegを入れる。VTT・講義データはキャッシュ済み音声から作る。`synth --cached-only` は不足時にVOICEVOXやKokoroへ接続しない。動画を手元へ戻す場合は `bun scripts/media.ts pull [講座ID…]` を使う。

## Cloudflare と GitHub の初回設定

WorkersはFreeを維持する。Paid、R2、Terraformを導入しない。Custom DomainのDNSはWranglerが作る。ローカルの初回認証は `npx --no-install wrangler login`。既存のOAuthが使えるときは再認証しない。認証ファイルやtoken値を読んだり表示したりしない。

GitHubの[production environment](https://github.com/sean-sunagaku/chalkfile/settings/environments)はcustom branch policyを `main` だけにする。workflowのrepository/ref条件でもmainを確認する。`CLOUDFLARE_ACCOUNT_ID` はこのenvironmentのvars、`CLOUDFLARE_API_TOKEN` はこのenvironmentのsecretに設定する。

API tokenは[CloudflareのAPI Tokens](https://dash.cloudflare.com/profile/api-tokens)で作る。アカウントを対象のものに限定し、既存の `chalkfile` Workerを更新するEditor権限（従来の権限表示は Workers Scripts / Edit）を使う。Custom DomainをWranglerで照合・変更するための Zone / Workers Routes / Edit と Zone / Zone / Read は `chalkfile.com` だけに限定する。D1/KV/R2/Registrar/請求/全zoneの権限は付けない。アカウントIDをvarsに渡すため、アカウント一覧の取得権限をCIへ追加しない。細粒度のWorker指定が選べる画面では `chalkfile` を選ぶ。

token値はその場でGitHubのsecret欄に入力する。会話・Issue・PR・ファイル・ログ・Wrangler設定へ貼らない。個人のWrangler OAuth tokenをCIへ流用しない。ActionsではCloudflare secretをDeploy stepだけに渡し、依存のinstallや素材取得、テスト、buildでは使わない。ActionはSHAで固定、`contents: read`、checkoutのcredential永続化なし、npmは `--ignore-scripts`。

初回の試験公開は `npx --no-install wrangler deploy --env preview`、本番は `npx --no-install wrangler deploy --env=""`。以後の通常公開はmainへのpushまたはmainを選んだworkflow_dispatch。非mainのdispatchはjob条件とenvironment policyで拒否する。

## 配信とCSP

サイトは無料の静的assetsが配り、Workerを先に通すのは `/media/*` だけ。動画は固定リポジトリのReleasesへRange/If-Rangeだけを渡し、本文をstreamで返す。毎回元のURLからredirectをたどり、署名付きLocationを保存・ログ出力しない。

静的応答には `Cache-Control: public, max-age=0, must-revalidate, no-transform` を付ける。CloudflareによるHTML/画像の変更と自動Web Analytics beaconの挿入を防ぎ、CSPと保存用SHA-256を維持する。SWはno-cache。2026-11-02に自動beaconによるCSP違反を実際に検出し、no-transform後に全9ページで違反なしを確認した。[Cloudflareの仕様](https://developers.cloudflare.com/web-analytics/get-started/)

wwwも同じWorkerのCustom Domainで管理する。HTMLはassetsで返し、その先頭のCSPハッシュ付き `location.replace` で同じpath/query/hashのapexへ自動移動する。HTMLの最初のHTTP状態は200（不明pathは404）。`www/media/` はWorkerから301を返す。この構成では通常の静的リクエストでWorkerを呼ばず、zone Redirect Ruleの追加権限もCIへ渡さない。

## 旧 GitHub Pages の切替

`bash scripts/deploy_pages.sh` は移行案内だけを出す。最新main・cleanなcheckout・公開先の全動画Range・ブラウザのCSP/SW確認に通らないと止まる。見ていた旧gh-pages SHAを指定したforce-with-leaseを使い、ローカルの `refs/chalkfile-backups/gh-pages-<main SHA>` に復旧参照を残す。通常のサイトとMP4をgh-pagesへ公開し直す用途には使わない。

案内はトップ・全講座・404にcanonical、meta refresh、押せるリンク、path/query/hashを保持するlocation.replaceを置く。旧scope `/chalkfile/` のSWを登録してから移る。

移行SWは `chalkfile:/chalkfile/:offline-v1:` のregistry/course/shell cacheを読み、install/activateでは削除しない。オンラインの次のページ移動は新サイトへ案内。オフラインでは完全な旧保存版とRange再生を返し、保存し直しの案内を表示する。旧保存・メモ・進捗は異なるoriginへ自動転送できない。旧サイトで新規保存は行わず、利用者が明示した旧講座の削除だけ受け付ける。

`tests/fixtures/legacy-pages/` は、旧公開commit `a4399995c3ebd0b356459fcae3812da117c2ab9b` の本物のHTML/SW/起動用ファイルを最小限保持する。MP4は含めず、同じhashのReleases動画を使う。`tests/browser/migration.spec.ts` で旧SW→移行SW、保存・記録・隣のアプリのcache保持、オフラインRange/シーク、query/hash保持を確認する。

## 機密情報と復旧

`check_content.ts` は追跡済みと追加予定のファイルを点検し、認証ファイルは内容を読まず拒否する。`check_delivery.ts` はActionsの権限/順序/secretの範囲と、生成物の機密情報・MP4・サイズ制限を点検する。検出した値は表示しない。ブラウザprofile、動画、`.env`、`.dev.vars`、`.wrangler`、音声、作業ログをコミットしない。

サイトの不具合はWorkersの以前のversionへrollbackできる。動画は旧hashを保持するため、戻したページも同じ動画を参照できる。旧Pagesを戻す必要がある場合はローカル復旧参照を確認し、他の更新と公開許可の範囲を照合する。保存cacheの全消去を復旧手段にしない。

公式確認: [Workersの制限](https://developers.cloudflare.com/workers/platform/limits/)、[static assetsの料金](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)、[選択したパスのWorker優先](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)、[Workersの権限](https://developers.cloudflare.com/workers/authorization/workers/)、[Releasesの制限](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)（2026-11-02）。
