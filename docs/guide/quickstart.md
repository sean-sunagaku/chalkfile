# 始め方（3 通りの作り直し）

clone した手元で、講座の動画とサイトを作り直す。したいことに合わせて、A〜C のどれかを選ぶ。

| したいこと | 選ぶ道 |
|---|---|
| 台詞を書く・直す。新しい講座を作る | [A. VOICEVOX で声から作る](#a-voicevox-で声から作る) |
| 台詞は変えずに、動画を作り直す（画面・テーマ・エンジンを直した） | [B. 素材から作る（VOICEVOX なし）](#b-素材から作るvoicevox-なし) |
| サイト（ページ・保存・Worker）だけを直す。手元でサイトを見る | [C. サイトだけ作る](#c-サイトだけ作る) |

- 講座を足すときのチェックリストは [new-course.md](new-course.md)、コマンドの一覧は [commands.md](commands.md)
- 公開の順番は [公開の順番](../operations/publish.md)、困ったときは [ハマりどころ](../operations/troubleshooting.md)

## 前提の道具

| 道具 | A | B | C | 何に使うか |
|---|---|---|---|---|
| Node.js と npm | 要る | 要る | 要る | 依存を入れる（`npm ci --ignore-scripts`）・Remotion・Playwright |
| bun | 要る | 要る | 要る | TypeScript のスクリプトと単体テスト |
| ffmpeg | 要る | 要る | 要る | 素材の FLAC を WAV に戻す・音と映像を合わせる・ポスター |
| uv | 要る | 要る | — | Python（BGM・効果音・ミックス、英語と中国語の声の Kokoro、聞き取りの Whisper、台本に新しい文字を足したときの書体のサブセット `npm run fonts`）。Python は uv が用意する |
| python3（手元のもの） | 要る | 要る | — | `render.sh` が timeline を読む |
| gh（`gh auth login` 済み） | 要る | 要る | 要る | Releases の動画を取る・置く・照らし合わせる（`media.ts`・`build:site -- --strict`） |
| VOICEVOX（エンジンが `127.0.0.1:50021`） | 要る | — | — | 日本語の声 |
| Chrome（入れてあるもの） | サイトを確かめるとき | サイトを確かめるとき | 要る | ブラウザのテスト（`npm run test:e2e`）と smoke。書き出しの Chrome は Remotion が自分で取ってくる |
| macOS | 確かめた | 確かめた | — | 書き出しは macOS で確かめている。CI（Ubuntu）で流しているのは、C の組み立てまで |

- 版は次のファイルにある（CI も同じファイルを読む）: Node.js は `.node-version`、bun は `.bun-version`、Python は `.python-version`。npm の依存は `package-lock.json`、Python の依存は `pyproject.toml` と `uv.lock`（Kokoro と Whisper は、スクリプトの頭と `scripts/<名前>.py.lock`）。ffmpeg と VOICEVOX の確かめた版は [pipeline.md](../../.claude/skills/study-video-course/references/pipeline.md) の「前提」
- 手元の版は [mise](https://mise.jdx.dev/) でそろえられる（任意）。`mise settings add idiomatic_version_file_enable_tools node`（bun・python も同じように足す）で、上の版のファイルを読むようになる
- 依存は `npm ci --ignore-scripts` で入れる。依存のインストール時スクリプトを動かさない

## A. VOICEVOX で声から作る

VOICEVOX のエンジンを `127.0.0.1:50021` で動かしておく（起動の仕方は [pipeline.md](../../.claude/skills/study-video-course/references/pipeline.md) の「前提」）。

```bash
npm ci --ignore-scripts
npm run build:music        # BGM・効果音（約 13 秒）
npm run synth              # ナレーションと時刻（初回は数分、以後は変えた台詞だけ）
npm run mix                # 音のミックス（1 本 10 秒ほど）
npm run render             # 動画（3〜6 分の動画で 1 本 2〜3 分）
npm run check              # lint・型・単体テスト・台本の検証・台本とファイルの点検・文書の点検（CI と同じ）
npm run build:materials    # 読む教材・絵コンテ・AI チャット用のチャンク（docs/courses/）
npm run build:site         # 講座サイト（site/dist）
npm run serve              # 手元で見る（http://127.0.0.1:8765/）
```

- 一部だけ作り直すときは、`--` のあとにレクチャー ID を渡す（`npm run synth -- L03 L05`。mix・render も同じ）
- 台詞を直したら、synth → mix → render → build:site の順に流す
- 英語と中国語の声は、uv が Kokoro を用意する（初回に Python の道具とモデルの重みを取ってくる）
- 初めての書き出しで止まったら、[ハマりどころ](../operations/troubleshooting.md) の「手元の準備」

## B. 素材から作る（VOICEVOX なし）

台詞の音声（VOICEVOX と Kokoro の出力）と、BGM・ジングル・効果音は、素材だけを置くブランチ [`materials`](https://github.com/sean-sunagaku/chalkfile/tree/materials) にある（音声は FLAC。main の履歴には入れない。[ADR](../adr/2026-10-31-materials-branch.md)）。取り出せば、台詞を変えていない動画は VOICEVOX なしで、動画と講座サイトまで作り直せる。

```bash
npm ci --ignore-scripts
npm run materials:pull                          # 台詞の音声を共有のキャッシュ（~/.cache/chalkfile/tts/）に、BGM・効果音を public/audio/ に取り出す
npm run synth -- --cached-only                  # 声は素材から。足りないと止まる（VOICEVOX・Kokoro につながない）
npm run mix
npm run render                                  # CAPTIONS=1 を付けると、字幕を焼き込んだ版（サイト用の <ID>.cc.mp4）も作る
npm run build:materials && npm run build:site   # 読む教材と講座サイト
```

- `pull` は FLAC を WAV に戻し、ブランチの `SHA256SUMS` と同じ中身かを確かめる。1 つの講座だけなら `bun scripts/materials.ts pull nudge-product`
- 手元の音声が台本に足りているか: `npm run materials:check`（足りない台詞は、VOICEVOX を動かして synth が作る）
- 素材を足すのは [公開の順番](../operations/publish.md) の 4、消すのは持ち主だけ（[戻し方](../operations/recovery.md) の「素材を片付ける」）
- 素材と動画のブランチを持ってこないで clone するとき: `git clone --single-branch https://github.com/sean-sunagaku/chalkfile.git`

## C. サイトだけ作る

```bash
npm ci --ignore-scripts
npm run materials:pull -- --videos      # 素材と、Releases の動画（SHA-256 を確かめて site/media/ に）
npm run synth -- --cached-only          # サイトに出す台本・字幕・時刻（site/data）を、素材の声から作る
npm run build:site                      # site/dist。公開と同じ確かめ方は -- --strict（gh の認証が要る）
npm run serve                           # http://127.0.0.1:8765/（Range にも答える）
```

- ポスターは講座のフォルダの `content/<講座>/generated/posters/` にある（main で追跡している）。動画を見ないなら `--videos` は要らない
- Worker を通して見るときは `npm run dev:worker`（番号は [commands.md](commands.md) の「ポート」）
- サイトや Worker を変えたときの確かめ方は、[公開の順番](../operations/publish.md) の「サイトと Worker を変えたとき」
