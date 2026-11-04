# 台本を短く書く

文字と並び順は台本に書き、繰り返す設定だけをヘルパーへ渡す。見本は `content/stripe-billing/L01.ts` と `content/ga4-comedy/`。

## ゴール

`content/_shared/scenes.ts` の `goals` は、項目の `at` を 1 から順に補う。最初の台詞は前置きとし、2 つ目以降に `pop` を補う。明示した `at` と別の効果音は保つ。効果音を足さない場面は `pop: false` にする。

```ts
goals({
  kind: 'goals',
  heading: 'この章のゴール',
  items: ['役割を見分ける'],
  lines: [{ t: 'この章のゴールです。' }, { t: '役割を見分けられるようになります。' }],
})
```

## 図の参照

同じファイルの `flow` で囲むと、ノードの `key` から、矢印の `from`・`to` と `focus.keys` の型が決まる。表に無い名前は型の誤りになる。実行時の検証も、今までどおり `npm run validate` が行う。

## 掛け合い

`content/_shared/comedy.ts` の `Z`・`ZC`・`T`・`TEN` は、ずんだもん・涙声・ツッコミ・天の声の別名。声の実際の値は `chalkfile.config.ts` にある。講座の `cast` は `comedyCast()` で作る。役の名前と色を変えるときだけ、役ごとの `{ name, tone }` を渡す。講座ごとに別のオブジェクトになる。

## 講座のリンクとテーマ

講座の `links` は、`content/_shared/links.ts` の `courseLinks` で作る。`{ course: 'nudge-product', label: '読む教材' }` は、設定の公開先から URL になる。外のリンクは `{ url, label }` で書く。

テーマの名前は `ThemeId = keyof typeof THEMES`。テーマの表に足したら `npm run gen` を流す。エンジンの型にも同じ名前が渡り、台本に知らない名前を書けなくなる。

## 出典と教材

書く場所と出典の ID は、[読む教材の決まり](../../.claude/skills/study-video-course/references/materials.md) に従う。章どうしを import せず、共通の文字は専用のデータのファイルへ置く。

## 既存の形を移すとき

`npm run chalk -- content migrate` は、移す差分を表示する。`--write` を付けたときだけ書く。教材の分割・出典の表・共通の書き方への移行用で、ふだんの教材の登録は `npm run gen` で行う。移したあとに同じコマンドを流しても、差分は出ない。新しい公式リンクを足す場合も、表にある ID は振り直さない。
