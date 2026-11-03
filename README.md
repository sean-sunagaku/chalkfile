# Chalkfile

台本（コード）から、ナレーション付きの講座動画と講座サイトを作ります。

講座を TypeScript の台本として書くと、VOICEVOX の声、Remotion の動画、静的な講座サイト（動画・台本・字幕・確認クイズ）までをコマンドで作れます。台本は何度でも直して作り直せます。調べ方と書き方は Claude Code のスキルにまとめてあるので、Claude Code と一緒に講座を作れます。

**サイト: https://chalkfile.com/**（日本語を公開。英語・中国語の訳は未公開）

Cloudflare Workers の設定は `wrangler.jsonc`、動画受付は `worker/src/index.ts` です。`npm ci --ignore-scripts` → 素材と教材の生成 → `bun scripts/build_site.ts --strict` → `npm run dev:worker` で、ルート `/` と SW scope `/` を確認します。サイトは静的 assets、動画は `/media/` に分け、MP4 は assets へアップロードしません。Workers は無料プランを維持します。

機密情報は commit・push・公開物・ログに入れません。API トークンは GitHub の production environment secret、アカウント ID は vars に置きます。認証情報を設定ファイルや会話に貼らないでください。

動画は手元の `site/media/` から `bun scripts/media.ts push` で GitHub Releases へ先に置きます。講座×言語のタグ `media-ja-<講座>` と、中身の SHA-256 を含むファイル名を使い、確認後に `site/media-manifest.json` を更新します。`bun scripts/media.ts check` は公開asset・サイズ・GitHub提供のSHA-256と、手元にある動画のSHA-256を照合します。変更のない動画は送り直さず、古いハッシュのassetは自動削除しません。CIはcheckだけを実行します。

Worker の `/media/` はこの一覧だけを中継します。GET と HEAD を受け、Range / If-Range 以外のリクエストヘッダーを上流へ送りません。元の Releases URL から期限つきredirectを毎回たどり、本文をstreamのまま返します。通常再生は `video/mp4`、単体保存の `?download=1` だけに attachment を付けます。配信元の404は404、通信や5xxは502になり、失敗を長期キャッシュしません。

講座は英語と中国語（簡体字）にもできます。声・画面の文字・図の文字・字幕・講座サイトの UI まで言語ごとに切り替わり、お笑いの掛け合いは直訳せずに言語ごとに作り直しています（下の「多言語（英語・中国語）」）。

まだ初期の段階です。今は講座を作るためのリポジトリで、エンジン（動画とサイトを作る部分）をパッケージと CLI に分けるのが次の段階です。

## Chalkfile で作った講座

| 講座 | 中身 | 長さ |
|---|---|---|
| [Stripe サブスク課金 基礎講座](https://chalkfile.com/stripe-billing/) | Stripe のサブスク課金の概念とデータの形、架空の「サンプルアプリ」で作る流れ（Checkout・Webhook・DB との同期・判定・Customer Portal・テスト）、お金・法律・iOS | 13 本・約 56 分 |
| [ナッジ理論をプロダクト改善に活かす](https://chalkfile.com/nudge-product/)（`nudge-product`） | 選択アーキテクチャ・デフォルト・フレーミング・社会的規範・フィードバック・手間、ダークパターンとの境界、行動 → 障壁 → 施策 → 検証 | 7 章・約 51 分 |
| [エンジニアのための UI・UX デザイン](https://chalkfile.com/uiux-engineers/)（`uiux-engineers`） | 目的・情報設計・流れ・優先順位・余白・文字・色・フォーム・エラー・アクセシビリティ、問題発見 → 改善案 → プロトタイプ → 利用者テスト | 8 章・約 59 分 |
| [個人開発者のためのマーケティング](https://chalkfile.com/indie-marketing/)（`indie-marketing`） | 顧客理解・課題の検証・対象顧客・ポジショニング・価値の伝え方・価格・集客・継続・効果測定、売上と利益、少ないデータの読み方 | 8 章・約 60 分 |
| [笑って覚えるナッジ理論](https://chalkfile.com/nudge-comedy/)（`nudge-comedy`。英語・中国語の訳あり（未公開） | ナッジ講座のお笑い版。ずんだもん（ボケ）・先生（ツッコミ）・天の声の掛け合いで、ナッジと強制・お金・ダークパターンの違い、良いナッジの 3 つの条件を覚える（中身と出典は真面目版と同じ） | 1 章（試作）・約 8 分 |
| [笑ってわかる Rive アニメーション](https://chalkfile.com/rive-comedy/)（`rive-comedy`。英語・中国語の訳あり（未公開） | Rive をざっくり知るお笑い版（ずんだもん・先生・天の声）。エディタとランタイム、.riv、ステートマシン、対応する環境と注意点 | 1 本・約 4 分 |
| [笑ってわかる pstack](https://chalkfile.com/pstack-comedy/)（`pstack-comedy`。英語・中国語の訳あり（未公開） | Cursor 向けのスキル集 pstack をざっくり知るお笑い版（ずんだもん・先生・天の声）。考え方、始め方（/add-plugin・/setup-pstack・/poteto-mode）、手順書、主なスキル（/tdd・/interrogate・/arena・/unslop）と使う前の注意 | 1 本・約 5 分 |
| [笑ってわかる Super-agent](https://chalkfile.com/superagent-comedy/)（`superagent-comedy`。英語・中国語の訳あり（未公開） | DeepSeek Harness チームの設計記事「Exploring Super-agent Design」を読み解くお笑い版（ずんだもん・先生・天の声。先生のボケ、見ている人が参加するふるいゲームも）。会話（セッション）に縛られないエージェントの 4 つの性質と 5 つの部品（二層構造・イベント駆動・全二重とチャンネル・計算と状態と環境の分離・Watchdog）、記事の予備の実験、残る課題 | 6 章・約 47 分 |
| [笑ってわかる GA4](https://chalkfile.com/ga4-comedy/)（`ga4-comedy`） | GA4（Google アナリティクス 4）を短く知るお笑い版（ずんだもん・先生・天の声。先生のボケ、見ている人が参加する問題も）。イベントとパラメータ、ディメンションと指標、サイトが送る項目名（email_entry）と値（signature）、それを「メールの入口」として見るカスタム ディメンションの設定と、保存の後の注意 | 3 章・約 10 分 |

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

保存対象はこのサイトで公開している、閲覧権限と保存許可のある自作教材・同一 origin の MP4 です。外部動画・外部ドキュメント・DRM・認証やアクセス制限のある配信は対象にしません。chalkfile.com の静的教材と、同じ origin の `/media/` で受け付ける動画を保存します。動画はマニフェストのサイズとSHA-256を確かめてから保存します。

## 多言語（英語・中国語）

日本語の台本が正本で、英語（en）と中国語（zh・簡体字）は、日本語の台本に「訳の上書き」を重ねて作ります。いま訳があるのは、お笑い版の 4 講座（笑って覚えるナッジ理論・笑ってわかる Rive アニメーション・笑ってわかる pstack・笑ってわかる Super-agent。動画 9 本 × 2 言語）です。

- 訳のファイル: `content/<講座>/<言語>/<レクチャー ID>.ts`（場面と画面の要素は日本語と同じ数・順で文字だけを書き、台詞は言語ごとに書き直す）と `content/<講座>/<言語>/course.ts`。`content/index.ts` の `TRANSLATIONS` に並べる。重ね方は `content/i18n.ts`
- 声: 英語と中国語は [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M)（Apache-2.0。手元で動く）。先生・ずんだもん・天の声・呼び込みに別々の声を当てています（`scripts/voices.ts` の `KOKORO`）。訳の版のずんだもんは VOICEVOX:ずんだもんの声ではありません
- 動画の名前: `S01.en.mp4`・`S01.en.cc.mp4`（字幕を焼き込んだ版）・`S01.zh.mp4` など。Remotion のコンポジションは `S01-en`
- サイト: 日本語は今までどおり `/chalkfile/<講座>/`、訳は `/chalkfile/en/<講座>/`・`/chalkfile/zh/<講座>/`。ページの上の切り替えで言語を移れます。訳の一覧には、まだ訳していない講座を「日本語だけ」で並べます
- 動画の置き場所と公開: 公開先は chalkfile.com の Cloudflare Worker（動画は GitHub Releases に置き、Worker が `/media/` で範囲を中継する。2026-11-02 に決定、SUN-1647）に移します。それまで訳は公開しません（`site/config.json` の `publishLangs` が `["ja"]`）。訳の動画の向き先は `site/config.json` の `media` で差し替えます（いまは手元で確かめるための仮の場所）
- 読みの確認: 英語と中国語は Whisper で聞き取り直して、読み間違いと中国語の多音字の読みを一覧にします（`uv run --locked --script scripts/check_speech.py <key>`）

```bash
bun scripts/i18n.ts try superagent-comedy en S03   # 訳のファイルを 1 本だけ確かめる（重ね方・訳し残し・点検・長さ）
bun scripts/i18n.ts stamp 'S03.*'                  # 訳したときの日本語の台本の指紋を書く
npm run synth -- S03.en S03.zh                     # 声と時刻（足りない台詞は Kokoro でまとめて読む。初回はモデルのダウンロード）
uv run --locked --script scripts/check_speech.py S03.en S03.zh   # 聞き取りの点検
npm run mix -- S03.en S03.zh
CAPTIONS=1 npm run render -- S03.en S03.zh
npm run build:site                                 # site/dist/en/… と、訳の動画の site/dist-media/<言語>/…
bun scripts/i18n.ts status                          # 訳の表（訳あり・日本語の台本が変わった・未訳）と訳し残し
```

詳しい書き方・声・確かめ方は、スキルの [i18n.md](.claude/skills/study-video-course/references/i18n.md) です。

## 作り方

台本 → 声 → 動画 → サイト の順に、全部コマンドで作ります。

1. **調べる**: 公式ドキュメントと一次情報を読み、確かめた日と版を残す
2. **台本と図を書く**: `content/<講座>/L01.ts` などに、場面ごとの台詞と、台詞に合わせて出す図を書く
3. **声を付ける**: `scripts/synth.ts` が VOICEVOX で台詞を読み上げ、場面と台詞の時刻を決める
4. **動画にする**: `scripts/render.sh` が Remotion で映像を書き出し、`scripts/mix.py` の音（ナレーション・BGM・効果音）と合わせる
5. **公開する**: `scripts/build_site.ts` が講座サイトを組み立て、GitHub Actions と固定版 Wrangler が chalkfile.com に出す（動画は先に Releases へ置く）

詳しい手順と、画面と話し方の決まり、調べ方、テーマの作り方は、Claude Code のスキル [`.claude/skills/study-video-course`](.claude/skills/study-video-course/SKILL.md) にまとめています。共通プロンプトにテーマ別の指示を付けて講座を丸ごと作る手順（章ごとのサブエージェントで並行して作る方法を含む）は [`.claude/skills/course-from-prompt`](.claude/skills/course-from-prompt/SKILL.md) です。このリポジトリを Claude Code で開くと、「新しい講座を作りたい」「L05 の台詞を直したい」のように頼めます。

## 作り直す

前提: Node.js、[bun](https://bun.sh/)、ffmpeg、[uv](https://docs.astral.sh/uv/)、[VOICEVOX](https://voicevox.hiroshiba.jp/)（エンジンが `127.0.0.1:50021` で動いていること）。英語・中国語の声は uv が Kokoro を用意します（初回に Python の道具とモデルの重みを取ってくる）

版は次のファイルに書いてあります（CI も、Node.js と bun は同じファイルを読みます）。

- Node.js は `.node-version`、bun は `.bun-version`、Python は `.python-version`
- npm の依存は `package-lock.json`。Python の依存は `pyproject.toml` と `uv.lock`（Kokoro と Whisper は、スクリプトの頭と `scripts/<名前>.py.lock`）
- 手元の版は [mise](https://mise.jdx.dev/) でそろえられます（任意）。`mise settings add idiomatic_version_file_enable_tools node`（bun・python も同じように足す）で、上の 3 つのファイルを読むようになります

コマンドの入口は `package.json` の scripts です（`npm run` だけを流すと一覧が出ます）。道具の役割は次のとおりです。

| 道具 | 役割 |
|---|---|
| npm | 依存を入れる（`npm ci --ignore-scripts`）・`package-lock.json`・コマンドの入口（`npm run …`） |
| bun | TypeScript のスクリプト（合成・教材・サイト・点検）と単体テスト |
| node | Remotion（書き出し・静止画・Studio）と Playwright（ブラウザのテスト） |
| uv | Python（BGM・効果音・音のミックス、Kokoro・Whisper） |

```bash
npm ci --ignore-scripts
npm run build:music        # BGM・効果音（約 13 秒）
npm run synth              # ナレーションと時刻（初回は数分、以後は変えた台詞だけ）
npm run mix                # 音のミックス（1 本 10 秒ほど）
npm run render             # 動画（1 本 2〜3 分）
npm run check:content      # 台本とファイルの点検（公開の前に必ず）
npm run build:materials    # 読む教材・絵コンテ・AI チャット用のチャンク（docs/courses）
npm run build:site         # 講座サイト（site/dist）
npm run serve              # 手元で見る（http://127.0.0.1:8765/）
```

初めての書き出しで Remotion が Chrome Headless Shell をダウンロードしたまま止まるとき（Node.js 26 で、展開が終わらない）は、[pipeline.md のハマりどころ](.claude/skills/study-video-course/references/pipeline.md) の手順で手で展開します。

一部だけ作り直すときは、`npm run synth -- L03 L05` のように、`--` のあとにレクチャー ID を渡します（mix・render も同じ）。台詞を直したら synth → mix → render → build_site の順に流します。

- 場面だけ見たいとき: `npm run studio`（音なしで場面を確かめられる。`src/generated/timeline.json` は Git に入っている）
- 読みの確認: `synth.ts` が `.work/kana/<id>.txt` に台詞ごとの読み（カナ）を書く。誤読は `content/reading.ts` に足す
- 音声の鍵と読みの網: `npm test` が、全台詞の音声の鍵・読み（と、訳がある動画の訳の指紋）を `tests/fixtures/snapshots/`（動画 1 本に 1 ファイル）と照らし合わせ、変わった動画と台詞を出す。台詞・`reading.ts`・声をわざと変えたときや、動画を足したときは `bun scripts/snapshots.ts --update` で作り直し、PR に「合成し直しが要る」と書く（[説明](tests/fixtures/snapshots/README.md)）
- 見た目の確認: `npm run stills -- L04:3 --mid` で、場面の中ほどと終わりを静止画にする
- 公式ドキュメントとの突き合わせ: `bun scripts/check_overlap.ts stripe-billing --query=locale=ja-JP`（台本と、レクチャーの `docs` に並べた公式ページで、言い回しが続けて同じところを探す。ネットにつなぐ）
- ディスクの空きが少ないとき: `CHUNK=1200 npm run render -- L04`（1,200 フレームずつ書き出してつなぐ）

## 素材から作り直す（VOICEVOX なし）

台詞の音声（VOICEVOX の出力）と、BGM・ジングル・効果音は、素材だけを置くブランチ [`materials`](https://github.com/sean-sunagaku/chalkfile/tree/materials) にあります（音声は FLAC で約 390MB。main の履歴には入れません）。取り出せば、台詞を変えていない章は VOICEVOX なしで、動画と講座サイトまで作り直せます。

前提: Node.js、bun、ffmpeg、uv（VOICEVOX は要りません）

```bash
npm ci --ignore-scripts
npm run materials:pull                          # 台詞の音声を .work/tts/ に、BGM・効果音を public/audio/ に取り出す
npm run synth -- --cached-only                  # 不足時は停止。VOICEVOX/Kokoroへ接続しない
npm run mix                                     # 音のミックス
npm run render                                  # 動画（CAPTIONS=1 を付けると、字幕を焼き込んだ版も作る。サイト用の <id>.cc.mp4 も）
npm run build:materials && npm run build:site   # 読む教材と講座サイト
```

- `pull` は FLAC を WAV に戻し、ブランチの `SHA256SUMS` と同じ中身かを確かめます。1 つの講座だけなら `bun scripts/materials.ts pull nudge-product`
- 動画を書き出さずに講座サイトだけ組むとき: `bun scripts/materials.ts pull --videos`（Releases の動画も SHA-256 を確かめて `site/media/` に取り出す。ポスターは `site/posters/`）→ `bun scripts/synth.ts` → `bun scripts/build_site.ts`
- 手元の音声が台本に足りているか: `bun scripts/materials.ts check`（足りない台詞は、VOICEVOX を動かして `synth.ts` が作る）
- 素材を足す（台詞を直した後）: 台本をコミットして synth まで流し、`bun scripts/materials.ts push`（`--dry-run` で、足す・変える・同じ・残すの本数だけを見る）。**push は足すだけ**で、手元の台本に無い講座の素材は消しません。HEAD が origin/main を含まないと止まります。マージで走る公開が素材を取り出すので、PR をマージする前に push します
- **消すのは gc だけ**: `bun scripts/materials.ts gc` は、origin/main（`--keep` で変えられる）の台本が使わない台詞の音声を一覧にするだけです。消すのは `--confirm` を付けたときだけで、持ち主が流します。push のコミットは前の版を親にし（送るのは新しい素材だけ）、gc は親の無い 1 コミットにして、それまでの履歴を切ります
- 素材と動画のブランチを持ってこないで clone するとき: `git clone --single-branch https://github.com/sean-sunagaku/chalkfile.git`

## サイト変更の検証

```bash
npm ci --ignore-scripts
npm run check                             # 型・単体テスト・台本とファイルの点検（CI と同じ。動画なしで流せる）
npm run build:site -- --strict            # site/data・posters・Releases の一覧が必要。手元の MP4 は任意
npm run test:e2e                          # 実 Chrome と、Stripe 講座の生成済み 13 本の動画を使う（test:browser と同じ）
```

専用の lint スクリプトはありません。CI は型検査（Remotion・台本、PWA のブラウザ/worker、scripts・tests）、Range・保存対象テスト、content 点検を行います（`npm run check` と同じ）。実ブラウザのテストはローカルの生成物が必要なため、CI の content 点検だけで再生成功とは扱いません。`PW_CHANNEL=chromium npm run test:browser` なら Playwright の Chromium も選べます（別途そのブラウザが必要）。通常はインストール済みの Chrome を一時プロファイルで使います。

ブラウザテストは `127.0.0.1:8877/chalkfile/` に本物の build 出力を配り、オンライン/オフライン、全保存・削除、Range の応答とバイト一致、実動画の再生・停止・シーク・繰り返し、ブラウザ完全終了からの再起動、教材/worker 更新、保存欠損を確認します。容量不足は Cache API の例外、通信失敗・206・破損・途中データ・リダイレクト・キャンセルはテストサーバーで再現します。物理的なディスク枯渇や iOS 実機検証の代わりではありません。証跡は既定で `/tmp/chalkfile-pwa-evidence/` に置き、動画や証跡を main に入れません。`CHALKFILE_EVIDENCE_DIR` で保存先を変えられます。

通常の手元確認はルート `/` の `npm run serve` または `npm run dev:worker` を使います。旧scope `/chalkfile/` の互換性は移行テストで確認します。localhost以外はHTTPSが必要です。

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
- 書き出す前に試す: `node scripts/stills.ts L02:3 L03:3 --theme=<id>`（講座のテーマを変えずに、そのテーマで静止画を描く）
- 項目の意味と確かめ方は [スキルの theme.md](.claude/skills/study-video-course/references/theme.md)
- 実在のブランドに寄せるときは、色の雰囲気までにする。テーマの名前に会社名を付けず、ロゴ・社名の書体は使わない

## 新しい講座を足す

1. `content/<講座 ID>/` に台本を置く。レクチャー ID は講座をまたいで重ならない頭文字にする（Stripe 講座は `L01`〜）
2. `content/index.ts` の `COURSES` に講座を足す。テーマを変えるなら `theme` も書く
3. 「作り直す」を、その講座のレクチャー ID で流す
4. 一覧ページ（`site/dist/index.html`）にカードが増え、講座のページは `site/dist/<講座 ID>/` にできる

## 公開（Workers / Releases）

動画を作り直したら、手元で `bun scripts/check_content.ts --require-denylist` → `bun scripts/media.ts push` → `bun scripts/media.ts check` を先に実行し、マニフェストとポスターをコミットします。mainへのpushまたはmainを選んだActionsの手動実行で、素材取得・キャッシュ済み音声からの講義データ生成・型/単体/安全点検・Releases照合・strict buildを行ってからWranglerで公開します。動画が不足していたら止まります。

設定・最小権限token・production environment・復旧を含む手順は [docs/workers-delivery.md](docs/workers-delivery.md)、実公開の保存・移行・無料枠測定の結果と確認範囲・残作業は [検証記録](docs/workers-verification.md) にあります。API tokenはGitHubのproduction secretにだけ入力し、値を会話やリポジトリへ貼らないでください。

`bash scripts/legacy/deploy_pages.sh` は、旧 https://sean-sunagaku.github.io/chalkfile/ を移行案内だけに置き換える専用手順です。通常公開には使いません。旧保存cacheを残したまま、オンラインでは同じpath/query/hashの新サイトへ案内し、オフラインでは保存版を表示して保存し直しを案内します。保存と学習記録は異なるoriginへ自動移行しません。

サイト・ポスターはWorkers assets、動画はReleasesから同じoriginのWorker経由で配ります。静的出力は2万ファイル/1ファイル25MiB以内を点検し、MP4を含めません。Workers Freeを維持し、広告・Terraform・有料の保存先を導入しません。

## フォルダ

| パス | 中身 |
|---|---|
| `content/index.ts` | 講座の一覧（名前・テーマ・セクション・レクチャーの並び） |
| `content/themes.ts` | テーマ（トンマナ）の定義 |
| `content/stripe-billing/L01.ts`〜`L13.ts` | Stripe 講座の台本と画面構成 |
| `content/types.ts` | 台本の型（場面の種類と、台詞に合わせて出す要素） |
| `content/i18n.ts`・`content/<講座>/<言語>/` | 多言語の型と重ね方・訳のファイル（英語 `en`・中国語 `zh`） |
| `content/reading.ts` | 読み上げ用の読み（英字をカナに開く・誤読しやすい語） |
| `src/` | Remotion の動画（`Lecture.tsx` が場面を並べ、`scenes/` が場面の種類ごとに描く。`theme.ts` がテーマの色と書体を差し込む） |
| `scripts/` | 音楽・合成・ミックス・書き出し・サイト・公開のスクリプト |
| `site/` | 講座サイトのひな形（`template.html` が講座、`home.html` が一覧）、言語ごとの決まった文字（`i18n.ts`）、設定（`config.json`）、動画の一覧（`media-manifest.json`）、ポスター（`posters/`）、一覧ページの画像（`assets/`）。色と書体は `scripts/site_theme.ts` がテーマから作る |
| `worker/`・`wrangler.jsonc` | `/media/` の中継とWorkers assets/Custom Domainの設定 |
| `.claude/skills/study-video-course/` | 作り方・スタイル・調べ方・テーマの作り方をまとめた Claude Code のスキル |

生成物（`.work/`・`public/audio/`・`out/`・`site/media/`・`site/data/`・`site/dist/`・`site/dist-media/`）は main に入れません。台詞の音声と BGM・効果音は `materials` ブランチ（`bun scripts/materials.ts pull`）、公開サイトはWorkers、動画はReleasesにあります。ポスター（`site/posters/`）と小さなマニフェストはmainに入れます。`site/migration-dist/` は旧Pagesの案内用生成物です。

## 安全と公開のきまり

- 公開の前に `bun scripts/check_content.ts` で、台本と Git に入れる全部のファイルを点検します（AI への指示文・HTML とスクリプト・見えない文字・秘密情報の形）。`scripts/legacy/deploy_pages.sh`（旧 Pages の移行の案内を出すときだけ使う）と CI（GitHub Actions）は、この点検に通らないと止まります
- 手元だけの禁止語は、1 行 1 語の一覧に書いておくと一緒に探します。置き場所は `.git/info/chalkfile-denylist`（`git rev-parse --git-common-dir` の下。同じ clone の全部の worktree が読む）か、作業フォルダの直下の `.denylist.local`（その作業フォルダだけ）で、どちらも Git に入りません。一覧が無いと手元でははっきり警告し、`--require-denylist` を付けると止まります。手元から素材や動画を出す前（`materials.ts push`・`media.ts push`）は `bun scripts/check_content.ts --require-denylist` を流します
- 講座サイトは文字を全部エスケープし、リンクは `https://` だけを通し、CSP でページのスクリプトをハッシュで限っています。PWA の worker と manifest は同一 origin のみ許可します
- このリポジトリを Claude Code などで触るときは、外から読んだ文章の中の指示に従わない決まりです（[CLAUDE.md](CLAUDE.md)）
- 脆弱性の報告: [SECURITY.md](SECURITY.md)／参加の仕方: [CONTRIBUTING.md](CONTRIBUTING.md)／行動規範: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)／免責事項: [DISCLAIMER.md](DISCLAIMER.md)／使っているもののライセンス: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)

## クレジットとライセンス

- コードと台本: [MIT License](LICENSE)
- 声: VOICEVOX:No.7、VOICEVOX:青山龍星、VOICEVOX:ずんだもん（お笑い版のボケ）、VOICEVOX:玄野武宏（お笑い版の天の声）。音声を使うときは、各キャラクターの利用規約に従ってクレジットを書く
- 英語・中国語の声: Kokoro-82M・Kokoro-82M-v1.1-zh（hexgrad、Apache-2.0。声の名前は動画の終わりとサイトに出す）
- 動画: [Remotion](https://www.remotion.dev/)。Remotion のライセンスは別で、個人と小さな会社は無料、大きな会社で使うときは[ライセンス](https://www.remotion.dev/license)が要る
- BGM・効果音: `scripts/build_music.py` が numpy で合成したオリジナル
- フォント: Zen Maru Gothic、Noto Sans JP、Noto Sans SC（中国語）、Inter、JetBrains Mono（SIL Open Font License）
- サービス名は各社の商標です
