# 素材は 1GB までは materials ブランチに置き、超えたら講座ごとの束を Releases に移す

- 状態: 採用（移るのは、下の合図が出てから）
- 決めた日: 2026-11-03（持ち主の任せで、2026-11-02 のリファクタ計画が勧めた案を採った）
- 関連: [素材は materials ブランチに置き、履歴を持たない](2026-10-31-materials-branch.md)（今の置き場所。この ADR はその続きで、置き換えない）・[Workers Free のままにする](2026-11-02-workers-free-only.md)・[動画の古いハッシュを消さない](2026-11-02-keep-old-video-hashes.md)・`scripts/materials.ts`

## 背景

- 素材（台詞の音声と読み・BGM・ジングル・効果音）は、`materials` ブランチに置いている（[前の ADR](2026-10-31-materials-branch.md)）。push は足すだけで、前の版を親にする。消すのは `materials.ts gc --confirm` だけで、gc は残す素材を親の無い 1 コミットにして、全部を送り直す
- ブランチは育ち続けている。大きさは、木の中の blob の大きさの合計（`git ls-tree -r -l origin/materials`。中身は取り出さずに数えた）

| 測った日 | ファイル | 合計 | 出どころ |
|---|---|---|---|
| 2026-10-31 | — | 約 385MB | [前の ADR](2026-10-31-materials-branch.md) の背景 |
| 2026-11-03 | 8,533 | 758,125,314 バイト（約 758MB） | この ADR。コミット `1398f22`（2026-11-02 の push。親の無い 1 コミット） |

- 2026-11-03 の内訳: FLAC（台詞の音声と BGM・効果音）4,273 個で 757.2MB、読み（`.kana`）4,258 個で 0.5MB、ほかは `SHA256SUMS` と `README.md`。台詞の音声は講座ごとのフォルダ（`tts/<講座 ID>/`）にあり、いちばん大きいのは 6 章を 3 つの言語で持つ講座の 257.4MB。BGM・ジングル・効果音（`audio/`）は 15 個で 13.9MB
- 増える理由: 講座・章・訳の言語を足すたびに増える。台詞を直すと新しい音声が足され、前の音声は gc まで木と履歴に残る
- リポジトリ全体の大きさは、GitHub の API の `size` で 702,957 KB（2026-11-03）。大半が素材
- 素材は、main の CI（`check.yml` の build と `deploy.yml`）が毎回 `materials.ts pull` で、ブランチの履歴ごと取る。大きくなるほど、CI と手元の取り出しが遅くなる
- GitHub の上限（2026-11-03 に [Repository limits](https://docs.github.com/en/repositories/creating-and-managing-repositories/repository-limits) と [About releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases) で確かめた）
  - 1 回の push は 2GB で止められる。1 つのファイルは 100MB で止められる。リポジトリ（`.git`）は 10GB までを勧める
  - Releases は、1 つのファイルが 2GiB 未満・1 つの Release に 1,000 個まで。Release の合計の大きさと転送の量には、上限を設けていない
  - gc は残す素材を 1 回の push で全部送るので、木が 2GB に近づくと、gc ができなくなる

## 決めたこと

- (a) 素材のブランチの木の合計が 1GB（10^9 バイト）を超えるまでは、今の `materials` ブランチのまま使う
- 超えたら、(b) 講座ごとの変わらない束を Releases に置き、束の一覧を main に入れる形に移す
- (c) R2 は使わない

| 案 | 形 | 良いところ | 困るところ |
|---|---|---|---|
| (a) 今のブランチのまま | 素材だけを置く `materials` ブランチ。push は足すだけ、消すのは gc だけ | 今の道具（`pull`・`check`・`push`・`gc`）と CI がそのまま動く。足すだけの push なので、並行の push でもほかの講座の素材は消えない | main のコミットと素材の版がつながらない（main の古いコミットの素材を取れるのは、次の gc まで）。大きくなるほど取り出しと CI が遅い。木が 2GB に近づくと gc の push が通らない |
| (b) 講座ごとの束を Releases に | 講座ごとの素材を、中身から名前が決まる変わらない束（tar）にして Releases に置き、`content/<講座 ID>/generated/materials.json`（束の名前・大きさ・SHA-256）を main に入れる | main のどのコミットからでも、その時の素材を作り直せる。講座の PR は自分の講座の一覧だけを触るので、PR どうしがぶつからない。Git の大きさに入らない。講座ごとに選んで取れる | 束を作る・上げる・確かめる道具が要る。台詞を 1 つ直しても、その講座の束を作り直して上げ直す。古い束は main の古いコミットが指すので、消さずに残す |
| (c) Cloudflare R2 | 素材を R2 に置く | 無料の枠が 10GB ある（2026-11-02 に確かめた値） | 配信の仕組みが 1 つ増える。無料の枠を超えると、止まらずに請求される（[Workers Free のままにする](2026-11-02-workers-free-only.md) と合わない） |

## 理由

- 今は 758MB で、(a) の困るところ（取り出しの遅さ・gc の上限）はまだ小さい。道具と CI を作り直すより、講座を作るほうに手を使う
- 1GB で移り始めれば、gc の push の上限（2GB）と、リポジトリの勧める大きさに届く前に、移り終えられる
- 移り先を (b) にするのは、動画と同じ考え方（中身から名前が決まる変わらないファイルを Releases に置き、main の一覧が指す）で、すでにある道具と点検の形を使えるため。Releases は、合計の大きさと転送の量に上限を設けていないので（2026-11-03）、置いても費用が増えない
- 講座ごとの一覧は講座のフォルダに入るので、講座のことは講座のフォルダに閉じるきまり（[AGENTS.md](../../AGENTS.md) の「並行作業のきまり」）と合う

## ほかの案

| 案 | 選ばなかった理由 |
|---|---|
| 今すぐ (b) に移る | まだ小さく、作り直す道具と CI の手間に見合わない |
| (c) R2 | 上の表のとおり。費用が読めない |
| Git LFS | 無料の枠は、保存と転送がそれぞれ月 10GiB（2026-11-03 に確かめた値）。CI は毎回全部の素材を取るので、転送の枠をすぐに使い切り、その月は取れなくなる |
| main に入れる | 前の ADR のとおり、main の履歴が音声で太り続ける |

## 影響

### 移る合図

- 素材のブランチの木の合計が 1GB（10^9 バイト）を超えた。測り方は `git ls-tree -r -l origin/materials` の大きさの合計。`materials.ts push` が最後に出す「全部で … MB」と、ブランチの `README.md` の「全部で … MB」も、ほぼ同じ値（`README.md` と `SHA256SUMS` を除いた合計）を出す
- 履歴を含めた大きさ（`git rev-list --objects origin/materials | cut -d' ' -f1 | git cat-file --batch-check='%(objectsize)'` の合計。同じ中身のファイルは 1 つに数える。2026-11-03 は 753,617,633 バイト）が 1GB を超えたのに、木が 1GB より小さいときは、移らずに gc で履歴を切る（gc は持ち主だけが流す。[戻し方](../operations/recovery.md) の「素材を片付ける（gc）」）
- 合図が出たら、持ち主が移る時期を決める。1GB より前に移ってもよい

### 移り方の概略

作るときの計画。手順の正本は、移るときに [公開の順番](../operations/publish.md) と [始め方](../guide/quickstart.md) に書く。

1. `scripts/materials.ts` に束の形を足す。講座ごとに、台詞の音声と読み（`tts/<講座 ID>/`）を、名前に SHA-256 の入る変わらない束にする。BGM・ジングル・効果音（`audio/`）も 1 つの束にする。束の単位（講座ごとか、動画ごとか）は、束の大きさと上げ直す量を見て、そのときに決める
2. 束は Releases に置く。タグは動画の `media-*` と分ける（例: `materials-<講座 ID>`）。名前で中身が決まるので、上書きも削除もしない
3. 講座のフォルダの `content/<講座 ID>/generated/materials.json` に、束の名前・大きさ・SHA-256 を書き、main に commit する（動画の一覧 `media.<言語>.json` と同じ考え方）
4. 移るあいだは両方を読む。`pull` は講座の一覧があれば束から、無ければ `materials` ブランチから取る。`push` は束に上げる
5. 今のブランチの FLAC をそのまま束にする（声は作り直さない）。講座ごとに一覧を main に入れる
6. CI（`check.yml`・`deploy.yml`）の取り出しを束に変え、全講座で `materials.ts check` と `synth --cached-only` が通るのを確かめる
7. 全講座が移ったら、`materials` ブランチを読むのをやめる。ブランチは消さずに残す（それまでの main のコミットの素材の出どころ）
8. [前の ADR](2026-10-31-materials-branch.md) の状態を「置き換え済み」にして、この ADR へのリンクを足す。文書（[始め方](../guide/quickstart.md) の「B. 素材から作る」・[全体図](../architecture/overview.md)・[公開の順番](../operations/publish.md)）を直す

- 戻し方: 移るあいだはブランチも読むので、束を読むのをやめれば (a) に戻れる
- この ADR では、スクリプトも CI も変えない
