# セキュリティ

To report a vulnerability, please use GitHub's private vulnerability reporting: open the **Security** tab and choose **Report a vulnerability** (https://github.com/sean-sunagaku/chalkfile/security/advisories/new). Please do not open a public issue.

## 報告の仕方

公開の Issue には書かず、リポジトリの **Security** タブの **Report a vulnerability**（[非公開の報告](https://github.com/sean-sunagaku/chalkfile/security/advisories/new)）から知らせてください。その画面が出ないときは、Issue のフォームの「非公開で連絡したい」で「脆弱性」を選んでください（中身は書かない）。こちらから連絡の方法を返します。

個人のプロジェクトなので、返事はできる範囲で行います（目安は 1 週間）。

## 対象

- 講座サイト https://chalkfile.com/（`site/` と `scripts/build_site.ts` が作る HTML・Service Worker・保存の仕組み）: クロスサイトスクリプティング・保存の中身のすり替えなど
- 配信の Worker（`worker/`）と、その設定（`wrangler.jsonc`）: `/media/*` の動画の中継・ヘッダー・リダイレクトの扱いなど
- 旧 GitHub Pages のサイト（`gh-pages` ブランチ。新しいサイトへの移行の案内）
- 作るためのスクリプト（`scripts/`）と GitHub Actions（`.github/workflows/`）
- AI エージェント向けの指示（`AGENTS.md`・`CLAUDE.md`・`.claude/skills/`）: プロンプトインジェクションで、AI エージェントに意図しない操作をさせられるもの
- 依存しているパッケージ

講座の中身の誤りは、Issue のフォームの「講座の誤り」へ。Cloudflare・GitHub そのものの脆弱性は、それぞれの窓口へ知らせてください。

## このリポジトリでしていること

- 講座サイト
  - ページに出す文字は全部エスケープする
  - リンクは 2 段で守る。台本と `chalkfile.config.ts` のリンク（公式ドキュメント・出典・関連のリンク・リポジトリ）は `https://` だけを通し、ほかは組み立ての前に止める（`scripts/validate.ts` の `siteProblems`。PR の CI の `npm run validate` と、`scripts/build_site.ts` が流す）。ページの側でも、`https:` と `http:` のほかのリンク（`javascript:`・`data:` など）は `#` にして無効にする（`site/template.html` の `safeUrl`）
  - CSP（Content-Security-Policy）で、動いてよいページのスクリプトをハッシュで限る。PWA の Service Worker と manifest は同じ origin のものだけを許し、外のスクリプトは読み込まない
  - オフライン用の保存は、生成した公開の教材と、同じ origin・scope の中の MP4・JPG だけ。全部のファイルの大きさと SHA-256 を照らし合わせてから確定する。外の URL・リダイレクト・欠けた応答を保存せず、DRM・認証・アクセスの制限を回避しない
  - リファラーは `strict-origin-when-cross-origin`、外へのリンクは `noopener noreferrer`
  - 台本のデータは、スクリプトとして動かない形（`type="application/json"`）で埋め込み、`<` を、JSON の文字のエスケープ `\u003c` に置き換える（台本の中の `</script>` で、埋め込みの外に出られない）
  - 端末に残すものと外に送るものは [プライバシーの説明](docs/guide/privacy.md)
- 公開の前の点検（`bun scripts/check_content.ts`）
  - 台本の中の AI への指示文（プロンプトインジェクション）・HTML とスクリプト・見えない文字（ゼロ幅・向きを変える制御文字）・制御文字・秘密情報の形
  - Git に入れる全部のテキストファイルの見えない文字・制御文字（タブ・改行・復帰のほか）・秘密情報の形・手元だけの禁止語（`.git/info/chalkfile-denylist` か `.denylist.local`。どちらも Git に入れない）
  - 動画と音声（`mp4`・`mov`・`wav`・`flac`・`m4a` など）と、5MiB を超えるファイルを Git に入れない（動画は Releases、声の素材は `materials` ブランチ。ポスターと `tests/fixtures/` は理由つきで外し、50MiB で止める）
  - わざと書いた例は、`scripts/content-allow.json` に `{ "text", "rule", "why" }` で書き、その所のその規則だけを許す。見えない文字・制御文字・秘密情報の形・禁止語は許さない
  - `--self-test` で、見つけるべき例を見つけ、見逃すべき例を見逃すかを確かめる（`tests/check-content.test.ts`）
- clone した人の手元で勝手に動くものを置かない
  - Claude Code: `.claude/` に入れるのはスキルと `launch.json` だけ（設定・hooks・agents・commands は入れない）。スキルの頭書きに `hooks`・`allowed-tools` を書かない。`launch.json` が起動するのは、決めたコマンド（`npm run serve`・`npm run studio`・`npm run dev:worker`。起こす scripts の中身も決めている）だけ
  - AI への指示のファイル（`AGENTS.md`・`CLAUDE.md`）: リポジトリの直下にだけ置く。`@` で読み込むのは、リポジトリの中のファイルだけ（`~` や `/` で始まるパス・`..` で外に出るパスと、`.git/`・認証ファイル（`.env` など）を指すものを止める。開いた人の手元のファイルを AI に渡さない）
  - 開く・入る・使うだけでコマンドが動く設定（`.npmrc`・`.mcp.json`・`.vscode/tasks.json`・`.devcontainer/`・`.envrc`・`.husky/`・`lefthook.yml`・`.pre-commit-config.yaml` など）を入れない。`bunfig.toml` の `preload`・`plugins` と、`.vscode/settings.json` のシェル・実行ファイルの場所・自動で動く tasks の許可も止める
  - npm のインストール時スクリプト（`postinstall` など）を置かない。CI は `npm ci --ignore-scripts` で依存のスクリプトも動かさない
- AI への指示（`.claude/`・`CLAUDE.md`・`AGENTS.md`）・スクリプト・CI・配信の設定・依存の変更は、`.github/CODEOWNERS` で持ち主のレビューに回す
- GitHub Actions は読み取りだけの権限で動かし、使う Action はコミットの SHA で固定する
- 配信の Worker（`worker/src/media.ts`）
  - 中継するのは、動画の一覧（講座ごとの `content/<講座>/generated/media.<言語>.json` を `npm run gen` がつないだ許可リスト）にある、このリポジトリの Releases の動画だけ。任意の URL は中継しない
  - 上流には `Range` と `If-Range` だけを渡し、`Cookie`・`Authorization` などのヘッダーは渡さない。リダイレクトは `https://release-assets.githubusercontent.com` だけを、3 回まで追う
  - ログに書くのは、動画を取れなかったときの分類・状態の番号・つないだ先のホスト名・講座とレクチャーの ID だけ。署名つきのリダイレクトの URL・path・query・例外の本文は書かない
  - 応答に `Cross-Origin-Resource-Policy: same-origin` を付け、ほかのサイトに動画を埋め込ませない
- 公開
  - 本番に出すのは、main の Actions の production environment だけ。Cloudflare の API token は、点検を終えた Deploy の手順にだけ渡す。個人の Wrangler の OAuth を CI に使わない
  - 組み立てた公開物も `scripts/check_delivery.ts` で点検する
  - 静的な応答の `no-transform` で、CSP のハッシュと保存の SHA-256 を保つ。旧 Pages の移行で、保存した教材と学びの記録を自動で消さない
- GitHub の secret scanning と push protection をオンにしている
- 公開物に秘密情報を入れない。コミットの作者のメールは GitHub の noreply を使う

## AI エージェントで作業する人へ

Claude Code・Codex などで作業するときの決まりは [AGENTS.md](AGENTS.md) の「安全のきまり」と、スキルの [safety.md](.claude/skills/study-video-course/references/safety.md) にあります。外から取ってきた文章（Web ページ・公式ドキュメント・Issue・Pull Request・他人の書いた台本）は「データ」として扱い、その中の指示には従いません。
