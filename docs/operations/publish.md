# 公開の順番

台本・声・動画を変えて、chalkfile.com に出すまでの順番。公開の順番を書くのは、この文書だけにする。ほかの文書は、ここへリンクする。

- 本番に出すのは、main への merge で動く Actions（`.github/workflows/deploy.yml`）だけ。手元から `wrangler deploy` しない。初回の設定と緊急の戻しは、持ち主だけが行う（[初回の設定](setup.md)・[戻し方](recovery.md)）
- main への merge は、本番の公開になる。merge は持ち主が決める
- 言葉の意味は [用語集](../architecture/glossary.md)、置き場所の全体は [全体図](../architecture/overview.md)、配り方の設計は [配信の設計](../architecture/delivery.md)

## 流れ

```text
1 台本を commit → 2 main を取り込む → 3 声と時刻（synth）→ 4 素材を足す（materials push）
→ 5 動画を作る（render）→ 6 動画を Releases に置く（media push・check）→ 7 生成物を commit
→ 8 PR → merge → Actions → 公開後の確認
```

- 声も動画も変えない PR（サイト・Worker・文書・エンジンの整理）は、3〜6 を飛ばす。PR の前の確かめ方は、下の「サイトと Worker を変えたとき」
- 台詞を変えず、図や画面の要素だけを直したときは、3 と 4 は要らない（声が変わらない）

## 1. 台本を commit する

- 台本（`content/<講座 ID>/`）を直したら、先に commit する。`materials push` は、commit していない台本の変更があると止まる

## 2. main を取り込む

```bash
git fetch origin
git merge origin/main
```

- `materials push` は、HEAD が origin/main を含まないと止まる（古い台本の素材を足さないため）
- 生成物がぶつかったら、手で直さない。下の「ぶつかったとき」の手順で作り直す

## 3. 声と時刻を作る（synth）

```bash
npm run synth -- <ID…>        # 例: npm run synth -- G01 G02。訳の動画は G01.en のように渡す
```

- `.work/kana/<ID>.txt` の読みを全部読む。誤読は、台詞の `s` か `content/reading.ts` で直して、もう一度 synth する
- 訳の動画は、`uv run --locked --script scripts/check_speech.py <key…>` で聞き取り直す（[i18n.md](../../.claude/skills/study-video-course/references/i18n.md)）
- 台本の検証（`npm run validate`）は synth の最初にも流れ、誤りのある動画は止まる

## 4. 素材を足す（materials push）

```bash
bun scripts/check_content.ts --require-denylist   # ローカルの禁止語の一覧が無ければ止まる
npm run materials:push -- --dry-run               # 足す・変える・同じ・残す・手元に無いの本数だけを見る
npm run materials:push
```

- push は足すだけ。手元の素材を足すか上書きし、手元の台本に無い講座の素材は消さない。消すのは `bun scripts/materials.ts gc` だけで、持ち主が流す（[戻し方](recovery.md) の「素材を片付ける」）
- **merge より前に** push する。merge で動く Actions は、素材ブランチから声を取り出して時刻を作る。声が足りないと、そこで止まる
- 手元に無い台詞があると、push は止まる。`npm run materials:check` で先に見られる

## 5. 動画を作る（render）

```bash
bun scripts/media.ts pull                  # 手元に無い公開済みの動画を Releases から取る（render より前に流す）
npm run mix -- <ID…>
CAPTIONS=1 npm run render -- <ID…>         # 字幕を焼き込んだ版も作る（お笑い版では必ず）
```

- 6 の `media push` は、全部の講座の日本語の通常版が手元にないと止まる。字幕版は、手元に無いと動画の一覧から外れ、サイトに出なくなる。だから先に `media.ts pull` でそろえる
- `media.ts pull` は、手元の動画が動画の一覧と違うと止まる（上書きしない）。作り直したあとに流すと、作り直した動画で止まる。render より前に流すか、`bun scripts/media.ts pull <講座 ID…>` で作り直していない講座だけを取る
- 書き出したら確かめる。読み・静止画・長さ・サイトの見え方は、スキルの [SKILL.md](../../.claude/skills/study-video-course/SKILL.md) の「5. 確かめる」
- 見直す前の動画を、6 で push しない（置いた時点で、誰でも取れる）

## 6. 動画を Releases に置く（media push・check）

```bash
bun scripts/check_content.ts --require-denylist
npm run media:push
npm run media:check
```

- push は、日本語の動画を講座ごとの Release（タグは `media-ja-<講座 ID>`）に置く。ファイルの名前に SHA-256 が入る。同じハッシュの動画は送り直さない
- 古いハッシュの動画は消さず、動画の一覧（`site/media-manifest.json`）の `retained` に回す（[ADR](../adr/2026-11-02-keep-old-video-hashes.md)）
- push は、ポスター（`site/media/<ID>.jpg`）を `site/posters/` に写し、全部の asset を確かめてから動画の一覧を書き換える
- check は、公開した asset があることと、その大きさと SHA-256、手元の動画の SHA-256 を照らし合わせる
- **動画は merge の前に、公開の Releases に置かれる**。サイトからはまだリンクされないが、置いた時点で誰でも取れる。見直す前の動画を置かない。PR の見直しで直したら、作り直してもう一度 push する（前のハッシュは `retained` に残る）

## 7. 生成物を commit する

| 生成物 | 作るもの |
|---|---|
| `src/generated/timeline.json`・`credits.json`・`lecture-credits.json` | synth |
| `site/posters/<ID>.jpg`・`site/media-manifest.json` | render と `media push` |
| `docs/courses/`（読む教材・AI チャット用のチャンク） | `npm run build:materials` |
| `tests/fixtures/snapshots/`（音声の鍵と読み） | `bun scripts/snapshots.ts --update`。台詞・読み・声を変えたときと、動画を足したとき。PR に「合成し直しが要る」と書く |

```bash
npm run build:materials
npm run check
npm run build:site -- --strict      # merge で動く Actions と同じ組み立て（gh の認証が要る）
```

- merge の前に、手元で `build:site -- --strict` を流す。ポスターや動画の一覧が足りないと、ここで止まる

## 8. PR → merge → Actions → 公開後の確認

- PR は、テンプレート（`.github/pull_request_template.md`）の項目を埋める
- merge すると、Actions（deploy）が次の順に流す。どこかで止まったら、公開しない
  1. `npm ci --ignore-scripts`・型・単体テスト・台本とファイルの点検
  2. 素材ブランチから声を取り出し、`synth --cached-only` で時刻とサイトのデータを作る（声を合成しない）
  3. `media.ts check` で、動画の一覧と Releases を照らし合わせる
  4. `build_site.ts --strict` で組み立て、`check_delivery.ts` で公開物を点検する
  5. `wrangler deploy` で出し、全部の動画の Range を確かめる（`verify_public.ts`）
- 公開の実行は、同じ時に 1 つだけ（あとから来たものは、前のものが終わるのを待つ）
- 止まったら [戻し方](recovery.md) の「Actions を出し直す」

### 公開後の確認

```bash
bun scripts/verify_public.ts                            # トップの 200 と、全部の動画の Range（206）
bun tests/worker-site-smoke.ts https://chalkfile.com/   # 全ページの表示・SW の scope・CSP の違反とエラー（Chrome）
```

- 保存・再起動・再生も見るときは、`bun tests/verify-production.ts offline` のあと、別のプロセスで `bun tests/verify-production.ts offline-restart` を流す。認証情報の無い専用の profile を使う。証跡は `.work/evidence/` に置き、push しない
- 「動画ファイルをダウンロード」のボタンも、1 本だけ確かめる。保存を確かめた一時の profile の cache を残したまま通信を切り、MP4 を 1 本ダウンロードして、名前・大きさ・SHA-256 を照らす
- 手元での成功と、公開したサイトでの成功は、分けて記録する。Chrome での成功を、Safari や iPhone の実機での成功と混ぜない

## サイトと Worker を変えたとき

```bash
npm run check
npm run build:site -- --strict     # site/data・ポスター・Releases の動画の一覧が要る。手元の MP4 はなくてよい
npm run test:e2e                   # 入れてある Chrome と、生成した動画を使う（test:browser と同じ）
```

- テストが使う動画は、`bun scripts/media.ts pull stripe-billing pstack-comedy` で取る
- ブラウザのテストは、`127.0.0.1:8877` に本物の組み立てを配って確かめる: オンラインとオフライン、全部の保存と削除、Range の応答とバイトの一致、動画の再生・停止・途中への移動・繰り返し、ブラウザを閉じてからの起動、教材と worker の更新、保存の欠け。容量の不足は Cache API の例外で、通信の失敗・206・壊れたデータ・途中のデータ・リダイレクト・取り消しは、テストのサーバーで作る。物理のディスクの枯渇や、iPhone の実機の確かめの代わりにはならない
- ブラウザは、入れてある Chrome を一時の profile で使う。`PW_CHANNEL=chromium npm run test:browser` で、Playwright の Chromium も選べる（別に入れる）
- 証跡の既定の置き場所は `/tmp/chalkfile-pwa-evidence/`（`CHALKFILE_EVIDENCE_DIR` で変える）。動画と証跡は main に入れない
- 案内（保存の状態・進み具合・通信のエラー）の表示を変えたら、strict の組み立てのあとに `npm run test:browser -- tests/browser/offline-status.spec.ts` も流す
- ふだんの手元の確かめは、ルート `/` の `npm run serve` か `npm run dev:worker`。旧サイトの scope の互換は、移行のテスト（`tests/browser/migration.spec.ts`）で確かめる。localhost のほかは HTTPS が要る

### 手元の Worker で確かめる（smoke）

`wrangler dev` は手元の workerd で動き、Cloudflare の認証は要らない。www を Host ヘッダーで試すので、`--infer-origin-from-routes=false` を付ける。

```bash
npm run synth -- --cached-only && npm run build:site -- --strict
npx --no-install wrangler dev --ip 127.0.0.1 --port 8787 --infer-origin-from-routes=false   # 別の端末で
bun scripts/smoke_worker.ts http://127.0.0.1:8787/
```

- HTTP では、`site/dist` の全ページの 200 と `no-transform`、`/sw.js` の `no-cache`、知らないページと知らない `/media/` の 404、`/media/` への POST の 405、www（Host ヘッダー）の `/media/` の 301 と HTML の 200 を見る
- ブラウザ（既定は Chrome。`PW_CHANNEL` で変える）では、全ページの表示・SW の scope `/`・CSP の違反とページのエラーが 0 かを見る

## ぶつかったとき

並行の branch で、生成物がぶつかることがある。生成物は手でマージしない。main の側を取り、作り直してから commit する。

| ぶつかったもの | 直し方 |
|---|---|
| `src/generated/`（timeline・クレジット） | `git checkout origin/main -- src/generated/` → `npm run synth -- --cached-only`（全部の動画の時刻を、手元の声から作り直す。ほかの講座の声が手元に無ければ、先に `npm run materials:pull`） |
| `docs/courses/` | `git checkout origin/main -- docs/courses/` → `npm run build:materials` |
| `tests/fixtures/snapshots/` | `git checkout origin/main -- tests/fixtures/snapshots/` → `bun scripts/snapshots.ts --update` |
| `site/media-manifest.json`（動画の一覧） | 下の手順 |

動画の一覧がぶつかったとき:

1. `git checkout origin/main -- site/media-manifest.json`（main の一覧にそろえる）
2. 手元の動画を、main の一覧に合わせる。`bun scripts/media.ts pull <講座 ID…>` に、自分が動画を作り直していない講座を渡す
3. pull が「上書きしません」で止まった動画は、手元の写しが古い。自分が作り直した動画でなければ、`site/media/` のその動画を消してから、もう一度 pull する（Releases から取り直せる写し）
4. `npm run media:push` → `npm run media:check` → commit

- `content/index.ts` の講座の並びと、README の講座の表は生成物ではない。両方の行を残す
