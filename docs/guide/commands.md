# コマンド

コマンドの入口は `package.json` の `scripts`（`npm run` だけを流すと一覧が出る）。引数は `--` のあとに渡す（`npm run synth -- L03 L05`）。道具をまとめた 1 つの入口は `npm run chalk -- <コマンド>`（下の「chalk」）。

- 「chalk」の表は、`npm run chalk -- help` と同じ一覧（`scripts/cli.ts`）から `npm run gen` が作る。ずれは `npm run check:docs` が止める
- 「npm run」の表は、`package.json` の `scripts` を写したもの。scripts を変える PR で、この表も直す
- 作り直しの流れは [quickstart.md](quickstart.md)、公開の順番は [公開の順番](../operations/publish.md)

## chalk（1 つの入口）

`npm run chalk -- <コマンド> [引数]`。そのコマンドの使い方は `npm run chalk -- <コマンド> --help`（何も流さない）。中では、前の呼び方と同じ道具を流す。

- 対象: `--course <講座 ID>`・`--video <動画>`（`*` と `?` を使える。`'S03.*'` は S03 の全部の言語）・`--lang <言語>`（`all` で全部）。選ばなければ、公開する言語（`chalkfile.config.ts` の `publishLangs`）の全部の動画
- 共通: `--dry-run`（流すコマンドを出すだけ）・`--json`（AI・ほかの道具が読む）・`-v`（流すコマンドも出す。`voice synth`・`materials`・`media` は、中の道具にも `--verbose` を渡し、VOICEVOX・git・ffmpeg・gh への問い合わせと、失敗したときの stderr の全部を伏せてから出す）。受け取るのは、意味のあるコマンドだけ
- 書き出し（`render`）は、選んだ動画を 1 回で書き出す（バンドルは 1 回だけ作る）。掛け合いの講座（`cast` のある講座）は、字幕を焼き込んだ版も作る。前の環境変数（`CAPTIONS=1` で全部の動画・`CAPTIONS=0` で作らない・`CHUNK`・`CONCURRENCY`）も、そのまま使える
- 終了コード: 0 成功・1 失敗・2 使い方の誤り・3 前提が足りない（道具・素材・認証。`npm run chalk -- doctor` で確かめる）

<!-- cli:start -->
<!-- npm run gen が、scripts/cli.ts のコマンドの一覧（npm run chalk -- help の元）から作る。手で直さない -->

| コマンド（`npm run chalk -- …`） | すること | 前の呼び方（そのまま使える） |
|---|---|---|
| `content migrate [--write]` | 教材を分け、出典と共通の書き方をまとめる（既定は差分の一覧だけ） | `npm run codemod:content` |
| `doctor [--json]` | 道具の版・VOICEVOX・gh の認証の有無・空き容量・ポート・声のキャッシュを確かめる | （新しい） |
| `validate [--warnings] [--json]` | 台本の検証と、台本・Git に入れるファイルの点検（訳し残しも）。--json は台本の検証だけを JSON で | `bun scripts/validate.ts`・`bun scripts/check_content.ts` |
| `status [動画…] [--course <ID>] [--video <形>] [--lang <言語>] [--json]` | 段（voice・mix・render・docs・site）ごとに、記録（.work/state/）と今の入力の指紋を比べ、古くなった単位と次に流す段を出す（何も作らない）。公開した動画が今の台本と合うかも出す | （新しい） |
| `build --to <voice\|mix\|render\|docs\|site> [動画…] [--course <ID>] [--video <形>] [--lang <言語>] [--force] [--src] [--cached-only] [--jobs <数>]` | その段まで、前の段から順に、古くなった単位だけを流して記録する（何も変えていなければ、何も流さない）。--force は全部、--src は描き方のコードだけが変わった動画も書き出す。--dry-run は流すものを出すだけ | （新しい） |
| `voice synth [動画…] [--course <ID>] [--video <形>] [--lang <言語>] [--cached-only [--durations-only]] [--prune]` | 台詞の声と時刻（timeline・ミックスの設計図・サイトの台本）。--cached-only は素材の声だけを使う。--durations-only は素材の長さと読みだけで作る（音声を取り出さない。CI 用） | `bun scripts/synth.ts`・`npm run synth` |
| `voice speech-check [動画…] [--course <ID>] [--video <形>] [--lang <言語>]` | 訳の声を Whisper で聞き取り直し、読み上げの間違いを探す（選ばなければ、合成した訳の全部） | `uv run --locked --script scripts/check_speech.py` |
| `i18n status` | 訳の表（訳あり・日本語の台本が訳のあとで変わった・未訳）と訳し残し | `bun scripts/i18n.ts status` |
| `i18n stamp <動画…>（例: P01.en・'*.zh'）` | 訳を台本に合わせ直したあと、今の日本語の台本の指紋を訳のファイルに書く | `bun scripts/i18n.ts stamp` |
| `i18n scaffold <動画> [--stdout]（例: S07.en）` | 日本語の注釈を入れた訳のひな形を作る（--stdout は表示だけ） | `bun scripts/i18n.ts scaffold` |
| `i18n restamp` | 日本語が変わっていない訳の、前の作り方の指紋だけを付け直す | `bun scripts/i18n.ts restamp` |
| `i18n try <講座 ID> <言語> <レクチャー ID>` | 講座に並べる前の訳のファイルを 1 本だけ確かめる（重ね方・訳し残し・点検・長さ） | `bun scripts/i18n.ts try` |
| `music build [--only <名前>…] [--skip-verify] [--check]` | BGM・ジングル・効果音（public/audio/）。--check は素材と同じ音ができるかだけを見る | `npm run build:music`・`npm run music:verify` |
| `mix [動画…] [--course <ID>] [--video <形>] [--lang <言語>]` | 音のミックス（public/audio/mix/）。先に voice synth。ミックスの前後に、段の記録（.work/state/mix/）も書く | `npm run mix` |
| `render [動画…] [--course <ID>] [--video <形>] [--lang <言語>] [--captions] [--jobs <数>] [--chunk <枚数>]` | 動画とポスター（バンドルは 1 回だけ作る）。掛け合いの講座（cast のある講座）は、字幕を焼き込んだ版も作る（--captions で全部の動画）。書き出しの前後に、段の記録（.work/state/render/）も書く。--dry-run は書き出すものを出すだけ | `npm run render`・`bun scripts/stages/video/render.ts` |
| `stills [動画[:場面,…]・動画@フレーム…] [--course <ID>] [--video <形>] [--lang <言語>] [--mid] [--theme <ID>] [--captions] [--scale <倍>]` | 確かめるための静止画（out/stills/） | `npm run stills` |
| `export [動画…] [--course <ID>] [--video <形>] [--lang <言語>]` | 章ごとの完成動画・字幕・音・教材と声のクレジットを out/deliverables/ にまとめる（要るファイルが欠けていたら、何も書かずに止める） | `bun scripts/export_deliverables.ts` |
| `docs build [--course <ID>] [--check]` | 読む教材（docs/courses/）を台本と timeline から作る。--check は書かずに、ずれだけを見る | `npm run build:materials`・`npm run check:materials` |
| `materials pull [--course <ID>] [--videos]` | 素材（台詞の声は共有のキャッシュへ。BGM・効果音）を取り出す。--videos は Releases の動画も | `npm run materials:pull` |
| `materials check [--course <ID>]` | 台本の全部の台詞の声と、BGM・効果音が手元にあるか | `npm run materials:check` |
| `materials push [--dry-run] [--message <文>]` | 手元の素材を素材のブランチに足す（消さない）。--dry-run は本数だけを出す | `npm run materials:push` |
| `materials gc [--keep <ref>…] [--confirm]` | 台本が使わない台詞の声を一覧にする（--confirm のときだけ消す。持ち主だけ） | `bun scripts/materials.ts gc` |
| `media pull [--course <ID>]` | Releases の日本語の動画を site/media/ に取り出す（手元の動画は上書きしない） | `bun scripts/media.ts pull` |
| `media check` | 動画の一覧・Releases・手元の動画を照らし合わせる | `npm run media:check` |
| `media push --course <ID> [--lang <言語>]` | その講座の動画を Releases に置き、その講座の動画の一覧だけを書き換える | `npm run media:push` |
| `site build [--course <ID>] [--strict]` | 講座サイト（site/dist）を組み立てる。--strict は公開と同じ確かめ方（gh の認証が要る） | `npm run build:site` |
| `site serve [--port <番号>]` | 手元で講座サイトを見る（既定 http://127.0.0.1:8765/。Range にも答える） | `npm run serve` |
| `site check [フォルダ]` | 組み立てた公開物（既定 site/dist）・公開の手順・Worker の設定を確かめる | `bun scripts/check_delivery.ts` |
| `publish verify [origin]` | 公開したサイト（既定 https://chalkfile.com/）のトップと、全部の動画の Range を確かめる | `bun scripts/verify_public.ts` |
| `check overlap --course <ID> [--lang <言語>] [--query <q>] [--min <字>] [--min-words <語>] [--refresh]` | 台本と出典の公式ページで、言い回しが続けて同じところを探す（ネットにつなぐ） | `bun scripts/check_overlap.ts` |
| `legacy pages-migrate [--confirm <SHA>]` | 旧 Pages を移行の案内に置き換える（持ち主だけ。既定は下見だけ） | `bash scripts/legacy/deploy_pages.sh` |
| `ci cloudflare-setup plan\|apply` | 本番の公開の初回の設定（持ち主だけ。plan は何をするかを出すだけ） | `bun scripts/setup_cloudflare_ci.ts` |

<!-- cli:end -->

## 道具の役割

| 道具 | 役割 |
|---|---|
| npm | 依存を入れる（`npm ci --ignore-scripts`）・`package-lock.json`・コマンドの入口（`npm run …`） |
| bun | TypeScript のスクリプト（合成・動画の書き出し・教材・サイト・点検）と単体テスト。書き出しは `@remotion/renderer` を bun から呼ぶ（[ADR](../adr/2026-11-04-render-with-remotion-renderer.md)） |
| node | Remotion の静止画（`stills.ts`）と Studio、Playwright（ブラウザのテスト） |
| uv | Python（BGM・効果音・音のミックス、Kokoro・Whisper） |

npm で入れて bun で動かす理由は [ADR](../adr/2026-11-02-npm-install-bun-run.md)。

## npm run

旧コマンドの表・`docs/history/`・ADR にある以前のコマンドは、互換の案内と当時の記録として残す。今流すときは、この文書の `npm run` の入口を使う。

### 確かめる

| コマンド | すること |
|---|---|
| `npm run check` | lint・型・単体テスト・台本の検証・台本とファイルの点検・文書の点検・教材のずれを順に流す（CI と同じ。動画なしで流せる） |
| `npm run lint` | Biome の lint・整形・import の並べ替え（TS・TSX・JSON） |
| `npm run format` | TS・TSX・JSON の整形・import の並べ替えと lint の安全な直し |
| `npm run format:py` | Python の整形（固定版の ruff） |
| `npm run format:py:check` | Python の整形を確かめる（CI と同じ） |
| `npm run snapshots:update` | 動画を足したとき、音声の鍵と読みのスナップショットを更新する |
| `npm run media:pull -- [講座 ID…]` | 動画の一覧にある動画を Releases から取り出す |
| `npm run deploy:worker -- <引数>` | 公開後確認と戻しを含む配信の道具。手元は preview の drill だけ（持ち主）。本番は main の Actions だけ |
| `npm run verify:production -- <mode>` | 本番の保存・更新・通信なしの再起動を、認証情報の無い専用 profile で確かめる。前提と mode は [公開の順番](../operations/publish.md) |
| `npm run measure:production` | 自分の確認用ヘッダーが付いた要求を Cloudflare 側で測る。権限と副作用は [chalkfile-engine](../../.claude/skills/chalkfile-engine/SKILL.md) |
| `npm run verify:safari -- <引数>` | Safari の実再生・保存を確かめる。OS の認可や Wi-Fi 操作を伴う前提は [chalkfile-engine](../../.claude/skills/chalkfile-engine/SKILL.md) |
| `npm run lint:py` | ruff の lint（`scripts/*.py`。uv が要る） |
| `npm run lint:sh` | shellcheck（`*.sh`。shellcheck が要る） |
| `npm run knip` | 使っていないファイル・export・依存の一覧 |
| `npm run typecheck` | tsc（動画と台本・サイト・Worker・scripts・tests・tools/verify） |
| `npm test` | 単体テスト（`tests/unit/*.test.ts`）。音声の鍵と読みのスナップショットも照らし合わせる |
| `npm run test:e2e:ci` | ブラウザのテストを、合成の講座（`tests/fixtures/content/site-sample`）で流す。本物の講座も動画も要らない（ffmpeg が要る）。CI の e2e と同じ |
| `npm run test:e2e:real` | ブラウザのテストを、本物の講座（`site/dist` と手元の動画）と入れてある Chrome で流す |
| `npm run verify:site -- [BASE_URL]` | CI と canary 共通の Playwright project（`smoke`）。起動済みのサイトの全ページ・CSP・SW scope を確かめる。BASE_URL は環境変数でも渡せる。証跡は `.work/evidence/site-smoke.json` と `site-smoke-results/` |
| `npm run test:e2e`（`test:browser` も同じ） | ci と real の両方（[公開の順番](../operations/publish.md) の「サイトと Worker を変えたとき」） |
| `npm run validate` | 台本の検証（矢印の行き先・`at` の範囲・表の幅・注の位置・テーマ・効果音・声・訳の重ね方など）。注意も見るなら `-- --warnings` |
| `npm run reading:diff` | 全部の台詞の読みを main と比べ、変わった台詞と動画を出す（`-- --base <ref>`。PR の CI で流すときは、マージの commit の 1 つ目の親 `HEAD^1`）。公開する言語の公開中の動画で読みが変わったのに、動画を作り直していなければ止める |
| `npm run i18n -- status`・`try`・`stamp`・`restamp`・`scaffold` | 訳の状態・講座に並べる前の訳の確かめ・訳したときの台本の指紋・訳のひな形（下の「多言語の動画を作る」） |
| `npm run check:content` | 台本と Git に入れるファイルの点検（点検の点検も）。点検する中身は [safety.md](../../.claude/skills/study-video-course/references/safety.md) |
| `npm run check:materials` | 読む教材（`docs/courses/`）が、Git に入れている台本と timeline から作り直したものと同じか（書かない。synth は要らない） |
| `npm run check:docs` | 文書の相対リンクとアンカー・スキルの説明の長さ・古い言葉・一覧の食い違い・生成した表（README の講座の表・頭文字の表）のずれ |
| `npm run music:verify` | BGM・ジングル・効果音を一時フォルダに作り直し、素材（手元の `origin/materials`）の `SHA256SUMS` と同じバイト列かを確かめる。`public/audio/` には書かない。uv が要り、15 秒ほどかかる。CI では流さない |

### 整える

| コマンド | すること |
|---|---|
| `npm run format:new` | 新しく足したファイルだけを Biome で整える（CI は、足したファイルの整形を見る） |
| `npm run format` | 全体を整える。開いている講座の PR が 0 の日に 1 回だけ流すので、それまで流さない |

### 作る

| コマンド | すること |
|---|---|
| `npm run build:music` | BGM・ジングル・効果音（`public/audio/`。合成のコードは `scripts/audio/music/`）。書いたあと ffmpeg で音の大きさを測って目標と比べる（`-- --skip-verify` で省く）。`-- --only <名前>` で効果音を 1 つだけ書き出す |
| `npm run synth` | 声と時刻（声は共有のキャッシュ `~/.cache/chalkfile/tts/`、時刻は `content/<講座>/generated/timeline/`、ほかは `.work/`・`site/data/`）。`-- --cached-only` で素材の声だけを使う。`-- --cached-only --durations-only` で素材ブランチの長さの一覧と読みだけを使う（音声を取り出さない。mix と render の前には `materials:pull` が要る）。`-- --course <講座 ID>` でその講座の全部の言語、`-- --prune` で台本に無い動画の timeline を消す、`-- -v` で声の見つけ方と VOICEVOX への問い合わせも出す |
| `npm run mix` | 音のミックス（`public/audio/mix/`）。中は `npm run chalk -- mix` と同じで、選ばなければ公開する言語の全部の動画（`-- L01 S01.en`・`-- --course <講座 ID>` で選ぶ）。始める前に、設計図の形と、要る声・BGM・効果音がそろっているかを見る |
| `npm run render` | 動画（`site/media/`）とポスター（公開する言語の動画は `content/<講座>/generated/posters/`）。中は `npm run chalk -- render` と同じで、選ばなければ公開する言語の全部の動画。掛け合いの講座は字幕を焼き込んだ版も作る（`-- --captions` か `CAPTIONS=1` で全部、`CAPTIONS=0` で作らない）。`-- --chunk 1200`（`CHUNK=1200`）で分けて書き出し、`-- --jobs <数>`（`CONCURRENCY=<数>`）で並列の数を変える。設定は `scripts/stages/video/render.config.ts` |
| `npm run fonts` | 書体のサブセット（`engine/fonts/`）を、台本の全部の文字で作り直す。台本に新しい文字を足したら流して commit する。元の書体は google/fonts の固定した commit から取り、共有のキャッシュ `~/.cache/chalkfile/fonts/` に置く（uv と、初回だけネットが要る）。`-- --check` で確かめるだけ（`npm run validate` も同じものを見る） |
| `npm run stills` | 静止画（`out/stills/`）。`-- L04:3 --mid`・`-- L04@120`・`--theme=<id>`・`--captions`。動画・場面・フレームの形と範囲は、バンドルを作る前に確かめる（timeline の無い動画は止める） |
| `npm run stills:compare` | 基準の版と今の版の静止画を比べる（`-- --base origin/main`。結果は `.work/stills-compare/report.md`） |
| `npm run studio` | Remotion Studio（音なしで場面を見る） |
| `npm run build:materials` | 読む教材・絵コンテ・AI チャット用のチャンク（`docs/courses/`）。時刻は Git に入れている timeline から読む。消した章の古いファイルも消す |
| `npm run build:site` | 講座サイト（`site/dist`）。`-- --strict` で公開と同じ確かめ方（gh の認証が要る） |
| `npm run gen` | 講座のフォルダから全体の生成物を作る: Worker の許可リスト（`worker/src/generated/media-manifest.json`。Git に入れない）・README の講座の表・[new-course.md](new-course.md) の頭文字の表・Python の道具が読む JSON（効果音の一覧 `scripts/audio/sfx.json` は `engine/core/sfx.ts` から、動画の値 `scripts/audio/video_config.json` は `engine/core/video-config.ts` から。どちらも Git に入れる）。`-- --check` でずれだけを見る、`-- --media` で Worker の許可リストだけ |

### 見る

| コマンド | すること |
|---|---|
| `npm run serve` | 手元で講座サイトを見る（`http://127.0.0.1:8765/`。Range にも答える。配り方は本番に合わせる: 無いページは 404.html） |
| `npm run dev:worker` | Worker を手元で動かす（先に Worker の許可リストを作ってから `wrangler dev`。Cloudflare の認証は要らない） |

### 素材と動画

| コマンド | すること |
|---|---|
| `npm run materials:pull` | 素材を取り出す。台詞の声は作業フォルダの間で共有のキャッシュ（`CHALKFILE_CACHE_DIR`。既定 `~/.cache/chalkfile/tts/`）に置き、同じ中身があれば取り出さない（`-- --videos` で Releases の動画も） |
| `npm run materials:check` | 台本の全部の台詞の声（共有のキャッシュか `.work/tts`）と、BGM・効果音が手元にあるか |
| `npm run materials:push` | 素材を素材ブランチに足す（消さない。台詞の長さの一覧 `DURATIONS.json` も書く。`-- --dry-run` で本数だけを見る） |
| `npm run media:push -- --course <講座 ID>` | その講座の動画を Releases に置き、その講座の動画の一覧（`content/<講座>/generated/media.<言語>.json`）だけを書き換える。訳の動画は `--lang en` も付ける |
| `npm run media:check` | 動画の一覧・Releases・手元の動画を照らし合わせる |

### 作業フォルダ

| コマンド | すること |
|---|---|
| `npm run worktree:new -- <type>/<slug>` | 新しい作業フォルダ（git worktree）を作る。origin/main から branch と隣の `../chalkfile-<slug>` を作り、node_modules を複製して（APFS。ほかは `npm ci --ignore-scripts`）、素材を取り出す（1 分ほど）。`-- --dry-run` で何をするかだけを出す |
| `npm run clean` | 作り直せる生成物（`out/`・`public/audio/mix/`・`site/dist/`・段の記録 `.work/state/`・書き出しの一時フォルダ `.work/render-tmp/`）を消す。`-- --cache` で共有のキャッシュの台詞の声も消す（ほかの作業フォルダも使う）。`-- --dry-run` で消すものと大きさだけを出す |

## npm run に無いもの

| コマンド | すること |
|---|---|
| `npm run media:pull -- [講座 ID…]` | Releases の動画を取り出す（手元の動画は上書きしない） |
| `npm run chalk -- materials gc [--keep <ref>…] [--confirm]` | 台本が使わない声を消す。持ち主だけ（[戻し方](../operations/recovery.md) の「素材を片付ける」） |
| `npm run chalk -- voice speech-check <key…>` | 訳の声を Whisper で聞き取り直す |
| `npm run chalk -- check overlap --course <講座 ID>` | 台本と出典の公式ページで、言い回しが続けて同じところを探す（ネットにつなぐ。`--query=locale=ja-JP`・`--lang=en`） |
| `bun scripts/snapshots.ts`（`--update`） | 音声の鍵と読みのスナップショットと比べる（作り直す） |
| `npm run chalk -- export <ID…>` | 章ごとの完成動画・字幕・音・教材と、その動画で使った全部の声のクレジット（README）を `out/deliverables/` にまとめる。要るファイルが欠けていたら、何も書かずに、欠けたものと作り方を出して止める（終了コード 3） |
| `npm run chalk -- site check site/dist` | 公開物の点検（秘密情報・MP4・大きさ） |
| `npm run verify:worker -- [URL]` | 手元の Worker の smoke（[公開の順番](../operations/publish.md) の「手元の Worker で確かめる」） |
| `npm run chalk -- publish verify` | 公開したサイトのトップと、全部の動画の Range |
| `npm run chalk -- ci cloudflare-setup plan`・`apply` | 初回の設定。持ち主だけ（[初回の設定](../operations/setup.md)） |
| `npm run chalk -- legacy pages-migrate` | 旧 Pages を移行の案内に置き換える。持ち主だけ。ふだんの公開には使わない |

## 部分だけ作り直す・確かめる

- 一部だけ: `npm run synth -- L03 L05`（mix・render も同じ）。訳の動画は `S03.en` のように、まとめて `'S03.*'`・`'*.en'` も渡せる
- 古くなったものだけ: `npm run chalk -- status` で段ごとの古い単位を見て、`npm run chalk -- build --to <段>` で前の段から順に流す（段と記録は [全体図](../architecture/overview.md) の「段と記録」、流し方は [公開の順番](../operations/publish.md) の「段の状態を見て、古い段だけを流す」）
- 場面だけ見たいとき: `npm run studio`（音なしで場面を確かめられる。timeline（`content/<講座>/generated/timeline/`）は Git に入っている）
- 読み: synth が `.work/kana/<ID>.txt` に台詞ごとの読み（カナ）を書く。誤読は講座の辞書 `content/<講座>/reading.ts` に足す（どの講座でも同じ読みにしたい語だけ共通の `engine/core/reading.ts`）
- 音声の鍵と読みの網: `npm test` が、全部の台詞の音声の鍵・読み（と、訳がある動画の訳の指紋）を、`tests/fixtures/snapshots/`（動画 1 本に 1 ファイル）と照らし、変わった動画と台詞を出す。台詞・読みの辞書・声をわざと変えたときや、動画を足したときは `npm run snapshots:update` で作り直し、PR に「合成し直しが要る」と書く（[説明](../../tests/fixtures/snapshots/README.md)）
- 見た目: `npm run stills -- L04:3 --mid`（場面の中ほどと終わりを静止画にする）
- 公式ドキュメントとの突き合わせ: `npm run chalk -- check overlap --course stripe-billing --query=locale=ja-JP`
- ディスクの空きが少ないとき: `npm run render -- L04 --chunk 1200`（1,200 フレームずつ書き出してつなぐ。`CHUNK=1200` も同じ）

## 多言語の動画を作る

```bash
npm run i18n -- scaffold S03.en                    # 訳のひな形（日本語を注釈に入れたもの）を content/<講座>/en/S03.ts に作る
npm run i18n -- try superagent-comedy en S03       # 訳のファイルを 1 本だけ確かめる（重ね方・訳し残し・点検・長さ）
npm run i18n -- stamp 'S03.*'                      # 訳したときの日本語の台本の指紋を書く
npm run synth -- S03.en S03.zh                     # 声と時刻（足りない台詞は Kokoro でまとめて読む。初回はモデルを取ってくる）
npm run chalk -- voice speech-check S03.en S03.zh   # 聞き取りの点検
npm run mix -- S03.en S03.zh
npm run render -- S03.en S03.zh                   # 掛け合いの講座は、字幕を焼き込んだ版も作る（ほかの講座で作るなら --captions）
npm run build:site
npm run i18n -- status                             # 訳の表（訳あり・日本語の台本が変わった・未訳）と訳し残し
```

- 書き方・声・確かめ方は [i18n.md](../../.claude/skills/study-video-course/references/i18n.md)。訳の動画の名前は `S01.en.mp4`・`S01.en.cc.mp4`（字幕を焼き込んだ版）・`S01.zh.mp4`。Remotion のコンポジションは `S01-en`
- 訳のサイトは `/en/<講座 ID>/`・`/zh/<講座 ID>/` にできる。サイトに出す言語は `chalkfile.config.ts` の `publishLangs` が決める

## ポート

| 何 | 番号 | 変え方 |
|---|---|---|
| 講座サイト（`npm run serve`） | 8765（使っていれば、空いている番号にして URL を出す） | `PORT=9000 npm run serve` |
| Remotion Studio（`npm run studio`） | 3000 | `npm run studio -- --port 3001` |
| Worker（`npm run dev:worker`） | 8787 | `npm run dev:worker -- --port 8788` |
| ブラウザのテスト（`npm run test:e2e:ci` など） | 空いている番号（テストのサーバーと、テストごとのサイト。URL を出す） | `PW_PORT=9100 npm run test:e2e:ci`（テストのサーバーの番号）。作業フォルダが違えば、同時に流せる |

- Claude Code のプレビュー（`.claude/launch.json`）は、`site`（8765）・`studio`（3000）・`worker`（8787）を、`npm run serve`・`npm run studio -- --port <番号>`・`npm run dev:worker -- --port <番号>` で起動する（npx は手元に無い依存を取ってくるので使わない）。`worker` は `site/dist` を配るので、先に `npm run build:site` を流す。起動してよいコマンドと、その scripts の中身は `scripts/check_content.ts` の一覧で決めている（[safety.md](../../.claude/skills/study-video-course/references/safety.md) の 6）
- 証跡: ブラウザのテストは、作業フォルダの `.work/evidence/browser/<project>/` に書く（`CHALKFILE_EVIDENCE_DIR` で変える。同じ作業フォルダで 2 つ同時に流すときは、別の場所にする）。本番の確かめは `.work/evidence/` に書く。どちらも Git に入れない
