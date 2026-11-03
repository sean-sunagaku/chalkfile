# 作り方（コマンド・確認・ハマりどころ・公開）

## 動画の配信（Workers / Releases）

動画の制作は手元のMacで行う。`bun scripts/media.ts push` は日本語の通常版と字幕焼込み版をhash付きでReleasesへ置き、全assetを確認してから `site/media-manifest.json` を更新する。`bun scripts/media.ts check` は公開assetの存在・サイズ・提供されたSHA-256、および手元のMP4のSHA-256を照合し、欠けていれば停止する。`push` は既存のhashを上書きせず、古いassetを消さない。mainへ入れるのは小さな一覧とコードだけ。Actionsは読み取りのcheckを行い、動画の作成・uploadは行わない。

公開用パスは `/media/<言語>/<講座>/<ID>[.cc].<SHA-256>.mp4`。上流は固定の `sean-sunagaku/chalkfile` の `media-<言語>-<講座>` タグに限る。手元の入力はrenderの形式に合わせ、日本語が `site/media/<ID>[.cc].mp4`、翻訳は `site/media/<ID>.<言語>[.cc].mp4`。

## 前提

| ツール | 版（置き場所） | 用途 |
|---|---|---|
| Node.js | `.node-version` | Remotion（書き出し・静止画）と Playwright |
| bun | `.bun-version` | synth・build_site・serve・単体テスト |
| Python | `.python-version`（uv が用意する） | mix.py・build_music.py・Kokoro・Whisper |
| uv | `pyproject.toml` の `required-version` | mix.py・build_music.py（numpy・scipy の版は `pyproject.toml` と `uv.lock`） |
| ffmpeg | 8.0 で確かめた | 音と映像の合わせ・ポスター |
| VOICEVOX | 0.25 で確かめた | 日本語の声（エンジンが `127.0.0.1:50021`） |
| Kokoro（`kokoro`・`misaki` の版は `scripts/tts_kokoro.py` の頭と `scripts/tts_kokoro.py.lock`） | Kokoro-82M・v1.1-zh | 英語と中国語の声（`scripts/tts_kokoro.py` を `uv run` が用意する。初回はモデルを取ってくる） |
| Remotion | `package.json`（`remotion` と `@remotion/*`） | 映像 |

VOICEVOX はアプリを開くか、macOS ならエンジンだけを起動する。台詞を変えずに作り直すだけなら、VOICEVOX の代わりに素材を取り出せばよい（下の「素材」）。

```bash
/Applications/VOICEVOX.app/Contents/Resources/vv-engine/run --host 127.0.0.1 --port 50021
curl -s http://127.0.0.1:50021/version
```

## 流れと入出力

| コマンド | 入力 | 出力 |
|---|---|---|
| `npm run gen:video-config` | `src/video.config.ts` | `scripts/audio/video_config.json`（mix.py・build_music.py が読む動画の値。コミットする） |
| `uv run --locked --group audio python scripts/build_music.py` | `scripts/audio/video_config.json` | `public/audio/music/`（BGM・ジングル）、`public/audio/sfx/` |
| `bun scripts/synth.ts [ID…]` | 台本、`reading.ts`（訳は `content/<講座>/<言語>/`） | `.work/tts/`（台詞の声。同じ文と声なら使い回す）、`src/generated/timeline.json`、`.work/plan/`、`.work/kana/`、`site/data/`。訳の動画は `S01.en` のように渡し、足りない台詞は Kokoro でまとめて読む（`.work/speech/<key>.json` も書く） |
| `uv run scripts/check_speech.py <key…>` | `.work/speech/` | 訳の台詞を Whisper で聞き取り直した点検（`.work/speech/<key>.report.txt`） |
| `bun scripts/i18n.ts status`・`try`・`stamp` | 訳のファイル | 訳の表・1 本の訳の確かめ・台本の指紋（[i18n.md](i18n.md)） |
| `uv run --locked --group audio python scripts/mix.py [ID…]` | `.work/plan/`、声、BGM、`scripts/audio/video_config.json` | `public/audio/mix/<id>.wav` |
| `bash scripts/render.sh [ID…]` | `src/`、timeline、mix | `out/master/<id>.mp4`（映像だけ）、`site/media/<id>.mp4`（15MB 以下）・`.jpg`（ポスター） |
| `node scripts/stills.ts <ID>[:場面] [--mid]` | `src/`、timeline | `out/stills/` |
| `bun scripts/build_site.ts [講座 ID] [--strict]` | 台本、`site/data/`、`site/media/`、`site/*.html`、`site/config.json` | `site/dist/` |
| `bun scripts/serve.ts` | `site/dist/` | `http://127.0.0.1:8765/` |
| `bash scripts/legacy/deploy_pages.sh`（旧 Pages の移行の案内のときだけ。講座サイトの公開には使わない） | `site/dist/`（`site/config.json` の `publishLangs` に訳の言語があるときは `site/dist-media/<言語>/` も） | 講座サイトの gh-pages（最新の main からだけ。いまは日本語だけ。訳の公開先は chalkfile.com の Worker に移る（[i18n.md](i18n.md)）） |
| `bun scripts/materials.ts pull [講座 ID…] [--videos]` | `materials` ブランチ（`--videos` は gh-pages も） | `.work/tts/`（WAV と読み）、`public/audio/music/`・`sfx/`（`--videos` は `site/media/`） |
| `bun scripts/materials.ts push [--dry-run]` | 台本、`.work/tts/`、`public/audio/music/`・`sfx/` | `materials` ブランチ（リモートの素材に足すだけ。前の版を親にしたコミット） |
| `bun scripts/materials.ts gc [--keep ref] [--confirm]` | `materials` ブランチ、`--keep` の ref（既定 origin/main）の台本 | 台本が使わない台詞の音声の一覧（`--confirm` のときだけ消して push） |

## 素材（`materials` ブランチ）

VOICEVOX の出力（台詞の声）と BGM・効果音は、生成物でも作り直しに VOICEVOX が要るので、素材だけを置くブランチ `materials` に置く。main の履歴には入れない（動画を gh-pages に置くのと同じ考え方）。

- 中身: `tts/<講座 ID>/<key>.flac`・`.kana`（台本の全部の台詞。`key` は `scripts/voices.ts` の `ttsKey`）、`audio/music/`・`audio/sfx/`（FLAC）、`SHA256SUMS`（WAV に戻した後の中身と読み）、`README.md`
- 取り出す: `bun scripts/materials.ts pull` → `bun scripts/synth.ts` は VOICEVOX につながずに時刻を決める（声のキャッシュが全部当たる）。足りない台詞があると、VOICEVOX に届かないことと `pull` を案内して止まる
- 確かめる: `bun scripts/materials.ts check`（台本の全部の台詞の声が `.work/tts/` に、決まった名前の BGM・効果音が `public/audio/` にあるか）
- 足す: 台詞を直したら、台本をコミット → synth（kana を見る）→ `bun scripts/materials.ts push`。push は足すだけ（リモートの素材に手元の素材を足すか上書きし、手元の台本に無い講座の素材は残す。`--dry-run` で本数を見る）。コミットしていない台本の変更があるときと、HEAD が origin/main を含まないときは止まる。マージで走る公開が素材を取り出すので、PR をマージする前に push する
- 消す: `bun scripts/materials.ts gc` だけ。origin/main（`--keep` で変えられる）の台本が使わない台詞の音声を一覧にし、`--confirm` を付けたときだけ消す（持ち主が流す）
- FLAC は可逆なので、WAV に戻すと VOICEVOX の出力と同じバイトになる（`pull` が `SHA256SUMS` で確かめる）。音声は WAV のままの 3 分の 1 ほど
- push は前の版を親にする（送るのは新しい素材だけで、前の版に戻せる）。gc は親の無い 1 コミットにして、それまでの履歴を切る。消した素材が要るときは、そのときの台本のコミットから VOICEVOX で作り直す

## 確かめ方

- 台本: `bun scripts/validate.ts`（矢印の行き先・at の範囲・表の幅・注の位置・テーマ・効果音・声・派生データの食い違い。誤りがあれば 1 で終わる。注意の一覧は `--warnings`、機械で読むなら `--json`）。synth の最初と Studio でも同じ検証が動き、誤りのある動画は止まる
- 読み: `.work/kana/<id>.txt`
- 見た目: `node scripts/stills.ts L04:3,6 --mid` → `out/stills/` を全部見る。場面の中ほど（要素が出ている途中）と終わり（出そろった状態）の両方
- 長さ: `ffprobe -v error -show_entries format=duration -of csv=p=0 site/media/L04.mp4` が `timeline.json` の `durationInFrames / 30` と合う
- 1 場面だけ見たいとき: `ffmpeg -ss <秒> -i site/media/L04.mp4 -frames:v 1 frame.jpg`
- Remotion Studio: `npx remotion studio`（音つきで見るときは props の `audio` を true）

## ハマりどころ

- **Remotion が public/ を一時フォルダへ複製してディスクを埋める**: 書き出しのたびに `public/`（声で約 1GB）を複製する。映像は無音で書き出すので、`render.sh` と `stills.ts` は空の `.work/render-public` を渡している
- **書き出し中のフレームでディスクが埋まる**: 5 分の動画で 1〜2GB の JPEG を一時フォルダに置く。空きが少ないときは `CHUNK=1200 bash scripts/render.sh L04`（1,200 フレームずつ書き出して最後につなぐ）
- **一時フォルダの `remotion-webpack-bundle-*` をまとめて消さない**: ほかのプロジェクトのものかもしれない。消すなら中身（bundle.js にこの講座の文字があるか）を確かめて 1 つずつ
- **Node.js 26 で Chrome Headless Shell の展開が止まる**: 手で展開して版を書く

  ```bash
  cd node_modules/.remotion/chrome-headless-shell
  rm -rf mac-arm64 && mkdir mac-arm64 && unzip -q chrome-headless-shell-mac-arm64.zip -d mac-arm64
  printf '144.0.7559.20' > VERSION
  ```

- **`python3 -m http.server` では動画の途中に飛べない**: Range（部分取得）に答えないため。手元で見るときは `bun scripts/serve.ts`
- **ブラウザが古い動画を覚えている**: サーバーを替えたり動画を作り直したりした後は、別のポートで開くか、キャッシュを消して確かめる
- **GitHub Pages は同じ持ち主のほかのサイトと localStorage を共有する**: 講座サイトは保存のキーに `chalkfile:<講座 ID>:` を付けている
- **合成し直しの単位**: 声のキャッシュは「読み上げる文と声」で決まる。台詞の表示（`t`）だけ変えても、読み（`s` か `reading.ts` で開いた文）が同じなら作り直さない

## 公開（Workers / Releases）

運用の正本は [../../../../docs/workers-delivery.md](../../../../docs/workers-delivery.md)。動画はMacで `media.ts push/check` を先に行い、mainへ入れる。Actionsは `npm ci --ignore-scripts`、型/単体/安全点検、素材pull、`synth --cached-only`、動画check、strict build、生成物点検、Wrangler、公開後の全動画Range確認の順。Cloudflare secretはDeploy stepだけ。音声・動画が不足したら停止する。

JPGは `site/posters/` の小さな静的入力としてmainに含める。MP4はReleasesにだけ置き、`media.ts pull [講座ID…]` で戻す。従来の `materials.ts pull --videos` もReleasesから取得し、変更済みローカル動画は上書きしない。

手元は `npm run dev:worker` でroot/CSP/scopeを確認。初回試験公開は `wrangler deploy --env preview`、本番は `wrangler deploy --env=""`。Workers Freeを維持する。静的assetsはMP4なし・2万files/25MiB以内。`no-transform` で本文hashとCSPを保つ。

`scripts/legacy/deploy_pages.sh` は旧Pagesを移行案内だけへ置き換える専用手順。最新mainとcleanなcheckout、公開先のRange/CSP検証に通った後、明示した旧SHAに対するforce-with-leaseで置き換える。旧保存cacheは移行SWが保持する。公開と旧Pages切替は本人が依頼した範囲で実行し、許可済み操作を繰り返し確認しない。

## 見た目が変わっていないかを見る（静止画の比較）

見た目を変えないはずの整理の PR（エンジンの部品やテーマの作り方の整理など）では必ず流し、結果（`.work/stills-compare/report.md` の表）を PR に貼る。

```bash
git fetch origin
bun scripts/stills-compare.ts --base origin/main     # 場面の種類ごとに 1 つ（20 場面）× 5 テーマ。1 分ほど
bun scripts/stills-compare.ts L04:3,6 --theme night  # 場面とテーマを絞る（--captions で字幕つきの版を比べる）
```

- 基準の版を一時の worktree に作って同じ静止画（場面の終わり）を書き出し、ffmpeg の PSNR で比べる。同じ絵は inf。45dB（`--threshold`）より低いと「差あり」になり、`.work/stills-compare/diff/` に「基準・今・差を強めた絵」を並べた画像を出して 1 で終わる
- 画像はコミットしない（`.work/` の下）。書体を Google Fonts から読むのでネットが要る。書体・Chrome・ネットに左右されるので、CI では流さなくてよい
