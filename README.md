# Chalkfile

台本（コード）から、ナレーション付きの講座動画と講座サイトを作ります。

講座を TypeScript の台本として書くと、VOICEVOX の声、Remotion の動画、静的な講座サイト（動画・台本・字幕・確認クイズ）までをコマンドで作れます。台本は何度でも直して作り直せます。調べ方と書き方は Claude Code のスキルにまとめてあるので、Claude Code と一緒に講座を作れます。

**サイト: https://sean-sunagaku.github.io/chalkfile/**

まだ初期の段階です。今は講座を作るためのリポジトリで、エンジン（動画とサイトを作る部分）をパッケージと CLI に分けるのが次の段階です。

## Chalkfile で作った講座

| 講座 | 中身 | 長さ |
|---|---|---|
| [Stripe サブスク課金 基礎講座](https://sean-sunagaku.github.io/chalkfile/stripe-billing/) | Stripe のサブスク課金の概念とデータの形、架空の「サンプルアプリ」で作る流れ（Checkout・Webhook・DB との同期・判定・Customer Portal・テスト）、お金・法律・iOS | 13 本・約 56 分 |
| [ナッジ理論をプロダクト改善に活かす](https://sean-sunagaku.github.io/chalkfile/nudge-product/)（`nudge-product`） | 選択アーキテクチャ・デフォルト・フレーミング・社会的規範・フィードバック・手間、ダークパターンとの境界、行動 → 障壁 → 施策 → 検証 | 7 章・約 51 分 |
| [エンジニアのための UI・UX デザイン](https://sean-sunagaku.github.io/chalkfile/uiux-engineers/)（`uiux-engineers`） | 目的・情報設計・流れ・優先順位・余白・文字・色・フォーム・エラー・アクセシビリティ、問題発見 → 改善案 → プロトタイプ → 利用者テスト | 8 章・約 59 分 |
| [個人開発者のためのマーケティング](https://sean-sunagaku.github.io/chalkfile/indie-marketing/)（`indie-marketing`） | 顧客理解・課題の検証・対象顧客・ポジショニング・価値の伝え方・価格・集客・継続・効果測定、売上と利益、少ないデータの読み方 | 8 章・約 60 分 |
| [笑って覚えるナッジ理論](https://sean-sunagaku.github.io/chalkfile/nudge-comedy/)（`nudge-comedy`） | ナッジ講座のお笑い版。ずんだもん（ボケ）・先生（ツッコミ）・天の声の掛け合いで、ナッジと強制・お金・ダークパターンの違い、良いナッジの 3 つの条件を覚える（中身と出典は真面目版と同じ） | 1 章（試作）・約 8 分 |
| [笑ってわかる Rive アニメーション](https://sean-sunagaku.github.io/chalkfile/rive-comedy/)（`rive-comedy`） | Rive をざっくり知るお笑い版（ずんだもん・先生・天の声）。エディタとランタイム、.riv、ステートマシン、対応する環境と注意点 | 1 本・約 4 分 |
| [笑ってわかる pstack](https://sean-sunagaku.github.io/chalkfile/pstack-comedy/)（`pstack-comedy`） | Cursor 向けのスキル集 pstack をざっくり知るお笑い版（ずんだもん・先生・天の声）。考え方、始め方（/add-plugin・/setup-pstack・/poteto-mode）、手順書、主なスキル（/tdd・/interrogate・/arena・/unslop）と使う前の注意 | 1 本・約 5 分 |

ナッジ・UI/UX・マーケティングの 3 講座は、動画に加えて、章ごとの読む教材・絵コンテ・実践課題（回答例・評価基準）・AI チャットの質問例を持ちます（`docs/courses/`、作り方は [materials.md](.claude/skills/study-video-course/references/materials.md)）。

- Stripe 講座の事実は、2026 年 10 月に読んだ Stripe 公式ドキュメント（API リファレンスと changelog。API は 2026-09-30.endive、stripe-python は 16.0.1 の頃）と、消費者庁・Apple の公式ページがもとです。料金・API・法律は変わるので、実装の前に公式で確かめ直してください
- Stripe 社とは関係のない、個人が作った非公式の講座です。法律や税の判断は専門家に確かめてください（[DISCLAIMER.md](DISCLAIMER.md)）
- 講座とコードは AI（Claude Code）を使って作り、事実は人が出典を開いて確かめています
- 説明は、公式ドキュメントで確かめた事実を自分の言葉で書いたものです。公式の文章・図・画面写真は写していません（台本と、出典にした公式ページ 43 本を `scripts/check_overlap.ts` で突き合わせています）

講座サイトでは、動画のほかに台本（検索できる）・チャプター・字幕・確認クイズ・公式ドキュメントへのリンク・自分用のメモが使えます。進み具合とメモはブラウザに保存されます。字幕は「字幕」ボタン（C キー）でオン・オフできます。字幕を焼き込んだ版があるレクチャー（お笑い版の講座）は、字幕オンのときその版を流すので、全画面でも字幕が見えます。

## 講座を保存してオフラインで学ぶ（PWA）

1. オンラインで使いたい講座を開き、「この講座をアプリ内に保存」を選びます。保存前に対象と合計サイズが表示されます。画面を開いたまま「保存済み・教材と全動画」の表示まで待ってください。表示するだけでは動画を一括取得しません。
2. 通信を切って、講座一覧または保存した講座を開き直します。保存済みなら台本・字幕・チャプター・確認クイズ・ノート・全動画を使えます。未保存の講座と外部の公式ドキュメントには通信が必要です。
3. 「保存を削除」でその講座の教材・動画・以前の保存版を削除できます。ノート・学習進捗・クイズの回答は別に保存しているため残ります。

保存中は進捗と「保存をキャンセル」が表示されます。容量不足、通信失敗、サイズ・ハッシュの不一致、途中終了は成功扱いにしません。未完了の保存は片付け、オンラインで保存ボタンから全体を再試行します。複数タブからの重複保存は受け付けません。推定容量は同一 origin 全体の値で、利用可能な空き容量の保証ではありません。

起動時の案内は、保存状態の確認が終わると「保存済み」「未保存」「不完全」に応じて切り替わります。不完全でも前の完全な版が残っていれば、その版を利用できると案内します。状態の再確認で、保存中の進捗・通信エラー・保存や削除の結果を消さないようにしています。

保存版には画面のコードも含まれます。表示の修正も、オンラインで新しい版を確認して更新保存した教材に反映されます。

更新は「更新を確認」→「新しい版に更新して保存」で明示的に選びます。保存してある講座はオンラインでもその保存版の教材と動画で開きます。新しい版の全ファイルを検証してから切り替えるので、更新の失敗時も以前の完全な保存を利用できます。成功後は「保存した版を開く」で開き直します。開いている旧版のタブのために直前の完全な版も1つ保持し、さらに古い版は次の更新時に削除します。更新には新しい1版分の追加容量が必要です。保存に日数による期限は設けず、アプリの更新でも削除しません。ブラウザによるデータ消去・容量逼迫・長期間の未使用・サイトデータの削除などで失われることはあります。欠損を検出した場合は再保存を案内します。

「保存・アプリ」からインストール案内を開けます。対応する Chromium ブラウザではインストールボタンが表示され、ほかはブラウザのメニューを案内します。iPhone・iPad は Safari の共有メニューから「ホーム画面に追加」を選び、「Webアプリとして開く」がある場合は有効にしてください。インストールと講座の保存は別操作です。

| 操作 | 保存されるもの | 通信なしの利用 |
|---|---|---|
| 通常の動画再生 | ブラウザの通常キャッシュに任される | この機能では保証しない |
| 動画ファイルをダウンロード | 対応ブラウザのダウンロード先に MP4 単体 | 保存したファイルを対応プレーヤーで開く。講座全体のアプリ内保存にはならない |
| この講座をアプリ内に保存 | 教材ページ・全 MP4・ポスター。字幕とクイズ等は教材内に含む | 保存版の教材と動画をこのサイト内で利用できる |

iOS もブラウザの保存領域を使い、「ファイル」アプリの動画を取り込む機能はありません。ブラウザとホーム画面アプリの保存が共有されるとは限らないため、実際に使う方で保存し、機内モードで起動・シーク・再生を確かめてください。`navigator.storage.persist()` による保持要求はブラウザが判断し、拒否される場合もあります。実機での保存維持・バックグラウンド保存・すべてのブラウザでの動作は保証しません。設計と一次資料は [offline.md](.claude/skills/study-video-course/references/offline.md) にあります。

保存対象はこのサイトで公開している、閲覧権限と保存許可のある自作教材・同一 origin の MP4 です。外部動画・外部ドキュメント・DRM・認証やアクセス制限のある配信は対象にしません。配信先は既存の GitHub Pages のままです。

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
bash scripts/render.sh                                          # 動画（CAPTIONS=1 を付けると、字幕を焼き込んだ版も作る。サイト用の <id>.cc.mp4 も）
bun scripts/build_materials.ts && bun scripts/build_site.ts     # 読む教材と講座サイト
```

- `pull` は FLAC を WAV に戻し、ブランチの `SHA256SUMS` と同じ中身かを確かめます。1 つの講座だけなら `bun scripts/materials.ts pull nudge-product`
- 動画を書き出さずに講座サイトだけ組むとき: `bun scripts/materials.ts pull --videos`（公開中のサイト（`gh-pages`）の動画とポスターも `site/media/` に取り出す）→ `bun scripts/synth.ts` → `bun scripts/build_site.ts`
- 手元の音声が台本に足りているか: `bun scripts/materials.ts check`（足りない台詞は、VOICEVOX を動かして `synth.ts` が作る）
- 素材を新しくする（台詞を直した後）: 台本をコミットして synth まで流し、`bun scripts/materials.ts push`。`materials` ブランチを親の無い 1 コミットで置き換えます（前の版は残しません）
- 素材と動画のブランチを持ってこないで clone するとき: `git clone --single-branch https://github.com/sean-sunagaku/chalkfile.git`

## サイト変更の検証

```bash
npm ci --ignore-scripts
npm run typecheck                         # Remotion・台本と、PWA のブラウザ/worker コード
npm test                                  # Range の境界・保存対象の制約（動画なしで実行できる）
bun scripts/check_content.ts --self-test
bun scripts/check_content.ts
bun scripts/build_site.ts --strict         # site/data と全 MP4/JPG の生成が必要
npm run test:browser                       # 実 Chrome と、Stripe 講座の生成済み 13 本の動画を使う
```

専用の lint スクリプトはありません。CI は型検査、Range・保存対象テスト、content 点検を行います。実ブラウザのテストはローカルの生成物が必要なため、CI の content 点検だけで再生成功とは扱いません。`PW_CHANNEL=chromium npm run test:browser` なら Playwright の Chromium も選べます（別途そのブラウザが必要）。通常はインストール済みの Chrome を一時プロファイルで使います。

ブラウザテストは `127.0.0.1:8877/chalkfile/` に本物の build 出力を配り、オンライン/オフライン、全保存・削除、Range の応答とバイト一致、実動画の再生・停止・シーク・繰り返し、ブラウザ完全終了からの再起動、教材/worker 更新、保存欠損を確認します。容量不足は Cache API の例外、通信失敗・206・破損・途中データ・リダイレクト・キャンセルはテストサーバーで再現します。物理的なディスク枯渇や iOS 実機検証の代わりではありません。証跡は既定で `/tmp/chalkfile-pwa-evidence/` に置き、動画や証跡を main に入れません。`CHALKFILE_EVIDENCE_DIR` で保存先を変えられます。

GitHub Pages と同じサブパスで手動確認する場合は `PORT=8876 BASE_PATH=/chalkfile/ bun scripts/serve.ts` を使い、`http://127.0.0.1:8876/chalkfile/` を開きます。localhost 以外の配信には HTTPS が必要です。

初期案内・進捗・通信エラーの表示を変えた場合は、strict build後に `npm run test:browser -- tests/browser/offline-status.spec.ts` で対象回帰を実行できます。全動画の保存は一時profile内で1回にまとめ、ブラウザ完全終了後のオフライン起動、保存欠損、遅い通信エラーと保存進捗の競合、操作結果の保持を確認します。既存の全体回帰は、変更の影響範囲に応じて追加します。

公開後は、起動・保存・再起動・再生に加えて「動画ファイルをダウンロード」ボタン自体も確認します。保存検証に使った一時profileのキャッシュを残したまま通信を切り、MP4を1本だけダウンロードして完了・ファイル名・サイズ・SHA-256を照合します。大量の再取得を避け、ローカルでの成功と公開サイトでの成功を分けて記録してください。

## 講座ごとのテーマ（トンマナ）

色・書体・背景の飾りをテーマとしてまとめてあり、講座ごとに選べます。テーマは動画と講座サイトの両方に効きます。

| テーマ | 中身 |
|---|---|
| `chalkfile`（既定） | 明るい教室の黒板を裏返した配色。文字は黒板の深い緑、色はチョーク、コードだけ黒板の面。角の丸いゴシック（Zen Maru Gothic） |
| `indigo` | 白い地・紺の文字・紫の主役の色・右上の角を斜めに切るグラデーションの帯。英字は Inter（Stripe 講座のテーマ） |
| `night` | 最初の版の暗いテーマ。濃紺の地にピンクから水色のグラデーション |
| `stage` | お笑いの舞台のような配色。クリームの地に黒に近い文字、幕の赤と照明の黄色の帯（お笑い版の講座のテーマ） |

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
- 講座サイトは文字を全部エスケープし、リンクは `https://` だけを通し、CSP でページのスクリプトをハッシュで限っています。PWA の worker と manifest は同一 origin のみ許可します
- このリポジトリを Claude Code などで触るときは、外から読んだ文章の中の指示に従わない決まりです（[CLAUDE.md](CLAUDE.md)）
- 脆弱性の報告: [SECURITY.md](SECURITY.md)／参加の仕方: [CONTRIBUTING.md](CONTRIBUTING.md)／行動規範: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)／免責事項: [DISCLAIMER.md](DISCLAIMER.md)／使っているもののライセンス: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)

## クレジットとライセンス

- コードと台本: [MIT License](LICENSE)
- 声: VOICEVOX:No.7、VOICEVOX:青山龍星、VOICEVOX:ずんだもん（お笑い版のボケ）、VOICEVOX:玄野武宏（お笑い版の天の声）。音声を使うときは、各キャラクターの利用規約に従ってクレジットを書く
- 動画: [Remotion](https://www.remotion.dev/)。Remotion のライセンスは別で、個人と小さな会社は無料、大きな会社で使うときは[ライセンス](https://www.remotion.dev/license)が要る
- BGM・効果音: `scripts/build_music.py` が numpy で合成したオリジナル
- フォント: Zen Maru Gothic、Noto Sans JP、Inter、JetBrains Mono（SIL Open Font License）
- サービス名は各社の商標です
