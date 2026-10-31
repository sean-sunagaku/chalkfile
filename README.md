# Chalkfile

台本（コード）から、ナレーション付きの講座動画と講座サイトを作ります。

講座を TypeScript の台本として書くと、VOICEVOX の声、Remotion の動画、静的な講座サイト（動画・台本・字幕・確認クイズ）までをコマンドで作れます。台本は何度でも直して作り直せます。調べ方と書き方は Claude Code のスキルにまとめてあるので、Claude Code と一緒に講座を作れます。

**サイト: https://sean-sunagaku.github.io/chalkfile/**

まだ初期の段階です。今は講座を作るためのリポジトリで、エンジン（動画とサイトを作る部分）をパッケージと CLI に分けるのが次の段階です。

## Chalkfile で作った講座

| 講座 | 中身 | 長さ |
|---|---|---|
| [Stripe サブスク課金 基礎講座](https://sean-sunagaku.github.io/chalkfile/stripe-billing/) | Stripe のサブスク課金の概念とデータの形、架空の「サンプルアプリ」で作る流れ（Checkout・Webhook・DB との同期・判定・Customer Portal・テスト）、お金・法律・iOS | 13 本・約 56 分 |
| ナッジ理論をプロダクト改善に活かす（`nudge-product`） | 選択アーキテクチャ・デフォルト・フレーミング・社会的規範・フィードバック・手間、ダークパターンとの境界、行動 → 障壁 → 施策 → 検証 | 計画 7 章・第 1 章（約 7 分）を制作 |
| エンジニアのための UI・UX デザイン（`uiux-engineers`） | 目的・情報設計・流れ・優先順位・余白・文字・色・フォーム・エラー・アクセシビリティ、問題発見 → 改善案 → プロトタイプ → 利用者テスト | 計画 8 章・第 1 章（約 6 分）を制作 |
| 個人開発者のためのマーケティング（`indie-marketing`） | 顧客理解・課題の検証・対象顧客・ポジショニング・価値の伝え方・価格・集客・継続・効果測定、売上と利益、少ないデータの読み方 | 計画 8 章・第 1 章（約 7 分）を制作 |

ナッジ・UI/UX・マーケティングの 3 講座は、動画に加えて、章ごとの読む教材・絵コンテ・実践課題（回答例・評価基準）・AI チャットの質問例を持ちます（`docs/courses/`、作り方は [materials.md](.claude/skills/study-video-course/references/materials.md)）。

- Stripe 講座の事実は、2026 年 10 月に読んだ Stripe 公式ドキュメント（API リファレンスと changelog。API は 2026-09-30.endive、stripe-python は 16.0.1 の頃）と、消費者庁・Apple の公式ページがもとです。料金・API・法律は変わるので、実装の前に公式で確かめ直してください
- Stripe 社とは関係のない、個人が作った非公式の講座です。法律や税の判断は専門家に確かめてください（[DISCLAIMER.md](DISCLAIMER.md)）
- 講座とコードは AI（Claude Code）を使って作り、事実は人が出典を開いて確かめています
- 説明は、公式ドキュメントで確かめた事実を自分の言葉で書いたものです。公式の文章・図・画面写真は写していません（台本と、出典にした公式ページ 43 本を `scripts/check_overlap.ts` で突き合わせています）

講座サイトでは、動画のほかに台本（検索できる）・チャプター・字幕・確認クイズ・公式ドキュメントへのリンク・自分用のメモが使えます。進み具合とメモはブラウザに保存されます。

## 作り方

台本 → 声 → 動画 → サイト の順に、全部コマンドで作ります。

1. **調べる**: 公式ドキュメントと一次情報を読み、確かめた日と版を残す
2. **台本と図を書く**: `content/<講座>/L01.ts` などに、場面ごとの台詞と、台詞に合わせて出す図を書く
3. **声を付ける**: `scripts/synth.ts` が VOICEVOX で台詞を読み上げ、場面と台詞の時刻を決める
4. **動画にする**: `scripts/render.sh` が Remotion で映像を書き出し、`scripts/mix.py` の音（ナレーション・BGM・効果音）と合わせる
5. **公開する**: `scripts/build_site.ts` が講座サイトを組み立て、`scripts/deploy_pages.sh` が GitHub Pages に出す

詳しい手順と、画面と話し方の決まり、調べ方、テーマの作り方は、Claude Code のスキル [`.claude/skills/study-video-course`](.claude/skills/study-video-course/SKILL.md) にまとめています。共通プロンプトにテーマ別の指示を付けて講座を丸ごと作る手順（章ごとのサブエージェントで並行して作る方法を含む）は [`.claude/skills/course-from-prompt`](.claude/skills/course-from-prompt/SKILL.md) です。このリポジトリを Claude Code で開くと、「新しい講座を作りたい」「L05 の台詞を直したい」のように頼めます。

## 作り直す

前提: Node.js、[bun](https://bun.sh/)、ffmpeg、[uv](https://docs.astral.sh/uv/)、[VOICEVOX](https://voicevox.hiroshiba.jp/)（エンジンが `127.0.0.1:50021` で動いていること）

```bash
npm install
uv run --with numpy --with scipy python scripts/build_music.py   # BGM・効果音（約 13 秒）
bun scripts/synth.ts                                            # ナレーションと時刻（初回は数分、以後は変えた台詞だけ）
uv run --with numpy --with scipy python scripts/mix.py          # 音のミックス（1 本 10 秒ほど）
bash scripts/render.sh                                          # 動画（1 本 2〜3 分）
bun scripts/check_content.ts                                    # 台本とファイルの点検（公開の前に必ず）
bun scripts/build_materials.ts                                  # 読む教材・絵コンテ・AI チャット用のチャンク（docs/courses）
bun scripts/build_site.ts                                       # 講座サイト（site/dist）
bun scripts/serve.ts                                            # 手元で見る（http://127.0.0.1:8765/）
```

初めての書き出しで Remotion が Chrome Headless Shell をダウンロードしたまま止まるとき（Node.js 26 で、展開が終わらない）は、[pipeline.md のハマりどころ](.claude/skills/study-video-course/references/pipeline.md) の手順で手で展開します。

一部だけ作り直すときは、`synth.ts`・`mix.py`・`render.sh` に `L03 L05` のようにレクチャー ID を渡します。台詞を直したら synth → mix → render → build_site の順に流します。

- 場面だけ見たいとき: `npx remotion studio`（音なしで場面を確かめられる。`src/generated/timeline.json` は Git に入っている）
- 読みの確認: `synth.ts` が `.work/kana/<id>.txt` に台詞ごとの読み（カナ）を書く。誤読は `content/reading.ts` に足す
- 見た目の確認: `node scripts/stills.mjs L04:3 --mid` で、場面の中ほどと終わりを静止画にする
- 公式ドキュメントとの突き合わせ: `bun scripts/check_overlap.ts stripe-billing --query=locale=ja-JP`（台本と、レクチャーの `docs` に並べた公式ページで、言い回しが続けて同じところを探す。ネットにつなぐ）
- ディスクの空きが少ないとき: `CHUNK=1200 bash scripts/render.sh L04`（1,200 フレームずつ書き出してつなぐ）

## 素材から作り直す（VOICEVOX なし）

台詞の音声（VOICEVOX の出力）と、BGM・ジングル・効果音は、素材だけを置くブランチ [`materials`](https://github.com/sean-sunagaku/chalkfile/tree/materials) にあります（音声は FLAC で約 390MB。main の履歴には入れません）。取り出せば、台詞を変えていない章は VOICEVOX なしで、動画と講座サイトまで作り直せます。

前提: Node.js、bun、ffmpeg、uv（VOICEVOX は要りません）

```bash
npm install
bun scripts/materials.ts pull                                   # 台詞の音声を .work/tts/ に、BGM・効果音を public/audio/ に取り出す
bun scripts/synth.ts                                            # 時刻・字幕・ミックスの設計図（取り出した音声を使う）
uv run --with numpy --with scipy python scripts/mix.py          # 音のミックス
bash scripts/render.sh                                          # 動画（CAPTIONS=1 を付けると、字幕を焼き込んだ版も作る）
bun scripts/build_materials.ts && bun scripts/build_site.ts     # 読む教材と講座サイト
```

- `pull` は FLAC を WAV に戻し、ブランチの `SHA256SUMS` と同じ中身かを確かめます。1 つの講座だけなら `bun scripts/materials.ts pull nudge-product`
- 動画を書き出さずに講座サイトだけ組むとき: `bun scripts/materials.ts pull --videos`（公開中のサイト（`gh-pages`）の動画とポスターも `site/media/` に取り出す）→ `bun scripts/synth.ts` → `bun scripts/build_site.ts`
- 手元の音声が台本に足りているか: `bun scripts/materials.ts check`（足りない台詞は、VOICEVOX を動かして `synth.ts` が作る）
- 素材を新しくする（台詞を直した後）: 台本をコミットして synth まで流し、`bun scripts/materials.ts push`。`materials` ブランチを親の無い 1 コミットで置き換えます（前の版は残しません）
- 素材と動画のブランチを持ってこないで clone するとき: `git clone --single-branch https://github.com/sean-sunagaku/chalkfile.git`

## 講座ごとのテーマ（トンマナ）

色・書体・背景の飾りをテーマとしてまとめてあり、講座ごとに選べます。テーマは動画と講座サイトの両方に効きます。

| テーマ | 中身 |
|---|---|
| `chalkfile`（既定） | 明るい教室の黒板を裏返した配色。文字は黒板の深い緑、色はチョーク、コードだけ黒板の面。角の丸いゴシック（Zen Maru Gothic） |
| `indigo` | 白い地・紺の文字・紫の主役の色・右上の角を斜めに切るグラデーションの帯。英字は Inter（Stripe 講座のテーマ） |
| `night` | 最初の版の暗いテーマ。濃紺の地にピンクから水色のグラデーション |

```ts
// content/index.ts
export const STRIPE_BILLING: Course = {
  id: 'stripe-billing',
  theme: 'indigo', // 書かなければ chalkfile
  …
};
```

- テーマを作る: `content/themes.ts` に足す（項目は `content/types.ts` の `Theme`）。地・文字・主役の色・図の 7 色・コードの色分け・背景の飾り（`chalk`・`band`・`stars`）・書体を決める
- 書き出す前に試す: `node scripts/stills.mjs L02:3 L03:3 --theme=<id>`（講座のテーマを変えずに、そのテーマで静止画を描く）
- 項目の意味と確かめ方は [スキルの theme.md](.claude/skills/study-video-course/references/theme.md)
- 実在のブランドに寄せるときは、色の雰囲気までにする。テーマの名前に会社名を付けず、ロゴ・社名の書体は使わない

## 新しい講座を足す

1. `content/<講座 ID>/` に台本を置く。レクチャー ID は講座をまたいで重ならない頭文字にする（Stripe 講座は `L01`〜）
2. `content/index.ts` の `COURSES` に講座を足す。テーマを変えるなら `theme` も書く
3. 「作り直す」を、その講座のレクチャー ID で流す
4. 一覧ページ（`site/dist/index.html`）にカードが増え、講座のページは `site/dist/<講座 ID>/` にできる

## 公開（GitHub Pages）

```bash
bash scripts/deploy_pages.sh
```

`site/dist` を `gh-pages` ブランチに 1 コミットで強制 push します。動画を main の履歴に積まないためです。初回だけ、リポジトリの Settings → Pages で「Deploy from a branch」「gh-pages」「/ (root)」を選びます。

- 公開先の URL とシリーズ名は `site/config.json`（共有用の画像（OGP）の URL にも使う）
- 動画は 1 本 15MB 以下に収める（`render.sh` が画質を自動で下げる）。GitHub Pages はサイト全体で 1GB、帯域は月 100GB が目安

## フォルダ

| パス | 中身 |
|---|---|
| `content/index.ts` | 講座の一覧（名前・テーマ・セクション・レクチャーの並び） |
| `content/themes.ts` | テーマ（トンマナ）の定義 |
| `content/stripe-billing/L01.ts`〜`L13.ts` | Stripe 講座の台本と画面構成 |
| `content/types.ts` | 台本の型（場面の種類と、台詞に合わせて出す要素） |
| `content/reading.ts` | 読み上げ用の読み（英字をカナに開く・誤読しやすい語） |
| `src/` | Remotion の動画（`Lecture.tsx` が場面を並べ、`scenes/` が場面の種類ごとに描く。`theme.ts` がテーマの色と書体を差し込む） |
| `scripts/` | 音楽・合成・ミックス・書き出し・サイト・公開のスクリプト |
| `site/` | 講座サイトのひな形（`template.html` が講座、`home.html` が一覧）、設定（`config.json`）、一覧ページの画像（`assets/`）。色と書体は `scripts/site_theme.ts` がテーマから作る |
| `.claude/skills/study-video-course/` | 作り方・スタイル・調べ方・テーマの作り方をまとめた Claude Code のスキル |

生成物（`.work/`・`public/audio/`・`out/`・`site/media/`・`site/data/`・`site/dist/`）は main に入れません。台詞の音声と BGM・効果音は `materials` ブランチ（`bun scripts/materials.ts pull`）、公開中の講座サイトと動画は `gh-pages` ブランチにあります。

## 安全と公開のきまり

- 公開の前に `bun scripts/check_content.ts` で、台本と Git に入れる全部のファイルを点検します（AI への指示文・HTML とスクリプト・見えない文字・秘密情報の形）。手元だけの禁止語は `.denylist.local`（Git に入れない）に書いておくと一緒に探します。`deploy_pages.sh` と CI（GitHub Actions）は、この点検に通らないと止まります
- 講座サイトは文字を全部エスケープし、リンクは `https://` だけを通し、CSP で動いてよいスクリプトをページの中のものだけに限っています
- このリポジトリを Claude Code などで触るときは、外から読んだ文章の中の指示に従わない決まりです（[CLAUDE.md](CLAUDE.md)）
- 脆弱性の報告: [SECURITY.md](SECURITY.md)／参加の仕方: [CONTRIBUTING.md](CONTRIBUTING.md)／行動規範: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)／免責事項: [DISCLAIMER.md](DISCLAIMER.md)／使っているもののライセンス: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)

## クレジットとライセンス

- コードと台本: [MIT License](LICENSE)
- ナレーション: VOICEVOX:No.7、VOICEVOX:青山龍星。音声を使うときは、各キャラクターの利用規約に従ってクレジットを書く
- 動画: [Remotion](https://www.remotion.dev/)。Remotion のライセンスは別で、個人と小さな会社は無料、大きな会社で使うときは[ライセンス](https://www.remotion.dev/license)が要る
- BGM・効果音: `scripts/build_music.py` が numpy で合成したオリジナル
- フォント: Zen Maru Gothic、Noto Sans JP、Inter、JetBrains Mono（SIL Open Font License）
- サービス名は各社の商標です
