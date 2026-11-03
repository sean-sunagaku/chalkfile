---
name: chalkfile-engine
description: Chalkfile の講座サイト（PWA）・保存（オフライン）・Worker と動画の配信を直すときの決まりと確かめ方。サイトのひな形（site/）・講座のページの画面（site/course-page.ts・site/page/）・Service Worker と保存（site/sw.ts・site/offline-*.ts）・組み立て（scripts/build_site.ts・scripts/pwa.ts）・Worker（worker/・wrangler.jsonc）を変えたら、ここを読む。単体テスト・strict の組み立て・実 Chrome のブラウザのテスト・手元の Worker・公開したサイトの確かめ直し・Mac の Safari の確かめ方をまとめる。講座の中身（台本・声・動画）は study-video-course。Use when 講座サイトの画面・保存・オフライン再生・PWA・インストールの案内を直したい、Service Worker を変えたい、Worker や /media/ の配信を直したい、公開したサイトを確かめ直したい、Safari や iPhone で確かめたい。Triggers "講座サイト", "オフライン", "アプリ内保存", "PWA", "Service Worker", "Worker", "/media/", "配信", "Safari", "本番を確かめる"
---

# 講座サイト・保存・Worker を直す

講座サイト（PWA）・保存（オフライン）・Worker を変えるときの決まりと確かめ方。講座の中身（台本・声・動画）を作る・直すときは、スキル `study-video-course`。

| 読むもの | 中身 |
|---|---|
| [保存の設計](../../../docs/architecture/offline.md) | 保存と更新の約束・保存データの互換・再生と案内・作る場所 |
| [配信の設計](../../../docs/architecture/delivery.md) | Workers・Releases・`/media/` の中継・静的な応答と CSP・旧 Pages の移行 |
| [公開の順番](../../../docs/operations/publish.md) | 公開の順番と、「サイトと Worker を変えたとき」の確かめ方（コマンドの正本） |
| [学ぶ人向けの説明](../../../docs/guide/learner-offline.md) | 保存・オフライン・インストールの説明。保存の動きを変えたら、一緒に直す |

## 守ること

- 静的な応答の `no-transform` を外さない（CSP と保存の SHA-256 を守る）。MP4 を assets に入れない。Worker を先に通すのは `/media/*` だけ
- `/media/` の中継は、上流に Cookie や Authorization を渡さず、本文を stream のまま返す。署名つきの転送先の URL を、保存もログへの出力もしない。HEAD では Range を見ず、エラーは `no-store`。キャッシュの工夫は、測ってから決める
- Workers Free のままにする。手元から `wrangler deploy` しない（[AGENTS.md](../../../AGENTS.md) の「公開と Workers のきまり」）
- サイトの版は、出力から決まる（`scripts/site-version.ts`）。ページの HTML や、保存する動画・ポスターが変わると、保存した全員に「新しい版」の案内が出て、取り直しになる。見た目の変わる直しは、まとめて出す。整形・コメント・関数の切り出しのように出力の変わらない直しで、版が変わらないことを確かめる
- 保存した講座を壊さない。検証を厳しくする変更には、互換のテスト（`tests/offline-compat.test.ts`）が当たる。fixture を書き換えて通さない（[保存の設計](../../../docs/architecture/offline.md) の「保存データの互換」）
- 講座のページの画面は `site/course-page.ts` と `site/page/` に TypeScript で書く。`site/template.html` に script を書かない（組み立てが Bun で 1 本にまとめ、`__PAGE_SCRIPT__` の所に入れる。CSP のハッシュも組み立てが作る）。部品は `site/page/dom.ts` で作り、innerHTML を使わない
- ページの JSON の形は `site/page/data.ts` の `CourseData` が正本（組み立ての `courseJson` が `satisfies` で確かめる）。学習の記録（localStorage）の形を変えるときは、前の版の画面が読み書きしても壊れない形にし、見本（`tests/fixtures/local-storage/`）を残したまま互換のテストを通す（[保存の設計](../../../docs/architecture/offline.md) の「学習の記録の互換」）
- 画面を変えたら、キーボードだけで使えることと、axe を確かめる。axe の重大（critical）と深刻（serious）は 0 にする（既知の一覧 `tests/fixtures/a11y-known/` に入れても落ちる）。1 文字のショートカットは、動画を選んでいるときだけ効かせる。フォーカスのある要素を作り直さない（作り直すときは、同じ所へフォーカスを戻す）
- 講座の版が変わる回（「新しい版」が出る回）は、何が変わったかの 1 文を `site/news.ts` に、その回のお知らせを `docs/history/` に足す（[保存の設計](../../../docs/architecture/offline.md) の「新しい版の案内」）
- 不完全な保存を、成功として扱わない。オンラインの視聴・1 本のダウンロード・アプリ内の保存・インストールを、分けて見せる
- 生成物が古いことを理由に、本番の保存の cache を消さない。移行のテストが落ちたら、旧保存の fixture・今の移行用の Service Worker・旧 Pages の本番のどれのせいかを分けて調べる（ブラウザのテストのサーバーは、起動のたびに、移行の案内と Service Worker を今のソースから作り直す）
- 動画・生成物・ブラウザの profile・証跡・秘密情報を main に入れない。`scripts/legacy/deploy_pages.sh` は、持ち主が旧 Pages の移行の案内を出すときだけに使う

## 確かめる

コマンドと順番の正本は、[公開の順番](../../../docs/operations/publish.md) の「サイトと Worker を変えたとき」。要点:

```bash
npm run check                    # lint・型・単体テスト（tests/worker.test.ts・tests/offline*.test.ts も）・点検
npm run build:site -- --strict   # 公開と同じ組み立て。最後に公開物の決まり（scripts/site-invariants.ts）を確かめる
npm run test:browser             # 実 Chrome で、保存・再生・Range・通信断・再起動・更新・移行
npm run dev:worker -- --ip 127.0.0.1 --port 8787 --infer-origin-from-routes=false   # 別の端末で
bun scripts/smoke_worker.ts http://127.0.0.1:8787/                                  # ルート / と SW の scope / ・CSP・/media/ の応答
```

- 再生を確かめるには、本物の動画と字幕のデータが要る（`bun scripts/media.ts pull stripe-billing pstack-comedy`）。mock・型・ブラウザのスマホの幅から、iPhone の実機での成功を推し量らない
- 見るもの: PC と 375px の画面・本当の通信断・ブラウザを閉じてからの起動・保存と削除・更新の失敗と成功・取り消しとやり直し・容量の例外・バイトを照らした Range と途中への移動・字幕版の切り替え・1 本のダウンロード。移行を変えたら、新しいブラウザの context で、Service Worker の install と scope も見る
- 画面を変えたら、`npm run test:e2e:ci -- tests/browser/a11y.spec.ts` で axe と、キーボードだけでの操作（本文へ飛ぶ・再生・タブ・クイズ・チャプターとレクチャーの移動）を見る
- 案内（保存の状態・進み具合・通信のエラー）を変えたら、`npm run test:browser -- tests/browser/offline-status.spec.ts` も流す。一時の profile で全部の動画を 1 回保存し、完全に閉じたあとのオフラインの起動・完全な版がある／無いときの保存の欠け・遅い確認のエラーと保存の進み具合の取り合い・エラーと操作の結果が消えないことを見る。テストで起こした欠けや通信のエラーを、本物の故障と混ぜない
- 公開していない訳の講座の場面を、日本語の成功に数えない（公開していない言語のテストは、skip として記録する）
- 公開したあとの表示の直しは、新しい版を選んで保存し直してから、オフラインで確かめる（保存した前の版の HTML は書き換わらない）
- `/media/` を変えたら、公開したあとに `bun scripts/verify_public.ts`（全部の動画の Range の 206）も見る

## 公開したサイトを確かめ直す

- 基本は [公開の順番](../../../docs/operations/publish.md) の「公開後の確認」（トップの 200・全部の動画の Range・全ページの表示と SW の scope と CSP）
- 保存・再起動・再生: `bun tests/verify-production.ts offline` で、認証情報の無い専用の profile に保存する。そのあと別のプロセスの `bun tests/verify-production.ts offline-restart` で、通信を切った再起動・再生・途中への移動・字幕の切り替え・1 本のダウンロードの SHA-256 を見る。前の保存の profile は残したまま確かめ、古い「保存済み」の表示を、新しい保存の成功と数えない
- 1 本のダウンロード: 保存を確かめた一時の profile を消す前に、通信を切ったまま「動画ファイルをダウンロード」を 1 回押し、名前・大きさ・SHA-256 を生成物と照らす。保存の cache を使えるかを見て、全部の動画を取り直さない。アプリ内の保存や手元での成功を、公開したサイトでボタンを押した成功と数えない
- 要求の数: `bun tests/measure-production.ts` で、自分の確かめ用のヘッダーが付いた要求だけを Cloudflare の側で数える
- profile と生のログは push しない。結果は日付つきの記録に残す（見本は [公開確認の記録](../../../docs/history/2026-11-03-workers-verification.md)）。Chrome や自動の試験での成功を、Safari や iPhone の実機での成功と混ぜない

## Mac の Safari で確かめる

- `safaridriver` と `bun tests/verify-safari.ts` を使う。初回は Apple 公式の `safaridriver --enable`（環境によっては、管理者の認可が要る）
- 画面のロック中の pointer の入力や画面の更新の制限を、「CLI ごと使えない」と広げて考えない。見えていない間は、保存と字幕のボタンの DOM の click と、動画から取り出した単色でないフレームを確かめる
- `--disconnect-wifi=<interface>` を付けたときだけ、本当に Wi-Fi を切る。先に、別のプロセスで戻す手を用意する。Safari の `navigator.onLine` だけで通信断と決めない
- Mac の解除のあとは、document が visible であることを確かめ、ふつうの WebDriver の element click での保存と字幕の切り替え、再生の時刻と実際のフレームの進みを別に確かめる。見えない間の DOM の click の結果から、ふつうの操作の成功を推し量らない
- 個人のふだんのウィンドウや Cookie を使わない。一時の自動試験のセッションは、終えたら閉じる
- iPhone は、Mac とは別に使えるかを確かめる。つながらないミラーリングの画面やシミュレータを、実機の Safari の結果にしない
- 頼んだ人が実機の確かめを対象から外したときは、課題の受け入れの条件と記録を、その範囲に合わせる。やっていないことを成功に置き換えず、実ブラウザや通信断で何を確かめたかを具体的に書く。外した端末の接続や操作を続けない
