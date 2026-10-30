# ナッジ理論をプロダクト改善に活かす

選ぶ自由を守りながら、続けやすいプロダクトにする

- 講座 ID: `nudge-product`
- 受講者: Web サービスやアプリを作っているエンジニア・個人開発者。行動経済学やナッジは初めて
- 例に使う架空のサービス: 架空の家計簿アプリ「サンプル家計簿」（支出の記録と、週に 1 回の振り返り）

## 到達目標

1. ナッジを、強制・金銭的インセンティブ・ダークパターンと見分け、選ぶ自由と本人の利益を守る設計の条件を説明できる
2. デフォルト・フレーミング・社会的規範・フィードバック・手間を減らす設計を、オンボーディングと継続利用の場面に当てはめて選べる
3. 改善したい行動を 1 つ選び、障壁 → 施策 → 検証指標と悪影響の確認方法までを 1 枚のシートにまとめ、小さく試せる

最後の実践: 自分のサービスで「改善したい行動を選ぶ → 障壁を考える → 施策を設計する → 検証指標と悪影響の確認方法を決める」を 1 枚の設計シートにまとめる（第 7 章）

## 前提知識

- 画面・ボタン・設定・通知の仕組みが分かる
- アクセス解析の数字（率・人数）を見たことがある（第 7 章）

## 全体の目次と動画構成

| 章 | 章 ID | 動画 | セクション | タイトル | この章で答える問い | 目安 | 状態 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `nudge-01` | `N01` | はじめに | [ナッジとは何か](nudge-01.md) | ナッジは、強制・お金・ダークパターンと何が違うのか？ | 7 分 | 教材・動画あり |
| 2 | `nudge-02` | `N02` | ナッジの道具 | デフォルト（初期値）を設計する | 何も選ばなかった人に、何が起きるようにするか？ | 8 分 | 計画 |
| 3 | `nudge-03` | `N03` | ナッジの道具 | 言葉と見せ方（フレーミング） | 同じ事実を、どう伝えれば誤解なく選べるか？ | 8 分 | 計画 |
| 4 | `nudge-04` | `N04` | ナッジの道具 | 社会的規範とフィードバック | 「ほかの人」と「自分の今」をどう見せれば、行動が続くか？ | 8 分 | 計画 |
| 5 | `nudge-05` | `N05` | ナッジの道具 | 手間を減らし、タイミングを合わせる | やりたい人がつまずく手間と時機を、どう取り除くか？ | 8 分 | 計画 |
| 6 | `nudge-06` | `N06` | 境界線と倫理 | ダークパターンとの境界線 | どこからが「だまし」で、何を確かめれば避けられるか？ | 8 分 | 計画 |
| 7 | `nudge-07` | `N07` | 実践 | 実践: 行動を選び、施策を設計し、検証する | 小さなサービスで、ナッジを安全に試して確かめるには？ | 10 分 | 計画 |

合計の目安: 約 57 分

各章は「具体的な困りごと → 考え方 → 良い例・悪い例 → 実践手順 → 演習 → 振り返り」の順に進みます。

### 第 1 章 ナッジとは何か（`nudge-01`）

問い: ナッジは、強制・お金・ダークパターンと何が違うのか？

学習目標:

- 自分の画面の選択アーキテクチャに気づける
- ナッジを強制・金銭的インセンティブ・ダークパターンと見分けられる
- 良いナッジの 3 条件で施策を点検できる

前提知識:

- なし

動画の構成:

| 流れ | 中身 |
| --- | --- |
| 困りごと | サンプル家計簿で、通知をオンにする人が少なく、週 1 回の振り返りが続かない |
| 考え方 | ナッジの定義、選択アーキテクチャ（初期値・並び順・言葉・手間）、良いナッジの 3 条件、研究の効果と限界 |
| 良い例・悪い例 | 通知の画面: 罪悪感の文言と小さな断るボタン（悪い例）／何が届くかを書き、断る道も同じ大きさ（良い例）。○×クイズ 2 問 |
| 実践手順 | 行動を 1 つ決め、その行動までの画面の 4 つの部品を書き出し、3 条件で点検する |
| 演習 | 自分のサービスの 1 画面で 4 つの部品を書き出す（5 分） |
| 振り返り | 要点 3 つと、講座の地図 |

実践課題の案: 自分のサービスの選択アーキテクチャを棚卸しする（4 つの部品の表と、直し案・悪影響の候補）

主な出典:

- Richard H. Thaler, Cass R. Sunstein（Yale University Press）（2008（リンクは 2021 年の Final Edition））「Nudge: Improving Decisions About Health, Wealth, and Happiness」 https://yalebooks.yale.edu/book/9780300262285/nudge/ （研究・学術・2026-10-30 確認）
- Richard H. Thaler（The New York Times）（2015）「The Power of Nudges, for Good and Bad」 https://www.nytimes.com/2015/11/01/upshot/the-power-of-nudges-for-good-and-bad.html （実務の指針・2026-10-30 確認）
- 米国連邦取引委員会（FTC）（2022）「Bringing Dark Patterns to Light（Staff Report）」 https://www.ftc.gov/system/files/ftc_gov/pdf/P214800%20Dark%20Patterns%20Report%209.14.2022%20-%20FINAL.pdf （公式・法令・規格・2026-10-30 確認）
- Stefano DellaVigna, Elizabeth Linos（Econometrica 90）（2022）「RCTs to Scale: Comprehensive Evidence From Two Nudge Units」 https://doi.org/10.3982/ECTA18709 （研究・学術・2026-10-30 確認）

### 第 2 章 デフォルト（初期値）を設計する（`nudge-02`）

問い: 何も選ばなかった人に、何が起きるようにするか？

学習目標:

- オプトイン・オプトアウト・推奨の初期値・能動的な選択の違いを説明できる
- デフォルトが効く理由（手間・推奨のサイン・今のままでいたい気持ち）を説明できる
- 有料のオプションに最初からチェックを入れることが、なぜ問題かを説明できる

前提知識:

- 第 1 章

動画の構成:

| 流れ | 中身 |
| --- | --- |
| 困りごと | 初期設定のまま使われ、予算の上限もバックアップもオフのまま |
| 考え方 | デフォルトの効き方、能動的な選択（毎回選んでもらう）、推奨の初期値の示し方 |
| 良い例・悪い例 | 「おすすめ」と理由を書いた推奨の初期値／有料のオプションに最初からチェック |
| 実践手順 | 自分のサービスの初期値を一覧にし、ユーザーの利益と戻しやすさで見直す |
| 演習 | 初期値を 1 つ選び、変える案・変える理由・戻し方を書く |
| 振り返り | 初期値は「決めない」ことができない |

実践課題の案: 初期値の一覧表と、1 つの変更案（理由・戻し方・悪影響の確かめ方）

主な出典:

- Eric J. Johnson, Daniel Goldstein（Science 302）（2003）「Do Defaults Save Lives?」 https://doi.org/10.1126/science.1091721 （研究・学術・2026-10-30 確認）
- Brigitte C. Madrian, Dennis F. Shea（Quarterly Journal of Economics 116）（2001）「The Power of Suggestion: Inertia in 401(k) Participation and Savings Behavior」 https://doi.org/10.1162/003355301753265543 （研究・学術・2026-10-30 確認）
- 欧州連合（2011）「Directive 2011/83/EU on consumer rights, Article 22」 https://eur-lex.europa.eu/eli/dir/2011/83/oj （公式・法令・規格・2026-10-30 確認）

### 第 3 章 言葉と見せ方（フレーミング）（`nudge-03`）

問い: 同じ事実を、どう伝えれば誤解なく選べるか？

学習目標:

- 利得と損失、割合と人数、単位の違いで受け取り方が変わることを説明できる
- 誤解させる強調（偽の緊急性・おとりの選択肢）との違いを判別できる
- 料金やプランの見せ方を、比べやすさの観点で点検できる

前提知識:

- 第 1 章

動画の構成:

| 流れ | 中身 |
| --- | --- |
| 困りごと | 年額プランの良さが伝わらない／通知の文言が響かない |
| 考え方 | フレーミング効果、単位と基準、比べやすさ |
| 良い例・悪い例 | 月あたりの金額と合計を両方示す／「残り 1 時間」の偽のタイマー |
| 実践手順 | 大事な画面の文言を 3 通りに書き換え、誤解の余地を点検する |
| 演習 | 料金の画面の文言を、比べやすい形に書き直す |
| 振り返り | 強調してよいのは、本人の判断を助ける事実だけ |

実践課題の案: 料金かプランの画面の文言の書き換え案（3 通り）と、誤解の点検

主な出典:

- Amos Tversky, Daniel Kahneman（Science 211）（1981）「The Framing of Decisions and the Psychology of Choice」 https://doi.org/10.1126/science.7455683 （研究・学術・2026-10-30 確認）
- 米国連邦取引委員会（FTC）（2022）「Bringing Dark Patterns to Light（Staff Report）」 https://www.ftc.gov/system/files/ftc_gov/pdf/P214800%20Dark%20Patterns%20Report%209.14.2022%20-%20FINAL.pdf （公式・法令・規格・2026-10-30 確認）

### 第 4 章 社会的規範とフィードバック（`nudge-04`）

問い: 「ほかの人」と「自分の今」をどう見せれば、行動が続くか？

学習目標:

- 記述的な規範（みんながしている）と命令的な規範（望ましいこと）の違いを説明できる
- ブーメラン効果（平均を見せると、良い人が悪い方へ寄る）と、その避け方を説明できる
- 進み具合と結果をすぐ返すフィードバックを設計できる

前提知識:

- 第 1 章

動画の構成:

| 流れ | 中身 |
| --- | --- |
| 困りごと | 「〇〇さんも使っています」と出しても続かない |
| 考え方 | 規範の 2 種類、ブーメラン効果、フィードバックの速さと具体さ |
| 良い例・悪い例 | 本人の先週との比較と次の一歩／根拠のない「みんなやってる」 |
| 実践手順 | 見せる比べる相手（他人・過去の自分・目標）を決め、誤解と悪影響を点検する |
| 演習 | 振り返りの画面のフィードバックを設計する |
| 振り返り | 比べ方は、本人の行動につながるものを選ぶ |

実践課題の案: 振り返りの画面のフィードバック案（比べる相手・言葉・悪影響の確かめ方）

主な出典:

- P. Wesley Schultz ほか（Psychological Science 18）（2007）「The Constructive, Destructive, and Reconstructive Power of Social Norms」 https://doi.org/10.1111/j.1467-9280.2007.01917.x （研究・学術・2026-10-30 確認）
- Hunt Allcott（Journal of Public Economics 95）（2011）「Social norms and energy conservation」 https://doi.org/10.1016/j.jpubeco.2011.03.003 （研究・学術・2026-10-30 確認）

### 第 5 章 手間を減らし、タイミングを合わせる（`nudge-05`）

問い: やりたい人がつまずく手間と時機を、どう取り除くか？

学習目標:

- 行動までの手間（入力・判断・待ち時間・移動）を洗い出せる
- EAST（簡単・魅力的・社会的・タイミング）の観点で施策を出せる
- 逆向きの手間（スラッジ）を見つけて減らせる

前提知識:

- 第 1 章

動画の構成:

| 流れ | 中身 |
| --- | --- |
| 困りごと | 最初の支出の記録までに入力が多く、登録した日に 1 件も記録しない |
| 考え方 | 手間の種類、EAST、きっかけのタイミング、スラッジ |
| 良い例・悪い例 | 最初の 1 件は金額だけで記録できる／解約は電話だけ |
| 実践手順 | 行動までの手順を数え、減らせる手間・合わせられる時機を書き出す |
| 演習 | オンボーディングの手順を半分にする案を作る |
| 振り返り | 足すより先に、逆向きの手間を減らす |

実践課題の案: オンボーディングの手順の数え上げと、手間を減らす案・タイミングの案

主な出典:

- The Behavioural Insights Team（2014）「EAST: Four simple ways to apply behavioural insights」 https://www.bi.team/publications/east-four-simple-ways-to-apply-behavioural-insights/ （実務の指針・2026-10-30 確認）
- Richard H. Thaler（Science 361）（2018）「Nudge, not sludge」 https://doi.org/10.1126/science.aau9241 （研究・学術・2026-10-30 確認）
- BJ Fogg（—）「Fogg Behavior Model」 https://behaviormodel.org/ （実務の指針・2026-10-30 確認）

### 第 6 章 ダークパターンとの境界線（`nudge-06`）

問い: どこからが「だまし」で、何を確かめれば避けられるか？

学習目標:

- ダークパターンの主な種類（隠す・急がせる・罪悪感・解約の妨げ・事前チェック）を挙げられる
- 法律と公式資料の要点（EU の DSA 第 25 条、日本の特定商取引法の最終確認画面）を説明できる
- 倫理チェックリストで、自分の施策を公開前に点検できる

前提知識:

- 第 1〜5 章

動画の構成:

| 流れ | 中身 |
| --- | --- |
| 困りごと | 解約を減らしたいという要望に、どこまで応えてよいか |
| 考え方 | ダークパターンの種類、法律と公式資料、倫理チェックリスト |
| 良い例・悪い例 | 解約の前に一時停止やプラン変更も選べる（断る道も同じ手間）／解約を何ページもたどらせる |
| 実践手順 | チェックリストで施策を点検し、公開前に別の人にも見てもらう |
| 演習 | 自分の解約・退会の流れを点検する |
| 振り返り | 短期の数字より、信頼と法律を守る |

実践課題の案: 解約・退会の流れの点検表と、直し案

主な出典:

- 米国連邦取引委員会（FTC）（2022）「Bringing Dark Patterns to Light（Staff Report）」 https://www.ftc.gov/system/files/ftc_gov/pdf/P214800%20Dark%20Patterns%20Report%209.14.2022%20-%20FINAL.pdf （公式・法令・規格・2026-10-30 確認）
- OECD（2022）「Dark Commercial Patterns（OECD Digital Economy Papers No. 336）」 https://doi.org/10.1787/44f5e846-en （公式・法令・規格・2026-10-30 確認）
- 欧州連合（2022）「Regulation (EU) 2022/2065（Digital Services Act）Article 25」 https://eur-lex.europa.eu/eli/reg/2022/2065/oj （公式・法令・規格・2026-10-30 確認）
- 消費者庁（2022）「特定商取引法ガイド 通信販売（特定申込みを受ける際の表示）」 https://www.no-trouble.caa.go.jp/what/mailorder/ （公式・法令・規格・2026-10-30 確認）
- 日本版ナッジ・ユニット BEST（環境省）（2020（12 月））「ナッジ等の行動インサイトの活用に関わる倫理チェックリスト ②社会実装編」 https://www.env.go.jp/earth/ondanka/nudge/checklist_deploy.pdf （公式・法令・規格・2026-10-30 確認）

### 第 7 章 実践: 行動を選び、施策を設計し、検証する（`nudge-07`）

問い: 小さなサービスで、ナッジを安全に試して確かめるには？

学習目標:

- 改善したい行動 → 障壁 → 施策 → 検証指標と悪影響の確認方法を 1 枚にまとめられる
- 主な指標と、悪影響を見張る指標（ガードレール）を決められる
- 少ないデータで断定しない判断のきまり（期間・人数・止める条件）を作れる

前提知識:

- 第 1〜6 章
- アクセス解析の数字を見たことがある

動画の構成:

| 流れ | 中身 |
| --- | --- |
| 困りごと | 施策を入れたあと、効いたのか偶然なのか分からない |
| 考え方 | 行動の分解（BASIC など）、比べる仕組み（A/B テスト）、悪影響の指標、少ないデータの扱い |
| 良い例・悪い例 | 期間と判断ラインを先に決める／数日見て「効いた」と言い切る |
| 実践手順 | 1 枚の設計シートを埋め、小さく試す |
| 演習 | 自分のサービスの設計シートを完成させる |
| 振り返り | 講座全体の振り返りと次の一歩 |

実践課題の案: ナッジの設計シート（行動・障壁・施策・主な指標・悪影響の指標・判断のきまり）

主な出典:

- OECD（2019）「Tools and Ethics for Applied Behavioural Insights: The BASIC Toolkit」 https://doi.org/10.1787/9ea76a8f-en （公式・法令・規格・2026-10-30 確認）
- Stefano DellaVigna, Elizabeth Linos（Econometrica 90）（2022）「RCTs to Scale: Comprehensive Evidence From Two Nudge Units」 https://doi.org/10.3982/ECTA18709 （研究・学術・2026-10-30 確認）
- Maximilian Maier ほか（PNAS 119）（2022）「No evidence for nudging after adjusting for publication bias」 https://doi.org/10.1073/pnas.2200300119 （研究・学術・2026-10-30 確認）

## 出典の一覧

| ID | 種類 | 出典 | 確認日 | 何を確かめたか |
| --- | --- | --- | --- | --- |
| `thaler-sunstein-2008` | 研究・学術 | [Richard H. Thaler, Cass R. Sunstein（Yale University Press）（2008（リンクは 2021 年の Final Edition））Nudge: Improving Decisions About Health, Wealth, and Happiness](https://yalebooks.yale.edu/book/9780300262285/nudge/) | 2026-10-30 | ナッジの定義（選択肢を禁じず、経済的インセンティブを大きく変えずに行動を予測できる向きに変える選択アーキテクチャの要素。2009 年版 p.6 の定義を Mongin & Cozic 2018 の引用で確認）と、選択アーキテクチャの考え方。研究者の間でも定義の範囲は揺れている |
| `sunstein-2014-guide` | 研究・学術 | [Cass R. Sunstein（Journal of Consumer Policy 37）（2014）Nudging: A Very Short Guide](https://doi.org/10.1007/s10603-014-9273-1) | 2026-10-30 | ナッジを、自由を残したまま特定の方向へ導く手法と短く定義し、義務・禁止や経済的インセンティブと比べている。選択アーキテクチャは常にある（中立な設計は無い）という整理 |
| `thaler-2015-nyt` | 実務の指針 | [Richard H. Thaler（The New York Times）（2015）The Power of Nudges, for Good and Bad](https://www.nytimes.com/2015/11/01/upshot/the-power-of-nudges-for-good-and-bad.html) | 2026-10-30 | コラムで示した良いナッジの 3 原則（透明で誤解させない・できるだけ簡単にオプトアウトできる・本人の福祉を高めると考える十分な理由がある）。公式の基準ではなく提唱者の指針。記事はツールで開けず、所在と日付（2015-10-31 公開）は Thaler の会社のページの再掲で確認 |
| `thaler-2018-sludge` | 研究・学術 | [Richard H. Thaler（Science 361）（2018）Nudge, not sludge](https://doi.org/10.1126/science.aau9241) | 2026-10-30 | 選択アーキテクチャを悪用して、良い選択を難しくしたり、本人のためにならない行動を促したりする逆向きの工夫を「スラッジ」と呼んだ 1 ページの論説（実証研究ではない） |
| `ftc-2022-dark-patterns` | 公式・法令・規格 | [米国連邦取引委員会（FTC）（2022）Bringing Dark Patterns to Light（Staff Report）](https://www.ftc.gov/system/files/ftc_gov/pdf/P214800%20Dark%20Patterns%20Report%209.14.2022%20-%20FINAL.pdf) | 2026-10-30 | スタッフ報告（2022 年 9 月、委員会が 5 対 0 で公表を承認）。ダークパターンを、利用者をだましたり操ったりして本来しなかった選択をさせ、害を与えうる設計の手法と説明（法律上の定義ではない）。広告の偽装・偽の期限、解約の妨害、条件や手数料の隠蔽、個人データの提供への誘導を代表的な手口に挙げる |
| `oecd-2022-dark-patterns` | 公式・法令・規格 | [OECD（2022）Dark Commercial Patterns（OECD Digital Economy Papers No. 336）](https://doi.org/10.1787/44f5e846-en) | 2026-10-30 | Digital Economy Papers No. 336（2022-10-26）。ダークパターンの作業定義の提案、広がりと害の証拠、規制と執行の選択肢、消費者と事業者の対策。本体は 403 で、抄録と書誌で確認 |
| `eu-dsa-art25` | 公式・法令・規格 | [欧州連合（2022）Regulation (EU) 2022/2065（Digital Services Act）Article 25](https://eur-lex.europa.eu/eli/reg/2022/2065/oj) | 2026-10-30 | 第 25 条: オンラインプラットフォームの提供者は、利用者をだましたり操ったりして自由で情報に基づく判断をゆがめるインターフェースを作ってはならない。不公正取引慣行指令と GDPR の対象の行為は除く。零細・小規模の事業者のプラットフォームは、超大規模のものを除いて対象外（第 19 条）。適用は 2024-02-17 から。EUR-Lex は中身を取得できず、欧州委員会の DSA のページと条文の写しで確認 |
| `caa-tokushoho-2022` | 公式・法令・規格 | [消費者庁（2022）特定商取引法ガイド 通信販売（特定申込みを受ける際の表示）](https://www.no-trouble.caa.go.jp/what/mailorder/) | 2026-10-30 | 2022 年 6 月 1 日施行の改正（令和 3 年法律第 72 号）で、通信販売の最終確認画面（紙の申込書も含む）の表示事項が義務化され、誤認させる表示が禁止された（第 12 条の 6）。誤認して申し込んだ人は取り消せる（第 15 条の 4） |
| `best-ethics-checklist` | 公式・法令・規格 | [日本版ナッジ・ユニット BEST（環境省）（2020（12 月））ナッジ等の行動インサイトの活用に関わる倫理チェックリスト ②社会実装編](https://www.env.go.jp/earth/ondanka/nudge/checklist_deploy.pdf) | 2026-10-30 | 施策や製品・サービスとして実際に使う段階のためのチェックリスト（効果の事前確認などの項目）。少額のポイントのように経済的インセンティブを小さく変えるものも除外されておらず、大小だけでは一様に言えないとする。満たせば十分というものではないと明記 |
| `johnson-goldstein-2003` | 研究・学術 | [Eric J. Johnson, Daniel Goldstein（Science 302）（2003）Do Defaults Save Lives?](https://doi.org/10.1126/science.1091721) | 2026-10-30 | 臓器提供の意思表示がデフォルトで大きく変わることを示した短い論文。オンライン実験で、同意が初期設定だと 82%、不同意が初期設定だと 42% が同意（再現研究の原典の説明で確認。本文は未開封） |
| `madrian-shea-2001` | 研究・学術 | [Brigitte C. Madrian, Dennis F. Shea（Quarterly Journal of Economics 116）（2001）The Power of Suggestion: Inertia in 401(k) Participation and Savings Behavior](https://doi.org/10.1162/003355301753265543) | 2026-10-30 | 米国の大企業 1 社が 401(k)（確定拠出型の退職貯蓄制度）を自動加入に変えると、加入率が有意に大きく上がり、既定の拠出率と運用先のまま残る人が多かった（慣性と、既定を会社の助言と受け止めることが原因とされる）。NBER 版の要旨で確認 |
| `mertens-2022` | 研究・学術 | [Stephanie Mertens ほか（PNAS 119）（2022）The effectiveness of nudging: A meta-analysis of choice architecture interventions across behavioral domains](https://doi.org/10.1073/pnas.2107346118) | 2026-10-30 | 選択アーキテクチャの介入のメタ分析。2022 年 5 月の訂正（PNAS 119(19) e2204059119）後の値で、212 本・447 の効果量・約 215 万人、全体の効果量 d=0.43［0.38, 0.48］（訂正前は 0.45）。決定の構造（デフォルトなど）が最も大きい（0.54）。著者も出版バイアスを認めている |
| `maier-2022` | 研究・学術 | [Maximilian Maier ほか（PNAS 119）（2022）No evidence for nudging after adjusting for publication bias](https://doi.org/10.1073/pnas.2200300119) | 2026-10-30 | Mertens ほかのデータを出版バイアスで補正すると、平均効果は d≈0.04 で証拠は弱い（効果なしの証明ではなく、どちらとも決まらない水準）。情報を出すだけの介入と金融の分野は効果がないことを支持し、決定の構造の介入ははっきりしない |
| `dellavigna-linos-2022` | 研究・学術 | [Stefano DellaVigna, Elizabeth Linos（Econometrica 90）（2022）RCTs to Scale: Comprehensive Evidence From Two Nudge Units](https://doi.org/10.3982/ECTA18709) | 2026-10-30 | 米国の 2 つのナッジ・ユニットの 126 の RCT（約 2,300 万人）の平均効果は +1.4 ポイント（対照群比 +8.0%、統計的に有意）。学術誌の研究は +8.7 ポイント（+33.4%）。差の約 7 割は出版バイアスで説明できる |
| `bit-east-2014` | 実務の指針 | [The Behavioural Insights Team（2014）EAST: Four simple ways to apply behavioural insights](https://www.bi.team/publications/east-four-simple-ways-to-apply-behavioural-insights/) | 2026-10-30 | （計画の章の出典の候補。所在は確認、中身はその章を作るときに確かめる）行動を促すには Easy（簡単に）・Attractive（魅力的に）・Social（社会的に）・Timely（タイミングよく）という実務の枠組み |
| `oecd-basic-2019` | 公式・法令・規格 | [OECD（2019）Tools and Ethics for Applied Behavioural Insights: The BASIC Toolkit](https://doi.org/10.1787/9ea76a8f-en) | 2026-10-30 | （計画の章の出典の候補。所在は確認、中身はその章を作るときに確かめる）行動インサイトを政策に使う手順（Behaviour・Analysis・Strategy・Intervention・Change）と倫理の確認 |
| `schultz-2007` | 研究・学術 | [P. Wesley Schultz ほか（Psychological Science 18）（2007）The Constructive, Destructive, and Reconstructive Power of Social Norms](https://doi.org/10.1111/j.1467-9280.2007.01917.x) | 2026-10-30 | （計画の章の出典の候補。所在は確認、中身はその章を作るときに確かめる）平均の使用量（記述的規範）だけを伝えると、平均より少ない家庭の使用量が増えるブーメラン効果。賛否の印（命令的規範）を添えると抑えられた |
| `allcott-2011` | 研究・学術 | [Hunt Allcott（Journal of Public Economics 95）（2011）Social norms and energy conservation](https://doi.org/10.1016/j.jpubeco.2011.03.003) | 2026-10-30 | （計画の章の出典の候補。所在は確認、中身はその章を作るときに確かめる）近所との比較を載せた電力使用量のレポートで、使用量が平均で約 2% 減った（大規模なランダム化比較試験） |
| `tversky-kahneman-1981` | 研究・学術 | [Amos Tversky, Daniel Kahneman（Science 211）（1981）The Framing of Decisions and the Psychology of Choice](https://doi.org/10.1126/science.7455683) | 2026-10-30 | （計画の章の出典の候補。所在は確認、中身はその章を作るときに確かめる）同じ結果を「助かる」と「亡くなる」のどちらで言うかで、選ばれる案が入れ替わるフレーミング効果 |
| `eu-crd-art22` | 公式・法令・規格 | [欧州連合（2011）Directive 2011/83/EU on consumer rights, Article 22](https://eur-lex.europa.eu/eli/dir/2011/83/oj) | 2026-10-30 | （計画の章の出典の候補。所在は確認、中身はその章を作るときに確かめる）第 22 条: 追加の支払いへの同意を、あらかじめチェックの入った選択肢（デフォルト）で得てはならない |
| `fogg-bmap` | 実務の指針 | [BJ Fogg（—）Fogg Behavior Model](https://behaviormodel.org/) | 2026-10-30 | （計画の章の出典の候補。所在は確認、中身はその章を作るときに確かめる）行動は、動機（Motivation）・能力（Ability）・きっかけ（Prompt）が同時にそろったときに起きる（B=MAP）という実務の枠組み |
| `sunstein-2015-ethics` | 研究・学術 | [Cass R. Sunstein（Yale Journal on Regulation 32）（2015）The Ethics of Nudging](https://hls.harvard.edu/bibliography/the-ethics-of-nudging) | 2026-10-30 | 選択アーキテクチャは避けられないので、ナッジそのものに反対しても意味はないが、個別のナッジに反対するのは正当でありうる、という整理（抄録で確認） |
| `sunstein-2022-sludge-audits` | 研究・学術 | [Cass R. Sunstein（Behavioural Public Policy 6）（2022（オンライン 2020））Sludge Audits](https://doi.org/10.1017/bpp.2019.32) | 2026-10-30 | スラッジを過剰な、または正当化できない手間と定義。時間・お金・尊厳を奪い、立場の弱い人ほど影響が大きい。組織による定期的な点検を提案（抄録で確認） |
| `chandrashekar-2023` | 研究・学術 | [Subramanya Prasad Chandrashekar ほか（Meta-Psychology 7）（2023）Defaults versus framing: Revisiting Default Effect and Framing Effect with replications and extensions of Johnson and Goldstein (2003) and Johnson, Bellman, and Lohse (2002)](https://doi.org/10.15626/MP.2022.3108) | 2026-10-30 | 事前登録した米国の 1,920 人の再現実験。オプトアウト 73.5%・オプトイン 62.5%（初期設定なし 69.7%）で効果は再現されたが、差は約 11 ポイントで原典より小さい |
| `arshad-2019` | 研究・学術 | [Adam Arshad, Benjamin Anderson, Adnan Sharif（Kidney International 95）（2019）Comparison of organ donation and transplantation rates between opt-out and opt-in systems](https://doi.org/10.1016/j.kint.2019.01.036) | 2026-10-30 | OECD 35 か国（2016 年）の比較で、オプトアウトとオプトインの国の間に、亡くなった人からの提供数の有意な差は無かった（観察研究。国ごとの医療体制などの違いが混ざる） |
| `best-ethics-checklist-study` | 公式・法令・規格 | [日本版ナッジ・ユニット BEST（環境省）（2020（3 月。2021 年 3 月改訂））ナッジ等の行動インサイトの活用に関わる倫理チェックリスト ①調査・研究編](https://www.env.go.jp/earth/ondanka/nudge/checklist_study.pdf) | 2026-10-30 | BEST は 2017 年 4 月に環境省の主導で発足。ナッジ倫理委員会が作った、効果を調べる段階のためのチェックリスト。ナッジの定義の和訳と解説も載る |

台本と図は、ナッジと選択アーキテクチャの研究（Thaler & Sunstein など）、FTC・OECD・欧州連合・消費者庁・環境省の公式資料（2026 年 10 月確認）をもとに作成。サンプル家計簿は架空のアプリで、数字は説明用の仮の例です
