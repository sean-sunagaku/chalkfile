import type { Course } from '../types';
import { L01 } from './L01';
import { L02 } from './L02';
import { L03 } from './L03';
import { L04 } from './L04';
import { L05 } from './L05';
import { L06 } from './L06';
import { L07 } from './L07';
import { L08 } from './L08';
import { L09 } from './L09';
import { L10 } from './L10';
import { L11 } from './L11';
import { L12 } from './L12';
import { L13 } from './L13';

/** Stripe のサブスク課金（概念・データ・サンプル実装・お金・法律・iOS） */
export const STRIPE_BILLING: Course = {
  id: 'stripe-billing',
  prefix: 'L',
  order: 10,
  theme: 'indigo',
  disclaimer: 'Stripe 社とは関係のない、個人が作った非公式の講座です',
  title: 'Stripe サブスク課金 基礎講座',
  subtitle: '概念とデータ、サンプルで作る流れ',
  headline: 'Stripe のサブスク課金を、概念からサンプル実装まで',
  sections: [
    { no: 1, title: 'はじめに' },
    { no: 2, title: 'Stripe の概念とデータ' },
    { no: 3, title: 'サンプルで作る' },
    { no: 4, title: 'お金・法律・iOS' },
    { no: 5, title: 'まとめ' },
  ],
  lectures: [L01, L02, L03, L04, L05, L06, L07, L08, L09, L10, L11, L12, L13],
  docsNote: '動画の内容は、2026 年 10 月に読んだ Stripe 公式ドキュメント（API リファレンスと changelog を含む）と、消費者庁・Apple の公式ページがもとです。料金や仕様は変わるので、実装の前にここから確かめ直してください。',
  sourceNote: '台本と図は Stripe 公式ドキュメントと、消費者庁・Apple の公式ページ（2026 年 10 月確認）をもとに作成。サンプルアプリは架空のサービス。Stripe 社とは関係のない、個人の勉強用の講座です',
};
