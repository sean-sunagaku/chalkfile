# npm で入れて bun で動かす

- 状態: 採用
- 決めた日: 2026-11-02 に記録（決めた日は分からない。分かる範囲の時期は「背景」）
- 関連: [clone した人の手元で勝手に動くものを置かない](2026-10-30-no-auto-run-on-clone.md)

## 背景

- 依存（Remotion・React・TypeScript・wrangler・Playwright など）は npm で入れ、`package-lock.json` で版を固定している。最初の commit（2026-10-29）からこの形
- 台本を読むスクリプト（`scripts/*.ts`）は、最初の commit から bun で動かしている（`bun scripts/synth.ts`）。単体テストも、足した 2026-10-31 から `bun test` で流している
- `npm ci --ignore-scripts` は 2026-10-30 から使っている
- 2026-11-02 のリファクタ計画で、入れ方も bun にそろえるかを考え、npm のままにすることにした

## 決めたこと

- 依存は npm で入れる。CI と手元では `npm ci --ignore-scripts` を使い、lock は `package-lock.json` を使う
- TS のスクリプトとテストは bun で動かす
- Remotion の書き出し・型検査（`tsc`）・wrangler・Playwright は、npm で入れたものを `npx` か `package.json` の `scripts` から動かす

## 理由

- npm は、lock（`package-lock.json`）・Dependabot での更新・`--ignore-scripts`（インストール時スクリプトを止める）がそろって使える。CI・文書・点検が、この入れ方を前提にしている
- bun は TS をそのまま速く動かせ、テストの道具（`bun test`）も付いている。台本を `import` して読むスクリプトを、変換なしで書ける
- スクリプトは bun の機能を使っている（`Bun.build` で Service Worker と画面のコードを組む・`Bun.serve`・`import.meta.dir` など）

## ほかの案

| 案 | 選ばなかった理由 |
|---|---|
| 入れ方も bun にそろえる | lock・CI・Dependabot の設定・文書・点検を、全部移すことになる。今の入れ方で、要ること（lock・更新・インストール時スクリプトを止める）がそろっている |
| 動かすのも Node にそろえる（TS を Node で動かす道具を足す） | `Bun.build`・`Bun.serve` などを置き換えることになり、道具も増える |

## 影響

- 手元には Node と bun の両方が要る
- Node と bun の版は、今は CI（`.github/workflows/`）に書いている。版のファイル（`.node-version`・`.bun-version`）と `package.json` の `engines`・`packageManager` で固定する予定（T1-01）
- 依存を足したり上げたりすると、`package-lock.json` が変わる。lock は npm で書く
- Dependabot で npm の依存も見るようにする予定（T1-12）
