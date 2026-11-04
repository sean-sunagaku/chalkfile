// 講座の出典と公式リンクの表。章は ID から引き、訳は説明の上書きだけを持つ。
import { defineSources } from '../sources-util';

export const SOURCE_TABLE = defineSources([
  {
    "id": "thaler-sunstein-2008",
    "title": "Nudge: Improving Decisions About Health, Wealth, and Happiness",
    "url": "https://yalebooks.yale.edu/book/9780300262285/nudge/",
    "publisher": "Richard H. Thaler, Cass R. Sunstein（Yale University Press）",
    "year": "2008（リンクは 2021 年の Final Edition）",
    "kind": "research",
    "checked": "2026-10-30",
    "note": "ナッジの定義（選択肢を禁じず、経済的インセンティブを大きく変えずに行動を予測できる向きに変える選択アーキテクチャの要素。2009 年版 p.6 の定義を Mongin & Cozic 2018 の引用で確認）と、選択アーキテクチャの考え方。研究者の間でも定義の範囲は揺れている"
  },
  {
    "id": "sunstein-2014-guide",
    "title": "Nudging: A Very Short Guide",
    "url": "https://doi.org/10.1007/s10603-014-9273-1",
    "publisher": "Cass R. Sunstein（Journal of Consumer Policy 37）",
    "year": "2014",
    "kind": "research",
    "checked": "2026-10-30",
    "note": "ナッジを、自由を残したまま特定の方向へ導く手法と短く定義し、義務・禁止や経済的インセンティブと比べている。選択アーキテクチャは常にある（中立な設計は無い）という整理"
  },
  {
    "id": "thaler-2015-nyt",
    "title": "The Power of Nudges, for Good and Bad",
    "url": "https://www.nytimes.com/2015/11/01/upshot/the-power-of-nudges-for-good-and-bad.html",
    "publisher": "Richard H. Thaler（The New York Times）",
    "year": "2015",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "コラムで示した良いナッジの 3 原則（透明で誤解させない・できるだけ簡単にオプトアウトできる・本人の福祉を高めると考える十分な理由がある）。公式の基準ではなく提唱者の指針。記事はツールで開けず、所在と日付（2015-10-31 公開）は Thaler の会社のページの再掲で確認"
  },
  {
    "id": "thaler-2018-sludge",
    "title": "Nudge, not sludge",
    "url": "https://doi.org/10.1126/science.aau9241",
    "publisher": "Richard H. Thaler（Science 361）",
    "year": "2018",
    "kind": "research",
    "checked": "2026-10-30",
    "note": "選択アーキテクチャを悪用して、良い選択を難しくしたり、本人のためにならない行動を促したりする逆向きの工夫を「スラッジ」と呼んだ 1 ページの論説（実証研究ではない）"
  },
  {
    "id": "ftc-2022-dark-patterns",
    "title": "Bringing Dark Patterns to Light（Staff Report）",
    "url": "https://www.ftc.gov/system/files/ftc_gov/pdf/P214800%20Dark%20Patterns%20Report%209.14.2022%20-%20FINAL.pdf",
    "publisher": "米国連邦取引委員会（FTC）",
    "year": "2022",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "スタッフ報告（2022 年 9 月、委員会が 5 対 0 で公表を承認）。ダークパターンを、利用者をだましたり操ったりして本来しなかった選択をさせ、害を与えうる設計の手法と説明（法律上の定義ではない）。広告の偽装・偽の期限、解約の妨害、条件や手数料の隠蔽、個人データの提供への誘導を代表的な手口に挙げる"
  },
  {
    "id": "oecd-2022-dark-patterns",
    "title": "Dark Commercial Patterns（OECD Digital Economy Papers No. 336）",
    "url": "https://doi.org/10.1787/44f5e846-en",
    "publisher": "OECD",
    "year": "2022",
    "kind": "official",
    "checked": "2026-10-31",
    "note": "Digital Economy Papers No. 336（2022-10-26）。ダークパターンの作業定義・7 つの分類・広がりと害の証拠・規制と執行の選択肢・自己監査。穏やかに見える手口でも同じくらい効くことがあり、決定版の分類は難しいとする。本体の PDF で確認（DOI の先は 403。公式 PDF は https://www.oecd.org/content/dam/oecd/en/publications/reports/2022/10/dark-commercial-patterns_9f6169cd/44f5e846-en.pdf ）"
  },
  {
    "id": "eu-dsa-art25",
    "title": "Regulation (EU) 2022/2065（Digital Services Act）Article 25",
    "url": "https://eur-lex.europa.eu/eli/reg/2022/2065/oj",
    "publisher": "欧州連合",
    "year": "2022",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "第 25 条: オンラインプラットフォームの提供者は、利用者をだましたり操ったりして自由で情報に基づく判断をゆがめるインターフェースを作ってはならない。不公正取引慣行指令と GDPR の対象の行為は除く。欧州委員会が指針を出せる例は (a) 選択肢を目立たせる (b) 選んだことを繰り返し求める (c) 解約を申込みより難しくする。零細・小規模の事業者のプラットフォームは、超大規模のものを除いて対象外（第 19 条）。適用は 2024-02-17 から。EU 出版局の官報の正文で確認"
  },
  {
    "id": "caa-tokushoho-2022",
    "title": "特定商取引法ガイド 通信販売（特定申込みを受ける際の表示）",
    "url": "https://www.no-trouble.caa.go.jp/what/mailorder/",
    "publisher": "消費者庁",
    "year": "2022",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "2022 年 6 月 1 日施行の改正（令和 3 年法律第 72 号）で、通信販売の最終確認画面（紙の申込書も含む）の表示事項が義務化され、誤認させる表示が禁止された（第 12 条の 6）。誤認して申し込んだ人は取り消せる（第 15 条の 4）"
  },
  {
    "id": "best-ethics-checklist",
    "title": "ナッジ等の行動インサイトの活用に関わる倫理チェックリスト ②社会実装編",
    "url": "https://www.env.go.jp/earth/ondanka/nudge/checklist_deploy.pdf",
    "publisher": "日本版ナッジ・ユニット BEST（環境省）",
    "year": "2020（12 月）",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "施策や製品・サービスとして実際に使う段階のためのチェックリスト（効果の事前確認などの項目）。少額のポイントのように経済的インセンティブを小さく変えるものも除外されておらず、大小だけでは一様に言えないとする。満たせば十分というものではないと明記"
  },
  {
    "id": "johnson-goldstein-2003",
    "title": "Do Defaults Save Lives?",
    "url": "https://doi.org/10.1126/science.1091721",
    "publisher": "Eric J. Johnson, Daniel Goldstein（Science 302）",
    "year": "2003",
    "kind": "research",
    "checked": "2026-10-30",
    "note": "臓器提供の意思表示がデフォルトで大きく変わることを示した短い論文。オンライン実験で、同意が初期設定だと 82%、不同意が初期設定だと 42% が同意（再現研究の原典の説明で確認。本文は未開封）"
  },
  {
    "id": "madrian-shea-2001",
    "title": "The Power of Suggestion: Inertia in 401(k) Participation and Savings Behavior",
    "url": "https://doi.org/10.1162/003355301753265543",
    "publisher": "Brigitte C. Madrian, Dennis F. Shea（Quarterly Journal of Economics 116）",
    "year": "2001",
    "kind": "research",
    "checked": "2026-10-30",
    "note": "米国の大企業 1 社が 401(k)（確定拠出型の退職貯蓄制度）を自動加入に変えると、加入率が有意に大きく上がり、既定の拠出率と運用先のまま残る人が多かった（慣性と、既定を会社の助言と受け止めることが原因とされる）。NBER 版の要旨で確認"
  },
  {
    "id": "mertens-2022",
    "title": "The effectiveness of nudging: A meta-analysis of choice architecture interventions across behavioral domains",
    "url": "https://doi.org/10.1073/pnas.2107346118",
    "publisher": "Stephanie Mertens ほか（PNAS 119）",
    "year": "2022",
    "kind": "research",
    "checked": "2026-10-30",
    "note": "選択アーキテクチャの介入のメタ分析。2022 年 5 月の訂正（PNAS 119(19) e2204059119）後の値で、212 本・447 の効果量・約 215 万人、全体の効果量 d=0.43［0.38, 0.48］（訂正前は 0.45）。決定の構造（デフォルトなど）が最も大きい（0.54）。著者も出版バイアスを認めている"
  },
  {
    "id": "maier-2022",
    "title": "No evidence for nudging after adjusting for publication bias",
    "url": "https://doi.org/10.1073/pnas.2200300119",
    "publisher": "Maximilian Maier ほか（PNAS 119）",
    "year": "2022",
    "kind": "research",
    "checked": "2026-10-30",
    "note": "Mertens ほかのデータを出版バイアスで補正すると、平均効果は d≈0.04 で証拠は弱い（効果なしの証明ではなく、どちらとも決まらない水準）。情報を出すだけの介入と金融の分野は効果がないことを支持し、決定の構造の介入ははっきりしない"
  },
  {
    "id": "dellavigna-linos-2022",
    "title": "RCTs to Scale: Comprehensive Evidence From Two Nudge Units",
    "url": "https://doi.org/10.3982/ECTA18709",
    "publisher": "Stefano DellaVigna, Elizabeth Linos（Econometrica 90）",
    "year": "2022",
    "kind": "research",
    "checked": "2026-10-31",
    "note": "米国の 2 つのナッジ・ユニットの 126 の RCT（約 2,300 万人）の平均効果は +1.4 ポイント（対照群比 +8.0%、統計的に有意）。学術誌の研究は +8.7 ポイント（+33.4%）。差の約 7 割は、検出力の低さで強まった選択的な出版で説明できる（2026-10-31 に要旨で確かめ直し）"
  },
  {
    "id": "bit-east-2014",
    "title": "EAST: Four simple ways to apply behavioural insights",
    "url": "https://www.bi.team/publications/east-four-simple-ways-to-apply-behavioural-insights/",
    "publisher": "The Behavioural Insights Team",
    "year": "2014（配布中の PDF は 2024 年 12 月の改訂版）",
    "kind": "practice",
    "checked": "2026-10-31",
    "note": "Easy（デフォルト・手間を減らす・簡単に伝える）・Attractive（注意を引く・インセンティブの工夫）・Social（多くの人がしていると示す・つながり・互恵）・Timely（よい時機・目の前の損得・前もって計画）。改訂版は、規範の伝え方が逆効果になる条件や、本人のためになる手間にも触れる。PDF で確認（改訂版の公開は 2024-12-16。配布中の PDF ファイルは 2025 年 4 月に作られたもの）"
  },
  {
    "id": "oecd-basic-2019",
    "title": "Tools and Ethics for Applied Behavioural Insights: The BASIC Toolkit",
    "url": "https://doi.org/10.1787/9ea76a8f-en",
    "publisher": "OECD",
    "year": "2019",
    "kind": "official",
    "checked": "2026-10-31",
    "note": "行動インサイトを政策に使う 5 段階（Behaviour: 大事な行動に絞る／Analysis: 行動科学の見方で調べる（ABCD）／Strategy: 解決策を考える／Intervention: 成功の定義・標本の大きさ・リスクを決めて実験で確かめる（RCT が理想）／Change: 実施・広げ方・見張り・評価・共有）と、段階ごとの倫理の注意。2026-10-31 に oecd.org の公式 PDF（publications/reports/2019/06 の版）で確かめ直した（HTML のページは 403）"
  },
  {
    "id": "schultz-2007",
    "title": "The Constructive, Destructive, and Reconstructive Power of Social Norms",
    "url": "https://doi.org/10.1111/j.1467-9280.2007.01917.x",
    "publisher": "P. Wesley Schultz ほか（Psychological Science 18）",
    "year": "2007",
    "kind": "research",
    "checked": "2026-10-30",
    "note": "米国サンマルコスの 290 世帯（最終 287）の実験。自分の使用量・近所の平均・節電のヒントを伝えると、平均より少ない家庭は使用量が増えた（約 +0.89 kWh/日、ブーメラン効果）。笑顔・困り顔の印（命令的な規範）を添えると増えず、多い家庭は約 −1.72 kWh/日減った。PubMed の要旨と本文の PDF で確認"
  },
  {
    "id": "allcott-2011",
    "title": "Social norms and energy conservation",
    "url": "https://doi.org/10.1016/j.jpubeco.2011.03.003",
    "publisher": "Hunt Allcott（Journal of Public Economics 95）",
    "year": "2011",
    "kind": "research",
    "checked": "2026-10-30",
    "note": "Opower のホームエナジーレポートの約 60 万世帯のランダム化比較試験。平均 2.0% 減（短期の電気料金の 11〜20% の値上げに相当）、使用量の多い上位 1 割は 6.3% 減、下位 1 割は 0.3% 減。命令的な規範の役割は有意ではなかった。要旨と書誌で確認"
  },
  {
    "id": "tversky-kahneman-1981",
    "title": "The Framing of Decisions and the Psychology of Choice",
    "url": "https://doi.org/10.1126/science.7455683",
    "publisher": "Amos Tversky, Daniel Kahneman（Science 211）",
    "year": "1981",
    "kind": "research",
    "checked": "2026-10-30",
    "note": "600 人が亡くなると予想される病気の問題で、「200 人が助かる」と示すと 72% が確実な案を選び、「400 人が亡くなる」と示すと 22% だった（大学生への教室での質問紙）。同じ 5 ドルの値引きでも、15 ドルの品なら 68%、125 ドルなら 29% が遠くの店まで行くと答えた。効果は大きく系統的だが、どこでも起きるわけではないとする。本文のスキャン PDF で確認"
  },
  {
    "id": "eu-crd-art22",
    "title": "Directive 2011/83/EU on consumer rights, Article 22",
    "url": "https://eur-lex.europa.eu/eli/dir/2011/83/oj",
    "publisher": "欧州連合",
    "year": "2011",
    "kind": "official",
    "checked": "2026-10-31",
    "note": "第 22 条: 主な契約の代金に加えて追加の支払いを求めるときは、消費者が契約に縛られる前にはっきりした同意を得なければならない。断らないと払うことになる初期設定（事前のチェック）で同意を推定した場合、消費者はその支払いの返金を受けられる。EUR-Lex は中身を取得できず、legislation.gov.uk の EU 指令の写しで確認。指令 (EU) 2023/2673 により、2026-06-19 から金融サービスの遠隔契約にも適用（第 22 条の文言は変わらない）"
  },
  {
    "id": "fogg-bmap",
    "title": "Fogg Behavior Model",
    "url": "https://behaviormodel.org/",
    "publisher": "BJ Fogg",
    "year": "—",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "動機・能力・きっかけが同じ瞬間にそろうと行動が起きるという枠組み（B=MAP）。能力はいちばん足りない資源で決まり、行動を小さくすることを勧める。きっかけは Facilitator・Signal・Spark の 3 種類。査読のある研究ではなく提唱者の実務の枠組み。公式サイトで確認"
  },
  {
    "id": "sunstein-2015-ethics",
    "title": "The Ethics of Nudging",
    "url": "https://hls.harvard.edu/bibliography/the-ethics-of-nudging",
    "publisher": "Cass R. Sunstein（Yale Journal on Regulation 32）",
    "year": "2015",
    "kind": "research",
    "checked": "2026-10-30",
    "note": "選択アーキテクチャは避けられないので、ナッジそのものに反対しても意味はないが、個別のナッジに反対するのは正当でありうる、という整理（抄録で確認）"
  },
  {
    "id": "sunstein-2022-sludge-audits",
    "title": "Sludge Audits",
    "url": "https://doi.org/10.1017/bpp.2019.32",
    "publisher": "Cass R. Sunstein（Behavioural Public Policy 6）",
    "year": "2022（オンライン 2020）",
    "kind": "research",
    "checked": "2026-10-30",
    "note": "スラッジを過剰な、または正当化できない手間と定義。時間・お金・尊厳を奪い、立場の弱い人ほど影響が大きい。組織による定期的な点検を提案（抄録で確認）"
  },
  {
    "id": "chandrashekar-2023",
    "title": "Defaults versus framing: Revisiting Default Effect and Framing Effect with replications and extensions of Johnson and Goldstein (2003) and Johnson, Bellman, and Lohse (2002)",
    "url": "https://doi.org/10.15626/MP.2022.3108",
    "publisher": "Subramanya Prasad Chandrashekar ほか（Meta-Psychology 7）",
    "year": "2023",
    "kind": "research",
    "checked": "2026-10-31",
    "note": "事前登録した米国の 1,920 人の再現実験。オプトアウト 73.5%・オプトイン 62.5%（初期設定なし 69.7%）で効果は再現されたが、差は約 11 ポイントで原典より小さい（この 3 つの割合は、1,920 人のうちこの課題に答えた 1,446 人の値）。同じ研究で Johnson・Bellman・Lohse（2002）の再現も試し、健康の調査の案内ではデフォルトの効果は出なかった（オプトアウト 60.5%・オプトイン 61.1%。肯定と否定の言い方では 91.7%・28.9%）。臓器提供の案内で試した概念的な再現では向きが逆（24.9%・64.6%）"
  },
  {
    "id": "arshad-2019",
    "title": "Comparison of organ donation and transplantation rates between opt-out and opt-in systems",
    "url": "https://doi.org/10.1016/j.kint.2019.01.036",
    "publisher": "Adam Arshad, Benjamin Anderson, Adnan Sharif（Kidney International 95）",
    "year": "2019",
    "kind": "research",
    "checked": "2026-10-31",
    "note": "OECD 35 か国（2016 年）の比較で、オプトアウトとオプトインの国の間に、亡くなった人からの提供数の有意な差は無かった（観察研究。国ごとの医療体制などの違いが混ざる）。2023 年に訂正（Kidney Int 103(5):998、doi:10.1016/j.kint.2023.03.010）が出ている。訂正の本文は出版社のページが開けず（403）確かめていない。講座で使う主張は原論文の要旨（Europe PMC）で確認"
  },
  {
    "id": "best-ethics-checklist-study",
    "title": "ナッジ等の行動インサイトの活用に関わる倫理チェックリスト ①調査・研究編",
    "url": "https://www.env.go.jp/earth/ondanka/nudge/checklist_study.pdf",
    "publisher": "日本版ナッジ・ユニット BEST（環境省）",
    "year": "2020（3 月。2021 年 3 月改訂）",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "BEST は 2017 年 4 月に環境省の主導で発足。ナッジ倫理委員会が作った、効果を調べる段階のためのチェックリスト。ナッジの定義の和訳と解説も載る"
  },
  {
    "id": "jachimowicz-2019",
    "title": "When and why defaults influence decisions: a meta-analysis of default effects",
    "url": "https://doi.org/10.1017/bpp.2018.43",
    "publisher": "Jon M. Jachimowicz ほか（Behavioural Public Policy 3）",
    "year": "2019",
    "kind": "research",
    "checked": "2026-10-30",
    "note": "デフォルトの効果の 58 のデータ（55 の研究・35 本の論文、計 73,675 人）のメタ分析（オープンアクセスの本文で確認）。オプトアウトとオプトインの差の効果量は d=0.68［0.53, 0.83］。46 件ははっきり正の効果、10 件は有意な差なし、2 件は逆向き。消費の分野で大きく、環境の分野で小さめ。推奨（endorsement）や今の状態（endowment）として受け取られるデフォルトほど効果が大きく、手間（ease）は有意な違いがなかった（手間を変えた研究が少ない）。著者は、効くと決めつけずに試して確かめるよう勧めている"
  },
  {
    "id": "carroll-2009",
    "title": "Optimal Defaults and Active Decisions",
    "url": "https://www.nber.org/papers/w11074",
    "publisher": "Gabriel D. Carroll ほか（Quarterly Journal of Economics 124）",
    "year": "2009（NBER Working Paper 11074）",
    "kind": "research",
    "checked": "2026-10-30",
    "note": "米国の会社の 401(k)（確定拠出型の退職貯蓄の制度）で、入社した人に加入するかを必ず選んでもらう「能動的な選択」にすると、通常のオプトインより、最初に加入する人の割合が 28 ポイント高かった。先延ばしが強く、貯めたい額の好みが人によって大きく違うときは能動的な選択が向き、お金の知識が少ないときは自動加入（デフォルト）が向く、というモデル。NBER のページの要旨で確認（本文は未開封）"
  },
  {
    "id": "gigerenzer-2007",
    "title": "Helping Doctors and Patients Make Sense of Health Statistics",
    "url": "https://pubmed.ncbi.nlm.nih.gov/26161749/",
    "publisher": "Gerd Gigerenzer ほか（Psychological Science in the Public Interest 8）",
    "year": "2007",
    "kind": "research",
    "checked": "2026-10-30",
    "note": "分かりにくい数字の示し方（意図的なものも含む）が誤解を生むとし、相対リスクより絶対リスク、条件付き確率より自然頻度（人数）、生存率より死亡率などで示すことを勧める。例: 乳がん検診で亡くなるリスクが 25% 減る、は 1,000 人あたり 1 人減ることだった。PubMed の要旨で確認"
  },
  {
    "id": "okeefe-jensen-2007",
    "title": "The relative persuasiveness of gain-framed and loss-framed messages for encouraging disease prevention behaviors: a meta-analytic review",
    "url": "https://pubmed.ncbi.nlm.nih.gov/17934940/",
    "publisher": "Daniel J. O'Keefe, Jakob D. Jensen（Journal of Health Communication 12）",
    "year": "2007",
    "kind": "research",
    "checked": "2026-10-30",
    "note": "病気の予防の行動を促すメッセージの 93 の研究（N=21,656）のメタ分析。得を強調する言い方が、損を強調する言い方より統計的にはわずかに説得的だったが、差はとても小さい（r=.03）。差は主に歯のケアの研究によるもので、安全な性行動・皮膚がんの予防・食事では有意な差がなかった。PubMed の要旨で確認"
  },
  {
    "id": "huber-1982",
    "title": "Adding Asymmetrically Dominated Alternatives: Violations of Regularity and the Similarity Hypothesis",
    "url": "https://doi.org/10.1086/208899",
    "publisher": "Joel Huber, John W. Payne, Christopher Puto（Journal of Consumer Research 9）",
    "year": "1982",
    "kind": "research",
    "checked": "2026-10-30",
    "note": "ある選択肢には劣り、別の選択肢には劣らない「非対称に劣る選択肢」（おとり）を足すと、それに勝る選択肢が選ばれる確率が上がりうることを示した。要旨で確認（本文は有料で未開封）。FTC の 2022 年の報告書の一覧には、おとりの選択肢は載っていない"
  },
  {
    "id": "frederick-2014",
    "title": "The Limits of Attraction",
    "url": "https://doi.org/10.1509/jmr.12.0061",
    "publisher": "Shane Frederick, Leonard Lee, Ernest Baskin（Journal of Marketing Research 51）",
    "year": "2014",
    "kind": "research",
    "checked": "2026-10-31",
    "note": "51 巻 4 号 487〜507 ページ。おとりの選択肢の効果（アトラクション効果）は、どの特徴も数字で示した単純な比べ方に限られやすく、実物を試したり、特徴の 1 つでも写真などで示したりすると、ふつうは起きなかったとして、実務での意味に疑問を示した。原典の著者たち（Huber, Payne, Puto）は同じ号の論評（520〜525 ページ）で、条件をそろえれば効果は再現されると反論している。どちらも要旨（OpenAlex）と Crossref の書誌で確認（本文は有料で未開封）"
  },
  {
    "id": "eu-ucpd-annex1",
    "title": "Directive 2005/29/EC（Unfair Commercial Practices Directive）Annex I",
    "url": "https://www.legislation.gov.uk/eudr/2005/29/annex/I",
    "publisher": "欧州連合（英国 legislation.gov.uk の EU 法の写し）",
    "year": "2005",
    "kind": "official",
    "checked": "2026-10-31",
    "note": "附属書 I は、どんな場合も不公正とされる取引方法の一覧。第 7 項: すぐに決めさせ、十分に考える時間や機会を奪うために、商品や条件がごく限られた時間しか手に入らないと偽ること。EUR-Lex は中身を取得できず、legislation.gov.uk の写し（2020 年 12 月 31 日時点の版）で確認。指令 (EU) 2019/2161 の第 3 条は附属書 I に 11a・23a〜23c を足しただけで、第 7 項は変えていない（同じサイトの 2019/2161 の条文で確認）。2021 年以降では、指令 (EU) 2024/825（2026 年 9 月 27 日から適用）が附属書 I に 2a・4a〜4c・10a・23d〜23i（環境の主張や修理・ソフトウェアの更新など）を足したが、第 7 項は変えていない（EU 出版局の官報の正文で確認）"
  },
  {
    "id": "caa-double-price",
    "title": "二重価格表示（景品表示法の不当表示）",
    "url": "https://www.caa.go.jp/policies/policy/representation/fair_labeling/representation_regulation/double_price/",
    "publisher": "消費者庁",
    "year": "—",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "比べる価格（比較対照価格）の中身が適正でない二重価格表示は、不当表示のおそれ。同じ商品を最近相当期間にわたって販売していた価格なら問題にならないが、そう言えない過去の価格は、販売の時期や期間を正確に示さないとおそれがある。考え方は「不当な価格表示についての景品表示法上の考え方」（価格表示ガイドライン）。有利誤認表示（第 5 条第 2 号: 実際や競争事業者より著しく有利だと誤認させる表示）の要件は、同庁の「有利誤認とは」のページで確認"
  },
  {
    "id": "allcott-2009-ceepr",
    "title": "Social Norms and Energy Conservation（MIT CEEPR Working Paper 09-014）",
    "url": "https://ceepr.mit.edu/wp-content/uploads/2023/02/2009-014.pdf",
    "publisher": "Hunt Allcott（MIT Center for Energy and Environmental Policy Research）",
    "year": "2009（10 月の改訂版）",
    "kind": "research",
    "checked": "2026-10-30",
    "note": "のちの Journal of Public Economics の論文（allcott-2011）の作業論文の版（査読前）。米国ミネソタ州の電力会社の約 8 万世帯のランダム化試験で、毎月の手紙は使用量を 1.9〜2.0% 減らした。手紙の柱は、近くの似た広さの 100 軒との比較（平均と、少ないほうから 20% の家庭。少ない家庭には「Great」「Good」と笑顔の印）と、家庭に合わせた節電の提案の 2 つ。全部をまとめて送ったので、どの部分が効いたかは分けられないと明記。3 か月に 1 回の群では、効果が次の手紙までに薄れ、届くとまた強まった。PDF を開いて確認"
  },
  {
    "id": "allcott-2015-site-selection",
    "title": "Site Selection Bias in Program Evaluation",
    "url": "https://doi.org/10.1093/qje/qjv015",
    "publisher": "Hunt Allcott（Quarterly Journal of Economics 130）",
    "year": "2015",
    "kind": "research",
    "checked": "2026-10-30",
    "note": "Opower の 111 のランダム化比較試験（約 860 万世帯）で、最初の 10 か所のデータからの予測は、あとの 101 か所の効果を大きく見積もりすぎた。環境への関心が高い地域の電力会社ほど先に取り入れ、客の反応も大きかったこと、初めは使用量の多い家庭に絞って送り、あとで広げたことなどが理由。NBER Working Paper 18373 の要旨と、Crossref の書誌（130 巻 3 号 1117〜1165 ページ）で確認"
  },
  {
    "id": "kluger-denisi-1996",
    "title": "The effects of feedback interventions on performance: A historical review, a meta-analysis, and a preliminary feedback intervention theory",
    "url": "https://doi.org/10.1037/0033-2909.119.2.254",
    "publisher": "Avraham N. Kluger, Angelo DeNisi（Psychological Bulletin 119）",
    "year": "1996",
    "kind": "research",
    "checked": "2026-10-30",
    "note": "フィードバックの介入のメタ分析（607 の効果量・2 万 3,663 の観察）。平均では成績を上げた（d=0.41）が、3 分の 1 以上は成績を下げた。注意が課題から離れて自分自身に向くほど、効果が小さくなるとする。有料のため、要旨（OpenAlex に載る冒頭の文）と Crossref の書誌で確認"
  },
  {
    "id": "tiefenbeck-2018",
    "title": "Overcoming Salience Bias: How Real-Time Feedback Fosters Resource Conservation",
    "url": "https://doi.org/10.1287/mnsc.2016.2646",
    "publisher": "Verena Tiefenbeck ほか（Management Science 64）",
    "year": "2018",
    "kind": "research",
    "checked": "2026-10-31",
    "note": "シャワーの最中に、使っているエネルギーと水をその場で表示した大規模なフィールド実験で、シャワーの資源の消費が 22% 減った。もともと多い人ほど減り、家全体の使用量をまとめて返す従来の方法より、絶対量で大きな節約になった。要旨（Crossref・OpenAlex）で確認。スイスの約 700 の 1〜2 人世帯・約 2 か月という条件は、ボン大学の発表（2017 年 2 月）を転載した ScienceDaily の記事（2017 年 2 月 9 日）で確認（大学のページそのものは開けていない）"
  },
  {
    "id": "bettinger-2012",
    "title": "The Role of Application Assistance and Information in College Decisions: Results from the H&R Block FAFSA Experiment",
    "url": "https://doi.org/10.1093/qje/qjs017",
    "publisher": "Eric P. Bettinger, Bridget Terry Long, Philip Oreopoulos, Lisa Sanbonmatsu（Quarterly Journal of Economics 127）",
    "year": "2012",
    "kind": "research",
    "checked": "2026-10-30",
    "note": "税の申告の手伝いを受けに来た所得の低い家庭に、連邦の学生の学資援助の申請書（FAFSA）の記入をその場で手伝い、援助の見込みも伝えたランダム化試験。親が手伝いを受けた高校 3 年生は、実験から 3 年以内に大学の 2 年分を終えた割合が 28% から 36% に上がった。援助の見込みの情報だけを渡した家庭は、成果が良くならなかった。有料のため、要旨（OpenAlex）と NBER Working Paper 15361 の要旨、Crossref の書誌で確認"
  },
  {
    "id": "milkman-2011",
    "title": "Using implementation intentions prompts to enhance influenza vaccination rates",
    "url": "https://doi.org/10.1073/pnas.1103170108",
    "publisher": "Katherine L. Milkman, John Beshears, James J. Choi, David Laibson, Brigitte C. Madrian（PNAS 108）",
    "year": "2011",
    "kind": "research",
    "checked": "2026-10-30",
    "note": "米国の大企業の社員に、社内の無料の予防接種の日時と場所を書いた案内を送ったフィールド実験。対照群の接種率は 33.1%。受ける日付を書く欄を足すと +1.5 ポイント（有意差なし）、日付と時刻を書く欄だと +4.2 ポイント（有意）。PubMed の要旨で確認"
  },
  {
    "id": "dai-2014-fresh-start",
    "title": "The Fresh Start Effect: Temporal Landmarks Motivate Aspirational Behavior",
    "url": "https://doi.org/10.1287/mnsc.2014.1901",
    "publisher": "Hengchen Dai, Katherine L. Milkman, Jason Riis（Management Science 60）",
    "year": "2014",
    "kind": "research",
    "checked": "2026-10-30",
    "note": "3 つの記録データの研究（観察研究）で、「ダイエット」の検索・ジムへの来館・目標への約束が、新しい週・月・年・学期の始まり、誕生日、祝日のあとに増えた。要旨（OpenAlex）で確認"
  },
  {
    "id": "klasnja-2019-heartsteps",
    "title": "Efficacy of Contextually Tailored Suggestions for Physical Activity: A Micro-randomized Optimization Trial of HeartSteps",
    "url": "https://doi.org/10.1093/abm/kay067",
    "publisher": "Predrag Klasnja ほか（Annals of Behavioral Medicine 53）",
    "year": "2019",
    "kind": "research",
    "checked": "2026-10-30",
    "note": "歩くことを促すアプリの 6 週間のマイクロランダム化試験（44 人）。本人が選んだ 1 日 5 回までの時刻に、状況に合わせた提案を出すかどうかを毎回ランダムに決めた。提案のあとの 30 分の歩数は、平均で 14% 増（p=0.06）。始めのころは 66% 増だったが、日がたつにつれて効果は小さくなった。座りすぎを防ぐ提案は効果が見られなかった。PubMed の要旨で確認"
  },
  {
    "id": "ravenscroft-2020",
    "title": "Video-observed therapy and medication adherence for tuberculosis patients: randomised controlled trial in Moldova",
    "url": "https://doi.org/10.1183/13993003.00493-2020",
    "publisher": "Luke Ravenscroft ほか（European Respiratory Journal 56）",
    "year": "2020",
    "kind": "research",
    "checked": "2026-10-31",
    "note": "モルドバの結核の患者 197 人（多剤耐性の人は除く）を、診療所で医療者の前で薬を飲む群（99 人）と、飲む様子を動画で送る群（98 人）にランダムに分けた試験。主な指標は 2 週間のうちに服薬を確かめられなかった日数で、平均 5.24 日から 1.29 日に減った（p<0.01）。患者の時間と費用も減った。治療の成功には有意な差が見られなかった。Europe PMC の要旨と Crossref の書誌で確認（本文は未開封）。BIT の EAST の改訂版の図が示す「服薬を確かめられた日の割合 44% → 84%」は、論文の主な指標とは数え方が違う"
  },
  {
    "id": "caa-moushikomi-guideline",
    "title": "通信販売の申込み段階における表示についてのガイドライン（別添 9）",
    "url": "https://www.no-trouble.caa.go.jp/pdf/20230421la02_09.pdf",
    "publisher": "消費者庁",
    "year": "2023（4 月の版）",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "特定商取引法 第 12 条の 6 の解説。最終確認画面に出す「申込みの撤回又は解除に関する事項」には、解約の条件・方法・効果（例: 定期購入の解約の申出の期限、違約金）が含まれる。解約の方法を特定の手段や時間帯に限るなどの制約は、リンク先に任せず最終確認画面にも明確に表示する必要がある。「いつでも解約可能」と強調しながら実際は条件がある表示は「人を誤認させるような表示」に当たるおそれがある、とする。特定商取引法ガイドの通信販売のページからリンクされた PDF を開いて確認"
  },
  {
    "id": "johari-2022",
    "title": "Always Valid Inference: Continuous Monitoring of A/B Tests",
    "url": "https://doi.org/10.1287/opre.2021.2135",
    "publisher": "Ramesh Johari, Pete Koomen, Leonid Pekelis, David Walsh（Operations Research 70）",
    "year": "2022",
    "kind": "research",
    "checked": "2026-10-30",
    "note": "A/B テストの p 値と信頼区間は、結果を見ながら続けるか止めるか（人数）を決める、つまり途中で何度も見ると、まったく当てにならなくなると指摘し、いつ判断しても使える p 値と信頼区間を提案した。大規模な商用の A/B テストの基盤で使われている。抄録（Crossref の書誌）と arXiv 版（1512.04922）の抄録で確認。本文は未開封"
  },
  {
    "id": "kohavi-2020",
    "title": "Trustworthy Online Controlled Experiments: A Practical Guide to A/B Testing",
    "url": "https://doi.org/10.1017/9781108653985",
    "publisher": "Ron Kohavi, Diane Tang, Ya Xu（Cambridge University Press）",
    "year": "2020",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "オンライン実験（A/B テスト）の実務書。第 21 章の要約で、ガードレール指標を、実験の前提が崩れたことを知らせる重要な指標とし、組織のガードレール（事業を守る。第 7 章で扱う）と信頼性のガードレールの 2 種類があり、群の人数の比のずれ（SRM）はすべての実験で見るべきだとしている。本文は未開封で、Cambridge Core の章の要約と Crossref の書誌で確認"
  }
]);
export const SOURCES = SOURCE_TABLE.sources;
export const docsOf = SOURCE_TABLE.docs;
