# 戻し方と作り直し

公開や配信で困ったときの手順。どれも持ち主が行う（Cloudflare か GitHub の権限が要る）。AI は手順を示すまでにし、流すのは持ち主の許可を得てからにする。

- ふだんの順番は [公開の順番](publish.md)、初回の設定は [初回の設定](setup.md)、困ったときの索引は [ハマりどころ](troubleshooting.md)
- 学ぶ人が保存した cache を全部消すことを、戻し方にしない（保存した講座と、学ぶ人の記録が消える）

## サイトを前の版に戻す（Workers の rollback）

公開のあとの確かめが通らないときは、CI の deploy のジョブが自分で前の版に戻す（下の「公開後の確かめが通らず、前の版に戻ったとき」）。ここは、持ち主が手で戻すときの手順。

```bash
npx --no-install wrangler deployments list --env=""                          # 最近の 10 回の公開と、その Version ID
npx --no-install wrangler rollback <Version ID> --env="" --message "<戻す理由>"
```

- 書き方は、`package.json` の Wrangler の版（4.156.1）の `--help` で確かめた（2026-11-03）。版を上げたら、確かめ直す
- Version ID は省かず、`deployments list` で見たものを渡す
- 動画は古いハッシュを消さず `retained` に残しているので、戻したページも同じ動画を指せる（`retained` から外す前なら。[ADR](../adr/2026-11-02-keep-old-video-hashes.md)）
- rollback は一時のしのぎで、次の公開（main への merge）で上書きされる。main を直す PR（revert など）を出し、Actions で出し直す
- 戻したあと、[公開の順番](publish.md) の「公開後の確認」を流す

## 公開後の確かめが通らず、前の版に戻ったとき

CI の deploy のジョブ（`scripts/deploy_worker.ts`）は、出したあとに、公開したページと `sw.js` が組み立てたものと同じか・全部の動画の Range・HTML の smoke を確かめる。間をおいて流し直しても通らなければ、出す前に控えた版へ `wrangler rollback` し、ジョブを失敗にする（流れは [CI の形](ci.md) の「公開の流れ」）。

- サイトは、出す前の版に戻っている。動画は `retained` に残っているので、前の版のページも再生できる
- deploy のジョブの要約に、出した版・前の版・通らなかった確かめが出る。記録で、どの確かめが通らなかったかを見る
- 直し方
  1. 原因を直す PR を出し、merge で出し直す（main を直さずに出し直すと、同じところで止まって、また戻る）
  2. 一時の通信の失敗だったときは、下の「Actions を出し直す」で ci.yml を main で流す
- 要約に「戻せなかった」と出たときは、上の「サイトを前の版に戻す」で、持ち主が手で戻す
- 初めての公開で戻す版が無いときは、戻さずにジョブを失敗にする

## rollback を試す（preview）

持ち主が一度だけ流す。自動で戻す流れが動くかを、本番に触らずに、preview の Worker（`chalkfile-preview`。経路なし・workers.dev だけ）で確かめる。持ち主が手元の Wrangler の認証で流す（CI の token は使わない）。

```bash
npm run synth -- --cached-only && npm run build:site -- --strict && npm run gen
npx --no-install wrangler deploy --env preview                 # 1 回目: 戻す先の版を作る。出力に preview の URL が出る
npx --no-install wrangler deployments status --env preview     # 今の版の Version ID を控える
npm run deploy:worker -- --env preview --origin https://chalkfile-preview.<workers.dev の名前>.workers.dev/ --drill
npx --no-install wrangler deployments status --env preview     # 控えた版に戻っているか
```

- `--drill` は、出したあとの確かめを、通っても失敗にして、rollback まで流す。preview だけで使える（本番を指すと、何もせずに止まる）
- 試したら、結果（戻った版と、かかった時間）を [日付つきの記録](../history/) に残す

## Actions を出し直す（workflow_dispatch）

- GitHub の Actions → ci → Run workflow で、branch に main を選ぶ。全部のジョブを流したあとで公開する。main 以外を選ぶと、deploy のジョブは skipped になる（公開しない）
- 手元からなら `gh workflow run ci.yml --ref main`。失敗した実行をそのまま流し直すなら `gh run rerun <run ID> --failed`
- main の先頭でない commit の実行を流し直しても、deploy は出さずに終える（古い版を出さない）。今の main を出すときは、新しく流す

| 止まった手順 | 直し方 |
|---|---|
| 素材と講義データ（`synth --cached-only`） | 素材ブランチに声が足りない。台本の branch で `materials push` をする（[公開の順番](publish.md) の 4）。素材が消えたときは、下の「素材を作り直す」 |
| 動画を先に照合（`media.ts check`） | 動画の一覧と Releases が合わない。その講座で `media push --course <講座 ID>` → `media check` をやり直し、その講座の動画の一覧を commit する |
| 静的サイトを検証して組み立てる（`build_site.ts --strict`） | ポスターか動画の一覧が足りない（[ハマりどころ](troubleshooting.md) の「素材と動画の push」） |
| build と同じものかを照らす（`dist_digest.ts verify`） | 取った artifact が、build の出した一覧と違う。出し直す。続くときは、build と同じ commit かを見る |
| Deploy（secret か vars が無いと出る） | [初回の設定](setup.md) の 2 と 3 |
| Deploy（確かめが通らず、前の版に戻した） | 上の「公開後の確かめが通らず、前の版に戻ったとき」 |
| ffmpeg を取る・確かめる手順 | 固定した版のビルドを取れないか、sha256 が合わない。出し直す。続くときは [CI の形](ci.md) の「ffmpeg」 |

### 前の形の公開で出す（2026-11-10 まで）

ci.yml の公開が止まり、急いで出すときだけ使う。組み立てから公開までを 1 つのジョブで流す、前の形の workflow（`deploy.yml`）。

- Actions → deploy → Run workflow で、branch に main を選ぶ（手元からなら `gh workflow run deploy.yml --ref main`）
- ci.yml の公開と同じ時には流れない（同じ concurrency の group）。出したあとの確かめは `verify_public.ts` だけで、自動では戻さない。出したら [公開の順番](publish.md) の「公開後の確認」を手で流す
- 2026-11-10 に、workflow とこの節を消す（[CI の形](ci.md) の「この形に移したときに、持ち主がやること」）

## 素材を作り直す（VOICEVOX）

素材ブランチの声が足りない、または消えたときに、台本から声を作り直す。

1. 声を作る台本の commit に移る（ふつうは main）
2. VOICEVOX のエンジンを `127.0.0.1:50021` で動かす（[pipeline.md](../../.claude/skills/study-video-course/references/pipeline.md) の「前提」）。訳の声は、uv が Kokoro を用意する
3. `npm run materials:pull` で残っている素材を取り出してから、`npm run synth -- <ID…>` を流す（足りない台詞だけを作る）
4. `.work/kana/<ID>.txt` の読みを見て、`npm run materials:check`
5. `npm run check:content -- --require-denylist` → `npm run materials:push`

- VOICEVOX や Kokoro の版が変わると、同じ文でも音が変わり、時刻（timeline）が変わることがある。`git diff content/*/generated/timeline/` で変わっていたら、その動画は書き出し直して `media push` する（[公開の順番](publish.md) の 5〜7）
- BGM と効果音は `npm run build:music` で作り直せる。素材と同じバイト列になるかは `npm run music:verify` で確かめる（numpy・scipy の版を上げたときも）
- push は前の版を親にするので、素材ブランチの前の版は `git log origin/materials` で見られる。gc は親の無い 1 コミットにして履歴を切るので、gc より前の素材は、そこからはたどれない

## 素材を片付ける（gc）

```bash
npm run chalk -- materials gc                                                        # origin/main の台本が使わない台詞の声を一覧にするだけ
npm run chalk -- materials gc --keep origin/main --keep origin/<branch> --confirm   # 消す（持ち主）
```

- 消すのは `--confirm` を付けたときだけ。持ち主が流す
- `--keep` は、声を残す台本の ref。いくつも渡せる。渡すと、既定の origin/main は使わないので、main の声も残すなら `--keep origin/main` も渡す。開いている講座の branch の声も残すときは、その branch も渡す
- gc は、残す素材を親の無い 1 コミットにして push し、それまでの履歴を切る

## 古いハッシュの動画を片付ける（retained）

- `media push` は、一覧から外れた前のハッシュの動画を `retained` に残し、`retainedUntil`（UTC の日付。その日まで）を付ける。期限は、`retained` に入れた日から 90 日
- 期限を過ぎたものが残っていると、`npm run media:check`（`build:site -- --strict` の中でも流れる）と `check_delivery.ts` が注意を出す。公開は止めない
- 片付けるのは持ち主。講座ごとの動画の一覧（`content/<講座>/generated/media.<言語>.json`）の `retained` と `retainedUntil` を見て、期限を過ぎ、開いたままの前のページがもう無いと見てよい項目を、`retained` から外す PR を出す。外すと、Worker はその URL に 404 を返す
- 延ばすときは、`retainedUntil` を書き換える
- Release の asset は消さない（[ADR](../adr/2026-11-02-keep-old-video-hashes.md)）。1 つの Release の asset が 1000 を超えるときは `media push` が止まるので、そのときに片付け方を決める

## token を入れ替える・失効させる

入れ替えるとき:

1. 管理画面で、同じ 3 つの権限の新しい token を作る（[初回の設定](setup.md) の 3）
2. GitHub の production の secret `CLOUDFLARE_API_TOKEN` を、新しい値で上書きする（その場で欄に入れる）
3. 上の「Actions を出し直す」で、新しい token で出せることを確かめる
4. 管理画面で、古い token を失効させる

漏れたかもしれないとき:

1. すぐに管理画面で、その token を失効させる。公開はできなくなるが、サイトと動画の配信は続く
2. 上の 1〜3 で、新しい token を入れる
3. Cloudflare の管理画面の監査ログで、その token で何が行われたかを確かめる。知らない変更があれば戻す

- 漏れたかもしれない値を、確かめるために会話・Issue・PR に貼らない

## 無料枠を超えたとき

- Workers Free には、Worker の要求の 1 日の上限がある。超えた日は、Worker を通す `/media/*` がエラーになり、請求は来ない。ページとポスター（静的なファイル）の配信は、この枠を使わない。保存した講座は、通信なしで見られる（[ADR](../adr/2026-11-02-workers-free-only.md)）
- すること
  1. 待つ。有料プランに変えない
  2. Cloudflare の管理画面の Workers Logs で、`/media/*` の要求と失敗（`media_upstream_failed`）を見る（ログの形は [配信の設計](../architecture/delivery.md) の「Worker のログ」）
  3. 続くときは、持ち主が対策を決める。決める前に、要求の数を測る（測り方と、1 本の再生で Worker の要求が何回かは、[公開確認の記録](../history/2026-11-03-workers-verification.md) の「無料枠の測定」）
- Workers Logs にも 1 日の枠がある。超えた日は取り込みが止まるだけで、請求は来ない
- 数字といつ戻るかは変わるので、今の値は公式の [Workers の制限](https://developers.cloudflare.com/workers/platform/limits/) で確かめる

## 旧 Pages の案内を戻す

- 旧 Pages（`gh-pages` ブランチ）を移行の案内に置き換える `scripts/legacy/deploy_pages.sh` は、手元に `refs/chalkfile-backups/gh-pages-<main の SHA>` を残す。前の版に戻すときは、まずこれを見る
- 戻す前に、ほかの更新が入っていないか、公開の許可の範囲かを確かめる（持ち主）
- 学ぶ人の前の保存は、移行の Service Worker が残している。戻すために、保存の cache を消さない

## ドメインの更新

- `chalkfile.com` の更新は、持ち主がカレンダーで管理する
