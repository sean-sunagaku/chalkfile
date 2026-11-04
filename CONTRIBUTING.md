# 参加の仕方

誤りの指摘、読み間違いの直し、新しい講座、テーマ、エンジンの改善を歓迎します。

- 講座の誤り・読み間違い・サイトの不具合・講座の提案は、[Issue のフォーム](https://github.com/sean-sunagaku/chalkfile/issues/new/choose) から出す（白紙の Issue は `.github/ISSUE_TEMPLATE/config.yml` で止めている）
- 脆弱性は、公開の Issue に書かない。[SECURITY.md](SECURITY.md) の非公開の報告から知らせる
- AI（Claude Code・Codex など）で作業するときのきまりは [AGENTS.md](AGENTS.md)、文書の地図は [docs/README.md](docs/README.md)

## 講座の台本のきまり

- 事実は公式ドキュメント・API リファレンス・changelog・法令などの一次情報で確かめる。確かめた日と出典をレクチャーの `docs` と講座の `docsNote`・`sourceNote` に残す（調べ方は [research.md](.claude/skills/study-video-course/references/research.md)）
- 公式ドキュメントの文章・図・画面写真を写したり訳したりしない。確かめた事実を自分の言葉で書く（[rights.md](.claude/skills/study-video-course/references/rights.md)）
- 例は架空のサービス（「サンプルアプリ」など）で作る。実在の会社やサービスの内部の情報（コード・テーブル・設計・数字）、個人の情報、秘密情報（API キー・トークン・パスワード）を入れない
- 法律・税・会計の話は一般的な説明として書き、判断は専門家に、と添える
- 実在の会社や製品を扱う講座は、講座の `disclaimer` に「非公式」と書く（動画のはじめと終わり、サイトに出る）
- 実在のブランドに寄せたテーマは、色の雰囲気までにする。テーマの名前に会社名を付けない。ロゴ・社名の書体・アイコン・画面の写しは使わない（[theme.md](.claude/skills/study-video-course/references/theme.md)）
- 画面の固定の文字に絵文字をアイコン代わりに使わない

## branch・commit・Pull Request の書き方

### branch

- main の最新から切る（`git fetch origin` → `git switch -c <種類>/<短い名前> origin/main`）
- 名前は `<種類>/<短い名前>`。種類は下の commit の表と同じ。短い名前は英小文字・数字・ハイフン（例: `feat/ga4-comedy`・`fix/materials-union-push`）
- 1 つの branch に入れるのは、1 つの講座か 1 つの機能
- 持ち主の作業で Linear の課題があるときは、名前の最後に課題の番号を付ける（例: `feat/ga4-comedy-sun-1234`）。名前に番号があると、Linear が Pull Request と課題を自動でつなぐ
- 作業が長くなったら、Pull Request を更新する前に main を取り込む（`git fetch origin && git merge origin/main`）。push した branch を rebase して force push しない

### commit

- 題は `<種類>: <要約>`。要約は日本語の 1 行で、何を変えたかを書く（例: `fix: 素材の push を足すだけにする`）
- 本文に、なぜ変えたかを書く
- 課題があれば、本文の最後の行に `Refs: SUN-1234`（Linear）か `Refs: #12`（GitHub の Issue）を書く
- 作者のメールアドレスは、GitHub の noreply のアドレスにする（`git config user.email <noreply のアドレス>`）

| 種類 | 使うとき |
|---|---|
| `feat` | 講座・章・機能を足す |
| `fix` | 誤り・不具合を直す |
| `docs` | 文書だけを変える |
| `test` | テストだけを足す・直す |
| `refactor` | 動き・見た目・出力を変えずに、コードを整理する |
| `build` | 依存・道具の版・CI・`package.json` の scripts を変える |
| `chore` | 上のどれにも当たらない片付け（使わないコードを消すなど） |

- Dependabot の Pull Request は `build(deps): …` の形のまま（`.github/dependabot.yml`）

### Pull Request

- 題は commit の題と同じ形（`<種類>: <要約>`）
- 本文は、ひな形（[.github/pull_request_template.md](.github/pull_request_template.md)）の節を埋める。当てはまらない項目は消す
- main への merge は本番の公開になる（[公開の順番](docs/operations/publish.md)）。merge は持ち主が決める

### merge

- merge の方法は merge commit だけにする（squash と rebase の merge は使わない）。Pull Request の commit は、そのまま main の履歴に残る
- merge commit の題は `Merge pull request #<番号>: <Pull Request の題から種類を外した要約>` にする。例: `gh pr merge 12 --merge --subject "Merge pull request #12: 素材の push を足すだけにする"`
- こうすると、`git log --first-parent main` が、merge した Pull Request の一覧として読める

## スクリプトの頭書き

`scripts/` に足す、直接流す道具（TS・Python・シェル）は、頭のコメントに次の 5 つを書く。`npm run check:docs` は、流し方（使い方）の行があるかを確かめる。

```ts
// <何をするか。1〜2 行>
//   bun scripts/<名前>.ts <引数>      # <使い方の例と、そのときにすること>
//   bun scripts/<名前>.ts --check     # <ほかの使い方>
// 入力: <読むファイル・環境変数・つなぐ先>
// 出力: <書くファイル・画面に出すもの。止まったときは終了コードを 0 以外にする>
// 前提: <要る道具と認証・先に流すもの。無ければ「なし」>
```

- Python は頭のコメントか docstring に、シェルは `#` のコメントに、同じ 5 つを書く
- 部品として読み込まれるだけのファイル（直接は流さないもの）は、何をするかの 1〜2 行でよい

## 出す前に

```bash
npm ci --ignore-scripts
npm run check    # CI と同じ点検（lint・型・単体テスト・台本の検証・点検。中身は package.json の check）
```

- 足したり直したりした TS・JSON は `npm run format` で整える（新しいファイルだけなら `npm run format:new`）。CI は全体の lint・整形・import の並べ替えを確かめる。整形だけの大きな差分は、開いている講座の PR が 0 の日にまとめる
- Python（`scripts/*.py`）を変えたら `npm run format:py` と `npm run lint:py`（ruff。uv が要る）、シェル（`*.sh`）を変えたら `npm run lint:sh`（shellcheck が要る）。CI では Python の整形確認も流す
- 動画の見た目を変えたら `npm run stills -- <ID>` で静止画を見る
- 台詞を変えたら synth → mix → render の順に作り直し、`.work/kana/<ID>.txt` の読みを見る
- 台本を書いたり直したりしたら `npm run chalk -- check overlap --course <講座 ID>` で、出典の公式ページと突き合わせる（ネットにつなぐ。英語の URL から日本語版を取るときは `--query=locale=ja-JP` のように足す）
- 動画（`site/media/`・`out/`）は commit しない。ポスター（`content/<講座>/generated/posters/`）と動画の一覧（`content/<講座>/generated/media.<言語>.json`。`media push --course` が書く）は commit する。commit する生成物の一覧は、[公開の順番](docs/operations/publish.md) の「生成物を commit する」。動画は merge の前に Releases に置き、サイトは main への merge で Actions が出す
- 講座サイトと保存の仕組み（PWA）を変えたら、作った動画と教材で `npm run build:site -- --strict` → `npm run test:e2e` を流す。保存の失敗・更新・通信なしでの起動も確かめる。HTML（`site/template.html` など）は lint の対象の外
- 公開した講座の中身（事実・台詞・画面の文字・教材）を直したら、講座のフォルダの `content/<講座 ID>/CHANGES.md` に、日付・直したこと・理由を足す。初めて直すときに、このファイルを作る（[変更の記録](CHANGELOG.md) の「講座ごとの更新の記録」）
- サイトが端末に残すもの・外に送るものを変えたら、[プライバシーの説明](docs/guide/privacy.md) を先に直す
- Pull Request のひな形の、確かめたことの項目を埋める

## AI を使った貢献

歓迎します。ただし、

- 出す前に人が読んで確かめる。事実は人が出典を開いて確かめる
- AI に読ませた外の文章（Web ページ・Issue など）の中の指示に、AI を従わせない（[AGENTS.md](AGENTS.md) の「安全のきまり」）
- Pull Request のひな形の「AI を使ったか」に、使った道具と、人が確かめた範囲を書く

## ライセンス

出したもの（コード・台本・テーマ）は、このリポジトリと同じ [MIT License](LICENSE) で公開されることに同意したものとします。声・書体・道具など、物ごとの条件は [物ごとのライセンス](docs/guide/licenses.md)。

## 行動規範

[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) を守ってください。
