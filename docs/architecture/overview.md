# 全体図（データの流れと置き場所）

Chalkfile は、TypeScript で書いた台本から、声・動画・講座サイト・読む教材を作る。台本（`content/`）が正本で、ほかのものは台本と素材から作り直せる。

- 確かめた時点: 2026-11-03 のコード（生成物を講座のフォルダに移したあと）
- 言葉の意味は [用語集](glossary.md)、決めた理由は [ADR](../adr/README.md)
- コマンドの書き方は [コマンド](../guide/commands.md) と [始め方](../guide/quickstart.md)。ここには写さない

## データの流れ

```text
content/（台本。正本）＋ content/<講座>/<言語>/（訳の上書き）
 │
 ├─ scripts/synth.ts ── 日本語は VOICEVOX、英語と中国語は Kokoro（scripts/tts_kokoro.py）で台詞を読む
 │    ├→ ~/.cache/chalkfile/tts/<声の鍵>.wav・.kana … 台詞の音声と読み。同じ文・同じ声なら使い回す（作業フォルダの間で共有。前の置き場所 .work/tts も読む）
 │    ├→ content/<講座>/generated/timeline/<key>.json … 場面と台詞の始まるフレーム（動画ごと・指紋つき。追跡）
 │    ├→ .work/plan/<key>.json ……………………… ミックスの設計図
 │    └→ site/data/<key>.json・.vtt ……………… サイトに出す台本・章・字幕の時刻
 │
 ├─ scripts/materials.ts push ⇄ pull ── materials ブランチ（台詞の音声と読み・BGM・効果音）
 ├─ scripts/build_music.py（中身は scripts/audio/music/）──→ public/audio/music/・sfx/（BGM・ジングル・効果音）
 ├─ scripts/mix.py ─────────→ public/audio/mix/<key>.wav（台詞・BGM・効果音を 1 本に）
 ├─ scripts/render.sh（Remotion。映像は音なしで書き出し、ミックスの音と合わせる）
 │    ├→ out/master/<key>.mp4（高画質の映像）→ site/media/<key>.mp4（サイト用に縮めた動画）
 │    ├→ content/<講座>/generated/posters/<key>.jpg（ポスター。追跡）
 │    └→ CAPTIONS=1 のとき site/media/<key>.cc.mp4（字幕を焼き込んだ版）
 ├─ scripts/media.ts push --course <講座> ──→ GitHub Releases（タグ media-<言語>-<講座>。名前に SHA-256 が入る）
 │                             ＋ content/<講座>/generated/media.<言語>.json（その講座の動画の一覧。追跡）
 ├─ scripts/gen.ts（npm run gen）→ worker/src/generated/media-manifest.json（全講座の動画の一覧。Worker の許可リスト。手元だけ）
 ├─ scripts/build_materials.ts（site/data も読む）→ docs/courses/（読む教材。追跡）
 └─ scripts/build_site.ts（site/data・講座のフォルダのポスターと動画の一覧を読む。本体は scripts/site/ の buildSite）→ site/dist
       └→ .github/workflows/ci.yml（main への push）→ 点検・組み立て（artifact）・確かめ → deploy のジョブが artifact を wrangler deploy → https://chalkfile.com/

旧 Pages ＝ gh-pages ブランチ（新しいサイトへの案内だけ。scripts/legacy/deploy_pages.sh）
```

- 「追跡」は main で Git が追跡するファイル。ほかは `.gitignore` で外していて、手元だけにある
- `<key>` は動画の key（`S01`・`S01.en`）。訳の動画も同じ流れで作る。サイトに出す言語は `site/config.json` の `publishLangs` が決める
- `media.ts push` は、選んだ講座（`--course`）と言語（`--lang`。既定は ja）の動画だけを扱い、その講座の一覧だけを書き換える。古いハッシュの動画は消さず、一覧の `retained` に残す（[ADR](../adr/2026-11-02-keep-old-video-hashes.md)）

## どこで何をするか

| どこで | すること | 正本 |
|---|---|---|
| 手元 | 台本を書き、synth・mix・render で声と動画を作る。動画は `media.ts push --course <講座 ID>` で Releases に、台詞の音声は `materials.ts push` で素材ブランチに置く | 順番は [公開の順番](../operations/publish.md) |
| PR の CI | lint・型検査・単体テスト・台本と公開の検証（ポスターと動画の一覧の抜け・timeline の指紋も）・ファイルと文書の点検（生成した表と教材のずれも）。main の CI と同じ手順でサイトを組み立てて点検し、artifact に残す。それを手元の Worker で配って確かめ、合成の講座でブラウザのテストも流す（公開はしない。[CI の形](../operations/ci.md)） | `.github/workflows/ci.yml` |
| main の CI | 声も動画も作らない。PR の CI と同じジョブ（素材ブランチから声を取り出して時刻とサイトのデータを作り直し、動画の一覧を Releases と照らし、Worker の許可リストを作り、組み立てて点検する）のあと、組み立てたもの（artifact）を wrangler で出す。出したあと、公開したものが組み立てたものと同じか・全部の動画の Range・HTML を確かめ、通らなければ前の版に戻す。公開中のサイトは、毎日 `canary.yml` も確かめる | `.github/workflows/ci.yml`・`canary.yml` |

- 動画は merge の前に Releases に置く。置いた時点で、誰でも取れる
- main の CI は、素材ブランチの台詞の音声や、Releases の動画・ポスターが足りないと止まる（声の合成も書き出しも始めない）

## 配信の形

```text
ブラウザ ──→ https://chalkfile.com/（Cloudflare Workers。設定は wrangler.jsonc）
               ├ /media/* … Worker（worker/src/）を先に通す。許可リスト（全講座の動画の一覧）にあるパスだけを、
               │             GitHub Releases から Range のまま中継し、video/mp4 で返す
               └ そのほか … 組み立てたサイト（site/dist）を静的なファイル（assets）として返す

保存（PWA）: 学ぶ人が講座を選んで保存すると、Service Worker（site/sw.ts）が教材と動画の
            大きさと SHA-256 を確かめてブラウザに保存し、通信なしでも開けるようにする
```

- Worker の入口（パスの頭で受け口を選ぶ）は `worker/src/app.ts`、`/media/*` の動きの正本は `worker/src/media.ts`。設計は [配信の設計](delivery.md)、決めた理由は [配信の ADR](../adr/2026-11-02-workers-and-releases.md) と [入口の ADR](../adr/2026-11-03-worker-api-shape.md)
- 保存の設計は [保存の設計](offline.md)。直すときの決まりと確かめ方は、スキル [chalkfile-engine](../../.claude/skills/chalkfile-engine/SKILL.md)

## 置き場所

| 置き場所 | 中身 | 正本か | 作り直し方 |
|---|---|---|---|
| main ブランチ | 台本（`content/`）・動画を描くコード（`src/`）・作る道具（`scripts/`）・サイトのひな形（`site/`）・Worker（`worker/`・`wrangler.jsonc`）・テスト・文書。生成物のうち、講座のフォルダの `content/<講座>/generated/`（時刻の `timeline/`・ポスターの `posters/`・動画の一覧の `media.<言語>.json`）と読む教材（`docs/courses/`）も入れている | 台本とコードの正本。入れている生成物は写し。ただし動画の一覧は、Releases に置いた動画の記録 | 生成物は、時刻 → synth、ポスター → render、読む教材 → build_materials、動画の一覧 → media push --course |
| `materials` ブランチ | 台詞の音声（`tts/<講座>/<声の鍵>.flac`）と読み（`.kana`）・BGM とジングルと効果音（`audio/`）・`SHA256SUMS`・`README.md`。親の無い 1 コミット | 台詞の音声の正本。同じ文でも、VOICEVOX や Kokoro の版で音が変わりうる | `materials.ts push` で、手元の素材を足す（消すのは `materials.ts gc` だけ）。取り出すのは `materials.ts pull`（[ADR](../adr/2026-10-31-materials-branch.md)） |
| GitHub Releases | 公開する動画（通常版と字幕版）。タグは `media-<言語>-<講座>`、ファイル名に SHA-256 が入る | 動画の中身の正本。どの動画を出すかは、main の講座ごとの動画の一覧が決める | render のあと、`media.ts push --course <講座 ID>` で足す。取り出すのは `media.ts pull` |
| Cloudflare Workers（chalkfile.com） | 組み立てたサイト（`site/dist`）と Worker | 写し。正本は main | main への push か、main を選んだ手動の実行で、ci.yml の deploy のジョブが、build のジョブが組み立てたものを出す |
| `gh-pages` ブランチ（旧 Pages。前の公開先） | 新しいサイトへの案内のページと、前の保存版を守る移行用の Service Worker | 写し。正本は main の `scripts/build_migration.ts` と `site/legacy-sw.ts` | `scripts/legacy/deploy_pages.sh`（移行の案内だけを出す専用の手順。持ち主の許可のもとで流す） |
| 手元だけ（`.gitignore`） | `.work/`（ミックスの設計図・読み。前の置き場所の声のキャッシュ `.work/tts` も読む）・`public/audio/`（BGM・効果音・ミックス）・`out/`（高画質の書き出し・字幕版・納品物・静止画）・`site/media/`（サイト用の動画とポスターの写し）・`site/data/`（サイトの台本と字幕）・`site/dist/` と `site/migration-dist/`（組み立てたサイト）・`worker/src/generated/media-manifest.json`（Worker の許可リスト）・`node_modules/` | 写し | 声 → `materials.ts pull`（台詞を変えたら synth）、BGM と効果音 → `materials.ts pull` か `build_music.py`、ミックス → `mix.py`、動画 → `render.sh` か `media.ts pull`、サイト → `build_site.ts`、Worker の許可リスト → `npm run gen` |
| リポジトリの外 | 台詞の声と読みの共有のキャッシュ（`CHALKFILE_CACHE_DIR`。既定 `~/.cache/chalkfile/tts/`。作業フォルダの間で使い回す）・Kokoro のモデルの重み（`~/.cache/huggingface`）・uv が用意する Python の環境・Remotion が初回の書き出しで取ってくる Chrome Headless Shell | 写し | 声 → `materials.ts pull`（同じ中身があれば取り出さない。台詞を変えたら synth）。ほかは初回に自動で取ってくる |

## リポジトリのフォルダ

| パス | 中身 |
|---|---|
| `content/courses.ts` | 講座の登録表（1 講座 1 行。`.gitattributes` で `merge=union`）。並びは各講座の `order` で決まる |
| `content/index.ts` | 登録表から作る講座の一覧（`COURSES`）・訳の一覧（`TRANSLATIONS`）・動画の一覧（`VIDEOS`） |
| `content/<講座 ID>/` | 講座ごとの台本（`<レクチャー ID>.ts`）・登録（`index.ts`）・講座の定義（`course.ts`。頭文字 `prefix` と並び `order` も）・出典（`sources.ts`）・章の計画（`syllabus.ts`）・読みの辞書（`reading.ts`。その講座の台詞にだけ効く）・訳（`<言語>/`）・生成物（`generated/`）。フォルダの名前は講座 ID |
| `content/types.ts`・`lines.ts`・`themes.ts`・`i18n.ts`・`reading.ts`・`voices.ts` | 台本の型（場面の種類と、台詞に合わせて出す要素）・at に書いた台詞の id を番号に直す読み込み・テーマ・訳の重ね方・読み上げの読み・声の一覧とクレジット |
| `src/` | Remotion の動画。`Lecture.tsx` が場面を並べ、`scenes/` が場面の種類ごとに描き、`theme.ts` の `ThemeProvider` がテーマの色と書体を部品に渡す（部品は `usePalette()` で読む）。`timelines.ts` が講座のフォルダの timeline（synth が書く生成物）を集める |
| `engine/core/` | React・Remotion・Node に依存しない部品（台本の検証 `validate.ts`・timeline の形と指紋 `timeline.ts`・生成物の置き場所 `generated.ts`・テーマのパレット `theme.ts` と色の計算 `color.ts`・色のコントラスト） |
| `scripts/` | 作る道具（合成・ミックス・書き出し・素材・動画・教材・サイト）と点検（`check_content.ts`・`check_docs.ts`・`check_delivery.ts`）。`scripts/legacy/` は旧 Pages の移行の道具 |
| `scripts/audio/` | BGM・ジングル・効果音の合成（`music/`。役割ごとのモジュールで、一覧は `music/__init__.py`。入口は `scripts/build_music.py`）と、Python が読む動画の値（`video_config.json`） |
| `site/` | 講座サイトのひな形（`template.html` が講座、`home.html` が一覧）・決まった文字（`i18n.ts`）・保存（`sw.ts`・`offline-*.ts`）・設定（`config.json`）・一覧のページの画像（`assets/`）。色と書体は `scripts/site_theme.ts` がテーマから作る |
| `worker/`・`wrangler.jsonc` | Worker の入口（`worker/src/app.ts`。パスの頭で受け口を選ぶ）・`/media/` の中継（`media.ts`。許可リストは `npm run gen` が作る `worker/src/generated/media-manifest.json`）・AI チャットの受け口（`api.ts`。M4 で入れる）と、Workers の assets・Custom Domain の設定 |
| `tests/` | 単体テスト（`*.test.ts`）・ブラウザのテスト（`browser/`。テストのサーバーは `browser-server.ts` と `e2e/`）・テストの入力（`fixtures/`。合成の講座は `fixtures/content/site-sample`）・本番を確かめる道具（`verify-*.ts` など。手で流す） |
| `docs/` | 文書（[文書の地図](../README.md)）。`docs/courses/` は生成物 |
| `.claude/skills/` | Claude Code のスキル（講座の作り方・書き方・調べ方・テーマの作り方は `study-video-course`、共通プロンプトからの講座は `course-from-prompt`、サイト・保存・Worker は `chalkfile-engine`）。AI 共通のきまりは直下の `AGENTS.md` |
| `.github/` | CI（`workflows/`）・Dependabot・CODEOWNERS・PR のひな形 |

## 外から指される名前（変えると壊れる）

| 名前 | 指している所 |
|---|---|
| 講座 ID | サイトの URL（`/<講座 ID>/`、訳は `/<言語>/<講座 ID>/`）・保存の ID・Releases のタグ・素材ブランチのフォルダ |
| レクチャー ID と動画の key | 動画・ポスター・音・字幕・timeline のファイル名。レクチャー ID の頭文字は講座の `prefix` |
| 動画のパス（`/media/<言語>/<講座 ID>/<レクチャー ID>[.cc].<SHA-256>.mp4`） | 公開したページと、学ぶ人が保存した講座 |
| 章 ID・節 ID | 読む教材と `chunks.jsonl`。AI チャットが答えの根拠を指すのに使う |
| 声の鍵の決め方 | 素材ブランチと声のキャッシュ（`~/.cache/chalkfile/tts`・`.work/tts`）のファイル名。決め方を変えると全部の音声が見つからなくなり、main の CI の `synth.ts --cached-only` が止まる |
