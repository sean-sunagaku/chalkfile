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
| 2 | `uiux-02` | `D02` | 目的と流れ | ユーザーの目的と情報設計 | 何を、どんな言葉で、どうまとめて見せるか？ | 8 分 | 計画 |
| 3 | `uiux-03` | `D03` | 目的と流れ | 操作の流れとナビゲーション | 迷わず進み、間違えても戻れる流れをどう作るか？ | 8 分 | 計画 |
| 4 | `uiux-04` | `D04` | 見た目の基本 | 視覚的な優先順位・余白・文字 | 一番大事なものが、一目で分かる画面にするには？ | 8 分 | 計画 |
| 5 | `uiux-05` | `D05` | 見た目の基本 | 色とコントラスト | 色を、意味が伝わり、誰にでも読める形で使うには？ | 8 分 | 計画 |
| 6 | `uiux-06` | `D06` | フォームとアクセシビリティ | フォームとエラー表示 | 入力の手間と間違いを減らし、間違えたらすぐ直せるフォームとは？ | 9 分 | 計画 |
| 7 | `uiux-07` | `D07` | フォームとアクセシビリティ | アクセシビリティ: 誰でも使える画面 | 見え方・使い方が違う人も、同じように使えるようにするには？ | 9 分 | 計画 |
| 8 | `uiux-08` | `D08` | 実践 | 実践: 1 画面を改善して確かめる | 問題を見つけ、直し、本当に良くなったかを確かめるには？ | 10 分 | 計画 |

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

- ISO（2019）「ISO 9241-210:2019 Ergonomics of human-system interaction — Part 210: Human-centred design for interactive systems」 https://www.iso.org/standard/77520.html （公式・法令・規格・2026-10-30 確認）
- Jakob Nielsen（Nielsen Norman Group）（1994（2020 年改訂・2024 年見直し））「10 Usability Heuristics for User Interface Design」 https://www.nngroup.com/articles/ten-usability-heuristics/ （実務の指針・2026-10-30 確認）

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

- Aurora Harley（Nielsen Norman Group）（2020）「Proximity Principle in Visual Design」 https://www.nngroup.com/articles/gestalt-proximity/ （実務の指針・2026-10-30 確認）

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
- GOV.UK（英国政府）（—）「Error message（GOV.UK Design System）」 https://design-system.service.gov.uk/components/error-message/ （公式・法令・規格・2026-10-30 確認）
- Tim Neusesser, Evan Sunwall（Nielsen Norman Group）（2023）「Error-Message Guidelines」 https://www.nngroup.com/articles/error-message-guidelines/ （実務の指針・2026-10-30 確認）

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
- 情報通信アクセス協議会 ウェブアクセシビリティ基盤委員会（WAIC）（2016）「JIS X 8341-3:2016 解説」 https://waic.jp/docs/jis2016/understanding/201604/ （公式・法令・規格・2026-10-30 確認）
- 内閣府（2024 年 4 月 1 日施行の改正）「障害を理由とする差別の解消の推進」 https://www8.cao.go.jp/shougai/suishin/sabekai.html （公式・法令・規格・2026-10-30 確認）
- デジタル庁（2025-10-16 更新）「ウェブアクセシビリティ導入ガイドブック」 https://www.digital.go.jp/resources/introduction-to-web-accessibility-guidebook （公式・法令・規格・2026-10-30 確認）

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
- ISO（2019）「ISO 9241-210:2019 Ergonomics of human-system interaction — Part 210: Human-centred design for interactive systems」 https://www.iso.org/standard/77520.html （公式・法令・規格・2026-10-30 確認）

## 出典の一覧

| ID | 種類 | 出典 | 確認日 | 何を確かめたか |
| --- | --- | --- | --- | --- |
| `iso-9241-210-2019` | 公式・法令・規格 | [ISO（2019）ISO 9241-210:2019 Ergonomics of human-system interaction — Part 210: Human-centred design for interactive systems](https://www.iso.org/standard/77520.html) | 2026-10-30 | 3.15 user experience の定義（システム・製品・サービスの利用や利用の予想から生じる利用者の知覚と反応。使う前・間・後に生じる）と、5 章の人間中心設計の 6 つの原則（利用者・タスク・環境の理解、利用者を交えた評価、繰り返し など） |
| `iso-9241-11-2018` | 公式・法令・規格 | [ISO（2018）ISO 9241-11:2018 Ergonomics of human-system interaction — Part 11: Usability: Definitions and concepts](https://www.iso.org/standard/63500.html) | 2026-10-30 | 3.1.1 usability の定義（特定の利用者が特定の利用状況で、効果・効率・満足を伴って特定の目標を達成できる度合い）。日本の JIS Z 8521:2020 はこれを基にした規格（修正あり）で、訳語は「効果・効率・満足」 |
| `nng-10-heuristics` | 実務の指針 | [Jakob Nielsen（Nielsen Norman Group）（1994（2020 年改訂・2024 年見直し））10 Usability Heuristics for User Interface Design](https://www.nngroup.com/articles/ten-usability-heuristics/) | 2026-10-30 | 10 のユーザビリティ・ヒューリスティクス（システムの状態を見せる・現実の世界に合わせる・記憶より見て分かる・エラーを防ぐ など）。具体的なガイドラインではなく大まかな経験則と明記 |
| `nng-ux-definition` | 実務の指針 | [Don Norman, Jakob Nielsen（Nielsen Norman Group）（1998）The Definition of User Experience (UX)](https://www.nngroup.com/articles/definition-user-experience/) | 2026-10-30 | UX は会社・サービス・製品と利用者のやりとりのすべてで、UI は大事な一部だが UI が良くても良い UX になるとは限らない、という説明 |
| `nng-thinking-aloud` | 実務の指針 | [Jakob Nielsen（Nielsen Norman Group）（2012）Thinking Aloud: The #1 Usability Tool](https://www.nngroup.com/articles/thinking-aloud-the-1-usability-tool/) | 2026-10-30 | 利用者に考えを声に出してもらいながら使ってもらう思考発話法の説明。Nielsen はユーザビリティの一番の道具と位置づけ、万能ではない・統計的な比較には向かないとも書く |
| `nng-5-users` | 実務の指針 | [Jakob Nielsen（Nielsen Norman Group）（2000）Why You Only Need to Test with 5 Users](https://www.nngroup.com/articles/why-you-only-need-to-test-with-5-users/) | 2026-10-30 | 1 人が見つける問題の割合を約 31% と置くモデルでは 5 人で約 85%。利用者層が同じ・問題を見つける定性テスト・繰り返すことが前提 |
| `nng-gestalt-proximity` | 実務の指針 | [Aurora Harley（Nielsen Norman Group）（2020）Proximity Principle in Visual Design](https://www.nngroup.com/articles/gestalt-proximity/) | 2026-10-30 | 近くにあるものは一つのまとまりに見える（ゲシュタルトの近接の原則）と、画面への当てはめ方。整列はゲシュタルトの原則ではなくグリッドの話 |
| `nng-error-messages` | 実務の指針 | [Tim Neusesser, Evan Sunwall（Nielsen Norman Group）（2023）Error-Message Guidelines](https://www.nngroup.com/articles/error-message-guidelines/) | 2026-10-30 | エラーは原因のそばに出し（色だけに頼らない）、具体的に・責めずに伝え、直し方や候補を示し、入力を残す |
| `govuk-error-message` | 公式・法令・規格 | [GOV.UK（英国政府）（—）Error message（GOV.UK Design System）](https://design-system.service.gov.uk/components/error-message/) | 2026-10-30 | エラーは入力欄の近くに出し、何が起きて・どう直すかを具体的に書く、という政府のサービスの指針 |
| `wcag-22` | 公式・法令・規格 | [W3C（2023（2024-12-12 更新））Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG22/) | 2026-10-30 | コントラスト比（本文 4.5:1）・色だけに頼らない・ターゲットのサイズ・エラーの特定・ラベルなどの達成基準 |
| `jis-x-8341-3` | 公式・法令・規格 | [情報通信アクセス協議会 ウェブアクセシビリティ基盤委員会（WAIC）（2016）JIS X 8341-3:2016 解説](https://waic.jp/docs/jis2016/understanding/201604/) | 2026-10-30 | JIS X 8341-3:2016 は ISO/IEC 40500:2012（WCAG 2.0）と一致する規格。WCAG 2.2 に合わせる改正原案を作成中（2026-10 時点で未公示） |
| `cao-sabetsu-kaisho` | 公式・法令・規格 | [内閣府（2024 年 4 月 1 日施行の改正）障害を理由とする差別の解消の推進](https://www8.cao.go.jp/shougai/suishin/sabekai.html) | 2026-10-30 | 改正法（2024-04-01 施行）で、事業者による合理的配慮の提供が義務になった（第 8 条 2 項）。ウェブの改善などの環境の整備は努力義務（第 5 条） |
| `digital-a11y-guidebook` | 公式・法令・規格 | [デジタル庁（2025-10-16 更新）ウェブアクセシビリティ導入ガイドブック](https://www.digital.go.jp/resources/introduction-to-web-accessibility-guidebook) | 2026-10-30 | ウェブアクセシビリティの考え方と、導入の進め方の入門 |
| `faulkner-2003` | 研究・学術 | [Laura Faulkner（Behavior Research Methods, Instruments, & Computers 35）（2003）Beyond the five-user assumption: Benefits of increased sample sizes in usability testing](https://doi.org/10.3758/BF03195514) | 2026-10-30 | 60 人のデータから 5 人組を選ぶと、見つかる問題の割合は 55〜99% とばらついた。5 人で必ず 85% とは言えない根拠 |
| `nng-placeholders` | 実務の指針 | [Katie Sherwin（Nielsen Norman Group）（2014）Placeholders in Form Fields Are Harmful](https://www.nngroup.com/articles/form-design-placeholders/) | 2026-10-30 | 入力欄の中の薄い文字（プレースホルダー）をラベル代わりにすると、入力で消えて記憶の負担になる・見直せない・コントラストが低い・読み上げない支援技術がある。ラベルは欄の外に常に見えるように置く |
| `hornbaek-law-2007` | 研究・学術 | [Kasper Hornbæk, Effie Lai-Chong Law（CHI 2007）（2007）Meta-Analysis of Correlations Among Usability Measures](https://www.kasperhornbaek.dk/papers/CHI2007_MetaAnalysis.pdf) | 2026-10-30 | 73 の研究の分析で、有効さ・効率・満足の数字どうしの相関は全体に低い。3 つは別々に測るべきという主張を支える（著者の公開原稿） |

台本と図は、ISO 9241-210・ISO 9241-11、W3C の WCAG、Nielsen Norman Group の解説などをもとに作成（2026 年 10 月確認）。サンプル予約は架空のサービスで、数字は説明用の仮の例です
