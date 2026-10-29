import type { Lecture } from '../types';

export const L06: Lecture = {
  id: 'L06',
  no: 6,
  section: { no: 3, title: 'サンプルで作る' },
  title: 'Checkout で申し込みを作る',
  summary: 'ホスト型の Checkout を選ぶ理由、Customer を先に作る理由、Checkout Session のサンプルコード、完了ページを信じてはいけない理由。',
  docs: [
    { title: 'Stripe: サブスクリプションの組み込み（Stripe がホストするページ）', url: 'https://docs.stripe.com/billing/subscriptions/build-subscriptions' },
    { title: 'Stripe API: Create a Checkout Session', url: 'https://docs.stripe.com/api/checkout/sessions/create' },
    { title: 'Stripe: 注文のフルフィルメント（Webhook と完了ページ）', url: 'https://docs.stripe.com/checkout/fulfillment' },
    { title: 'Stripe: Checkout の無料トライアル', url: 'https://docs.stripe.com/payments/checkout/free-trials' },
  ],
  quiz: [
    {
      q: 'Checkout Session の expires_at に設定できる範囲は？',
      choices: ['5 分〜1 時間', '30 分〜24 時間', '1 時間〜7 日', '制限なし'],
      answer: 1,
      explain: '既定は作成から 24 時間。',
    },
    {
      q: 'success_url に入れておく差し込みは？',
      choices: ['{USER_ID}', '{CHECKOUT_SESSION_ID}', '{SUBSCRIPTION_ID}', '{CUSTOMER_EMAIL}'],
      answer: 1,
      explain: '戻ってきたときに Stripe が Session ID へ置き換える。完了ページはこの ID で Session を取り直す。',
    },
    {
      q: '完了ページに戻ってきたときの正しい扱いは？',
      choices: ['その場で Pro にする', 'Stripe から Session を取り直して照合する（確定は Webhook）', 'URL の session_id を信じる', '何もしない'],
      answer: 1,
      explain: '戻り先 URL は偽装できるし、戻ってこない人もいる。確定は Webhook、完了ページの取り直しは反映の遅れの保険。',
    },
  ],
  takeaways: [
    'ユーザー 1 人に Customer 1 つ。Checkout の前に作って users.stripe_customer_id に保存し、customer= で渡す',
    'client_reference_id と、契約の metadata にアプリの user_id。Webhook や完了ページで答え合わせに使う',
    'success_url に {CHECKOUT_SESSION_ID}。完了ページは Session を取り直すだけで、確定は Webhook',
    '無料期間は subscription_data.trial_period_days。何度も使わせないなら、契約の履歴を見てから付ける',
    '無料期間の新しい仕組み（Trial Offer API）も出ている。Checkout では今も trial_period_days が実用的だが、公式ではレガシーの表記（2026-10 時点）',
    'サンプルは読みやすさのため stripe.Customer.create のような書き方にした。stripe-python は StripeClient を勧めていて、この書き方は近く非推奨になる予定',
  ],
  scenes: [
    {
      kind: 'opening',
      section: 'SECTION 3　サンプルで作る',
      title: 'Checkout で申し込みを作る',
      subtitle: 'ホスト型 Checkout Session の作り方',
      lines: [
        { t: 'レクチャー6。Checkout で、申し込みを作る。', v: 'announcer', pause: 0.3 },
        { t: 'ここからは、サンプルアプリを作る流れで見ていきます。まずは、Pro にするを押してから、支払いが終わって戻ってくるまでです。' },
      ],
    },
    {
      kind: 'goals',
      heading: 'このレクチャーのゴール',
      items: [
        { text: '3 つの作り方からホスト型を選ぶ理由', at: 1 },
        { text: 'Checkout Session の主な引数の意味', at: 2 },
        { text: '「完了ページ＝契約成立」ではない理由', at: 3 },
      ],
      lines: [
        { t: 'ゴールは三つです。' },
        { t: 'ホスト型の Checkout を選ぶ理由。', sfx: 'pop' },
        { t: 'Checkout Session の引数の意味。', sfx: 'pop' },
        { t: 'そして、完了ページに戻っても、それだけでは契約成立ではない理由です。', sfx: 'pop' },
      ],
    },
    {
      kind: 'table',
      heading: '支払い画面の 3 つの作り方',
      columns: ['作り方', '中身', 'この講座'],
      widths: [0.27, 0.53, 0.2],
      rows: [
        { cells: ['ホスト型 Checkout', 'Stripe のページへ移動させる（ui_mode=hosted_page・既定）', '使う'], at: 1, tone: 'mint' },
        { cells: ['埋め込み', '自分のページに Stripe のフォームを埋める（embedded_page）', '—'], at: 2, tone: 'slate' },
        { cells: ['Elements で自作', '部品を組み合わせて画面を作る（elements）', '—'], at: 3, tone: 'slate' },
      ],
      lines: [
        { t: 'Stripe で支払いを受ける画面の作り方は、大きく三つあります。' },
        { t: '一つ目は、Stripe がホストするページへ移動させる、ホスト型の Checkout。これが既定です。' },
        { t: '二つ目は、自分のページの中に、Stripe のフォームを埋め込むやり方。' },
        { t: '三つ目は、Elements という部品を組み合わせて、自分で画面を作るやり方です。' },
      ],
    },
    {
      kind: 'points',
      heading: 'ホスト型を選ぶ 3 つの理由',
      columns: 3,
      numbered: true,
      items: [
        { title: 'コードが最小', body: 'カード入力フォームも Stripe.js も持たない', at: 1, tone: 'violet', icon: 'code' },
        { title: '3D セキュア・多言語・無料期間の表示', body: '日本は 2025 年 3 月末から EC のカード決済に 3D セキュアが原則必須。Checkout が自動で出す', at: 2, tone: 'cyan', icon: 'shield' },
        { title: 'カード情報に触れない', body: '番号はアプリに一切来ない。決済の安全基準（PCI DSS）は Stripe 側', at: 3, tone: 'mint', icon: 'lock' },
      ],
      lines: [
        { t: 'この講座では、ホスト型を使います。理由は三つです。' },
        { t: '一つ目、コードが最小です。カードの入力フォームも、Stripe.js も持ちません。', sfx: 'pop' },
        { t: '二つ目、3D セキュア、多言語、無料期間の表示を、Stripe が持ってくれます。日本では 2025 年 3 月末から、ネットのカード決済に 3D セキュアが原則必須になりました。', sfx: 'pop' },
        { t: '三つ目、カード情報に一切触れないので、決済の安全基準への対応も Stripe 側が持ちます。', sfx: 'pop' },
      ],
    },
    {
      kind: 'sequence',
      heading: 'ボタンを押してから戻るまで',
      actors: [
        { key: 'browser', label: 'ブラウザ', sub: 'フロント', tone: 'pink', icon: 'browser' },
        { key: 'app', label: 'アプリのサーバー', sub: 'FastAPI', tone: 'violet', icon: 'server' },
        { key: 'stripe', label: 'Stripe Checkout', sub: 'ホスト型ページ', tone: 'cyan', icon: 'card' },
      ],
      steps: [
        { from: 'browser', to: 'app', label: 'POST /billing/checkout', at: 1 },
        { from: 'app', to: 'stripe', label: 'Session を作る', at: 2 },
        { from: 'stripe', to: 'app', label: 'url を返す', at: 2, dashed: true },
        { from: 'app', to: 'browser', label: 'url を返す', at: 3, dashed: true },
        { from: 'browser', to: 'stripe', label: '移動してカードを入力', at: 3 },
        { from: 'stripe', to: 'app', label: 'Webhook（裏で非同期）', at: 4, tone: 'coral' },
        { from: 'stripe', to: 'browser', label: 'success_url へ戻す', at: 5, tone: 'mint' },
      ],
      lines: [
        { t: 'では、流れを追いかけます。' },
        { t: 'ユーザーがボタンを押すと、ブラウザからアプリのサーバーに、Checkout Session を作って、とリクエストします。' },
        { t: 'サーバーは Stripe に Session を作らせて、返ってきた URL を受け取ります。' },
        { t: 'その URL へブラウザを移動させると、ユーザーは Stripe のページでカードを入力します。' },
        { t: '支払いが通ると、Stripe は裏で Webhook を送ります。' },
        { t: 'そして、ユーザーをアプリの完了ページ、success_url へ戻します。' },
      ],
    },
    {
      kind: 'code',
      heading: 'まず Customer を用意する',
      lang: 'python',
      file: 'billing.py（サンプル）',
      showAt: 0,
      fontSize: 30,
      code: `def get_or_create_customer(user) -> str:
    if user.stripe_customer_id:              # 2 回目からは同じ顧客
        return user.stripe_customer_id
    customer = stripe.Customer.create(
        email=user.email,
        metadata={"user_id": str(user.id)},
    )
    users.save_stripe_customer_id(user.id, customer.id)
    return customer.id`,
      marks: [
        { from: 2, to: 3, at: 1, note: '1 ユーザーに 1 顧客', tone: 'cyan' },
        { from: 4, to: 7, at: 3, note: 'メールと、アプリの user_id', tone: 'amber' },
        { from: 8, to: 9, at: 4, note: 'cus_ をアプリの DB に保存', tone: 'mint' },
      ],
      lines: [
        { t: 'Session を作る前に、顧客を用意します。' },
        { t: 'すでに Stripe の顧客 ID を持っているユーザーなら、それを使います。一人のユーザーに、顧客は一つ。これで、解約して再加入しても、契約や請求の履歴が一か所にまとまります。' },
        { t: '顧客を渡さなくても、Checkout が自動で作ってくれますが、申し込むたびに別の顧客ができてしまいます。' },
        { t: 'まだなら、Customer を作ります。メールアドレスと、metadata にアプリの user_id。' },
        { t: '返ってきた cus から始まる ID を、アプリの users テーブルに保存しておきます。Webhook が来たとき、この ID からユーザーを引くためです。', sfx: 'chime' },
      ],
    },
    {
      kind: 'code',
      heading: 'Checkout Session を作るコード',
      lang: 'python',
      file: 'billing.py（サンプル）',
      showAt: 0,
      code: `@router.post("/billing/checkout")
def create_checkout(user=Depends(current_user)):
    params = dict(
        mode="subscription",
        customer=get_or_create_customer(user),
        line_items=[{"price": settings.PRICE_PRO_MONTHLY,
                     "quantity": 1}],
        client_reference_id=str(user.id),
        subscription_data={"metadata": {"user_id": str(user.id)}},
        success_url=(f"{APP_URL}/billing/done"
                     "?session_id={CHECKOUT_SESSION_ID}"),
        cancel_url=f"{APP_URL}/pricing",
    )
    if not subscriptions.has_history(user.id):   # 無料期間は初回だけ
        params["subscription_data"]["trial_period_days"] = 14
    session = stripe.checkout.Session.create(**params)
    return {"url": session.url}`,
      marks: [
        { from: 1, to: 2, at: 1, note: 'ログイン中のユーザーだけ', tone: 'slate' },
        { from: 4, to: 4, at: 2, note: '月額の契約を作るモード', tone: 'pink' },
        { from: 5, to: 5, at: 3, note: '先に用意した cus_', tone: 'cyan' },
        { from: 6, to: 7, at: 4, note: 'Pro の価格を 1 つ（設定値）', tone: 'amber' },
        { from: 8, to: 9, at: 5, note: 'アプリの user_id＝答え合わせの鍵', tone: 'violet' },
        { from: 10, to: 11, at: 6, note: '{CHECKOUT_SESSION_ID} が置き換わる', tone: 'cyan' },
        { from: 12, to: 12, at: 7, note: 'やめたときの戻り先', tone: 'slate' },
        { from: 14, to: 15, at: 8, note: '14 日間無料は初回だけ', tone: 'mint' },
        { from: 16, to: 17, at: 9, note: 'URL を返して移動させる', tone: 'violet' },
      ],
      lines: [
        { t: 'では、Checkout Session を作るコードです。FastAPI で書くと、こうなります。' },
        { t: 'ログインしているユーザーの、Pro にするボタンから呼ばれる API です。' },
        { t: 'mode は subscription。月額の契約を作る、という意味です。' },
        { t: 'customer には、さっき用意した顧客 ID を渡します。' },
        { t: 'line_items には、Pro の月額の価格 ID を一つ。価格 ID は環境ごとに違うので、設定値から読みます。' },
        { t: 'client_reference_id と、契約の metadata に、アプリの user_id。これが、あとで答え合わせをする鍵になります。' },
        { t: 'success_url には、CHECKOUT_SESSION_ID という差し込みを入れます。戻ってきたとき、どの支払いだったかが分かります。' },
        { t: 'cancel_url は、支払いをやめたときの戻り先です。' },
        { t: 'そして、過去に一度も契約がない人だけ、十四日間の無料期間をつけます。無料期間を、何度も使わせないためです。' },
        { t: '最後に Session を作って、URL をフロントに返す。これだけです。', sfx: 'chime' },
      ],
    },
    {
      kind: 'big',
      heading: '公式ドキュメントの小ネタ',
      kicker: 'checkout.session.completed を受け取る Webhook があるとき',
      text: 'Checkout は Webhook の返事を **最大 10 秒** 待ってから戻す',
      textAt: 1,
      sub: 'Webhook が速く 200 を返すほど、戻った時にはもう Pro になっている',
      subAt: 2,
      tone: 'cyan',
      icon: 'zap',
      lines: [
        { t: '公式ドキュメントに、うれしい小ネタがあります。' },
        { t: 'checkout.session.completed を受け取る Webhook を登録していると、Checkout は、サーバーの返事を最大十秒待ってから、完了ページへ戻してくれます。', sfx: 'chime' },
        { t: 'つまり、Webhook が速く返事をするほど、戻ってきた時にはもう Pro になっている、という体験に近づきます。' },
        { t: 'ただし、Stripe CLI でローカルに転送しているときは、待たずにすぐ戻ります。' },
      ],
    },
    {
      kind: 'compare',
      heading: 'よくある誤解「完了ページ＝契約成立」',
      left: {
        title: 'やってはいけない',
        tone: 'coral',
        icon: 'x',
        at: 0,
        items: [
          { text: '完了ページに戻ったら Pro にする', at: 0 },
          { text: 'URL の session_id をそのまま信じる', at: 1 },
        ],
      },
      right: {
        title: '正しいやり方',
        tone: 'mint',
        icon: 'check',
        at: 2,
        items: [
          { text: 'Webhook で確定する（本命）', at: 2 },
          { text: '完了ページは Session を取り直して同期（保険）', at: 2 },
        ],
      },
      verdict: { text: '画面は「反映に数秒かかることがある」前提で作る', at: 3, tone: 'violet' },
      lines: [
        { t: 'ここで、よくある誤解です。完了ページに戻ってきたら、契約成立。これは違います。' },
        { t: '戻る前にブラウザを閉じる人もいますし、戻り先の URL は、誰でも作れてしまいます。' },
        { t: '正しくは、Webhook で確定します。完了ページからは、Stripe に Session を取り直して同期する。これは Webhook を待たないための保険です。', sfx: 'pop' },
        { t: '画面は、反映に数秒かかることがある、という前提で作りましょう。' },
      ],
    },
    {
      kind: 'recap',
      heading: 'まとめ',
      items: [
        { text: 'ホスト型 Checkout（ui_mode=hosted_page）', at: 1 },
        { text: 'customer と client_reference_id で「誰の支払いか」を結ぶ', at: 2 },
        { text: '完了ページは保険。確定は Webhook', at: 3 },
      ],
      lines: [
        { t: 'まとめです。' },
        { t: 'この講座では、ホスト型の Checkout を使います。', sfx: 'pop' },
        { t: 'customer と client_reference_id で、誰の支払いかを結びます。', sfx: 'pop' },
        { t: 'そして、完了ページは保険。確定させるのは Webhook です。', sfx: 'pop' },
      ],
    },
    {
      kind: 'ending',
      next: { no: 7, title: 'Webhook　あとから届く通知と 4 つの約束' },
      lines: [{ t: '次は、支払いのあとに届く通知、Webhook です。ここが一番の山場ですよ。' }],
    },
  ],
};
