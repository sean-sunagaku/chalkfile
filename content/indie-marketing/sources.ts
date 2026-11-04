// 講座の出典と公式リンクの表。章は ID から引き、訳は説明の上書きだけを持つ。
import { defineSources } from '../sources-util';

export const SOURCE_TABLE = defineSources([
  {
    "id": "ama-definition-2017",
    "title": "Definitions of Marketing",
    "url": "https://www.ama.org/the-definition-of-marketing-what-is-marketing/",
    "publisher": "American Marketing Association",
    "year": "2007 年採択・2017 年見直し",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "マーケティングの定義（顧客・取引先・パートナー・社会全体にとって価値のある提供物を、創り・伝え・届け・交換するための活動・制度の集まり・プロセス）。研究者のパネルが定期的に見直して再承認している"
  },
  {
    "id": "jma-definition-2024",
    "title": "34 年振りにマーケティングの定義を刷新",
    "url": "https://www.jma2-jp.org/home/news/916-marketing",
    "publisher": "公益社団法人 日本マーケティング協会",
    "year": "2024（1 月 25 日公表）",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "1990 年の旧定義から 34 年ぶりの改定。顧客や社会と共に価値を創造し、広く浸透させ、関係を育て、豊かで持続可能な社会をつくる構想とプロセスという趣旨。注で主体は企業に限らず個人や非営利組織もなりうるとする。公式ページはこちらの環境から開けず（403・Cloudflare のエラー）、中身は協会への取材記事で確認"
  },
  {
    "id": "christensen-2016-jtbd",
    "title": "Know Your Customers’ ‘Jobs to Be Done’",
    "url": "https://hbr.org/2016/09/know-your-customers-jobs-to-be-done",
    "publisher": "Clayton M. Christensen, Taddy Hall, Karen Dillon, David S. Duncan（Harvard Business Review）",
    "year": "2016（9 月号）",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "製品を買うことは、ある状況で片付けたい用事（ジョブ）のために製品を雇うこと、という考え方。用事には社会的・感情的な面もあり、顧客の属性より状況が大事（研究にもとづく実務誌の記事。本文は有料で、要旨で確認）"
  },
  {
    "id": "nta-jigyo-shotoku",
    "title": "No.1350 事業所得の課税のしくみ（事業所得）",
    "url": "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1350.htm",
    "publisher": "国税庁",
    "year": "令和 8 年 4 月 1 日現在法令等",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "事業所得の金額は「総収入金額 − 必要経費」で計算する"
  },
  {
    "id": "nist-binomial-ci",
    "title": "NIST/SEMATECH e-Handbook of Statistical Methods 7.2.4.1 Confidence intervals（割合の信頼区間）",
    "url": "https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm",
    "publisher": "NIST",
    "year": "—",
    "kind": "research",
    "checked": "2026-10-30",
    "note": "割合の信頼区間の求め方。正規近似は下限が負になりうるので劣るとし、Wilson のスコア区間を勧める（小見出しは Agresti and Coull で、今は Wilson 法と呼ぶと注記）"
  },
  {
    "id": "blank-customer-development",
    "title": "Teaching Entrepreneurship – By Getting Out of the Building",
    "url": "https://steveblank.com/2010/03/11/teaching-entrepreneurship-%E2%80%93-by-getting-out-of-the-building/",
    "publisher": "Steve Blank",
    "year": "2010",
    "kind": "practice",
    "checked": "2026-10-31",
    "note": "顧客と課題の仮説は社内では確かめられないので、オフィスの外に出て実際の顧客で確かめる（顧客開発。著書『The Four Steps to the Epiphany』で示したモデル）。記事の言い方は「どんなビジネスモデルも（事業の計画ではない）、顧客との最初の出会いを生き延びない」"
  },
  {
    "id": "mom-test",
    "title": "The Mom Test",
    "url": "https://www.momtestbook.com/",
    "publisher": "Rob Fitzpatrick",
    "year": "2013",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "副題は、みんなが本当のことを言わないときに、顧客と話して事業の案を確かめる方法。偏った答えを避ける・返事が来る連絡・本当に買うかの見極めを扱う（公式ページで確認）。相手の暮らしの話を聞く・過去の具体的なことを聞く・話すより聞く、などのきまりは本書によるもので、公式ページには無く要約で突き合わせた。年は公式ページに書かれていない"
  },
  {
    "id": "lean-startup",
    "title": "The Lean Startup: Principles",
    "url": "https://theleanstartup.com/principles",
    "publisher": "Eric Ries",
    "year": "2011",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "作る・測る・学ぶ（Build-Measure-Learn）を速く回し、検証で得た学びを進み具合の単位にする。行動につながる数字（actionable metrics）で、方向を変えるか続けるか（pivot or persevere）を決める"
  },
  {
    "id": "dunford-positioning",
    "title": "Obviously Awesome",
    "url": "https://www.aprildunford.com/books",
    "publisher": "April Dunford",
    "year": "2019",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "ポジショニングはマーケティングと営業の土台で、5 つの要素に分けて組み立てる本（改訂・増補版あり。公式ページで確認）。要素の名前と順番（代わりの手段 → 独自の特徴 → 価値 → 対象顧客 → カテゴリー）は本人の解説 dunford-quickstart-2021 で確認。企業向けソフトの例が中心。年は公式ページに書かれていない"
  },
  {
    "id": "caa-keihyo-yuryo",
    "title": "優良誤認とは",
    "url": "https://www.caa.go.jp/policies/policy/representation/fair_labeling/representation_regulation/misleading_representation/",
    "publisher": "消費者庁",
    "year": "—",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "品質・規格などを実際より（または競合より）著しく優良と示す表示は優良誤認表示（第 5 条第 1 号）。わざとでなくても対象。根拠資料を出せなければ不当表示とみなされる（不実証広告規制、第 7 条第 2 項）"
  },
  {
    "id": "caa-stealth-marketing",
    "title": "ステルスマーケティングに関する景品表示法の規制",
    "url": "https://www.caa.go.jp/policies/policy/representation/fair_labeling/stealth_marketing/",
    "publisher": "消費者庁",
    "year": "2023 年 10 月 1 日施行",
    "kind": "official",
    "checked": "2026-10-31",
    "note": "2023 年 10 月 1 日から、事業者の広告なのに一般の消費者がそれと見分けにくい表示を不当表示に指定。規制の対象は広告主の事業者で、頼まれて投稿した第三者は対象外（事業者が内容の決定に関わった投稿は、事業者の表示になる）"
  },
  {
    "id": "soumu-tokutei-email",
    "title": "迷惑メール対策（特定電子メール法）",
    "url": "https://www.soumu.go.jp/main_sosiki/joho_tsusin/d_syohi/m_mail.html",
    "publisher": "総務省",
    "year": "—",
    "kind": "official",
    "checked": "2026-10-31",
    "note": "広告・宣伝のメールは、原則としてあらかじめ同意した人にだけ送れる（オプトイン）。例外（取引関係・名刺などでアドレスを知らせた人・公表しているアドレス）、送信者名と受信拒否の連絡先などの表示、同意の記録の保存。ページの本文は Shift_JIS（取得したときに文字化けした）。リンク先のパンフレットとガイドラインの PDF、e-Gov の法令の本文（2025-06-01 施行の版）で確認"
  },
  {
    "id": "google-seo-starter",
    "title": "SEO スターター ガイド",
    "url": "https://developers.google.com/search/docs/fundamentals/seo-starter-guide?hl=ja",
    "publisher": "Google 検索セントラル",
    "year": "—",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "検索で見つけてもらうための基本（見つけてもらう・サイトを整理する・役に立つ内容・検索結果での見え方）。変更の反映には数時間から数か月かかる（2025-12-18 更新）"
  },
  {
    "id": "cbinsights-failure",
    "title": "The Top 12 Reasons Startups Fail",
    "url": "https://www.cbinsights.com/reports/CB-Insights_Top-Reasons-Startups-Fail.pdf",
    "publisher": "CB Insights",
    "year": "2021",
    "kind": "research",
    "checked": "2026-10-30",
    "note": "2018 年以降の事後の振り返り 111 件を分類。資金が尽きた・調達できなかった 38%、市場のニーズがない 35%。自己申告・複数回答・成功例との比較なし。商用の調査で査読なし"
  },
  {
    "id": "mcclure-aarrr",
    "title": "Startup Metrics for Pirates",
    "url": "https://www.slideshare.net/dmc500hats/startup-metrics-for-pirates-long-version",
    "publisher": "Dave McClure",
    "year": "2007",
    "kind": "practice",
    "checked": "2026-10-31",
    "note": "獲得・利用開始・継続・紹介・収益（AARRR）の段階で数字を見る実務の枠組み。段階のあいだの割合は 5〜10 個に絞る、利用開始の目安の 1 つは主な機能を 1 回使うこと、スライドの割合の表は実際の値ではないと注記。例の表（slide 4）では、サイトに来る・すぐ帰らないを獲得（Acquisition）、登録（Acct Signup）を利用開始（Activation）に入れている（本人のスライド。年は元のブログの URL からの推定）"
  },
  {
    "id": "sean-ellis-pmf",
    "title": "How Superhuman Built an Engine to Find Product/Market Fit",
    "url": "https://review.firstround.com/how-superhuman-built-an-engine-to-find-product-market-fit/",
    "publisher": "Rahul Vohra（First Round Review）",
    "year": "2018",
    "kind": "practice",
    "checked": "2026-10-31",
    "note": "Sean Ellis の目安（「使えなくなったら非常に残念」が 40% 以上）を紹介（2018-11-13）。聞く相手は 2 週間に 2 回以上使った人、1 人に 1 回、40 人ほどで方向が見え始める。Ellis が約 100 社を比べて見つけた経験則で、統計的な基準ではない（ページの更新日は 2024-10-24、中身は 2018 年の記事のまま）。Ellis の元の記事は開けなかった"
  },
  {
    "id": "van-westendorp",
    "title": "NSS-Price Sensitivity Meter (PSM) – A new approach to study consumer perception of price",
    "url": "https://cran.r-project.org/web/packages/pricesensitivitymeter/refman/pricesensitivitymeter.html",
    "publisher": "Peter van Westendorp（Proceedings of the 29th ESOMAR Congress）",
    "year": "1976",
    "kind": "practice",
    "checked": "2026-10-31",
    "note": "「高すぎる・安すぎて不安・高いと感じ始める・お得」の 4 つの価格を聞き、受け入れられる価格帯を探る方法。原典は開けず、書誌は実装パッケージの説明で確認。需要量は推定できない"
  },
  {
    "id": "advertimes-jma-2024",
    "title": "日本マーケティング協会が 34 年ぶりにマーケティングの定義を刷新（協会トップへの取材）",
    "url": "https://www.advertimes.com/20240131/article447566/",
    "publisher": "宣伝会議 AdverTimes",
    "year": "2024",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "業界紙の記事（二次資料）。新しい定義と 3 つの注、委員会で約半年かけて作った経緯。公式ページが開けなかったので中身の確認に使った"
  },
  {
    "id": "cbinsights-failure-2014",
    "title": "The Top 20 Reasons Startups Fail",
    "url": "https://www.cbinsights.com/reports/The-20-Reasons-Startups-Fail.pdf",
    "publisher": "CB Insights",
    "year": "2014（PDF は 2019）",
    "kind": "research",
    "checked": "2026-10-30",
    "note": "創業者が公開した事後の振り返り 101 件を分類。市場のニーズがない 42%、資金が尽きた 29%、チームが合っていない 23%。複数回答で、合計は 100% を超える"
  },
  {
    "id": "apple-japan-2025",
    "title": "Changes to iOS in Japan（日本でのアプリ配信）",
    "url": "https://developer.apple.com/support/app-distribution-in-japan/",
    "publisher": "Apple",
    "year": "2025（12 月 17 日発表）",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "iOS 26.2 以降、日本で配信する iOS アプリは、App Store の手数料 21%（小規模事業者プログラムなどの参加者と、2 年目以降の自動更新の定期購読は 10%）。Apple のアプリ内課金を使うと別に決済の手数料 5%。アプリから Web の購入へ案内した場合は 7 日以内の購入に 15%（同じ条件で 10%）。App Store 以外で配信する場合は 5%。全部の開発者は 2026-03-17 までに新しい規約への同意が必要だった。日付は Apple の発表（2025-12-17）と公取委のページ（2025-12-18 全面施行）で確認。条件は変わりうる"
  },
  {
    "id": "ama-definition-review-2026",
    "title": "What Is Marketing?（定義の見直しの作業部会の告知）",
    "url": "https://www.ama.org/listings/2026/08/30/what-is-marketing/",
    "publisher": "American Marketing Association",
    "year": "2026（8 月 30 日）",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "いまの文言は 2007 年採択、最後の正式な見直しは 2017 年。定義を改めるかを検討する作業部会（座長 Michael Haenlein）を作り、9 月 14 日まで意見を募集。2026-10-30 時点で新しい定義は未公表"
  },
  {
    "id": "cbinsights-failure-2026",
    "title": "The top 9 reasons startups fail",
    "url": "https://www.cbinsights.com/research/report/startup-failure-reasons-top/",
    "publisher": "CB Insights",
    "year": "2026（3 月 5 日）",
    "kind": "research",
    "checked": "2026-10-30",
    "note": "2023 年以降に事業を終えた VC 出資の 431 社（理由が分かった 385 社）。資金切れ 70%（最後の引き金で根本の原因ではないと注記）、製品と市場が合わない 43% など。複数を数える"
  },
  {
    "id": "caa-fujitsusho",
    "title": "不実証広告規制",
    "url": "https://www.caa.go.jp/policies/policy/representation/fair_labeling/representation_regulation/misleading_representation/not_demonstrated_ad",
    "publisher": "消費者庁",
    "year": "—",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "消費者庁は期間を決めて合理的な根拠の資料を求められ、出せないと措置命令では不当表示とみなされる（課徴金では推定）。根拠は客観的に実証され、表示の中身と対応していること。アンケートなら無作為に選んだ十分な人数が要る"
  },
  {
    "id": "nta-zatsu-shotoku",
    "title": "No.1500 雑所得",
    "url": "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1500.htm",
    "publisher": "国税庁",
    "year": "令和 8 年 4 月 1 日現在法令等",
    "kind": "official",
    "checked": "2026-10-31",
    "note": "副業などの「業務に係る雑所得」も、総収入金額 − 必要経費で計算する"
  },
  {
    "id": "caa-stealth-marketing-qa",
    "title": "ステルスマーケティングに関する Q&A",
    "url": "https://www.caa.go.jp/policies/policy/representation/fair_labeling/faq/stealth_marketing/",
    "publisher": "消費者庁",
    "year": "—",
    "kind": "official",
    "checked": "2026-10-31",
    "note": "事業者の表示に当たるかは、事業者が表示内容の決定に関与したか（やり取り・対価・目的・関係）で判断する。個別に依頼して報酬を払う、内容を条件にする投稿は当たる可能性が高く、依頼によらない自主的な感想は原則当たらない。明らかにする方法は「広告」「宣伝」「プロモーション」「PR」の文言や「A 社から商品の提供を受けて投稿している」のような文。SNS で返信（ツリー）にだけ書くのは多くの場合不十分で、動画の冒頭だけで示すなども不十分になりうる。自社サイトの利用者の声は、選ばず手を加えずに載せれば当たらないが、好意的な声だけを選ぶと事業者の表示になり、その旨を示す必要がある（Q10・Q16）。規制の対象は広告主で、頼まれた第三者は原則対象外（Q1）。内容を指定せずに口コミを頼み、割引やクーポンを渡す程度なら通常は当たらないが、星 5 などを条件にすると当たる（Q6・Q7）。ステマの表示そのものは課徴金の対象外だが、優良誤認や有利誤認を含むと対象になりうる（Q2）（第 4 章・第 6 章）"
  },
  {
    "id": "blank-earlyvangelists-2010",
    "title": "Perfection By Subtraction – The Minimum Feature Set",
    "url": "https://steveblank.com/2010/03/04/perfection-by-subtraction-the-minimum-feature-set/",
    "publisher": "Steve Blank",
    "year": "2010（3 月 4 日）",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "最初に買ってくれて、周りにも勧める顧客（アーリーエバンジェリスト）の目印を 5 つ挙げる: 課題がある・課題を自覚している・期限を決めて解決策を探している・間に合わせの解決策を自分で組むほど困っている・買うお金がある（すぐ用意できる）。最初の版の機能は、こうした顧客とのやりとりで決めるとする。アーリーエバンジェリストは、早く使う人（アーリーアダプター）と、社内で推してくれる人を合わせた言葉で、予算を持つ買い手を想定している"
  },
  {
    "id": "unusual-mom-test-2024",
    "title": "Is your startup idea good? 5 takeaways from Rob Fitzpatrick's Mom Test",
    "url": "https://www.unusual.vc/rob-fitzpatricks-mom-test/",
    "publisher": "Unusual Ventures",
    "year": "2024（10 月 31 日）",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "書籍『The Mom Test』の要約（二次資料。著者本人の文章ではない）。3 つのきまり（相手の暮らしの話を聞く・過去の具体的なことを聞く・話すより聞く）、褒め言葉はかわして事実と約束を集めること、約束の種類（時間・評判・お金）を確かめた。本の公式ページは概要だけなので、指針の突き合わせに使った"
  },
  {
    "id": "rhodes-2013-intention-gap",
    "title": "How big is the physical activity intention-behaviour gap? A meta-analysis using the action control framework",
    "url": "https://pubmed.ncbi.nlm.nih.gov/23480428/",
    "publisher": "Ryan E. Rhodes, Gert-Jan de Bruijn（British Journal of Health Psychology 18(2), 296–309）",
    "year": "2013",
    "kind": "research",
    "checked": "2026-10-31",
    "note": "身体活動（運動）の、するつもりと実際の行動のずれのメタ分析。10 件・3,899 人。公衆衛生の指針が勧める量の運動について、するつもりの人のうち、そのとおりに実行しなかった人の割合（ずれ）は 46%（要旨の結果の欄。要点の欄では 48%）。結果の欄の内訳は、つもりがあって実行しなかった人 36%・実行した人 42%（全体に対する割合）で、ずれは主につもりがあったのに実行しなかった人から生じる。PubMed の要旨で確認（2026-10-31 に再確認）。運動の研究で、製品の利用や購入の割合を示すものではない"
  },
  {
    "id": "dunford-quickstart-2021",
    "title": "A Quickstart Guide to Positioning",
    "url": "https://www.aprildunford.com/post/a-quickstart-guide-to-positioning",
    "publisher": "April Dunford",
    "year": "2021（3 月 15 日）",
    "kind": "practice",
    "checked": "2026-10-31",
    "note": "著者本人の解説。ポジショニングを、はっきり決めた顧客が強く気にかけることについて、自分の製品が一番うまく応えられる立ち位置として説明し、5 つの要素（代わりの手段・差別化された特徴・顧客にとっての価値・その価値を強く求める顧客層・市場のカテゴリー）に分けて、代わりの手段から順に決めるよう勧める。以前は機能など適当に選んだ要素から候補を作っていて時間がかかりすぎたこと、代わりの手段から始めないと、社内では良く聞こえても違いがなく顧客に響かない立ち位置になったことを書く。ポジショニングはメッセージやキャッチコピーとは別であることも書いている。例は企業向けのソフトウェアが中心（2026-10-31 に再確認）"
  },
  {
    "id": "graham-startup-ideas-2012",
    "title": "How to Get Startup Ideas",
    "url": "https://paulgraham.com/startupideas.html",
    "publisher": "Paul Graham",
    "year": "2012（11 月）",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "多くの人が少し欲しいものより、少ない人がとても欲しいものを選ぶよう勧める（狭く深い井戸の例え）。不完全な最初の版でも使うほど欲しい人は誰か、と問う。狭く深いことはほぼ必要だが、それだけでは足りず、もっと大きな市場へ広がる道が要る（フェイスブックはハーバードの学生だけに向けて始め、似たほかの大学へ広げられた）。ただし広がる道は前もって見えにくい、とも書く"
  },
  {
    "id": "caa-hikaku-kokoku",
    "title": "比較広告（比較広告に関する景品表示法上の考え方）",
    "url": "https://www.caa.go.jp/policies/policy/representation/fair_labeling/representation_regulation/comparative_advertising/",
    "publisher": "消費者庁",
    "year": "昭和 62 年（1987 年）4 月 21 日・平成 28 年（2016 年）4 月 1 日改正",
    "kind": "official",
    "checked": "2026-10-31",
    "note": "競争相手の商品と比べる広告そのものは禁止していない。不当表示にならないためには、主張を客観的に裏付けられる・引く数字や事実が正しく、都合よく切り取っていない・比べ方が公正、の 3 つをすべて満たすこと。重要でない点だけを強調する比較は不当表示のおそれがある（ページとガイドライン）。ただ相手をけなすだけの比較も問題になりうる（ガイドラインの「はじめに」。ページには無い）。日付はガイドラインの PDF の表紙で確認（2026-10-31 に再確認）"
  },
  {
    "id": "caa-keihyo-yuri",
    "title": "有利誤認とは",
    "url": "https://www.caa.go.jp/policies/policy/representation/fair_labeling/representation_regulation/advantageous_misidentification",
    "publisher": "消費者庁",
    "year": "—",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "価格その他の取引条件を、実際より、または競争事業者より著しく有利だと誤認させる表示（景品表示法第 5 条第 2 号）。わざとでなくても対象で、措置命令などの対象になる。例として、基本の価格を示さずに「今なら半額」と表示したが、実際は半額に当たらない料金だった事例などを挙げる（ページで確認。二重価格の考え方は本文には無く、関連ページの名前だけ）"
  },
  {
    "id": "caa-no1-2024",
    "title": "No.1 表示に関する実態調査報告書（概要）",
    "url": "https://www.caa.go.jp/policies/policy/representation/fair_labeling/survey/assets/representation_cms216_240926_03.pdf",
    "publisher": "消費者庁",
    "year": "2024（9 月 26 日公表）",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "「顧客満足度 No.1」などは、合理的な根拠がなく事実と違えば、不当表示として景品表示法上の問題になる。根拠と認められるには、比べる商品の選び方（主要な競合を含める）・調査の対象者（実際の利用者か。サイトを見せただけのイメージ調査は、注記しても「顧客満足度 No.1」と対応しない）・公平な方法（自社を選択肢の最上位に固定しない、No.1 になった時点で調査をやめない）・表示と調査結果の対応、の 4 点が要る。調査方法の概要を表示物に書くなど、消費者が根拠を確かめられるようにすることが望ましいとする。調査は広告 368 件・消費者 1,000 人のウェブアンケート・広告主 15 社などへの聞き取り（公表文と概要の PDF を読んで確認）"
  },
  {
    "id": "caa-uchikeshi-2018",
    "title": "打消し表示に関する表示方法及び表示内容に関する留意点（実態調査報告書のまとめ）",
    "url": "https://www.caa.go.jp/policies/policy/representation/fair_labeling/pdf/fair_labeling_180607_0004.pdf",
    "publisher": "消費者庁",
    "year": "2018（6 月 7 日公表）",
    "kind": "official",
    "checked": "2026-10-31",
    "note": "体験談を見た人は「大体の人に効果がある」と受け取りやすく、「個人の感想です」などの打消し表示に気づいても、その受け取り方はほとんど変わらないと考えられる、とする。体験談を使うなら、事業者の調査の人数と属性、同じ効果があった人の割合、なかった人の割合などを明瞭に表示すべきとする。「著しく」は、誇張の程度が世の中で認められる範囲を超え、商品を選ぶことに影響する場合を指す（PDF の第 1・第 4 の該当ページで確認。2026-10-31 に再確認）"
  },
  {
    "id": "liu-white-dumais-2010",
    "title": "Understanding web browsing behaviors through Weibull analysis of dwell time",
    "url": "https://www.microsoft.com/en-us/research/publication/understanding-web-browsing-behaviors-through-weibull-analysis-of-dwell-time/",
    "publisher": "Chao Liu, Ryen W. White, Susan Dumais（SIGIR 2010, ACM）",
    "year": "2010",
    "kind": "research",
    "checked": "2026-10-30",
    "note": "Web ページの滞在時間をワイブル分布で分析し、閲覧の多くに「負の加齢」（最初ほど離れやすく、残るほど離れにくい）があることを示した。最初にざっと見てから読むかを決める行動と解釈する（Microsoft Research の論文ページの要旨で確認。データの規模はニールセンの記事で確認）"
  },
  {
    "id": "nielsen-2011-dwell",
    "title": "How Long Do Users Stay on Web Pages?",
    "url": "https://www.nngroup.com/articles/how-long-do-users-stay-on-web-pages/",
    "publisher": "Jakob Nielsen（Nielsen Norman Group）",
    "year": "2011（9 月 11 日）",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "Liu らの研究（ブラウザーの拡張機能の記録。1 万回以上見られた 205,873 ページ、20 億回以上の滞在）を紹介し、人は 10〜20 秒でページを離れることが多く、30 秒ほどを越えると長く読みやすい、とまとめる。価値を 10 秒以内に伝えるよう勧める（実務家の解釈）"
  },
  {
    "id": "apple-product-page",
    "title": "Creating your product page",
    "url": "https://developer.apple.com/app-store/product-page/",
    "publisher": "Apple",
    "year": "—",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "アプリ名とサブタイトルは各 30 文字まで。サブタイトルは「世界一のアプリ」のような一般的な言い方を避け、価値を名前より詳しく書く。説明文は最初の一文がいちばん大事（続きを開かずに読めるのはそこ）。説明文に具体的な価格は書かない。プロモーションテキストは 170 文字までで、新しい版を出さずに変えられる（ページに日付の記載はない）"
  },
  {
    "id": "google-play-listing",
    "title": "Create and set up your app（ストアの掲載情報）",
    "url": "https://support.google.com/googleplay/android-developer/answer/9859152",
    "publisher": "Google Play Console ヘルプ",
    "year": "—",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "アプリ名 30 文字、簡単な説明 80 文字、詳しい説明 4,000 文字まで（全角・半角とも同じ数え方）。簡単な説明は、詳細ページで最初に目に入る文で、開くと詳しい説明が読める"
  },
  {
    "id": "google-play-metadata",
    "title": "Metadata（メタデータのポリシー）",
    "url": "https://support.google.com/googleplay/android-developer/answer/9898842",
    "publisher": "Google Play Console ヘルプ",
    "year": "—",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "アプリ名・アイコン・デベロッパー名に、ストアでの順位や成績（「#1」など）、価格や販促（「10% オフ」など）を示す文字や画像を入れない。説明文の利用者の声は誰の声かを示す（匿名・出どころのない声は不可）。アプリやブランドを比べるデータも違反の例に挙がる"
  },
  {
    "id": "stripe-jp-pricing",
    "title": "料金体系（日本）",
    "url": "https://stripe.com/jp/pricing",
    "publisher": "Stripe",
    "year": "2026（10 月 30 日に確認）",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "カード決済は決済成功ごとに 3.6%（通貨換算が要る場合は +2%）。定期の請求（Stripe Billing）は Billing の取引額の 0.7%（単発の請求書は対象外）。標準の料金体系に初期費用・月額料金はない。返金しても元の決済手数料は戻らない。コンビニ決済は 3.6%（最低 120 円）など、支払い方法ごとに率が違う（料金ページと Billing の料金ページで確認。ページに更新日の記載はない）"
  },
  {
    "id": "apple-newsroom-japan-2025",
    "title": "Apple announces changes to iOS in Japan",
    "url": "https://www.apple.com/newsroom/2025/12/apple-announces-changes-to-ios-in-japan/",
    "publisher": "Apple Newsroom",
    "year": "2025（12 月 17 日）",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "スマホソフトウェア競争促進法（MSCA）に合わせ、iOS 26.2 から日本での変更を始めると発表。App Store の手数料は、小規模事業者プログラムの参加者や 2 年目以降の定期購読など大半の開発者が 10%、それ以外は 21%。Apple の決済を使うと別に 5%。アプリから Web の購入へ案内した場合は 15%（同じ条件で 10%）。App Store の外で配信するアプリの売上には 5%（Core Technology Commission）"
  },
  {
    "id": "apple-small-business",
    "title": "App Store Small Business Program",
    "url": "https://developer.apple.com/app-store/small-business-program/",
    "publisher": "Apple",
    "year": "—",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "前の暦年と今の年の収益（手数料などを引いた額）が、関連するアカウントと合わせて 100 万ドル以下の開発者が対象。自分で申し込み、承認が要る。年の途中で超えると、以後の売上は通常の率になる。このページの率は世界共通の 15% で、日本の率は日本向けのページ（apple-japan-2025）で確かめる"
  },
  {
    "id": "jftc-msca",
    "title": "スマホソフトウェア競争促進法",
    "url": "https://www.jftc.go.jp/msca/",
    "publisher": "公正取引委員会",
    "year": "令和 6 年法律第 58 号（2025 年 12 月 18 日全面施行）",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "正式名称は「スマートフォンにおいて利用される特定ソフトウェアに係る競争の促進に関する法律」。2024 年 6 月 19 日公布、2025 年 12 月 18 日全面施行（指定の手続きの部分は 2024 年 12 月 19 日に先に施行）。指定事業者は Apple Inc.・iTunes 株式会社・Google LLC（2025 年 3 月 26 日指定）"
  },
  {
    "id": "penn-hu-2018-hb",
    "title": "Understanding hypothetical bias: An enhanced meta-analysis",
    "url": "https://repository.lsu.edu/ag_econ_pubs/150",
    "publisher": "Jerrod M. Penn, Wuyang Hu（American Journal of Agricultural Economics）",
    "year": "2018",
    "kind": "research",
    "checked": "2026-10-31",
    "note": "仮の質問で聞いた評価（表明選好）に生じる仮想バイアスについて、500 本以上の文献から 131 の研究を集めたメタ分析。仮想バイアスがよく見られる分野として、環境・マーケティング・交通・医療などを挙げる。選択実験・事前の注意喚起（cheap talk）・結果に影響すると伝えること・確信度の確認が、バイアスの大きさを説明し小さくする要因だった。要旨で確認（バイアスの大きさの数字と本文は未確認）。DOI 10.1093/ajae/aay021"
  },
  {
    "id": "soumu-tokutei-email-points",
    "title": "特定電子メールの送信の適正化等に関する法律のポイント（広告宣伝メールに係るオプトイン方式の規制などについて）",
    "url": "https://www.soumu.go.jp/main_sosiki/joho_tsusin/d_syohi/pdf/m_mail_pamphlet.pdf",
    "publisher": "総務省・消費者庁・一般財団法人 日本データ通信協会",
    "year": "2018（7 月）",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "広告宣伝メール（SMS を含む）は、原則としてあらかじめ同意した人にだけ送れる（オプトイン方式）。同意なしに送れる例外は、取引関係にある人・名刺などの書面でアドレスを知らせた人・アドレスをネットで公表している人（営業を営む個人に限る。送らないよう求める旨も公表していれば不可）など。通信販売の電子メール広告は特定商取引法が別に適用される。同意の記録は最後に送った日から 1 か月保存（措置命令を受けたら 1 年）。表示は送信者の氏名・名称、受信拒否ができる旨と連絡先、住所、苦情・問い合わせ先（リンク先での表示も可）。受信拒否を受けたら以後は送れない。非営利団体や営業を営まない個人のメールは対象外。PDF 全 8 ページを読んで確かめた"
  },
  {
    "id": "soumu-tokutei-email-guideline",
    "title": "特定電子メールの送信等に関するガイドライン",
    "url": "https://www.soumu.go.jp/main_sosiki/joho_tsusin/d_syohi/pdf/m_mail_081114_1.pdf",
    "publisher": "総務省 総合通信基盤局 消費者行政課・消費者庁 取引対策課",
    "year": "2011（平成 23 年 8 月）",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "同意は、広告・宣伝のメールが送られることを受信者が認識したうえで賛成の意思を示すこと。約款の中に極めて小さい文字で書く、長い規約の奥に置くなど、ふつう気づかない書き方では認識できる表示とは言えない。チェックを予め入れない「デフォルトオフ」を推奨し、デフォルトオンなら外し方を分かりやすく表示する。料金請求のお知らせなど、広告・宣伝の内容を含まず宣伝のサイトへ誘導もしない取引上の連絡は特定電子メールに当たらない（第 1〜2 章、PDF の 1〜10 ページで確かめた）"
  },
  {
    "id": "egov-tokutei-email-law",
    "title": "特定電子メールの送信の適正化等に関する法律（平成十四年法律第二十六号）",
    "url": "https://laws.e-gov.go.jp/law/414AC0100000026",
    "publisher": "e-Gov 法令検索（デジタル庁）",
    "year": "2025 年 6 月 1 日施行の改正まで反映",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "第 3 条（同意した人などにだけ送れる・同意の記録の保存・受信拒否の通知を受けたら送らない）、第 4 条（送信者の氏名・名称と受信拒否の連絡先などの表示）と、施行規則第 4 条（記録の保存期間）・第 9 条（受信拒否ができる旨・住所・苦情や問い合わせの連絡先）を、e-Gov の法令 API で取った本文で確かめた"
  },
  {
    "id": "caa-tokushoho-email",
    "title": "通信販売（特定商取引法ガイド）",
    "url": "https://www.no-trouble.caa.go.jp/what/mailorder/",
    "publisher": "消費者庁",
    "year": "—",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "通信販売の電子メール広告は、前もって消費者の承諾を得ていなければ送れない（オプトイン規制、法第 12 条の 3・第 12 条の 4）。注文確認や発送通知に付随する広告、求めや同意にもとづくメルマガに付随する広告、無料メールサービスに付随する広告は対象外の例。承諾や請求の記録は、最後に送った日から 3 年保存"
  },
  {
    "id": "apple-app-store-search",
    "title": "App Store search",
    "url": "https://developer.apple.com/app-store/search/",
    "publisher": "Apple",
    "year": "—",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "App Store の検索結果は、テキストの関連性（アプリ名・サブタイトル・キーワード・主カテゴリー）と、利用者の行動（ダウンロード・評価とレビューなど）などで決まる。キーワードは合計 100 文字まで。競合のアプリ名や関係のない語は入れない（ページに日付の記載はない）"
  },
  {
    "id": "amplitude-usage-interval",
    "title": "How often should people use your app?（product usage interval）",
    "url": "https://amplitude.com/blog/product-usage-interval",
    "publisher": "Archana Madhavan（Amplitude）",
    "year": "2016（10 月 11 日）",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "利用者が自然に戻ってくる頻度（日・週・月）を「usage interval」と呼び、継続の分析と施策をその間隔に合わせるよう勧める。価値のある 1 つの行動（critical event）で「使っている」を決める。週 1 回ほど使う出前のサービスを日ごとの継続で見ると低く見える例。多くの製品の間隔は長くても月 1 回ほどとする。分析ツールの会社のブログで、記事の数字は仮のもの"
  },
  {
    "id": "miller-ab-peeking",
    "title": "How Not To Run an A/B Test",
    "url": "https://www.evanmiller.org/how-not-to-run-an-ab-test.html",
    "publisher": "Evan Miller",
    "year": "2010（2013 年に追記）",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "結果を途中で何度も見て、良さそうに見えた時点で止めると、効果の無い変更を「効いた」とする誤りが増える。元の申込率 50%・最大 150 回の観測で、観測のたびに見て止めた例では、5% のはずが 26.1%（本人も最悪に近い例とする）。人数を先に決めて、その人数まで待つ（途中で見る時点を前もって決める方法もある）。統計に詳しい個人のブログで、査読はない"
  },
  {
    "id": "nosek-2018-preregistration",
    "title": "The preregistration revolution",
    "url": "https://doi.org/10.1073/pnas.1708274114",
    "publisher": "Nosek, Ebersole, DeHaven, Mellor（PNAS 115 巻 11 号）",
    "year": "2018",
    "kind": "research",
    "checked": "2026-10-30",
    "note": "結果を見る前に、問いと分析の計画を決めておく（事前登録）と、データを見てから作った説明と、前もって立てた予測を区別できる。後知恵の偏りがあるので、人はこの区別を守りにくい。PNAS のページはこの環境から開けず（403）、PubMed の抄録（PMID 29531091）で確認"
  }
]);
export const SOURCES = SOURCE_TABLE.sources;
export const docsOf = SOURCE_TABLE.docs;
export const MARKETING_SOURCES = SOURCES;
