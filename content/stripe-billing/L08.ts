import type { Lecture } from '../types';

export const L08: Lecture = {
  id: 'L08',
  no: 8,
  section: { no: 3, title: 'サンプルで作る' },
  title: 'Webhook を受けて DB に写す',
  summary: 'サンプルの 3 つのテーブル、受け取りの 4 ステップ、イベントの振り分け、取り直し方式の同期関数、Webhook と完了ページが同時に動いても壊れない理由。',
  docs: [
    { title: 'Stripe: Webhook（イベントの順序・重複・署名）', url: 'https://docs.stripe.com/webhooks' },
    { title: 'Stripe: イベントの仕組み（Snapshot は古い可能性）', url: 'https://docs.stripe.com/events/how-events-work' },
    { title: 'Stripe: 注文のフルフィルメント（同じ関数を 2 か所から）', url: 'https://docs.stripe.com/checkout/fulfillment' },
    { title: 'Stripe API: Retrieve a subscription', url: 'https://docs.stripe.com/api/subscriptions/retrieve' },
  ],
  quiz: [
    {
      q: '台帳への INSERT が一意制約で失敗したら？',
      choices: ['500 を返して再送させる', '処理済みとして 200（前回 failed なら処理し直す）', '400 を返す', '例外で落とす'],
      answer: 1,
      explain: '同じ evt_… は 2 回処理しない。ただし前回 failed の行は、再送で処理し直せるようにする。',
    },
    {
      q: '署名の検証が失敗する、よくある原因は？',
      choices: ['本文を JSON として読み直してから検証した', '200 を返した', 'Thin イベントを使った', 'テストカードを使った'],
      answer: 0,
      explain: '検証には加工していない生の本文（bytes）が必要。FastAPI なら await request.body()。',
    },
    {
      q: 'Webhook と完了ページの sync が同時に動いても壊れない理由は？',
      choices: ['ロックを取るから', 'どちらも同じ sub_… を Stripe の最新状態で upsert するから', '片方しか動かないから', 'Stripe が順番を保証するから'],
      answer: 1,
      explain: '書く内容が Stripe 由来の最新状態なので、最後の状態は一致する。',
    },
  ],
  takeaways: [
    'テーブルは 3 つ：users.stripe_customer_id（UNIQUE）・subscriptions（sub_… が主キー）・webhook_events（evt_… が主キー）',
    '受け取り：生の本文 → construct_event → 台帳に INSERT → 同期 → processed。例外は failed（例外の型名だけ）で 500',
    'customer.subscription.* はどれも「その sub_… を取り直して upsert」。届く順番に関係なく最後は正しい状態になる',
    '知らない customer のイベントは無視してログだけ（偽の通知で Pro にさせない）',
    '解約の予定は cancel_at で持つ（flexible では期間末の解約も cancel_at に入り、cancel_at_period_end は false のまま）',
    'stripe listen が表示する whsec_ はローカル専用。サンドボックスと本番はエンドポイントごとに別の whsec_',
  ],
  scenes: [
    {
      kind: 'opening',
      section: 'SECTION 3　サンプルで作る',
      title: 'Webhook を受けて DB に写す',
      subtitle: '3 つのテーブルと、取り直し方式の同期',
      lines: [
        { t: 'レクチャー8。Webhook を受けて、DB に写す。', v: 'announcer', pause: 0.3 },
        { t: 'レクチャー7で学んだ四つの約束を、サンプルアプリのコードに落とし込みます。' },
      ],
    },
    {
      kind: 'goals',
      heading: 'このレクチャーのゴール',
      items: [
        { text: '3 つのテーブルの役割が分かる', at: 1 },
        { text: '受け取りの 4 ステップが書ける', at: 2 },
        { text: '取り直し方式の同期が分かる', at: 3 },
      ],
      lines: [
        { t: 'ゴールは三つです。' },
        { t: 'サンプルの、三つのテーブルの役割。', sfx: 'pop' },
        { t: '受け取りの、四つのステップ。', sfx: 'pop' },
        { t: 'そして、届く順番に強い、取り直し方式の同期です。', sfx: 'pop' },
      ],
    },
    {
      kind: 'flow',
      heading: 'サンプルの 3 つのテーブル',
      nodes: [
        { key: 'users', label: 'users', sub: '既存 ＋ stripe_customer_id', x: 360, y: 560, w: 420, tone: 'cyan', icon: 'user', at: 1, mono: true },
        { key: 'subs', label: 'subscriptions', sub: 'Stripe の契約の写し', x: 1180, y: 380, w: 480, tone: 'pink', icon: 'key', at: 2, mono: true },
        { key: 'events', label: 'webhook_events', sub: '受け取った通知の台帳', x: 1180, y: 800, w: 480, tone: 'coral', icon: 'list', at: 3, mono: true },
      ],
      edges: [
        { from: 'users', to: 'subs', label: '1 対 多（解約→再加入）', at: 2, tone: 'pink', fromSide: 'r', toSide: 'l', labelDy: -26 },
        { from: 'events', to: 'subs', label: '同期のきっかけ', at: 3, tone: 'coral', dashed: true, fromSide: 't', toSide: 'b' },
      ],
      lines: [
        { t: 'サンプルアプリの DB には、課金のための置き場所を、三つ用意します。' },
        { t: 'users テーブルには、Stripe の顧客 ID の列を一つ足します。一意にして、一人のユーザーに顧客は一つ。', sfx: 'pop' },
        { t: 'subscriptions テーブルは、Stripe の契約の写しです。解約して再加入すると、一人に複数の行ができます。', sfx: 'pop' },
        { t: 'webhook_events は、受け取った通知の台帳。二回届いた通知を見分けるためのものです。', sfx: 'pop' },
      ],
    },
    {
      kind: 'table',
      heading: 'subscriptions（契約の写し）の列',
      columns: ['列', '中身'],
      widths: [0.42, 0.58],
      mono: [0],
      fontSize: 27,
      rows: [
        { cells: ['id', 'sub_…（主キー）'], at: 1, tone: 'pink' },
        { cells: ['user_id', 'どのユーザーの契約か'], at: 1, tone: 'cyan' },
        { cells: ['status', 'Stripe の status をそのまま'], at: 2, tone: 'mint' },
        { cells: ['price_id', '契約している価格（月額か年額か）'], at: 3, tone: 'amber' },
        { cells: ['current_period_end / cancel_at', 'いつまで使えるか・解約される日時'], at: 4, tone: 'violet' },
        { cells: ['trial_end / updated_at', '無料期間の終わり・最後に同期した時刻'], at: 5, tone: 'slate' },
      ],
      lines: [
        { t: '契約の写しの列を見ておきます。' },
        { t: 'id には、Stripe の sub から始まる ID を、そのまま主キーとして入れます。user_id は、どのユーザーの契約か。' },
        { t: 'status は、Stripe の状態をそのまま写します。' },
        { t: 'price_id で、月額か年額かが分かります。' },
        { t: 'current_period_end と cancel_at で、いつまで使えるか、いつ解約されるかが分かります。' },
        { t: 'trial_end は無料期間の終わり。updated_at は、最後に同期した時刻です。' },
      ],
    },
    {
      kind: 'flow',
      heading: '受け取りの 4 ステップ',
      nodes: [
        { key: 's1', label: '① 署名を検証', sub: '生の本文・ヘッダー・whsec_', x: 260, y: 450, w: 340, h: 140, tone: 'coral', icon: 'shield', at: 1 },
        { key: 's2', label: '② 台帳に INSERT', sub: 'id = evt_…（一意制約）', x: 730, y: 450, w: 340, h: 140, tone: 'amber', icon: 'list', at: 2 },
        { key: 's3', label: '③ 種類ごとに同期', sub: 'processed にして 200', x: 1200, y: 450, w: 340, h: 140, tone: 'mint', icon: 'repeat', at: 3 },
        { key: 's4', label: '④ 例外なら', sub: 'failed（型名だけ）→ 500', x: 1660, y: 450, w: 300, h: 140, tone: 'violet', icon: 'alert', at: 4 },
        { key: 'o1', label: '400', sub: '偽物・改ざん・古すぎる', x: 260, y: 790, w: 340, tone: 'coral', icon: 'x', at: 1 },
        { key: 'o2', label: '200', sub: '処理済み。何もしない', x: 730, y: 790, w: 340, tone: 'slate', icon: 'check', at: 2 },
        { key: 'o3', label: '200', sub: '処理完了', x: 1200, y: 790, w: 340, tone: 'mint', icon: 'check', at: 3 },
        { key: 'o4', label: '再送', sub: 'Stripe が送り直す', x: 1660, y: 790, w: 300, tone: 'violet', icon: 'repeat', at: 4 },
      ],
      edges: [
        { from: 's1', to: 'o1', label: 'NG', at: 1, tone: 'coral', fromSide: 'b', toSide: 't' },
        { from: 's1', to: 's2', label: 'OK', at: 2 },
        { from: 's2', to: 'o2', label: '重複', at: 2, fromSide: 'b', toSide: 't' },
        { from: 's2', to: 's3', label: '初めて', at: 3 },
        { from: 's3', to: 'o3', label: '完了', at: 3, tone: 'mint', fromSide: 'b', toSide: 't' },
        { from: 's3', to: 's4', label: '例外', at: 4, tone: 'violet', dashed: true },
        { from: 's4', to: 'o4', label: '500', at: 4, tone: 'violet', fromSide: 'b', toSide: 't' },
      ],
      lines: [
        { t: '受け取りの手順は、四つのステップです。' },
        { t: 'ステップ1。生の本文と、Stripe-Signature で、construct_event を呼びます。失敗したら 400。', sfx: 'pop' },
        { t: 'ステップ2。台帳に、イベント ID で INSERT。一意制約で失敗したら、もう処理済みなので 200。', sfx: 'pop' },
        { t: 'ステップ3。種類ごとに同期して、同じトランザクションで processed にして、200。', sfx: 'pop' },
        { t: 'ステップ4。途中で例外が起きたら、failed と例外の種類だけを記録して 500。Stripe が送り直してきたら、failed の行は、もう一度処理できるようにします。', sfx: 'pop' },
      ],
    },
    {
      kind: 'code',
      heading: 'FastAPI で書くとこうなる',
      lang: 'python',
      file: 'webhook.py（サンプル）',
      showAt: 0,
      fontSize: 24,
      code: `@router.post("/webhooks/stripe")
async def webhook(request: Request):
    payload = await request.body()            # 生の本文（bytes）
    sig = request.headers.get("Stripe-Signature")
    try:
        event = stripe.Webhook.construct_event(
            payload, sig, settings.STRIPE_WEBHOOK_SECRET)
    except stripe.SignatureVerificationError:
        return Response(status_code=400)
    if not ledger.try_insert(event):    # 処理済みなら False（failed は再処理）
        return Response(status_code=200)
    try:
        dispatch(event)                        # 種類ごとの同期
        ledger.mark(event.id, "processed")
    except Exception as e:
        ledger.mark(event.id, "failed", error=type(e).__name__)
        return Response(status_code=500)
    return Response(status_code=200)`,
      marks: [
        { from: 3, to: 4, at: 1, note: '生の本文と署名ヘッダー', tone: 'coral' },
        { from: 5, to: 9, at: 2, note: '署名が不正なら 400', tone: 'coral' },
        { from: 10, to: 11, at: 3, note: '処理済みなら 200', tone: 'amber' },
        { from: 12, to: 14, at: 4, note: '同期して processed', tone: 'mint' },
        { from: 15, to: 17, at: 5, note: '例外は型名だけ残して 500', tone: 'violet' },
      ],
      lines: [
        { t: 'FastAPI で書くと、こんな形になります。' },
        { t: '大事なのは最初の行。request.body で、生の本文をバイトのまま受け取ります。JSON として受け取ると、署名の検証に失敗します。' },
        { t: '署名が不正なら 400。' },
        { t: '台帳への INSERT が通らなければ、処理済みなので 200。ただし、前回 failed だった行は、もう一度処理します。' },
        { t: '種類ごとに同期して、processed。' },
        { t: '例外が起きたら、failed と、例外の型の名前だけを記録して 500。ログにも、本文やカードの情報は出しません。' },
      ],
    },
    {
      kind: 'code',
      heading: 'イベントの振り分け',
      lang: 'python',
      file: 'webhook.py（サンプル）',
      showAt: 0,
      fontSize: 30,
      code: `def dispatch(event) -> None:
    obj = event.data.object
    if event.type == "checkout.session.completed":
        if obj.mode == "subscription":
            sync_subscription(obj.subscription)
    elif event.type.startswith("customer.subscription."):
        sync_subscription(obj.id)
    elif event.type == "invoice.payment_failed":
        notify_payment_failed(obj.customer)   # 記録と連絡だけ`,
      marks: [
        { from: 3, to: 5, at: 1, note: 'できた契約を同期', tone: 'violet' },
        { from: 6, to: 7, at: 2, note: 'その sub_… を同期するだけ', tone: 'pink' },
        { from: 8, to: 9, at: 3, note: '請求書のイベントは記録と連絡', tone: 'slate' },
      ],
      lines: [
        { t: '種類ごとの振り分けは、これくらいで十分です。' },
        { t: 'Checkout の完了なら、できあがった契約の ID を取り出して、同期します。' },
        { t: 'customer.subscription で始まるイベントは、どれも、その契約を同期するだけ。作成でも、更新でも、削除でも、やることは同じです。', sfx: 'chime' },
        { t: '支払い失敗のような請求書のイベントは、記録と、ユーザーへの連絡だけにします。' },
      ],
    },
    {
      kind: 'code',
      heading: '取り直し方式の同期関数',
      lang: 'python',
      file: 'billing.py（サンプル）',
      showAt: 0,
      fontSize: 25,
      code: `def sync_subscription(sub_id: str) -> None:
    sub = stripe.Subscription.retrieve(sub_id)   # 最新の状態を取り直す
    user = users.find_by_customer(sub.customer)
    if user is None:
        log.warning("unknown customer")          # 知らない顧客は無視
        return
    item = sub["items"]["data"][0]               # basil 以降は items 側
    subscriptions.upsert(
        id=sub.id,
        user_id=user.id,
        status=sub.status,
        price_id=item.price.id,
        current_period_end=item.current_period_end,
        cancel_at=sub.cancel_at,
        trial_end=sub.trial_end,
    )`,
      marks: [
        { from: 2, to: 2, at: 1, note: 'イベントの中身ではなく最新を取る', tone: 'cyan' },
        { from: 3, to: 6, at: 2, note: '知らない顧客＝偽物の疑い', tone: 'coral' },
        { from: 7, to: 7, at: 3, note: '期間は items 側から読む', tone: 'amber' },
        { from: 8, to: 16, at: 4, note: 'sub_… で upsert。何回・どの順でも同じ結果', tone: 'mint' },
      ],
      lines: [
        { t: 'そして、同期の関数です。' },
        { t: 'まず、イベントの中身ではなく、Stripe から最新の Subscription を取り直します。' },
        { t: '顧客 ID から、アプリのユーザーを引きます。知らない顧客なら、無視してログだけ残します。偽の通知で Pro にされるのを防ぐためです。' },
        { t: '期間の日付は、basil 以降なので、items の側から読みます。' },
        { t: 'そして、sub の ID で upsert。何回呼ばれても、どの順番で呼ばれても、結果は同じです。', sfx: 'chime' },
        { t: 'この関数を、Webhook からも、完了ページの sync からも呼びます。これは公式の、フルフィルメントのガイドが勧めている形そのものです。' },
      ],
    },
    {
      kind: 'sequence',
      heading: 'Webhook と完了ページが同時に動いても',
      actors: [
        { key: 'wh', label: 'Webhook 受信', sub: 'webhook.py', tone: 'coral', icon: 'bell' },
        { key: 'stripe', label: 'Stripe API', sub: '最新の状態', tone: 'cyan', icon: 'card' },
        { key: 'sync', label: '完了ページの sync', sub: 'POST /billing/sync', tone: 'pink', icon: 'browser' },
        { key: 'db', label: '契約の写し', sub: 'subscriptions', tone: 'mint', icon: 'database' },
      ],
      steps: [
        { from: 'wh', to: 'stripe', label: 'sub_… を取り直す', at: 1, tone: 'coral' },
        { from: 'sync', to: 'stripe', label: 'Session を取り直して本人か照合', at: 2, tone: 'pink' },
        { from: 'wh', to: 'db', label: 'upsert（sub_… の最新）', at: 3, tone: 'mint' },
        { from: 'sync', to: 'db', label: 'upsert（同じ sub_… の最新）', at: 3, tone: 'mint' },
      ],
      lines: [
        { t: 'Webhook と、完了ページの sync が、同時に走ったらどうなるでしょう。' },
        { t: 'Webhook の側は、Stripe から sub を取り直します。' },
        { t: 'sync の側は、Session を取り直して、client_reference_id と customer が本人のものか確かめてから、同じ sub を取り直します。' },
        { t: 'どちらも、同じ sub の、Stripe の最新状態で upsert するので、最後の状態は一致します。ただ、初めての書き込みが同時に起きると、一意制約で片方が失敗します。そのときは更新に切り替えれば大丈夫です。', sfx: 'chime' },
      ],
    },
    {
      kind: 'recap',
      heading: 'まとめ',
      items: [
        { text: '① 署名 → ② 台帳 → ③ 同期 → ④ 例外は 500', at: 1 },
        { text: '契約のイベントは「sub_… を取り直して upsert」だけ', at: 2 },
        { text: 'Webhook と完了ページで同じ同期関数を使う', at: 3 },
      ],
      lines: [
        { t: 'まとめです。' },
        { t: '受け取りは、署名、台帳、同期、そして例外なら 500 の四ステップ。', sfx: 'pop' },
        { t: '契約のイベントは、sub を取り直して upsert するだけ。届く順番に強くなります。', sfx: 'pop' },
        { t: 'そして、Webhook と完了ページで、同じ同期関数を使います。', sfx: 'pop' },
      ],
    },
    {
      kind: 'ending',
      next: { no: 9, title: '使えるかの判定と Customer Portal' },
      lines: [{ t: '次は、写した契約を使って Pro の機能を開ける判定と、契約の管理ページを作ります。' }],
    },
  ],
};
