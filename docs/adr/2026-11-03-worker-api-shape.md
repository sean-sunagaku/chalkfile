# Worker の入口を小さなルーターにし、AI チャットの受け口は `/api/*` に足す

- 状態: 採用（`/api/*` の受け口と守りは、AI チャット（M4）で入れる）
- 決めた日: 2026-11-03
- 関連: Linear の P-SUN-84（M4）。[配信は Cloudflare Workers と GitHub Releases にする](2026-11-02-workers-and-releases.md)・[Workers Free のままにする](2026-11-02-workers-free-only.md)。今の動きは [配信の設計](../architecture/delivery.md) の「入口の振り分け」

## 背景

- 配信の ADR で、AI チャットの受け口（`/api/ask`）を同じ Worker に載せると決めた（M4）
- これまでの Worker の入口は、「パスが `/media/` で始まるか」の分かれ道 1 つだった。受け口を足すたびに入口を書き換えると、`/media/*` の中継の動きまで変えてしまうおそれがある
- AI の呼び出しは、Workers の枠と違ってお金がかかる。運営の API キーで払い、守り（1 日の予算・回数の制限など）は M4 の ADR で決めると、[Workers Free のままにする](2026-11-02-workers-free-only.md) に書いた。受け口を作る前に、守りの形（どこで、何を止めるか）をここで決め、値は M4 の ADR に残す
- 2026-11-03 に確かめたこと（数字はその日のもの。今の値は公式で確かめる）:
  - `run_worker_first` を配列で書くと、配列に合わないパスの要求には assets だけが答える。合う静的なファイルに当たらなければ 404 のページ（`not_found_handling`）を返し、GET と HEAD のほかには 405 を返す。Worker は呼ばない。手元の `wrangler dev`（4.156.1）で、`/api/ask` の GET・POST・PUT・OPTIONS が Worker を通らないことを確かめた
  - Workers Free の Worker の要求は、アカウントで 1 日 10 万回まで（00:00 UTC に戻る）。`/api/*` も、`/media/*` と同じこの枠を使う。CPU の時間は 1 回 10 ミリ秒までで、fetch の答えを待つ時間は数えない（[Workers の制限](https://developers.cloudflare.com/workers/platform/limits/)）
  - D1 と、SQLite を使う Durable Objects は、Workers Free で使える。どちらも、行の書き込みは 1 日 10 万、保存はそれぞれ 5GB まで。KV の書き込みは 1 日 1,000 回まで（[Workers の料金](https://developers.cloudflare.com/workers/platform/pricing/)）
  - Workers の Rate Limiting の binding は、数を Cloudflare の場所ごとに、おおよそで数える。Workers Free で使えるかは、公式の頁から確かめられなかった（[Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)）
  - Claude Console は、ワークスペースごとに月の上限額を付けられる。既定のワークスペース（Default Workspace）には付けられない（[Workspaces](https://platform.claude.com/docs/en/manage-claude/workspaces)）

## 決めたこと

### 入口の形

Worker の入口（`worker/src/app.ts`）は、パスの頭で受け口を選ぶ小さなルーターにする。どれにも合わなければ、assets に渡す。

| パスの頭 | 受け口 | 動き |
|---|---|---|
| `/media/` | 動画の中継（`worker/src/media.ts`） | これまでと同じ。www は apex へ 301 |
| `/api/` | AI チャット（`worker/src/api.ts`） | 受け口を足すまでは、どのパスとメソッドにも 404 と `{"error":"not_found"}`（`no-store`）を返す |
| ほか | assets（`env.ASSETS.fetch`） | これまでと同じ |

- パスの頭は、`/` で始まり `/` で終わる形で書く（`/media` と `/mediax/` は `/media/` に合わない）
- 受け口ごとにファイルを分け、入口の表には 1 つの受け口を 1 行で書く
- `/api/*` は同じ origin から呼び、答えは JSON にする。CORS のヘッダーは付けない（ページの CSP の `connect-src 'self'` のままで呼べる）

### `run_worker_first` を広げる時期

- `/api/*` を `run_worker_first` に足すのは、M4 で `/api/ask` の受け口と、下の守りを入れる PR にする。それまでは `["/media/*"]` のまま
- 足すのは `/api/*` だけにする。`true`（全部の要求で Worker を先に通す）にはしない。静的なページを assets が先に返す今の形を保つ
- 広げる PR では、公開の点検（`scripts/check_delivery.ts` の Worker の設定の検査）と、手元の smoke（`scripts/smoke_worker.ts`）も合わせて直す

### AI の呼び出しの守り

AI に問い合わせる前に、上から順に確かめる。どれかで止めたら、AI を呼ばない。

| 守り | 決めたこと | 止めたときの答え |
|---|---|---|
| 受け付ける形 | POST と JSON だけ。同じ origin からの要求だけ。質問の長さと本文の大きさに上限を付ける | 4xx |
| レート制限 | 接続元ごとに、短い時間に問い合わせる回数を絞る | 429 と `Retry-After` |
| 1 日の予算 | サイト全体で、1 日に AI を呼ぶ回数（か、見積もった費用）に上限を付ける。数は、同時の要求でもずれないデータベースで数える | その日（00:00 UTC まで）は 503。サイトは「今日の分は終わった」と出す |
| ワークスペースの月の上限 | API キーは、AI の提供元の、AI チャット専用のワークスペースに置き、そのワークスペースに月の上限額を付ける（持ち主が管理画面で付ける） | 提供元が断る。Worker は 503 を返す |

- 数を読めない・書けないときは、AI を呼ばない（止める側に倒す）
- 上限の値（文字数・回数・金額）は、M4 の ADR で決める
- API キーは、持ち主が Worker の secret に置く。リポジトリ・CI・ログに出さない
- ログは `/media/*` と同じく、決まった項目（`code` と数）だけにする。質問と答えの本文は出さない。残したくなったら、M4 の ADR で、置き場所とプライバシーの説明と一緒に決める

### 答えの根拠

- 答えには、根拠にした教材の箇所を、`docs/courses/<講座 ID>/chunks.jsonl` の `id`（節 ID など。[用語集](../architecture/glossary.md) の「チャンク」）で付けて返す。サイトは、今の「AI に聞く」の質問例と同じく、その ID で教材の節へ移る
- 節 ID は、公開したら変えない（[用語集](../architecture/glossary.md) の「章 ID・節 ID」）。変えると、前の答えが指す根拠を失う。変えたら落ちるテストは、別に足す

### データベース

- 1 日の予算とレート制限の数を置くデータベースは、M4 の ADR で、D1 か Durable Objects（SQLite）から選ぶ
- 選ぶときに見ること: 同時の要求でも 1 日の予算を超えないか・Workers Free の枠に収まるか・手元の `wrangler dev` で試せるか
- Worker が教材の本文（`chunks.jsonl`）をどこから読むか（Worker に入れるか、静的なファイルから読むか）も、M4 の ADR で決める

## 理由

- 入口を表にし、受け口をファイルに分けると、`/api/*` を足す PR が `/media/*` の中継に触れずに済む。今の動き（`/media/*` の応答・ヘッダー・ログ、ほかは assets）を変えずに、形だけを先に入れられる
- `run_worker_first` に入れないかぎり、本番の `/api/*` は Worker に届かない。受け口より先に広げると、守りを入れる前から Worker の枠を使う。決まった 404 は、広げたのに受け口を入れ忘れたときにも、AI を呼ばずに答える
- `/api/*` も `/media/*` と同じ 1 日の枠を使う。AI の回数を守りで絞ると、動画の配信の分が残る。枠を超えた日は両方がエラーになり、請求は来ない（[Workers Free のままにする](2026-11-02-workers-free-only.md)）
- AI の費用は、使っただけかかる。Worker の中の守り（レート制限・1 日の予算）は、一度に多く使われるのを止める。提供元の月の上限は、Worker の数がずれたり、守りのコードを誤ったりしても、費用の上限を守る
- 根拠を節 ID で返すと、学ぶ人が AI の答えを教材の本文で確かめられる。節 ID は教材のページの `id` で、質問例の参照にも使っている

## ほかの案

2026-11-03 に比べた案:

| 案 | 選ばなかった理由 |
|---|---|
| `run_worker_first` を `true` にして、全部を Worker で振り分ける | 静的なページの要求でも Worker を呼び、無料の回数の枠を使う |
| `/api/*` を今から `run_worker_first` に入れる | 受け口を入れる前から、Worker の枠を使う |
| AI チャットを別の Worker にする | 設定・公開・点検が 2 つになる。1 日の要求の枠はアカウントで 1 つなので、分けても増えない |
| 数を KV に置く | 書き込みの枠が小さく（Free で 1 日 1,000 回）、数がすぐにはそろわないので、1 日の予算を超えうる |
| Rate Limiting の binding だけで絞る | 数が場所ごとで、おおよそ。サイト全体の 1 日の予算には使えない |
| 提供元の月の上限だけに頼る | 月の初めに使い切られると、残りの日に答えられない。1 日の予算で、毎日使える形にする |

## 影響

- 入口は `worker/src/app.ts` の受け口の表、`/api/*` の受け口は `worker/src/api.ts`。本番の `run_worker_first` は `["/media/*"]` のまま。テストは `tests/worker.test.ts`
- M4 で入れるもの: `/api/ask` の受け口・守り・データベース（M4 の ADR）・`run_worker_first` の `/api/*`・公開の点検と smoke の直し
- 節 ID を変えないことを、テストで守る（別に足す）
- 有料の機能（Workers の有料プラン・有料の置き場所）が要るときは、[Workers Free のままにする](2026-11-02-workers-free-only.md) を置き換える ADR を先に書く
