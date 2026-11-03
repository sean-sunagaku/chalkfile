# 動画の書き出しは、bun の TS から @remotion/renderer を呼ぶ

- 状態: 採用
- 決めた日: 2026-11-04
- 関連: [npm で入れて bun で動かす](2026-11-02-npm-install-bun-run.md)（その「決めたこと」のうち、Remotion の書き出しの動かし方を置き換える）

## 背景

- 書き出しは、シェルの `scripts/render.sh` が、動画ごとに `npx remotion render` を起こしていた（字幕版を含めて、全部で最大 126 回）。起こすたびに、バンドル（webpack）を作り直していた
- `render.sh` には、次の問題があった
  - macOS でしか動かないコマンド（`stat -f%z`）と、手元の python3（timeline を読む）を使っていた
  - 並列の数を、`remotion.config.ts`（6）と `render.sh`（8）の 2 か所に書いていた
  - 字幕版を作るかを、呼ぶ側が `CAPTIONS=1` で決めていた（講座のデータの `cast` では決まらなかった）
  - 訳の動画のポスターも、Git に入れる講座のフォルダに書いていた
- 2026-11-04 に、同じ 2 本の動画（L12・G01）を、前の `npx remotion render` と、bun から呼んだ `@remotion/renderer` で書き出して比べた。通常版の音なしの映像は、同じバイト列になった。字幕版は前の書き出しと 3 か所のフレームが違ったが、`npx remotion render` をもう一度流したものとは同じバイト列だった（Remotion の書き出しが、流すたびに少し揺れる）

## 決めたこと

- 書き出しの道具は `scripts/stages/video/render.ts`（TS）にする。bun で動かし、`@remotion/bundler` と `@remotion/renderer` を呼ぶ
- バンドルは、1 回の書き出しで 1 回だけ作る。動画ごとに、ブラウザを 1 つ開き、通常版と字幕版を書き出す
- 書き出しの設定（並列の数・crf・画像の品質・サイト用の動画の作り方・ポスター）は、`scripts/stages/video/render.config.ts` の 1 か所に置く。Remotion Studio の設定（`remotion.config.ts`）も、ここを読む
- 字幕版を作るかは、講座のデータ（`cast` のある講座）で決める。`CAPTIONS=1`・`CHUNK`・`CONCURRENCY` も、前の呼び方として残す
- `render.sh` は消す

## 理由

- 動画ごとに `npx` とバンドルを起こす時間（1 回に数秒〜十数秒）がなくなる
- TS にすると、台本・講座のデータ・大きさの上限（`site/limits.ts`）・段の記録を、写さずにそのまま読める。字幕版を講座のデータで決められ、段の記録も同じプロセスで書ける
- 動画の名前の形・一時の名前からの置き換え・ffprobe での確かめ・止めたときの片付けを、テストで固定できる（`tests/render.test.ts`）
- 道具はどれも bun で動かしている。Remotion の Bun の文書は、Bun を「おおむね使える」としている（2026-11-04 に確かめた。書き出しのあとにプロセスが終わらないことがあるので、道具の最後で終える）
- macOS でなくても書き出せる（Linux は、手で流す CI の `render-check.yml` で確かめる）

## ほかの案

| 案 | 選ばなかった理由 |
|---|---|
| `render.sh` のまま直す（stat を直し、並列の数を 1 か所にする） | 動画ごとの `npx` とバンドルが残る。台本と講座のデータを読むたびに、bun や python3 を起こすことになる |
| TS にして、Node で動かす（`stills.ts` と同じ） | Node は拡張子の無い import を読めないので、台本（`content/`）と段の記録の部品を、そのまま読めない |
| TS から `npx remotion render` を起こす | バンドルを 1 回にできない。Remotion の CLI の出力を読んで、成否を決めることになる |

## 影響

- bun の版を上げたら、短い動画を 1 本書き出して確かめる（Remotion を bun で動かすので）。手元と CI の版は `.bun-version`
- Remotion は SIGINT で自分からプロセスを終えるので、`render.ts` はその受け手を外し、止められたときに自分で片付ける。bun は、シグナルの受け手を外すと、残した受け手も効かなくなることがある（1.3 で確かめた）ので、外したあとで付け直す
- 書き出しの道具・設定・計画の部品は、描き方の側の指紋（`scripts/stages/video/inputs.ts` の `RENDER_CODE`）に入る。入れ替えたので、公開した動画は「描き方だけ違う」と知らせが出る（書き出し直しは、見た目の更新とまとめて出す）
- 流し方は [commands.md](../guide/commands.md) と [公開の順番](../operations/publish.md)、困ったときは [ハマりどころ](../operations/troubleshooting.md) の「書き出し」
