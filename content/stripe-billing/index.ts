// 講座の登録（content/courses.ts に 1 行で並べる）。講座は course.ts、訳は <言語>/course.ts
import { defineCourseModule } from '../course-module';
import { STRIPE_BILLING } from './course';

export default defineCourseModule({
  course: STRIPE_BILLING,
  // 講座サイトの一覧のページの最初の画面に出す、L02 の concepts の場面の頭（長い行は 3 つ目の項目までで切る）
  heroSnippet: {
    file: 'content/stripe-billing/L02.ts',
    lines: [
      '{',
      "  kind: 'concepts',",
      "  heading: '覚える 7 つのオブジェクト',",
      '  columns: 4,',
      '  cards: [',
      "    { key: 'customer', en: 'Customer', ja: '顧客', … },",
      "    { key: 'product', en: 'Product', ja: '商品', … },",
      "    { key: 'price', en: 'Price', ja: '価格', … },",
      "    { key: 'subscription', en: 'Subscription', ja: '契約', … },",
    ],
  },
});
