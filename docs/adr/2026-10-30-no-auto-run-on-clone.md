# clone した人の手元で勝手に動くものを置かない

- 状態: 採用
- 決めた日: 2026-10-30
- 関連: commit `936f7af`（公開と OSS に向けて、安全の仕組みと文書をそろえた）

## 背景

- 公開リポジトリで、外の人の PR も受ける。講座とコードは AI（Claude Code など）と一緒に作り、AI がリポジトリを開いて作業する
- 道具によっては、リポジトリの中の設定を読み、install したり、そのリポジトリで作業を始めたりしただけでコマンドを動かす
  - npm のインストール時スクリプト（`preinstall`・`install`・`postinstall`・`prepare` など）
  - Claude Code のリポジトリの設定（`.claude/settings.json`）と hooks
  - git hooks（`prepare` などから自動で入れるもの）
- そこに悪いコマンドが入ると、clone した人や AI の手元で、本人が頼んでいないのに動く

## 決めたこと

- clone した人が自分で起動しないのに動くもの（コマンド・スクリプト・hooks）を、リポジトリに置かない
  - `package.json` に、インストール時スクリプトを置かない
  - `.claude/settings*.json` と `.claude/hooks/` を Git に入れない。`.claude/` で入れるのは、スキルと `launch.json` だけ
  - git hooks を自動で入れない
- 依存は `npm ci --ignore-scripts` で入れ、依存のインストール時スクリプトも動かさない
- 点検は、人が流すコマンドと CI で行う

## 理由

- 公開リポジトリでは、PR から入った 1 行で、clone した全員の手元のコマンドを動かせてしまう。置かなければ、その道をふさげる
- AI エージェントは、リポジトリの設定をそのまま読む。設定と hooks を入れないことで、外の文章に紛れた指示が、手元のコマンドにつながる道を減らす
- 点検は、hooks に頼らなくても、`scripts/check_content.ts` と CI で同じことができる

## ほかの案

| 案 | 選ばなかった理由 |
|---|---|
| git hooks（husky など）で、commit の前に点検を流す | 入れるのに、インストール時スクリプトが要る。clone した人の手元で動く |
| Claude Code の hooks で、編集のたびに整形や点検を流す | リポジトリに hooks を入れることになる |
| `--ignore-scripts` を付けずに入れる | 依存のインストール時スクリプトが動く |

## 影響

- `scripts/check_content.ts` は、`.claude/settings*.json`・`.claude/hooks/` と、`package.json` のインストール時スクリプトを見つけると止める。CI でも流す
- CI は `npm ci --ignore-scripts` で入れる（`.github/workflows/`）
- 同じ考えで、開いたり道具を使ったりしただけで動きうる設定（`bunfig.toml` の preload・`.npmrc`・`.mcp.json`・`.vscode/tasks.json`・`.devcontainer/`・`.envrc`・`.husky/`）も置かない。点検に足す予定（T1-10）
- `.claude/launch.json` は入れてよい。手元のプレビューを、人が起動したときだけ動く。中の起動コマンドを点検に足す予定（T1-10）
- 決まりの正本は [CLAUDE.md](../../CLAUDE.md) の「安全のきまり」と、スキルの [safety.md](../../.claude/skills/study-video-course/references/safety.md) の「clone した人の手元で勝手に動くものを置かない」
