// 講座の出典と公式リンクの表。章は ID から引き、訳は説明の上書きだけを持つ。
import { defineSources } from '../sources-util';

export const SOURCE_TABLE = defineSources([
  {
    "id": "l-doc-001",
    "title": "Stripe: サブスクリプションの仕組み",
    "url": "https://docs.stripe.com/billing/subscriptions/overview"
  },
  {
    "id": "l-doc-002",
    "title": "Stripe: サブスクリプションの組み込み（Checkout を使う）",
    "url": "https://docs.stripe.com/billing/subscriptions/build-subscriptions"
  },
  {
    "id": "l-doc-003",
    "title": "Stripe: Billing",
    "url": "https://docs.stripe.com/billing"
  },
  {
    "id": "l-doc-004",
    "title": "Stripe: 商品と価格の仕組み",
    "url": "https://docs.stripe.com/products-prices/overview"
  },
  {
    "id": "l-doc-005",
    "title": "Stripe API: Subscription オブジェクト",
    "url": "https://docs.stripe.com/api/subscriptions/object"
  },
  {
    "id": "l-doc-006",
    "title": "Stripe: 対応通貨（ゼロ小数通貨）",
    "url": "https://docs.stripe.com/currencies"
  },
  {
    "id": "l-doc-007",
    "title": "Stripe: サンドボックス",
    "url": "https://docs.stripe.com/sandboxes"
  },
  {
    "id": "l-doc-008",
    "title": "Stripe API: Price オブジェクト",
    "url": "https://docs.stripe.com/api/prices/object"
  },
  {
    "id": "l-doc-009",
    "title": "Stripe API: Customer オブジェクト",
    "url": "https://docs.stripe.com/api/customers/object"
  },
  {
    "id": "l-doc-010",
    "title": "Stripe API: Event オブジェクト",
    "url": "https://docs.stripe.com/api/events/object"
  },
  {
    "id": "l-doc-011",
    "title": "Stripe: レスポンスの展開（expand）",
    "url": "https://docs.stripe.com/expand"
  },
  {
    "id": "l-doc-012",
    "title": "Stripe: メタデータ",
    "url": "https://docs.stripe.com/metadata"
  },
  {
    "id": "l-doc-013",
    "title": "Stripe: 支払いの再試行（Smart Retries）",
    "url": "https://docs.stripe.com/billing/revenue-recovery/smart-retries"
  },
  {
    "id": "l-doc-014",
    "title": "Stripe: サブスクリプションのキャンセル",
    "url": "https://docs.stripe.com/billing/subscriptions/cancel"
  },
  {
    "id": "l-doc-015",
    "title": "Stripe changelog: current_period の移動（2025-03-31.basil）",
    "url": "https://docs.stripe.com/changelog/basil/2025-03-31/deprecate-subscription-current-period-start-and-end"
  },
  {
    "id": "l-doc-016",
    "title": "Stripe: サブスクリプションの請求書",
    "url": "https://docs.stripe.com/billing/invoices/subscription"
  },
  {
    "id": "l-doc-017",
    "title": "Stripe: 請求書の流れ（ステータス）",
    "url": "https://docs.stripe.com/invoicing/overview"
  },
  {
    "id": "l-doc-018",
    "title": "Stripe API: Invoice オブジェクト",
    "url": "https://docs.stripe.com/api/invoices/object"
  },
  {
    "id": "l-doc-019",
    "title": "Stripe API: Create a Checkout Session",
    "url": "https://docs.stripe.com/api/checkout/sessions/create"
  },
  {
    "id": "l-doc-020",
    "title": "Stripe: 注文のフルフィルメント（Webhook と完了ページ）",
    "url": "https://docs.stripe.com/checkout/fulfillment"
  },
  {
    "id": "l-doc-021",
    "title": "Stripe: Checkout の無料トライアル",
    "url": "https://docs.stripe.com/payments/checkout/free-trials"
  },
  {
    "id": "l-doc-022",
    "title": "Stripe: Webhook でイベントを受信する（署名・再送・ベストプラクティス）",
    "url": "https://docs.stripe.com/webhooks"
  },
  {
    "id": "l-doc-023",
    "title": "Stripe: イベントの仕組み（Snapshot と Thin）",
    "url": "https://docs.stripe.com/events/how-events-work"
  },
  {
    "id": "l-doc-024",
    "title": "Stripe: サブスクリプションで Webhook を使う",
    "url": "https://docs.stripe.com/billing/subscriptions/webhooks"
  },
  {
    "id": "l-doc-025",
    "title": "Stripe API: Thin イベントの一覧",
    "url": "https://docs.stripe.com/api/v2/core/events/event-types"
  },
  {
    "id": "l-doc-026",
    "title": "Stripe API: Retrieve a subscription",
    "url": "https://docs.stripe.com/api/subscriptions/retrieve"
  },
  {
    "id": "l-doc-027",
    "title": "Stripe: エンタイトルメント（内部で保持する推奨）",
    "url": "https://docs.stripe.com/billing/entitlements"
  },
  {
    "id": "l-doc-028",
    "title": "Stripe: カスタマーポータル",
    "url": "https://docs.stripe.com/customer-management"
  },
  {
    "id": "l-doc-029",
    "title": "Stripe: カスタマーポータルの組み込み",
    "url": "https://docs.stripe.com/customer-management/integrate-customer-portal"
  },
  {
    "id": "l-doc-030",
    "title": "Stripe: プランの変更（アップグレード・ダウングレード）",
    "url": "https://docs.stripe.com/billing/subscriptions/change"
  },
  {
    "id": "l-doc-031",
    "title": "Stripe: 日割り（プロレーション）",
    "url": "https://docs.stripe.com/billing/subscriptions/prorations"
  },
  {
    "id": "l-doc-032",
    "title": "Stripe: Billing の組み込みのテスト（Test clock・失敗のテスト）",
    "url": "https://docs.stripe.com/billing/testing"
  },
  {
    "id": "l-doc-033",
    "title": "Stripe: テストカード",
    "url": "https://docs.stripe.com/testing"
  },
  {
    "id": "l-doc-034",
    "title": "Stripe CLI: stripe listen",
    "url": "https://docs.stripe.com/cli/listen"
  },
  {
    "id": "l-doc-035",
    "title": "Stripe: 本番稼働前のチェックリスト",
    "url": "https://docs.stripe.com/get-started/checklist/go-live"
  },
  {
    "id": "l-doc-036",
    "title": "Stripe: 料金（日本）",
    "url": "https://stripe.com/jp/pricing"
  },
  {
    "id": "l-doc-037",
    "title": "Stripe: トライアルの法令遵守（カード会社の要件）",
    "url": "https://docs.stripe.com/billing/subscriptions/trials/manage-trial-compliance"
  },
  {
    "id": "l-doc-038",
    "title": "Stripe: PayPay（継続課金の可否）",
    "url": "https://docs.stripe.com/payments/paypay"
  },
  {
    "id": "l-doc-039",
    "title": "消費者庁: 通信販売（特定商取引法ガイド）",
    "url": "https://www.no-trouble.caa.go.jp/what/mailorder/"
  },
  {
    "id": "l-doc-040",
    "title": "Apple: App Store Review Guidelines（3.1 支払い）",
    "url": "https://developer.apple.com/app-store/review/guidelines/#payments"
  },
  {
    "id": "l-doc-041",
    "title": "Apple: 日本でのアプリの配信（代替決済とリンクアウト）",
    "url": "https://developer.apple.com/support/app-distribution-in-japan/"
  },
  {
    "id": "l-doc-042",
    "title": "Apple: App Store Server Notifications",
    "url": "https://developer.apple.com/documentation/appstoreservernotifications"
  },
  {
    "id": "l-doc-043",
    "title": "Stripe: 価格の変更（新しい Price を作る）",
    "url": "https://docs.stripe.com/products-prices/manage-prices"
  }
]);
export const SOURCES = SOURCE_TABLE.sources;
export const docsOf = SOURCE_TABLE.docs;
