# CLAUDE.md

@AGENTS.md

## Claude Code で使うこと

上の `AGENTS.md`（AI 共通のきまりの正本）に加えて、Claude Code だけのこと。

- 講座を作る・直すときは、スキル `study-video-course` を使う（`/study-video-course` と打つか、頼まれた内容から選ぶ）。共通プロンプトから講座を丸ごと作るときは、スキル `course-from-prompt`。講座サイト・保存（PWA）・Worker を直すときは、スキル `chalkfile-engine`
- スキルは `.claude/skills/<名前>/SKILL.md` にある。`.claude/` に足してよいのは、スキルと `launch.json` だけ（設定・hooks は足さない）
- プレビュー（`.claude/launch.json`）は `site`（講座サイト）・`studio`（Remotion Studio）・`worker`（手元の Worker。`npm run dev:worker` が先に Worker の許可リストを作る）。どれも `npm run` で起こす。番号は [commands.md](docs/guide/commands.md) の「ポート」
