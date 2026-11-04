# プロジェクトの設定を 1 つにまとめる

- 状態: 採用
- 日付: 2026-11-04

## 決めたこと

設定の正本は `chalkfile.config.ts` とする。既定テーマ・声・言語・公開する言語・サイト名・公開先・リポジトリ・書き出しの設定をここに書く。値を変えたら `npm run gen` を流し、差分を commit する。

サイトの組み立ては `scripts/lib/config.ts` を通して読む。内部の `SiteConfig` の `baseUrl` と `repoUrl` は、設定の `origin` と `repository` から作る。書き出しの道具と Remotion Studio は、同じ `RENDER` を読む。

## エンジンと Worker に渡すもの

エンジンは、プロジェクトの設定ファイルを直接読まない。`npm run gen` が次の値を書き出す。

| 置き場所 | 渡す値 |
|---|---|
| `engine/core/project-settings.ts` | 既定テーマ・声・講座のリンクの公開先 |
| `engine/core/langs.ts` の `LANG_LIST` と `LANG_INFO` | 言語の一覧と名前 |
| `site/media-shared.ts` の `MEDIA_REPOSITORY` | 動画の中継先のリポジトリ |
| `worker/src/generated/project-settings.json` | Worker の公開先とリポジトリ |
| `wrangler.jsonc` の routes | 公開先のドメインと www |
| `.github/workflows/{ci,deploy,canary}.yml` の公開先・リポジトリの条件 | fork の制限と公開の確認先 |

Worker の JSON は Git に入れない。それ以外は、取り出した旧版の台本の読み込みや、Actions の開始前にも要るので Git に入れる。`npm run gen -- --check` と `npm run check:docs` が、正本とのずれを止める。生成する場所が消えたときも止める。

言語の宣言と中継先の定数は、今までと同じファイルに残す。別のモジュールへ動かすだけでも、Bun の圧縮で SW のバイト列が変わるため。今回の移行では、サイト出力 99 ファイルが移行前と同じバイト列であることを確かめた。

## 固定する旧版

旧 Pages の移行用コード・設定・記録は、当時の行き先を保つ。`site/legacy-sw.ts`・`site/legacy-config.json`・`scripts/build_migration.ts`・旧 Pages を出す道具と旧版の fixture は、この設定へ移さない。片付ける時期は [旧 Pages の終了日](2026-11-02-legacy-pages-end-date.md) に従う。

文書・テストの見本・GitHub の報告用フォームにも、説明のために公開先を書く。実行時の値を直す場所は設定の正本だけとし、表の生成先を手で変えない。
