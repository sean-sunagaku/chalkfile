# 文書の地図

Chalkfile の文書の入口。話題ごとに正本（直すときに、そこだけを直せばよいファイル）を 1 つに決め、ここに 1 行ずつ書く。

- （予定）は、まだ作っていない文書。できるまでは「今の置き場所」を読む
- 言葉の意味は [用語集](architecture/glossary.md)、全体の仕組みは [全体図](architecture/overview.md)

## 話題と正本

| 話題 | 正本 | 今の置き場所・メモ |
|---|---|---|
| 全体の仕組み（データの流れと置き場所） | [architecture/overview.md](architecture/overview.md) | |
| 言葉の意味 | [architecture/glossary.md](architecture/glossary.md) | |
| 配信の設計（Workers・Releases・旧 Pages の移行） | [architecture/delivery.md](architecture/delivery.md) | 手順は書かない。手順は下の「公開の順番」ほか |
| 始め方（3 通りの作り直し・前提の道具） | [guide/quickstart.md](guide/quickstart.md) | |
| 講座の作り方 | スキル [study-video-course](../.claude/skills/study-video-course/SKILL.md) | 共通プロンプトから講座を丸ごと作るときは [course-from-prompt](../.claude/skills/course-from-prompt/SKILL.md) |
| 講座を足す（チェックリスト・頭文字の表・PR に書くこと） | [guide/new-course.md](guide/new-course.md) | 中身の作り方はスキル |
| 画面と話し方 | [style.md](../.claude/skills/study-video-course/references/style.md) | |
| テーマ（色・書体・背景） | 値は `content/themes.ts`、仕様は [theme.md](../.claude/skills/study-video-course/references/theme.md) | |
| お笑い版の作り方 | [comedy.md](../.claude/skills/study-video-course/references/comedy.md) | |
| 多言語 | [i18n.md](../.claude/skills/study-video-course/references/i18n.md) | |
| 読む教材・章の計画 | [materials.md](../.claude/skills/study-video-course/references/materials.md) | 名前は materials だが「教材」の話（「素材」とは別。[用語集](architecture/glossary.md)） |
| 調べ方・事実の確かめ方 | [research.md](../.claude/skills/study-video-course/references/research.md) | |
| 名前と公式ドキュメントの使い方 | [rights.md](../.claude/skills/study-video-course/references/rights.md) | |
| コマンド・道具の役割・ポート | `package.json` の `scripts` と [guide/commands.md](guide/commands.md) | 入力と出力の表は、スキルの [pipeline.md](../.claude/skills/study-video-course/references/pipeline.md) |
| 公開の順番 | [operations/publish.md](operations/publish.md) | 公開の順番を書くのはここだけ |
| 初回の設定（Cloudflare・GitHub） | [operations/setup.md](operations/setup.md) | 持ち主だけ |
| 戻し方・作り直し（rollback・出し直し・素材・retained・token・無料枠・ドメイン） | [operations/recovery.md](operations/recovery.md) | 持ち主だけ |
| ハマりどころ | [operations/troubleshooting.md](operations/troubleshooting.md) | 症状からひく索引 |
| AI 共通のきまり（方針・安全・公開・並行作業・文体・コマンド） | [AGENTS.md](../AGENTS.md) | Claude Code は [CLAUDE.md](../CLAUDE.md) から読み込む |
| 安全（AI 向けのきまり・公開物・点検） | [AGENTS.md](../AGENTS.md) の「安全のきまり」と [safety.md](../.claude/skills/study-video-course/references/safety.md) | 点検そのものは `scripts/check_content.ts` |
| 保存の設計（オフライン・PWA） | `docs/architecture/offline.md`（予定） | 今はスキルの [offline.md](../.claude/skills/study-video-course/references/offline.md) |
| 学ぶ人向けの保存の説明 | [guide/learner-offline.md](guide/learner-offline.md) | |
| 決めたことと理由 | [adr/](adr/README.md) | ADR の書き方と一覧もここ |
| 日付つきの記録 | [history/](history/) | [2026-10-30 の制作メモ](history/2026-10-30-production-notes.md)・[2026-11-03 の公開確認](history/2026-11-03-workers-verification.md)。記録で、今の手順ではない |
| 生成物（読む教材・AI チャット用のチャンク） | [courses/](courses/README.md) | `scripts/build_materials.ts` が台本から作る。手で直さない |
| 参加・脆弱性の報告・ライセンス | [CONTRIBUTING.md](../CONTRIBUTING.md)・[SECURITY.md](../SECURITY.md)・[LICENSE](../LICENSE)・[THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)・[DISCLAIMER.md](../DISCLAIMER.md) | |

## docs/ の置き方

| 場所 | 中身 |
|---|---|
| `architecture/` | 仕組みの説明（全体図・用語集・配信の設計。保存の設計も、ここに移す予定） |
| `adr/` | 決めたことの記録 |
| `courses/` | 生成物（読む教材） |
| `guide/` | 始め方・講座の足し方・コマンド・学ぶ人の保存 |
| `operations/` | 公開・初回の設定・戻し方・ハマりどころ |
| `history/` | 日付つきの記録。名前の頭に日付を付ける。今の手順はここに書かない |

## 文書の決まり

1. 手順・設定の値・一覧は、正本の 1 か所にだけ書く。ほかの場所には 1 行の要約と、正本へのリンクを置く
2. 版・件数・一覧（講座・テーマ・声・動画の本数など）を写さない。コードかデータから作るか、点検で照らし合わせる。ADR と日付つきの記録は、確かめた日の値を日付と一緒に残してよい
3. 「〜は無い」「〜はまだ無い」と書かない。足されたときに、誰も直さないまま古くなる。あるもの・決めたことを書く
4. 決めたことの理由は [ADR](adr/README.md) に書き、ほかの文書からはリンクする
5. 日付つきの記録（確かめた結果・つまずき）は、今の手順と分けて置く
6. 生成物は手で直さない。元の台本かスクリプトを直して作り直す
7. リンクは相対パスで書く。（予定）の文書にはリンクせず、できてから張る
8. 文体は平易な日本語の常体（「〜する」）。漢語・外来語・英字を減らし、コードの名前とコマンドはそのまま書く。見本はスキルの [style.md](../.claude/skills/study-video-course/references/style.md) と [theme.md](../.claude/skills/study-video-course/references/theme.md) の書き方。AI に向けた文体のきまりの正本は [AGENTS.md](../AGENTS.md) の「文体」
