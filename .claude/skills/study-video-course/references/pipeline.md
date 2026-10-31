# 作り方（コマンド・確認・ハマりどころ・公開）

## 前提

| ツール | 確かめた版 | 用途 |
|---|---|---|
| Node.js | 26.12 | Remotion |
| bun | 1.3.6 | synth・build_site・serve |
| uv | 0.9 | mix.py・build_music.py（numpy・scipy） |
| ffmpeg | 8.0 | 音と映像の合わせ・ポスター |
| VOICEVOX | 0.25 | 声（エンジンが `127.0.0.1:50021`） |
| Remotion | 4.0.440 | 映像 |

VOICEVOX はアプリを開くか、macOS ならエンジンだけを起動する。台詞を変えずに作り直すだけなら、VOICEVOX の代わりに素材を取り出せばよい（下の「素材」）。

```bash
/Applications/VOICEVOX.app/Contents/Resources/vv-engine/run --host 127.0.0.1 --port 50021
curl -s http://127.0.0.1:50021/version
```

## 流れと入出力

| コマンド | 入力 | 出力 |
|---|---|---|
| `uv run --with numpy --with scipy python scripts/build_music.py` | なし | `public/audio/music/`（BGM・ジングル）、`public/audio/sfx/` |
| `bun scripts/synth.ts [ID…]` | 台本、`reading.ts` | `.work/tts/`（台詞の声。同じ文と声なら使い回す）、`src/generated/timeline.json`、`.work/plan/`、`.work/kana/`、`site/data/` |
| `uv run --with numpy --with scipy python scripts/mix.py [ID…]` | `.work/plan/`、声、BGM | `public/audio/mix/<id>.wav` |
| `bash scripts/render.sh [ID…]` | `src/`、timeline、mix | `out/master/<id>.mp4`（映像だけ）、`site/media/<id>.mp4`（15MB 以下）・`.jpg`（ポスター） |
| `node scripts/stills.mjs <ID>[:場面] [--mid]` | `src/`、timeline | `out/stills/` |
| `bun scripts/build_site.ts [講座 ID] [--strict]` | 台本、`site/data/`、`site/media/`、`site/*.html`、`site/config.json` | `site/dist/` |
| `bun scripts/serve.ts` | `site/dist/` | `http://127.0.0.1:8765/` |
| `bash scripts/deploy_pages.sh` | `site/dist/` | gh-pages ブランチ |
| `bun scripts/materials.ts pull [講座 ID…] [--videos]` | `materials` ブランチ（`--videos` は gh-pages も） | `.work/tts/`（WAV と読み）、`public/audio/music/`・`sfx/`（`--videos` は `site/media/`） |
| `bun scripts/materials.ts push` | 台本、`.work/tts/`、`public/audio/music/`・`sfx/` | `materials` ブランチ（親の無い 1 コミットで置き換える） |

## 素材（`materials` ブランチ）

VOICEVOX の出力（台詞の声）と BGM・効果音は、生成物でも作り直しに VOICEVOX が要るので、素材だけを置くブランチ `materials` に置く。main の履歴には入れない（動画を gh-pages に置くのと同じ考え方）。

- 中身: `tts/<講座 ID>/<key>.flac`・`.kana`（台本の全部の台詞。`key` は `scripts/voices.ts` の `ttsKey`）、`audio/music/`・`audio/sfx/`（FLAC）、`SHA256SUMS`（WAV に戻した後の中身）、`README.md`
- 取り出す: `bun scripts/materials.ts pull` → `bun scripts/synth.ts` は VOICEVOX につながずに時刻を決める（声のキャッシュが全部当たる）。足りない台詞があると、VOICEVOX に届かないことと `pull` を案内して止まる
- 確かめる: `bun scripts/materials.ts check`（台本の全部の台詞の声が `.work/tts/` にあるか）
- 置き換える: 台詞を直したら、台本をコミット → synth（kana を見る）→ `bun scripts/materials.ts push`。コミットしていない台本の変更があると止まる。公開（deploy_pages）と同じ時に置き換えて、公開中の動画と素材をそろえる
- FLAC は可逆なので、WAV に戻すと VOICEVOX の出力と同じバイトになる（`pull` が `SHA256SUMS` で確かめる）。音声は WAV のままの 3 分の 1 ほど
- 前の版は残さない（push のたびに置き換える）。前の素材が要るときは、そのときの台本のコミットから VOICEVOX で作り直す

## 確かめ方

- 読み: `.work/kana/<id>.txt`
- 見た目: `node scripts/stills.mjs L04:3,6 --mid` → `out/stills/` を全部見る。場面の中ほど（要素が出ている途中）と終わり（出そろった状態）の両方
- 長さ: `ffprobe -v error -show_entries format=duration -of csv=p=0 site/media/L04.mp4` が `timeline.json` の `durationInFrames / 30` と合う
- 1 場面だけ見たいとき: `ffmpeg -ss <秒> -i site/media/L04.mp4 -frames:v 1 frame.jpg`
- Remotion Studio: `npx remotion studio`（音つきで見るときは props の `audio` を true）

## ハマりどころ

- **Remotion が public/ を一時フォルダへ複製してディスクを埋める**: 書き出しのたびに `public/`（声で約 1GB）を複製する。映像は無音で書き出すので、`render.sh` と `stills.mjs` は空の `.work/render-public` を渡している
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

## 公開（GitHub Pages）

1. 変更をコミットする（`deploy_pages.sh` はコミットしていない変更があると止まる）
2. `bash scripts/deploy_pages.sh`（`build_site.ts --strict` → `site/dist` を gh-pages に 1 コミットで強制 push）
3. 初回だけ Pages を設定する

   ```bash
   gh api -X POST repos/<owner>/<repo>/pages -f 'source[branch]=gh-pages' -f 'source[path]=/'
   ```

4. 1〜2 分待って確かめる: `curl -sI <baseUrl>` が 200、`<baseUrl><講座 ID>/media/L01.mp4` が `video/mp4`、ブラウザで再生と途中への移動

制限の目安: 動画 1 本 15MB 以下（`render.sh` が画質を自動で下げる）、GitHub のファイルは 1 つ 100MB まで、Pages のサイトは 1GB まで、帯域は月 100GB。
