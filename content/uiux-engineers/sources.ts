// 講座の出典と公式リンクの表。章は ID から引き、訳は説明の上書きだけを持つ。
import { defineSources } from '../sources-util';

export const SOURCE_TABLE = defineSources([
  {
    "id": "iso-9241-210-2019",
    "title": "ISO 9241-210:2019 Ergonomics of human-system interaction — Part 210: Human-centred design for interactive systems",
    "url": "https://www.iso.org/standard/77520.html",
    "publisher": "ISO",
    "year": "2019",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "3.15 user experience の定義（システム・製品・サービスの利用や利用の予想から生じる利用者の知覚と反応。使う前・間・後に生じる）と、5 章の人間中心設計の 6 つの原則（利用者・タスク・環境の理解、利用者を交えた評価、繰り返し など）"
  },
  {
    "id": "iso-9241-11-2018",
    "title": "ISO 9241-11:2018 Ergonomics of human-system interaction — Part 11: Usability: Definitions and concepts",
    "url": "https://www.iso.org/standard/63500.html",
    "publisher": "ISO",
    "year": "2018",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "3.1.1 usability の定義（特定の利用者が特定の利用状況で、効果・効率・満足を伴って特定の目標を達成できる度合い）。3.1.10 目標（意図した結果）・3.1.11 タスク（目標は手段によらない）・3.1.15 利用状況も、各国の規格機関の公式プレビューで確認。日本の JIS Z 8521:2020 はこれを基にした規格（修正あり）で、訳語は「効果・効率・満足」"
  },
  {
    "id": "nng-10-heuristics",
    "title": "10 Usability Heuristics for User Interface Design",
    "url": "https://www.nngroup.com/articles/ten-usability-heuristics/",
    "publisher": "Jakob Nielsen（Nielsen Norman Group）",
    "year": "1994（2020 年改訂・2024 年見直し）",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "10 のユーザビリティ・ヒューリスティクス（システムの状態を見せる・現実の世界に合わせる・記憶より見て分かる・エラーを防ぐ など）。具体的なガイドラインではなく大まかな経験則と明記"
  },
  {
    "id": "nng-ux-definition",
    "title": "The Definition of User Experience (UX)",
    "url": "https://www.nngroup.com/articles/definition-user-experience/",
    "publisher": "Don Norman, Jakob Nielsen（Nielsen Norman Group）",
    "year": "1998",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "UX は会社・サービス・製品と利用者のやりとりのすべてで、UI は大事な一部だが UI が良くても良い UX になるとは限らない、という説明"
  },
  {
    "id": "nng-thinking-aloud",
    "title": "Thinking Aloud: The #1 Usability Tool",
    "url": "https://www.nngroup.com/articles/thinking-aloud-the-1-usability-tool/",
    "publisher": "Jakob Nielsen（Nielsen Norman Group）",
    "year": "2012",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "利用者に考えを声に出してもらいながら使ってもらう思考発話法の説明。Nielsen はユーザビリティの一番の道具と位置づけ、万能ではない・統計的な比較には向かないとも書く"
  },
  {
    "id": "nng-5-users",
    "title": "Why You Only Need to Test with 5 Users",
    "url": "https://www.nngroup.com/articles/why-you-only-need-to-test-with-5-users/",
    "publisher": "Jakob Nielsen（Nielsen Norman Group）",
    "year": "2000",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "1 人が見つける問題の割合を約 31% と置くモデルでは 5 人で約 85%。利用者層が同じ・問題を見つける定性テスト・繰り返すことが前提"
  },
  {
    "id": "nng-gestalt-proximity",
    "title": "Proximity Principle in Visual Design",
    "url": "https://www.nngroup.com/articles/gestalt-proximity/",
    "publisher": "Aurora Harley（Nielsen Norman Group）",
    "year": "2020",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "近くにあるものは一つのまとまりに見える（ゲシュタルトの近接の原則）と、画面への当てはめ方。記事は整列とグリッドを扱っておらず、それは別の記事（nng-grids）の話として、この講座では分けて扱う"
  },
  {
    "id": "nng-error-messages",
    "title": "Error-Message Guidelines",
    "url": "https://www.nngroup.com/articles/error-message-guidelines/",
    "publisher": "Tim Neusesser, Evan Sunwall（Nielsen Norman Group）",
    "year": "2023",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "エラーは原因のそばに出し（色だけに頼らない）、具体的に・責めずに伝え、直し方や候補を示し、入力を残す"
  },
  {
    "id": "govuk-error-message",
    "title": "Error message（GOV.UK Design System）",
    "url": "https://design-system.service.gov.uk/components/error-message/",
    "publisher": "GOV.UK（英国政府）",
    "year": "—",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "エラーは入力欄の近くに出し、何が起きて・どう直すかを具体的に、前向きな言い方で書く。入力を消さない。上のまとめ（Error summary）と同じ文言にする、という政府のサービスの指針"
  },
  {
    "id": "wcag-22",
    "title": "Web Content Accessibility Guidelines (WCAG) 2.2",
    "url": "https://www.w3.org/TR/WCAG22/",
    "publisher": "W3C",
    "year": "2023（2024-12-12 更新）",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "コントラスト比（本文 4.5:1）・色だけに頼らない・ターゲットのサイズ・エラーの特定・ラベルなどの達成基準"
  },
  {
    "id": "jis-x-8341-3",
    "title": "JIS X 8341-3:2016 解説",
    "url": "https://waic.jp/docs/jis2016/understanding/201604/",
    "publisher": "情報通信アクセス協議会 ウェブアクセシビリティ基盤委員会（WAIC）",
    "year": "2016",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "JIS X 8341-3:2016 は ISO/IEC 40500:2012（WCAG 2.0）と一致する規格（WAIC の解説で確認）。WCAG 2.2 が ISO/IEC 40500:2025 になったのを受けて改正の見込みで、順調なら 2027 年、遅くとも 2028 年（WAIC のお知らせ waic-jis-news-2026）"
  },
  {
    "id": "cao-sabetsu-kaisho",
    "title": "障害を理由とする差別の解消の推進",
    "url": "https://www8.cao.go.jp/shougai/suishin/sabekai.html",
    "publisher": "内閣府",
    "year": "2024 年 4 月 1 日施行の改正",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "改正法（2024-04-01 施行）で、事業者による合理的配慮の提供が「努めなければならない」から「しなければならない」に（第 8 条 2 項）。ウェブの改善などの環境の整備は努力義務のまま（第 5 条）。ページからリンクされた法律本文と新旧対照条文で確認"
  },
  {
    "id": "digital-a11y-guidebook",
    "title": "ウェブアクセシビリティ導入ガイドブック",
    "url": "https://www.digital.go.jp/resources/introduction-to-web-accessibility-guidebook",
    "publisher": "デジタル庁",
    "year": "2025-10-16 更新",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "ウェブアクセシビリティの考え方と導入の進め方の入門（2025-10-16 版の PDF で確認）。事業者の合理的配慮は義務、ウェブアクセシビリティは環境の整備として努力義務。チェックツールで確かめられるのは達成基準の 2〜3 割程度で、目視・キーボード・スクリーンリーダーでも確かめる。記号は読み上げられないことがある。入力形式の制限は入力の前に説明する"
  },
  {
    "id": "faulkner-2003",
    "title": "Beyond the five-user assumption: Benefits of increased sample sizes in usability testing",
    "url": "https://doi.org/10.3758/BF03195514",
    "publisher": "Laura Faulkner（Behavior Research Methods, Instruments, & Computers 35）",
    "year": "2003",
    "kind": "research",
    "checked": "2026-10-30",
    "note": "60 人のデータから 5 人組を選ぶと、見つかる問題の割合は 55〜99% とばらついた。最も少ない組でも 10 人なら 80%、20 人なら 95%。5 人で必ず 85% とは言えない根拠。Springer はログインに飛ばされ、PubMed の抄録（PMID 14587545）で確認"
  },
  {
    "id": "nng-placeholders",
    "title": "Placeholders in Form Fields Are Harmful",
    "url": "https://www.nngroup.com/articles/form-design-placeholders/",
    "publisher": "Katie Sherwin（Nielsen Norman Group）",
    "year": "2014",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "入力欄の中の薄い文字（プレースホルダー）をラベル代わりにすると、入力で消えて記憶の負担になる・見直せない・コントラストが低い・読み上げない支援技術がある。ラベルは欄の外に常に見えるように置く"
  },
  {
    "id": "hornbaek-law-2007",
    "title": "Meta-Analysis of Correlations Among Usability Measures",
    "url": "https://www.kasperhornbaek.dk/papers/CHI2007_MetaAnalysis.pdf",
    "publisher": "Kasper Hornbæk, Effie Lai-Chong Law（CHI 2007）",
    "year": "2007",
    "kind": "research",
    "checked": "2026-10-30",
    "note": "73 の研究の分析で、有効さ・効率・満足の数字どうしの相関は全体に低い。3 つは別々に測るべきという主張を支える（著者の公開原稿）"
  },
  {
    "id": "w3c-understanding-redundant-entry",
    "title": "Understanding Success Criterion 3.3.7: Redundant Entry",
    "url": "https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html",
    "publisher": "W3C Web Accessibility Initiative（WAI）",
    "year": "WCAG 2.2 の解説",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "3.3.7（レベル A。WCAG 2.2 で追加。W3C の「What’s New in WCAG 2.2」でも確認）。同じ手続きの中で前に入れた情報をもう一度求めるなら、自動で入れるか選べるようにする。ブラウザの自動入力だけでは足りない。例外は、再入力が欠かせない場合・安全のため（パスワードの確認など）・前の情報が使えなくなった場合。手続きを閉じてから戻ってきた場合には当たらない（第 3 章・第 6 章）"
  },
  {
    "id": "waic-wcag22-ja",
    "title": "Web Content Accessibility Guidelines (WCAG) 2.2（日本語訳）",
    "url": "https://waic.jp/translations/WCAG22/",
    "publisher": "情報通信アクセス協議会 ウェブアクセシビリティ基盤委員会（WAIC）",
    "year": "2024-12-12 版の訳（作業中。達成基準の名前の訳は 2026-06-08 に見直し）",
    "kind": "official",
    "checked": "2026-10-31",
    "note": "WCAG 2.2 の参考訳（翻訳は作業中で、正式版は W3C の英語版）。原則の訳（知覚可能・操作可能・理解可能・堅牢）と、達成基準の名前（1.1.1 非テキストコンテンツ、1.3.3 感覚による特性、1.3.5 入力目的の特定、1.4.1 色の用途、1.4.3 コントラスト (最低限)、1.4.6 コントラスト (高度)、1.4.11 非テキストのコントラスト、2.1.1 キーボード、2.4.7 フォーカスの可視化、2.4.11 隠されないフォーカス (最低限)、2.5.8 ターゲットのサイズ (最低限)、3.3.1 エラーの特定、3.3.2 ラベル又は指示、3.3.3 エラーの修正提案、3.3.7 冗長な入力項目 など）、用語（コントラスト比・相対輝度・サイズの大きな（テキスト））を確かめた。2.2 に適合するサイトは 2.0・2.1 にも適合することを意図し、新しい目標として 2.2 を採ることを勧める、という記述も（第 5 章・第 6 章・第 7 章）"
  },
  {
    "id": "nng-card-sorting",
    "title": "Card Sorting: Uncover Users' Mental Models for Better Information Architecture",
    "url": "https://www.nngroup.com/articles/card-sorting-definition/",
    "publisher": "Samhita Tankala, Katie Sherwin（Nielsen Norman Group）",
    "year": "2024",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "カード分類の定義（項目を書いたカードを、参加者が自分に自然なまとまりに分ける）、オープン・クローズド・ハイブリッドの違い（決めたまとまりを確かめるならツリーテストを勧める）、カードは 30〜50 枚、同じ言葉を複数のカードに入れない、人数の目安（理由を聞く定性で 15 人以上・一般化する定量で 30〜50 人以上）、カード分類は案を作る方法でツリーテストは確かめる方法、限界（カードを単独で見る・階層や道順は分からない・人によってまとめ方が違う）"
  },
  {
    "id": "nng-tree-testing",
    "title": "Tree Testing: Evaluate Menu Labels and Categories",
    "url": "https://www.nngroup.com/articles/tree-testing/",
    "publisher": "Page Laubheimer（Nielsen Norman Group）",
    "year": "2023（2026-08-19 見直し）",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "ツリーテストは、見た目と文章を外した階層（メニュー）の中で、指定した項目の場所を参加者に探してもらう方法。正しい場所に着いた割合・まっすぐ進めたか・時間を見る。理由を探る定性なら少人数でよく、数で比べるなら多めの人数。カード分類で作った案はツリーテストで確かめる"
  },
  {
    "id": "nng-ia-vs-navigation",
    "title": "The Difference Between Information Architecture (IA) and Navigation",
    "url": "https://www.nngroup.com/articles/ia-vs-navigation/",
    "publisher": "Jen Cardello（Nielsen Norman Group）",
    "year": "2014",
    "kind": "practice",
    "checked": "2026-10-31",
    "note": "情報設計は、中身の目録と、まとめ方・名前の付け方の構造で、画面には直接見えない（IA が UI を形づくる）。ナビゲーションはその上のメニュー・パンくず・絞り込み・関連リンクなどの部品で、氷山の一角（このたとえは、記事が引く Nathaniel Davis のもの）。ナビゲーションの形だけを先に決めるのは非効率で、あとで階層が足りなくなることがある"
  },
  {
    "id": "nng-menu-design",
    "title": "Menu-Design Checklist: 17 UX Guidelines",
    "url": "https://www.nngroup.com/articles/menu-design/",
    "publisher": "Page Laubheimer（Nielsen Norman Group）",
    "year": "2024",
    "kind": "practice",
    "checked": "2026-10-31",
    "note": "メニューの指針。今いる場所をメニューで示す、ラベルは明確で具体的でなじみのある言葉に（作った言葉・社内の言葉・抽象的すぎる大分類を避ける）、大事な言葉をラベルの先頭に、アイコンは文字を補うもので置き換えない、よく使う項目を近くに置く"
  },
  {
    "id": "nng-progressive-disclosure",
    "title": "Progressive Disclosure",
    "url": "https://www.nngroup.com/articles/progressive-disclosure/",
    "publisher": "Jakob Nielsen（Nielsen Norman Group）",
    "year": "2006",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "最初は大事な少数の選択肢だけを見せ、ほかは求められたときに出す（段階的な開示）。何を最初に出すかはタスク分析と使う頻度（利用の記録と観察）で決める。2 段を超える開示は、段の間で迷いやすく使いにくくなりがち"
  },
  {
    "id": "rosenfeld-ia-2015",
    "title": "Information Architecture: For the Web and Beyond（第 4 版）",
    "url": "https://www.oreilly.com/library/view/information-architecture-4th/9781491913529/",
    "publisher": "Louis Rosenfeld, Peter Morville, Jorge Arango（O'Reilly Media）",
    "year": "2015",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "情報設計の定番の本。分類（Organization Systems）・ラベル（Labeling Systems）・ナビゲーション（Navigation Systems）・検索（Search Systems）を章に分けて扱う。O'Reilly の公式ページは自動では開けなかった（403）ため、目次は電子書籍の販売ページ（helion.pl の同書のページ）で確かめた"
  },
  {
    "id": "nng-user-control-freedom",
    "title": "User Control and Freedom (Usability Heuristic #3)",
    "url": "https://www.nngroup.com/articles/user-control-and-freedom/",
    "publisher": "Maria Rosala（Nielsen Norman Group）",
    "year": "2020",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "間違えて進んだときの出口として、戻る・キャンセル・閉じる・取り消しを挙げる。ブラウザの戻るを壊さない、フォームの中の戻るや押せる進み具合の表示で入力を失わずに戻れるように、どの段でもキャンセルできるように、取り消しは見つけやすく押す時間を十分に（数秒で消える例）、やめるときに下書きを残すか捨てるかを選べるように"
  },
  {
    "id": "nng-confirmation-dialog",
    "title": "Confirmation Dialogs Can Prevent User Errors — If Not Overused",
    "url": "https://www.nngroup.com/articles/confirmation-dialog/",
    "publisher": "Jakob Nielsen（Nielsen Norman Group）",
    "year": "2018（2026-08-07 見直し）",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "確認のダイアログは、作業を失う・大きなお金が動く・取り消せない操作に絞る。警告が多すぎると人は注意を払わなくなり、読まずに「はい」を押す。結果を具体的に書き、ボタンは「はい／いいえ」でなく行うことの名前に。取り消し（undo）を用意できればなおよい"
  },
  {
    "id": "nng-wizards",
    "title": "Wizards: Definition and Design Recommendations",
    "url": "https://www.nngroup.com/articles/wizards/",
    "publisher": "Raluca Budiu（Nielsen Norman Group）",
    "year": "2017",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "ウィザード（決まった順に進む複数ページの入力）は、初めての人・まれな手続き・答えで分かれる手続きに向き、毎日くり返す作業・見比べが要る作業・慣れた人・途中で抜ける作業には向かない。全部のステップと今のステップを見せ、戻る・進むのボタンは行き先の名前に、途中でやめて保存し再開できるように"
  },
  {
    "id": "nng-user-flows",
    "title": "User Journeys vs. User Flows",
    "url": "https://www.nngroup.com/articles/user-journeys-vs-user-flows/",
    "publisher": "Kate Kaplan（Nielsen Norman Group）",
    "year": "2023（2026-08-27 見直し）",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "ユーザーフローは、1 つの製品の中で決まったタスクを終えるまでの、利用者の操作とシステムの応答の流れ（数分〜数時間）。ジャーニーは複数の接点にまたがる長い経験で、気持ちも描く。フローは流れ図・タスク図・ワイヤーフローで描く"
  },
  {
    "id": "nng-visibility-system-status",
    "title": "Visibility of System Status (Usability Heuristic #1)",
    "url": "https://www.nngroup.com/articles/visibility-system-status/",
    "publisher": "Aurora Harley（Nielsen Norman Group）",
    "year": "2018",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "状態が分からないと、利用者は次の手を決められない。操作にはすぐ見える応答を返し、時間のかかる処理は進み具合を見せ、結果とエラーをはっきり伝える。やりとりが予想どおりに進むことが信頼につながる"
  },
  {
    "id": "w3c-understanding-error-prevention",
    "title": "Understanding Success Criterion 3.3.4: Error Prevention (Legal, Financial, Data)",
    "url": "https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html",
    "publisher": "W3C WAI",
    "year": "WCAG 2.2",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "3.3.4（レベル AA）。法的な約束・お金の取引・利用者が管理するデータの変更や削除・テストの回答を送るページは、取り消せる・入力を点検して直せる・確定の前に確かめて直せる、のどれかを満たす。例として、注文の前に品物・数・届け先・支払いを見せて直せるようにする。本文（WCAG 2.2、2024-12-12 版）でも確かめた"
  },
  {
    "id": "caa-tokusho-tsuhan",
    "title": "通信販売｜特定商取引法ガイド",
    "url": "https://www.no-trouble.caa.go.jp/what/mailorder/",
    "publisher": "消費者庁",
    "year": "—",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "インターネット通販の申込み（特定申込み、法第 12 条の 6）では、最終確認画面に、分量・販売価格（役務の対価）・代金の支払いの時期と方法・引渡しや提供の時期・申込期間（あれば）・申込みの撤回や解除に関すること を表示する。申込みになることを誤認させる表示や、表示事項を誤認させる表示は禁止で、誤認して申し込んだ人は取り消せる（法第 15 条の 4）。ページ自身が「概要」と書いている"
  },
  {
    "id": "kokusen-tokusho-2022",
    "title": "「おトクにお試しだけ」のつもりが「定期購入」に！？－「詐欺的な定期購入商法」の規制が強化された改正特定商取引法が施行されました！－",
    "url": "https://www.kokusen.go.jp/news/data/n-20220609_1.html",
    "publisher": "国民生活センター",
    "year": "2022",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "改正特定商取引法が 2022 年 6 月 1 日に施行され、通販サイトの最終確認画面（注文確定の直前の画面）に、申込内容を簡単に確かめられるよう、分量・価格・支払い・引渡しの時期・申込期間・撤回や解除のことを表示する義務ができた（2022-06-09 公表）"
  },
  {
    "id": "nng-visual-hierarchy",
    "title": "Visual Hierarchy in UX: Definition",
    "url": "https://www.nngroup.com/articles/visual-hierarchy-ux-definition/",
    "publisher": "Kelley Gordon（Nielsen Norman Group）",
    "year": "2021",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "視覚的な優先順位を、意図した大事さの順に目が要素を追うようにする配置と定義。道具は色とコントラスト（色相より明るさ・鮮やかさの差）・大きさ・まとまり（近接と余白、共通領域）。大きさは大中小の 3 つまで、大きな要素は 2 つまで、Web の例は本文 14〜16px・小見出し 18〜22px・見出しは 32px まで。全部に差を付けると何も目立たない、目を細めるかぼかして確かめる、入る中身でも崩れる、と書く。色はシンプルな画面なら主 2・補助 2 まで、赤のような色は警告やエラーに、色だけで優先順位を伝えない"
  },
  {
    "id": "nng-gestalt-similarity",
    "title": "Similarity Principle in Visual Design",
    "url": "https://www.nngroup.com/articles/gestalt-similarity/",
    "publisher": "Aurora Harley（Nielsen Norman Group）",
    "year": "2020",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "色・形・大きさ・文字の太さなどの見た目を共有するものは、関係があるように見える（ゲシュタルトの類似の原則）。同じ働きは同じ見た目に、違う働きは違う見た目に。すべてのボタンが同じ色の銀行のフォームで、利用者が主ボタンを探すのに時間を使った例"
  },
  {
    "id": "nng-common-region",
    "title": "The Principle of Common Region: Containers Create Groupings",
    "url": "https://www.nngroup.com/articles/common-region/",
    "publisher": "Aurora Harley（Nielsen Norman Group）",
    "year": "2020",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "同じ境界（枠・背景色）の中にあるものはひとまとまりに見え、近接より強く効くことがある（ゲシュタルトの共通領域の原則。Palmer 1992 で加わった）。枠の付けすぎは画面をうるさくし、余白（近接）だけで足りることも多い"
  },
  {
    "id": "nng-grids",
    "title": "Using Grids in Interface Designs",
    "url": "https://www.nngroup.com/articles/using-grids-in-interface-designs/",
    "publisher": "Kelley Gordon（Nielsen Norman Group）",
    "year": "2022",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "グリッドは列（column）・列の間（gutter）・外側の余白（margin）でできる。部品は列に置き、gutter と margin には置かない。読みやすさと見渡しやすさを上げ、画面の大きさが変わっても置き場所を保ちやすい。崩すのは正当な理由があるときだけ。ゲシュタルトの原則には触れていない"
  },
  {
    "id": "nng-f-pattern",
    "title": "F-Shaped Pattern of Reading on the Web: Misunderstood, But Still Relevant (Even on Mobile)",
    "url": "https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/",
    "publisher": "Kara Pernice（Nielsen Norman Group）",
    "year": "2017（2026 年見直し）",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "強い手がかりのない文章では、上の行と各行の左の数語が一番見られる（F 字型）。見出し・太字・まとまりがあると見方は変わる。大事なことは最初に置き、見出しは情報のある語で始める、と勧める"
  },
  {
    "id": "govuk-button",
    "title": "Button（GOV.UK Design System）",
    "url": "https://design-system.service.gov.uk/components/button/",
    "publisher": "GOV.UK（英国政府）",
    "year": "—",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "既定のボタン（主ボタン）はページの主な行動に使い、1 ページに複数置かない（効き目が下がり、次に何をすればよいか分かりにくくなる）。ほかの行動は副ボタン。行動を増やしたくなったら、ページを簡単にするか分ける。押せないボタンはコントラストが低く混乱を招くので、なるべく使わない"
  },
  {
    "id": "w3c-jlreq",
    "title": "Requirements for Japanese Text Layout 日本語組版処理の要件",
    "url": "https://www.w3.org/TR/jlreq/",
    "publisher": "W3C（Working Group Note）",
    "year": "2020",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "2.4.2 の 4: 基本版面の行間は、文字サイズの二分アキ以上・全角アキ以下が多い（CSS の line-height で 1.5〜2 倍）。行長が短ければ二分アキでもよく、35 字を超える行長では全角アキか、やや詰めた行間がよい。全角アキより広げても読みやすくはならない。本の組版の目安"
  },
  {
    "id": "mdn-font-size",
    "title": "font-size",
    "url": "https://developer.mozilla.org/en-US/docs/Web/CSS/font-size",
    "publisher": "MDN Web Docs（Mozilla）",
    "year": "—",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "ブラウザの既定の文字の大きさは、たいてい 16px。利用者の既定の大きさに対する値（em・rem など）を使うのがよく、px で決めると一部のブラウザで利用者が文字を大きくできない"
  },
  {
    "id": "w3c-understanding-contrast-minimum",
    "title": "Understanding Success Criterion 1.4.3: Contrast (Minimum)",
    "url": "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html",
    "publisher": "W3C WAI",
    "year": "2026-09-06 更新",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "計算した比は丸めない（4.499:1 は 4.5:1 に届かない）。1pt = 1.333px として、14pt と 18pt はおよそ 18.5px と 24px。4.5:1 は 20/40 程度の視力の低下を補う値。細い書体はアンチエイリアスで薄くなり、基準を満たしても実際のコントラストが低いことがあるので、太くするか余裕のある色にする。押せない部品は対象外、プレースホルダーは対象。ロゴ以外のブランドの色は対象外にならない。計算に色相はほとんど効かない。測るツールの例（Colour Contrast Analyser など）"
  },
  {
    "id": "w3c-understanding-non-text-contrast",
    "title": "Understanding Success Criterion 1.4.11: Non-text Contrast",
    "url": "https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html",
    "publisher": "W3C WAI",
    "year": "2026-09-06 更新",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "部品と状態を見分けるのに要る見た目（フォーカス・選択・チェックの印など）と、内容の理解に要るアイコンやグラフの部分は、隣の色と 3:1 以上。入力欄の境目は、欄があると分かるほかの見た目の手がかりがないときに要る（その手がかりが 3:1 を満たす）。すべての部品の境目をはっきりさせるのが望ましい。押せない部品と、ブラウザの既定のままの見た目は対象外。比は丸めない"
  },
  {
    "id": "w3c-understanding-use-of-color",
    "title": "Understanding Success Criterion 1.4.1: Use of Color",
    "url": "https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html",
    "publisher": "W3C WAI",
    "year": "2025-09-16 更新",
    "kind": "official",
    "checked": "2026-10-31",
    "note": "色の違いだけで意味（必須・エラー・リンク・グラフの系列など）を伝えない。ページで色を使うことを妨げるものではない。色合いだけでなく明るさにも 3:1 以上の差があれば、別の見た目の手がかりとして数える（緑なら正しい・赤なら誤りのように、特定の色を見分けられることに頼るなら、比に関係なく別の手がかりが要る）という注記。失敗例 F81（必須やエラーの欄を色の違いだけで示す）・F73（色覚なしでは見分けられないリンク）、十分な手法 G183（周りの文字と 3:1 以上のリンク）・G205（色の付いたラベルに文字の手がかり）など。色覚の違いのある人・色の見え方が変わった高齢の人・白黒の画面の人などに効く"
  },
  {
    "id": "govuk-colour",
    "title": "Colour（GOV.UK Design System）",
    "url": "https://design-system.service.gov.uk/styles/colour/",
    "publisher": "GOV.UK（英国政府）",
    "year": "—",
    "kind": "official",
    "checked": "2026-10-31",
    "note": "色を役割の名前（文字・副の文字・リンク・枠・入力欄の枠・フォーカス・エラー・成功など）で決め、決めた場面だけで使う。利用者にとって予測できて一貫するように。色の値を写さず、役割の名前で使う。サービスの文字と操作部品のコントラストは WCAG 2.2 の 1.4.3（AA）を満たすようにする、と求める"
  },
  {
    "id": "chrome-devtools-contrast",
    "title": "Make your website more readable（Chrome DevTools）",
    "url": "https://developer.chrome.com/docs/devtools/accessibility/contrast",
    "publisher": "Google（Chrome for Developers）",
    "year": "2022",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "要素を調べるときの表示と、文字の色のカラーピッカーの「Contrast ratio」で、コントラスト比と AA・AAA に足りるかが出る。CSS Overview・Lighthouse で、コントラストの低い文字を一覧にできる（2022-10-19 更新。画面は変わることがある）"
  },
  {
    "id": "nichigan-color-vision-2013",
    "title": "色覚検査について（文部科学省への要望書の別添）",
    "url": "https://www.gankaikai.or.jp/info/20131024_colorvision.pdf",
    "publisher": "日本眼科学会・日本眼科医会",
    "year": "2013",
    "kind": "official",
    "checked": "2026-10-31",
    "note": "先天色覚異常は男子の約 5%（20 人に 1 人）、女子の約 0.2%（500 人に 1 人）。色の区別がまったくつかないわけではなく、組み合わせによって見分けにくい色がある、という説明（2013-10-24 の要望書の別添。日本眼科医会のサイトの PDF を開いて確かめた）"
  },
  {
    "id": "w3c-understanding-identify-input-purpose",
    "title": "Understanding Success Criterion 1.3.5: Identify Input Purpose",
    "url": "https://www.w3.org/WAI/WCAG22/Understanding/identify-input-purpose.html",
    "publisher": "W3C Web Accessibility Initiative（WAI）",
    "year": "WCAG 2.2 の解説",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "1.3.5（AA）は、利用者自身の情報を集める欄の目的を、決まった値（HTML の autocomplete など）でプログラムが判別できるようにする基準。ブラウザが実際に自動入力するかは、適合の判断と関係ない。自動入力のほか、支援技術が欄にアイコンを添えることなどに使われ、記憶・読み書き・手の動きに困難のある人に役立つ（解説は参考情報で、規定そのものではない）"
  },
  {
    "id": "w3c-understanding-error-identification",
    "title": "Understanding Success Criterion 3.3.1: Error Identification",
    "url": "https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html",
    "publisher": "W3C Web Accessibility Initiative（WAI）",
    "year": "WCAG 2.2 の解説",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "3.3.1（A）は、自動で見つけた入力のエラーについて、どの項目かを示し、エラーを文字で説明する基準。色は文字に加えて使う手がかりで、色だけでは足りない。直し方の提示までは求めず、それは 3.3.3 の範囲"
  },
  {
    "id": "w3c-understanding-labels-or-instructions",
    "title": "Understanding Success Criterion 3.3.2: Labels or Instructions",
    "url": "https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html",
    "publisher": "W3C Web Accessibility Initiative（WAI）",
    "year": "WCAG 2.2 の解説",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "3.3.2（A）は、入力を求める所にラベルか指示を付ける基準。必須の欄を示すことも、この基準の十分な手法に含まれる（G83・H90 など）。ラベルと欄をコードで結び付けることそのものは 1.3.1 の範囲"
  },
  {
    "id": "w3c-understanding-error-suggestion",
    "title": "Understanding Success Criterion 3.3.3: Error Suggestion",
    "url": "https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion.html",
    "publisher": "W3C Web Accessibility Initiative（WAI）",
    "year": "WCAG 2.2 の解説",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "3.3.3（AA）は、入力のエラーを自動で見つけ、直し方が分かっているなら、その案を示す基準。セキュリティや目的を損なう場合は除く"
  },
  {
    "id": "govuk-error-summary",
    "title": "Error summary（GOV.UK Design System）",
    "url": "https://design-system.service.gov.uk/components/error-summary/",
    "publisher": "GOV.UK（英国政府）",
    "year": "—",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "入力のエラーがあるときは、1 つでも、ページの上（見出しの前）に「There is a problem」の見出しと、エラーのある欄へのリンクを並べたまとめを出し、キーボードのフォーカスをまとめへ移す。まとめの文言は欄のそばのエラーと同じにし、欄のそばにも必ずエラーを出す"
  },
  {
    "id": "govuk-text-input",
    "title": "Text input（GOV.UK Design System）",
    "url": "https://design-system.service.gov.uk/components/text-input/",
    "publisher": "GOV.UK（英国政府）",
    "year": "—",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "ラベルは欄の上に置く。プレースホルダーをラベル・補足・例の代わりに使わない（入力で消える・読まない支援技術がある・既定の色はコントラストが足りないことが多い）。autocomplete 属性で欄の目的を伝える（本番では WCAG 2.2 の 1.3.5 のために必要）。空・長すぎる・短すぎるなど、状態ごとにエラーの文言を分ける型"
  },
  {
    "id": "govuk-telephone-numbers",
    "title": "Telephone numbers（GOV.UK Design System）",
    "url": "https://design-system.service.gov.uk/patterns/telephone-numbers/",
    "publisher": "GOV.UK（英国政府）",
    "year": "—",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "電話番号は利用者がなじんだ形で入力できるようにし、空白・ハイフン・かっこなどを受け付ける。入力マスクやプレースホルダーを使わない。autocomplete=\"tel\" を付ける。エラーの文には id を付けて入力欄の aria-describedby から指し、頭に画面には見えない「Error:」を入れる"
  },
  {
    "id": "govuk-question-pages",
    "title": "Question pages（GOV.UK Design System）",
    "url": "https://design-system.service.gov.uk/patterns/question-pages/",
    "publisher": "GOV.UK（英国政府）",
    "year": "—",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "本当に要る情報だけを聞き、なぜ要るかを説明できるようにする。任意の欄のラベルに「(optional)」を付け、必須の欄にアスタリスクを付けない。同じ手続きの中で同じ情報を二度聞かない"
  },
  {
    "id": "waic-wcag22-ja-update-2026",
    "title": "WCAG 2.2 日本語訳 更新のお知らせ",
    "url": "https://waic.jp/news/20260608/",
    "publisher": "ウェブアクセシビリティ基盤委員会（WAIC）",
    "year": "2026-06-08",
    "kind": "official",
    "checked": "2026-10-31",
    "note": "WAIC が WCAG 2.2 の日本語訳を見直し、達成基準とガイドラインの名前の訳を変えたというお知らせ。JIS X 8341-3 の改正を検討する中で、原文に合わせる形にした。例: 1.4.1 色の使用→色の用途、3.3.2 ラベル又は説明→ラベル又は指示、3.3.3 エラー修正の提案→エラーの修正提案。この訳がそのまま JIS になるわけではない、とも書く。JIS X 8341-3:2016 やデジタル庁のガイドブックの名前は、見直しの前と同じ（例: 3.3.2 ラベル又は説明）。デジタル庁のガイドブック（2025-10-16 版）で確かめた（第 6 章・第 7 章）"
  },
  {
    "id": "nng-required-fields",
    "title": "Marking Required Fields in Forms",
    "url": "https://www.nngroup.com/articles/required-fields/",
    "publisher": "Raluca Budiu（Nielsen Norman Group）",
    "year": "2019",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "必須の欄は、ほとんどが必須でもすべてに印を付ける（アスタリスクか「required」の文字。薄い印は避ける）。上に「すべて必須」と書くだけでは読み飛ばされ、忘れられる。任意の欄にも書くとさらに迷わない。ログインの 2 項目だけの画面は例外"
  },
  {
    "id": "w3c-understanding-non-text-content",
    "title": "Understanding Success Criterion 1.1.1: Non-text Content",
    "url": "https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html",
    "publisher": "W3C Web Accessibility Initiative（WAI）",
    "year": "WCAG 2.2 の解説",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "1.1.1（A）は、文字でない内容に、同じ役割のテキストの代替を付ける基準。ボタンやリンクになっている画像の代替は、その働きを書く。飾りの画像は、支援技術が読み飛ばせるよう空の alt にする（H67）（解説は参考情報で、規定そのものではない）"
  },
  {
    "id": "w3c-understanding-keyboard",
    "title": "Understanding Success Criterion 2.1.1: Keyboard",
    "url": "https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html",
    "publisher": "W3C Web Accessibility Initiative（WAI）",
    "year": "WCAG 2.2 の解説",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "2.1.1（A）は、すべての機能を、キーを押すタイミングを求めずにキーボードで操作できるようにする基準。動きの道筋そのものが要る機能（フリーハンドで線を描くなど）は例外。例外かどうかは機能で決まり、手書きで文字を入れるような入力の手段では決まらない（注記 1）。目の見えない人・手の震えがある人のほか、音声入力やスクリーンキーボードなど、キーボードの代わりになる道具を使う人にも役立つ"
  },
  {
    "id": "w3c-understanding-focus-visible",
    "title": "Understanding Success Criterion 2.4.7: Focus Visible",
    "url": "https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html",
    "publisher": "W3C Web Accessibility Initiative（WAI）",
    "year": "WCAG 2.2 の解説",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "2.4.7（AA）は、キーボードで操作できる画面に、フォーカスの位置が見える状態を用意する基準。outline などのスタイルでフォーカスの表示を消すのは失敗例 F78。:focus-visible で表示する手法 C45"
  },
  {
    "id": "w3c-understanding-focus-not-obscured-minimum",
    "title": "Understanding Success Criterion 2.4.11: Focus Not Obscured (Minimum)",
    "url": "https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html",
    "publisher": "W3C Web Accessibility Initiative（WAI）",
    "year": "WCAG 2.2 の解説",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "2.4.11（AA、2.2 で追加）は、フォーカスを受けた部品が、作り手の置いた物で全部隠れないようにする基準。原因の例は固定のヘッダーやフッター・クッキーの帯など。一部が隠れるだけなら満たすが、隠れる量は減らすべき（一部も隠さないのは 2.4.12、AAA）。CSS の scroll-padding の手法 C43、固定の帯で全部隠れる失敗例 F110"
  },
  {
    "id": "w3c-understanding-target-size-minimum",
    "title": "Understanding Success Criterion 2.5.8: Target Size (Minimum)",
    "url": "https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html",
    "publisher": "W3C Web Accessibility Initiative（WAI）",
    "year": "WCAG 2.2 の解説",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "2.5.8（AA、2.2 で追加）は、ポインタで押す所を 24×24 CSS ピクセル以上にする基準。例外は、間隔（ターゲットの中心に合わせて直径 24 CSS ピクセルの円を描き、ほかのターゲットや円と重ならない）・同等・インライン・ユーザエージェントによる制御・必要不可欠。24 は最低限で、大きいほど多くの人が使いやすい"
  },
  {
    "id": "w3c-wcag22-iso",
    "title": "WCAG 2.2 Approved as an ISO Standard",
    "url": "https://www.w3.org/WAI/news/2025-10-21/wcag22-iso",
    "publisher": "W3C Web Accessibility Initiative（WAI）",
    "year": "2025-10-21",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "WCAG 2.2 が国際規格 ISO/IEC 40500:2025 として承認されたというお知らせ。ISO から無料で入手できる、とある"
  },
  {
    "id": "waic-jis-news-2026",
    "title": "JIS X 8341-3とは何なのか？ ウェブコンテンツのアクセシビリティのために",
    "url": "https://waic.jp/news/news-7938/",
    "publisher": "ウェブアクセシビリティ基盤委員会（WAIC）",
    "year": "2026（お知らせの一覧では 2026-09-28）",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "解説の動画と書き起こし。JIS X 8341-3:2016 は ISO/IEC 40500:2012 の一致規格で、WCAG 2.0 と技術的に同等。もとの ISO の規格が 2025 年 9 月に改訂されたのを受けて JIS も改正する見込みで、順調なら 2027 年、遅くとも 2028 年。改正後はガイドラインが 13 に、達成基準が 26 増える見込み。AA は国内外の公的機関などで求められる水準、という説明"
  },
  {
    "id": "waic-jis-committee-2025",
    "title": "JIS X 8341-3改正原案作成委員会 発足のお知らせ",
    "url": "https://waic.jp/news/20251113/",
    "publisher": "ウェブアクセシビリティ基盤委員会（WAIC）",
    "year": "2025-11-13",
    "kind": "official",
    "checked": "2026-10-31",
    "note": "WAIC が 2025-10-30 に JIS X 8341-3 の改正原案作成委員会を立ち上げ、第 1 回を開いたというお知らせ。ISO/IEC 40500 が 2025 年 9 月に改正されたのを受けたもので、ISO/IEC 40500:2025 との一致規格にする方針、日本独自の内容は付属書（参考）に分ける方針。WCAG 2.2 の正誤表が ISO/IEC 40500:2025 に入っていないことなどを論点として確認。「JIS の改正の作業が進んでいる」の根拠（WAIC のお知らせの一覧で、2026-10-31 の時点で改正版の発行のお知らせは無い）"
  },
  {
    "id": "cao-kihon-houshin-2023",
    "title": "障害を理由とする差別の解消の推進に関する基本方針",
    "url": "https://www8.cao.go.jp/shougai/suishin/sabekai/kihonhoushin/r05/pdf/honbun.pdf",
    "publisher": "内閣府（2023 年 3 月 14 日閣議決定）",
    "year": "2023",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "環境の整備は、不特定多数の障害者を主な対象とする事前的改善措置（施設や設備のバリアフリー化、人的支援、情報アクセシビリティの向上など）で、行政機関等と事業者の努力義務。合理的配慮は、環境の整備を基礎に個別の状況に応じて行う措置。例として、使いにくいウェブサイトの手続きに電話やメールで対応し（合理的配慮の提供）、以後サイトを改良する（環境の整備）場面を挙げ、両輪で進めるのが重要とする（内閣府のページにある同じ内容のテキスト版で確かめた）"
  },
  {
    "id": "w3c-apg-button",
    "title": "Button Pattern（WAI-ARIA Authoring Practices Guide）",
    "url": "https://www.w3.org/WAI/ARIA/apg/patterns/button/",
    "publisher": "W3C Web Accessibility Initiative（WAI）",
    "year": "—",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "ボタンにフォーカスがあるとき、Space でも Enter でも押せる。名前はふつう中の文字から決まり、aria-label などでも付けられる"
  },
  {
    "id": "mdn-button-role",
    "title": "ARIA: button role",
    "url": "https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/button_role",
    "publisher": "MDN Web Docs（Mozilla）",
    "year": "2026-08-21 更新",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "できる限り button 要素などの元からあるボタンを使う（キーボードとフォーカスの動きが最初から入っている）。role=\"button\" は意味を伝えるだけで、div などに付けるなら tabindex=\"0\" と、Enter と Space のキーの処理を自分で足す。ボタンには必ず名前が要る"
  },
  {
    "id": "w3c-apg-read-me-first",
    "title": "Read Me First（WAI-ARIA Authoring Practices Guide）",
    "url": "https://www.w3.org/WAI/ARIA/apg/practices/read-me-first/",
    "publisher": "W3C Web Accessibility Initiative（WAI）",
    "year": "—",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "「No ARIA is better than Bad ARIA」。間違った ARIA は支援技術の利用者に画面を偽って伝えるので、ないより悪いことがある。role は約束で、div に role=\"button\" を付けたら、ボタンに期待されるキーボードの動きを JavaScript で作る必要がある（role だけではブラウザは動きを足さない）"
  },
  {
    "id": "w3c-easy-checks",
    "title": "Easy Checks – A First Review of Web Accessibility",
    "url": "https://www.w3.org/WAI/test-evaluate/easy-checks/",
    "publisher": "W3C Web Accessibility Initiative（WAI）",
    "year": "2024-03-21 更新",
    "kind": "official",
    "checked": "2026-10-30",
    "note": "最初の点検の項目（ページの題・画像の代替テキスト・コントラスト・拡大・キーボードのフォーカスが見えるか・ラベル・必須の欄・見出し など）。手早い点検で網羅的ではなく、通っても大きな問題が残ることがある、と書く"
  },
  {
    "id": "nng-heuristic-evaluation",
    "title": "How to Conduct a Heuristic Evaluation",
    "url": "https://www.nngroup.com/articles/how-to-conduct-a-heuristic-evaluation/",
    "publisher": "Kate Moran, Kelley Gordon（Nielsen Norman Group）",
    "year": "2023",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "経験則（ヒューリスティクス）で画面を点検する進め方。腕のある人でも見落とすので、3〜5 人がそれぞれ別々に点検し、終わってから持ち寄る。点検は利用者のリサーチの代わりにはならず、テストで確かめる所の目印になる（2023-06-25 公開）"
  },
  {
    "id": "nng-severity-ratings",
    "title": "Severity Ratings for Usability Problems",
    "url": "https://www.nngroup.com/articles/how-to-rate-the-severity-of-usability-problems/",
    "publisher": "Jakob Nielsen（Nielsen Norman Group）",
    "year": "1994",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "問題の深刻度は、頻度・影響（乗り越えにくさ）・繰り返し（一度で慣れるか、毎回困るか）に市場への影響を加えて決め、0（問題ではない）〜4（出す前に必ず直す）で表す。点検の最中ではなく後で付ける。1 人の点はぶれるので、3 人の平均で多くの場合は足りるとする"
  },
  {
    "id": "nng-paper-prototyping",
    "title": "Paper Prototyping: Getting User Data Before You Code",
    "url": "https://www.nngroup.com/articles/paper-prototyping/",
    "publisher": "Jakob Nielsen（Nielsen Norman Group）",
    "year": "2003",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "紙の試作で、作る前に利用者のテストをする方法。最も速く安い手法の 1 つで、粗い試作でも役に立つ。早い段階で見つけるほど直すのが安い（2003-04-13 公開）"
  },
  {
    "id": "nng-prototype-fidelity",
    "title": "UX Prototypes: Low Fidelity vs. High Fidelity",
    "url": "https://www.nngroup.com/articles/ux-prototype-hi-lo-fidelity/",
    "publisher": "Kara Pernice（Nielsen Norman Group）",
    "year": "2016",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "試作の作り込みは、操作・見た目・中身の 3 つの軸で決まる。粗い試作では人が「コンピューターの役」をし、直しやすく、参加者が遠慮なく意見を言いやすく、作り手も手放しやすい。流れの細部・動く部品・読みやすさ・反応の速さを確かめるなら作り込んだ試作が向く（2016-12-18 公開）"
  },
  {
    "id": "nng-task-scenarios",
    "title": "Turn User Goals into Task Scenarios for Usability Testing",
    "url": "https://www.nngroup.com/articles/task-scenarios-usability-testing/",
    "publisher": "Marieke McCloskey（Nielsen Norman Group）",
    "year": "2014",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "テストのタスクは、現実にありそうで、実際に操作してもらう形にし、手順のヒントや画面の言葉（ボタンの名前など）を入れない。名前や日付など、やり切るのに必要な情報は入れる（2014-01-12 公開）"
  },
  {
    "id": "nng-leading-questions",
    "title": "Avoid Leading Questions to Get Better Insights from Participants",
    "url": "https://www.nngroup.com/articles/leading-questions/",
    "publisher": "Amy Schade（Nielsen Norman Group）",
    "year": "2017",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "答えを含む・ほのめかす質問（誘導する質問）では、参加者が言葉や意見を合わせ、確かめるのではなく思い込みを裏付けるだけになる。原因や気持ちを決めつけず、画面の部品の名前を出さず、やりやすさ・やりにくさを中立に、開いた質問で聞く（2017-12-17 公開）"
  },
  {
    "id": "sauro-assistance-2017",
    "title": "When to Provide Assistance in a Usability Test",
    "url": "https://measuringu.com/usability-assistance/",
    "publisher": "Jeff Sauro（MeasuringU）",
    "year": "2017",
    "kind": "practice",
    "checked": "2026-10-30",
    "note": "助けに入るのは、同じ所で行き詰まって本当に先へ進めない・時間が足りない・データが消えるなどの事故が起きそうなとき。助けたら回数・理由・程度を記録し、完了の数は助けありと助けなしを分けて出せる。助けは少ないほどよい（2017-08-30 公開）"
  }
]);
export const SOURCES = SOURCE_TABLE.sources;
export const docsOf = SOURCE_TABLE.docs;
export const UIUX_SOURCES = SOURCES;
