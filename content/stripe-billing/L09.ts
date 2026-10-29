import type { Lecture } from '../types';

export const L09: Lecture = {
  id: 'L09',
  no: 9,
  section: { no: 3, title: 'サンプルで作る' },
  title: '使えるかの判定と Customer Portal',
  summary: 'DB だけを見る判定関数、権利をアプリの DB で判定する理由、Customer Portal の作り方と、解約・プラン変更・日割りの動き。',
  docs: [
    { title: 'Stripe: エンタイトルメント（内部で保持する推奨）', url: 'https://docs.stripe.com/billing/entitlements' },
    { title: 'Stripe: カスタマーポータル', url: 'https://docs.stripe.com/customer-management' },
    { title: 'Stripe: カスタマーポータルの組み込み', url: 'https://docs.stripe.com/customer-management/integrate-customer-portal' },
    { title: 'Stripe: プランの変更（アップグレード・ダウングレード）', url: 'https://docs.stripe.com/billing/subscriptions/change' },
    { title: 'Stripe: 日割り（プロレーション）', url: 'https://docs.stripe.com/billing/subscriptions/prorations' },
  ],
  quiz: [
    {
      q: '判定関数が Stripe の API を呼ぶのは？',
      choices: ['機能が使われるたびに毎回', '基本は呼ばない（DB だけを見る）', 'ログインのたび', '月に 1 回'],
      answer: 1,
      explain: '毎回呼ぶと遅く、Stripe が落ちると機能も止まる。取りこぼしが心配なら、期間切れなのに有効な行だけ取り直す。',
    },
    {
      q: 'Customer Portal の URL はいつ作る？',
      choices: ['ユーザー登録のとき 1 回', '「プランを管理」が押されるたびに', '月に 1 回', '作らない'],
      answer: 1,
      explain: 'ポータルのセッションは短い時間で切れる。押されるたびに作って、すぐ移動させる。',
    },
    {
      q: 'Portal で「期間の終わりに解約」したとき、まず届くのは？',
      choices: ['customer.subscription.deleted', 'customer.subscription.updated（cancel_at に期間末）', 'invoice.voided', '何も届かない'],
      answer: 1,
      explain: '期間の終わりまでは使える。期間の終わりに customer.subscription.deleted が届いて canceled になる。',
    },
  ],
  takeaways: [
    'has_pro(user)：status が trialing・active（past_due はサービスの判断）で、期間の終わり＋猶予を過ぎていない行が 1 つでもあるか',
    'Portal は Dashboard で「できること」を設定してから、押されるたびに billing_portal.Session を作る',
    'Portal での解約・プラン変更も customer.subscription.updated で届く。同期関数はそのまま使える',
    '日割りの差額は既定で次の請求書に載る。すぐ請求するなら proration_behavior=always_invoice。flexible で請求日を今日に揃えるなら billing_cycle_anchor=now',
    'Portal のプラン変更と数量変更は既定でオフ。設定で有効にして、切り替え先の価格を選んでおく',
  ],
  scenes: [
    {
      kind: 'opening',
      section: 'SECTION 3　サンプルで作る',
      title: '使えるかの判定と Customer Portal',
      subtitle: 'DB を見て開ける・管理は Stripe に借りる',
      lines: [
        { t: 'レクチャー9。使えるかの判定と、Customer Portal。', v: 'announcer', pause: 0.3 },
        { t: '写した契約を使って Pro の機能を開け、契約の管理は、Stripe の画面に任せます。' },
      ],
    },
    {
      kind: 'goals',
      heading: 'このレクチャーのゴール',
      items: [
        { text: '使えるかの判定関数が書ける', at: 1 },
        { text: '判定をアプリの DB で行う理由が分かる', at: 2 },
        { text: 'Portal での解約とプラン変更の動きが分かる', at: 3 },
      ],
      lines: [
        { t: 'ゴールは三つです。' },
        { t: '使えるかどうかの、判定関数。', sfx: 'pop' },
        { t: '判定を、アプリの DB で行う理由。', sfx: 'pop' },
        { t: 'そして、Portal での解約と、プラン変更の動きです。', sfx: 'pop' },
      ],
    },
    {
      kind: 'code',
      heading: '使えるかの判定関数',
      lang: 'python',
      file: 'billing.py（サンプル）',
      showAt: 0,
      fontSize: 30,
      code: `ENTITLED = {"trialing", "active", "past_due"}
GRACE = timedelta(days=1)

def has_pro(user_id: int, now: datetime) -> bool:
    for row in subscriptions.list_by_user(user_id):
        if row.status not in ENTITLED:
            continue
        if row.current_period_end + GRACE < now:
            continue      # 期間切れ。取りこぼしかも
        return True
    return False`,
      marks: [
        { from: 1, to: 1, at: 1, note: '使える状態（past_due は判断）', tone: 'mint' },
        { from: 2, to: 2, at: 2, note: '更新の処理を待つ猶予', tone: 'amber' },
        { from: 5, to: 5, at: 3, note: '再加入した人は行が複数', tone: 'violet' },
        { from: 6, to: 7, at: 4, note: '使えない状態は飛ばす', tone: 'slate' },
        { from: 8, to: 9, at: 5, note: '期間切れの行は使えない', tone: 'coral' },
        { from: 10, to: 10, at: 6, note: '1 行でも当てはまれば Pro', tone: 'pink' },
      ],
      lines: [
        { t: 'まずは、Pro の機能を開けてよいかの判定です。' },
        { t: '使える状態は、trialing と active。past_due を入れるかは、サービスの判断です。ここでは猶予として入れています。' },
        { t: 'GRACE は、更新の処理を待つ猶予です。期間の終わりちょうどに、更新の通知が届くとは限らないからです。', s: 'グレースは、更新の処理を待つ猶予です。期間の終わりちょうどに、更新の通知が届くとは限らないからです。' },
        { t: 'ユーザーの契約の行を、順に見ていきます。解約して再加入した人は、行が複数あります。' },
        { t: '状態が使えないものは、飛ばします。' },
        { t: '期間の終わりから猶予を過ぎても有効のまま残っている行は、通知を取りこぼしたのかもしれません。ここでは使えないことにして、気になるなら、Stripe から取り直す処理を足します。' },
        { t: '一行でも当てはまれば Pro です。判定は DB を読むだけなので、速くて止まりません。', sfx: 'chime' },
      ],
    },
    {
      kind: 'points',
      heading: 'なぜ判定はアプリの DB で行うのか',
      columns: 3,
      numbered: true,
      items: [
        { title: '速い・止まらない', body: '機能を使うたびに Stripe を呼ばない。Stripe が落ちても判定は止まらない', at: 1, tone: 'mint', icon: 'zap' },
        { title: 'ほかの条件と並べられる', body: '回数の上限やお試しの判定と、同じ場所で決められる', at: 2, tone: 'violet', icon: 'scale' },
        { title: 'Stripe も推奨している', body: '公式「エンタイトルメントは内部で保持することをおすすめ」', at: 3, tone: 'cyan', icon: 'book' },
      ],
      lines: [
        { t: 'なぜ、使えるかの判定を、自分の DB で行うのか。理由は三つあります。' },
        { t: '一つ目、速くて止まらない。機能を使うたびに Stripe の API を呼ぶと遅いし、Stripe が落ちたら、機能も止まってしまいます。', sfx: 'pop' },
        { t: '二つ目、ほかの条件と並べられる。回数の上限や、お試しの判定と、同じ場所で決められます。', sfx: 'pop' },
        { t: '三つ目、Stripe 自身もそれを勧めています。公式ドキュメントに、エンタイトルメントは内部で保持することをおすすめします、と書かれています。', sfx: 'pop' },
      ],
    },
    {
      kind: 'points',
      heading: 'Customer Portal でできること',
      columns: 2,
      items: [
        { title: '支払い方法の更新', body: 'カードの期限が切れても、ユーザーが自分で変えられる', at: 1, tone: 'cyan', icon: 'card' },
        { title: '請求履歴と領収書', body: '過去の請求書を見て、ダウンロードできる', at: 2, tone: 'slate', icon: 'receipt' },
        { title: '解約', body: '期間の終わりか、すぐにか。解約の理由も集められる', at: 3, tone: 'coral', icon: 'x' },
        { title: 'プランの変更', body: '既定はオフ。有効にすると、許可した価格へ切り替えられる', at: 4, tone: 'amber', icon: 'repeat' },
      ],
      lines: [
        { t: 'Customer Portal は、Stripe が用意する、契約の管理ページです。できることは、ダッシュボードの設定で選びます。' },
        { t: 'カードの期限が切れても、ユーザーが自分で、新しいカードに変えられます。', sfx: 'pop' },
        { t: '過去の請求書を見て、領収書をダウンロードできます。', sfx: 'pop' },
        { t: '解約もできます。期間の終わりに解約するか、すぐに解約するかは、設定で決めます。解約の理由を集めることもできます。', sfx: 'pop' },
        { t: 'プランの変更もできます。既定ではオフなので、設定で有効にして、切り替え先の価格を選んでおきます。', sfx: 'pop' },
      ],
    },
    {
      kind: 'code',
      heading: 'Portal へ移動させるコード',
      lang: 'python',
      file: 'billing.py（サンプル）',
      showAt: 0,
      fontSize: 30,
      code: `@router.post("/billing/portal")
def create_portal(user=Depends(current_user)):
    session = stripe.billing_portal.Session.create(
        customer=user.stripe_customer_id,
        return_url=f"{APP_URL}/account",
    )
    return {"url": session.url}   # すぐ切れるので、押すたびに作る`,
      marks: [
        { from: 3, to: 4, at: 1, note: 'このユーザーの cus_', tone: 'cyan' },
        { from: 5, to: 5, at: 2, note: '操作が終わったら戻る先', tone: 'mint' },
        { from: 7, to: 7, at: 3, note: '押すたびに作る', tone: 'amber' },
      ],
      lines: [
        { t: 'Portal へ移動させるコードは、これだけです。' },
        { t: 'このユーザーの顧客 ID を渡して、ポータルのセッションを作ります。' },
        { t: 'return_url は、ポータルでの操作が終わったときの戻り先です。' },
        { t: '返ってきた URL は、短い時間で使えなくなります。だから、プランを管理する、が押されるたびに作って、すぐ移動させます。', sfx: 'chime' },
      ],
    },
    {
      kind: 'sequence',
      heading: 'Portal で解約すると',
      actors: [
        { key: 'user', label: 'ユーザー', sub: 'Portal で解約', tone: 'pink', icon: 'user' },
        { key: 'stripe', label: 'Stripe', sub: '契約を変える', tone: 'cyan', icon: 'card' },
        { key: 'app', label: 'アプリ', sub: '/webhooks/stripe', tone: 'violet', icon: 'server' },
        { key: 'db', label: '契約の写し', sub: 'subscriptions', tone: 'mint', icon: 'database' },
      ],
      steps: [
        { from: 'user', to: 'stripe', label: '期間の終わりに解約', at: 1 },
        { from: 'stripe', to: 'app', label: 'customer.subscription.updated', at: 2, tone: 'coral' },
        { from: 'app', to: 'db', label: 'cancel_at = 期間の終わり', at: 2, tone: 'mint' },
        { from: 'stripe', to: 'app', label: '期間の終わり：…deleted', at: 3, tone: 'coral' },
        { from: 'app', to: 'db', label: 'status = canceled', at: 3, tone: 'mint' },
      ],
      lines: [
        { t: 'ポータルで解約されたとき、アプリには何が届くのでしょう。' },
        { t: 'ユーザーが、期間の終わりに解約、を選びます。' },
        { t: 'すぐに customer.subscription.updated が届いて、写しの cancel_at に、期間の終わりの日時が入ります。まだ使えます。' },
        { t: '期間の終わりに、customer.subscription.deleted が届いて、status が canceled に。ここで使えなくなります。', sfx: 'chime' },
      ],
    },
    {
      kind: 'compare',
      heading: 'プランを変えたときの日割り',
      left: {
        title: '既定のまま',
        sub: 'proration_behavior=create_prorations',
        tone: 'cyan',
        icon: 'repeat',
        at: 1,
        items: [
          { text: '差額は日割りで計算', at: 1 },
          { text: '次の請求書にまとめて載る', at: 1 },
        ],
      },
      right: {
        title: 'すぐ請求したいとき',
        sub: 'always_invoice ／ billing_cycle_anchor=now',
        tone: 'amber',
        icon: 'calendar',
        at: 2,
        items: [
          { text: 'その場で請求書を作って請求する', at: 2 },
          { text: '月額 → 年額で請求日を今日にするなら、起点も明示（flexible）', at: 2 },
        ],
      },
      verdict: { text: 'どちらも customer.subscription.updated で届く。同期関数はそのまま使える', at: 3, tone: 'mint' },
      lines: [
        { t: 'プランを変えたときの、お金の動きも押さえておきましょう。' },
        { t: 'プランを変えると、差額は日割りで計算されて、既定では、次の請求書にまとめて載ります。' },
        { t: 'その場で請求したいなら、proration_behavior を always_invoice にします。月額から年額に変えて、請求の日を今日に揃えたいときは、今の既定の flexible では、billing_cycle_anchor を now にして、はっきり指定します。' },
        { t: 'どちらの場合も、アプリには customer.subscription.updated が届くだけ。同期の関数は、そのまま使えます。', sfx: 'chime' },
      ],
    },
    {
      kind: 'recap',
      heading: 'まとめ',
      items: [
        { text: 'has_pro は DB だけを見る（状態 × 期間）', at: 1 },
        { text: 'Portal は押されるたびにセッションを作って移動', at: 2 },
        { text: '解約も変更も、契約の同期でそのまま反映', at: 3 },
      ],
      lines: [
        { t: 'まとめです。' },
        { t: '判定の関数は、DB だけを見て、状態と期間で決めます。', sfx: 'pop' },
        { t: 'Portal は、押されるたびにセッションを作って、移動させます。', sfx: 'pop' },
        { t: '解約もプランの変更も、契約の同期で、そのまま反映されます。', sfx: 'pop' },
      ],
    },
    {
      kind: 'ending',
      next: { no: 10, title: 'テストと本番への切り替え' },
      lines: [{ t: '次は、作ったものを、お金を動かさずに確かめる方法と、本番への切り替えです。' }],
    },
  ],
};
