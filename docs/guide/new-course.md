# 講座を足す（チェックリスト）

新しい講座を足して、公開の PR を出すまでのチェックリスト。中身の作り方（調べ方・台本・声・画面・お笑い）の正本は、スキル [study-video-course](../../.claude/skills/study-video-course/SKILL.md)。共通プロンプトから章立ての講座を丸ごと作るときは、スキル [course-from-prompt](../../.claude/skills/course-from-prompt/SKILL.md)。

- 手元の用意は [quickstart.md](quickstart.md) の A、コマンドは [commands.md](commands.md)、公開の順番は [公開の順番](../operations/publish.md)

## 1. 決める

- [ ] 講座 ID。サイトの URL（`/<講座 ID>/`）・保存の ID・Releases のタグになるので、公開したら変えない。今の講座と同じく、英小文字とハイフンで書く。2 文字の英小文字は使えない（言語の名前と重なる）
- [ ] レクチャー ID の頭文字。下の表で使っていない英大文字を 1 つ選ぶ。ID は頭文字と 2 桁の番号（`G01`）
- [ ] 講座の型: レクチャーの講座・章立て（読む教材つき）・お笑い版の章立て・1 本だけの解説動画。型ごとの長さと本数は [course-design.md](../../.claude/skills/study-video-course/references/course-design.md) の「講座の型と大きさ」の表
- [ ] お笑いを必ず入れる。型と守ることは [comedy.md](../../.claude/skills/study-video-course/references/comedy.md)、理由は [ADR](../adr/2026-11-01-comedy-in-every-course.md)。お笑い版は表示を少なくする（副題・前置きを出さない。1 本だけの動画は、番号と根拠の札も出さない）
- [ ] テーマ（下の「テーマ」）

### 頭文字と並びの表

この表は `npm run gen` が、各講座の `course.ts` の `prefix`（頭文字）と `order`（一覧の並び）から作る。手で直さない。講座を足したら `npm run gen` を流す。頭文字や並びが重なると `npm run validate` が止め、空いている文字を出す。

<!-- prefixes:start -->
<!-- npm run gen が、各講座の course.ts の prefix と order から作る。手で直さない -->

| 頭文字 | 講座 ID | 並び（order） |
|---|---|---|
| `L` | `stripe-billing` | 10 |
| `N` | `nudge-product` | 20 |
| `D` | `uiux-engineers` | 30 |
| `M` | `indie-marketing` | 40 |
| `W` | `nudge-comedy` | 50 |
| `R` | `rive-comedy` | 60 |
| `P` | `pstack-comedy` | 70 |
| `S` | `superagent-comedy` | 80 |
| `G` | `ga4-comedy` | 90 |

- 空いている文字: A B C E F H I J K O Q T U V Y Z（X はテストの見本が使う）

<!-- prefixes:end -->

- 同じレクチャー ID は、講座をまたいで使えない（`content/index.ts` を読み込むときに止まる）。ID は頭文字と 2 桁の番号（`npm run validate` が形を見る）

### テーマ

- テーマは、色・書体・背景の飾りをまとめたもの。動画と講座サイトの両方に効く。今あるテーマの一覧と、項目の意味と確かめ方は [theme.md](../../.claude/skills/study-video-course/references/theme.md)、値は `content/themes.ts`
- 講座の `theme: '<id>'` で選ぶ。書かなければ `chalkfile`
- 作るときは `content/themes.ts` に足す（項目は `engine/core/schema.ts` の `Theme`）。地・文字・主役の色・図の 7 色・コードの色分け・背景の飾り（`chalk`・`band`・`stars`）・書体を決める
- 書き出す前に試す: `npm run stills -- L02:3 L03:3 --theme=<id>`（講座のテーマを変えずに、そのテーマで静止画を描く）
- 実在のブランドに寄せるときは、色の雰囲気までにする。テーマの名前に会社名を付けず、ロゴ・社名の書体は使わない

## 2. 作るファイル

講座のことは、講座のフォルダ（`content/<講座 ID>/`）に閉じる。講座を足す PR が触るのは、そのフォルダと、登録表 `content/courses.ts` の 1 行だけ。フォルダの名前は講座 ID にする（生成物の置き場所にも使う）。

手で書くもの:

- [ ] `content/<講座 ID>/<ID>.ts`: レクチャーごとの台本。場面の型は `engine/core/schema.ts`（台本は `content/types.ts` から読む）、画面と話し方の決まりは [style.md](../../.claude/skills/study-video-course/references/style.md)
- [ ] `content/<講座 ID>/course.ts`: 講座（`id`・`prefix`（頭文字）・`order`（一覧の並び）・`title`・`subtitle`・`headline`・`theme`・`sections`・`lectures`・`disclaimer`・`docsNote`・`sourceNote`）。お笑い版は `cast`、章立ては `unitLabel: 'CHAPTER'`、1 本だけの動画は `standalone: true`。頭文字と並びは、上の表で使っていないものにする
- [ ] `content/<講座 ID>/index.ts`: 講座の登録（`export default defineCourseModule({ course, translations })`。訳が無ければ `translations` は書かない）
- [ ] `content/courses.ts`: 1 行（`export { default as <名前> } from './<講座 ID>';`）。行の順は問わない（並びは `order` で決まる）
- [ ] `content/<講座 ID>/sources.ts`: 出典と確かめた日（章立て・教材つきの講座）
- [ ] `content/<講座 ID>/syllabus.ts`: 全体の目次・到達目標・章の計画（教材つきの講座。[materials.md](../../.claude/skills/study-video-course/references/materials.md)）
- [ ] `content/<講座 ID>/reading.ts`: その講座の読みの辞書（講座の用語・固有名詞。要るときだけ。`index.ts` の `reading` に登録する。[style.md](../../.claude/skills/study-video-course/references/style.md) の「読み間違いの直し方」）
- [ ] 訳を作るときは、`content/<講座 ID>/<言語>/` と、`index.ts` の `translations`（[i18n.md](../../.claude/skills/study-video-course/references/i18n.md)。コマンドは [commands.md](commands.md) の「多言語の動画を作る」）
- [ ] 実在の会社や製品を扱うなら、`disclaimer` に「非公式」と書く。お笑い版は「ボケの台詞は、わざと間違えています」も書く

コマンドが作るもの（手で直さない・Git に入れる）:

| ファイル | 作るコマンド |
|---|---|
| `content/<講座 ID>/generated/timeline/<key>.json`（場面と台詞の時刻。指紋つき） | `npm run synth` |
| `content/<講座 ID>/generated/posters/<key>.jpg`（ポスター） | `npm run render` |
| `content/<講座 ID>/generated/media.<言語>.json`（その講座の動画の一覧） | `npm run media:push -- --course <講座 ID>` |
| README の講座の表・上の頭文字と並びの表 | `npm run gen`（`npm run check:docs` がずれを止める） |
| `docs/courses/<講座 ID>/`（教材つきの講座の読む教材） | `npm run build:materials`（`npm run check` がずれを止める） |
| `tests/fixtures/snapshots/videos/<key>.json`（音声の鍵と読み） | `bun scripts/snapshots.ts --update` |

- 並行で作るとき（共有のファイル・生成物がぶつかったときの作り直し方・素材と動画の push）のきまりは、[AGENTS.md](../../AGENTS.md) の「並行作業のきまり」

## 3. 作る

- 調べる → 講座を設計する → 台本 → synth → mix → render の順に進める（スキルの「進め方」）。台詞を直したら synth からやり直す
- 台本だけを先に確かめるときは `npm run validate`（synth の最初にも同じ検証が流れる）

## 4. 確かめる

- [ ] `npm run check`（lint・型・単体テスト・台本の検証・台本とファイルの点検・文書の点検・教材のずれ。CI と同じ）
- [ ] 読み: `.work/kana/<ID>.txt` を全部読んだ
- [ ] 見た目: `npm run stills -- <ID> --mid` の静止画を全部見た（文字のはみ出し・重なり・小さすぎ）
- [ ] 共有の部品やテーマを変えたら `npm run stills:compare -- --base origin/main`（ほかの講座の見た目が変わっていないか。結果の表を PR に貼る）
- [ ] 長さ: `ffprobe` の動画の長さが `content/<講座>/generated/timeline/<ID>.json` の `durationInFrames / 30` と合う
- [ ] 事実: 台本ができたら、別の目（サブエージェント）に台本のファイルだけを渡して、主張ごとに公式で確かめてもらった（[research.md](../../.claude/skills/study-video-course/references/research.md) の「事実確認を別の目でやる」）
- [ ] 権利: `bun scripts/check_overlap.ts <講座 ID>`（台本と、出典の公式ページで、言い回しが続けて同じところが無いか）
- [ ] サイト: `npm run build:site` → `npm run serve` で、再生・途中への移動・字幕・スマホの幅（375px）を見た。講座を足したら `npm run test:browser` も流した
- [ ] 音声の鍵のスナップショット: `bun scripts/snapshots.ts --update`（動画を足したとき）

## 5. 公開する

- [ ] [公開の順番](../operations/publish.md) のとおりに進めた。素材（`materials push`）と動画（`media push`）は merge の前に置く。動画は、置いた時点で誰でも取れる
- 公開したあとに中身（事実・台詞・画面の文字・教材・動画）を直すときは、講座のフォルダの `content/<講座 ID>/CHANGES.md` に記録する（[変更の記録](../../CHANGELOG.md) の「講座ごとの更新の記録」。初めて公開したときは書かない）

## 6. PR に書くこと

PR のテンプレート（`.github/pull_request_template.md`）の項目を埋める。新しい講座では、次も書く。

- [ ] 講座 ID・頭文字・動画の本数と長さ
- [ ] 素材と動画を、merge の前に置いたこと（`materials push`・`media push`・`media check`）
- [ ] 作り直した生成物（講座のフォルダの `generated/`（timeline・ポスター・動画の一覧）・README の表・`docs/courses/`・スナップショット）
- [ ] 確かめたこと（上の 4。静止画の比較の表があれば貼る）
- [ ] 訳を作ったときは、言語と `bun scripts/i18n.ts status` の結果
- [ ] AI を使ったことと、人が確かめた範囲
