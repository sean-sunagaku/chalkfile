# Service Worker の更新のお知らせ（2026-11-03）

これは記録。書いた日のことで、今の手順ではない。今の仕組みは、保存が [保存の設計](../architecture/offline.md)、配り方が [配信の設計](../architecture/delivery.md)、学ぶ人への説明が [学ぶ人向けの説明](../guide/learner-offline.md)。

講座サイトの Service Worker（`sw.js`）と、静的な応答のヘッダー（`_headers`）を変える回のお知らせ。講座のページと保存用の教材情報は変えないので、講座の版（pageVersion）は全講座で前と同じ。

## 変わるもの

| もの | 変わること |
|---|---|
| 更新して保存 | 前の保存版と同じ動画（名前に入った SHA-256 と大きさが同じもの）は、取り直さずに写す。写すものも中身の SHA-256 を確かめる。教材のページだけが変わった更新なら、取るのはページとポスターだけ（前は講座の全部の動画を取り直していた。たとえば stripe-billing は動画 13 本・162,417,300 B） |
| 再生 | 保存版がそろっているかの結果を覚え、動画の Range の要求のたびに、全部のファイルを確かめ直さない |
| 重大な不具合の直し | 無効にした保存版の一覧（`site/disabled-revisions.ts`。この回は空）を sw.js が持つ。当たる保存版は、オンラインで開くと公開中のページになり、更新を案内する。保存は消さない |
| 起動用ファイル | 一覧のページの画像を名前の順に並べ、型を拡張子の対応表から付ける。手元の macOS と CI の Linux で、同じ sw.js になる |
| sw.js の大きさ | 縮めて、組み立ての設定を 1 回だけ入れる。50,500 B から 22,984 B |
| 静的な応答のヘッダー | `frame-ancestors 'none'`・`X-Frame-Options: DENY`・`Permissions-Policy`・`Cross-Origin-Opener-Policy: same-origin` を足す。`/sw.js` の `Cache-Control` は、2 つの規則の値がつながっていたのを直し、`no-cache, no-transform` だけにする |
| アイコンの PNG | bun 1.4.4 の zlib で圧縮のバイト列が変わる（画素は同じ。523・601・3,661 B から 896・972・5,131 B） |

## 学ぶ人に起きること

- Service Worker を入れた人に、「アプリの更新があります」が 1 回出る。サイトのタブを全部閉じて開き直すと、新しい Service Worker になる
- 新しい Service Worker は、起動用ファイル（一覧のページ・画像・講座のサムネイル・アイコン・オフラインの案内など 21 ファイル・735,212 B）を取り直す
- 保存した講座は、そのまま使える。講座の版が変わらないので「新しい版」は出ず、保存した動画も取り直さない
- 次に講座の版が変わって更新して保存するときから、変わっていない動画を取り直さない

## 組み立ての前と後

本物の講座を CI と同じ順（素材の取り出し → `synth --cached-only` → `media.ts check` → `gen.ts --media` → `build_site --strict`）で組み、`site/dist` の全 83 ファイルの SHA-256 を比べた。

- 前（この回の前の main を bun 1.3.6 で組んだもの。ページ・`offline-manifest.json`・アイコンは、本番の chalkfile.com と同じバイト列）と比べて変わったのは、`sw.js`・`_headers`・アイコンの PNG 3 枚だけ。全部の講座のページ・`offline-manifest.json`・一覧のページ・ポスター・画像は同じ
- 全 9 講座の pageVersion と revision が、前と同じ
- ブラウザのテストで、教材のページだけの更新の保存が取る動画を数えた
  - 合成の講座（`npm run test:e2e:ci`）: 前の Service Worker では 2 本・339,701 B（全部）、新しい Service Worker では 0 本・0 B
  - 本物の講座の stripe-billing（`npm run test:e2e:real`）: 前は 13 本・162,417,300 B（全部）、新しくは 0 本・0 B。写す元の 1 本の中身を壊すと、その 1 本（11,128,834 B）だけを取り直す
