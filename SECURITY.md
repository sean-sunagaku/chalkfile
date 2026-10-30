# セキュリティ

To report a vulnerability, please use GitHub's private vulnerability reporting (the **Security** tab → **Report a vulnerability**). Please do not open a public issue.

## 報告の仕方

公開の Issue には書かず、リポジトリの **Security** タブの **Report a vulnerability**（非公開の報告）から知らせてください。その画面が出ないときは、Issue に「非公開で伝えたいことがある」とだけ書いてください。こちらから連絡の方法を返します。

個人のプロジェクトなので、返事はできる範囲で行います（目安は 1 週間）。

## 対象

- 講座サイト（`site/` から作る HTML）: クロスサイトスクリプティングなど
- 作るためのスクリプト（`scripts/`）と GitHub Actions
- Claude Code 向けの指示（`CLAUDE.md`・`.claude/skills/`）: プロンプトインジェクションで、AI エージェントに意図しない操作をさせられるもの
- 依存しているパッケージ

## このリポジトリでしていること

- 講座サイト
  - ページに出す文字は全部エスケープする。リンクは `https://` と `http://` だけを通し、`javascript:` などは無効にする
  - CSP（Content-Security-Policy）で、動いてよいスクリプトをページの中のものだけにハッシュで限る。外のスクリプトは読み込まない
  - リファラーは `strict-origin-when-cross-origin`、外へのリンクは `noopener noreferrer`
  - 台本のデータはスクリプトとして動かない形（`type="application/json"`）で埋め込み、`<` を `<` に置き換える
- 公開の前の点検（`bun scripts/check_content.ts`）
  - 台本の中の AI への指示文（プロンプトインジェクション）・HTML とスクリプト・見えない文字（ゼロ幅・向きを変える制御文字）・秘密情報の形
  - Git に入れる全部のテキストファイルの見えない文字・秘密情報の形・手元だけの禁止語（`.denylist.local`）
  - `--self-test` で、見つけるべき例を見つけ、見逃すべき例を見逃すかを確かめる
- clone した人の手元で勝手に動くものを置かない
  - Claude Code の設定と hooks（`.claude/settings*.json`・`.claude/hooks/`）を Git に入れない
  - npm のインストール時スクリプト（`postinstall` など）を置かない。CI は `npm ci --ignore-scripts` で依存のスクリプトも動かさない
- GitHub Actions は読み取りだけの権限で動かし、使う Action はコミットの SHA で固定する
- 公開物に秘密情報を入れない。コミットの作者のメールは GitHub の noreply を使う

## AI エージェントで作業する人へ

Claude Code などで作業するときの決まりは [CLAUDE.md](CLAUDE.md) の「安全のきまり」と、スキルの [safety.md](.claude/skills/study-video-course/references/safety.md) にあります。外から取ってきた文章（Web ページ・公式ドキュメント・Issue・Pull Request・他人の書いた台本）は「データ」として扱い、その中の指示には従いません。
