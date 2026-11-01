# 読む教材・章の計画・字幕つきの動画（章立ての講座）

動画のほかに「読んで学べる教材」と「自分のサービスで取り組む実践課題」まで作る講座の作り方。ナッジ・UI/UX・マーケティングの講座（`content/nudge-product/` など）が見本。

## 1 章で作るもの

| # | 成果物 | どこに書くか | どう出るか |
|---|---|---|---|
| 1 | 教材本文 | レクチャーの `material.sections`（節 ID つき） | サイトの「教材」タブ、`docs/courses/<講座>/<章 ID>.md` |
| 2 | ナレーション台本 | レクチャーの `scenes[].lines`（動画の正本） | サイトの「台本」タブ、Markdown（時刻は合成の実測） |
| 3 | 絵コンテ（表示内容・図解・読み上げ・秒数） | `scenes` から自動 | Markdown の表（秒数は `site/data/<id>.json`） |
| 4 | 図解・比較例 | 動画は `screens`・`compare`・`table` など、教材は `material.figures` | 動画と「教材」タブと Markdown |
| 5 | 理解確認問題 3 問と解説 | レクチャーの `quiz` | サイトの「確認クイズ」タブ、Markdown |
| 6 | 実践課題・回答例・評価基準 | `material.exercise` | サイトの「実践課題」タブ、Markdown |
| 7 | 要点まとめと参考資料 | `material.summary`・`material.references`（出典 ID） | 「教材」タブ・「出典・参考資料」タブ、Markdown |
| 8 | AI チャットの質問例 3 つ | `material.askExamples`（根拠の節 ID つき） | サイトの「AI に聞く」タブ、Markdown |

講座の全体（目次・到達目標・動画構成）は講座の `syllabus`（`content/<講座>/syllabus.ts`）に書く。まだ作っていない章も書いておくと、サイトのカリキュラムに「準備中」で出る。

## ID のきまり（AI チャットが参照する）

- 章 ID: `<講座の短い名前>-<2 桁>`（例: `nudge-01`）。`syllabus.chapters[].id` と `material.id` を同じにする
- 節 ID: `<章 ID>-s<2 桁>`、図 ID: `<章 ID>-f<2 桁>`、課題 ID: `<章 ID>-ex`
- 公開したあとは変えない（チャットの回答が指す場所がずれる）。節を足すときは番号を足し、消した番号は使い回さない
- `bun scripts/build_materials.ts` が `docs/courses/<講座>/chunks.jsonl` に、ID・本文・根拠の種類・出典をまとめて書く（チャットの検索に使う）

## 根拠の種類（研究・公式・実務・仮の例を分ける）

| `evidence` | 札 | 使うとき |
|---|---|---|
| `research` | 研究・学術 | 査読のある論文・メタ分析・学術書の定義・統計の方法 |
| `official` | 公式・法令・規格 | 法律・官公庁・国際機関・標準化団体（ISO・W3C）・団体の公式の定義 |
| `practice` | 実務の指針 | 専門家や実務家の指針・経験則（条件によって外れる） |
| `example` | 説明用の仮の例 | 架空のサンプルの画面や数字（実在のデータではない） |

- 動画: 場面に `evidence` を書くと見出しの横に札が出る。研究や公式の数字の場面は `cite` に短い出典を書く（左下に出る）
- 教材: 節ごとに `evidence`（複数可）と `sources`（出典 ID）を書く
- 出典: `content/<講座>/sources.ts` に `Source` を並べ、`checked` に開いて確かめた日を書く。台本の `docs` は `docsOf([...])` で出典から作る

## 章の動画の流れ

困りごと → 考え方 → 良い例・悪い例 → 実践手順 → 演習 → 振り返り。場面の例（ナッジの第 1 章）:

`opening` → `goals` → 困りごと（`phone`／`numbers`）→ 打ち手の整理（`table`）→ 定義（`big`）→ 考え方（`concepts`・`points`）→ 悪い例・良い例（`screens`）→ ○×クイズ（`quiz`）→ 研究と限界（`numbers`）→ 実践手順（`points` numbered）→ 演習（`big` と `hold`）→ 振り返り（`recap`）→ 講座の地図（`timeline`）→ `ending`

- 1 本 5〜10 分（台詞 55〜70 行・2,100〜2,900 字が目安。合成すると 1 秒あたり約 6.3 字）
- 演習の場面は `hold` で 2〜3 秒の間を足し、「動画を止めて」と言う。詳しい手順はサイトの実践課題に回す

## `screens`（同じ画面の改善前・改善後）

架空のアプリの画面を部品（`title`・`text`・`field`・`button`・`buttons`・`alert`・`toggle`・`check`・`steps`・`list`・`badge`・`divider`・`spacer`）で組み、番号つきの注（`notes`）を台詞に合わせて出す。

- `device: 'phone'` はスマホ 2 台（注は横）、`'browser'` はブラウザ 2 枚（注は下）。`right` を省くと 1 枚と注の一覧
- 改善前の悪い例は、部品に `weak: true` を付けると薄い文字・薄い線で描く（コントラスト比 2:1 前後）
- `spacer` の `h: 0` は残りの高さを埋める（スマホの下のボタンを画面の下に寄せる）
- 部品が少ない画面は `zoom`（例: 1.5）で拡大する。静止画で文字の大きさを必ず見る
- 画面の中の色は架空のアプリの色（`src/scenes/mock.tsx` の `M`）で、講座のテーマとは別

## 字幕を焼き込んだ動画

```bash
CAPTIONS=1 bash scripts/render.sh N01   # site/media/N01.mp4（字幕なし）、site/media/N01.cc.mp4（サイト用の字幕焼き込み）、out/captioned/N01.mp4（配る用の字幕焼き込み・高画質）
node scripts/stills.mjs N01@2400 --captions   # 字幕つきの見た目を静止画で確かめる
```

- 講座サイトは、`site/media/<id>.cc.mp4` があるレクチャーでは、字幕オンのとき字幕を焼き込んだ版を流し、「字幕」ボタン（C キー）で字幕なしの版に差し替える（再生位置はそのまま）。字幕が動画の中にあるので、標準のコントロールの全画面でも字幕が見える。お笑い版の講座は必ず `CAPTIONS=1` で書き出す
- `.cc.mp4` が無いレクチャーは、サイトが動画を少し縮めて、プレーヤーの中の下に字幕の帯を出す。動画だけを全画面にしたときは、ネイティブ字幕（台本から作った WebVTT）を出す
- 焼き込みの版は、場面を 88% に縮めて下に字幕の帯を空ける（図を字幕で隠さない）。掛け合いの講座は、帯に話している人の名前の札が出る（講座の `cast`）
- `.cc.mp4` もアプリ内保存に入る（保存の大きさは、そのレクチャーの分だけ増える）
- 字幕は台詞の `t`（画面の文）。読み上げだけ変えたいときは `s` に書く

## 作り直しの順番

```bash
bun scripts/synth.ts N01 D01 M01
uv run --with numpy --with scipy python scripts/mix.py N01 D01 M01
CAPTIONS=1 bash scripts/render.sh N01 D01 M01
bun scripts/build_materials.ts            # docs/courses/ の Markdown と chunks.jsonl
bun scripts/build_site.ts nudge-product uiux-engineers indie-marketing
```

`build_materials.ts` は、絵コンテの秒数を `site/data/<id>.json` から取るので、synth の後に流す。
