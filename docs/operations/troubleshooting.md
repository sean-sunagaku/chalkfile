# ハマりどころ

困ったときの索引。症状ごとに、直し方を短く書く。詳しいことは、リンク先の正本を読む。

- 公開の順番は [公開の順番](publish.md)、止まった公開の戻し方は [戻し方](recovery.md)
- 講座を作るときのつまずき（読み・例の日付・モックの色・事実の確かめ方・並行で作るとき）は、スキルの [lessons.md](../../.claude/skills/course-from-prompt/references/lessons.md)

## 手元の準備

- **初めての書き出しで、Remotion が Chrome Headless Shell をダウンロードしたまま止まる**（Node.js 26 で起きた。何も出ないまま数分止まる。展開が終わらない）。手で展開して、版を書く。下は Apple シリコンの Mac の例。`157.0.8080.0-remotion-v3` は、今の Remotion（4.0.539）が待つ番号。Remotion を上げたら、`node_modules/@remotion/renderer/dist/browser/get-chrome-download-url.js` の `TESTED_VERSION` を見て合わせる（Remotion が配る版を使うときは、末尾に `-remotion-v3` が付く。`BrowserFetcher.js` の `getExpectedVersion`）。zip の名前も版で変わる（4.0.539 の Mac は `chromium-headless-shell-mac-arm64-157.0.8080.0.zip?clear`）

  ```bash
  cd node_modules/.remotion/chrome-headless-shell
  rm -rf mac-arm64 && mkdir mac-arm64 && unzip -q chromium-headless-shell-mac-arm64-*.zip* -d mac-arm64
  printf '157.0.8080.0-remotion-v3' > VERSION
  ```

- **手元の ffmpeg に、字幕の焼き込み（libass）が無い**: 字幕は Remotion で描くので要らない（`CAPTIONS=1 npm run render`）
- **英語・中国語の声で synth が止まる**: Kokoro は uv が用意する。uv を入れる（初回は Python の道具とモデルの重みを取ってくる）。台詞を変えていないなら、先に `npm run materials:pull`

## 声と読み

- **synth が、知らない英単語で止まる**: 講座の辞書 `content/<講座>/reading.ts` の `words` に読みを足す（どの講座でも同じ読みにしたい語は共通の `content/reading.ts`。[style.md](../../.claude/skills/study-video-course/references/style.md)）
- **台詞の表示を直しても、声が作り直されない**: 声のキャッシュは「読み上げる文と声」で決まる。台詞の表示（`t`）だけを変えても、読み（`s` か、読みの辞書で開いた文）が同じなら作り直さない
- **ほかの講座の読みまで変わった**: 共通の辞書 `content/reading.ts` は全部の講座で使う。講座の語は講座の辞書 `content/<講座>/reading.ts` に移す（その講座の台詞にだけ効く）。足したら `npm test`（音声の鍵と読みのスナップショット）と `npm run reading:diff`（main との読みの差分）で、変わった動画と台詞を見る。章だけの直しは、台詞の `s` に書く
- **読みを直したのに、動画の音が古い**: 書き出す前に `npm run materials:check` で、台本の全部の台詞の声が手元にあるかを見る

## 書き出し

- **Remotion が `public/` を一時フォルダへ写して、ディスクを埋める**: 書き出しのたびに `public/`（声で約 1GB）を写す。映像は音なしで書き出すので、`render.sh` と `stills.ts` は空の `.work/render-public` を渡している
- **書き出し中のフレームで、ディスクが埋まる**: 5 分の動画で 1〜2GB の JPEG を一時フォルダに置く。空きが少ないときは `CHUNK=1200 npm run render -- <ID>`（1,200 フレームずつ書き出して、最後につなぐ）
- **一時フォルダの `remotion-webpack-bundle-*` をまとめて消さない**: ほかのプロジェクトのものかもしれない。消すなら、中身（bundle.js にこの講座の文字があるか）を確かめて 1 つずつ
- **書き出しが遅い・CPU を取り合う**: 書き出しは 1 本ずつ流す（2 本を重ねると、それぞれ倍かかる）。並列の数は `CONCURRENCY=<コアの数より少なく>`。待ち方は [lessons.md](../../.claude/skills/course-from-prompt/references/lessons.md) の「並行で作るとき」
- **サイト用の動画が、大きさの上限を超えたと警告が出る**: 長い動画は、上限に収まらないことがある（[lessons.md](../../.claude/skills/course-from-prompt/references/lessons.md) の「台本」）

## サイトと保存

- **`python3 -m http.server` では、動画の途中に飛べない**: Range（部分取得）に答えないため。手元では `npm run serve`
- **ブラウザが古い動画を覚えている**: サーバーを替えたり動画を作り直したりしたあとは、別のポートで開くか、キャッシュを消して確かめる
- **アプリ内のブラウザ（Claude の Browser pane など）で、オフライン保存のパネルが「準備できません」と出る**: Service Worker を読み込めないため。保存は `npm run test:browser` か、公開した HTTPS のサイトで確かめる
- **ブラウザのテストが、ほかの作業フォルダのテストとぶつかる**: テストのサーバーの番号（8877）は 1 つなので、同時に 2 つ流さない。証跡の置き場所は `CHALKFILE_EVIDENCE_DIR` で分ける
- **同じ origin のほかのサイトと、localStorage が混ざる**: 講座サイトは、保存のキーに `chalkfile:<講座 ID>:` を付けている（旧 Pages は、同じ持ち主のほかのサイトと origin を分け合っていた）

## 素材と動画の push

- **`materials push` が止まる**: commit していない台本の変更があるか、HEAD が origin/main を含まない。commit して、main を取り込む（[公開の順番](publish.md) の 1・2）
- **`synth --cached-only` が、声が足りないと止まる**: `npm run materials:pull` で取り出す。新しい台詞なら、VOICEVOX を動かして synth し、`materials push` する（[戻し方](recovery.md) の「素材を作り直す」）
- **`media push` が「通常動画がありません」で止まる**: 選んだ講座（`--course`）の通常版が全部手元に要る（ほかの講座の動画は要らない）。作り直さない動画は `bun scripts/media.ts pull <講座 ID>` で取る（[公開の順番](publish.md) の 5）
- **`media.ts pull` が「上書きしません」で止まる**: 手元の動画が、動画の一覧と違う。作り直した動画なら、その講座を外して pull する。古い写しなら、消してから pull する（[公開の順番](publish.md) の「ぶつかったとき」）
- **`build:site -- --strict` が、ポスターが無いと止まる**: 新しい講座には、全部のレクチャーの `content/<講座>/generated/posters/<ID>.jpg` が要る。render が作るので、commit する（前の手順の `site/media/<ID>.jpg` だけがあるときは、`media push --course <講座 ID>` が写す）。前の手順で作った動画にポスターが無いときは、`bun scripts/media.ts pull <講座 ID>` で SHA-256 を確かめた通常版を取り、`render.sh` と同じ 4.2 秒の所・幅 1280・JPEG の品質 3 で取り出して（`ffmpeg -ss 4.2 -i site/media/<ID>.mp4 -frames:v 1 -vf scale=1280:-2 -q:v 3 content/<講座>/generated/posters/<ID>.jpg`）、目で見てから commit する。点検を緩めたり、CI で動画を取ってきたりして避けない
- **`media:check` が `retained` の期限の注意を出す**: 公開は止まらない。片付けるかどうかは持ち主が決める（[戻し方](recovery.md) の「古いハッシュの動画を片付ける」）
- **Actions が、ffmpeg を入れる手順で長く止まる**: 配布の取得が進まないことがある。出し直す（[戻し方](recovery.md) の「Actions を出し直す」）

## 並行作業

- **生成物（timeline・動画の一覧・教材・スナップショット）がぶつかる**: 手で直さない。[公開の順番](publish.md) の「ぶつかったとき」
- **新しい作業フォルダで、声が無い**: 声のキャッシュ（`.work/tts`）は作業フォルダごとにある。`npm run materials:pull` で取り出す
- **手元のサーバーの番号がぶつかる**: 講座サイトは `PORT=<番号> npm run serve`、Remotion Studio は `npm run studio -- --port <番号>`、Worker は `npm run dev:worker -- --port <番号>`（[commands.md](../guide/commands.md) の「ポート」）
