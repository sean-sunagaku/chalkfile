# 端末に残るものと、外に送られるもの

講座サイト（https://chalkfile.com/）を使う人への、プライバシーの説明。サイトの作りを変えて、ここに書いたことが変わるときは、先にこの文書を直す。

- このサイトは、広告・アクセス解析・会員の登録を入れない方針で作っている
- 学びの記録（進み具合・メモ・確認クイズの答え）は、使っているブラウザの中にだけ残す。サイトのコードは、それをどこにも送らない
- サイトのコードは cookie を使わない

## 端末に残るもの

| 何を | どこに | いつ消えるか |
|---|---|---|
| 進み具合（どこまで見たか・見終えたか）・メモ・確認クイズの答え・設定（再生の速さ・字幕・台本の追従）・最後に開いた動画とタブ | ブラウザの localStorage。名前は講座ごとに `chalkfile:<講座 ID>:` で始まる（訳の講座は `chalkfile:<言語>/<講座 ID>:`） | ブラウザでサイトのデータを消したとき。「保存を削除」では消えない |
| アプリ内に保存した講座（教材のページ・動画・ポスター）と、保存の記録 | ブラウザの Cache API（Service Worker が使う） | 「保存を削除」・新しい版への更新（古い版を片付ける）・ブラウザのデータの消去 |
| 通信なしで起動するための画面（講座の一覧と、オフラインの案内） | 同じ（Cache API）。サイトを開いて Service Worker が入るときに保存する | 次の版の Service Worker が入ったとき（新しい版の画面に入れ替わる） |
| 保存を消さないでほしいという、ブラウザへの求め | ブラウザ（`navigator.storage.persist()`）。「保存を保持するようブラウザに要求」を押したときだけ求める | 認めるかどうかは、ブラウザが決める |

保存の使い方と注意は [講座を保存して、オフラインで学ぶ](learner-offline.md)。

## 外に送られるもの

| 送り先 | いつ | 届くもの |
|---|---|---|
| Cloudflare（chalkfile.com の配信） | ページと動画を開くたび | ふつうの Web の要求と同じもの（接続元の IP アドレス・ブラウザの情報・開いた URL など）。Cloudflare が配信と攻撃の防御に使う（[Cloudflare のプライバシーポリシー](https://www.cloudflare.com/privacypolicy/)） |
| 公式ドキュメントなど、外のサイト | 自分でリンクを開いたときだけ | その先のサイトへの、ふつうの要求。リンクは `noreferrer` なので、講座のページの URL は渡さない |

- 動画は、サイトの Worker が GitHub の Releases から取って中継する。ブラウザは GitHub につながない。Worker が GitHub に渡す要求のヘッダーは、動画の範囲を指す `Range` と `If-Range` だけ（`worker/src/media.ts`）
- Cloudflare は、持ち主がオンにした守りの機能（ボットの判定・チャレンジ・レート制限など）によって、自分の cookie（`__cf_bm`・`cf_clearance`・`_cfuvid` など）を付けることがある（[Cloudflare の cookie の説明](https://developers.cloudflare.com/fundamentals/reference/policies-compliances/cloudflare-cookies/)）

## 持ち主が見られる記録

- Cloudflare のダッシュボードの集計（要求の数・国など）
- Workers Logs（`wrangler.jsonc` の `observability`）。Worker を通る要求（`/media/*`）ごとに、要求と応答の記録が残る。ふつうのページの要求は Worker を通らない。残す期間は Cloudflare の枠で決まる（今の値は [配信の設計](../architecture/delivery.md) の「Worker のログ」）
- Worker が自分で書く記録は、動画を取れなかったときの 1 件ずつだけ。中身は、分類・状態の番号・つないだ先のホスト名・講座とレクチャーの ID。署名つきの URL・path・query・例外の本文は書かない（`worker/src/media.ts`）
