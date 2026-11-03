# コマンド

コマンドの入口は `package.json` の `scripts`（`npm run` だけを流すと一覧が出る）。引数は `--` のあとに渡す（`npm run synth -- L03 L05`）。

- 下の表は、`package.json` の `scripts` を写したもの。あとで、コマンドの説明から作る予定。それまでは、scripts を変える PR でこの表も直す
- 作り直しの流れは [quickstart.md](quickstart.md)、公開の順番は [公開の順番](../operations/publish.md)

## 道具の役割

| 道具 | 役割 |
|---|---|
| npm | 依存を入れる（`npm ci --ignore-scripts`）・`package-lock.json`・コマンドの入口（`npm run …`） |
| bun | TypeScript のスクリプト（合成・教材・サイト・点検）と単体テスト |
| node | Remotion（書き出し・静止画・Studio）と Playwright（ブラウザのテスト） |
| uv | Python（BGM・効果音・音のミックス、Kokoro・Whisper） |

npm で入れて bun で動かす理由は [ADR](../adr/2026-11-02-npm-install-bun-run.md)。

## npm run

### 確かめる

| コマンド | すること |
|---|---|
| `npm run check` | lint・型・単体テスト・台本の検証・台本とファイルの点検・文書の点検を順に流す（CI と同じ。動画なしで流せる） |
| `npm run lint` | Biome の lint（TS・TSX・JSON） |
| `npm run lint:py` | ruff の lint（`scripts/*.py`。uv が要る） |
| `npm run lint:sh` | shellcheck（`*.sh`。shellcheck が要る） |
| `npm run knip` | 使っていないファイル・export・依存の一覧 |
| `npm run typecheck` | tsc（動画と台本・サイト・Worker・scripts・tests） |
| `npm test` | 単体テスト（`tests/*.test.ts`）。音声の鍵と読みのスナップショットも照らし合わせる |
| `npm run test:e2e`（`test:browser` も同じ） | Playwright のブラウザのテスト（[公開の順番](../operations/publish.md) の「サイトと Worker を変えたとき」） |
| `npm run validate` | 台本の検証（矢印の行き先・`at` の範囲・表の幅・注の位置・テーマ・効果音・声など）。注意も見るなら `-- --warnings` |
| `npm run check:content` | 台本と Git に入れるファイルの点検（点検の点検も）。点検する中身は [safety.md](../../.claude/skills/study-video-course/references/safety.md) |
| `npm run check:docs` | 文書の相対リンクとアンカー・スキルの説明の長さ・古い言葉・一覧の食い違い |
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
| `npm run synth` | 声と時刻（`src/generated/`・`.work/`・`site/data/`）。`-- --cached-only` で素材の声だけを使う |
| `npm run mix` | 音のミックス（`public/audio/mix/`） |
| `npm run render` | 動画（`site/media/`・`site/posters/`）。`CAPTIONS=1` で字幕を焼き込んだ版も、`CHUNK=1200` で分けて書き出し、`CONCURRENCY=<数>` で並列の数を変える |
| `npm run stills` | 静止画（`out/stills/`）。`-- L04:3 --mid`・`--theme=<id>`・`--captions` |
| `npm run stills:compare` | 基準の版と今の版の静止画を比べる（`-- --base origin/main`。結果は `.work/stills-compare/report.md`） |
| `npm run studio` | Remotion Studio（音なしで場面を見る） |
| `npm run build:materials` | 読む教材・絵コンテ・AI チャット用のチャンク（`docs/courses/`） |
| `npm run build:site` | 講座サイト（`site/dist`）。`-- --strict` で公開と同じ確かめ方（gh の認証が要る） |

### 見る

| コマンド | すること |
|---|---|
| `npm run serve` | 手元で講座サイトを見る（`http://127.0.0.1:8765/`。Range にも答える） |
| `npm run dev:worker` | Worker を手元で動かす（`wrangler dev`。Cloudflare の認証は要らない） |

### 素材と動画

| コマンド | すること |
|---|---|
| `npm run materials:pull` | 素材を取り出す（`-- --videos` で Releases の動画も） |
| `npm run materials:check` | 台本の全部の台詞の声と、BGM・効果音が手元にあるか |
| `npm run materials:push` | 素材を素材ブランチに足す（消さない。`-- --dry-run` で本数だけを見る） |
| `npm run media:push` | 日本語の動画を Releases に置き、動画の一覧を書き換える |
| `npm run media:check` | 動画の一覧・Releases・手元の動画を照らし合わせる |

## npm run に無いもの

| コマンド | すること |
|---|---|
| `bun scripts/media.ts pull [講座 ID…]` | Releases の動画を取り出す（手元の動画は上書きしない） |
| `bun scripts/materials.ts gc [--keep <ref>…] [--confirm]` | 台本が使わない声を消す。持ち主だけ（[戻し方](../operations/recovery.md) の「素材を片付ける」） |
| `bun scripts/i18n.ts status`・`try`・`stamp` | 訳の状態・講座に並べる前の訳の確かめ・訳したときの台本の指紋（下の「多言語の動画を作る」） |
| `uv run --locked --script scripts/check_speech.py <key…>` | 訳の声を Whisper で聞き取り直す |
| `bun scripts/check_overlap.ts <講座 ID>` | 台本と出典の公式ページで、言い回しが続けて同じところを探す（ネットにつなぐ。`--query=locale=ja-JP`・`--lang=en`） |
| `bun scripts/snapshots.ts`（`--update`） | 音声の鍵と読みのスナップショットと比べる（作り直す） |
| `bun scripts/export_deliverables.ts <ID…>` | 章ごとの完成動画・字幕・音・教材を `out/deliverables/` にまとめる |
| `bun scripts/check_delivery.ts site/dist` | 公開物の点検（秘密情報・MP4・大きさ） |
| `bun scripts/smoke_worker.ts [URL]` | 手元の Worker の smoke（[公開の順番](../operations/publish.md) の「手元の Worker で確かめる」） |
| `bun scripts/verify_public.ts` | 公開したサイトのトップと、全部の動画の Range |
| `bun scripts/setup_cloudflare_ci.ts plan`・`apply` | 初回の設定。持ち主だけ（[初回の設定](../operations/setup.md)） |
| `bash scripts/legacy/deploy_pages.sh` | 旧 Pages を移行の案内に置き換える。持ち主だけ。ふだんの公開には使わない |

## 部分だけ作り直す・確かめる

- 一部だけ: `npm run synth -- L03 L05`（mix・render も同じ）。訳の動画は `S03.en` のように、まとめて `'S03.*'`・`'*.en'` も渡せる
- 場面だけ見たいとき: `npm run studio`（音なしで場面を確かめられる。`src/generated/timeline.json` は Git に入っている）
- 読み: synth が `.work/kana/<ID>.txt` に台詞ごとの読み（カナ）を書く。誤読は `content/reading.ts` に足す
- 音声の鍵と読みの網: `npm test` が、全部の台詞の音声の鍵・読み（と、訳がある動画の訳の指紋）を、`tests/fixtures/snapshots/`（動画 1 本に 1 ファイル）と照らし、変わった動画と台詞を出す。台詞・`reading.ts`・声をわざと変えたときや、動画を足したときは `bun scripts/snapshots.ts --update` で作り直し、PR に「合成し直しが要る」と書く（[説明](../../tests/fixtures/snapshots/README.md)）
- 見た目: `npm run stills -- L04:3 --mid`（場面の中ほどと終わりを静止画にする）
- 公式ドキュメントとの突き合わせ: `bun scripts/check_overlap.ts stripe-billing --query=locale=ja-JP`
- ディスクの空きが少ないとき: `CHUNK=1200 npm run render -- L04`（1,200 フレームずつ書き出してつなぐ）

## 多言語の動画を作る

```bash
bun scripts/i18n.ts try superagent-comedy en S03   # 訳のファイルを 1 本だけ確かめる（重ね方・訳し残し・点検・長さ）
bun scripts/i18n.ts stamp 'S03.*'                  # 訳したときの日本語の台本の指紋を書く
npm run synth -- S03.en S03.zh                     # 声と時刻（足りない台詞は Kokoro でまとめて読む。初回はモデルを取ってくる）
uv run --locked --script scripts/check_speech.py S03.en S03.zh   # 聞き取りの点検
npm run mix -- S03.en S03.zh
CAPTIONS=1 npm run render -- S03.en S03.zh
npm run build:site
bun scripts/i18n.ts status                         # 訳の表（訳あり・日本語の台本が変わった・未訳）と訳し残し
```

- 書き方・声・確かめ方は [i18n.md](../../.claude/skills/study-video-course/references/i18n.md)。訳の動画の名前は `S01.en.mp4`・`S01.en.cc.mp4`（字幕を焼き込んだ版）・`S01.zh.mp4`。Remotion のコンポジションは `S01-en`
- 訳のサイトは `/en/<講座 ID>/`・`/zh/<講座 ID>/` にできる。サイトに出す言語は `site/config.json` の `publishLangs` が決める

## ポート

| 何 | 番号 | 変え方 |
|---|---|---|
| 講座サイト（`npm run serve`） | 8765 | `PORT=9000 npm run serve` |
| Remotion Studio（`npm run studio`） | 3000 | `npm run studio -- --port 3001` |
| Worker（`npm run dev:worker`） | 8787 | `npm run dev:worker -- --port 8788` |
| ブラウザのテスト（`npm run test:e2e`） | 8877 | `playwright.config.ts` と `tests/browser-server.ts` で決めている。作業フォルダが違っても、同時に 2 つ流さない |

- Claude Code のプレビュー（`.claude/launch.json`）は、`site`（8765）・`studio`（3000）・`worker`（8787）を起動できる。`worker` は `site/dist` を配るので、先に `npm run build:site` を流す。起動してよいコマンドは `scripts/check_content.ts` の一覧で決めている（[safety.md](../../.claude/skills/study-video-course/references/safety.md) の 6）
- 証跡: ブラウザのテストは `/tmp/chalkfile-pwa-evidence/` に書く（`CHALKFILE_EVIDENCE_DIR` で変える）。本番の確かめは `.work/evidence/` に書く。どちらも Git に入れない
