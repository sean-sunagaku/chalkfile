import type { Lecture } from '../types';

export const L05: Lecture = {
  id: 'L05',
  no: 5,
  section: { no: 2, title: 'Stripe の概念とデータ' },
  title: '請求書と支払い',
  summary: 'Invoice の 5 つの状態、毎月の請求で起きること、billing_reason、請求書から契約をたどる方法、支払いの失敗と追加の認証。',
  docs: [
    { title: 'Stripe: サブスクリプションの請求書', url: 'https://docs.stripe.com/billing/invoices/subscription' },
    { title: 'Stripe: 請求書の流れ（ステータス）', url: 'https://docs.stripe.com/invoicing/overview' },
    { title: 'Stripe API: Invoice オブジェクト', url: 'https://docs.stripe.com/api/invoices/object' },
    { title: 'Stripe: 支払いの再試行（Smart Retries）', url: 'https://docs.stripe.com/billing/revenue-recovery/smart-retries' },
  ],
  quiz: [
    {
      q: '支払いが済んだ請求書の status は？',
      choices: ['open', 'paid', 'void', 'draft'],
      answer: 1,
      explain: 'draft（下書き）→ open（確定・支払い待ち）→ paid（支払い済み）。取り消しは void、回収できないときは uncollectible。',
    },
    {
      q: '毎月の更新で作られた請求書の billing_reason は？',
      choices: ['subscription_create', 'subscription_cycle', 'subscription_update', 'manual'],
      answer: 1,
      explain: '最初の請求書は subscription_create、毎回の更新は subscription_cycle、プラン変更ですぐ請求するときは subscription_update。',
    },
    {
      q: '更新の支払いで 3D セキュアの追加認証が必要になったときに届くのは？',
      choices: ['invoice.paid', 'invoice.payment_action_required', 'customer.deleted', 'checkout.session.expired'],
      answer: 1,
      explain: 'ユーザーに認証してもらうまで支払いは終わらない。Stripe のメールで認証のページへ案内する設定がある。',
    },
  ],
  takeaways: [
    'Invoice の status：draft → open → paid（ほかに void・uncollectible）',
    '更新の請求書は下書きで作られ、約 1 時間後に確定して請求される（その間に invoice.created が届く）。invoice.created を受けているのに成功の返事をしないと、確定が最大 72 時間遅れる',
    'どの契約の請求書かは、API 2025-03-31.basil 以降 parent.subscription_details.subscription で読む',
    'invoice.payment_intent と invoice.charge は basil で無くなった。支払いは invoice.payments（InvoicePayment、expand が必要）で見る',
    '使えるかの判定は customer.subscription.* の同期で決め、invoice.* は記録とユーザーへの連絡に使う',
  ],
  scenes: [
    {
      kind: 'opening',
      section: 'SECTION 2　Stripe の概念とデータ',
      title: '請求書と支払い',
      subtitle: '毎月の請求は Invoice が運ぶ',
      lines: [
        { t: 'レクチャー5。請求書と支払い。', v: 'announcer', pause: 0.3 },
        { t: 'サブスクの契約そのものが、お金を払うわけではありません。毎回、請求書が作られて、それが支払われています。' },
      ],
    },
    {
      kind: 'goals',
      heading: 'このレクチャーのゴール',
      items: [
        { text: 'Invoice の状態の流れが分かる', at: 1 },
        { text: '毎月の請求で何が起きるか分かる', at: 2 },
        { text: '支払いの失敗と追加の認証の扱いが分かる', at: 3 },
      ],
      lines: [
        { t: 'ゴールは三つです。' },
        { t: '請求書、Invoice の状態の流れ。', sfx: 'pop' },
        { t: '毎月の請求で、何が起きているのか。', sfx: 'pop' },
        { t: 'そして、支払いの失敗と、追加の認証の扱いです。', sfx: 'pop' },
      ],
    },
    {
      kind: 'states',
      heading: '請求書の一生（Invoice の status）',
      nodes: [
        { key: 'draft', code: 'draft', ja: '下書き（まだ直せる）', x: 300, y: 560, tone: 'slate', at: 1 },
        { key: 'open', code: 'open', ja: '確定・支払い待ち', x: 860, y: 560, tone: 'cyan', at: 2 },
        { key: 'paid', code: 'paid', ja: '支払い済み', x: 1460, y: 380, tone: 'mint', at: 3, badge: '完了' },
        { key: 'void', code: 'void', ja: '取り消し', x: 1460, y: 740, tone: 'coral', at: 4 },
        { key: 'uncollectible', code: 'uncollectible', ja: '回収できない', x: 860, y: 900, tone: 'coral', at: 4 },
      ],
      edges: [
        { from: 'draft', to: 'open', label: '確定する', at: 2 },
        { from: 'open', to: 'paid', label: '支払い成功', at: 3 },
        { from: 'open', to: 'void', label: '取り消す', at: 4 },
        { from: 'open', to: 'uncollectible', label: '回収できない', at: 4, labelDx: 70 },
      ],
      focus: [
        { keys: ['draft'], at: 1 },
        { keys: ['open'], at: 2 },
        { keys: ['paid'], at: 3 },
        { keys: ['void', 'uncollectible'], at: 4 },
      ],
      lines: [
        { t: '請求書にも、一生があります。' },
        { t: '最初は draft、下書きです。まだ明細を足したり、直したりできます。', s: '最初はドラフト、下書きです。まだ明細を足したり、直したりできます。', sfx: 'pop' },
        { t: '確定すると open。請求の内容が固まって、支払いを待つ状態になります。', s: '確定するとオープン。請求の内容が固まって、支払いを待つ状態になります。', sfx: 'pop' },
        { t: '支払いが済むと paid です。', sfx: 'pop' },
        { t: '取り消すなら void。回収できないと判断したら uncollectible です。', s: '取り消すならボイド。回収できないと判断したら、アンコレクティブルです。', sfx: 'pop' },
      ],
    },
    {
      kind: 'timeline',
      heading: '毎月の請求で起きること',
      items: [
        { key: 't1', title: '① 期間が終わる', sub: '更新の日', detail: '新しい期間が始まり、請求書が下書きで作られる', at: 1, tone: 'cyan' },
        { key: 't2', title: '② 約 1 時間で確定', sub: 'draft → open', detail: 'その間に invoice.created が届く', at: 2, tone: 'violet' },
        { key: 't3', title: '③ カードに請求', sub: '自動', detail: '登録されている支払い方法に請求する', at: 3, tone: 'amber' },
        { key: 't4', title: '④ 結果を知らせる', sub: 'Webhook', detail: 'invoice.paid か invoice.payment_failed', at: 4, tone: 'mint' },
      ],
      focus: [
        { key: 't1', at: 1 },
        { key: 't2', at: 2 },
        { key: 't3', at: 3 },
        { key: 't4', at: 4 },
      ],
      lines: [
        { t: '毎月の更新の日に、何が起きているのかを追いかけます。' },
        { t: '今の期間が終わると、新しい期間が始まって、請求書が下書きで作られます。' },
        { t: '更新の請求書は、およそ一時間、下書きのまま置かれてから確定します。その間に invoice.created が届くので、必要なら明細を足すこともできます。この通知を受けているのに成功の返事をしないと、確定が最大七十二時間遅れるので、注意しましょう。' },
        { t: '確定すると、登録されているカードに、自動で請求します。' },
        { t: '結果は Webhook で届きます。払えたら invoice.paid、払えなかったら invoice.payment_failed です。', sfx: 'chime' },
      ],
    },
    {
      kind: 'table',
      heading: 'billing_reason で「何の請求か」が分かる',
      columns: ['billing_reason', 'いつの請求書か'],
      widths: [0.42, 0.58],
      mono: [0],
      rows: [
        { cells: ['subscription_create', '契約を始めたとき（最初の請求）'], at: 1, tone: 'violet' },
        { cells: ['subscription_cycle', '毎月・毎年の更新'], at: 2, tone: 'cyan' },
        { cells: ['subscription_update', 'プラン変更などで、すぐ請求するとき'], at: 3, tone: 'amber' },
      ],
      lines: [
        { t: '請求書には、billing_reason という項目があって、何の請求かが分かります。' },
        { t: 'subscription_create は、契約を始めたときの、最初の請求書。' },
        { t: 'subscription_cycle は、毎月や毎年の更新。', s: 'サブスクリプション・サイクルは、毎月や毎年の更新。' },
        { t: 'subscription_update は、プランを変えて、すぐに請求するときです。' },
      ],
    },
    {
      kind: 'code',
      heading: '請求書の中身と、契約のたどり方',
      lang: 'json',
      file: 'GET /v1/invoices/in_…（主な項目だけ）',
      showAt: 0,
      fontSize: 26,
      code: `{
  "id": "in_1Q…",
  "object": "invoice",
  "customer": "cus_Q…",
  "status": "paid",
  "billing_reason": "subscription_cycle",
  "amount_due": 1000,
  "amount_paid": 1000,
  "parent": {
    "type": "subscription_details",
    "subscription_details": {
      "subscription": "sub_1Q…"
    }
  },
  "hosted_invoice_url": "https://invoice.stripe.com/i/…"
}`,
      marks: [
        { from: 2, to: 4, at: 1, note: 'in_ の ID と、誰の請求か', tone: 'slate' },
        { from: 5, to: 6, at: 2, note: '状態と、何の請求か', tone: 'cyan' },
        { from: 7, to: 8, at: 3, note: '請求額と、支払われた額', tone: 'amber' },
        { from: 9, to: 14, at: 4, note: 'どの契約の請求書か（basil 以降）', tone: 'pink' },
        { from: 15, to: 15, at: 5, note: 'Stripe が用意する請求書のページ', tone: 'mint' },
      ],
      lines: [
        { t: '請求書の中身も見ておきましょう。' },
        { t: 'id は in から始まります。customer は、誰の請求書か。', s: 'ID はインから始まります。カスタマーは、誰の請求書か。' },
        { t: 'status と billing_reason です。' },
        { t: 'amount_due が請求額、amount_paid が、支払われた額です。', s: 'アマウント・デューが請求額、アマウント・ペイドが、支払われた額です。' },
        { t: 'どの契約の請求書かは、parent の中の subscription_details にあります。これも basil からの変更で、古い記事では、直下の subscription を読んでいました。', s: 'どの契約の請求書かは、ペアレントの中の、サブスクリプション・ディテールズにあります。これもバジルからの変更で、古い記事では、直下のサブスクリプションを読んでいました。', sfx: 'chime' },
        { t: 'hosted_invoice_url は、Stripe が用意する請求書のページ。ユーザーは、ここで請求書や領収書を受け取れます。', s: 'ホステッド・インボイス・ユーアールエルは、ストライプが用意する請求書のページ。ユーザーは、ここで請求書や領収書を受け取れます。' },
      ],
    },
    {
      kind: 'compare',
      heading: '支払いに失敗したら',
      left: {
        title: '更新の支払いが失敗',
        tone: 'coral',
        icon: 'x',
        at: 1,
        items: [
          { text: 'invoice.payment_failed が届く', at: 1 },
          { text: 'Subscription は past_due になる', at: 1 },
        ],
      },
      right: {
        title: 'Stripe が立て直す',
        tone: 'mint',
        icon: 'repeat',
        at: 2,
        items: [
          { text: 'Smart Retries で自動の再試行（推奨は 2 週間で 8 回）', at: 2 },
          { text: 'カードの更新をお願いするメール（設定）', at: 3 },
        ],
      },
      verdict: { text: '再試行が尽きたら、設定どおり canceled・unpaid・past_due のまま（flexible なら一時停止も）', at: 4, tone: 'violet' },
      lines: [
        { t: '更新の支払いに失敗すると、何が起きるのでしょう。' },
        { t: 'invoice.payment_failed が届いて、契約は past_due になります。', sfx: 'pop' },
        { t: 'でも、すぐに諦めるわけではありません。Smart Retries という仕組みで、Stripe が払えそうなタイミングを選んで、自動で再試行します。おすすめの設定は、二週間で八回です。', s: 'でも、すぐに諦めるわけではありません。スマート・リトライズという仕組みで、ストライプが払えそうなタイミングを選んで、自動で再試行します。おすすめの設定は、二週間で八回です。', sfx: 'pop' },
        { t: 'カードの更新をお願いするメールも、設定で送れます。', sfx: 'pop' },
        { t: '再試行が尽きたら、前のレクチャーで見たとおり、設定に従って、解約や unpaid などに進みます。', sfx: 'chime' },
      ],
    },
    {
      kind: 'big',
      heading: '3D セキュアの追加認証',
      kicker: '更新の支払いでも、カード会社が本人確認を求めることがある',
      text: '**invoice.payment_action_required** が届く',
      textAt: 1,
      sub: 'Stripe のメールで、認証のページへ案内できる（設定）',
      subAt: 2,
      tone: 'amber',
      icon: 'shield',
      lines: [
        { t: '更新の支払いでも、カード会社が本人確認、つまり 3D セキュアを求めることがあります。' },
        { t: 'そのときは、invoice.payment_action_required が届きます。ユーザーが認証するまで、支払いは終わりません。', sfx: 'chime' },
        { t: 'Stripe の設定で、認証のページへ案内するメールを送れます。' },
      ],
    },
    {
      kind: 'points',
      heading: 'アプリは請求書の通知をどう使う？',
      columns: 3,
      numbered: true,
      items: [
        { title: '使えるかは Subscription で決める', body: 'past_due や canceled への変化は customer.subscription.* でも届く', at: 1, tone: 'pink', icon: 'repeat' },
        { title: '請求書の通知は記録と連絡に', body: '支払いの失敗をユーザーに知らせる・売上を記録する', at: 2, tone: 'slate', icon: 'bell' },
        { title: '領収書は Stripe に任せる', body: '請求書のページと、管理ページの請求履歴で受け取れる', at: 3, tone: 'mint', icon: 'receipt' },
      ],
      lines: [
        { t: 'では、アプリは請求書の通知を、どう使えばよいでしょう。' },
        { t: '使えるかどうかの判定は、Subscription の状態で決めます。past_due や canceled への変化は、customer.subscription の通知でも届くからです。', sfx: 'pop' },
        { t: '請求書の通知は、記録や、ユーザーへの連絡に使います。', sfx: 'pop' },
        { t: '領収書は、Stripe の請求書のページや、管理ページの請求履歴に任せられます。', sfx: 'pop' },
      ],
    },
    {
      kind: 'recap',
      heading: 'まとめ',
      items: [
        { text: 'draft → open → paid（ほかに void・uncollectible）', at: 1 },
        { text: '毎月：下書き → 約 1 時間で確定 → 請求 → 結果の通知', at: 2 },
        { text: '失敗は past_due と自動の再試行。追加の認証は action_required', at: 3 },
      ],
      lines: [
        { t: 'まとめです。' },
        { t: '請求書は、draft、open、paid と進みます。取り消しは void、回収できないときは uncollectible。', s: '請求書は、ドラフト、オープン、ペイドと進みます。取り消しはボイド、回収できないときはアンコレクティブル。', sfx: 'pop' },
        { t: '毎月の更新では、下書き、約一時間で確定、請求、そして結果の通知。', sfx: 'pop' },
        { t: '失敗したら past_due と自動の再試行。追加の認証が要るときは、payment_action_required が届きます。', sfx: 'pop' },
      ],
    },
    {
      kind: 'ending',
      next: { no: 6, title: 'Checkout で申し込みを作る' },
      lines: [{ t: 'Stripe の概念とデータはここまで。次のセクションから、サンプルアプリを作る流れで見ていきます。' }],
    },
  ],
};
