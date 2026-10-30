---
name: study-video-course
description: ナレーション付きの勉強動画（講座）を、調べる → 講座の設計 → テーマ（トンマナ）→ 台本 → 声 → 動画 → 講座サイト → GitHub Pages の順に作る・直す・公開する。このリポジトリ（Chalkfile）の Remotion と VOICEVOX の仕組みを使う。Use when 新しい講座や勉強動画を作りたい、レクチャーを足したい、台本・台詞・図を直したい、読み間違いを直したい、動画を作り直したい、講座サイトを公開したい、講座のトンマナ（色・書体・背景）を変えたい・新しいテーマを作りたい、調べ方や画面・話し方のスタイルを確かめたい。Triggers "勉強動画", "トンマナ", "テーマを作る", "配色を変える", "講座を作る", "講座動画", "レクチャーを足す", "台本を直す", "読み間違い", "GitHub Pages に出す", "study video"
---

# 勉強動画の講座を作る

1 つの講座は、3〜6 分のレクチャー動画 10〜15 本と、講座サイト 1 枚でできている。講座サイトでは、動画・台本（検索できる）・チャプター・字幕・確認クイズ・公式ドキュメントへのリンク・自分用のメモが使える。

正本は台本のデータ（`content/<講座>/Lxx.ts`）。声も動画もサイトも、台本からコマンドで作り直す。動画を手で編集しない。

```
調べる → 講座を設計する → 台本を書く → synth（声と時刻）→ mix（音）→ render（動画）→ 確かめる → build_site → deploy_pages
```

## 進め方

### 1. 調べる

記憶で書かない。公式ドキュメント・API リファレンス・changelog・法令・公式ガイドラインを読んでから書く。確かめた日と版を残す。手順は [references/research.md](references/research.md)。

### 2. 講座を設計する

受講者・ゴール・セクション・レクチャーの並びを決めて、ユーザーに見せる。1 本のレクチャーの型（opening → goals → 本題 → recap → ending）と、講座の分け方（基礎編と実践編）は [references/course-design.md](references/course-design.md)。

トンマナ（テーマ）も決める。既定は `chalkfile`（明るい黒板）。題材に合わせたいときは `content/themes.ts` のテーマを選ぶか作り、講座に `theme: '<id>'` と書く。テーマは動画と講座サイトの両方に効く。項目の意味と作り方は [references/theme.md](references/theme.md)。

### 3. 台本を書く

`content/<講座 ID>/L01.ts` などに、場面ごとの台詞（`lines`）と、台詞に合わせて出す要素（`at`）を書く。場面の型は `content/types.ts`、見本は `content/stripe-billing/`。画面と話し方の決まりは [references/style.md](references/style.md)。講座を `content/index.ts` の `COURSES` に足す。

### 4. 声・音・動画を作る

```bash
bun scripts/synth.ts L01 L02                                     # 声と時刻（VOICEVOX）
uv run --with numpy --with scipy python scripts/mix.py L01 L02   # 音
bash scripts/render.sh L01 L02                                   # 動画
```

前提のツール、VOICEVOX の起動、ハマりどころは [references/pipeline.md](references/pipeline.md)。

### 5. 確かめる

公開の前に、全部やる。

- 読み: `.work/kana/<id>.txt` を全部読む。誤読は `content/reading.ts` に足して synth し直す
- 見た目: `node scripts/stills.mjs L01 --mid` で `out/stills/` に静止画を書き、全部見る。文字のはみ出し・重なり・小さすぎを直す
- 長さ: `ffprobe` の動画の長さが `src/generated/timeline.json` の `durationInFrames / 30` と合う
- 事実: 台本ができたら、別の目（サブエージェント）に台本ファイルを渡して、主張ごとに公式で確かめてもらう（research.md の「事実確認」）
- 型: `npx tsc --noEmit`
- サイト: `bun scripts/build_site.ts` → `bun scripts/serve.ts` で開き、再生・途中への移動・字幕・スマホの幅（375px）を見る

### 6. 公開する

```bash
bash scripts/deploy_pages.sh
```

コミットしてから流す。`site/dist` を gh-pages ブランチに 1 コミットで強制 push する（動画を main の履歴に積まない）。1〜2 分で `site/config.json` の `baseUrl` に出る。初回の Pages の設定は pipeline.md。

## よくある直し

| 頼まれたこと | やること |
|---|---|
| 台詞を直す | 台本を直す → synth → kana を見る → mix → render → stills → build_site → コミット → deploy |
| 読み間違いを直す | `reading.ts` の `PHRASES`（語句）か `WORDS`（英単語）に足す → synth（読みが変わった台詞だけ作り直される）→ mix → render |
| 図や画面の文字だけ直す | 台本を直す → stills → render（声は変わらないので synth と mix は要らない） |
| トンマナを変える | `content/themes.ts` のテーマを選ぶか作る → 講座の `theme` を書き換える → `stills.mjs --theme=<id>` で試す → render（全部の動画）→ build_site（theme.md） |
| 事実が古くなった | research.md の手順で確かめ直す → 台本・`docs`・`takeaways`・`docsNote`・`sourceNote` の日付を直す |
| レクチャーを足す | 台本を書く → `COURSES` に足す → synth・mix・render → 前後のレクチャーの `ending.next` を直す |

## やらないこと

- 実在の会社やサービスの内部の情報（自分の仕事のコード・テーブル・設計・数字）を台本に入れない。例は架空の「サンプルアプリ」で作る
- パスワード・API キー・Webhook の署名シークレットを台本に書かない（例は `sk_test_...` のような省略か、環境変数）
- 画面の固定の文字に絵文字をアイコン代わりに使わない（アイコンは lucide-react の名前を `icon` に書く）
- 静止画を見ずに書き出さない。読みを見ずに公開しない
- 動画（`site/media/`）を main にコミットしない
