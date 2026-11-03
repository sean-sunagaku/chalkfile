# 外から指される名前と形を凍結し、変えるときは移行を用意してから変える

- 状態: 採用
- 決めた日: 2026-11-03
- 関連: [全体図](../architecture/overview.md) の「外から指される名前（変えると壊れる）」・`tests/contracts.test.ts`・`tests/fixtures/contracts/frozen.json`・`engine/core/migrate.ts`

## 背景

- 台本から作る名前と形の中に、リポジトリの外のものが指しているものがある
  - 学ぶ人の端末に保存した講座（講座 ID・動画のファイル名と SHA-256）
  - 公開したページと、Releases に置いた動画（タグとファイル名）
  - 素材ブランチと声のキャッシュ（声の鍵）
  - 読む教材と AI チャット（章 ID・節 ID・`chunks.jsonl` の id）
  - 動画を書き出す道具と、作業中の別の branch（動画の key・コンポジションの ID・timeline のファイルの形）
- どれも、名前を変えると黙って壊れる。保存した動画が見つからない、素材が当たらずに合成し直しになる、AI チャットの根拠の節が無くなる、など。台本の型を直す整理の中で、うっかり変えやすい

## 決めたこと

次のものを凍結する。テストで止め、変えるときは下の手順に従う。

| 凍結するもの | 形 | 止めるテスト |
|---|---|---|
| 動画の key・コンポジションの ID | 日本語は `L01`、訳は `S01.en`。コンポジションは `S01-en`（`engine/core/i18n.ts` の `videoKey`・`compositionId`） | 作り方と、凍結した一覧の全部が今もあること |
| 講座・章・節・図・課題・出典の ID、AI チャットの参照の単位 | 台本に書いた ID と、`docs/courses/<講座>/chunks.jsonl` の id | 凍結した一覧の全部が今もあること |
| 声の鍵の v1 | `scripts/voices.ts` の `ttsKeyV1`・`kokoroKeyV1`（文と声の設定のハッシュ） | 決まった入力の鍵が前と同じこと |
| timeline のファイルの形 | `schema: 1`。項目は `durationInFrames`・`fingerprint`・`fps`・`key`・`scenes`（場面は `start`・`duration`・`lines`、台詞は `start`・`end`） | 書く中身と、置いてある全部のファイルの項目 |
| Releases のタグとファイル名 | タグは `media-<言語>-<講座 ID>`、ファイル名は `<レクチャー ID>[.cc].<SHA-256>.mp4`、配る場所は `/media/<言語>/<講座 ID>/<ファイル名>` | 作り方と、講座の動画の一覧の全部の項目 |
| 台本の形の版 | Course の `schemaVersion`（書かなければ 1。今の版は `engine/core/migrate.ts` の `COURSE_SCHEMA_VERSION`） | 今の講座が今の版で、直さずにそのまま読めること |

- 凍結した名前の一覧は `tests/fixtures/contracts/frozen.json` に置く。足すだけにする（名前を足すのはよい。`UPDATE_CONTRACTS=1 bun test tests/contracts.test.ts` が、今ある名前を一覧に足す。消さない）
- 台本の形（`engine/core/schema.ts` の `Course` とその中身）を、前の台本が読めなくなる形に変えるときは、版を上げ、1 つ前の版から直す関数を `engine/core/migrate.ts` の `MIGRATIONS` に足す。直すのは講座の登録（`defineCourseModule`）で、台本のファイルは書き換えない。知らない版の講座は、台本の検証（`npm run validate`）が誤りにする

## 変えるときの手順

1. 変える理由と、壊れるもの（保存・Releases・素材・AI チャット・書き出しの道具・作業中の branch）を、新しい ADR に書く。持ち主の許可をもらう
2. 古い名前と形を読めるようにしてから変える
   - 動画の key・ファイル名・タグ: 古い名前の動画を Releases と動画の一覧の `retained` に残し、保存した講座が古い名前を読めることを `tests/offline-compat.test.ts` で確かめる
   - 声の鍵: 新しい版の鍵（v2 など）を足し、v1 の計算は消さない。素材が当たるかを `npm run materials:check` で見る
   - timeline: `TIMELINE_SCHEMA` を上げ、読む側（`parseTimeline`）が古い版を読むか、全部を作り直す（`npm run synth -- --cached-only`）
   - 台本の形: `COURSE_SCHEMA_VERSION` を上げ、`MIGRATIONS` に古い形から直す関数と、そのテストを足す
   - 章・節の ID: AI チャットが古い ID を指したときの行き先（新しい ID）を用意する
3. 凍結した一覧（`tests/fixtures/contracts/frozen.json`）とテストの値を、手で直す。何を消した・変えたかを、その PR に書く
4. 利用者に見える変更なら、まとめて出す回に入れる（[公開の順番](../operations/publish.md)）

## 理由

- 名前を変えたことに、テストで気づける。整理の PR が、外のものを黙って壊さない
- 足すだけなら、並行の PR は一覧を触らずに済む（新しい講座は、公開したあとで一覧に足す）
- 台本の形に版があれば、形を変える PR と、古い形で書いた作業中の台本が、同時に進められる

## ほかの案

| 案 | 選ばなかった理由 |
|---|---|
| 文書に書くだけにする | 整理の PR で変わっても止まらない |
| 今ある名前を、テストの中に全部書く | 講座を足す PR が、毎回テストを書き換えることになり、並行の PR とぶつかる |
| 台本の形の版を、講座ごとに必ず書く | 今の全部の台本を書き換えることになる。書かなければ 1 とする |

## 影響

- 凍結したものを変える PR は、テストを直すことになるので、レビューで気づける
- 新しく公開した講座の名前は、公開したあとで一覧に足す（足さないうちは、凍結されていない）
- 外から指される名前の一覧の正本は、[全体図](../architecture/overview.md) の「外から指される名前（変えると壊れる）」
