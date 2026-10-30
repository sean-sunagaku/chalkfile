import type { Lecture, Source } from '../types';

/**
 * UI・UX 講座の出典。checked は出典を開いて確かめた日。
 * 規格・法令・公式ガイドライン（official）、研究（research）、専門機関や実務家の指針（practice）を分けて書く。
 */
export const UIUX_SOURCES: Source[] = [
  {
    id: 'iso-9241-210-2019',
    title: 'ISO 9241-210:2019 Ergonomics of human-system interaction — Part 210: Human-centred design for interactive systems',
    url: 'https://www.iso.org/standard/77520.html',
    publisher: 'ISO',
    year: '2019',
    kind: 'official',
    checked: '2026-10-30',
    note: '3.15 user experience の定義（システム・製品・サービスの利用や利用の予想から生じる利用者の知覚と反応。使う前・間・後に生じる）と、5 章の人間中心設計の 6 つの原則（利用者・タスク・環境の理解、利用者を交えた評価、繰り返し など）'
  },
  {
    id: 'iso-9241-11-2018',
    title: 'ISO 9241-11:2018 Ergonomics of human-system interaction — Part 11: Usability: Definitions and concepts',
    url: 'https://www.iso.org/standard/63500.html',
    publisher: 'ISO',
    year: '2018',
    kind: 'official',
    checked: '2026-10-30',
    note: '3.1.1 usability の定義（特定の利用者が特定の利用状況で、効果・効率・満足を伴って特定の目標を達成できる度合い）。日本の JIS Z 8521:2020 はこれを基にした規格（修正あり）で、訳語は「効果・効率・満足」'
  },
  {
    id: 'nng-10-heuristics',
    title: '10 Usability Heuristics for User Interface Design',
    url: 'https://www.nngroup.com/articles/ten-usability-heuristics/',
    publisher: 'Jakob Nielsen（Nielsen Norman Group）',
    year: '1994（2020 年改訂・2024 年見直し）',
    kind: 'practice',
    checked: '2026-10-30',
    note: '10 のユーザビリティ・ヒューリスティクス（システムの状態を見せる・現実の世界に合わせる・記憶より見て分かる・エラーを防ぐ など）。具体的なガイドラインではなく大まかな経験則と明記',
  },
  {
    id: 'nng-ux-definition',
    title: 'The Definition of User Experience (UX)',
    url: 'https://www.nngroup.com/articles/definition-user-experience/',
    publisher: 'Don Norman, Jakob Nielsen（Nielsen Norman Group）',
    year: '1998',
    kind: 'practice',
    checked: '2026-10-30',
    note: 'UX は会社・サービス・製品と利用者のやりとりのすべてで、UI は大事な一部だが UI が良くても良い UX になるとは限らない、という説明'
  },
  {
    id: 'nng-thinking-aloud',
    title: 'Thinking Aloud: The #1 Usability Tool',
    url: 'https://www.nngroup.com/articles/thinking-aloud-the-1-usability-tool/',
    publisher: 'Jakob Nielsen（Nielsen Norman Group）',
    year: '2012',
    kind: 'practice',
    checked: '2026-10-30',
    note: '利用者に考えを声に出してもらいながら使ってもらう思考発話法の説明。Nielsen はユーザビリティの一番の道具と位置づけ、万能ではない・統計的な比較には向かないとも書く',
  },
  {
    id: 'nng-5-users',
    title: 'Why You Only Need to Test with 5 Users',
    url: 'https://www.nngroup.com/articles/why-you-only-need-to-test-with-5-users/',
    publisher: 'Jakob Nielsen（Nielsen Norman Group）',
    year: '2000',
    kind: 'practice',
    checked: '2026-10-30',
    note: '1 人が見つける問題の割合を約 31% と置くモデルでは 5 人で約 85%。利用者層が同じ・問題を見つける定性テスト・繰り返すことが前提'
  },
  {
    id: 'nng-gestalt-proximity',
    title: 'Proximity Principle in Visual Design',
    url: 'https://www.nngroup.com/articles/gestalt-proximity/',
    publisher: 'Aurora Harley（Nielsen Norman Group）',
    year: '2020',
    kind: 'practice',
    checked: '2026-10-30',
    note: '近くにあるものは一つのまとまりに見える（ゲシュタルトの近接の原則）と、画面への当てはめ方。整列はゲシュタルトの原則ではなくグリッドの話',
  },
  {
    id: 'nng-error-messages',
    title: 'Error-Message Guidelines',
    url: 'https://www.nngroup.com/articles/error-message-guidelines/',
    publisher: 'Tim Neusesser, Evan Sunwall（Nielsen Norman Group）',
    year: '2023',
    kind: 'practice',
    checked: '2026-10-30',
    note: 'エラーは原因のそばに出し（色だけに頼らない）、具体的に・責めずに伝え、直し方や候補を示し、入力を残す',
  },
  {
    id: 'govuk-error-message',
    title: 'Error message（GOV.UK Design System）',
    url: 'https://design-system.service.gov.uk/components/error-message/',
    publisher: 'GOV.UK（英国政府）',
    year: '—',
    kind: 'official',
    checked: '2026-10-30',
    note: 'エラーは入力欄の近くに出し、何が起きて・どう直すかを具体的に書く、という政府のサービスの指針',
  },
  {
    id: 'wcag-22',
    title: 'Web Content Accessibility Guidelines (WCAG) 2.2',
    url: 'https://www.w3.org/TR/WCAG22/',
    publisher: 'W3C',
    year: '2023（2024-12-12 更新）',
    kind: 'official',
    checked: '2026-10-30',
    note: 'コントラスト比（本文 4.5:1）・色だけに頼らない・ターゲットのサイズ・エラーの特定・ラベルなどの達成基準',
  },
  {
    id: 'jis-x-8341-3',
    title: 'JIS X 8341-3:2016 解説',
    url: 'https://waic.jp/docs/jis2016/understanding/201604/',
    publisher: '情報通信アクセス協議会 ウェブアクセシビリティ基盤委員会（WAIC）',
    year: '2016',
    kind: 'official',
    checked: '2026-10-30',
    note: 'JIS X 8341-3:2016 は ISO/IEC 40500:2012（WCAG 2.0）と一致する規格。WCAG 2.2 に合わせる改正原案を作成中（2026-10 時点で未公示）',
  },
  {
    id: 'cao-sabetsu-kaisho',
    title: '障害を理由とする差別の解消の推進',
    url: 'https://www8.cao.go.jp/shougai/suishin/sabekai.html',
    publisher: '内閣府',
    year: '2024 年 4 月 1 日施行の改正',
    kind: 'official',
    checked: '2026-10-30',
    note: '改正法（2024-04-01 施行）で、事業者による合理的配慮の提供が義務になった（第 8 条 2 項）。ウェブの改善などの環境の整備は努力義務（第 5 条）'
  },
  {
    id: 'digital-a11y-guidebook',
    title: 'ウェブアクセシビリティ導入ガイドブック',
    url: 'https://www.digital.go.jp/resources/introduction-to-web-accessibility-guidebook',
    publisher: 'デジタル庁',
    year: '2025-10-16 更新',
    kind: 'official',
    checked: '2026-10-30',
    note: 'ウェブアクセシビリティの考え方と、導入の進め方の入門',
  },
  {
    id: 'faulkner-2003',
    title: 'Beyond the five-user assumption: Benefits of increased sample sizes in usability testing',
    url: 'https://doi.org/10.3758/BF03195514',
    publisher: 'Laura Faulkner（Behavior Research Methods, Instruments, & Computers 35）',
    year: '2003',
    kind: 'research',
    checked: '2026-10-30',
    note: '60 人のデータから 5 人組を選ぶと、見つかる問題の割合は 55〜99% とばらついた。5 人で必ず 85% とは言えない根拠',
  },
  {
    id: 'nng-placeholders',
    title: 'Placeholders in Form Fields Are Harmful',
    url: 'https://www.nngroup.com/articles/form-design-placeholders/',
    publisher: 'Katie Sherwin（Nielsen Norman Group）',
    year: '2014',
    kind: 'practice',
    checked: '2026-10-30',
    note: '入力欄の中の薄い文字（プレースホルダー）をラベル代わりにすると、入力で消えて記憶の負担になる・見直せない・コントラストが低い・読み上げない支援技術がある。ラベルは欄の外に常に見えるように置く',
  },
  {
    id: 'hornbaek-law-2007',
    title: 'Meta-Analysis of Correlations Among Usability Measures',
    url: 'https://www.kasperhornbaek.dk/papers/CHI2007_MetaAnalysis.pdf',
    publisher: 'Kasper Hornbæk, Effie Lai-Chong Law（CHI 2007）',
    year: '2007',
    kind: 'research',
    checked: '2026-10-30',
    note: '73 の研究の分析で、有効さ・効率・満足の数字どうしの相関は全体に低い。3 つは別々に測るべきという主張を支える（著者の公開原稿）',
  },
];

/** 出典の id から、講座サイトの「出典・参考資料」タブに出す形にする */
export const docsOf = (ids: string[]): Lecture['docs'] =>
  ids.map((id) => {
    const s = UIUX_SOURCES.find((x) => x.id === id);
    if (!s) throw new Error(`出典が無い: ${id}`);
    return { title: `${s.publisher}（${s.year}）${s.title}`, url: s.url };
  });
