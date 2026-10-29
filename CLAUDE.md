# CLAUDE.md

Chalkfile のリポジトリ。台本（コード）から、ナレーション付きの講座動画（Remotion・VOICEVOX）と GitHub Pages の講座サイトを作る。

- 講座を作る・直す・公開するときは、スキル `study-video-course`（`.claude/skills/study-video-course/SKILL.md`）の手順に従う
- 手順の全体とコマンドは `README.md`
- 日本語で応答する。台本・画面の文字・コメントも日本語

## 守ること

- 台本の事実は、公式ドキュメントと一次情報で確かめてから書く。確かめた日と版を `docsNote` と `sourceNote` に残す
- 実在のサービスや会社の内部の情報（自分の仕事のコード・テーブル・設計）を台本に入れない。例は架空の「サンプルアプリ」で作る
- 画面の固定の文字に絵文字をアイコン代わりに使わない（アイコンは lucide-react）
- 台詞を直したら synth → mix → render → build_site の順に流し、`.work/kana/<id>.txt` の読みと静止画を確かめる
- 動画（`site/media/`）は main にコミットしない。公開は `bash scripts/deploy_pages.sh`（gh-pages を 1 コミットで置き換える）
- パスワード・API キー・Webhook の署名シークレットを台本やコードに書かない。例はプレースホルダーか環境変数にする
