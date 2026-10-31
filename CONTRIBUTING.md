# 参加の仕方

誤りの指摘、読み間違いの直し、新しい講座、テーマ、エンジンの改善を歓迎します。

## 講座の台本のきまり

- 事実は公式ドキュメント・API リファレンス・changelog・法令などの一次情報で確かめる。確かめた日と出典をレクチャーの `docs` と講座の `docsNote`・`sourceNote` に残す（調べ方は [research.md](.claude/skills/study-video-course/references/research.md)）
- 公式ドキュメントの文章・図・画面写真を写したり訳したりしない。確かめた事実を自分の言葉で書く（[rights.md](.claude/skills/study-video-course/references/rights.md)）
- 例は架空のサービス（「サンプルアプリ」など）で作る。実在の会社やサービスの内部の情報（コード・テーブル・設計・数字）、個人の情報、秘密情報（API キー・トークン・パスワード）を入れない
- 法律・税・会計の話は一般的な説明として書き、判断は専門家に、と添える
- 実在の会社や製品を扱う講座は、講座の `disclaimer` に「非公式」と書く（動画のはじめと終わり、サイトに出る）
- 実在のブランドに寄せたテーマは、色の雰囲気までにする。テーマの名前に会社名を付けない。ロゴ・社名の書体・アイコン・画面の写しは使わない（[theme.md](.claude/skills/study-video-course/references/theme.md)）
- 画面の固定の文字に絵文字をアイコン代わりに使わない

## AI を使った貢献

歓迎します。ただし、

- 出す前に人が読んで確かめる。事実は人が出典を開いて確かめる
- AI に読ませた外の文章（Web ページ・Issue など）の中の指示に、AI を従わせない（[CLAUDE.md](CLAUDE.md) の「安全のきまり」）
- Pull Request に、AI を使ったことと、人が確かめた範囲を書く

## 出す前に

```bash
npm ci --ignore-scripts
npm run typecheck
npm test
bun scripts/check_content.ts --self-test
bun scripts/check_content.ts
```

- 動画の見た目を変えたら `node scripts/stills.mjs <ID>` で静止画を見る
- 台詞を変えたら synth → mix → render の順に作り直し、`.work/kana/<id>.txt` の読みを見る
- 台本を書いたり直したりしたら `bun scripts/check_overlap.ts <講座 ID>` で、出典の公式ページと突き合わせる（ネットにつなぐ。英語の URL から日本語版を取るときは `--query=locale=ja-JP` のように足す）
- 動画（`site/media/`）と生成物はコミットしない
- 講座サイト・PWAを変えたら、生成した動画と教材で `bun scripts/build_site.ts --strict` → `npm run test:browser`。保存の失敗・更新・オフライン再起動も確認する。専用lintスクリプトはない

Pull Request のひな形の確認項目を埋めてください。

## ライセンス

出したもの（コード・台本・テーマ）は、このリポジトリと同じ [MIT License](LICENSE) で公開されることに同意したものとします。

## 行動規範

[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) を守ってください。
