import { L01 } from './stripe-billing/L01';
import { L02 } from './stripe-billing/L02';
import { L03 } from './stripe-billing/L03';
import { L04 } from './stripe-billing/L04';
import { L05 } from './stripe-billing/L05';
import { L06 } from './stripe-billing/L06';
import { L07 } from './stripe-billing/L07';
import { L08 } from './stripe-billing/L08';
import { L09 } from './stripe-billing/L09';
import { L10 } from './stripe-billing/L10';
import { L11 } from './stripe-billing/L11';
import { L12 } from './stripe-billing/L12';
import { L13 } from './stripe-billing/L13';
import { INDIE_MARKETING } from './indie-marketing/course';
import { NUDGE_COMEDY } from './nudge-comedy/course';
import { RIVE_COMEDY } from './rive-comedy/course';
import { PSTACK_COMEDY } from './pstack-comedy/course';
import { SUPERAGENT_COMEDY } from './superagent-comedy/course';
import { NUDGE_PRODUCT } from './nudge-product/course';
import { UIUX_ENGINEERS } from './uiux-engineers/course';
import type { Course, Lecture } from './types';

/** Stripe のサブスク課金（概念・データ・サンプル実装・お金・法律・iOS） */
export const STRIPE_BILLING: Course = {
  id: 'stripe-billing',
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

/** 講座を足すときは、content/<講座 ID>/ に台本を置いてここに並べる */
export const COURSES: Course[] = [STRIPE_BILLING, NUDGE_PRODUCT, UIUX_ENGINEERS, INDIE_MARKETING, NUDGE_COMEDY, RIVE_COMEDY, PSTACK_COMEDY, SUPERAGENT_COMEDY];

/** 動画を作るときは、全講座のレクチャーをまとめて扱う（ID は講座をまたいで重ならないようにする） */
export const LECTURES: Lecture[] = COURSES.flatMap((c) => c.lectures);

export const courseOf = (lectureId: string): Course => {
  const c = COURSES.find((x) => x.lectures.some((l) => l.id === lectureId));
  if (!c) throw new Error(`どの講座にも無いレクチャー: ${lectureId}`);
  return c;
};

const ids = LECTURES.map((l) => l.id);
const dup = ids.find((id, i) => ids.indexOf(id) !== i);
if (dup) throw new Error(`レクチャー ID が講座をまたいで重なっている: ${dup}`);
