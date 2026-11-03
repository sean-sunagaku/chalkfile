# テーマ（トンマナ）の仕様と作り方

講座ごとに、色・書体・背景の飾りをテーマとして選べる。テーマは動画（Remotion）と講座サイトの両方に効く。

- テーマの定義: `content/themes.ts`（`THEMES` に並べる）
- 型: `content/types.ts` の `Theme`
- 講座への指定: 講座の `course.ts` に `theme: 'indigo'` のように書く。書かなければ既定の `chalkfile`
- 一覧ページ（`site/dist/index.html`）は既定のテーマで描く

## 今あるテーマ

| id | 名前 | 地 | 中身 |
|---|---|---|---|
| `chalkfile` | Chalkfile（既定） | 明るい | 明るい教室の黒板を裏返した配色。文字は黒板の深い緑、色はチョーク、コードの面だけ黒板の色。角の丸いゴシック（Zen Maru Gothic） |
| `indigo` | Indigo | 明るい | 白い地・紺の文字・紫の主役の色・右上の角を斜めに切るグラデーションの帯。英字は Inter、日本語は Noto Sans JP（Stripe 講座で使う） |
| `night` | Night | 暗い | 最初の版。濃紺の地にピンクから水色のグラデーションと光の粒 |
| `paper` | Paper | 明るい | 生成りの紙のような地に、黒に近い文字と朱色の主役の色。方眼の点。英字は Inter、日本語は Noto Sans JP（UI・UX 講座で使う） |
| `stage` | Stage | 明るい | お笑いの舞台のような配色。クリームの地に黒に近い文字、幕の赤と照明の黄色の帯。角の丸いゴシック（Zen Maru Gothic）（お笑い版の講座で使う） |

## 項目

色はすべて `#RRGGBB` で書く（薄い色・文字色・透明度はここから計算する）。

| 項目 | 何に使うか |
|---|---|
| `id` / `label` / `summary` | 講座の `theme` に書く名前、表示名、一覧ページの紹介文 |
| `scheme` | `light` か `dark`。図の薄い面（10% か 15%）と、図の文字色の作り方（見出しの色に混ぜるか、白に混ぜるか）が変わる |
| `fonts` | 本文の書体を並べる（`zen-maru`・`noto`・`inter`）。英字用を先に置くと英字だけその書体になる。コードは JetBrains Mono で固定 |
| `color.bg` / `bg2` | 動画とサイトの地（上から下へ bg → bg2） |
| `color.surface` / `surface2` | カードの面と、一段沈んだ面（表の見出し・サイトの帯） |
| `color.ink` / `sub` / `muted` | 見出し・本文・補足の文字 |
| `color.line` / `line2` | 細い線と強めの線 |
| `color.accent` / `onAccent` | 主役の色（進み具合・選択中・まとめの番号）と、その上の文字 |
| `color.code` | コードと端末の面、サイトの動画の下の字幕の帯。どのテーマでも濃い色にする |
| `shadow` | カードの影（CSS の box-shadow） |
| `gradient` | 見出しの下線・進み具合の線（2 色以上） |
| `display` | オープニングの大きな番号・エンディングの文字の塗り。地に対して十分濃い 2 色 |
| `mesh` | 背景の飾りの色（3〜4 色） |
| `tones` | 図の 7 色（pink・violet・cyan・mint・amber・coral・slate）。台本の `tone` はここを引く |
| `syntax` | コードの色分け（`code` の面の上で読める明るさ） |
| `decor` | 背景の飾り。`chalk`（方眼の点とチョークのにじみ）・`band`（右上の角を斜めに切る帯と縦の補助線）・`stars`（暗い地に光の粒） |
| `radius` | カードの角の丸み |
| `dark` | 暗い地（`scheme: 'dark'`）の面と線（カードの面・札の面・色の付かない矢印・補助線・進み具合の溝・薄い光・薄い面・図の色の上の文字）。暗い地のテーマには必ず書く（`NIGHT` が見本）。明るい地は `color` から作るので書かない。`#RRGGBB` か `rgba()` で書く |

テーマの形（`#RRGGBB`・要る項目・暗い地の `dark`）は、台本の検証（`bun scripts/validate.ts`）が確かめる。

## 部品で色を使う

- テーマから、描くときの色の組（パレット）を作るのは `engine/core/theme.ts` の `derivePalette(theme, lang)`。React・Remotion に依存しない純粋な関数で、テーマと言語ごとに 1 回だけ作る
- 動画は `src/Lecture.tsx` が `ThemeProvider` で全体を包む。部品は頭で `usePalette()`（`src/theme.ts`）を呼んで読む

  ```tsx
  const { C, tone, SANS } = usePalette();
  ```

- 読める名前: `C`（地・文字・線・面・コードの面の色）、`TONES` と `tone(t)`（図の色の組。`main`・`soft`・`deep`・`text`）、`GRAD`・`DISPLAY`・`SYNTAX`・`MESH`、`THEME`（テーマそのもの）、`SANS`・`MONO`（書体）
- 透明度は `alpha(色, 0x55 / 255)`、2 色を混ぜるのは `mix(a, b, t)`（`engine/core/color.ts`）。`${色}55` のように 16 進の透明度をつながない
- テーマで変えない「そのものの色」（架空のアプリの画面・スマホの枠・窓の信号）は、`src/components/app-colors.ts` にだけ書く
- 講座サイト（`scripts/site_theme.ts`）も同じパレットから CSS を作る。図の文字色の作り方だけ、動画とサイトで違う（`TONE_TEXT_MIX`。そろえるのは見た目の更新のとき）

## 新しいテーマを作る

1. `content/themes.ts` に既存のテーマを写して `id` を変え、色を差し替える。`THEMES` に足す
2. まず静止画で試す（講座のテーマを変えずに、上書きして描ける）

   ```bash
   node scripts/stills.ts L02:3 L03:3 L10:4 L13:2 L11:3 L04:3 L01:3,10 --theme=<id>
   ```

   場面の種類が全部そろう組み合わせ（カード・コード・端末・クイズ・数字・状態の図・強調・エンディング）。`out/stills/*-<id>.jpg` を全部見る
3. 講座に `theme: '<id>'` を書き、`npm run render` で書き出し直す（色が変わると全部の動画が変わる）
4. `bun scripts/build_site.ts` → `bun scripts/serve.ts` でサイトの色・字幕の帯・背景の飾りを確かめる
5. 一覧ページのテーマの見本を差し替える: `node scripts/stills.ts L02:3 --theme=<id>` の画像を `site/assets/themes/<id>.jpg` に置く（`hero.jpg` は一覧の最初の画面の画像）

## 確かめること

- 文字の濃さ: 明るい地の上の本文（`sub`）と補足（`muted`）が読めるか。図の色の文字（tone の文字色）が薄すぎないか
- `display` が地に対して濃いか（明るい地で黄色やピンクを使うと読めない）
- `code` の面の上で `syntax` の色が読めるか
- 背景の飾りが見出しや右上の講座名と重ならないか（`band` は右上の角、見出しは左）
- サイトの見出しの横の情報が、背景の帯と重ならないか

## 実在のブランドに寄せるとき

色と雰囲気を寄せるところまでにする。

- テーマの `id` と `label` に会社名・製品名を付けない（Stripe 講座のテーマは `indigo`）。どの講座にも使える部品なので、名前は色や形から付ける
- ロゴ・社名の書体・アイコン・特徴的なイラスト・画面の写しは使わない
- その会社の製品を扱う講座は、講座の `disclaimer` に「○○社とは関係のない非公式の講座」と書く（動画のはじめと終わり、サイトに出る）
- 名前と公式ドキュメントの扱い全体は [rights.md](rights.md)
