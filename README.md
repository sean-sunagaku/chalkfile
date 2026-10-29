# Chalkfile

台本（コード）から、ナレーション付きの講座動画と講座サイトを作ります。

講座を TypeScript の台本として書くと、VOICEVOX の声、Remotion の動画、静的な講座サイト（動画・台本・字幕・確認クイズ）までをコマンドで作れます。台本は何度でも直して作り直せます。調べ方と書き方は Claude Code のスキルにまとめてあるので、Claude Code と一緒に講座を作れます。

**サイト: https://sean-sunagaku.github.io/chalkfile/**

まだ初期の段階です。今は講座を作るためのリポジトリで、エンジン（動画とサイトを作る部分）をパッケージと CLI に分けるのが次の段階です。

## Chalkfile で作った講座

| 講座 | 中身 | 長さ |
|---|---|---|
| [Stripe サブスク課金 基礎講座](https://sean-sunagaku.github.io/chalkfile/stripe-billing/) | Stripe のサブスク課金の概念とデータの形、架空の「サンプルアプリ」で作る流れ（Checkout・Webhook・DB との同期・判定・Customer Portal・テスト）、お金・法律・iOS | 13 本・約 56 分 |

- Stripe 講座の事実は、2026 年 10 月に読んだ Stripe 公式ドキュメント（API リファレンスと changelog。API は 2026-09-30.endive、stripe-python は 16.0.1 の頃）と、消費者庁・Apple の公式ページがもとです。料金・API・法律は変わるので、実装の前に公式で確かめ直してください
- Stripe 社とは関係のない、個人の勉強用の講座です。法律や税の判断は専門家に確かめてください

講座サイトでは、動画のほかに台本（検索できる）・チャプター・字幕・確認クイズ・公式ドキュメントへのリンク・自分用のメモが使えます。進み具合とメモはブラウザに保存されます。

## 作り方

台本 → 声 → 動画 → サイト の順に、全部コマンドで作ります。

1. **調べる**: 公式ドキュメントと一次情報を読み、確かめた日と版を残す
2. **台本と図を書く**: `content/<講座>/L01.ts` などに、場面ごとの台詞と、台詞に合わせて出す図を書く
3. **声を付ける**: `scripts/synth.ts` が VOICEVOX で台詞を読み上げ、場面と台詞の時刻を決める
4. **動画にする**: `scripts/render.sh` が Remotion で映像を書き出し、`scripts/mix.py` の音（ナレーション・BGM・効果音）と合わせる
5. **公開する**: `scripts/build_site.ts` が講座サイトを組み立て、`scripts/deploy_pages.sh` が GitHub Pages に出す

詳しい手順と、画面と話し方の決まり、調べ方は、Claude Code のスキル [`.claude/skills/study-video-course`](.claude/skills/study-video-course/SKILL.md) にまとめています。このリポジトリを Claude Code で開くと、「新しい講座を作りたい」「L05 の台詞を直したい」のように頼めます。

## 作り直す

前提: Node.js、[bun](https://bun.sh/)、ffmpeg、[uv](https://docs.astral.sh/uv/)、[VOICEVOX](https://voicevox.hiroshiba.jp/)（エンジンが `127.0.0.1:50021` で動いていること）

```bash
npm install
uv run --with numpy --with scipy python scripts/build_music.py   # BGM・効果音（約 13 秒）
bun scripts/synth.ts                                            # ナレーションと時刻（初回は数分、以後は変えた台詞だけ）
uv run --with numpy --with scipy python scripts/mix.py          # 音のミックス（1 本 10 秒ほど）
bash scripts/render.sh                                          # 動画（1 本 2〜3 分）
bun scripts/build_site.ts                                       # 講座サイト（site/dist）
bun scripts/serve.ts                                            # 手元で見る（http://127.0.0.1:8765/）
```

一部だけ作り直すときは、`synth.ts`・`mix.py`・`render.sh` に `L03 L05` のようにレクチャー ID を渡します。台詞を直したら synth → mix → render → build_site の順に流します。

- 場面だけ見たいとき: `npx remotion studio`（音なしで場面を確かめられる。`src/generated/timeline.json` は Git に入っている）
- 読みの確認: `synth.ts` が `.work/kana/<id>.txt` に台詞ごとの読み（カナ）を書く。誤読は `content/reading.ts` に足す
- 見た目の確認: `node scripts/stills.mjs L04:3 --mid` で、場面の中ほどと終わりを静止画にする
- ディスクの空きが少ないとき: `CHUNK=1200 bash scripts/render.sh L04`（1,200 フレームずつ書き出してつなぐ）

## 新しい講座を足す

1. `content/<講座 ID>/` に台本を置く。レクチャー ID は講座をまたいで重ならない頭文字にする（Stripe 講座は `L01`〜）
2. `content/index.ts` の `COURSES` に講座を足す
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
| `content/index.ts` | 講座の一覧（名前・セクション・レクチャーの並び） |
| `content/stripe-billing/L01.ts`〜`L13.ts` | Stripe 講座の台本と画面構成 |
| `content/types.ts` | 台本の型（場面の種類と、台詞に合わせて出す要素） |
| `content/reading.ts` | 読み上げ用の読み（英字をカナに開く・誤読しやすい語） |
| `src/` | Remotion の動画（`Lecture.tsx` が場面を並べ、`scenes/` が場面の種類ごとに描く） |
| `scripts/` | 音楽・合成・ミックス・書き出し・サイト・公開のスクリプト |
| `site/` | 講座サイトのひな形（`template.html` が講座、`home.html` が一覧）と設定（`config.json`） |
| `.claude/skills/study-video-course/` | 作り方・スタイル・調べ方をまとめた Claude Code のスキル |

生成物（`.work/`・`public/audio/`・`out/`・`site/media/`・`site/data/`・`site/dist/`）は Git に入れません。

## クレジットとライセンス

- コードと台本: [MIT License](LICENSE)
- ナレーション: VOICEVOX:No.7、VOICEVOX:青山龍星。音声を使うときは、各キャラクターの利用規約に従ってクレジットを書く
- 動画: [Remotion](https://www.remotion.dev/)。Remotion のライセンスは別で、個人と小さな会社は無料、大きな会社で使うときは[ライセンス](https://www.remotion.dev/license)が要る
- BGM・効果音: `scripts/build_music.py` が numpy で合成したオリジナル
- フォント: Noto Sans JP、JetBrains Mono（SIL Open Font License）
- サービス名は各社の商標です
