# 用語集

Chalkfile の文書とコードに出てくる言葉の意味。「どこにあるか」は、その言葉の正本（コードの名前・ファイル）。

- 確かめた時点: 2026-11-02 の main（`76a9da9`）のコード
- 全体の流れは [全体図](overview.md)

## 正本と生成物

| 言葉 | 意味 | どこにあるか |
|---|---|---|
| 正本 | ある事柄を直すときに、そこだけを直せばよい 1 か所。ほかの場所は、正本から作るか、正本へリンクする | 文書の正本は [文書の地図](../README.md) |
| 台本 | 講座の中身を TypeScript のデータで書いたもの。台詞・画面の要素・クイズ・出典を持つ。Chalkfile の正本 | `content/<講座 ID>/`。型は `content/types.ts` |
| 生成物 | スクリプトが台本や素材から作るファイル。手で直さない。main に入れているもの（講座のフォルダの `content/<講座>/generated/`（timeline・ポスター・動画の一覧）・`docs/courses/`）と、手元だけのもの（Worker の許可リストなど）がある | [全体図](overview.md) の「置き場所」 |

## 講座の単位

| 言葉 | 意味 | どこにあるか |
|---|---|---|
| 講座 | 1 つの題目の動画の集まり。講座サイトの 1 ページになる。講座 ID（`stripe-billing` など）は URL の `/<講座 ID>/` になる。言語の名前と重なる 2 文字の英小文字は、講座 ID に使えない | `content/types.ts` の `Course`（講座のフォルダの `course.ts`）。登録は `content/courses.ts`（1 講座 1 行）、並びは `order`、一覧は `content/index.ts` の `COURSES` |
| セクション | 講座の中の区切り（「はじめに」など） | `Course.sections` |
| レクチャー | 動画 1 本ぶんの台本。レクチャー ID は頭の文字と番号（`L01`）。頭の文字は講座ごとに変え、同じ ID を講座をまたいで使わない（重なると、読み込んだときに止まる） | `content/types.ts` の `Lecture`、ファイルは `content/<講座 ID>/<レクチャー ID>.ts` |
| 章 | 章立ての講座（`unitLabel: 'CHAPTER'`）での、レクチャーの呼び名。動画とサイトの見出しが「CHAPTER」「章」になる | `Course.unitLabel` |
| 章 ID・節 ID | 読む教材の章（`nudge-01`）と節（`nudge-01-s02`）の名前。レクチャー ID（`N01`）とは別の名前。AI チャットが答えの根拠を指すのに使うので、公開したら変えない | `ChapterMaterial.id`・`MaterialSection.id` |
| 場面 | 動画の中の 1 画面ぶん。種類（`kind`）ごとに描き方が決まっている | `content/types.ts` の `Scene` |
| 台詞 | 場面の中の 1 つの発話。`t` は画面の台本と字幕に出す文、`s` は読み上げだけを変えたいときの文、`v` は声 | `content/types.ts` の `Line` |
| `at` | 画面の要素を、その場面の何番目の台詞の頭で出すか（0 から数える）。同じ場面の台詞の `id` でも書ける（読み込むときに番号に直す） | `content/types.ts` の `At` |
| 動画 | レクチャー 1 本を、1 つの言語で作ったもの。日本語と訳は、別の動画として扱う | `content/index.ts` の `Video`・`VIDEOS` |
| 動画の key | 動画の名前。日本語はレクチャー ID のまま（`S01`）、訳は言語を付ける（`S01.en`）。timeline・音・字幕・動画のファイル名に使う | `content/i18n.ts` の `videoKey` |
| コンポジション ID | Remotion の中での動画の名前。ドットが使えないので、`S01.en` は `S01-en` になる | `content/i18n.ts` の `compositionId` |

## 声と音

| 言葉 | 意味 | どこにあるか |
|---|---|---|
| 声 | 台詞を読む役（講師の `narrator`・天の声の `tennokoe` など）。日本語は VOICEVOX、英語と中国語は Kokoro-82M の話者に当てる | `content/types.ts` の `VoiceId`。話者と話し方は `content/voices.ts`（音声の鍵の計算は `scripts/voices.ts`） |
| 配役 | 掛け合いの講座で、声ごとに付ける名前と色。焼き込んだ字幕の名前の札と、サイトの台本の「ずんだもん：…」に出る | `Course.cast` |
| 声の鍵 | 台詞の音声ファイルの名前。文と声の設定から作るので、同じ文・同じ声なら、前に作った音声を使い回す | `scripts/voices.ts` の `ttsKey`・`ttsKeyIn` |
| 読み | 声に読ませる文。英字をカナに開く辞書は、共通の `content/reading.ts` と講座の `content/<講座>/reading.ts`（その講座の台詞にだけ効き、共通より優先）。合成したときの読みは `.work/kana/<key>.txt` で確かめる | `content/reading.ts`・`content/<講座>/reading.ts` |
| timeline | 場面と台詞が始まるフレーム。synth が音声の長さを測って決め、Remotion が読む。時刻に効く入力の指紋を持ち、台本を直したのに合成し直していない動画を Studio と validate が止める | `content/<講座>/generated/timeline/<key>.json`（動画ごと）。形と指紋は `engine/core/timeline.ts` |
| ミックス | 台詞・BGM・ジングル・効果音を 1 本にまとめた音 | `scripts/mix.py` が `public/audio/mix/<key>.wav` に書く |

## 素材と教材（名前が似ているので注意）

| 言葉 | 意味 | どこにあるか |
|---|---|---|
| 素材 | 動画を作るための音。台詞の音声と読み、BGM・ジングル・効果音。コードでは `materials` と呼ぶ | `materials` ブランチ。出し入れは `scripts/materials.ts` |
| 教材 | 読む教材。章ごとの本文・図・実践課題・AI チャットの質問例。コードでは `material` と呼ぶ | `Lecture.material`（`ChapterMaterial`）。`scripts/build_materials.ts` が `docs/courses/` に書き出す |
| チャンク | AI チャットが参照する単位（節・図・課題・問題）。id には章 ID・節 ID をそのまま使う | `docs/courses/<講座 ID>/chunks.jsonl` |
| 講座の設計 | 講座の目次・到達目標・章の計画。動画を作る前の章も、サイトのカリキュラムに「準備中」で出る | `Course.syllabus` |
| 根拠の札 | 場面や節の主張の根拠の種類（研究・公式や法令・実務の指針・説明用の仮の例） | `content/types.ts` の `Evidence` |

- 取り違えやすい名前: `scripts/materials.ts` と `materials` ブランチは「素材」。`scripts/build_materials.ts` とスキルの [materials.md](../../.claude/skills/study-video-course/references/materials.md) は「教材」
- 名前のそろえ直し（たとえば素材を別の名前にする）は、あとでまとめて行う予定

## 動画の置き場所と配信

| 言葉 | 意味 | どこにあるか |
|---|---|---|
| 動画の一覧 | 公開する動画の正本。動画ごとに、言語・講座・レクチャー・種類・大きさ・SHA-256・タグを持つ。サイトの組み立てと Worker が同じ一覧を読む | 講座ごとの `content/<講座>/generated/media.<言語>.json`。Worker の許可リストは `npm run gen` がつないで作る（`worker/src/generated/media-manifest.json`）。形の検査は `site/media-shared.ts` |
| 通常版・字幕版 | 字幕版（`captioned`）は字幕を焼き込んだ動画。手元の名前は `<key>.cc.mp4`。サイトは、字幕をオンにするとこちらを流す | `scripts/render.sh`（`CAPTIONS=1`） |
| retained | 動画の一覧のうち、前の版のハッシュの動画を並べる欄。サイトはもう指さないが、Worker は配り続ける。理由は [ADR](../adr/2026-11-02-keep-old-video-hashes.md) | `scripts/media.ts`・`site/media-shared.ts` |
| Releases のタグ | 動画を置く GitHub Releases の名前。形は `media-<言語>-<講座 ID>` | `site/media-shared.ts` |
| ポスター | 動画の始まり近く（4.2 秒）の静止画。動画の表紙と、一覧のカードに使う | `content/<講座>/generated/posters/<key>.jpg`。作るのは `scripts/render.sh` |
| Worker | chalkfile.com の `/media/*` を受ける Cloudflare Workers のコード。ほかのパスは、組み立てたサイトの静的なファイル（assets）から返す | `worker/src/`・`wrangler.jsonc` |
| 公開 | サイトを chalkfile.com に出すこと。main の CI が wrangler で行う。動画は、Releases に置いた時点で誰でも取れる | `.github/workflows/deploy.yml` |
| 保存（アプリ内に保存） | 学ぶ人が講座を選んでブラウザに保存し、通信なしで見られるようにする仕組み（PWA） | `site/sw.ts`・`site/offline-client.ts`。設計はスキルの [offline.md](../../.claude/skills/study-video-course/references/offline.md) |
| 保存版 | 保存した講座の教材と動画の一式。新しい版に替えるのは、学ぶ人が選んだときだけ | 同上 |
| サイトの版 | 講座のページの版。変わると、保存した人に「新しい版」を案内する | `scripts/build_site.ts` の `pageVersion` |
| 旧 Pages | 前の公開先 `sean-sunagaku.github.io/chalkfile/`（`gh-pages` ブランチ）。新しいサイトへの案内を出す | `scripts/deploy_pages.sh`・`scripts/build_migration.ts`・`site/legacy-sw.ts` |

## 言語

| 言葉 | 意味 | どこにあるか |
|---|---|---|
| 言語の記号 | `ja`・`en` のような 2 文字の名前。`zh` は中国語の簡体字 | `content/i18n.ts` の `Lang`・`LANGS` |
| 訳の上書き | 日本語の台本に重ねる訳のファイル。画面の文字は日本語と同じ数・同じ順で上書きし（`key` を書いた項目は `key` で重ねる）、台詞は丸ごと書き直す。理由は [ADR](../adr/2026-11-02-japanese-source-translation-overlay.md) | `content/<講座 ID>/<言語>/`。重ね方は `content/i18n.ts`、項目の役目は `content/fields.ts` |
| 訳の指紋 | 訳したときの日本語の台本の、訳す文字の指紋。訳す文字が変わると `scripts/i18n.ts status` が知らせ、公開する言語の訳なら `check_content.ts` が止める | `LectureL10n.source` |
| publishLangs | 公開する言語。サイトに出す言語と、引数なしの synth が作る動画を決める | `site/config.json` |

## 講座の種類と見た目

| 言葉 | 意味 | どこにあるか |
|---|---|---|
| テーマ | 講座の色・書体・背景の飾り。動画とサイトの両方に効く | 値は `content/themes.ts`、項目は `content/types.ts` の `Theme`、仕様はスキルの [theme.md](../../.claude/skills/study-video-course/references/theme.md) |
| お笑い版 | ボケ（ずんだもん）・ツッコミ（先生）・天の声の掛け合いで進む講座。事実（先生の説明・画面の数字・出典・クイズの答え）は、真面目版や公式ドキュメントで決めたままにする。理由は [ADR](../adr/2026-11-01-comedy-in-every-course.md) | スキルの [comedy.md](../../.claude/skills/study-video-course/references/comedy.md) |
| 真面目版 | 講師の説明だけで進む講座。同じ題目のお笑い版は、中身と出典を真面目版にそろえる | |
| `standalone` | 1 本だけで完結する動画。番号（`01`・`LECTURE 01`・`1 / 1`）を出さない | `Course.standalone` |

## 人

| 言葉 | 意味 |
|---|---|
| 持ち主（メンテナー） | このリポジトリの持ち主。方針・公開と merge の許可・secret と GitHub の設定を決める。古い文書の「本人」「ユーザー」は、持ち主のこと |
| 学ぶ人 | 講座サイトで学ぶ人。古い文書の「利用者」 |

## 番号と記号

| 記号 | 読み方 |
|---|---|
| `SUN-1234` | Linear（持ち主が作業を管理する道具）の課題の番号。commit・PR・文書に出てくる |
| `P-SUN-84` | Linear のプロジェクトの番号。講座の教材と動画、AI チャット、その配信の作業をまとめている |
| `M1`〜`M4` | P-SUN-84 の段階。M1 は chalkfile.com と Worker の土台、M2 は動画を Releases と Worker から配る、M3 は多言語を新しい配信で出す、M4 は AI チャットとデータを Worker に載せる。中身と期日の正本は Linear |
| `#12` など | GitHub の Pull Request の番号。誰でも開ける |

- Linear とリファクタ計画は、リポジトリの外にあり、外の人は開けない。番号は「どの作業の話か」の目印として読み、中身は commit・PR・文書から読む
