import type { Lecture } from '../types';

export const L03: Lecture = {
  id: 'L03',
  no: 3,
  section: { no: 2, title: 'Stripe の概念とデータ' },
  title: 'データの形を読む',
  summary: 'Price・Customer・Subscription・Event の JSON を開き、アプリが読む項目と、metadata・expand の使い方をつかむ。',
  docs: [
    { title: 'Stripe API: Price オブジェクト', url: 'https://docs.stripe.com/api/prices/object' },
    { title: 'Stripe API: Customer オブジェクト', url: 'https://docs.stripe.com/api/customers/object' },
    { title: 'Stripe API: Subscription オブジェクト', url: 'https://docs.stripe.com/api/subscriptions/object' },
    { title: 'Stripe API: Event オブジェクト', url: 'https://docs.stripe.com/api/events/object' },
    { title: 'Stripe: レスポンスの展開（expand）', url: 'https://docs.stripe.com/expand' },
    { title: 'Stripe: メタデータ', url: 'https://docs.stripe.com/metadata' },
  ],
  quiz: [
    {
      q: 'Subscription の今の期間の終わり（current_period_end）は、新しい API ではどこにある？',
      choices: ['Subscription の直下', 'items.data[] の各明細', 'Customer', 'Invoice だけ'],
      answer: 1,
      explain: 'API 2025-03-31.basil 以降は、契約の明細（items.data[]）の側にある。',
    },
    {
      q: 'expand を付けずに取った Subscription の customer に入っているのは？',
      choices: ['顧客オブジェクトの全部', '顧客の ID（cus_…）だけ', 'メールアドレス', '空'],
      answer: 1,
      explain: '関連するオブジェクトは、既定では ID の文字列。中身が欲しいときは expand で展開する。',
    },
    {
      q: 'アプリの user_id を Stripe 側に持たせるには？',
      choices: ['Customer の name に入れる', 'metadata に入れる', 'description に入れる', '持たせられない'],
      answer: 1,
      explain: 'metadata はキーと値の組を自由に付けられる欄。Webhook で届いたとき、どのユーザーかを引く手がかりになる。機密は入れない。',
    },
  ],
  takeaways: [
    'Subscription で読むのは id・customer・status・items.data[0].price.id・items.data[0].current_period_end・cancel_at・trial_end',
    '関連は既定で ID の文字列。expand=["latest_invoice"] のように展開できる（深さは 4 段まで）',
    'metadata にアプリの user_id を入れておくと、Webhook から引きやすい（カード番号などの機密は入れない）',
    'Webhook で届くオブジェクトは展開されない（関連は ID のまま）。中身が要るときは取り直す',
    'Event は data.object に変化したオブジェクトの写し、data.previous_attributes に変わる前の値',
  ],
  scenes: [
    {
      kind: 'opening',
      section: 'SECTION 2　Stripe の概念とデータ',
      title: 'データの形を読む',
      subtitle: 'JSON を開いて、読む項目を知る',
      lines: [
        { t: 'レクチャー3。データの形を読む。', v: 'announcer', pause: 0.3 },
        { t: 'Stripe の API が返すのは、JSON という形のデータです。今回は、その中身を開いてみます。' },
      ],
    },
    {
      kind: 'goals',
      heading: 'このレクチャーのゴール',
      items: [
        { text: 'Price と Customer の中身が分かる', at: 1 },
        { text: 'Subscription で読むべき項目が分かる', at: 2 },
        { text: 'expand と Event の形が分かる', at: 3 },
      ],
      lines: [
        { t: 'ゴールは三つです。' },
        { t: '価格と顧客の中身。', sfx: 'pop' },
        { t: '契約、Subscription で、アプリが読むべき項目。', sfx: 'pop' },
        { t: 'そして、expand と、イベントの形です。', sfx: 'pop' },
      ],
    },
    {
      kind: 'code',
      heading: 'Price（価格）の中身',
      lang: 'json',
      file: 'GET /v1/prices/price_…（主な項目だけ）',
      showAt: 0,
      fontSize: 30,
      code: `{
  "id": "price_1Q…",
  "object": "price",
  "product": "prod_Q…",
  "currency": "jpy",
  "unit_amount": 1000,
  "recurring": {
    "interval": "month",
    "interval_count": 1
  },
  "tax_behavior": "inclusive",
  "lookup_key": "pro_monthly"
}`,
      marks: [
        { from: 2, to: 3, at: 1, note: 'ID と、オブジェクトの種類', tone: 'amber' },
        { from: 4, to: 4, at: 2, note: 'どの商品の値札か', tone: 'amber' },
        { from: 5, to: 6, at: 3, note: '円で 1,000（小数なし）', tone: 'mint' },
        { from: 7, to: 10, at: 4, note: '毎月（年額なら year）', tone: 'cyan' },
        { from: 11, to: 11, at: 5, note: '税込みの価格', tone: 'violet' },
        { from: 12, to: 12, at: 6, note: 'コードから引くための名前', tone: 'pink' },
      ],
      lines: [
        { t: 'まずは Price、価格です。API で取ると、こんな JSON が返ってきます。主な項目だけに絞りました。' },
        { t: 'id は price から始まり、object を見れば、何のオブジェクトかが分かります。' },
        { t: 'product は、どの商品の値札か。商品の ID が入っています。' },
        { t: 'currency は jpy、つまり円。unit_amount は千。円は小数がないので、そのまま千円です。', s: 'カレンシーはジェイピーワイ、つまり円。ユニット・アマウントは千。円は小数がないので、そのまま千円です。' },
        { t: 'recurring は、繰り返しの周期。interval が month なら毎月。年額の価格なら year になります。', s: 'リカーリングは、繰り返しの周期。インターバルがマンスなら毎月。年額の価格なら、イヤーになります。' },
        { t: 'tax_behavior が inclusive なら、税込みの価格という意味です。' },
        { t: 'lookup_key は、価格に付けられる名前。ID は環境ごとに変わるので、コードからはこの名前で引く、という使い方ができます。', sfx: 'chime' },
      ],
    },
    {
      kind: 'code',
      heading: 'Customer（顧客）の中身',
      lang: 'json',
      file: 'GET /v1/customers/cus_…（主な項目だけ）',
      showAt: 0,
      fontSize: 30,
      code: `{
  "id": "cus_Q…",
  "object": "customer",
  "email": "hanako@example.com",
  "name": "山田 花子",
  "metadata": {
    "user_id": "42"
  },
  "invoice_settings": {
    "default_payment_method": "pm_1Q…"
  }
}`,
      marks: [
        { from: 2, to: 3, at: 1, note: 'cus_ で始まる ID', tone: 'cyan' },
        { from: 4, to: 5, at: 2, note: 'メールの送り先・領収書の宛名', tone: 'amber' },
        { from: 6, to: 8, at: 3, note: 'アプリの user_id を入れておく', tone: 'pink' },
        { from: 9, to: 11, at: 4, note: '既定の支払い方法（ID だけ）', tone: 'mint' },
      ],
      lines: [
        { t: '次は Customer、顧客です。' },
        { t: 'id は cus から始まります。' },
        { t: 'email と name。Stripe が領収書や案内のメールを送る先です。', s: 'イーメールとネーム。ストライプが領収書や案内のメールを送る先です。' },
        { t: 'metadata には、キーと値の組を自由に入れられます。ここにアプリの user_id を入れておくと、Webhook で届いたとき、どのユーザーかを引く手がかりになります。カード番号のような機密は、入れてはいけません。', sfx: 'chime' },
        { t: 'invoice_settings の default_payment_method は、既定の支払い方法。pm から始まる ID だけが入っていて、カード番号そのものは見えません。', s: 'インボイス・セッティングスの、デフォルト・ペイメント・メソッドは、既定の支払い方法。ピーエムから始まる ID だけが入っていて、カード番号そのものは見えません。' },
      ],
    },
    {
      kind: 'code',
      heading: 'Subscription（契約）の中身',
      lang: 'json',
      file: 'GET /v1/subscriptions/sub_…（主な項目だけ）',
      showAt: 0,
      fontSize: 28,
      code: `{
  "id": "sub_1Q…",
  "customer": "cus_Q…",
  "status": "trialing",
  "items": {
    "data": [{
      "price": { "id": "price_1Q…" },
      "current_period_start": 1793232000,
      "current_period_end": 1794441600
    }]
  },
  "trial_end": 1794441600,
  "cancel_at": null,
  "latest_invoice": "in_1Q…",
  "metadata": { "user_id": "42" }
}`,
      marks: [
        { from: 2, to: 2, at: 1, note: 'sub_ で始まる ID', tone: 'pink' },
        { from: 3, to: 3, at: 2, note: '誰の契約か（ID だけ）', tone: 'cyan' },
        { from: 4, to: 4, at: 3, note: '今の状態（L4 で詳しく）', tone: 'mint' },
        { from: 5, to: 11, at: 4, note: '契約の明細。どの価格か', tone: 'amber' },
        { from: 8, to: 9, at: 5, note: '今の期間は明細の側（basil 以降）', tone: 'violet' },
        { from: 12, to: 13, at: 6, note: '無料期間の終わり・解約の予定', tone: 'coral' },
        { from: 14, to: 14, at: 7, note: '最新の請求書（ID だけ）', tone: 'slate' },
        { from: 15, to: 15, at: 8, note: 'アプリの user_id', tone: 'pink' },
      ],
      lines: [
        { t: 'いよいよ本命、Subscription です。アプリが一番よく読むオブジェクトなので、じっくり見ましょう。' },
        { t: 'id は sub から始まります。' },
        { t: 'customer は、誰の契約か。顧客オブジェクトの中身ではなく、ID だけが入っています。' },
        { t: 'status は、今の状態。trialing は無料期間中です。状態の移り変わりは、次のレクチャーで詳しくやります。' },
        { t: 'items は、契約の明細です。どの価格で契約しているかが、data の配列に入っています。', s: 'アイテムズは、契約の明細です。どの価格で契約しているかが、データの配列に入っています。' },
        { t: 'current_period_start と end が、今の期間の始まりと終わり。2025 年 3 月の basil というバージョンから、この日付は、Subscription の直下ではなく、明細の側に移りました。古い記事のコードは、ここで動かなくなります。', s: 'カレント・ピリオド・スタートとエンドが、今の期間の始まりと終わり。2025 年 3 月の、バジルというバージョンから、この日付は、サブスクリプションの直下ではなく、明細の側に移りました。古い記事のコードは、ここで動かなくなります。', sfx: 'chime' },
        { t: 'trial_end は無料期間の終わり。cancel_at は、解約される予定の日時で、予定がなければ null です。' },
        { t: 'latest_invoice は、一番新しい請求書の ID です。', s: 'レイテスト・インボイスは、一番新しい請求書の ID です。' },
        { t: 'metadata には、ここでもアプリの user_id を入れておけます。' },
      ],
    },
    {
      kind: 'compare',
      heading: '関連は「ID だけ」。必要なら展開する',
      left: {
        title: 'そのまま取る',
        sub: '既定',
        tone: 'slate',
        icon: 'link',
        at: 1,
        items: [
          { text: '"customer": "cus_Q…"', at: 1 },
          { text: '"latest_invoice": "in_1Q…"', at: 1 },
        ],
      },
      right: {
        title: 'expand で展開',
        sub: 'expand=["latest_invoice"]',
        tone: 'cyan',
        icon: 'layers',
        at: 2,
        items: [
          { text: '"latest_invoice": { "id": "in_1Q…", "status": "paid", … }', at: 2 },
          { text: 'API を呼ぶ回数を減らせる', at: 3 },
        ],
      },
      verdict: { text: '展開は必要なときだけ（4 段まで）。Webhook のデータは展開されずに届く', at: 4, tone: 'violet' },
      lines: [
        { t: 'ここで、大事な性質を一つ。関連するオブジェクトは、既定では ID の文字列だけが入っています。' },
        { t: 'customer も latest_invoice も、ID だけ。中身を知るには、もう一度 API を呼びます。', s: 'カスタマーも、レイテスト・インボイスも、ID だけ。中身を知るには、もう一度 API を呼びます。', sfx: 'pop' },
        { t: 'API を呼ぶときに expand を付けると、その場で中身を展開して返してくれます。', s: 'API を呼ぶときに、エクスパンドを付けると、その場で中身を展開して返してくれます。', sfx: 'pop' },
        { t: 'API を呼ぶ回数を減らせて、便利です。' },
        { t: 'ただし、展開は必要なときだけに。深さは四段まで。Webhook で届くデータは、いつも展開されていない形なので、中身が要るときは取り直します。', sfx: 'chime' },
      ],
    },
    {
      kind: 'code',
      heading: 'Event（通知）の形',
      lang: 'json',
      file: 'POST で届く Event（customer.subscription.updated の例）',
      showAt: 0,
      fontSize: 28,
      code: `{
  "id": "evt_1Q…",
  "object": "event",
  "type": "customer.subscription.updated",
  "created": 1794441601,
  "data": {
    "object": { "id": "sub_1Q…", "status": "active" },
    "previous_attributes": { "status": "trialing" }
  },
  "livemode": false
}`,
      marks: [
        { from: 2, to: 4, at: 1, note: 'evt_ の ID と、何が起きたか', tone: 'coral' },
        { from: 5, to: 5, at: 2, note: '起きた時刻（秒単位）', tone: 'slate' },
        { from: 7, to: 7, at: 3, note: '変化したオブジェクトの写し', tone: 'pink' },
        { from: 8, to: 8, at: 4, note: '変わる前の値', tone: 'amber' },
        { from: 10, to: 10, at: 5, note: '本番か、テストか', tone: 'mint' },
      ],
      lines: [
        { t: '最後に、Webhook で届く Event の形です。無料期間が終わって、有料に切り替わったときの例です。' },
        { t: 'id は evt から始まり、type が、何が起きたか。ここでは、契約が更新された、です。', s: 'ID はイーブイティーから始まり、タイプが、何が起きたか。ここでは、契約が更新された、です。' },
        { t: 'created は起きた時刻。秒単位です。' },
        { t: 'data の object に、変化したオブジェクトの写しが入っています。', s: 'データのオブジェクトに、変化したオブジェクトの写しが入っています。' },
        { t: 'previous_attributes には、変わる前の値。status が trialing から active に変わったことが分かります。', s: 'プレビアス・アトリビューツには、変わる前の値。ステータスが、トライアリングからアクティブに変わったことが分かります。', sfx: 'chime' },
        { t: 'livemode は、本番か、テストか。false なら、サンドボックスからの通知です。', s: 'ライブモードは、本番か、テストか。フォールスなら、サンドボックスからの通知です。' },
      ],
    },
    {
      kind: 'recap',
      heading: 'まとめ',
      items: [
        { text: 'Price は金額と周期、Customer は連絡先と metadata', at: 1 },
        { text: 'Subscription は status・明細の価格と期間・解約の予定', at: 2 },
        { text: '関連は ID。必要なら expand。Event は写しと変わる前の値', at: 3 },
      ],
      lines: [
        { t: 'まとめです。' },
        { t: 'Price は金額と周期、Customer は連絡先と metadata。', sfx: 'pop' },
        { t: 'Subscription では、status、明細の価格と期間、そして解約の予定を読みます。', sfx: 'pop' },
        { t: '関連は ID だけなので、必要なら expand。イベントには、写しと、変わる前の値が入っています。', s: '関連は ID だけなので、必要ならエクスパンド。イベントには、写しと、変わる前の値が入っています。', sfx: 'pop' },
      ],
    },
    {
      kind: 'ending',
      next: { no: 4, title: 'サブスクの一生　ステータスを読む' },
      lines: [{ t: '次は、この status が、どんな一生をたどるのかを見ていきます。' }],
    },
  ],
};
