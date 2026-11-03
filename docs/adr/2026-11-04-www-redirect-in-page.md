# www.chalkfile.com からの移動は、ページの頭の静的な script のままにする

- 状態: 採用
- 決めた日: 2026-11-04（リファクタの計画の「SEO・manifest・404」の回に記録した）
- 関連: [配信の設計](../architecture/delivery.md) の「静的な応答と CSP」・[配信は Cloudflare Workers と GitHub Releases にする](2026-11-02-workers-and-releases.md)・[Workers Free のままにする](2026-11-02-workers-free-only.md)

## 背景

- `www.chalkfile.com` も同じ Worker の Custom Domain に付けている。ページは静的な assets が返し、その頭の script（`scripts/site/csp.ts` の `WWW_REDIRECT_SCRIPT`。CSP のハッシュで許す）が、同じ path・query・hash の `https://chalkfile.com` へ `location.replace` で移す。`www` の `/media/` は Worker が 301 を返す
- 検索の点からは、`www` のページも HTTP の 301 で apex へ移すほうがよい。301 にする方法は 2 つある: Worker を全部の要求の先に通す（`run_worker_first`）か、Cloudflare のダッシュボードのリダイレクトの規則
- 2026-11-04 の時点で、ページは canonical（`<link rel="canonical">`）・hreflang・sitemap.xml で apex の URL だけを示している（`www` の URL は、どこからもリンクしていない）

## 決めたこと

- `www` のページの移動は、今の静的な script のままにする（ページの HTTP の状態は 200。無いパスは 404）
- ダッシュボードのリダイレクトの規則で 301 にするのは任意にする。入れるかどうかは持ち主が決める
- 入れるときは、規則の中身（`www` のどのパスも、同じ path と query の apex へ 301）と入れた日を、[初回の設定](../operations/setup.md) に書く

## 理由

- Worker を全部の要求の先に通すと、ページと画像の要求も Worker の 1 日の回数の枠（[Workers Free のままにする](2026-11-02-workers-free-only.md) の値）を使う。今は `/media/*` だけが枠を使う
- ダッシュボードの規則は、設定がリポジトリの外に出る。`wrangler.jsonc` と組み立てのコードを見ても分からず、PR でも見直せない。CI に zone の設定の権限を渡すことにもなる（CI の token は Workers の公開だけにしている）
- 検索で困ることは小さい。canonical と sitemap が apex だけを指し、`www` の URL を外に出していない

## ほかの案

| 案 | 選ばなかった理由 |
|---|---|
| Worker を全部の要求の先に通して 301 を返す | ページと画像の要求も、Worker の無料の枠を使う |
| ダッシュボードのリダイレクトの規則を、必ず入れる | 設定がコードの外に出て、PR で見直せない。zone の権限を CI に渡さない形にしているので、手で入れて手で守ることになる |
| `www` の Custom Domain を外す | `www` を打った人が、つながらなくなる |

## 影響

- `www` のページは、JS が動かないと移らない（同じ中身が 200 で出る。canonical が apex を指す）
- ダッシュボードの規則を入れたあとも、ページの頭の script は消さない（規則を外したとき、ずれた日でも移るように）
- 同じことを書いている所: [配信の設計](../architecture/delivery.md)
