# CI の形

Pull Request と main で流す GitHub Actions の形と、そうしている理由。公開の順番は [公開の順番](publish.md)、止まったときと戻したときは [戻し方](recovery.md)。

- workflow は `.github/workflows/` の `ci.yml`（PR と main）と `canary.yml`（毎日）。手順の中身の正本は、それぞれの YAML と、`.github/actions/` の composite action（`setup`・`ffmpeg`・`playwright`）
- 公開の決まりは、形（ジョブの数・手順の順番）ではなく性質で守る。性質は下の「点検する性質」。`scripts/check_delivery.ts` が確かめ、`npm run check` の単体テスト（`tests/delivery.test.ts`）が、わざと壊して止まるかを見る

## ジョブ（ci.yml）

```text
check ─┬─ build ── smoke ─┬─ deploy（main だけ）
       └─ e2e ────────────┘
```

| ジョブ | すること | 流れるとき |
|---|---|---|
| `check` | lint・足したファイルの整形・型・単体テスト・台本と公開の検証・台本とファイルの点検・文書の点検・教材のずれ（`npm run check` と同じもの） | PR と main |
| `build` | 公開と同じ手順でサイトを組み立てて点検する（素材の取り出し → `synth --cached-only` → `media check` → `gen.ts --media` → `build_site --strict` → `check_delivery`）。Worker を `wrangler deploy --dry-run` でまとめ、公開物を artifact `site-dist` に残す | PR と main |
| `e2e` | 合成の講座で、ブラウザ（Playwright の Chromium）のテストを流す（`npm run test:e2e:ci` を `--if-present` で流す）。失敗したら trace を artifact `e2e-trace` に残す | PR と main |
| `smoke` | `site-dist` を取り、手元の Worker（`wrangler dev` の手元のモード。Cloudflare の認証を使わない）で配って、`scripts/smoke_worker.ts` で配信の約束を確かめる | PR と main |
| `deploy` | 上の 4 つが通ったときだけ、`site-dist` をそのまま出す（下の「公開の流れ」） | main への push と、main を選んだ手動の実行 |

- main を守るルールセットは、ジョブの名前で必須のチェックを待つ。ジョブの名前を変えない
- 点検を足すときは、`check` のジョブに手順を 1 つ足す（必須のチェック `check` に入る）
- secret を使うのは、`deploy` の Deploy の手順だけ。ほかのジョブの `GITHUB_TOKEN` は読み取りだけで、fork からの PR でも同じに流れる
- 同じ PR に新しい push が来たら、古い実行を取り消す。main の実行は取り消さず、来た順に 1 つずつ流す（古い commit を、あとから出さない）

## PR で見られるもの

secret も、PR に書く権限も使わずに、組み立てたものと確かめの結果を見られる。PR の Checks から ci の実行を開き、Summary を見る。

- `build` の要約: 公開物のファイルの数と大きさ・一覧の sha256・Worker の bundle の大きさ・素材のキャッシュを使ったか
- `smoke` の要約: 手元の Worker で確かめた項目ごとの ok と NG
- artifact: `site-dist`（組み立てた `site/dist`・Worker の許可リスト・sha256 の一覧 `.work/ci/site-dist.sha256`・Worker の bundle）、`smoke-result`（smoke と `wrangler dev` の記録）、失敗したときの `e2e-trace`。どれも、日がたつと消える（日数は ci.yml の `retention-days`）
- 取り出した `site-dist` は、リポジトリの最上位に広げて `sha256sum -c .work/ci/site-dist.sha256` で確かめられる

## 公開の流れ（deploy のジョブ）

1. `site-dist` を取り、Worker の許可リストを作り直して（`gen.ts --media`）、`scripts/dist_digest.ts verify` で、build が出した一覧の sha256（ジョブの出力で受け取る）と照らす。足りない・多い・中身が違うファイルがあれば止まる
2. `check_delivery.ts` で、公開の手順の性質と公開物を点検する
3. Deploy の手順（secret はここだけ）が `scripts/deploy_worker.ts` を流す
   - main の先頭でない commit は出さない（古い実行を流し直しても、古い版を出さない）
   - 今の版を控える → `wrangler deploy` → 公開したページと `sw.js` が、組み立てたものと同じバイトになるのを待つ（新しい版が届いたか・`no-transform` が効いているか）
   - `verify_public.ts`（トップと全部の動画の Range）と `tests/worker-site-smoke.ts`（全ページ・SW の scope・CSP。runner の image の Chrome で開く）。通らなければ、間をおいて 1 回だけ流し直す
   - それでも通らなければ、控えた版へ `wrangler rollback` して、ジョブを失敗にする（[戻し方](recovery.md) の「公開後の確かめが通らず、前の版に戻ったとき」）
   - 確かめのコマンドには、token と account ID を渡さない
- 公開は、同じ時に 1 つだけ流れる（concurrency の group `chalkfile-production`。途中で取り消さない）
- 出した版・前の版・確かめの結果は、deploy のジョブの要約に出る

## キャッシュ

| もの | 鍵 | 残す実行 | 決めたこと |
|---|---|---|---|
| npm（`~/.npm`） | `package-lock.json` | どれも（setup-node） | 中身は `npm ci` が lock の integrity で確かめる |
| bun の実行ファイル | bun の版 | どれも（setup-bun） | |
| 素材の WAV と読み（`.work/tts`・`public/audio`） | 素材のブランチ（`materials`）の commit の SHA | main の実行だけ | 台詞の音声の全部なので大きい。PR は main が残したものを戻す。別の版の残りは使わない（素材のブランチに無い声で、CI が通ってしまわないように）。戻した WAV も、`materials.ts pull` が SHA256SUMS で 1 本ずつ確かめる |
| Playwright のブラウザ（`~/.cache/ms-playwright`） | Playwright の版 | どれも | OS の部品（apt）は、毎回 `playwright install-deps` で入れる |
| ffmpeg | 取り出した `ffmpeg` の sha256 | どれも | キャッシュから戻したものも、sha256 を確かめてから使う |

- main の実行が残したキャッシュは、PR から戻せる。PR が残したキャッシュは、その PR の中だけで使われ、main には届かない
- secret のある `deploy` のジョブは、キャッシュを戻さない（setup-node と setup-bun のキャッシュを切る。ブラウザは runner の image の Chrome）。ほかの実行が書いたものを、token のある所で動かさないため

## ffmpeg

- apt では入れず、版を固定した静的なビルドを使う。出どころは BtbN/FFmpeg-Builds の GitHub Releases（ffmpeg.org の Download のページの「Linux Static Builds」が案内しているもの）。月の最後のビルドは 2 年残る
- URL・tar.xz の sha256・取り出した `ffmpeg` の sha256 と、版の上げ方の正本は `.github/actions/ffmpeg/action.yml`
- 素材の FLAC を WAV に戻した結果は、`materials.ts pull` が SHA256SUMS で 1 本ずつ確かめる。版を上げて WAV のバイトが変われば、build で止まる

## 毎日の確かめ（canary.yml）

- 毎日 1 回（日本時間の昼。米国の朝の、Actions が混む時間を避ける）と、手で流したとき（Actions → canary → Run workflow）。secret は使わない。fork では流れない
- 見るもの: トップと全部の動画の Range（`verify_public.ts`）・本番の HTML の smoke（`tests/worker-site-smoke.ts`。runner の image の Chrome）・旧サイトの案内ページが 200 で chalkfile.com を指すか。どれかが通らなくても、残りも流す
- どれかが通らないか、時間切れで止まったら、`report` のジョブが Issue を開く。同じ題の Issue が開いていれば、新しく開かずに書き足す。Issue に書けるのは、このジョブだけ（リポジトリのコードを取らず、gh だけを流す）

### canary が Issue を開いたとき

1. Issue の実行のリンクを開き、どの確かめが通らないかを見る。失敗したときの記録は artifact `canary-evidence`
2. 通らない確かめごとに直す
   - 動画の Range: その講座の動画が Releases にあるかを `npm run media:check` で見る。消えていたら、その講座で `media push --course <講座 ID>` をやり直す（[公開の順番](publish.md) の 6）
   - HTML の smoke: 最近の公開を見る。壊れていたら前の版に戻す（[戻し方](recovery.md) の「サイトを前の版に戻す」）
   - 旧サイトの案内: [戻し方](recovery.md) の「旧 Pages の案内を戻す」
   - 一時の通信の失敗なら、canary を手で流し直す
3. 直ったら、Issue を閉じる

## 点検する性質

`scripts/check_delivery.ts` の `WORKFLOW_RULES` が、`.github/workflows/` の全部の workflow（と、そこから使う composite action の中の手順）を、次の性質で見る。ジョブの数や手順の順番は縛らないので、CI を組み直しても、性質を守っていれば通る。1 つでも破れば、`check` の単体テストと、`build`・`deploy` の `check_delivery.ts` が止まる。表の 1 列目は `WORKFLOW_RULES` と同じ（単体テストが照らす）。

| 性質 | 見ること | 理由 |
|---|---|---|
| secret は Deploy の手順だけ | `secrets` を読めるのは、environment が production のジョブの、Deploy という名前の run の手順の env だけ。token は env で受け、空なら止まる | token を、依存やテストのコードに渡さない |
| production は main だけ | production のジョブの if に、リポジトリと main の条件を、いちばん外の && で入れる。`pull_request_target`・`workflow_run` で動かさない | fork や、main でない ref から公開しない |
| uses は SHA で固定 | action は 40 桁の commit の SHA で指し、横に版を注で書く。リポジトリの中の composite action は、中の手順まで見る | 版の名前（tag）は、あとから別の中身に差し替えられる |
| 権限は読み取りだけ | workflow の permissions は contents: read だけ。書けるのは、毎日の確かめで Issue を開く、コードを取らないジョブの issues: write だけ | PR や依存のコードに、リポジトリを書き換えさせない |
| checkout は認証を残さない | `actions/checkout` に `persist-credentials: false` を付ける | あとの手順に `GITHUB_TOKEN` を残さない |
| インストール時スクリプトを動かさない | `npm ci` には `--ignore-scripts` を付ける。依存を入れる npm のほかのコマンド・`--no-install` の無い `npx`・`bunx` を使わない | 依存の中のスクリプトを、入れるだけで動かさない |
| run に外から来る文字を埋め込まない | run に `github.event` と `github.head_ref` を `${{ }}` で埋め込まない（env で受けて使う） | PR の題や branch の名前で、コマンドを差し込ませない |
| 公開は前のジョブを待つ | 公開のジョブは、公開のあとに流すジョブのほかの全部を needs で待つ。`always()` などで失敗を越えない。待つジョブに `continue-on-error` を付けない | 点検が通っていないものを出さない |
| 公開の前に点検する | Deploy の前に、依存 → Worker の許可リスト → 公開物の点検の順に流す。artifact を取ったら、一覧と照らしてから出す | 出すものを、点検したものと同じにする |
| 公開は 1 つずつ | 公開は concurrency の group `chalkfile-production` で並べ、取り消さない。workflow の取り消しは、PR の実行だけ | 公開を途中で止めない。2 つを同時に出さない |
| 公開のジョブはキャッシュを使わない | `actions/cache` を使わず、setup-node・setup-bun・setup-uv のキャッシュを切る | ほかの実行が書いたものを、token のある所で動かさない |

## action と ffmpeg の版を上げる

- Dependabot が、月に 1 回 action の版を上げる PR を出す。SHA と横の版の注を、いっしょに書き換える
- 手で上げるときは、公式のリポジトリの release の tag が指す commit の SHA を使う（例: `gh api repos/<owner>/<repo>/git/ref/tags/<tag>`。注釈つきの tag は、その先の commit まで読む）。fork の commit を指さない
- ffmpeg は `.github/actions/ffmpeg/action.yml` の書き方に従う

## この形に移したときに、持ち主がやること

1. ci.yml が main で一度流れたら、main を守るルールセットの必須のチェックに `e2e` と `smoke` を足す（`check` と `build` はそのまま）。Settings → Rules → Rulesets →「main を守る」→ Require status checks to pass で、GitHub Actions の `e2e` と `smoke` を足す
2. preview で、rollback が動くかを一度だけ試す（[戻し方](recovery.md) の「rollback を試す（preview）」）
3. 2026-11-10 に、前の形の公開（`.github/workflows/deploy.yml`）を消す。ci.yml の deploy が main で緑に通ったのを確かめてから消し、[戻し方](recovery.md) の「前の形の公開で出す」と、この節も消す
