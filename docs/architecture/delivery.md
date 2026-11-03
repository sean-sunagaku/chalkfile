# 配信の設計（chalkfile.com・Workers・Releases）

講座サイトと動画を、どう配るか。なぜこの形にしたか。手順は書かない（公開は [公開の順番](../operations/publish.md)、初回の設定は [初回の設定](../operations/setup.md)、戻し方は [戻し方](../operations/recovery.md)）。決めた理由は [配信の ADR](../adr/2026-11-02-workers-and-releases.md) と [無料のままにする ADR](../adr/2026-11-02-workers-free-only.md)。

- サイトの正本は https://chalkfile.com/。設定は `wrangler.jsonc`、Worker は `worker/src/`、動画の正本は講座ごとの動画の一覧（`content/<講座>/generated/media.<言語>.json`）。Worker はそれをつないだ許可リスト（`npm run gen` が作る `worker/src/generated/media-manifest.json`。Git に入れない）を読む
- 全体の流れと置き場所は [全体図](overview.md)

## 配り方

- サイトは、無料の静的なファイル（Workers の assets）が配る。Worker を先に通すのは `/media/*` だけ（`wrangler.jsonc` の `run_worker_first`）。ふつうのページの要求では Worker を呼ばない
- MP4 は assets に入れない。静的な出力は 2 万ファイル・1 ファイル 25MiB の内に収め、組み立てのあとに点検する（`check_delivery.ts`）
- 動画は、固定のリポジトリの GitHub Releases に置く。タグは講座と言語ごと（`media-<言語>-<講座 ID>`）、ファイルの名前に中身の SHA-256 が入る。名前で中身が決まるので、上書きも削除もしない
- 動画の一覧には、今の動画（`entries`）と、前の版のハッシュの動画（`retained`）を並べる。サイトのページが指すのは `entries` だけで、Worker は両方を通す。開いたままの前のページや、戻した版のページが、途中への移動で 404 にならないようにするため（[ADR](../adr/2026-11-02-keep-old-video-hashes.md)）
- 一覧の形の検査は `site/media-shared.ts` にあり、サイトの組み立て・Worker・テストが同じものを使う

## 入口の振り分け

- `run_worker_first` に合わないパスには、合う静的なファイルに当たらなくても assets が答え（そのパスからいちばん近いフォルダの `404.html` を 404 で返す。無いページは言語ごとで、`/en/` の下は `en/404.html`。GET と HEAD のほかは 405）、Worker を呼ばない。Worker の入口に受け口を足しても、`run_worker_first` に入れるまで本番の要求は届かない
- Worker の入口（`worker/src/app.ts`）は、パスの頭で受け口を選ぶ小さなルーター。どれにも合わなければ assets に渡す。形と、`run_worker_first` を広げる時期は [ADR](../adr/2026-11-03-worker-api-shape.md)

| パスの頭 | 受け口 |
|---|---|
| `/media/` | 動画の中継（`worker/src/media.ts`。下の「/media/ の中継」）。www は apex へ 301 |
| `/api/` | AI チャットの受け口（`worker/src/api.ts`。M4 で入れる）。それまでは、どのパスとメソッドにも 404 と `{"error":"not_found"}`（`no-store`）を返す。`run_worker_first` に `/api/*` を足すのは、受け口と守りを入れる PR |

## /media/ の中継

- Worker は、動画の一覧にあるパスだけを中継する（`/media/<言語>/<講座 ID>/<レクチャー ID>[.cc].<SHA-256>.mp4`）。上流は、固定のリポジトリの決まったタグだけ
- GET と HEAD を受ける。上流へ渡すリクエストヘッダーは Range と If-Range だけ（Cookie・Authorization・任意の URL を渡さない）
- 元の Releases の URL から、期限つきの redirect を毎回たどる（https だけ・ホストは固定・3 回まで）。署名つきの Location を、保存もログへの出力もしない。本文は stream のまま返す
- ふつうの再生は `video/mp4`。単体で保存する `?download=1` にだけ attachment を付ける
- 配信元の 404 は 404、通信の失敗や 5xx は 502。失敗を長くキャッシュしない
- 応答（200・206・416・HEAD・エラー）には `Cross-Origin-Resource-Policy: same-origin` を付ける。ほかのサイトに動画を埋め込ませない（その再生で、Worker の無料の枠を使わせない）
- 講座のページの動画は `preload="none"`。講座を開いただけでは `/media/` を呼ばず、再生を押すか時刻を選んだときに、開いたレクチャーの動画だけを読む（Worker の回数の枠を使わない。カリキュラムの長さは台本のデータから出す）。画面（`site/page/player.ts`）は動画を `src` で渡し、`load()` を呼ばない（Chrome は `load()` を呼ぶと、`preload="none"` でも読み始める）。確かめるのは `tests/browser/offline.spec.ts` の「講座を開いただけでは」

## 静的な応答と CSP

- 静的な応答のヘッダーは `_headers` で付ける。規則の正本は `scripts/site/headers.ts` の `HEADER_RULES`。Worker が返す `/media/` には効かない（そちらは `worker/src/media.ts` が付ける）
- 静的な応答には `Cache-Control: public, max-age=0, must-revalidate, no-transform` を付ける。Cloudflare が HTML や画像を書き換えたり、Web Analytics の beacon を自動で差し込んだりするのを防ぎ、CSP と保存用の SHA-256 を保つ。Service Worker（`/sw.js`）は `no-cache, no-transform`
- 2026-11-02 に、自動の beacon による CSP の違反を実際に見つけた。`no-transform` を付けたあと、全部の 9 ページで違反が無いことを確かめた（[Cloudflare の仕様](https://developers.cloudflare.com/web-analytics/get-started/)）
- 全部の静的な応答に、セキュリティのヘッダーを付ける。`Content-Security-Policy: frame-ancestors 'none'`（meta の CSP では効かないので、ヘッダーで送る）・`X-Frame-Options: DENY`・`Permissions-Policy`（使わないカメラ・マイク・位置・支払い・USB を止める。全画面とクリップボードは止めない）・`Cross-Origin-Opener-Policy: same-origin`。保存版を SW が返すときは、SW が応答を作るので、ページの meta の CSP が効く
- Workers の静的 assets は、パスに当たる規則を上から順に重ね、同じヘッダーを 2 つの規則が付けると値をカンマでつなぐ（[_headers の仕様](https://developers.cloudflare.com/workers/static-assets/headers/)。2026-11-03 に確かめた）。上書きする規則は、先に `! 名前` で外す。組み立ての最後（`scripts/site-invariants.ts`）が、どの静的な応答にも `no-transform` が付き、値がつながっていないことを確かめ、smoke（`scripts/smoke_worker.ts`）が `/` と `/sw.js` の実際のヘッダーを規則と照らす
- 規則はパスでしか当たらない（query を見ない）。`?v=` の付いたポスターは、同じパスを一覧のページの縮小画像・og:image・SW の起動用ファイルが `?v=` 無しで読むので、ほかの静的な応答と同じ `Cache-Control` にする（長くキャッシュさせると、描き直したあとも一覧のページの縮小画像が古いまま残る）。中身のハッシュが名前に入る動画（`/media/`）は、Worker が `immutable` を付ける
- HSTS（`Strict-Transport-Security`）は、ゾーンの設定（Cloudflare の HSTS の設定と、ほかのサブドメイン）を持ち主が確かめてから決める
- 検索のための `sitemap.xml`（出す言語の一覧のページと講座のページ。同じページのほかの言語も書く）と `robots.txt` は、組み立てが最上位に置く（`scripts/site/seo.ts`）。robots は、動画（`/media/`。Worker の枠を使う）と、通信できないときに SW が出すページ（`offline/`）を取りに来させない
- www も、同じ Worker の Custom Domain で持つ。HTML は assets で返し、その頭の CSP のハッシュつきの `location.replace` で、同じ path・query・hash の apex へ移す。HTML の最初の HTTP の状態は 200（知らないパスは 404）。`www` の `/media/` は Worker が 301 を返す。この形なら、ふつうの静的な要求で Worker を呼ばず、zone の Redirect Rule の権限も CI に渡さずに済む（ダッシュボードの規則で 301 にするのは任意。理由は [ADR](../adr/2026-11-04-www-redirect-in-page.md)）

## 公開に要るもの

- 公開の組み立ては、声も動画も作らない。素材ブランチの声と、Releases の動画と、main のポスター・動画の一覧から作る。足りなければ止まる（声の合成も書き出しも始めない）
- ポスター（JPG）は小さな静的な入力として、講座のフォルダの `content/<講座>/generated/posters/` に入れる。MP4 を取らなくても、CI でサイトを作れる。新しい講座で全部のレクチャーのポスターがそろっていないと、strict の組み立てが公開の前に止まる。CI で動画を取ってきてポスターを補う形にはしない
- 素材ブランチの FLAC を WAV に戻すため、CI は版を固定した ffmpeg を入れる（`.github/actions/ffmpeg`）。講義のデータ（サイトの台本と字幕の時刻）は、取り出した声から作る。サイトの字幕（WebVTT）は、ブラウザが講義のデータから作る。`synth --cached-only` は、足りないときに VOICEVOX や Kokoro へつながない。`synth --cached-only --durations-only` は、素材ブランチの長さの一覧（`DURATIONS.json`）と読みだけで同じ講義のデータを作る（音声も ffmpeg も要らない。一覧が無い・古いときは、音声を取り出してから作る）
- ブラウザのテストのサーバーは、移行の案内に、公開済みのもの（`tests/fixtures/legacy-migration`。`gh-pages` の 9dd4e82 をそのまま写したもの）を配る。今のソースから作り直さないので、`site/offline-shared.ts` を直しても、移行のテストは変わらない（移行のコードは凍結している。[ADR](../adr/2026-11-02-legacy-pages-end-date.md)）。本物の `gh-pages` への反映は `scripts/legacy/deploy_pages.sh` だけが行う

## Worker のログ

`wrangler.jsonc` の `observability.enabled` で Workers Logs を有効にしている（preview の env も受け継ぐ）。

- 2026-11-02 に確かめた枠: Free は 2026-11-30 まで、1 日 20 万件・3 日の保存。呼び出しの記録（1 回に 1 件）と `console` の出力（1 回の出力に 1 件）を数える。この Worker が `console` に出すのは、失敗したときの 1 件だけ。Free の Worker の要求は 1 日 10 万件までなので、全部が失敗しても 20 万件に収まる
- 2026-12-01 からは Cloudflare Observability の料金に移り、Free は 1 日 0.5GB（ログと trace の合計）・7 日の保存になる。上限に届くと、その日（00:00 UTC まで）は取り込みが止まるだけで、Free では超えた分の料金はかからない（[Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)・[Observability の料金](https://developers.cloudflare.com/observability/pricing/)・[Workers の制限](https://developers.cloudflare.com/workers/platform/limits/)）

`/media/*` の失敗は、`{ message: 'media_upstream_failed', code, status, host, course, lecture }` を 1 件だけ `console.error` に出す。URL・path・query・署名・例外の本文は出さない。`host` はホストの名前だけ。無い値は `null`。

| code | 意味 | 学ぶ人への応答 |
|---|---|---|
| `upstream_missing` | Releases が 404 を返した（asset か tag が無い） | 404 |
| `redirect_host` | redirect を拒んだ（許可の外のホスト・https でない・認証情報つき・Location が無いか読めない・4 回目）。`host` は拒んだ行き先 | 502 |
| `status` | 上流が 200・206・416・404・redirect のほかを返した（403・429・5xx など） | 502 |
| `network` | 上流につながらなかった（DNS・切断・時間切れ）。`host` はつなごうとした先 | 502 |

## 古いハッシュの動画の期限

- `media push` で一覧から外れた前のハッシュの動画は、`retained` に `retainedUntil`（UTC の日付。その日まで）を付けて残す。期限は `retained` に入れた日から 90 日。もう `retained` にあるものの期限は変えない（期限の無い古い項目には、次の push で付ける）
- 期限を過ぎたものが残っていると、`media.ts check`（`build_site.ts --strict` の中でも流れる）と `check_delivery.ts` が注意を出す。Actions では注釈にし、公開は止めない。外すかどうかは持ち主が決める（手順は [戻し方](../operations/recovery.md)）。Release の asset は消さない

## 旧 GitHub Pages の移行

- 前の公開先（`gh-pages` ブランチ）には、新しいサイトへの案内だけを置く。置き換えるのは `scripts/legacy/deploy_pages.sh` だけ。最新の main・変更の無い作業フォルダ・公開先の全部の動画の Range・ブラウザでの CSP と Service Worker の確かめに通らないと止まる。見ていた `gh-pages` の SHA を指定した force-with-lease で置き換え、手元に復旧用の参照（`refs/chalkfile-backups/gh-pages-<main の SHA>`）を残す。ふつうのサイトと MP4 を `gh-pages` に出し直す用には使わない
- 案内は、トップ・全部の講座・404 に、canonical・meta refresh・押せるリンク・path と query と hash を保つ `location.replace` を置く。旧サイトの scope の Service Worker を登録してから移る
- 移行の Service Worker（`site/legacy-sw.ts`）は、旧サイトの保存の cache（registry・course・shell）を読み、install と activate では消さない。オンラインでは、次のページの移動で新しいサイトへ案内する。オフラインでは、完全な前の保存版と Range の再生を返し、保存し直しの案内を出す。前の保存・メモ・進み具合は、違う origin へ自動では移せない。旧サイトでは新しい保存をせず、学ぶ人が選んだ前の講座の削除だけを受け付ける
- `tests/fixtures/legacy-pages/` は、前の公開の commit `a4399995c3ebd0b356459fcae3812da117c2ab9b` の本物の HTML・Service Worker・起動用のファイルを、少しだけ持つ。MP4 は持たず、本物の講座のテスト（`test:e2e:real`）は同じハッシュの Releases の動画を使う。合成の講座のテスト（`test:e2e:ci`）は合成の動画に替え、保存の manifest の大きさと SHA-256 を、その動画に合わせて配る。`tests/browser/migration.spec.ts` で、前の Service Worker から移行の Service Worker への切り替え、保存・記録・隣のアプリの cache が残ること、オフラインの Range と途中への移動、query と hash が保たれることを確かめる
- 移行のコードを終える日は [ADR](../adr/2026-11-02-legacy-pages-end-date.md)

## 秘密情報の扱い

- `check_content.ts` は、追跡しているファイルと足す予定のファイルを点検する。認証ファイルは中身を読まずに止める。`check_delivery.ts` は、Actions の権限・順番・secret の範囲と、生成物の秘密情報・MP4・大きさの上限を点検する。見つけた値は表示しない
- ブラウザの profile・動画・`.env`・`.dev.vars`・`.wrangler`・声・作業のログを commit しない
- 動画は古いハッシュを残しているので、Worker を前の版に戻しても、戻したページは同じ動画を指せる

## 公式で確かめたこと

[Workers の制限](https://developers.cloudflare.com/workers/platform/limits/)・[static assets の料金](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)・[選んだパスだけ Worker を先に通す](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)・[Workers の権限](https://developers.cloudflare.com/workers/authorization/workers/)・[Releases の制限](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)（2026-11-02）。

本番での保存・移行・要求の数と、Actions の実行の結果は [公開確認の記録](../history/2026-11-03-workers-verification.md) に残した。
