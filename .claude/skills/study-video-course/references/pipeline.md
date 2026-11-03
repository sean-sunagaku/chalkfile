# 作り方（道具の前提・コマンドの入力と出力・確かめ方）

コマンドの一覧と `npm run` の名前は [commands.md](../../../../docs/guide/commands.md)、公開の順番は [公開の順番](../../../../docs/operations/publish.md)、動画の配り方は [配信の設計](../../../../docs/architecture/delivery.md)。ここには、道具の前提・コマンドの入力と出力・確かめ方を書く。

## 前提

道具と版の置き場所（`.node-version`・`.bun-version`・`.python-version`・`package.json`・`pyproject.toml`）と、作業ごとに要る道具は、[始め方](../../../../docs/guide/quickstart.md) の「前提の道具」。ここで確かめた版: ffmpeg 8.0・VOICEVOX 0.25。英語と中国語の声（Kokoro-82M・Kokoro-82M-v1.1-zh）の `kokoro`・`misaki` の版は、`scripts/tts_kokoro.py` の頭と `scripts/tts_kokoro.py.lock` にある（`uv run` が用意し、初回はモデルを取ってくる）。

VOICEVOX はアプリを開くか、macOS ならエンジンだけを起動する。台詞を変えずに作り直すだけなら、VOICEVOX の代わりに素材を取り出せばよい（下の「素材」）。

```bash
/Applications/VOICEVOX.app/Contents/Resources/vv-engine/run --host 127.0.0.1 --port 50021
curl -s http://127.0.0.1:50021/version
```

## 流れと入出力

| コマンド | 入力 | 出力 |
|---|---|---|
| `npm run gen:video-config`（`npm run gen` も作る） | `src/video.config.ts` | `scripts/audio/video_config.json`（mix.py・build_music.py が読む動画の値。コミットする） |
| `uv run --locked --group audio python scripts/build_music.py` | `scripts/audio/music/`（合成のコード）、`scripts/audio/video_config.json`、効果音の一覧 `scripts/audio/sfx.json`（合成する効果音と名前が合うか） | `public/audio/music/`（BGM・ジングル）、`public/audio/sfx/` |
| `uv run --locked --group audio python scripts/build_music.py --check`（`npm run music:verify`） | 合成のコード、手元の `origin/materials` の `SHA256SUMS` | 作り直した WAV が素材と同じバイト列か（`public/audio/` には書かない） |
| `bun scripts/synth.ts [ID…]` | 台本、読みの辞書（共通の `content/reading.ts` と講座の `content/<講座>/reading.ts`。訳は `content/<講座>/<言語>/`） | 共有のキャッシュ `~/.cache/chalkfile/tts/`（台詞の声と読みと声の記録。同じ文と合成のレシピなら使い回す）、`content/<講座>/generated/timeline/<key>.json`（動画ごと。指紋つき）、`.work/plan/`、`.work/kana/`、`site/data/`。訳の動画は `S01.en` のように渡し、足りない台詞は Kokoro でまとめて読む（`.work/speech/<key>.json` も書く）。`--cached-only --durations-only` は素材ブランチの長さの一覧と読みだけで作る（音声は取り出さない） |
| `uv run scripts/check_speech.py <key…>` | `.work/speech/` | 訳の台詞を Whisper で聞き取り直した点検（`.work/speech/<key>.report.txt`） |
| `bun scripts/i18n.ts status`・`try`・`stamp`・`restamp`・`scaffold`（`npm run i18n -- …`） | 訳のファイル | 訳の表・1 本の訳の確かめ・台本の指紋・訳のひな形（[i18n.md](i18n.md)） |
| `uv run --locked --group audio python scripts/mix.py <ID…>`（`npm run mix` は選んだ動画か、公開する言語の全部を渡す） | `.work/plan/`、声、BGM、効果音の一覧 `scripts/audio/sfx.json`、`scripts/audio/video_config.json` | `public/audio/mix/<id>.wav`。始める前に、設計図の形（`scripts/audio/handoff.py`）と、要る声・BGM・効果音がそろっているかを見る |
| `npm run render -- [ID…]`（`bun scripts/stages/video/render.ts`。`npm run chalk -- render` も同じ） | `src/`、timeline、mix | 選んだ動画を 1 回で書き出す（バンドルは 1 回）。`out/master/<id>.mp4`（映像だけ）、`site/media/<id>.mp4`（サイト用。目安は 14,500 KiB。訳は `<ID>.<言語>.mp4`）、ポスター（公開する言語の動画は `content/<講座>/generated/posters/<id>.jpg`。どの動画も写しを `site/media/<id>.jpg`）。掛け合いの講座（`cast` のある講座）は `site/media/<id>.cc.mp4`（サイト用の字幕焼き込み）と `out/captioned/<id>.mp4`（配る用）も（`--captions` か `CAPTIONS=1` で全部の動画）。出力は一時の名前に書き、ffprobe で確かめてから置き換える。設定は `scripts/stages/video/render.config.ts` |
| `node scripts/stills.ts <ID>[:場面] [--mid]` | `src/`、timeline | `out/stills/` |
| `bun scripts/build_site.ts [講座 ID] [--strict]` | 台本、`site/data/`、講座のフォルダのポスターと動画の一覧、`site/*.html`、`site/config.json`（`--strict` は Releases も照らす） | `site/dist/` |
| `bun scripts/serve.ts` | `site/dist/` | `http://127.0.0.1:8765/` |
| `bun scripts/media.ts push --course <講座 ID> [--lang <言語>]`（`npm run media:push`） | `site/media/` のその講座の動画とポスター | GitHub Releases（タグ `media-<言語>-<講座 ID>`。名前に SHA-256 が入る）、その講座の動画の一覧 `content/<講座>/generated/media.<言語>.json` |
| `bun scripts/media.ts pull [講座 ID…]` | 動画の一覧、Releases | `site/media/`（SHA-256 を確かめる。手元の違う動画は上書きしない） |
| `bun scripts/gen.ts`（`npm run gen`） | 講座の登録と、講座のフォルダの動画の一覧・timeline、`content/sfx.ts`、`src/video.config.ts` | Worker の許可リスト `worker/src/generated/media-manifest.json`（Git に入れない）、README の講座の表、new-course.md の頭文字の表、Python の道具が読む `scripts/audio/sfx.json` と `video_config.json`（コミットする） |
| `bash scripts/legacy/deploy_pages.sh`（持ち主だけ。旧 Pages の移行の案内のときだけ） | `site/migration-dist/`（`scripts/build_migration.ts` が作る） | 旧 Pages の `gh-pages` ブランチ（新しいサイトへの案内だけ） |
| `bun scripts/materials.ts pull [講座 ID…] [--videos]` | `materials` ブランチ（`--videos` は Releases の動画も） | `.work/tts/`（WAV と読み）、`public/audio/music/`・`sfx/`（`--videos` は `site/media/`） |
| `bun scripts/materials.ts push [--dry-run]` | 台本、共有のキャッシュか `.work/tts/`、`public/audio/music/`・`sfx/` | `materials` ブランチ（リモートの素材に足すだけ。前の版を親にしたコミット。台詞の長さの一覧 `DURATIONS.json` も WAV から測って書く） |
| `bun scripts/materials.ts gc [--keep ref] [--confirm]` | `materials` ブランチ、`--keep` の ref（既定 origin/main）の台本 | 台本が使わない台詞の音声の一覧（`--confirm` のときだけ消して push） |

## 素材（`materials` ブランチ）

VOICEVOX と Kokoro の出力（台詞の声）と BGM・効果音は、作り直しに VOICEVOX が要るので、素材だけを置くブランチ `materials` に置く。main の履歴には入れない（理由は [ADR](../../../../docs/adr/2026-10-31-materials-branch.md)）。

- 中身: `tts/<講座 ID>/<key>.flac`・`.kana`・`.meta.json`（台本の全部の台詞。`key` は声の鍵で、`scripts/voices.ts` の `ttsKeysIn` が v2（合成のレシピから）→ v1（凍結した前の作り方）の順に探す。`.meta.json` は v2 の鍵で作った声の記録で、合成のレシピとエンジンの版）、`audio/music/`・`audio/sfx/`（FLAC）、`SHA256SUMS`（WAV に戻したあとの中身と読み）、`DURATIONS.json`（台詞の長さと、測った WAV の sha256）、`README.md`
- 取り出す: `npm run materials:pull` → `npm run synth -- --cached-only` は VOICEVOX につながずに時刻を決める。足りない台詞があると、`pull` を案内して止まる。時刻とサイトのデータだけが要るとき（CI）は、`npm run synth -- --cached-only --durations-only` で、長さの一覧と読みだけを取り出して作れる（音声も ffmpeg も要らない。一覧が無い・古いときは、今までどおり音声を取り出す）
- 確かめる: `npm run materials:check`（台本の全部の台詞の声が `.work/tts/` に、決まった名前の BGM・効果音が `public/audio/` にあるか）
- 足す: [公開の順番](../../../../docs/operations/publish.md) の 4（足すだけ。merge より前に）。消すのは `materials.ts gc` だけで、持ち主が流す（[戻し方](../../../../docs/operations/recovery.md) の「素材を片付ける」）
- FLAC は可逆なので、WAV に戻すと VOICEVOX の出力と同じバイトになる（`pull` が `SHA256SUMS` で確かめる）。大きさは WAV のままの 3 分の 1 ほど

## 確かめ方

- 台本: `npm run validate`（矢印の行き先・at の範囲・表の幅・注の位置・テーマ・効果音・声・派生データの食い違い。誤りがあれば 1 で終わる。注意の一覧は `--warnings`、機械で読むなら `--json`）。synth の最初と Studio でも同じ検証が動き、誤りのある動画は止まる。公開で止まること（講座サイトの設定・ID・リンク、教材の ID と参照、公開する言語の全部の動画のポスター `content/<講座>/generated/posters/` と動画の一覧）と、講座のページに出ない声のクレジット（注意）も見る。PR の CI が流すので、ポスターと動画の一覧を入れ忘れた PR はマージの前に止まる
- 読み: `.work/kana/<id>.txt`
- 見た目: `npm run stills -- L04:3,6 --mid` → `out/stills/` を全部見る。場面の中ほど（要素が出ている途中）と終わり（出そろった状態）の両方
- 長さ: `ffprobe -v error -show_entries format=duration -of csv=p=0 site/media/L04.mp4` が `content/stripe-billing/generated/timeline/L04.json` の `durationInFrames / 30` と合う
- 1 場面だけ見たいとき: `ffmpeg -ss <秒> -i site/media/L04.mp4 -frames:v 1 frame.jpg`
- Remotion Studio: `npm run studio`（音つきで見るときは props の `audio` を true）

## ハマりどころ

正本は [troubleshooting.md](../../../../docs/operations/troubleshooting.md)（書き出しでディスクが埋まる・Chrome Headless Shell の展開が止まる・動画の途中に飛べない・合成し直しの単位など）。

## 公開

公開の順番は [公開の順番](../../../../docs/operations/publish.md)、初回の設定は [初回の設定](../../../../docs/operations/setup.md)。ここには写さない。

## 見た目が変わっていないかを見る（静止画の比較）

見た目を変えないはずの整理の PR（エンジンの部品やテーマの作り方の整理など）では必ず流し、結果（`.work/stills-compare/report.md` の表）を PR に貼る。

```bash
git fetch origin
npm run stills:compare -- --base origin/main     # 場面の種類ごとに 1 つ × 全部のテーマ。1 分ほど
npm run stills:compare -- L04:3,6 --theme night  # 場面とテーマを絞る（--captions で字幕つきの版を比べる）
npm run stills:compare -- --base-install --head origin/dependabot/npm_and_yarn/<名前> --out .work/stills-compare/<名前>  # 依存を上げる PR
```

- 基準の版を一時の worktree に作って同じ静止画（場面の終わり）を書き出し、ffmpeg の PSNR で比べる。同じ絵は inf。45dB（`--threshold`）より低いと「差あり」になり、`.work/stills-compare/diff/` に「基準・今・差を強めた絵」を並べた画像を出して 1 で終わる
- 既定では基準の worktree に今の node_modules を写すので、依存の違いは比べられない。依存を上げる PR は `--base-install`（基準で `npm ci --ignore-scripts`）と `--head <ref>`（その ref の一時の worktree で `npm ci --ignore-scripts`）で比べる。どちらの側も、その側の Remotion（bundler・renderer・Chrome Headless Shell）を別のプロセスで使って書き出す（`--out` で結果を分けて残せる）
- 画像はコミットしない（`.work/` の下）。書体を Google Fonts から読むのでネットが要る。書体・Chrome・ネットに左右されるので、CI では流さなくてよい
