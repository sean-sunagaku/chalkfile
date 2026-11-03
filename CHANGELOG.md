# 変更の記録

Chalkfile のエンジン（動画・講座サイト・配信の Worker・作る道具）の、使う人と講座を作る人に効く変更の記録。書き方は [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) にならう。

- 新しい節を上に足す。節の名前は、main に入れた日（main への merge が本番の公開になるので、公開した日と同じ）
- 変更の種類は、Keep a Changelog の 6 つを日本語で書く: 足した（Added）・変えた（Changed）・やめる予定（Deprecated）・消した（Removed）・直した（Fixed）・安全（Security）
- Pull Request ごとには書かない（並行の Pull Request が、このファイルでぶつからないように）。1 本ずつの変更は、main の merge commit の題にある（`git log --first-parent main`）。ここには、まとめて知らせたい変更を、まとめて出すとき（サイトの版や動画が変わるとき）か区切りのよいときに、持ち主か頼まれた AI が書く
- 講座の中身の更新は、ここに書かない（下の「講座ごとの更新の記録」）

## 版の扱い

- 版の番号は付けない。npm に出さないパッケージ（`package.json` の `private: true`）で、main への merge がそのまま公開になるので、変更は日付で追う
- `package.json` の `version` は、作ったときの `1.0.0` のままにし、上げない（決めて付けた番号ではない）
- エンジンを npm に出すと決めたら、そのときに `0.1.0` から [Semantic Versioning](https://semver.org/lang/ja/) で版を付け、この記録に版の節を作る。`1.0.0` は、台本の形・コマンド・設定を約束できるようになってから付ける
- 講座サイトの版（保存した人に「新しい版」と出るもの）は、組み立てた出力から決まる（`scripts/site-version.ts`）。この記録の版とは別
- GitHub の Releases の `media-<言語>-<講座 ID>` は、動画の置き場所。ソフトの版ではない（[配信の設計](docs/architecture/delivery.md)）

## 講座ごとの更新の記録

- 公開した講座の中身（事実・台詞・画面の文字・教材・動画）を直したら、講座のフォルダの `content/<講座 ID>/CHANGES.md` に、日付・直したこと・理由（公式ドキュメントの変更など）を、新しいものを上にして書く。初めて直すときに、このファイルを作る
- 講座を直す Pull Request が、その講座のフォルダの中だけで済むように、講座の記録はここに集めない
- 初めて公開したときの記録は書かない。確かめた日は、講座の `docsNote` と `sourceNote` にある

## 2026-11-03

### 足した

- 台本の検証 `npm run validate`。Pull Request の CI で、公開で止まること（ポスター・動画の一覧・リンク・ID）を先に見つける（[#34]・[#46]）
- 壊さないための網: 保存データの互換テスト、声の鍵・読み・訳の指紋のスナップショット、エンジンの単体テストと全場面の見本の静止画の比較（[#27]・[#29]・[#34]・[#47]）
- 品質の道具: Biome の lint、Python の ruff、シェルの shellcheck、使っていないコードの knip、文書の点検 `npm run check:docs`、Dependabot の npm と uv（[#37]）
- Worker の観測（構造化したログと Workers Logs）、入口のテストと smoke、`/media/*` の `Cross-Origin-Resource-Policy`、`retained` の期限（[#35]）
- BGM と効果音が素材と同じ音かを確かめる `music:verify`（[#52]）
- 文書: AI 共通のきまりの正本 `AGENTS.md`、文書の地図、全体図と用語集、決定の記録（ADR）、docs/guide と docs/operations（[#28]・[#45]）

### 変えた

- 講座の生成物（timeline・ポスター・動画の一覧）を、講座のフォルダの `generated/` に移した。講座の登録は 1 講座 1 行（`content/courses.ts`）にし、README の講座の表と頭文字の表は `npm run gen` が作る（[#53]）
- 講座サイトの版を、組み立てた出力から決める。出力の変わらない直しでは、保存した人に「新しい版」が出ない（[#26]）
- 素材の push を足すだけにし、消すのは `materials.ts gc --confirm` だけにした（[#32]）
- 道具の版を固定し、型の検査を scripts と tests に広げて厳しくし、`package.json` の scripts をコマンドの入口にした（[#31]・[#44]）
- テーマを純粋な関数とパレットにし、場面を登録表にした。動画の見た目は変えない（[#43]・[#49]）
- `build_music.py` を役割ごとのモジュールに分けた。音は変えない（[#52]）
- Remotion を 4.0.539、React を 19.3.1 にした（[#38]・[#48]）

### 直した

- Service Worker が、オンラインの 404 を 503（保存されていない）にしていた（[#29]）
- `render.sh` が書き出しの失敗を見逃していた。禁止語の一覧を、全部の worktree で読むようにした（[#30]）
- `check_content` の穴をふさいだ（許可を規則ごとに・制御文字・手元で動くファイル・動画と大きさ）（[#36]）

## 2026-11-02

### 足した

- 英語と中国語の版（声は Kokoro。画面の文字・図の文字・字幕・講座サイト）。公開する言語は `site/config.json` の `publishLangs` で選ぶ（[#12]）

### 変えた

- 配信を GitHub Pages から Cloudflare Workers と GitHub Releases に移した。サイトは静的な assets、動画は Releases に置き、Worker が `/media/*` を Range のまま中継する（[#13]・[#14]・[#15]・[#16]）
- 公開を、main への merge で動く Actions にした。旧 Pages には、新しいサイトへの移行の案内を置く（[#18]・[#21]・[#33]）

### 安全

- Worker は、SHA-256 つきの動画の一覧にある動画だけを中継し、上流に Cookie などのヘッダーを渡さない（[#15]）

## 2026-11-01

### 足した

- 掛け合いの演出（ボケ・ツッコミ・天の声・効果音）と、字幕を焼き込んだ版。全画面でも字幕が出る（[#5]・[#7]）

## 2026-10-31

### 足した

- 講座を端末に保存して、通信なしで学べる仕組み（PWA）（[#2]・[#3]）
- 素材の `materials` ブランチ。VOICEVOX なしで、動画とサイトを作り直せる（[#1]）

## 2026-10-30

### 足した

- 講座ごとのテーマ、公開の前の点検（`scripts/check_content.ts`）、公式ドキュメントとの突き合わせ（`scripts/check_overlap.ts`）

### 変えた

- 名前を Chalkfile にした

## 2026-10-29

### 足した

- 台本から、ナレーション付きの講座動画と講座サイトを作る仕組み（はじめの形）

[#1]: https://github.com/sean-sunagaku/chalkfile/pull/1
[#2]: https://github.com/sean-sunagaku/chalkfile/pull/2
[#3]: https://github.com/sean-sunagaku/chalkfile/pull/3
[#5]: https://github.com/sean-sunagaku/chalkfile/pull/5
[#7]: https://github.com/sean-sunagaku/chalkfile/pull/7
[#12]: https://github.com/sean-sunagaku/chalkfile/pull/12
[#13]: https://github.com/sean-sunagaku/chalkfile/pull/13
[#14]: https://github.com/sean-sunagaku/chalkfile/pull/14
[#15]: https://github.com/sean-sunagaku/chalkfile/pull/15
[#16]: https://github.com/sean-sunagaku/chalkfile/pull/16
[#18]: https://github.com/sean-sunagaku/chalkfile/pull/18
[#21]: https://github.com/sean-sunagaku/chalkfile/pull/21
[#26]: https://github.com/sean-sunagaku/chalkfile/pull/26
[#27]: https://github.com/sean-sunagaku/chalkfile/pull/27
[#28]: https://github.com/sean-sunagaku/chalkfile/pull/28
[#29]: https://github.com/sean-sunagaku/chalkfile/pull/29
[#30]: https://github.com/sean-sunagaku/chalkfile/pull/30
[#31]: https://github.com/sean-sunagaku/chalkfile/pull/31
[#32]: https://github.com/sean-sunagaku/chalkfile/pull/32
[#33]: https://github.com/sean-sunagaku/chalkfile/pull/33
[#34]: https://github.com/sean-sunagaku/chalkfile/pull/34
[#35]: https://github.com/sean-sunagaku/chalkfile/pull/35
[#36]: https://github.com/sean-sunagaku/chalkfile/pull/36
[#37]: https://github.com/sean-sunagaku/chalkfile/pull/37
[#38]: https://github.com/sean-sunagaku/chalkfile/pull/38
[#43]: https://github.com/sean-sunagaku/chalkfile/pull/43
[#44]: https://github.com/sean-sunagaku/chalkfile/pull/44
[#45]: https://github.com/sean-sunagaku/chalkfile/pull/45
[#46]: https://github.com/sean-sunagaku/chalkfile/pull/46
[#47]: https://github.com/sean-sunagaku/chalkfile/pull/47
[#48]: https://github.com/sean-sunagaku/chalkfile/pull/48
[#49]: https://github.com/sean-sunagaku/chalkfile/pull/49
[#52]: https://github.com/sean-sunagaku/chalkfile/pull/52
[#53]: https://github.com/sean-sunagaku/chalkfile/pull/53
