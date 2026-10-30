# エンジニアのための UI・UX デザイン

見た目の前に、目的と流れから画面を直す

- 講座 ID: `uiux-engineers`
- 受講者: Web サービスやアプリの画面を自分で作っているエンジニア・個人開発者。デザインは初めて
- 例に使う架空のサービス: 架空の予約サービス「サンプル予約」（小さなお店の来店予約。日時・連絡先・確認の 3 ステップ）

## 到達目標

1. 画面の良し悪しを、ユーザーの目的と操作の流れから説明できる
2. 情報設計・視覚的な優先順位・余白・文字・色・フォーム・エラー表示・アクセシビリティの基本を、改善前後の比較で使える
3. 自分のサービスの 1 画面で「問題を見つける → 改善案を作る → 簡単なプロトタイプにする → 利用者に確かめる」を一巡できる

最後の実践: 自分のサービスの 1 画面を選び、問題の一覧・改善案・簡単なプロトタイプ・3〜5 人の利用者テストの結果を 1 つにまとめる（第 8 章）

## 前提知識

- HTML のフォームやボタンを作ったことがある
- デザインツールが使えなくてもよい（紙とブラウザで進める）

## 全体の目次と動画構成

| 章 | 章 ID | 動画 | セクション | タイトル | この章で答える問い | 目安 | 状態 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `uiux-01` | `D01` | はじめに | [UI・UX とは何か](uiux-01.md) | 見た目を直す前に、何を見ればいいのか？ | 8 分 | 教材・動画あり |
| 2 | `uiux-02` | `D02` | 目的と流れ | [ユーザーの目的と情報設計](uiux-02.md) | 何を、どんな言葉で、どうまとめて見せるか？ | 8 分 | 教材・動画あり |
| 3 | `uiux-03` | `D03` | 目的と流れ | [操作の流れとナビゲーション](uiux-03.md) | 迷わず進み、間違えても戻れる流れをどう作るか？ | 8 分 | 教材・動画あり |
| 4 | `uiux-04` | `D04` | 見た目の基本 | [視覚的な優先順位・余白・文字](uiux-04.md) | 一番大事なものが、一目で分かる画面にするには？ | 8 分 | 教材・動画あり |
| 5 | `uiux-05` | `D05` | 見た目の基本 | [色とコントラスト](uiux-05.md) | 色を、意味が伝わり、誰にでも読める形で使うには？ | 8 分 | 教材・動画あり |
| 6 | `uiux-06` | `D06` | フォームとアクセシビリティ | [フォームとエラー表示](uiux-06.md) | 入力の手間と間違いを減らし、間違えたらすぐ直せるフォームとは？ | 9 分 | 教材・動画あり |
| 7 | `uiux-07` | `D07` | フォームとアクセシビリティ | [アクセシビリティ: 誰でも使える画面](uiux-07.md) | 見え方・使い方が違う人も、同じように使えるようにするには？ | 9 分 | 教材・動画あり |
| 8 | `uiux-08` | `D08` | 実践 | [実践: 1 画面を改善して確かめる](uiux-08.md) | 問題を見つけ、直し、本当に良くなったかを確かめるには？ | 10 分 | 教材・動画あり |

合計の目安: 約 68 分

各章は「具体的な困りごと → 考え方 → 良い例・悪い例 → 実践手順 → 演習 → 振り返り」の順に進みます。

### 第 1 章 UI・UX とは何か（`uiux-01`）

問い: 見た目を直す前に、何を見ればいいのか？

学習目標:

- UI・UX・ユーザビリティの違いを説明できる
- 画面を目的・流れ・見た目の 3 層で見られる
- 改善前後をタスクの数字で比べられる

前提知識:

- なし

動画の構成:

| 流れ | 中身 |
| --- | --- |
| 困りごと | サンプル予約で、予約の画面を開いた人の多くが途中でやめる（仮の数字） |
| 考え方 | UX・ユーザビリティ・UI の定義（ISO）、目的 → 流れ → 見た目の 3 層 |
| 良い例・悪い例 | 同じ予約の画面の改善前・改善後と、なぜ分かりやすくなるか（ヒューリスティクス）。○×クイズ |
| 実践手順 | 主要なタスクを 1 文で書き、手順を数え、3 層の順に問題を書く。1 人に使ってもらう |
| 演習 | 自分のサービスの主要なタスクと手順の数（5 分） |
| 振り返り | 要点 3 つと、講座の地図 |

実践課題の案: 主要なタスクを 1 文で書き、3 層で問題を書き出す

主な出典:

- ISO（2019）「ISO 9241-210:2019 Ergonomics of human-system interaction — Part 210: Human-centred design for interactive systems」 https://www.iso.org/standard/77520.html （公式・法令・規格・2026-10-30 確認）
- ISO（2018）「ISO 9241-11:2018 Ergonomics of human-system interaction — Part 11: Usability: Definitions and concepts」 https://www.iso.org/standard/63500.html （公式・法令・規格・2026-10-30 確認）
- Don Norman, Jakob Nielsen（Nielsen Norman Group）（1998）「The Definition of User Experience (UX)」 https://www.nngroup.com/articles/definition-user-experience/ （実務の指針・2026-10-30 確認）
- Jakob Nielsen（Nielsen Norman Group）（1994（2020 年改訂・2024 年見直し））「10 Usability Heuristics for User Interface Design」 https://www.nngroup.com/articles/ten-usability-heuristics/ （実務の指針・2026-10-30 確認）
- Katie Sherwin（Nielsen Norman Group）（2014）「Placeholders in Form Fields Are Harmful」 https://www.nngroup.com/articles/form-design-placeholders/ （実務の指針・2026-10-30 確認）
- Jakob Nielsen（Nielsen Norman Group）（2012）「Thinking Aloud: The #1 Usability Tool」 https://www.nngroup.com/articles/thinking-aloud-the-1-usability-tool/ （実務の指針・2026-10-30 確認）

### 第 2 章 ユーザーの目的と情報設計（`uiux-02`）

問い: 何を、どんな言葉で、どうまとめて見せるか？

学習目標:

- 利用者の目的と状況を 1 文で書ける
- 情報を分類し、ラベル（言葉）を利用者に合わせられる
- 1 画面に載せる情報の優先順位を決められる

前提知識:

- 第 1 章

動画の構成:

| 流れ | 中身 |
| --- | --- |
| 困りごと | メニューの言葉が作り手の言葉で、目的の機能が見つからない |
| 考え方 | 情報設計（分類・ラベル・ナビゲーション）、カード分類 |
| 良い例・悪い例 | 機能名のメニュー／利用者の目的で分けたメニュー |
| 実践手順 | 画面の情報を書き出し、目的ごとにまとめ直す |
| 演習 | 自分のサービスのメニューの言葉を利用者の言葉に直す |
| 振り返り | 分け方とラベルは、利用者の頭の中に合わせる |

実践課題の案: 画面の情報の一覧と、目的ごとのまとめ直し・ラベル案

主な出典:

- ISO（2018）「ISO 9241-11:2018 Ergonomics of human-system interaction — Part 11: Usability: Definitions and concepts」 https://www.iso.org/standard/63500.html （公式・法令・規格・2026-10-30 確認）
- ISO（2019）「ISO 9241-210:2019 Ergonomics of human-system interaction — Part 210: Human-centred design for interactive systems」 https://www.iso.org/standard/77520.html （公式・法令・規格・2026-10-30 確認）
- Jakob Nielsen（Nielsen Norman Group）（1994（2020 年改訂・2024 年見直し））「10 Usability Heuristics for User Interface Design」 https://www.nngroup.com/articles/ten-usability-heuristics/ （実務の指針・2026-10-30 確認）
- Samhita Tankala, Katie Sherwin（Nielsen Norman Group）（2024）「Card Sorting: Uncover Users' Mental Models for Better Information Architecture」 https://www.nngroup.com/articles/card-sorting-definition/ （実務の指針・2026-10-30 確認）
- Page Laubheimer（Nielsen Norman Group）（2023（2026-08-19 見直し））「Tree Testing: Evaluate Menu Labels and Categories」 https://www.nngroup.com/articles/tree-testing/ （実務の指針・2026-10-30 確認）
- Jen Cardello（Nielsen Norman Group）（2014）「The Difference Between Information Architecture (IA) and Navigation」 https://www.nngroup.com/articles/ia-vs-navigation/ （実務の指針・2026-10-30 確認）
- Louis Rosenfeld, Peter Morville, Jorge Arango（O'Reilly Media）（2015）「Information Architecture: For the Web and Beyond（第 4 版）」 https://www.oreilly.com/library/view/information-architecture-4th/9781491913529/ （実務の指針・2026-10-30 確認）

### 第 3 章 操作の流れとナビゲーション（`uiux-03`）

問い: 迷わず進み、間違えても戻れる流れをどう作るか？

学習目標:

- タスクの流れを図にできる
- 今どこか・次に何が起きるかを見せられる
- 取り消し・戻る・下書きの保存を設計できる

前提知識:

- 第 1〜2 章

動画の構成:

| 流れ | 中身 |
| --- | --- |
| 困りごと | 確認の画面がなく、送った後で間違いに気づく |
| 考え方 | タスクの流れ図、システムの状態、利用者の制御と自由 |
| 良い例・悪い例 | 戻ると入力が消える／ステップを見せ、確認と修正ができる |
| 実践手順 | 主要なタスクの流れ図を書き、行き止まりと迷う所に印を付ける |
| 演習 | 自分のサービスの流れ図を書く |
| 振り返り | 進む・戻る・やめるを、どの画面でも選べるか |

実践課題の案: タスクの流れ図と、行き止まりの直し案

主な出典:

- Jakob Nielsen（Nielsen Norman Group）（1994（2020 年改訂・2024 年見直し））「10 Usability Heuristics for User Interface Design」 https://www.nngroup.com/articles/ten-usability-heuristics/ （実務の指針・2026-10-30 確認）
- Maria Rosala（Nielsen Norman Group）（2020）「User Control and Freedom (Usability Heuristic #3)」 https://www.nngroup.com/articles/user-control-and-freedom/ （実務の指針・2026-10-30 確認）
- Jakob Nielsen（Nielsen Norman Group）（2018（2026-08-07 見直し））「Confirmation Dialogs Can Prevent User Errors — If Not Overused」 https://www.nngroup.com/articles/confirmation-dialog/ （実務の指針・2026-10-30 確認）
- Raluca Budiu（Nielsen Norman Group）（2017）「Wizards: Definition and Design Recommendations」 https://www.nngroup.com/articles/wizards/ （実務の指針・2026-10-30 確認）
- Kate Kaplan（Nielsen Norman Group）（2023（2026-08-27 見直し））「User Journeys vs. User Flows」 https://www.nngroup.com/articles/user-journeys-vs-user-flows/ （実務の指針・2026-10-30 確認）
- W3C WAI（WCAG 2.2）「Understanding Success Criterion 3.3.4: Error Prevention (Legal, Financial, Data)」 https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html （公式・法令・規格・2026-10-30 確認）
- W3C Web Accessibility Initiative（WAI）（WCAG 2.2 の解説）「Understanding Success Criterion 3.3.7: Redundant Entry」 https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html （公式・法令・規格・2026-10-30 確認）

### 第 4 章 視覚的な優先順位・余白・文字（`uiux-04`）

問い: 一番大事なものが、一目で分かる画面にするには？

学習目標:

- 大きさ・濃さ・位置・余白で優先順位を作れる
- 近接・類似・共通領域（ゲシュタルトの原則）と整列（グリッド）でまとまりを見せられる
- 本文と見出しの文字の大きさと行間を決められる

前提知識:

- 第 1〜3 章

動画の構成:

| 流れ | 中身 |
| --- | --- |
| 困りごと | すべてが同じ強さで、どこを見ればいいか分からない |
| 考え方 | 視覚的な優先順位、近接・類似・共通領域（ゲシュタルトの原則）、整列とグリッド、文字の大きさの段階 |
| 良い例・悪い例 | 同じ大きさのボタンが 5 つ／主ボタン 1 つと控えめなボタン |
| 実践手順 | 画面の要素に 1〜3 の優先度を付け、見た目の強さをそろえる |
| 演習 | 自分の画面の余白と文字の段階を直す |
| 振り返り | 一番を 1 つ決めると、残りが決まる |

実践課題の案: 優先度の付いた要素の一覧と、余白・文字の段階の直し案

主な出典:

- Kelley Gordon（Nielsen Norman Group）（2021）「Visual Hierarchy in UX: Definition」 https://www.nngroup.com/articles/visual-hierarchy-ux-definition/ （実務の指針・2026-10-30 確認）
- Aurora Harley（Nielsen Norman Group）（2020）「Proximity Principle in Visual Design」 https://www.nngroup.com/articles/gestalt-proximity/ （実務の指針・2026-10-30 確認）
- Aurora Harley（Nielsen Norman Group）（2020）「Similarity Principle in Visual Design」 https://www.nngroup.com/articles/gestalt-similarity/ （実務の指針・2026-10-30 確認）
- Aurora Harley（Nielsen Norman Group）（2020）「The Principle of Common Region: Containers Create Groupings」 https://www.nngroup.com/articles/common-region/ （実務の指針・2026-10-30 確認）
- Kelley Gordon（Nielsen Norman Group）（2022）「Using Grids in Interface Designs」 https://www.nngroup.com/articles/using-grids-in-interface-designs/ （実務の指針・2026-10-30 確認）
- Kara Pernice（Nielsen Norman Group）（2017（2026 年見直し））「F-Shaped Pattern of Reading on the Web: Misunderstood, But Still Relevant (Even on Mobile)」 https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/ （実務の指針・2026-10-30 確認）
- GOV.UK（英国政府）（—）「Button（GOV.UK Design System）」 https://design-system.service.gov.uk/components/button/ （公式・法令・規格・2026-10-30 確認）
- W3C（Working Group Note）（2020）「Requirements for Japanese Text Layout 日本語組版処理の要件」 https://www.w3.org/TR/jlreq/ （公式・法令・規格・2026-10-30 確認）

### 第 5 章 色とコントラスト（`uiux-05`）

問い: 色を、意味が伝わり、誰にでも読める形で使うには？

学習目標:

- 色の役割（主役・状態・強調）を決められる
- WCAG のコントラスト比（本文 4.5:1 など）を測れる
- 色だけに頼らない伝え方ができる

前提知識:

- 第 4 章

動画の構成:

| 流れ | 中身 |
| --- | --- |
| 困りごと | 薄いグレーの文字が読めない、エラーが赤い色だけで伝わらない |
| 考え方 | 色の役割、コントラスト比、色の使用（色だけで伝えない） |
| 良い例・悪い例 | 赤い枠だけのエラー／アイコンと文言を添えたエラー |
| 実践手順 | 画面の色を一覧にし、コントラスト比を測って直す |
| 演習 | 自分の画面の文字と部品のコントラスト比を測る |
| 振り返り | 色は意味を決めてから、少なく使う |

実践課題の案: 色の一覧（役割・コントラスト比）と直し案

主な出典:

- W3C（2023（2024-12-12 更新））「Web Content Accessibility Guidelines (WCAG) 2.2」 https://www.w3.org/TR/WCAG22/ （公式・法令・規格・2026-10-30 確認）
- W3C WAI（2026-09-06 更新）「Understanding Success Criterion 1.4.3: Contrast (Minimum)」 https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html （公式・法令・規格・2026-10-30 確認）
- W3C WAI（2026-09-06 更新）「Understanding Success Criterion 1.4.11: Non-text Contrast」 https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html （公式・法令・規格・2026-10-30 確認）
- W3C WAI（2025-09-16 更新）「Understanding Success Criterion 1.4.1: Use of Color」 https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html （公式・法令・規格・2026-10-30 確認）
- 情報通信アクセス協議会 ウェブアクセシビリティ基盤委員会（WAIC）（2024-12-12 版の訳（作業中））「Web Content Accessibility Guidelines (WCAG) 2.2（日本語訳）」 https://waic.jp/translations/WCAG22/ （公式・法令・規格・2026-10-30 確認）
- Google（Chrome for Developers）（2022）「Make your website more readable（Chrome DevTools）」 https://developer.chrome.com/docs/devtools/accessibility/contrast （実務の指針・2026-10-30 確認）
- 日本眼科学会・日本眼科医会（2013）「色覚検査について（文部科学省への要望書の別添）」 https://www.gankaikai.or.jp/info/20131024_colorvision.pdf （公式・法令・規格・2026-10-30 確認）

### 第 6 章 フォームとエラー表示（`uiux-06`）

問い: 入力の手間と間違いを減らし、間違えたらすぐ直せるフォームとは？

学習目標:

- ラベル・入力の形式・必須の示し方を決められる
- エラーを防ぐ設計（選ばせる・形式を受け入れる）ができる
- エラーの場所と文言（何が・なぜ・どう直す）を書ける

前提知識:

- 第 1〜5 章

動画の構成:

| 流れ | 中身 |
| --- | --- |
| 困りごと | 送るたびに画面の上にエラーがまとめて出て、どこを直すか分からない |
| 考え方 | ラベル、入力の形式、エラーの防止、エラーの特定と修正の提案 |
| 良い例・悪い例 | 「入力に誤りがあります」だけ／欄の近くに直し方まで書く |
| 実践手順 | フォームの項目を減らし、エラーの文言を書き直す |
| 演習 | 自分のフォームのエラーの文言を 3 つ書き直す |
| 振り返り | エラーは利用者のせいにしない |

実践課題の案: フォームの項目の見直しと、エラーの文言（何が・なぜ・どう直す）

主な出典:

- W3C（2023（2024-12-12 更新））「Web Content Accessibility Guidelines (WCAG) 2.2」 https://www.w3.org/TR/WCAG22/ （公式・法令・規格・2026-10-30 確認）
- 情報通信アクセス協議会 ウェブアクセシビリティ基盤委員会（WAIC）（2024-12-12 版の訳（作業中））「Web Content Accessibility Guidelines (WCAG) 2.2（日本語訳）」 https://waic.jp/translations/WCAG22/ （公式・法令・規格・2026-10-30 確認）
- GOV.UK（英国政府）（—）「Error message（GOV.UK Design System）」 https://design-system.service.gov.uk/components/error-message/ （公式・法令・規格・2026-10-30 確認）
- GOV.UK（英国政府）（—）「Error summary（GOV.UK Design System）」 https://design-system.service.gov.uk/components/error-summary/ （公式・法令・規格・2026-10-30 確認）
- GOV.UK（英国政府）（—）「Text input（GOV.UK Design System）」 https://design-system.service.gov.uk/components/text-input/ （公式・法令・規格・2026-10-30 確認）
- Tim Neusesser, Evan Sunwall（Nielsen Norman Group）（2023）「Error-Message Guidelines」 https://www.nngroup.com/articles/error-message-guidelines/ （実務の指針・2026-10-30 確認）
- Katie Sherwin（Nielsen Norman Group）（2014）「Placeholders in Form Fields Are Harmful」 https://www.nngroup.com/articles/form-design-placeholders/ （実務の指針・2026-10-30 確認）
- Raluca Budiu（Nielsen Norman Group）（2019）「Marking Required Fields in Forms」 https://www.nngroup.com/articles/required-fields/ （実務の指針・2026-10-30 確認）
- W3C Web Accessibility Initiative（WAI）（WCAG 2.2 の解説）「Understanding Success Criterion 3.3.1: Error Identification」 https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html （公式・法令・規格・2026-10-30 確認）
- W3C Web Accessibility Initiative（WAI）（WCAG 2.2 の解説）「Understanding Success Criterion 1.3.5: Identify Input Purpose」 https://www.w3.org/WAI/WCAG22/Understanding/identify-input-purpose.html （公式・法令・規格・2026-10-30 確認）

### 第 7 章 アクセシビリティ: 誰でも使える画面（`uiux-07`）

問い: 見え方・使い方が違う人も、同じように使えるようにするには？

学習目標:

- WCAG の 4 つの原則と、主な達成基準を説明できる
- キーボード操作・代替テキスト・フォーカス・タップの大きさを点検できる
- 日本の制度の要点（2024 年 4 月から事業者の合理的配慮の提供が義務、ウェブの改善などの環境の整備は努力義務）を説明できる

前提知識:

- 第 4〜6 章

動画の構成:

| 流れ | 中身 |
| --- | --- |
| 困りごと | キーボードだけでは予約が送れない、画像のボタンが読み上げられない |
| 考え方 | WCAG 2.2（2025 年に ISO/IEC 40500:2025）、JIS X 8341-3:2016（WCAG 2.0 と同じ内容。改正の作業中）、合理的配慮と環境の整備 |
| 良い例・悪い例 | div のボタン／button 要素とラベル |
| 実践手順 | キーボードとスクリーンリーダーで、主要なタスクを試す |
| 演習 | 自分の画面を 10 項目で点検する |
| 振り返り | アクセシビリティは、あとから足すより最初から |

実践課題の案: アクセシビリティの 10 項目の点検表と、直す順番

主な出典:

- W3C（2023（2024-12-12 更新））「Web Content Accessibility Guidelines (WCAG) 2.2」 https://www.w3.org/TR/WCAG22/ （公式・法令・規格・2026-10-30 確認）
- W3C Web Accessibility Initiative（WAI）（2025-10-21）「WCAG 2.2 Approved as an ISO Standard」 https://www.w3.org/WAI/news/2025-10-21/wcag22-iso （公式・法令・規格・2026-10-30 確認）
- 情報通信アクセス協議会 ウェブアクセシビリティ基盤委員会（WAIC）（2016）「JIS X 8341-3:2016 解説」 https://waic.jp/docs/jis2016/understanding/201604/ （公式・法令・規格・2026-10-30 確認）
- ウェブアクセシビリティ基盤委員会（WAIC）（2026（お知らせの一覧では 2026-09-28））「JIS X 8341-3とは何なのか？ ウェブコンテンツのアクセシビリティのために」 https://waic.jp/news/news-7938/ （公式・法令・規格・2026-10-30 確認）
- 内閣府（2024 年 4 月 1 日施行の改正）「障害を理由とする差別の解消の推進」 https://www8.cao.go.jp/shougai/suishin/sabekai.html （公式・法令・規格・2026-10-30 確認）
- 内閣府（2023 年 3 月 14 日閣議決定）（2023）「障害を理由とする差別の解消の推進に関する基本方針」 https://www8.cao.go.jp/shougai/suishin/sabekai/kihonhoushin/r05/pdf/honbun.pdf （公式・法令・規格・2026-10-30 確認）
- デジタル庁（2025-10-16 更新）「ウェブアクセシビリティ導入ガイドブック」 https://www.digital.go.jp/resources/introduction-to-web-accessibility-guidebook （公式・法令・規格・2026-10-30 確認）
- W3C Web Accessibility Initiative（WAI）（—）「Button Pattern（WAI-ARIA Authoring Practices Guide）」 https://www.w3.org/WAI/ARIA/apg/patterns/button/ （公式・法令・規格・2026-10-30 確認）
- MDN Web Docs（Mozilla）（2026-08-21 更新）「ARIA: button role」 https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/button_role （実務の指針・2026-10-30 確認）
- W3C Web Accessibility Initiative（WAI）（2024-03-21 更新）「Easy Checks – A First Review of Web Accessibility」 https://www.w3.org/WAI/test-evaluate/easy-checks/ （公式・法令・規格・2026-10-30 確認）

### 第 8 章 実践: 1 画面を改善して確かめる（`uiux-08`）

問い: 問題を見つけ、直し、本当に良くなったかを確かめるには？

学習目標:

- ヒューリスティクスと観察で問題を見つけて並べられる
- 改善案を簡単なプロトタイプ（紙・HTML）にできる
- 同じ利用者層で 5 人前後のテストを繰り返す計画を立て、少人数の結果の限界も踏まえて次を決められる

前提知識:

- 第 1〜7 章

動画の構成:

| 流れ | 中身 |
| --- | --- |
| 困りごと | 直したつもりでも、良くなったか分からない |
| 考え方 | 問題の見つけ方、プロトタイプの粗さ、少人数のテストと思考発話、その限界 |
| 良い例・悪い例 | 誘導する質問のテスト／タスクだけ渡して見るテスト |
| 実践手順 | 問題を見つける → 改善案 → プロトタイプ → 利用者に確かめる |
| 演習 | 自分のサービスの 1 画面で一巡する |
| 振り返り | 講座全体の振り返りと次の一歩 |

実践課題の案: 1 画面の改善レポート（問題の一覧・改善案・プロトタイプ・テストの結果と次の手）

主な出典:

- Jakob Nielsen（Nielsen Norman Group）（2000）「Why You Only Need to Test with 5 Users」 https://www.nngroup.com/articles/why-you-only-need-to-test-with-5-users/ （実務の指針・2026-10-30 確認）
- Laura Faulkner（Behavior Research Methods, Instruments, & Computers 35）（2003）「Beyond the five-user assumption: Benefits of increased sample sizes in usability testing」 https://doi.org/10.3758/BF03195514 （研究・学術・2026-10-30 確認）
- Jakob Nielsen（Nielsen Norman Group）（2012）「Thinking Aloud: The #1 Usability Tool」 https://www.nngroup.com/articles/thinking-aloud-the-1-usability-tool/ （実務の指針・2026-10-30 確認）
- Kate Moran, Kelley Gordon（Nielsen Norman Group）（2023）「How to Conduct a Heuristic Evaluation」 https://www.nngroup.com/articles/how-to-conduct-a-heuristic-evaluation/ （実務の指針・2026-10-30 確認）
- Jakob Nielsen（Nielsen Norman Group）（1994）「Severity Ratings for Usability Problems」 https://www.nngroup.com/articles/how-to-rate-the-severity-of-usability-problems/ （実務の指針・2026-10-30 確認）
- Jakob Nielsen（Nielsen Norman Group）（2003）「Paper Prototyping: Getting User Data Before You Code」 https://www.nngroup.com/articles/paper-prototyping/ （実務の指針・2026-10-30 確認）
- Marieke McCloskey（Nielsen Norman Group）（2014）「Turn User Goals into Task Scenarios for Usability Testing」 https://www.nngroup.com/articles/task-scenarios-usability-testing/ （実務の指針・2026-10-30 確認）
- Amy Schade（Nielsen Norman Group）（2017）「Avoid Leading Questions to Get Better Insights from Participants」 https://www.nngroup.com/articles/leading-questions/ （実務の指針・2026-10-30 確認）

## 出典の一覧

| ID | 種類 | 出典 | 確認日 | 何を確かめたか |
| --- | --- | --- | --- | --- |
| `iso-9241-210-2019` | 公式・法令・規格 | [ISO（2019）ISO 9241-210:2019 Ergonomics of human-system interaction — Part 210: Human-centred design for interactive systems](https://www.iso.org/standard/77520.html) | 2026-10-30 | 3.15 user experience の定義（システム・製品・サービスの利用や利用の予想から生じる利用者の知覚と反応。使う前・間・後に生じる）と、5 章の人間中心設計の 6 つの原則（利用者・タスク・環境の理解、利用者を交えた評価、繰り返し など） |
| `iso-9241-11-2018` | 公式・法令・規格 | [ISO（2018）ISO 9241-11:2018 Ergonomics of human-system interaction — Part 11: Usability: Definitions and concepts](https://www.iso.org/standard/63500.html) | 2026-10-30 | 3.1.1 usability の定義（特定の利用者が特定の利用状況で、効果・効率・満足を伴って特定の目標を達成できる度合い）。3.1.10 目標（意図した結果）・3.1.11 タスク（目標は手段によらない）・3.1.15 利用状況も、各国の規格機関の公式プレビューで確認。日本の JIS Z 8521:2020 はこれを基にした規格（修正あり）で、訳語は「効果・効率・満足」 |
| `nng-10-heuristics` | 実務の指針 | [Jakob Nielsen（Nielsen Norman Group）（1994（2020 年改訂・2024 年見直し））10 Usability Heuristics for User Interface Design](https://www.nngroup.com/articles/ten-usability-heuristics/) | 2026-10-30 | 10 のユーザビリティ・ヒューリスティクス（システムの状態を見せる・現実の世界に合わせる・記憶より見て分かる・エラーを防ぐ など）。具体的なガイドラインではなく大まかな経験則と明記 |
| `nng-ux-definition` | 実務の指針 | [Don Norman, Jakob Nielsen（Nielsen Norman Group）（1998）The Definition of User Experience (UX)](https://www.nngroup.com/articles/definition-user-experience/) | 2026-10-30 | UX は会社・サービス・製品と利用者のやりとりのすべてで、UI は大事な一部だが UI が良くても良い UX になるとは限らない、という説明 |
| `nng-thinking-aloud` | 実務の指針 | [Jakob Nielsen（Nielsen Norman Group）（2012）Thinking Aloud: The #1 Usability Tool](https://www.nngroup.com/articles/thinking-aloud-the-1-usability-tool/) | 2026-10-30 | 利用者に考えを声に出してもらいながら使ってもらう思考発話法の説明。Nielsen はユーザビリティの一番の道具と位置づけ、万能ではない・統計的な比較には向かないとも書く |
| `nng-5-users` | 実務の指針 | [Jakob Nielsen（Nielsen Norman Group）（2000）Why You Only Need to Test with 5 Users](https://www.nngroup.com/articles/why-you-only-need-to-test-with-5-users/) | 2026-10-30 | 1 人が見つける問題の割合を約 31% と置くモデルでは 5 人で約 85%。利用者層が同じ・問題を見つける定性テスト・繰り返すことが前提 |
| `nng-gestalt-proximity` | 実務の指針 | [Aurora Harley（Nielsen Norman Group）（2020）Proximity Principle in Visual Design](https://www.nngroup.com/articles/gestalt-proximity/) | 2026-10-30 | 近くにあるものは一つのまとまりに見える（ゲシュタルトの近接の原則）と、画面への当てはめ方。記事は整列とグリッドを扱っておらず、それは別の記事（nng-grids）の話として、この講座では分けて扱う |
| `nng-error-messages` | 実務の指針 | [Tim Neusesser, Evan Sunwall（Nielsen Norman Group）（2023）Error-Message Guidelines](https://www.nngroup.com/articles/error-message-guidelines/) | 2026-10-30 | エラーは原因のそばに出し（色だけに頼らない）、具体的に・責めずに伝え、直し方や候補を示し、入力を残す |
| `govuk-error-message` | 公式・法令・規格 | [GOV.UK（英国政府）（—）Error message（GOV.UK Design System）](https://design-system.service.gov.uk/components/error-message/) | 2026-10-30 | エラーは入力欄の近くに出し、何が起きて・どう直すかを具体的に、前向きな言い方で書く。入力を消さない。上のまとめ（Error summary）と同じ文言にする、という政府のサービスの指針 |
| `wcag-22` | 公式・法令・規格 | [W3C（2023（2024-12-12 更新））Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG22/) | 2026-10-30 | コントラスト比（本文 4.5:1）・色だけに頼らない・ターゲットのサイズ・エラーの特定・ラベルなどの達成基準 |
| `jis-x-8341-3` | 公式・法令・規格 | [情報通信アクセス協議会 ウェブアクセシビリティ基盤委員会（WAIC）（2016）JIS X 8341-3:2016 解説](https://waic.jp/docs/jis2016/understanding/201604/) | 2026-10-30 | JIS X 8341-3:2016 は ISO/IEC 40500:2012（WCAG 2.0）と一致する規格（WAIC の解説で確認）。WCAG 2.2 が ISO/IEC 40500:2025 になったのを受けて改正の見込みで、順調なら 2027 年、遅くとも 2028 年（WAIC のお知らせ waic-jis-news-2026） |
| `cao-sabetsu-kaisho` | 公式・法令・規格 | [内閣府（2024 年 4 月 1 日施行の改正）障害を理由とする差別の解消の推進](https://www8.cao.go.jp/shougai/suishin/sabekai.html) | 2026-10-30 | 改正法（2024-04-01 施行）で、事業者による合理的配慮の提供が「努めなければならない」から「しなければならない」に（第 8 条 2 項）。ウェブの改善などの環境の整備は努力義務のまま（第 5 条）。ページからリンクされた法律本文と新旧対照条文で確認 |
| `digital-a11y-guidebook` | 公式・法令・規格 | [デジタル庁（2025-10-16 更新）ウェブアクセシビリティ導入ガイドブック](https://www.digital.go.jp/resources/introduction-to-web-accessibility-guidebook) | 2026-10-30 | ウェブアクセシビリティの考え方と導入の進め方の入門（2025-10-16 版の PDF で確認）。事業者の合理的配慮は義務、ウェブアクセシビリティは環境の整備として努力義務。チェックツールで確かめられるのは達成基準の 2〜3 割程度で、目視・キーボード・スクリーンリーダーでも確かめる。記号は読み上げられないことがある。入力形式の制限は入力の前に説明する |
| `faulkner-2003` | 研究・学術 | [Laura Faulkner（Behavior Research Methods, Instruments, & Computers 35）（2003）Beyond the five-user assumption: Benefits of increased sample sizes in usability testing](https://doi.org/10.3758/BF03195514) | 2026-10-30 | 60 人のデータから 5 人組を選ぶと、見つかる問題の割合は 55〜99% とばらついた。最も少ない組でも 10 人なら 80%、20 人なら 95%。5 人で必ず 85% とは言えない根拠。Springer はログインに飛ばされ、PubMed の抄録（PMID 14587545）で確認 |
| `nng-placeholders` | 実務の指針 | [Katie Sherwin（Nielsen Norman Group）（2014）Placeholders in Form Fields Are Harmful](https://www.nngroup.com/articles/form-design-placeholders/) | 2026-10-30 | 入力欄の中の薄い文字（プレースホルダー）をラベル代わりにすると、入力で消えて記憶の負担になる・見直せない・コントラストが低い・読み上げない支援技術がある。ラベルは欄の外に常に見えるように置く |
| `hornbaek-law-2007` | 研究・学術 | [Kasper Hornbæk, Effie Lai-Chong Law（CHI 2007）（2007）Meta-Analysis of Correlations Among Usability Measures](https://www.kasperhornbaek.dk/papers/CHI2007_MetaAnalysis.pdf) | 2026-10-30 | 73 の研究の分析で、有効さ・効率・満足の数字どうしの相関は全体に低い。3 つは別々に測るべきという主張を支える（著者の公開原稿） |
| `w3c-understanding-redundant-entry` | 公式・法令・規格 | [W3C Web Accessibility Initiative（WAI）（WCAG 2.2 の解説）Understanding Success Criterion 3.3.7: Redundant Entry](https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html) | 2026-10-30 | 3.3.7（レベル A。WCAG 2.2 で追加。W3C の「What’s New in WCAG 2.2」でも確認）。同じ手続きの中で前に入れた情報をもう一度求めるなら、自動で入れるか選べるようにする。ブラウザの自動入力だけでは足りない。例外は、再入力が欠かせない場合・安全のため（パスワードの確認など）・前の情報が使えなくなった場合。手続きを閉じてから戻ってきた場合には当たらない（第 3 章・第 6 章） |
| `waic-wcag22-ja` | 公式・法令・規格 | [情報通信アクセス協議会 ウェブアクセシビリティ基盤委員会（WAIC）（2024-12-12 版の訳（作業中））Web Content Accessibility Guidelines (WCAG) 2.2（日本語訳）](https://waic.jp/translations/WCAG22/) | 2026-10-30 | WCAG 2.2 の参考訳（翻訳は作業中で、正式版は W3C の英語版）。原則の訳（知覚可能・操作可能・理解可能・堅牢）と、達成基準の名前（1.1.1 非テキストコンテンツ、1.3.3 感覚による特性、1.3.5 入力目的の特定、1.4.1 色の用途、1.4.3 コントラスト (最低限)、1.4.6 コントラスト (高度)、1.4.11 非テキストのコントラスト、2.1.1 キーボード、2.4.7 フォーカスの可視化、2.4.11 隠されないフォーカス (最低限)、2.5.8 ターゲットのサイズ (最低限)、3.3.1 エラーの特定、3.3.2 ラベル又は指示、3.3.3 エラーの修正提案、3.3.7 冗長な入力項目 など）、用語（コントラスト比・相対輝度・サイズの大きな（テキスト））を確かめた。2.2 に適合するサイトは 2.0・2.1 にも適合することを意図し、新しい目標として 2.2 を採ることを勧める、という記述も（第 5 章・第 6 章・第 7 章） |
| `nng-card-sorting` | 実務の指針 | [Samhita Tankala, Katie Sherwin（Nielsen Norman Group）（2024）Card Sorting: Uncover Users' Mental Models for Better Information Architecture](https://www.nngroup.com/articles/card-sorting-definition/) | 2026-10-30 | カード分類の定義（項目を書いたカードを、参加者が自分に自然なまとまりに分ける）、オープン・クローズド・ハイブリッドの違い（決めたまとまりを確かめるならツリーテストを勧める）、カードは 30〜50 枚、同じ言葉を複数のカードに入れない、人数の目安（理由を聞く定性で 15 人以上・一般化する定量で 30〜50 人以上）、カード分類は案を作る方法でツリーテストは確かめる方法、限界（カードを単独で見る・階層や道順は分からない・人によってまとめ方が違う） |
| `nng-tree-testing` | 実務の指針 | [Page Laubheimer（Nielsen Norman Group）（2023（2026-08-19 見直し））Tree Testing: Evaluate Menu Labels and Categories](https://www.nngroup.com/articles/tree-testing/) | 2026-10-30 | ツリーテストは、見た目と文章を外した階層（メニュー）の中で、指定した項目の場所を参加者に探してもらう方法。正しい場所に着いた割合・まっすぐ進めたか・時間を見る。理由を探る定性なら少人数でよく、数で比べるなら多めの人数。カード分類で作った案はツリーテストで確かめる |
| `nng-ia-vs-navigation` | 実務の指針 | [Jen Cardello（Nielsen Norman Group）（2014）The Difference Between Information Architecture (IA) and Navigation](https://www.nngroup.com/articles/ia-vs-navigation/) | 2026-10-30 | 情報設計は、中身の目録と、まとめ方・名前の付け方の構造で、画面には直接見えない（IA が UI を形づくる）。ナビゲーションはその上のメニュー・パンくず・絞り込み・関連リンクなどの部品で、氷山の一角。ナビゲーションの形だけを先に決めるのは非効率で、あとで階層が足りなくなることがある |
| `nng-menu-design` | 実務の指針 | [Page Laubheimer（Nielsen Norman Group）（2024）Menu-Design Checklist: 17 UX Guidelines](https://www.nngroup.com/articles/menu-design/) | 2026-10-30 | メニューの指針。今いる場所をメニューで示す、ラベルは明確で具体的でなじみのある言葉に（作った言葉・社内の言葉・曖昧な総称を避ける）、大事な言葉をラベルの先頭に、アイコンは文字を補うもので置き換えない、よく使う項目を近くに置く |
| `nng-progressive-disclosure` | 実務の指針 | [Jakob Nielsen（Nielsen Norman Group）（2006）Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) | 2026-10-30 | 最初は大事な少数の選択肢だけを見せ、ほかは求められたときに出す（段階的な開示）。何を最初に出すかはタスク分析と使う頻度（利用の記録と観察）で決める。2 段を超える開示は、段の間で迷いやすく使いにくくなりがち |
| `rosenfeld-ia-2015` | 実務の指針 | [Louis Rosenfeld, Peter Morville, Jorge Arango（O'Reilly Media）（2015）Information Architecture: For the Web and Beyond（第 4 版）](https://www.oreilly.com/library/view/information-architecture-4th/9781491913529/) | 2026-10-30 | 情報設計の定番の本。分類（Organization Systems）・ラベル（Labeling Systems）・ナビゲーション（Navigation Systems）・検索（Search Systems）を章に分けて扱う。O'Reilly の公式ページは自動では開けなかった（403）ため、目次は電子書籍の販売ページ（helion.pl の同書のページ）で確かめた |
| `nng-user-control-freedom` | 実務の指針 | [Maria Rosala（Nielsen Norman Group）（2020）User Control and Freedom (Usability Heuristic #3)](https://www.nngroup.com/articles/user-control-and-freedom/) | 2026-10-30 | 間違えて進んだときの出口として、戻る・キャンセル・閉じる・取り消しを挙げる。ブラウザの戻るを壊さない、フォームの中の戻るや押せる進み具合の表示で入力を失わずに戻れるように、どの段でもキャンセルできるように、取り消しは見つけやすく押す時間を十分に（数秒で消える例）、やめるときに下書きを残すか捨てるかを選べるように |
| `nng-confirmation-dialog` | 実務の指針 | [Jakob Nielsen（Nielsen Norman Group）（2018（2026-08-07 見直し））Confirmation Dialogs Can Prevent User Errors — If Not Overused](https://www.nngroup.com/articles/confirmation-dialog/) | 2026-10-30 | 確認のダイアログは、作業を失う・大きなお金が動く・取り消せない操作に絞る。警告が多すぎると人は注意を払わなくなり、読まずに「はい」を押す。結果を具体的に書き、ボタンは「はい／いいえ」でなく行うことの名前に。取り消し（undo）を用意できればなおよい |
| `nng-wizards` | 実務の指針 | [Raluca Budiu（Nielsen Norman Group）（2017）Wizards: Definition and Design Recommendations](https://www.nngroup.com/articles/wizards/) | 2026-10-30 | ウィザード（決まった順に進む複数ページの入力）は、初めての人・まれな手続き・答えで分かれる手続きに向き、毎日くり返す作業・見比べが要る作業・慣れた人・途中で抜ける作業には向かない。全部のステップと今のステップを見せ、戻る・進むのボタンは行き先の名前に、途中でやめて保存し再開できるように |
| `nng-user-flows` | 実務の指針 | [Kate Kaplan（Nielsen Norman Group）（2023（2026-08-27 見直し））User Journeys vs. User Flows](https://www.nngroup.com/articles/user-journeys-vs-user-flows/) | 2026-10-30 | ユーザーフローは、1 つの製品の中で決まったタスクを終えるまでの、利用者の操作とシステムの応答の流れ（数分〜数時間）。ジャーニーは複数の接点にまたがる長い経験で、気持ちも描く。フローは流れ図・タスク図・ワイヤーフローで描く |
| `nng-visibility-system-status` | 実務の指針 | [Aurora Harley（Nielsen Norman Group）（2018）Visibility of System Status (Usability Heuristic #1)](https://www.nngroup.com/articles/visibility-system-status/) | 2026-10-30 | 状態が分からないと、利用者は次の手を決められない。操作にはすぐ見える応答を返し、時間のかかる処理は進み具合を見せ、結果とエラーをはっきり伝える。やりとりが予想どおりに進むことが信頼につながる |
| `w3c-understanding-error-prevention` | 公式・法令・規格 | [W3C WAI（WCAG 2.2）Understanding Success Criterion 3.3.4: Error Prevention (Legal, Financial, Data)](https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html) | 2026-10-30 | 3.3.4（レベル AA）。法的な約束・お金の取引・利用者が管理するデータの変更や削除・テストの回答を送るページは、取り消せる・入力を点検して直せる・確定の前に確かめて直せる、のどれかを満たす。例として、注文の前に品物・数・届け先・支払いを見せて直せるようにする。本文（WCAG 2.2、2024-12-12 版）でも確かめた |
| `caa-tokusho-tsuhan` | 公式・法令・規格 | [消費者庁（—）通信販売｜特定商取引法ガイド](https://www.no-trouble.caa.go.jp/what/mailorder/) | 2026-10-30 | インターネット通販の申込み（特定申込み、法第 12 条の 6）では、最終確認画面に、分量・販売価格（役務の対価）・代金の支払いの時期と方法・引渡しや提供の時期・申込期間（あれば）・申込みの撤回や解除に関すること を表示する。申込みになることを誤認させる表示や、表示事項を誤認させる表示は禁止で、誤認して申し込んだ人は取り消せる（法第 15 条の 4）。ページ自身が「概要」と書いている |
| `kokusen-tokusho-2022` | 公式・法令・規格 | [国民生活センター（2022）「おトクにお試しだけ」のつもりが「定期購入」に！？－「詐欺的な定期購入商法」の規制が強化された改正特定商取引法が施行されました！－](https://www.kokusen.go.jp/news/data/n-20220609_1.html) | 2026-10-30 | 改正特定商取引法が 2022 年 6 月 1 日に施行され、通販サイトの最終確認画面（注文確定の直前の画面）に、申込内容を簡単に確かめられるよう、分量・価格・支払い・引渡しの時期・申込期間・撤回や解除のことを表示する義務ができた（2022-06-09 公表） |
| `nng-visual-hierarchy` | 実務の指針 | [Kelley Gordon（Nielsen Norman Group）（2021）Visual Hierarchy in UX: Definition](https://www.nngroup.com/articles/visual-hierarchy-ux-definition/) | 2026-10-30 | 視覚的な優先順位を、意図した大事さの順に目が要素を追うようにする配置と定義。道具は色とコントラスト（色相より明るさ・鮮やかさの差）・大きさ・まとまり（近接と余白、共通領域）。大きさは大中小の 3 つまで、大きな要素は 2 つまで、Web の例は本文 14〜16px・小見出し 18〜22px・見出しは 32px まで。全部に差を付けると何も目立たない、目を細めるかぼかして確かめる、入る中身でも崩れる、と書く。色はシンプルな画面なら主 2・補助 2 まで、赤のような色は警告やエラーに、色だけで優先順位を伝えない |
| `nng-gestalt-similarity` | 実務の指針 | [Aurora Harley（Nielsen Norman Group）（2020）Similarity Principle in Visual Design](https://www.nngroup.com/articles/gestalt-similarity/) | 2026-10-30 | 色・形・大きさ・文字の太さなどの見た目を共有するものは、関係があるように見える（ゲシュタルトの類似の原則）。同じ働きは同じ見た目に、違う働きは違う見た目に。すべてのボタンが同じ色の銀行のフォームで、利用者が主ボタンを探すのに時間を使った例 |
| `nng-common-region` | 実務の指針 | [Aurora Harley（Nielsen Norman Group）（2020）The Principle of Common Region: Containers Create Groupings](https://www.nngroup.com/articles/common-region/) | 2026-10-30 | 同じ境界（枠・背景色）の中にあるものはひとまとまりに見え、近接より強く効くことがある（ゲシュタルトの共通領域の原則。Palmer 1992 で加わった）。枠の付けすぎは画面をうるさくし、余白（近接）だけで足りることも多い |
| `nng-grids` | 実務の指針 | [Kelley Gordon（Nielsen Norman Group）（2022）Using Grids in Interface Designs](https://www.nngroup.com/articles/using-grids-in-interface-designs/) | 2026-10-30 | グリッドは列（column）・列の間（gutter）・外側の余白（margin）でできる。部品は列に置き、gutter と margin には置かない。読みやすさと見渡しやすさを上げ、画面の大きさが変わっても置き場所を保ちやすい。崩すのは正当な理由があるときだけ。ゲシュタルトの原則には触れていない |
| `nng-f-pattern` | 実務の指針 | [Kara Pernice（Nielsen Norman Group）（2017（2026 年見直し））F-Shaped Pattern of Reading on the Web: Misunderstood, But Still Relevant (Even on Mobile)](https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/) | 2026-10-30 | 強い手がかりのない文章では、上の行と各行の左の数語が一番見られる（F 字型）。見出し・太字・まとまりがあると見方は変わる。大事なことは最初に置き、見出しは情報のある語で始める、と勧める |
| `govuk-button` | 公式・法令・規格 | [GOV.UK（英国政府）（—）Button（GOV.UK Design System）](https://design-system.service.gov.uk/components/button/) | 2026-10-30 | 既定のボタン（主ボタン）はページの主な行動に使い、1 ページに複数置かない（効き目が下がり、次に何をすればよいか分かりにくくなる）。ほかの行動は副ボタン。行動を増やしたくなったら、ページを簡単にするか分ける。押せないボタンはコントラストが低く混乱を招くので、なるべく使わない |
| `w3c-jlreq` | 公式・法令・規格 | [W3C（Working Group Note）（2020）Requirements for Japanese Text Layout 日本語組版処理の要件](https://www.w3.org/TR/jlreq/) | 2026-10-30 | 2.4.2 の 4: 基本版面の行間は、文字サイズの二分アキ以上・全角アキ以下が多い（CSS の line-height で 1.5〜2 倍）。行長が短ければ二分アキでもよく、35 字を超える行長では全角アキか、やや詰めた行間がよい。全角アキより広げても読みやすくはならない。本の組版の目安 |
| `mdn-font-size` | 実務の指針 | [MDN Web Docs（Mozilla）（—）font-size](https://developer.mozilla.org/en-US/docs/Web/CSS/font-size) | 2026-10-30 | ブラウザの既定の文字の大きさは、たいてい 16px。利用者の既定の大きさに対する値（em・rem など）を使うのがよく、px で決めると一部のブラウザで利用者が文字を大きくできない |
| `w3c-understanding-contrast-minimum` | 公式・法令・規格 | [W3C WAI（2026-09-06 更新）Understanding Success Criterion 1.4.3: Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) | 2026-10-30 | 計算した比は丸めない（4.499:1 は 4.5:1 に届かない）。1pt = 1.333px として、14pt と 18pt はおよそ 18.5px と 24px。4.5:1 は 20/40 程度の視力の低下を補う値。細い書体はアンチエイリアスで薄くなり、基準を満たしても実際のコントラストが低いことがあるので、太くするか余裕のある色にする。押せない部品は対象外、プレースホルダーは対象。ロゴ以外のブランドの色は対象外にならない。計算に色相はほとんど効かない。測るツールの例（Colour Contrast Analyser など） |
| `w3c-understanding-non-text-contrast` | 公式・法令・規格 | [W3C WAI（2026-09-06 更新）Understanding Success Criterion 1.4.11: Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) | 2026-10-30 | 部品と状態を見分けるのに要る見た目（フォーカス・選択・チェックの印など）と、内容の理解に要るアイコンやグラフの部分は、隣の色と 3:1 以上。入力欄の境目は、欄があると分かるほかの見た目の手がかりがないときに要る（その手がかりが 3:1 を満たす）。すべての部品の境目をはっきりさせるのが望ましい。押せない部品と、ブラウザの既定のままの見た目は対象外。比は丸めない |
| `w3c-understanding-use-of-color` | 公式・法令・規格 | [W3C WAI（2025-09-16 更新）Understanding Success Criterion 1.4.1: Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html) | 2026-10-30 | 色の違いだけで意味（必須・エラー・リンク・グラフの系列など）を伝えない。ページで色を使うことを妨げるものではない。失敗例 F81（必須やエラーの欄を色の違いだけで示す）・F73（色覚なしでは見分けられないリンク）、十分な手法 G183（周りの文字と 3:1 以上のリンク）・G205（色の付いたラベルに文字の手がかり）など。色覚の違いのある人・色の見え方が変わった高齢の人・白黒の画面の人などに効く |
| `govuk-colour` | 公式・法令・規格 | [GOV.UK（英国政府）（—）Colour（GOV.UK Design System）](https://design-system.service.gov.uk/styles/colour/) | 2026-10-30 | 色を役割の名前（文字・副の文字・リンク・枠・入力欄の枠・フォーカス・エラー・成功など）で決め、決めた場面だけで使う。利用者にとって予測できて一貫するように。色の値を写さず、役割の名前で使う。文字と操作部品のコントラストは WCAG 2.2 の 1.4.3（AA）を満たす |
| `chrome-devtools-contrast` | 実務の指針 | [Google（Chrome for Developers）（2022）Make your website more readable（Chrome DevTools）](https://developer.chrome.com/docs/devtools/accessibility/contrast) | 2026-10-30 | 要素を調べるときの表示と、文字の色のカラーピッカーの「Contrast ratio」で、コントラスト比と AA・AAA に足りるかが出る。CSS Overview・Lighthouse で、コントラストの低い文字を一覧にできる（2022-10-19 更新。画面は変わることがある） |
| `nichigan-color-vision-2013` | 公式・法令・規格 | [日本眼科学会・日本眼科医会（2013）色覚検査について（文部科学省への要望書の別添）](https://www.gankaikai.or.jp/info/20131024_colorvision.pdf) | 2026-10-30 | 先天色覚異常は男子の約 5%（20 人に 1 人）、女子の約 0.2%（500 人に 1 人）。色がまったく分からないのではなく、色によって見分けにくいことがある程度、という説明（2013-10-24 の要望書の別添。日本眼科医会のサイトの PDF を開いて確かめた） |
| `w3c-understanding-identify-input-purpose` | 公式・法令・規格 | [W3C Web Accessibility Initiative（WAI）（WCAG 2.2 の解説）Understanding Success Criterion 1.3.5: Identify Input Purpose](https://www.w3.org/WAI/WCAG22/Understanding/identify-input-purpose.html) | 2026-10-30 | 1.3.5（AA）は、利用者自身の情報を集める欄の目的を、決まった値（HTML の autocomplete など）でプログラムが判別できるようにする基準。ブラウザが実際に自動入力するかは、適合の判断と関係ない。自動入力のほか、支援技術が欄にアイコンを添えることなどに使われ、記憶・読み書き・手の動きに困難のある人に役立つ（解説は参考情報で、規定そのものではない） |
| `w3c-understanding-error-identification` | 公式・法令・規格 | [W3C Web Accessibility Initiative（WAI）（WCAG 2.2 の解説）Understanding Success Criterion 3.3.1: Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html) | 2026-10-30 | 3.3.1（A）は、自動で見つけた入力のエラーについて、どの項目かを示し、エラーを文字で説明する基準。色は文字に加えて使う手がかりで、色だけでは足りない。直し方の提示までは求めず、それは 3.3.3 の範囲 |
| `w3c-understanding-labels-or-instructions` | 公式・法令・規格 | [W3C Web Accessibility Initiative（WAI）（WCAG 2.2 の解説）Understanding Success Criterion 3.3.2: Labels or Instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html) | 2026-10-30 | 3.3.2（A）は、入力を求める所にラベルか指示を付ける基準。必須の欄を示すことも、この基準の十分な手法に含まれる（G83・H90 など）。ラベルと欄をコードで結び付けることそのものは 1.3.1 の範囲 |
| `w3c-understanding-error-suggestion` | 公式・法令・規格 | [W3C Web Accessibility Initiative（WAI）（WCAG 2.2 の解説）Understanding Success Criterion 3.3.3: Error Suggestion](https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion.html) | 2026-10-30 | 3.3.3（AA）は、入力のエラーを自動で見つけ、直し方が分かっているなら、その案を示す基準。セキュリティや目的を損なう場合は除く |
| `govuk-error-summary` | 公式・法令・規格 | [GOV.UK（英国政府）（—）Error summary（GOV.UK Design System）](https://design-system.service.gov.uk/components/error-summary/) | 2026-10-30 | 入力のエラーがあるときは、1 つでも、ページの上（見出しの前）に「There is a problem」の見出しと、エラーのある欄へのリンクを並べたまとめを出し、キーボードのフォーカスをまとめへ移す。まとめの文言は欄のそばのエラーと同じにし、欄のそばにも必ずエラーを出す |
| `govuk-text-input` | 公式・法令・規格 | [GOV.UK（英国政府）（—）Text input（GOV.UK Design System）](https://design-system.service.gov.uk/components/text-input/) | 2026-10-30 | ラベルは欄の上に置く。プレースホルダーをラベル・補足・例の代わりに使わない（入力で消える・読まない支援技術がある・既定の色はコントラストが足りないことが多い）。autocomplete 属性で欄の目的を伝える（本番では WCAG 2.2 の 1.3.5 のために必要）。空・長すぎる・短すぎるなど、状態ごとにエラーの文言を分ける型 |
| `govuk-telephone-numbers` | 公式・法令・規格 | [GOV.UK（英国政府）（—）Telephone numbers（GOV.UK Design System）](https://design-system.service.gov.uk/patterns/telephone-numbers/) | 2026-10-30 | 電話番号は利用者がなじんだ形で入力できるようにし、空白・ハイフン・かっこなどを受け付ける。入力マスクやプレースホルダーを使わない。autocomplete="tel" を付ける。エラーの文には id を付けて入力欄の aria-describedby から指し、頭に画面には見えない「Error:」を入れる |
| `govuk-question-pages` | 公式・法令・規格 | [GOV.UK（英国政府）（—）Question pages（GOV.UK Design System）](https://design-system.service.gov.uk/patterns/question-pages/) | 2026-10-30 | 本当に要る情報だけを聞き、なぜ要るかを説明できるようにする。任意の欄のラベルに「(optional)」を付け、必須の欄にアスタリスクを付けない。同じ手続きの中で同じ情報を二度聞かない |
| `nng-required-fields` | 実務の指針 | [Raluca Budiu（Nielsen Norman Group）（2019）Marking Required Fields in Forms](https://www.nngroup.com/articles/required-fields/) | 2026-10-30 | 必須の欄は、ほとんどが必須でもすべてに印を付ける（アスタリスクか「required」の文字。薄い印は避ける）。上に「すべて必須」と書くだけでは読み飛ばされ、忘れられる。任意の欄にも書くとさらに迷わない。ログインの 2 項目だけの画面は例外 |
| `w3c-understanding-non-text-content` | 公式・法令・規格 | [W3C Web Accessibility Initiative（WAI）（WCAG 2.2 の解説）Understanding Success Criterion 1.1.1: Non-text Content](https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html) | 2026-10-30 | 1.1.1（A）は、文字でない内容に、同じ役割のテキストの代替を付ける基準。ボタンやリンクになっている画像の代替は、その働きを書く。飾りの画像は、支援技術が読み飛ばせるよう空の alt にする（H67）（解説は参考情報で、規定そのものではない） |
| `w3c-understanding-keyboard` | 公式・法令・規格 | [W3C Web Accessibility Initiative（WAI）（WCAG 2.2 の解説）Understanding Success Criterion 2.1.1: Keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html) | 2026-10-30 | 2.1.1（A）は、すべての機能を、キーを押すタイミングを求めずにキーボードで操作できるようにする基準。動きの道筋そのものが要る機能（手書きの線など）は例外。目の見えない人・手の震えがある人のほか、音声入力やスクリーンキーボードなど、キーボードの代わりになる道具を使う人にも役立つ |
| `w3c-understanding-focus-visible` | 公式・法令・規格 | [W3C Web Accessibility Initiative（WAI）（WCAG 2.2 の解説）Understanding Success Criterion 2.4.7: Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html) | 2026-10-30 | 2.4.7（AA）は、キーボードで操作できる画面に、フォーカスの位置が見える状態を用意する基準。outline などのスタイルでフォーカスの表示を消すのは失敗例 F78。:focus-visible で表示する手法 C45 |
| `w3c-understanding-focus-not-obscured-minimum` | 公式・法令・規格 | [W3C Web Accessibility Initiative（WAI）（WCAG 2.2 の解説）Understanding Success Criterion 2.4.11: Focus Not Obscured (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) | 2026-10-30 | 2.4.11（AA、2.2 で追加）は、フォーカスを受けた部品が、作り手の置いた物で全部隠れないようにする基準。原因の例は固定のヘッダーやフッター・クッキーの帯など。一部が隠れるだけなら満たすが、隠れる量は減らすべき（一部も隠さないのは 2.4.12、AAA）。CSS の scroll-padding の手法 C43、固定の帯で全部隠れる失敗例 F110 |
| `w3c-understanding-target-size-minimum` | 公式・法令・規格 | [W3C Web Accessibility Initiative（WAI）（WCAG 2.2 の解説）Understanding Success Criterion 2.5.8: Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | 2026-10-30 | 2.5.8（AA、2.2 で追加）は、ポインタで押す所を 24×24 CSS ピクセル以上にする基準。例外は、間隔（ターゲットの中心に合わせて直径 24 CSS ピクセルの円を描き、ほかのターゲットや円と重ならない）・同等・インライン・ユーザエージェントによる制御・必要不可欠。24 は最低限で、大きいほど多くの人が使いやすい |
| `w3c-wcag22-iso` | 公式・法令・規格 | [W3C Web Accessibility Initiative（WAI）（2025-10-21）WCAG 2.2 Approved as an ISO Standard](https://www.w3.org/WAI/news/2025-10-21/wcag22-iso) | 2026-10-30 | WCAG 2.2 が国際規格 ISO/IEC 40500:2025 として承認されたというお知らせ。ISO から無料で入手できる、とある |
| `waic-jis-news-2026` | 公式・法令・規格 | [ウェブアクセシビリティ基盤委員会（WAIC）（2026（お知らせの一覧では 2026-09-28））JIS X 8341-3とは何なのか？ ウェブコンテンツのアクセシビリティのために](https://waic.jp/news/news-7938/) | 2026-10-30 | 解説の動画と書き起こし。JIS X 8341-3:2016 は ISO/IEC 40500:2012 の一致規格で、WCAG 2.0 と技術的に同等。もとの ISO の規格が 2025 年 9 月に改訂されたのを受けて JIS も改正する見込みで、順調なら 2027 年、遅くとも 2028 年。改正後はガイドラインが 13 に、達成基準が 26 増える見込み。AA は国内外の公的機関などで求められる水準、という説明 |
| `cao-kihon-houshin-2023` | 公式・法令・規格 | [内閣府（2023 年 3 月 14 日閣議決定）（2023）障害を理由とする差別の解消の推進に関する基本方針](https://www8.cao.go.jp/shougai/suishin/sabekai/kihonhoushin/r05/pdf/honbun.pdf) | 2026-10-30 | 環境の整備は、不特定多数の障害者を主な対象とする事前的改善措置（施設や設備のバリアフリー化、人的支援、情報アクセシビリティの向上など）で、行政機関等と事業者の努力義務。合理的配慮は、環境の整備を基礎に個別の状況に応じて行う措置。例として、使いにくいウェブサイトの手続きに電話やメールで対応し（合理的配慮の提供）、以後サイトを改良する（環境の整備）場面を挙げ、両輪で進めるのが重要とする（内閣府のページにある同じ内容のテキスト版で確かめた） |
| `w3c-apg-button` | 公式・法令・規格 | [W3C Web Accessibility Initiative（WAI）（—）Button Pattern（WAI-ARIA Authoring Practices Guide）](https://www.w3.org/WAI/ARIA/apg/patterns/button/) | 2026-10-30 | ボタンにフォーカスがあるとき、Space でも Enter でも押せる。名前はふつう中の文字から決まり、aria-label などでも付けられる |
| `mdn-button-role` | 実務の指針 | [MDN Web Docs（Mozilla）（2026-08-21 更新）ARIA: button role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/button_role) | 2026-10-30 | できる限り button 要素などの元からあるボタンを使う（キーボードとフォーカスの動きが最初から入っている）。role="button" は意味を伝えるだけで、div などに付けるなら tabindex="0" と、Enter と Space のキーの処理を自分で足す。ボタンには必ず名前が要る |
| `w3c-apg-read-me-first` | 公式・法令・規格 | [W3C Web Accessibility Initiative（WAI）（—）Read Me First（WAI-ARIA Authoring Practices Guide）](https://www.w3.org/WAI/ARIA/apg/practices/read-me-first/) | 2026-10-30 | 「No ARIA is better than Bad ARIA」。間違った ARIA は支援技術の利用者に画面を偽って伝えるので、ないより悪いことがある。role は約束で、div に role="button" を付けたら、ボタンに期待されるキーボードの動きを JavaScript で作る必要がある（role だけではブラウザは動きを足さない） |
| `w3c-easy-checks` | 公式・法令・規格 | [W3C Web Accessibility Initiative（WAI）（2024-03-21 更新）Easy Checks – A First Review of Web Accessibility](https://www.w3.org/WAI/test-evaluate/easy-checks/) | 2026-10-30 | 最初の点検の項目（ページの題・画像の代替テキスト・コントラスト・拡大・キーボードのフォーカスが見えるか・ラベル・必須の欄・見出し など）。手早い点検で網羅的ではなく、通っても大きな問題が残ることがある、と書く |
| `nng-heuristic-evaluation` | 実務の指針 | [Kate Moran, Kelley Gordon（Nielsen Norman Group）（2023）How to Conduct a Heuristic Evaluation](https://www.nngroup.com/articles/how-to-conduct-a-heuristic-evaluation/) | 2026-10-30 | 経験則（ヒューリスティクス）で画面を点検する進め方。腕のある人でも見落とすので、3〜5 人がそれぞれ別々に点検し、終わってから持ち寄る。点検は利用者のリサーチの代わりにはならず、テストで確かめる所の目印になる（2023-06-25 公開） |
| `nng-severity-ratings` | 実務の指針 | [Jakob Nielsen（Nielsen Norman Group）（1994）Severity Ratings for Usability Problems](https://www.nngroup.com/articles/how-to-rate-the-severity-of-usability-problems/) | 2026-10-30 | 問題の深刻度は、頻度・影響（乗り越えにくさ）・繰り返し（一度で慣れるか、毎回困るか）に市場への影響を加えて決め、0（問題ではない）〜4（出す前に必ず直す）で表す。点検の最中ではなく後で付ける。1 人の点はぶれるので、3 人の平均で多くの場合は足りるとする |
| `nng-paper-prototyping` | 実務の指針 | [Jakob Nielsen（Nielsen Norman Group）（2003）Paper Prototyping: Getting User Data Before You Code](https://www.nngroup.com/articles/paper-prototyping/) | 2026-10-30 | 紙の試作で、作る前に利用者のテストをする方法。最も速く安い手法の 1 つで、粗い試作でも役に立つ。早い段階で見つけるほど直すのが安い（2003-04-13 公開） |
| `nng-prototype-fidelity` | 実務の指針 | [Kara Pernice（Nielsen Norman Group）（2016）UX Prototypes: Low Fidelity vs. High Fidelity](https://www.nngroup.com/articles/ux-prototype-hi-lo-fidelity/) | 2026-10-30 | 試作の作り込みは、操作・見た目・中身の 3 つの軸で決まる。粗い試作では人が「コンピューターの役」をし、直しやすく、参加者が遠慮なく意見を言いやすく、作り手も手放しやすい。流れの細部・動く部品・読みやすさ・反応の速さを確かめるなら作り込んだ試作が向く（2016-12-18 公開） |
| `nng-task-scenarios` | 実務の指針 | [Marieke McCloskey（Nielsen Norman Group）（2014）Turn User Goals into Task Scenarios for Usability Testing](https://www.nngroup.com/articles/task-scenarios-usability-testing/) | 2026-10-30 | テストのタスクは、現実にありそうで、実際に操作してもらう形にし、手順のヒントや画面の言葉（ボタンの名前など）を入れない。名前や日付など、やり切るのに必要な情報は入れる（2014-01-12 公開） |
| `nng-leading-questions` | 実務の指針 | [Amy Schade（Nielsen Norman Group）（2017）Avoid Leading Questions to Get Better Insights from Participants](https://www.nngroup.com/articles/leading-questions/) | 2026-10-30 | 答えを含む・ほのめかす質問（誘導する質問）では、参加者が言葉や意見を合わせ、確かめるのではなく思い込みを裏付けるだけになる。原因や気持ちを決めつけず、画面の部品の名前を出さず、やりやすさ・やりにくさを中立に、開いた質問で聞く（2017-12-17 公開） |
| `sauro-assistance-2017` | 実務の指針 | [Jeff Sauro（MeasuringU）（2017）When to Provide Assistance in a Usability Test](https://measuringu.com/usability-assistance/) | 2026-10-30 | 助けに入るのは、同じ所で行き詰まって本当に先へ進めない・時間が足りない・データが消えるなどの事故が起きそうなとき。助けたら回数・理由・程度を記録し、完了の数は助けありと助けなしを分けて出せる。助けは少ないほどよい（2017-08-30 公開） |

台本と図は、ISO 9241-210・ISO 9241-11、W3C の WCAG、Nielsen Norman Group の解説などをもとに作成（2026 年 10 月確認）。サンプル予約は架空のサービスで、数字は説明用の仮の例です
