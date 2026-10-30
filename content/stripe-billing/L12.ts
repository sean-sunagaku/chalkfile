import type { Lecture } from '../types';

export const L12: Lecture = {
  id: 'L12',
  no: 12,
  section: { no: 4, title: 'お金・法律・iOS' },
  title: 'iOS アプリとの関係',
  summary: 'App Store の課金ルール（3.1.1・3.1.3(b)）、日本の外部リンク、Web だけ・アプリ内課金も・外部リンクの 3 つの売り方と、データの持ち方。',
  docs: [
    { title: 'Apple: App Store Review Guidelines（3.1 支払い）', url: 'https://developer.apple.com/app-store/review/guidelines/#payments' },
    { title: 'Apple: 日本でのアプリの配信（代替決済とリンクアウト）', url: 'https://developer.apple.com/support/app-distribution-in-japan/' },
    { title: 'Apple: App Store Server Notifications', url: 'https://developer.apple.com/documentation/appstoreservernotifications' },
  ],
  quiz: [
    {
      q: 'iOS アプリの中で機能を開ける購読は、原則として？',
      choices: ['Stripe の Checkout', 'アプリ内課金（IAP）', '銀行振込', '何でもよい'],
      answer: 1,
      explain: 'ガイドライン 3.1.1。アプリの中で機能やコンテンツを開けるなら、原則アプリ内課金を使う。',
    },
    {
      q: 'Web で買った購読をアプリでも使わせる条件（3.1.3(b)）は？',
      choices: ['条件なし', '同じものをアプリ内課金でも売っていること', 'アプリに価格を書くこと', 'Android でも売ること'],
      answer: 1,
      explain: '他の場所で買った購読をアプリで使わせるのは可能だが、同じものをアプリ内課金でも提供していることが条件。',
    },
    {
      q: 'Web と iOS の両方で売るとき、契約の写しはどう持つ？',
      choices: ['別々の DB に分ける', 'source 列で「どこで買った契約か」を分けて同じ表に', '持たない', 'Stripe にアプリ内課金を入れる'],
      answer: 1,
      explain: 'stripe と apple の契約を同じ表に並べれば、使えるかの判定関数は変えずに足せる。',
    },
  ],
  caution: 'App Store のルールと手数料は変わります。Apple の最新のガイドラインで確かめてください',
  takeaways: [
    '3.1.1：アプリ内で機能を開ける購読は、原則アプリ内課金',
    '3.1.3(b)：他で買った購読をアプリで使わせるのは、アプリ内課金でも売っていることが条件',
    '日本では 2025-12-17（iOS 26.2 以降）から、アプリ内の別の決済（アプリ内課金と並べて出す）と、Web の購入ページへのリンクができる',
    'Apple の手数料（2026-10 時点）：リンクアウト 15%、アプリ内の別の決済 21%。小規模事業者やサブスクの 2 年目以降は 10%。リンクアウトはタップから 7 日以内の購入が対象',
    '契約の写しに source（stripe / apple）を持たせると、判定関数を変えずに足せる',
    'ルールと手数料は変わりやすい。アプリに載せる前に、Apple の最新のガイドラインで確かめる',
  ],
  scenes: [
    {
      kind: 'opening',
      section: 'SECTION 4　お金・法律・iOS',
      title: 'iOS アプリとの関係',
      subtitle: 'App Store のルールと 3 つの売り方',
      lines: [
        { t: 'レクチャー12。iOS アプリとの関係。', v: 'announcer', pause: 0.3 },
        { t: 'Web で売るサブスクと、iOS アプリの関係を整理します。ここは、ルールを知らないと、アプリの審査で止まるところです。' },
      ],
    },
    {
      kind: 'goals',
      heading: 'このレクチャーのゴール',
      items: [
        { text: 'App Store の課金のルールが分かる', at: 1 },
        { text: 'Web で買った人をアプリで扱う条件が分かる', at: 2 },
        { text: '3 つの売り方と、データの持ち方が分かる', at: 3 },
      ],
      lines: [
        { t: 'ゴールは三つです。' },
        { t: 'App Store の、課金のルール。', sfx: 'pop' },
        { t: 'Web で買った人を、アプリで扱うときの条件。', sfx: 'pop' },
        { t: 'そして、三つの売り方と、データの持ち方です。', sfx: 'pop' },
      ],
    },
    {
      kind: 'table',
      heading: 'iOS アプリと課金のルール',
      columns: ['ルール', '内容'],
      widths: [0.26, 0.74],
      rows: [
        { cells: ['3.1.1', 'アプリ内で機能を解放する購読は App 内課金（IAP）'], at: 1, tone: 'slate' },
        { cells: ['3.1.3(b)', 'Web で買った購読をアプリで使わせるのは可（IAP でも売ることが条件）'], at: 2, tone: 'cyan' },
        { cells: ['日本（2025 年 12 月〜）', 'アプリ内の別の決済や、Web の購入ページへのリンクができる（Apple の手数料あり）'], at: 3, tone: 'amber' },
      ],
      lines: [
        { t: 'まず、Apple の App Store の、課金のルールです。' },
        { t: 'アプリの中で機能を解放する購読は、原則、App 内課金を使うこと。' },
        { t: 'Web で買った購読を、アプリで使わせるのは可能です。ただし、同じものを App 内課金でも売っていることが条件です。' },
        { t: '日本では 2025 年 12 月から、アプリの中で別の決済を使ったり、Web の購入ページへリンクしたりできるようになりました。ただし、どちらにも Apple の手数料がかかります。' },
      ],
    },
    {
      kind: 'table',
      heading: '3 つの売り方',
      columns: ['売り方', '中身', '気をつけること'],
      widths: [0.24, 0.38, 0.38],
      fontSize: 28,
      rows: [
        { cells: ['Web だけで売る', 'アプリに購入の導線・価格を出さない', 'アプリで使わせるなら 3.1.3(b)'], at: 1, tone: 'cyan' },
        { cells: ['アプリ内課金も売る', 'App Store でも同じプランを売る', 'Apple の手数料・通知は App Store から'], at: 2, tone: 'violet' },
        { cells: ['外部リンク（日本）', 'アプリから Web の購入ページへ', '申請と、Apple への手数料（15%）'], at: 3, tone: 'amber' },
      ],
      lines: [
        { t: 'すると、売り方は三つに分かれます。' },
        { t: '一つ目、Web だけで売る。アプリの中には、購入の導線も、価格も、有料の案内も出しません。ただし、Web で買った Pro をアプリでも使わせるなら、さっきの 3.1.3(b) の条件を確かめる必要があります。' },
        { t: '二つ目、アプリ内課金でも売る。App Store で同じプランを売り、契約の通知は、App Store から受け取ります。' },
        { t: '三つ目、日本なら、アプリから Web の購入ページへリンクする。申請が必要で、手数料は、2026 年 10 月時点で十五パーセント。小規模の事業者や、サブスクの二年目からは、十パーセントです。' },
      ],
    },
    {
      kind: 'big',
      heading: '契約の出どころを列で分ける',
      kicker: 'Web と iOS の両方で売るとき',
      text: '契約の写しに **source** を持たせる',
      textAt: 1,
      sub: 'stripe と apple を同じ表に並べれば、判定関数は変えずに足せる',
      subAt: 2,
      tone: 'violet',
      icon: 'layers',
      lines: [
        { t: 'アプリ内課金でも売ることにしたら、データはどう持てばよいでしょう。' },
        { t: '契約の写しに、source という列を足して、どこで買った契約かを分けます。Web なら stripe、iOS なら apple。', s: '契約の写しに、ソースという列を足して、どこで買った契約かを分けます。ウェブなら、ストライプ。アイオーエスなら、アップル。', sfx: 'chime' },
        { t: '同じ表に並べておけば、使えるかの判定関数は、そのまま使えます。違うのは、iOS の契約の通知が、Stripe ではなく App Store から届くことだけです。' },
      ],
    },
    {
      kind: 'recap',
      heading: 'まとめ',
      items: [
        { text: '3.1.1：アプリ内で開けるなら、原則アプリ内課金', at: 1 },
        { text: '3.1.3(b)：他で買った購読は、アプリ内課金でも売るのが条件', at: 2 },
        { text: '売り方は 3 つ。source 列で同じ表に並べられる', at: 3 },
      ],
      lines: [
        { t: 'まとめです。' },
        { t: 'アプリの中で機能を開けるなら、原則、App 内課金。', sfx: 'pop' },
        { t: 'ほかで買った購読をアプリで使わせるなら、App 内課金でも売っていることが条件です。', sfx: 'pop' },
        { t: '売り方は三つ。どれを選んでも、source の列で、同じ表に並べられます。', s: '売り方は三つ。どれを選んでも、ソースの列で、同じ表に並べられます。', sfx: 'pop' },
      ],
    },
    {
      kind: 'ending',
      next: { no: 13, title: '総まとめ　よくある誤解クイズ' },
      lines: [{ t: '次が最後のレクチャー。よくある誤解を、クイズで一気に潰しましょう。' }],
    },
  ],
};
