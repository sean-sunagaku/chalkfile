import type { Lecture } from '../types';

export const L07: Lecture = {
  id: 'L07',
  no: 7,
  section: { no: 3, title: 'サンプルで作る' },
  title: 'Webhook　あとから届く通知と 4 つの約束',
  summary: '順番・重複・偽物・すぐ返事の 4 つの約束と対策、受け取るイベント、Snapshot と Thin の違い。',
  docs: [
    { title: 'Stripe: Webhook でイベントを受信する（署名・再送・ベストプラクティス）', url: 'https://docs.stripe.com/webhooks' },
    { title: 'Stripe: イベントの仕組み（Snapshot と Thin）', url: 'https://docs.stripe.com/events/how-events-work' },
    { title: 'Stripe: サブスクリプションで Webhook を使う', url: 'https://docs.stripe.com/billing/subscriptions/webhooks' },
    { title: 'Stripe API: Thin イベントの一覧', url: 'https://docs.stripe.com/api/v2/core/events/event-types' },
  ],
  quiz: [
    {
      q: 'Webhook の順番について正しいのは？',
      choices: ['必ず起きた順に届く', 'created を比べれば順番が分かる', '順番は保証されないので、取り直した最新状態で書く', 'invoice.paid は必ず最後に届く'],
      answer: 2,
      explain: 'created は秒単位で同じ値もあるので、公式は created で順序や処理済みを判断しないよう求めている。',
    },
    {
      q: '署名の検証に必要なものは？',
      choices: ['整形し直した JSON と API キー', '生のリクエスト本文・Stripe-Signature ヘッダー・whsec_', 'ログインの ID トークン', '送信元 IP だけ'],
      answer: 1,
      explain: '本文を加工すると検証は失敗する。IP 許可リストは併用の守り。',
    },
    {
      q: '本番で Webhook の返事が失敗し続けたとき、自動の再送は？',
      choices: ['再送しない', '1 時間だけ', '指数バックオフで最長 3 日', '30 日間'],
      answer: 2,
      explain: 'サンドボックスでは数時間のうちに 3 回。手動の再送はダッシュボードで 15 日、CLI で 30 日まで。',
    },
  ],
  takeaways: [
    'エンドポイントは 1 つ（例: POST /webhooks/stripe）。ログインの認証は通さず、署名で守る',
    'Event ID を主キーにした台帳に INSERT できたときだけ処理する（処理済みなら 200 で何もしない。前回失敗した通知は処理し直す）',
    '公式（2026-10 確認）：created で順序を決めない・Snapshot は古い可能性がある・新しい実装には Thin を推奨',
    '購読するイベントは必要なものだけに絞る',
    'Thin で受けるときは construct_event ではなく、StripeClient の parse_event_notification で受ける',
  ],
  scenes: [
    {
      kind: 'opening',
      section: 'SECTION 3　サンプルで作る',
      title: 'Webhook　あとから届く通知',
      subtitle: '守るべき 4 つの約束',
      lines: [
        { t: 'レクチャー7。Webhook、あとから届く通知。', v: 'announcer', pause: 0.3 },
        { t: 'Webhook は、Stripe からアプリのサーバーへの、あとから届く電話のようなものです。便利ですが、クセがあります。' },
      ],
    },
    {
      kind: 'goals',
      heading: 'このレクチャーのゴール',
      items: [
        { text: 'Webhook の 4 つの約束と対策', at: 1 },
        { text: 'サブスクで受け取るイベント', at: 2 },
        { text: 'Snapshot と Thin の違い', at: 3 },
      ],
      lines: [
        { t: 'ゴールは三つです。' },
        { t: 'Webhook の四つの約束と、その対策。', sfx: 'pop' },
        { t: 'サブスクで受け取るイベントの種類。', sfx: 'pop' },
        { t: 'そして、通知の二つの形式、Snapshot と Thin の違いです。', sfx: 'pop' },
      ],
    },
    {
      kind: 'sequence',
      heading: 'Webhook のしくみ',
      actors: [
        { key: 'stripe', label: 'Stripe', sub: '何かが起きた', tone: 'cyan', icon: 'card' },
        { key: 'app', label: 'アプリ', sub: '/webhooks/stripe', tone: 'violet', icon: 'server' },
        { key: 'db', label: 'アプリの DB', sub: '台帳と契約の写し', tone: 'mint', icon: 'database' },
      ],
      steps: [
        { from: 'stripe', to: 'app', label: 'POST（Event 1 件）', at: 1, tone: 'coral' },
        { from: 'app', to: 'db', label: '記録して状態を書く', at: 2, tone: 'mint' },
        { from: 'app', to: 'stripe', label: '200 OK', at: 3, dashed: true },
      ],
      lines: [
        { t: '仕組みはシンプルです。' },
        { t: 'Stripe で何かが起きると、Stripe がアプリの URL に、HTTP の POST を送ってきます。中身はイベント一件分です。' },
        { t: 'アプリは、それを記録して、契約の状態を DB に書きます。' },
        { t: 'そして、受け取りましたよ、と 200 を返します。返事がないと、Stripe は失敗とみなして、送り直してきます。' },
      ],
    },
    {
      kind: 'points',
      heading: '守るべき 4 つの約束',
      columns: 2,
      numbered: true,
      items: [
        { title: '順番は保証されない', body: '取り直した最新の状態で上書きする', at: 1, tone: 'cyan', icon: 'route' },
        { title: '同じ通知が 2 回来る', body: 'Event ID を台帳に残し、2 回目は何もしない', at: 2, tone: 'amber', icon: 'repeat' },
        { title: '偽物が来るかもしれない', body: 'Stripe-Signature を whsec_ で検証する', at: 3, tone: 'coral', icon: 'shield' },
        { title: 'すぐ返事しないと失敗扱い', body: '重い処理は後回しにして、手早く 200 を返す', at: 4, tone: 'mint', icon: 'zap' },
      ],
      lines: [
        { t: 'Webhook には、守るべき四つの約束があります。まず一覧で見て、それから一つずつ深掘りします。' },
        { t: '一つ目、順番は保証されない。', sfx: 'pop' },
        { t: '二つ目、同じ通知が二回来ることがある。', sfx: 'pop' },
        { t: '三つ目、偽物が来るかもしれない。', sfx: 'pop' },
        { t: '四つ目、すぐに返事をしないと、失敗扱いになる。', sfx: 'pop' },
      ],
    },
    {
      kind: 'compare',
      heading: '約束 1　順番は保証されない',
      left: {
        title: 'Stripe の中で起きた順',
        tone: 'slate',
        icon: 'list',
        at: 0,
        items: [
          { text: '① customer.subscription.created', at: 0 },
          { text: '② invoice.created', at: 0 },
          { text: '③ invoice.paid', at: 0 },
        ],
      },
      right: {
        title: '届いた順（例）',
        tone: 'coral',
        icon: 'route',
        at: 1,
        items: [
          { text: '③ invoice.paid', at: 1 },
          { text: '① customer.subscription.created', at: 1 },
          { text: '② invoice.created', at: 1 },
        ],
      },
      verdict: { text: 'created（秒単位）で順番を決めない。API で取り直した最新の状態で書く', at: 2, tone: 'cyan' },
      lines: [
        { t: '一つ目の約束、順番です。サブスクを作ると、Stripe の中では、契約の作成、請求書の作成、支払い成功、の順に起きます。' },
        { t: 'でも、届く順番はバラバラです。支払い成功が、契約の作成より先に届くこともあります。', sfx: 'pop' },
        { t: '公式ドキュメントは、はっきり言っています。イベントの created は秒単位なので、同じ時刻になることもある。だから、created で順番を決めないこと。', sfx: 'chime' },
        { t: '対策は、届いた順に上書きするのではなく、Stripe の API で取り直した、最新の状態で書くことです。' },
      ],
    },
    {
      kind: 'code',
      heading: '約束 2　同じ通知が 2 回来る',
      lang: 'python',
      file: 'webhook.py（考え方）',
      showAt: 0,
      fontSize: 30,
      code: `def handle(event):
    try:
        ledger.insert(id=event.id, type=event.type,
                      status="received")   # evt_… が主キー
    except UniqueViolation:
        if ledger.status(event.id) == "processed":
            return 200      # 処理済みの通知。何もしない
        # 前回 failed のまま残った通知は、もう一度処理する
    sync_subscription(event)  # 状態を書く
    ledger.mark_processed(event.id)
    return 200`,
      marks: [
        { from: 2, to: 4, at: 1, note: 'evt_… を主キーで記録', tone: 'amber' },
        { from: 5, to: 7, at: 2, note: '処理済みなら何もしない', tone: 'coral' },
        { from: 8, to: 11, at: 3, note: 'failed だけは処理し直す', tone: 'mint' },
      ],
      lines: [
        { t: '二つ目の約束、重複です。Stripe は、少なくとも一回は届ける、という方式なので、同じ通知が二回来ることがあります。' },
        { t: '対策は、イベント ID を台帳に記録すること。ID を主キーにして、受け取った瞬間に書き込みます。' },
        { t: '二回目に来たときは、一意制約で書き込みが失敗します。処理済みなら、何もせず 200 を返します。これを冪等性と言います。', sfx: 'chime' },
        { t: 'ただし、前回の処理が失敗して failed のまま残っていた通知だけは、もう一度処理します。これで、何回届いても、結果は同じになります。' },
      ],
    },
    {
      kind: 'flow',
      heading: '約束 3　偽物が来るかもしれない',
      nodes: [
        { key: 'stripe', label: 'Stripe', sub: '1 件ずつ署名する', x: 330, y: 470, tone: 'cyan', icon: 'card', at: 1 },
        { key: 'header', label: 'Stripe-Signature', sub: 't=時刻, v1=署名（HMAC-SHA256）', x: 960, y: 470, w: 560, tone: 'amber', icon: 'key', at: 2, mono: true },
        { key: 'verify', label: 'construct_event()', sub: '生の本文 ＋ whsec_ で検証', x: 1590, y: 470, w: 420, tone: 'violet', icon: 'shield', at: 3, mono: true },
        { key: 'ok', label: '正しい', sub: '処理へ進む', x: 1590, y: 780, tone: 'mint', icon: 'check', at: 4 },
        { key: 'ng', label: '偽物・改ざん・古すぎる', sub: '400 を返す', x: 1040, y: 780, w: 440, tone: 'coral', icon: 'x', at: 4 },
      ],
      edges: [
        { from: 'stripe', to: 'header', label: '本文と一緒に送る', at: 2 },
        { from: 'header', to: 'verify', label: '検証', at: 3 },
        { from: 'verify', to: 'ok', at: 4, tone: 'mint' },
        { from: 'verify', to: 'ng', at: 4, tone: 'coral', fromSide: 'b', toSide: 'r' },
      ],
      lines: [
        { t: '三つ目の約束、偽物対策です。Webhook の URL は公開されているので、誰でも POST できてしまいます。' },
        { t: 'そこで Stripe は、通知の一件一件に署名をつけます。', sfx: 'pop' },
        { t: '署名は、Stripe-Signature というヘッダーに、時刻と一緒に入っています。', sfx: 'pop' },
        { t: 'アプリは、署名シークレット、whsec から始まる鍵と、加工していない生の本文で検証します。本文を JSON に読み直したりすると、検証に失敗するので注意です。', sfx: 'pop' },
        { t: '正しければ処理へ。偽物なら 400 を返します。' },
        { t: '時刻も署名に含まれるので、古すぎる通知も弾けます。ライブラリの既定は、五分の許容です。', sfx: 'chime' },
      ],
    },
    {
      kind: 'table',
      heading: '約束 4　すぐ返事をする（再送のしくみ）',
      columns: ['場面', '内容'],
      widths: [0.34, 0.66],
      rows: [
        { cells: ['本番の自動再送', '間隔を広げながら最長 3 日'], at: 1, tone: 'cyan' },
        { cells: ['サンドボックスの自動再送', '数時間のうちに 3 回'], at: 2, tone: 'mint' },
        { cells: ['手動の再送', 'ダッシュボードは 15 日以内・CLI は 30 日以内'], at: 3, tone: 'amber' },
        { cells: ['アプリの返し方', '台帳に書けたら 200・署名不正は 400・例外は 500'], at: 4, tone: 'violet' },
      ],
      lines: [
        { t: '四つ目の約束、すぐに返事をすることです。重い処理をしてから返事をすると、タイムアウトして失敗扱いになります。' },
        { t: '失敗すると、本番では、間隔を広げながら、最長三日間送り直してくれます。' },
        { t: 'サンドボックスでは、数時間のうちに三回です。' },
        { t: 'あとから手で送り直すこともできます。ダッシュボードなら十五日以内、CLI なら三十日以内です。' },
        { t: 'アプリは、台帳に書けたら 200、署名が不正なら 400、途中で例外が起きたら 500 を返して、Stripe に送り直してもらいます。' },
      ],
    },
    {
      kind: 'table',
      heading: 'サブスクで受け取る主なイベント',
      columns: ['イベント', '意味', 'アプリの処理（例）'],
      widths: [0.42, 0.26, 0.32],
      mono: [0],
      fontSize: 26,
      rows: [
        { cells: ['checkout.session.completed', '支払いページが完了', 'user_id と契約を結ぶ'], at: 1, tone: 'violet' },
        { cells: ['customer.subscription.created / updated / deleted / paused / resumed', '契約の作成・変更・終了・停止・再開', '契約を DB に同期（本命）'], at: 2, tone: 'pink' },
        { cells: ['invoice.paid / payment_failed / payment_action_required', '毎回の支払い成功・失敗・認証待ち', '記録とユーザーへの連絡'], at: 3, tone: 'slate' },
        { cells: ['customer.subscription.trial_will_end', '無料期間が 3 日後に終わる', '案内を出す（メールは Stripe でも可）'], at: 4, tone: 'mint' },
        { cells: ['charge.refunded / charge.dispute.created', '返金・チャージバック', '記録して運営に知らせる。権利は人が判断'], at: 5, tone: 'coral' },
      ],
      lines: [
        { t: 'サブスクで受け取る、主なイベントです。必要なものだけ購読するのが、公式のおすすめです。' },
        { t: 'checkout.session.completed で、どのユーザーが契約したかを結びつけます。' },
        { t: '本命は、customer.subscription の created、updated、deleted、それに paused と resumed。契約の状態を DB に同期します。', sfx: 'chime' },
        { t: 'invoice の paid、payment_failed、payment_action_required は、記録や、ユーザーへの連絡に使います。状態の変化は、subscription の側で同期されるからです。' },
        { t: 'trial_will_end は、無料期間が終わる三日前に届きます。' },
        { t: '返金とチャージバックは、記録して運営に知らせ、権利をどうするかは人が判断します。' },
      ],
    },
    {
      kind: 'compare',
      heading: '通知の 2 つの形式',
      left: {
        title: 'Snapshot',
        sub: '全文入り（従来型）',
        tone: 'amber',
        icon: 'file',
        at: 1,
        items: [
          { text: 'その時点のオブジェクトの写しが入る', at: 1 },
          { text: 'API バージョンで形が変わる', at: 1 },
          { text: 'previous_attributes で変化が分かる', at: 1 },
        ],
      },
      right: {
        title: 'Thin',
        sub: 'ID だけ（新しい形式）',
        tone: 'cyan',
        icon: 'link',
        at: 2,
        items: [
          { text: '種類と ID だけ。中身は API で取り直す', at: 2 },
          { text: 'バージョン管理が要らない', at: 2 },
          { text: '公式は新しい実装に推奨（2026-10）', at: 3 },
        ],
      },
      verdict: { text: 'どちらでも「通知はきっかけ、状態は取り直す」と決めれば迷わない', at: 4, tone: 'violet' },
      lines: [
        { t: '最後に、通知の形式です。Snapshot と Thin の二種類があります。' },
        { t: 'Snapshot は全文入り。イベントが起きた時点の、オブジェクトの写しが入っています。ただし、処理する頃には古くなっているかもしれません。' },
        { t: 'Thin は、種類と ID だけの軽い通知。中身は API で取り直す前提で、バージョン管理もいりません。' },
        { t: '公式ドキュメントでは、新しい実装には Thin がおすすめと書かれていて、サブスク系の Thin イベントも一覧に並んでいます。' },
        { t: 'この講座のサンプルは、受け取りの手順が少ない Snapshot で受けて、中身は必ず取り直します。Thin に切り替えても、通知はきっかけ、状態は取り直す、という考え方はそのまま使えます。', sfx: 'chime' },
      ],
    },
    {
      kind: 'recap',
      heading: 'まとめ',
      items: [
        { text: '順番はバラバラ → 取り直した最新の状態で書く', at: 1 },
        { text: '2 回来る → Event ID の台帳で 2 回目は何もしない', at: 2 },
        { text: '偽物 → 生の本文と whsec_ で署名を検証', at: 3 },
        { text: 'すぐ 200 → 失敗しても最長 3 日の再送', at: 4 },
      ],
      lines: [
        { t: 'まとめです。四つの約束を、もう一度。' },
        { t: '順番はバラバラなので、取り直した最新の状態で書く。', sfx: 'pop' },
        { t: '二回来るので、イベント ID の台帳で、二回目は何もしない。', sfx: 'pop' },
        { t: '偽物が来るので、生の本文と whsec で署名を検証する。', sfx: 'pop' },
        { t: 'そして、すぐ 200 を返す。失敗しても、最長三日は送り直してくれます。', sfx: 'pop' },
      ],
    },
    {
      kind: 'ending',
      next: { no: 8, title: 'Webhook を受けて DB に写す' },
      lines: [{ t: '次は、この四つの約束を、サンプルアプリのコードに落とし込みます。' }],
    },
  ],
};
