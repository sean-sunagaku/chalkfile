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
import { NUDGE_COMEDY_EN } from './nudge-comedy/en/course';
import { NUDGE_COMEDY_ZH } from './nudge-comedy/zh/course';
import { RIVE_COMEDY } from './rive-comedy/course';
import { RIVE_COMEDY_EN } from './rive-comedy/en/course';
import { RIVE_COMEDY_ZH } from './rive-comedy/zh/course';
import { PSTACK_COMEDY } from './pstack-comedy/course';
import { PSTACK_COMEDY_EN } from './pstack-comedy/en/course';
import { PSTACK_COMEDY_ZH } from './pstack-comedy/zh/course';
import { SUPERAGENT_COMEDY } from './superagent-comedy/course';
import { SUPERAGENT_COMEDY_EN } from './superagent-comedy/en/course';
import { SUPERAGENT_COMEDY_ZH } from './superagent-comedy/zh/course';
import { GA4_COMEDY } from './ga4-comedy/course';
import { NUDGE_PRODUCT } from './nudge-product/course';
import { UIUX_ENGINEERS } from './uiux-engineers/course';
import { LANGS, localizeCourse, parseVideoKey, videoKey, type CourseL10n, type Lang, type TranslatedLang } from './i18n';
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
export const COURSES: Course[] = [STRIPE_BILLING, NUDGE_PRODUCT, UIUX_ENGINEERS, INDIE_MARKETING, NUDGE_COMEDY, RIVE_COMEDY, PSTACK_COMEDY, SUPERAGENT_COMEDY, GA4_COMEDY];

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
// 訳の講座の URL と保存の ID は <言語>/<講座>（en/pstack-comedy）。Service Worker は頭の 2 文字の英小文字を言語のフォルダとして読むので、2 文字の英小文字の講座 ID は使わない
if (COURSES.some((c) => (LANGS as string[]).includes(c.id) || /^[a-z]{2}$/.test(c.id))) throw new Error('講座 ID に 2 文字の英小文字（ja・en・zh などの言語の名前）は使えない（訳の講座の URL の頭と重なる）');

/* ───────────── 訳の講座（content/i18n.ts） ─────────────
 * 言語ごとに、講座 ID → 訳（CourseL10n）を並べる。訳の講座は、日本語の講座に訳を重ねて作る。
 */
export const TRANSLATIONS: Record<TranslatedLang, Record<string, CourseL10n>> = {
  en: { 'nudge-comedy': NUDGE_COMEDY_EN, 'rive-comedy': RIVE_COMEDY_EN, 'pstack-comedy': PSTACK_COMEDY_EN, 'superagent-comedy': SUPERAGENT_COMEDY_EN },
  zh: { 'nudge-comedy': NUDGE_COMEDY_ZH, 'rive-comedy': RIVE_COMEDY_ZH, 'pstack-comedy': PSTACK_COMEDY_ZH, 'superagent-comedy': SUPERAGENT_COMEDY_ZH },
};

const localized = new Map<Lang, Course[]>();
/** その言語で出す講座（日本語は全部、ほかの言語は訳のある講座だけ。並びは日本語の講座と同じ） */
export const coursesIn = (lang: Lang): Course[] => {
  if (lang === 'ja') return COURSES;
  let list = localized.get(lang);
  if (!list) {
    const tr = TRANSLATIONS[lang];
    for (const id of Object.keys(tr)) if (!COURSES.some((c) => c.id === id)) throw new Error(`訳の講座が日本語の講座に無い: ${lang}/${id}`);
    list = COURSES.filter((c) => tr[c.id]).map((c) => localizeCourse(c, tr[c.id], lang));
    localized.set(lang, list);
  }
  return list;
};

/** 動画 1 本（レクチャー × 言語）。key は日本語なら S01、ほかは S01.en（content/i18n.ts の videoKey） */
export type Video = { key: string; lang: Lang; lecture: Lecture; course: Course };
export const VIDEOS: Video[] = LANGS.flatMap((lang) => coursesIn(lang).flatMap((course) => course.lectures.map((lecture) => ({ key: videoKey(lecture.id, lang), lang, lecture, course }))));

export const videoOf = (key: string): Video => {
  const v = VIDEOS.find((x) => x.key === key);
  if (!v) {
    const { id, lang } = parseVideoKey(key);
    throw new Error(`動画が無い: ${key}（${lang === 'ja' ? 'どの講座にも無いレクチャー' : `${id} の ${lang} の訳が無い`}）`);
  }
  return v;
};
