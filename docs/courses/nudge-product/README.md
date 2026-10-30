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
| 2 | `nudge-02` | `N02` | ナッジの道具 | [デフォルト（初期値）を設計する](nudge-02.md) | 何も選ばなかった人に、何が起きるようにするか？ | 8 分 | 教材・動画あり |
| 3 | `nudge-03` | `N03` | ナッジの道具 | [言葉と見せ方（フレーミング）](nudge-03.md) | 同じ事実を、どう伝えれば誤解なく選べるか？ | 8 分 | 教材・動画あり |
| 4 | `nudge-04` | `N04` | ナッジの道具 | [社会的規範とフィードバック](nudge-04.md) | 「ほかの人」と「自分の今」をどう見せれば、行動が続くか？ | 8 分 | 教材・動画あり |
| 5 | `nudge-05` | `N05` | ナッジの道具 | [手間を減らし、タイミングを合わせる](nudge-05.md) | やりたい人がつまずく手間と時機を、どう取り除くか？ | 8 分 | 教材・動画あり |
| 6 | `nudge-06` | `N06` | 境界線と倫理 | [ダークパターンとの境界線](nudge-06.md) | どこからが「だまし」で、何を確かめれば避けられるか？ | 8 分 | 教材・動画あり |
| 7 | `nudge-07` | `N07` | 実践 | [実践: 行動を選び、施策を設計し、検証する](nudge-07.md) | 小さなサービスで、ナッジを安全に試して確かめるには？ | 10 分 | 教材・動画あり |

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
- Subramanya Prasad Chandrashekar ほか（Meta-Psychology 7）（2023）「Defaults versus framing: Revisiting Default Effect and Framing Effect with replications and extensions of Johnson and Goldstein (2003) and Johnson, Bellman, and Lohse (2002)」 https://doi.org/10.15626/MP.2022.3108 （研究・学術・2026-10-30 確認）
- Brigitte C. Madrian, Dennis F. Shea（Quarterly Journal of Economics 116）（2001）「The Power of Suggestion: Inertia in 401(k) Participation and Savings Behavior」 https://doi.org/10.1162/003355301753265543 （研究・学術・2026-10-30 確認）
- Jon M. Jachimowicz ほか（Behavioural Public Policy 3）（2019）「When and why defaults influence decisions: a meta-analysis of default effects」 https://doi.org/10.1017/bpp.2018.43 （研究・学術・2026-10-30 確認）
- Gabriel D. Carroll ほか（Quarterly Journal of Economics 124）（2009（NBER Working Paper 11074））「Optimal Defaults and Active Decisions」 https://www.nber.org/papers/w11074 （研究・学術・2026-10-30 確認）
- 欧州連合（2011）「Directive 2011/83/EU on consumer rights, Article 22」 https://eur-lex.europa.eu/eli/dir/2011/83/oj （公式・法令・規格・2026-10-30 確認）
- 米国連邦取引委員会（FTC）（2022）「Bringing Dark Patterns to Light（Staff Report）」 https://www.ftc.gov/system/files/ftc_gov/pdf/P214800%20Dark%20Patterns%20Report%209.14.2022%20-%20FINAL.pdf （公式・法令・規格・2026-10-30 確認）

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
- Gerd Gigerenzer ほか（Psychological Science in the Public Interest 8）（2007）「Helping Doctors and Patients Make Sense of Health Statistics」 https://pubmed.ncbi.nlm.nih.gov/26161749/ （研究・学術・2026-10-30 確認）
- Daniel J. O'Keefe, Jakob D. Jensen（Journal of Health Communication 12）（2007）「The relative persuasiveness of gain-framed and loss-framed messages for encouraging disease prevention behaviors: a meta-analytic review」 https://pubmed.ncbi.nlm.nih.gov/17934940/ （研究・学術・2026-10-30 確認）
- Joel Huber, John W. Payne, Christopher Puto（Journal of Consumer Research 9）（1982）「Adding Asymmetrically Dominated Alternatives: Violations of Regularity and the Similarity Hypothesis」 https://doi.org/10.1086/208899 （研究・学術・2026-10-30 確認）
- 米国連邦取引委員会（FTC）（2022）「Bringing Dark Patterns to Light（Staff Report）」 https://www.ftc.gov/system/files/ftc_gov/pdf/P214800%20Dark%20Patterns%20Report%209.14.2022%20-%20FINAL.pdf （公式・法令・規格・2026-10-30 確認）
- 欧州連合（英国 legislation.gov.uk の EU 法の写し）（2005）「Directive 2005/29/EC（Unfair Commercial Practices Directive）Annex I」 https://www.legislation.gov.uk/eudr/2005/29/annex/I （公式・法令・規格・2026-10-30 確認）
- 消費者庁（—）「二重価格表示（景品表示法の不当表示）」 https://www.caa.go.jp/policies/policy/representation/fair_labeling/representation_regulation/double_price/ （公式・法令・規格・2026-10-30 確認）

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
- Hunt Allcott（Quarterly Journal of Economics 130）（2015）「Site Selection Bias in Program Evaluation」 https://doi.org/10.1093/qje/qjv015 （研究・学術・2026-10-30 確認）
- Avraham N. Kluger, Angelo DeNisi（Psychological Bulletin 119）（1996）「The effects of feedback interventions on performance: A historical review, a meta-analysis, and a preliminary feedback intervention theory」 https://doi.org/10.1037/0033-2909.119.2.254 （研究・学術・2026-10-30 確認）
- Verena Tiefenbeck ほか（Management Science 64）（2018）「Overcoming Salience Bias: How Real-Time Feedback Fosters Resource Conservation」 https://doi.org/10.1287/mnsc.2016.2646 （研究・学術・2026-10-30 確認）

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

- The Behavioural Insights Team（2014（配布中の PDF は 2024 年 12 月の改訂版））「EAST: Four simple ways to apply behavioural insights」 https://www.bi.team/publications/east-four-simple-ways-to-apply-behavioural-insights/ （実務の指針・2026-10-30 確認）
- Richard H. Thaler（Science 361）（2018）「Nudge, not sludge」 https://doi.org/10.1126/science.aau9241 （研究・学術・2026-10-30 確認）
- BJ Fogg（—）「Fogg Behavior Model」 https://behaviormodel.org/ （実務の指針・2026-10-30 確認）
- Katherine L. Milkman, John Beshears, James J. Choi, David Laibson, Brigitte C. Madrian（PNAS 108）（2011）「Using implementation intentions prompts to enhance influenza vaccination rates」 https://doi.org/10.1073/pnas.1103170108 （研究・学術・2026-10-30 確認）
- Eric P. Bettinger, Bridget Terry Long, Philip Oreopoulos, Lisa Sanbonmatsu（Quarterly Journal of Economics 127）（2012）「The Role of Application Assistance and Information in College Decisions: Results from the H&R Block FAFSA Experiment」 https://doi.org/10.1093/qje/qjs017 （研究・学術・2026-10-30 確認）
- Hengchen Dai, Katherine L. Milkman, Jason Riis（Management Science 60）（2014）「The Fresh Start Effect: Temporal Landmarks Motivate Aspirational Behavior」 https://doi.org/10.1287/mnsc.2014.1901 （研究・学術・2026-10-30 確認）

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
- Ramesh Johari, Pete Koomen, Leonid Pekelis, David Walsh（Operations Research 70）（2022）「Always Valid Inference: Continuous Monitoring of A/B Tests」 https://doi.org/10.1287/opre.2021.2135 （研究・学術・2026-10-30 確認）
- Ron Kohavi, Diane Tang, Ya Xu（Cambridge University Press）（2020）「Trustworthy Online Controlled Experiments: A Practical Guide to A/B Testing」 https://doi.org/10.1017/9781108653985 （実務の指針・2026-10-30 確認）

## 出典の一覧

| ID | 種類 | 出典 | 確認日 | 何を確かめたか |
| --- | --- | --- | --- | --- |
| `thaler-sunstein-2008` | 研究・学術 | [Richard H. Thaler, Cass R. Sunstein（Yale University Press）（2008（リンクは 2021 年の Final Edition））Nudge: Improving Decisions About Health, Wealth, and Happiness](https://yalebooks.yale.edu/book/9780300262285/nudge/) | 2026-10-30 | ナッジの定義（選択肢を禁じず、経済的インセンティブを大きく変えずに行動を予測できる向きに変える選択アーキテクチャの要素。2009 年版 p.6 の定義を Mongin & Cozic 2018 の引用で確認）と、選択アーキテクチャの考え方。研究者の間でも定義の範囲は揺れている |
| `sunstein-2014-guide` | 研究・学術 | [Cass R. Sunstein（Journal of Consumer Policy 37）（2014）Nudging: A Very Short Guide](https://doi.org/10.1007/s10603-014-9273-1) | 2026-10-30 | ナッジを、自由を残したまま特定の方向へ導く手法と短く定義し、義務・禁止や経済的インセンティブと比べている。選択アーキテクチャは常にある（中立な設計は無い）という整理 |
| `thaler-2015-nyt` | 実務の指針 | [Richard H. Thaler（The New York Times）（2015）The Power of Nudges, for Good and Bad](https://www.nytimes.com/2015/11/01/upshot/the-power-of-nudges-for-good-and-bad.html) | 2026-10-30 | コラムで示した良いナッジの 3 原則（透明で誤解させない・できるだけ簡単にオプトアウトできる・本人の福祉を高めると考える十分な理由がある）。公式の基準ではなく提唱者の指針。記事はツールで開けず、所在と日付（2015-10-31 公開）は Thaler の会社のページの再掲で確認 |
| `thaler-2018-sludge` | 研究・学術 | [Richard H. Thaler（Science 361）（2018）Nudge, not sludge](https://doi.org/10.1126/science.aau9241) | 2026-10-30 | 選択アーキテクチャを悪用して、良い選択を難しくしたり、本人のためにならない行動を促したりする逆向きの工夫を「スラッジ」と呼んだ 1 ページの論説（実証研究ではない） |
| `ftc-2022-dark-patterns` | 公式・法令・規格 | [米国連邦取引委員会（FTC）（2022）Bringing Dark Patterns to Light（Staff Report）](https://www.ftc.gov/system/files/ftc_gov/pdf/P214800%20Dark%20Patterns%20Report%209.14.2022%20-%20FINAL.pdf) | 2026-10-30 | スタッフ報告（2022 年 9 月、委員会が 5 対 0 で公表を承認）。ダークパターンを、利用者をだましたり操ったりして本来しなかった選択をさせ、害を与えうる設計の手法と説明（法律上の定義ではない）。広告の偽装・偽の期限、解約の妨害、条件や手数料の隠蔽、個人データの提供への誘導を代表的な手口に挙げる |
| `oecd-2022-dark-patterns` | 公式・法令・規格 | [OECD（2022）Dark Commercial Patterns（OECD Digital Economy Papers No. 336）](https://doi.org/10.1787/44f5e846-en) | 2026-10-30 | Digital Economy Papers No. 336（2022-10-26）。ダークパターンの作業定義・7 つの分類・広がりと害の証拠・規制と執行の選択肢・自己監査。穏やかに見える手口でも同じくらい効くことがあり、決定版の分類は難しいとする。本体の PDF で確認 |
| `eu-dsa-art25` | 公式・法令・規格 | [欧州連合（2022）Regulation (EU) 2022/2065（Digital Services Act）Article 25](https://eur-lex.europa.eu/eli/reg/2022/2065/oj) | 2026-10-30 | 第 25 条: オンラインプラットフォームの提供者は、利用者をだましたり操ったりして自由で情報に基づく判断をゆがめるインターフェースを作ってはならない。不公正取引慣行指令と GDPR の対象の行為は除く。欧州委員会が指針を出せる例は (a) 選択肢を目立たせる (b) 選んだことを繰り返し求める (c) 解約を申込みより難しくする。零細・小規模の事業者のプラットフォームは、超大規模のものを除いて対象外（第 19 条）。適用は 2024-02-17 から。EU 出版局の官報の正文で確認 |
| `caa-tokushoho-2022` | 公式・法令・規格 | [消費者庁（2022）特定商取引法ガイド 通信販売（特定申込みを受ける際の表示）](https://www.no-trouble.caa.go.jp/what/mailorder/) | 2026-10-30 | 2022 年 6 月 1 日施行の改正（令和 3 年法律第 72 号）で、通信販売の最終確認画面（紙の申込書も含む）の表示事項が義務化され、誤認させる表示が禁止された（第 12 条の 6）。誤認して申し込んだ人は取り消せる（第 15 条の 4） |
| `best-ethics-checklist` | 公式・法令・規格 | [日本版ナッジ・ユニット BEST（環境省）（2020（12 月））ナッジ等の行動インサイトの活用に関わる倫理チェックリスト ②社会実装編](https://www.env.go.jp/earth/ondanka/nudge/checklist_deploy.pdf) | 2026-10-30 | 施策や製品・サービスとして実際に使う段階のためのチェックリスト（効果の事前確認などの項目）。少額のポイントのように経済的インセンティブを小さく変えるものも除外されておらず、大小だけでは一様に言えないとする。満たせば十分というものではないと明記 |
| `johnson-goldstein-2003` | 研究・学術 | [Eric J. Johnson, Daniel Goldstein（Science 302）（2003）Do Defaults Save Lives?](https://doi.org/10.1126/science.1091721) | 2026-10-30 | 臓器提供の意思表示がデフォルトで大きく変わることを示した短い論文。オンライン実験で、同意が初期設定だと 82%、不同意が初期設定だと 42% が同意（再現研究の原典の説明で確認。本文は未開封） |
| `madrian-shea-2001` | 研究・学術 | [Brigitte C. Madrian, Dennis F. Shea（Quarterly Journal of Economics 116）（2001）The Power of Suggestion: Inertia in 401(k) Participation and Savings Behavior](https://doi.org/10.1162/003355301753265543) | 2026-10-30 | 米国の大企業 1 社が 401(k)（確定拠出型の退職貯蓄制度）を自動加入に変えると、加入率が有意に大きく上がり、既定の拠出率と運用先のまま残る人が多かった（慣性と、既定を会社の助言と受け止めることが原因とされる）。NBER 版の要旨で確認 |
| `mertens-2022` | 研究・学術 | [Stephanie Mertens ほか（PNAS 119）（2022）The effectiveness of nudging: A meta-analysis of choice architecture interventions across behavioral domains](https://doi.org/10.1073/pnas.2107346118) | 2026-10-30 | 選択アーキテクチャの介入のメタ分析。2022 年 5 月の訂正（PNAS 119(19) e2204059119）後の値で、212 本・447 の効果量・約 215 万人、全体の効果量 d=0.43［0.38, 0.48］（訂正前は 0.45）。決定の構造（デフォルトなど）が最も大きい（0.54）。著者も出版バイアスを認めている |
| `maier-2022` | 研究・学術 | [Maximilian Maier ほか（PNAS 119）（2022）No evidence for nudging after adjusting for publication bias](https://doi.org/10.1073/pnas.2200300119) | 2026-10-30 | Mertens ほかのデータを出版バイアスで補正すると、平均効果は d≈0.04 で証拠は弱い（効果なしの証明ではなく、どちらとも決まらない水準）。情報を出すだけの介入と金融の分野は効果がないことを支持し、決定の構造の介入ははっきりしない |
| `dellavigna-linos-2022` | 研究・学術 | [Stefano DellaVigna, Elizabeth Linos（Econometrica 90）（2022）RCTs to Scale: Comprehensive Evidence From Two Nudge Units](https://doi.org/10.3982/ECTA18709) | 2026-10-30 | 米国の 2 つのナッジ・ユニットの 126 の RCT（約 2,300 万人）の平均効果は +1.4 ポイント（対照群比 +8.0%、統計的に有意）。学術誌の研究は +8.7 ポイント（+33.4%）。差の約 7 割は出版バイアスで説明できる |
| `bit-east-2014` | 実務の指針 | [The Behavioural Insights Team（2014（配布中の PDF は 2024 年 12 月の改訂版））EAST: Four simple ways to apply behavioural insights](https://www.bi.team/publications/east-four-simple-ways-to-apply-behavioural-insights/) | 2026-10-30 | Easy（デフォルト・手間を減らす・簡単に伝える）・Attractive（注意を引く・インセンティブの工夫）・Social（多くの人がしていると示す・つながり・互恵）・Timely（よい時機・目の前の損得・前もって計画）。改訂版は、規範の伝え方が逆効果になる条件や、本人のためになる手間にも触れる。PDF で確認 |
| `oecd-basic-2019` | 公式・法令・規格 | [OECD（2019）Tools and Ethics for Applied Behavioural Insights: The BASIC Toolkit](https://doi.org/10.1787/9ea76a8f-en) | 2026-10-30 | 行動インサイトを政策に使う 5 段階（Behaviour: 大事な行動に絞る／Analysis: 行動科学の見方で調べる（ABCD）／Strategy: 解決策を考える／Intervention: 成功の定義・標本の大きさ・リスクを決めて実験で確かめる（RCT が理想）／Change: 実施・広げ方・見張り・評価・共有）と、段階ごとの倫理の注意。oecd.org は 403 で、OECD の Web 版 PDF の写しと環境省 BEST の要約で確認 |
| `schultz-2007` | 研究・学術 | [P. Wesley Schultz ほか（Psychological Science 18）（2007）The Constructive, Destructive, and Reconstructive Power of Social Norms](https://doi.org/10.1111/j.1467-9280.2007.01917.x) | 2026-10-30 | 米国サンマルコスの 290 世帯（最終 287）の実験。自分の使用量・近所の平均・節電のヒントを伝えると、平均より少ない家庭は使用量が増えた（約 +0.89 kWh/日、ブーメラン効果）。笑顔・困り顔の印（命令的な規範）を添えると増えず、多い家庭は約 −1.72 kWh/日減った。PubMed の要旨と本文の PDF で確認 |
| `allcott-2011` | 研究・学術 | [Hunt Allcott（Journal of Public Economics 95）（2011）Social norms and energy conservation](https://doi.org/10.1016/j.jpubeco.2011.03.003) | 2026-10-30 | Opower のホームエナジーレポートの約 60 万世帯のランダム化比較試験。平均 2.0% 減（短期の電気料金の 11〜20% の値上げに相当）、使用量の多い上位 1 割は 6.3% 減、下位 1 割は 0.3% 減。命令的な規範の役割は有意ではなかった。要旨と書誌で確認 |
| `tversky-kahneman-1981` | 研究・学術 | [Amos Tversky, Daniel Kahneman（Science 211）（1981）The Framing of Decisions and the Psychology of Choice](https://doi.org/10.1126/science.7455683) | 2026-10-30 | 600 人が亡くなると予想される病気の問題で、「200 人が助かる」と示すと 72% が確実な案を選び、「400 人が亡くなる」と示すと 22% だった（大学生への教室での質問紙）。同じ 5 ドルの値引きでも、15 ドルの品なら 68%、125 ドルなら 29% が遠くの店まで行くと答えた。効果は大きく系統的だが、どこでも起きるわけではないとする。本文のスキャン PDF で確認 |
| `eu-crd-art22` | 公式・法令・規格 | [欧州連合（2011）Directive 2011/83/EU on consumer rights, Article 22](https://eur-lex.europa.eu/eli/dir/2011/83/oj) | 2026-10-30 | 第 22 条: 主な契約の代金に加えて追加の支払いを求めるときは、消費者が契約に縛られる前にはっきりした同意を得なければならない。断らないと払うことになる初期設定（事前のチェック）で同意を推定した場合、消費者はその支払いの返金を受けられる。EUR-Lex は中身を取得できず、legislation.gov.uk の EU 指令の写しで確認 |
| `fogg-bmap` | 実務の指針 | [BJ Fogg（—）Fogg Behavior Model](https://behaviormodel.org/) | 2026-10-30 | 動機・能力・きっかけが同じ瞬間にそろうと行動が起きるという枠組み（B=MAP）。能力はいちばん足りない資源で決まり、行動を小さくすることを勧める。きっかけは Facilitator・Signal・Spark の 3 種類。査読のある研究ではなく提唱者の実務の枠組み。公式サイトで確認 |
| `sunstein-2015-ethics` | 研究・学術 | [Cass R. Sunstein（Yale Journal on Regulation 32）（2015）The Ethics of Nudging](https://hls.harvard.edu/bibliography/the-ethics-of-nudging) | 2026-10-30 | 選択アーキテクチャは避けられないので、ナッジそのものに反対しても意味はないが、個別のナッジに反対するのは正当でありうる、という整理（抄録で確認） |
| `sunstein-2022-sludge-audits` | 研究・学術 | [Cass R. Sunstein（Behavioural Public Policy 6）（2022（オンライン 2020））Sludge Audits](https://doi.org/10.1017/bpp.2019.32) | 2026-10-30 | スラッジを過剰な、または正当化できない手間と定義。時間・お金・尊厳を奪い、立場の弱い人ほど影響が大きい。組織による定期的な点検を提案（抄録で確認） |
| `chandrashekar-2023` | 研究・学術 | [Subramanya Prasad Chandrashekar ほか（Meta-Psychology 7）（2023）Defaults versus framing: Revisiting Default Effect and Framing Effect with replications and extensions of Johnson and Goldstein (2003) and Johnson, Bellman, and Lohse (2002)](https://doi.org/10.15626/MP.2022.3108) | 2026-10-30 | 事前登録した米国の 1,920 人の再現実験。オプトアウト 73.5%・オプトイン 62.5%（初期設定なし 69.7%）で効果は再現されたが、差は約 11 ポイントで原典より小さい |
| `arshad-2019` | 研究・学術 | [Adam Arshad, Benjamin Anderson, Adnan Sharif（Kidney International 95）（2019）Comparison of organ donation and transplantation rates between opt-out and opt-in systems](https://doi.org/10.1016/j.kint.2019.01.036) | 2026-10-30 | OECD 35 か国（2016 年）の比較で、オプトアウトとオプトインの国の間に、亡くなった人からの提供数の有意な差は無かった（観察研究。国ごとの医療体制などの違いが混ざる） |
| `best-ethics-checklist-study` | 公式・法令・規格 | [日本版ナッジ・ユニット BEST（環境省）（2020（3 月。2021 年 3 月改訂））ナッジ等の行動インサイトの活用に関わる倫理チェックリスト ①調査・研究編](https://www.env.go.jp/earth/ondanka/nudge/checklist_study.pdf) | 2026-10-30 | BEST は 2017 年 4 月に環境省の主導で発足。ナッジ倫理委員会が作った、効果を調べる段階のためのチェックリスト。ナッジの定義の和訳と解説も載る |
| `jachimowicz-2019` | 研究・学術 | [Jon M. Jachimowicz ほか（Behavioural Public Policy 3）（2019）When and why defaults influence decisions: a meta-analysis of default effects](https://doi.org/10.1017/bpp.2018.43) | 2026-10-30 | デフォルトの効果の 58 のデータ（55 の研究・35 本の論文、計 73,675 人）のメタ分析（オープンアクセスの本文で確認）。オプトアウトとオプトインの差の効果量は d=0.68［0.53, 0.83］。46 件ははっきり正の効果、10 件は有意な差なし、2 件は逆向き。消費の分野で大きく、環境の分野で小さめ。推奨（endorsement）や今の状態（endowment）として受け取られるデフォルトほど効果が大きく、手間（ease）は有意な違いがなかった（手間を変えた研究が少ない）。著者は、効くと決めつけずに試して確かめるよう勧めている |
| `carroll-2009` | 研究・学術 | [Gabriel D. Carroll ほか（Quarterly Journal of Economics 124）（2009（NBER Working Paper 11074））Optimal Defaults and Active Decisions](https://www.nber.org/papers/w11074) | 2026-10-30 | 米国の会社の 401(k)（確定拠出型の退職貯蓄の制度）で、入社した人に加入するかを必ず選んでもらう「能動的な選択」にすると、通常のオプトインより、最初に加入する人の割合が 28 ポイント高かった。先延ばしが強く、貯めたい額の好みが人によって大きく違うときは能動的な選択が向き、お金の知識が少ないときは自動加入（デフォルト）が向く、というモデル。NBER のページの要旨で確認（本文は未開封） |
| `gigerenzer-2007` | 研究・学術 | [Gerd Gigerenzer ほか（Psychological Science in the Public Interest 8）（2007）Helping Doctors and Patients Make Sense of Health Statistics](https://pubmed.ncbi.nlm.nih.gov/26161749/) | 2026-10-30 | 分かりにくい数字の示し方（意図的なものも含む）が誤解を生むとし、相対リスクより絶対リスク、条件付き確率より自然頻度（人数）、生存率より死亡率などで示すことを勧める。例: 乳がん検診で亡くなるリスクが 25% 減る、は 1,000 人あたり 1 人減ることだった。PubMed の要旨で確認 |
| `okeefe-jensen-2007` | 研究・学術 | [Daniel J. O'Keefe, Jakob D. Jensen（Journal of Health Communication 12）（2007）The relative persuasiveness of gain-framed and loss-framed messages for encouraging disease prevention behaviors: a meta-analytic review](https://pubmed.ncbi.nlm.nih.gov/17934940/) | 2026-10-30 | 病気の予防の行動を促すメッセージの 93 の研究（N=21,656）のメタ分析。得を強調する言い方が、損を強調する言い方より統計的にはわずかに説得的だったが、差はとても小さい（r=.03）。差は主に歯のケアの研究によるもので、安全な性行動・皮膚がんの予防・食事では有意な差がなかった。PubMed の要旨で確認 |
| `huber-1982` | 研究・学術 | [Joel Huber, John W. Payne, Christopher Puto（Journal of Consumer Research 9）（1982）Adding Asymmetrically Dominated Alternatives: Violations of Regularity and the Similarity Hypothesis](https://doi.org/10.1086/208899) | 2026-10-30 | ある選択肢には劣り、別の選択肢には劣らない「非対称に劣る選択肢」（おとり）を足すと、それに勝る選択肢が選ばれる確率が上がりうることを示した。要旨で確認（本文は有料で未開封）。FTC の 2022 年の報告書の一覧には、おとりの選択肢は載っていない |
| `eu-ucpd-annex1` | 公式・法令・規格 | [欧州連合（英国 legislation.gov.uk の EU 法の写し）（2005）Directive 2005/29/EC（Unfair Commercial Practices Directive）Annex I](https://www.legislation.gov.uk/eudr/2005/29/annex/I) | 2026-10-30 | 附属書 I は、どんな場合も不公正とされる取引方法の一覧。第 7 項: すぐに決めさせ、十分に考える時間や機会を奪うために、商品や条件がごく限られた時間しか手に入らないと偽ること。EUR-Lex は中身を取得できず、legislation.gov.uk の写し（2020 年 12 月 31 日時点の版）で確認。指令 (EU) 2019/2161 の第 3 条は附属書 I に 11a・23a〜23c を足しただけで、第 7 項は変えていない（同じサイトの 2019/2161 の条文で確認）。2021 年以降の EU の改正は、この写しでは確かめていない |
| `caa-double-price` | 公式・法令・規格 | [消費者庁（—）二重価格表示（景品表示法の不当表示）](https://www.caa.go.jp/policies/policy/representation/fair_labeling/representation_regulation/double_price/) | 2026-10-30 | 比べる価格（比較対照価格）の中身が適正でない二重価格表示は、不当表示のおそれ。同じ商品を最近相当期間にわたって販売していた価格なら問題にならないが、そう言えない過去の価格は、販売の時期や期間を正確に示さないとおそれがある。考え方は「不当な価格表示についての景品表示法上の考え方」（価格表示ガイドライン）。有利誤認表示（第 5 条第 2 号: 実際や競争事業者より著しく有利だと誤認させる表示）の要件は、同庁の「有利誤認とは」のページで確認 |
| `allcott-2009-ceepr` | 研究・学術 | [Hunt Allcott（MIT Center for Energy and Environmental Policy Research）（2009（10 月の改訂版））Social Norms and Energy Conservation（MIT CEEPR Working Paper 09-014）](https://ceepr.mit.edu/wp-content/uploads/2023/02/2009-014.pdf) | 2026-10-30 | のちの Journal of Public Economics の論文（allcott-2011）の作業論文の版（査読前）。米国ミネソタ州の電力会社の約 8 万世帯のランダム化試験で、毎月の手紙は使用量を 1.9〜2.0% 減らした。手紙の柱は、近くの似た広さの 100 軒との比較（平均と、少ないほうから 20% の家庭。少ない家庭には「Great」「Good」と笑顔の印）と、家庭に合わせた節電の提案の 2 つ。全部をまとめて送ったので、どの部分が効いたかは分けられないと明記。3 か月に 1 回の群では、効果が次の手紙までに薄れ、届くとまた強まった。PDF を開いて確認 |
| `allcott-2015-site-selection` | 研究・学術 | [Hunt Allcott（Quarterly Journal of Economics 130）（2015）Site Selection Bias in Program Evaluation](https://doi.org/10.1093/qje/qjv015) | 2026-10-30 | Opower の 111 のランダム化比較試験（約 860 万世帯）で、最初の 10 か所のデータからの予測は、あとの 101 か所の効果を大きく見積もりすぎた。環境への関心が高い地域の電力会社ほど先に取り入れ、客の反応も大きかったこと、初めは使用量の多い家庭に絞って送り、あとで広げたことなどが理由。NBER Working Paper 18373 の要旨と、Crossref の書誌（130 巻 3 号 1117〜1165 ページ）で確認 |
| `kluger-denisi-1996` | 研究・学術 | [Avraham N. Kluger, Angelo DeNisi（Psychological Bulletin 119）（1996）The effects of feedback interventions on performance: A historical review, a meta-analysis, and a preliminary feedback intervention theory](https://doi.org/10.1037/0033-2909.119.2.254) | 2026-10-30 | フィードバックの介入のメタ分析（607 の効果量・2 万 3,663 の観察）。平均では成績を上げた（d=0.41）が、3 分の 1 以上は成績を下げた。注意が課題から離れて自分自身に向くほど、効果が小さくなるとする。有料のため、要旨（OpenAlex に載る冒頭の文）と Crossref の書誌で確認 |
| `tiefenbeck-2018` | 研究・学術 | [Verena Tiefenbeck ほか（Management Science 64）（2018）Overcoming Salience Bias: How Real-Time Feedback Fosters Resource Conservation](https://doi.org/10.1287/mnsc.2016.2646) | 2026-10-30 | シャワーの最中に、使っているエネルギーと水をその場で表示した大規模なフィールド実験で、シャワーの資源の消費が 22% 減った。もともと多い人ほど減り、家全体の使用量をまとめて返す従来の方法より、絶対量で大きな節約になった。要旨（Crossref）で確認。スイスの約 700 の 1〜2 人世帯・約 2 か月という条件は、ボン大学の発表（2017 年 2 月 7 日）で確認 |
| `bettinger-2012` | 研究・学術 | [Eric P. Bettinger, Bridget Terry Long, Philip Oreopoulos, Lisa Sanbonmatsu（Quarterly Journal of Economics 127）（2012）The Role of Application Assistance and Information in College Decisions: Results from the H&R Block FAFSA Experiment](https://doi.org/10.1093/qje/qjs017) | 2026-10-30 | 税の申告の手伝いを受けに来た所得の低い家庭に、連邦の学生の学資援助の申請書（FAFSA）の記入をその場で手伝い、援助の見込みも伝えたランダム化試験。親が手伝いを受けた高校 3 年生は、実験から 3 年以内に大学の 2 年分を終えた割合が 28% から 36% に上がった。援助の見込みの情報だけを渡した家庭は、成果が良くならなかった。有料のため、要旨（OpenAlex）と NBER Working Paper 15361 の要旨、Crossref の書誌で確認 |
| `milkman-2011` | 研究・学術 | [Katherine L. Milkman, John Beshears, James J. Choi, David Laibson, Brigitte C. Madrian（PNAS 108）（2011）Using implementation intentions prompts to enhance influenza vaccination rates](https://doi.org/10.1073/pnas.1103170108) | 2026-10-30 | 米国の大企業の社員に、社内の無料の予防接種の日時と場所を書いた案内を送ったフィールド実験。対照群の接種率は 33.1%。受ける日付を書く欄を足すと +1.5 ポイント（有意差なし）、日付と時刻を書く欄だと +4.2 ポイント（有意）。PubMed の要旨で確認 |
| `dai-2014-fresh-start` | 研究・学術 | [Hengchen Dai, Katherine L. Milkman, Jason Riis（Management Science 60）（2014）The Fresh Start Effect: Temporal Landmarks Motivate Aspirational Behavior](https://doi.org/10.1287/mnsc.2014.1901) | 2026-10-30 | 3 つの記録データの研究（観察研究）で、「ダイエット」の検索・ジムへの来館・目標への約束が、新しい週・月・年・学期の始まり、誕生日、祝日のあとに増えた。要旨（OpenAlex）で確認 |
| `klasnja-2019-heartsteps` | 研究・学術 | [Predrag Klasnja ほか（Annals of Behavioral Medicine 53）（2019）Efficacy of Contextually Tailored Suggestions for Physical Activity: A Micro-randomized Optimization Trial of HeartSteps](https://doi.org/10.1093/abm/kay067) | 2026-10-30 | 歩くことを促すアプリの 6 週間のマイクロランダム化試験（44 人）。本人が選んだ 1 日 5 回までの時刻に、状況に合わせた提案を出すかどうかを毎回ランダムに決めた。提案のあとの 30 分の歩数は、平均で 14% 増（p=0.06）。始めのころは 66% 増だったが、日がたつにつれて効果は小さくなった。座りすぎを防ぐ提案は効果が見られなかった。PubMed の要旨で確認 |
| `caa-moushikomi-guideline` | 公式・法令・規格 | [消費者庁（2023（4 月の版））通信販売の申込み段階における表示についてのガイドライン（別添 9）](https://www.no-trouble.caa.go.jp/pdf/20230421la02_09.pdf) | 2026-10-30 | 特定商取引法 第 12 条の 6 の解説。最終確認画面に出す「申込みの撤回又は解除に関する事項」には、解約の条件・方法・効果（例: 定期購入の解約の申出の期限、違約金）が含まれる。解約の方法を特定の手段や時間帯に限るなどの制約は、リンク先に任せず最終確認画面にも明確に表示する必要がある。「いつでも解約可能」と強調しながら実際は条件がある表示は「人を誤認させるような表示」に当たるおそれがある、とする。特定商取引法ガイドの通信販売のページからリンクされた PDF を開いて確認 |
| `johari-2022` | 研究・学術 | [Ramesh Johari, Pete Koomen, Leonid Pekelis, David Walsh（Operations Research 70）（2022）Always Valid Inference: Continuous Monitoring of A/B Tests](https://doi.org/10.1287/opre.2021.2135) | 2026-10-30 | A/B テストの p 値と信頼区間は、結果を見ながら続けるか止めるか（人数）を決める、つまり途中で何度も見ると、まったく当てにならなくなると指摘し、いつ判断しても使える p 値と信頼区間を提案した。大規模な商用の A/B テストの基盤で使われている。抄録（Crossref の書誌）と arXiv 版（1512.04922）の抄録で確認。本文は未開封 |
| `kohavi-2020` | 実務の指針 | [Ron Kohavi, Diane Tang, Ya Xu（Cambridge University Press）（2020）Trustworthy Online Controlled Experiments: A Practical Guide to A/B Testing](https://doi.org/10.1017/9781108653985) | 2026-10-30 | オンライン実験（A/B テスト）の実務書。第 21 章の要約で、ガードレール指標を、実験の前提が崩れたことを知らせる重要な指標とし、組織のガードレール（事業を守る。第 7 章で扱う）と信頼性のガードレールの 2 種類があり、群の人数の比のずれ（SRM）はすべての実験で見るべきだとしている。本文は未開封で、Cambridge Core の章の要約と Crossref の書誌で確認 |

台本と図は、ナッジと選択アーキテクチャの研究（Thaler & Sunstein など）、FTC・OECD・欧州連合・消費者庁・環境省の公式資料（2026 年 10 月確認）をもとに作成。サンプル家計簿は架空のアプリで、数字は説明用の仮の例です
