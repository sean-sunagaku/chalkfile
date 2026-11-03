# 全体図（データの流れと置き場所）

Chalkfile は、TypeScript で書いた台本から、声・動画・講座サイト・読む教材を作る。台本（`content/`）が正本で、ほかのものは台本と素材から作り直せる。

- 確かめた時点: 2026-11-02 の main（`76a9da9`）のコード
- 言葉の意味は [用語集](glossary.md)、決めた理由は [ADR](../adr/README.md)
- コマンドの書き方は [README](../../README.md) の「作り直す」「素材から作り直す（VOICEVOX なし）」。ここには写さない

## データの流れ

```text
content/（台本。正本）＋ content/<講座>/<言語>/（訳の上書き）
 │
 ├─ scripts/synth.ts ── 日本語は VOICEVOX、英語と中国語は Kokoro（scripts/tts_kokoro.py）で台詞を読む
 │    ├→ .work/tts/<声の鍵>.wav・.kana ……… 台詞の音声と読み。同じ文・同じ声なら使い回す
 │    ├→ src/generated/timeline.json ………… 場面と台詞の始まるフレーム（追跡）
 │    ├→ src/generated/credits.json・lecture-credits.json …… 声のクレジット（追跡）
 │    ├→ .work/plan/<key>.json ……………………… ミックスの設計図
 │    └→ site/data/<key>.json・.vtt ……………… サイトに出す台本・章・字幕の時刻
 │
 ├─ scripts/materials.ts push ⇄ pull ── materials ブランチ（台詞の音声と読み・BGM・効果音）
 ├─ scripts/build_music.py ──→ public/audio/music/・sfx/（BGM・ジングル・効果音）
 ├─ scripts/mix.py ─────────→ public/audio/mix/<key>.wav（台詞・BGM・効果音を 1 本に）
 ├─ scripts/render.sh（Remotion。映像は音なしで書き出し、ミックスの音と合わせる）
 │    ├→ out/master/<key>.mp4（高画質の映像）→ site/media/<key>.mp4（サイト用に縮めた動画）
 │    ├→ site/posters/<key>.jpg（ポスター。追跡）
 │    └→ CAPTIONS=1 のとき site/media/<key>.cc.mp4（字幕を焼き込んだ版）
 ├─ scripts/media.ts push ──→ GitHub Releases（タグ media-ja-<講座>。名前に SHA-256 が入る）
 │                             ＋ site/media-manifest.json（動画の一覧。追跡）
 ├─ scripts/build_materials.ts（site/data も読む）→ docs/courses/（読む教材。追跡）
 └─ scripts/build_site.ts（site/data・site/posters・動画の一覧を読む）→ site/dist
       └→ .github/workflows/deploy.yml（main への push）→ wrangler deploy → https://chalkfile.com/

旧 https://sean-sunagaku.github.io/chalkfile/ ＝ gh-pages ブランチ（新しいサイトへの案内だけ。scripts/deploy_pages.sh）
```

- 「追跡」は main で Git が追跡するファイル。ほかは `.gitignore` で外していて、手元だけにある
- `<key>` は動画の key（`S01`・`S01.en`）。訳の動画も同じ流れで作る。サイトに出す言語は `site/config.json` の `publishLangs` が決める
- `media.ts push` が扱うのは日本語の動画。古いハッシュの動画は消さず、一覧の `retained` に残す（[ADR](../adr/2026-11-02-keep-old-video-hashes.md)）

## どこで何をするか

| どこで | すること | 正本 |
|---|---|---|
| 手元 | 台本を書き、synth・mix・render で声と動画を作る。動画は `media.ts push` で Releases に、台詞の音声は `materials.ts push` で素材ブランチに置く | 順番は [workers-delivery.md](../workers-delivery.md) の「公開する順番」 |
| PR の CI | lint・型検査・単体テスト・台本と公開の検証（ポスターと動画の一覧の抜けも）・ファイルと文書の点検。main の CI と同じ手順でサイトを組み立てて点検する（公開はしない） | `.github/workflows/check.yml` |
| main の CI | 声も動画も作らない。素材ブランチから声を取り出して、時刻とサイトのデータを作り直す。動画の一覧を Releases と照らし、サイトを組み立てて点検してから、wrangler で出す。出したあと、全部の動画の Range を確かめる | `.github/workflows/deploy.yml` |

- 動画は merge の前に Releases に置く。置いた時点で、誰でも取れる
- main の CI は、素材ブランチの台詞の音声や、Releases の動画・ポスターが足りないと止まる（声の合成も書き出しも始めない）

## 配信の形

```text
ブラウザ ──→ https://chalkfile.com/（Cloudflare Workers。設定は wrangler.jsonc）
               ├ /media/* … Worker（worker/src/）を先に通す。動画の一覧にあるパスだけを、
               │             GitHub Releases から Range のまま中継し、video/mp4 で返す
               └ そのほか … 組み立てたサイト（site/dist）を静的なファイル（assets）として返す

保存（PWA）: 学ぶ人が講座を選んで保存すると、Service Worker（site/sw.ts）が教材と動画の
            大きさと SHA-256 を確かめてブラウザに保存し、通信なしでも開けるようにする
```

- Worker の動きの正本は `worker/src/media.ts`。決めた理由は [配信の ADR](../adr/2026-11-02-workers-and-releases.md)
- 保存の設計は、今はスキルの [offline.md](../../.claude/skills/study-video-course/references/offline.md)

## 置き場所

| 置き場所 | 中身 | 正本か | 作り直し方 |
|---|---|---|---|
| main ブランチ | 台本（`content/`）・動画を描くコード（`src/`）・作る道具（`scripts/`）・サイトのひな形（`site/`）・Worker（`worker/`・`wrangler.jsonc`）・テスト・文書。生成物のうち、時刻とクレジット（`src/generated/`）・ポスター（`site/posters/`）・動画の一覧（`site/media-manifest.json`）・読む教材（`docs/courses/`）も入れている | 台本とコードの正本。入れている生成物は写し。ただし動画の一覧は、Releases に置いた動画の記録 | 生成物は、時刻とクレジット → synth、ポスター → render、読む教材 → build_materials、動画の一覧 → media push |
| `materials` ブランチ | 台詞の音声（`tts/<講座>/<声の鍵>.flac`）と読み（`.kana`）・BGM とジングルと効果音（`audio/`）・`SHA256SUMS`・`README.md`。親の無い 1 コミット | 台詞の音声の正本。同じ文でも、VOICEVOX や Kokoro の版で音が変わりうる | `materials.ts push` で、手元の素材から作り直して置き換える。取り出すのは `materials.ts pull`（[ADR](../adr/2026-10-31-materials-branch.md)） |
| GitHub Releases | 公開する動画（通常版と字幕版）。タグは `media-ja-<講座>`、ファイル名に SHA-256 が入る | 動画の中身の正本。どの動画を出すかは、main の動画の一覧が決める | render のあと、`media.ts push` で足す。取り出すのは `media.ts pull` |
| Cloudflare Workers（chalkfile.com） | 組み立てたサイト（`site/dist`）と Worker | 写し。正本は main | main への push か、main を選んだ手動の実行で、deploy.yml が組み立てて出す |
| `gh-pages` ブランチ（旧 `sean-sunagaku.github.io/chalkfile/`） | 新しいサイトへの案内のページと、前の保存版を守る移行用の Service Worker | 写し。正本は main の `scripts/build_migration.ts` と `site/legacy-sw.ts` | `scripts/deploy_pages.sh`（移行の案内だけを出す専用の手順。持ち主の許可のもとで流す） |
| 手元だけ（`.gitignore`） | `.work/`（声のキャッシュ・ミックスの設計図・読み）・`public/audio/`（BGM・効果音・ミックス）・`out/`（高画質の書き出し・字幕版・納品物・静止画）・`site/media/`（サイト用の動画とポスターの写し）・`site/data/`（サイトの台本と字幕）・`site/dist/` と `site/migration-dist/`（組み立てたサイト）・`node_modules/` | 写し | 声 → `materials.ts pull`（台詞を変えたら synth）、BGM と効果音 → `materials.ts pull` か `build_music.py`、ミックス → `mix.py`、動画 → `render.sh` か `media.ts pull`、サイト → `build_site.ts` |
| リポジトリの外 | Kokoro のモデルの重み（`~/.cache/huggingface`）・uv が用意する Python の環境・Remotion が初回の書き出しで取ってくる Chrome Headless Shell | 写し | 初回に自動で取ってくる |

## 外から指される名前（変えると壊れる）

| 名前 | 指している所 |
|---|---|
| 講座 ID | サイトの URL（`/<講座 ID>/`、訳は `/<言語>/<講座 ID>/`）・保存の ID・Releases のタグ・素材ブランチのフォルダ |
| レクチャー ID と動画の key | 動画・ポスター・音・字幕のファイル名と、timeline の鍵 |
| 動画のパス（`/media/<言語>/<講座 ID>/<レクチャー ID>[.cc].<SHA-256>.mp4`） | 公開したページと、学ぶ人が保存した講座 |
| 章 ID・節 ID | 読む教材と `chunks.jsonl`。AI チャットが答えの根拠を指すのに使う |
| 声の鍵の決め方 | 素材ブランチと `.work/tts` のファイル名。決め方を変えると全部の音声が見つからなくなり、main の CI の `synth.ts --cached-only` が止まる |
