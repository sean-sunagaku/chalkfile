# 配信は Cloudflare Workers と GitHub Releases にする

- 状態: 採用
- 決めた日: 2026-11-02（持ち主）
- 関連: Linear の P-SUN-84（M1・M2）・SUN-1627・SUN-1647。実装は #13〜#16・#18

## 背景

- 講座サイトと動画は、GitHub Pages（`sean-sunagaku.github.io/chalkfile/`）から出していた
- 動画はこれからも増える。英語と中国語の訳を出すと、さらに増える
- 学ぶ人は、講座をブラウザに保存して、通信なしで見られる。保存のときに Service Worker が動画の大きさと SHA-256 を確かめるので、動画はサイトと同じ origin から、中身を読める形で返す必要がある
- 動画の途中へ飛ぶには、Range の要求に 206 で答える必要がある

## 決めたこと

- サイトは chalkfile.com の Cloudflare Worker から、静的なファイル（assets）として配る
- 動画は GitHub Releases に置く。Worker の `/media/*` が、頼まれた範囲だけを Releases から中継する
- 公開は GitHub Actions から wrangler で行う
- あとで、AI チャットの受け口（`/api/ask`）も同じ Worker に載せる（M4）

## 理由

2026-11-02 に確かめたこと（数字はその日のもの。今の値は公式で確かめる）:

- Releases は、総量と転送量に上限を設けていない（1 ファイルは 2 GiB まで）。Range の要求には 206 で答える
- Releases の URL をそのまま使うと、302 で別のホストに移り、`application/octet-stream`・`attachment` で返り、CORS のヘッダーが付かない。Worker が同じ origin で中継し、`video/mp4` にして `attachment` を外せば、保存と途中への移動がそのまま動く
- Workers の静的なファイルの配信は無料で、Worker の回数の枠を使わない。Worker を先に通すのは `/media/*` だけにできる
- 費用はドメイン代だけで済む（[Workers Free のままにする](2026-11-02-workers-free-only.md)）

## ほかの案

2026-11-02 に比べた案:

| 案 | 選ばなかった理由 |
|---|---|
| GitHub Pages を続ける（言語ごとに Pages のサイトを分ける案も） | 1 サイト 1GB まで。今の画質だと、1 言語 7 時間分ほどで埋まる。言語ごとのサイトは一度作りかけたが、この決定で使わないことにした |
| Releases の URL をそのまま使う | CORS のヘッダーが付かず、Service Worker が中身を確かめて保存できない。URL は約 1 時間で切れる |
| Cloudflare Pages（静的なファイル） | Range の要求に 200 で全体を返すと公式にあり、途中へ飛べない見込み |
| R2 | 無料は 10GB まで。超えた分は有料で、止まる上限が設けられていない |
| YouTube | 講座をブラウザに保存できない。広告が出うる。中国本土で見られない |

## 影響

- 動画は Releases の `media-<言語>-<講座 ID>` のタグに、SHA-256 入りの名前で置く。どの動画を出すかは `site/media-manifest.json` が決め、サイトの組み立てと Worker が同じ一覧を読む
- Worker は、一覧にあるパスだけを通し、Range と If-Range だけを上流に渡す。転送先のホストも決めてある（`worker/src/media.ts`）
- 静的なファイルに MP4 を入れない。サイトの組み立ての最後に、ファイルの数と大きさの枠と一緒に確かめる（`scripts/build_site.ts`）
- 動画は merge の前に Releases に置く。置いた時点で、誰でも取れる
- 旧 GitHub Pages は、新しいサイトへの案内だけを出す（[移行コードを終える期限](2026-11-02-legacy-pages-end-date.md)）
- 公開の手順の正本は [公開の順番](../operations/publish.md)、初回の設定は [初回の設定](../operations/setup.md)、配り方の設計は [配信の設計](../architecture/delivery.md)。データの流れは [全体図](../architecture/overview.md)
- 公式の説明: [Workers の制限](https://developers.cloudflare.com/workers/platform/limits/)・[静的なファイルの料金と制限](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)・[選んだパスで Worker を先に通す](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)・[Releases について](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)
