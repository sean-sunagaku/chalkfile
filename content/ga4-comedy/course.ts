import { comedyCast } from '../_shared/comedy';
import type { Course } from '../types';
import { G01 } from './G01';
import { G02 } from './G02';
import { G03 } from './G03';
import { SOURCES } from './sources';

/**
 * GA4（Google アナリティクス 4）のお笑い版（全 3 章・短め）。ずんだもん（ボケ）・先生（ツッコミ）・天の声の掛け合いで、
 * イベントとパラメータ（項目名と値）から、email_entry を「メールの入口」として見るカスタム ディメンションの設定までを見る。
 */
export const GA4_COMEDY: Course = {
  id: 'ga4-comedy',
  prefix: 'G',
  order: 90,
  unitLabel: 'CHAPTER',
  theme: 'stage',
  disclaimer: 'Google とは関係のない、個人が作った非公式の動画です。ボケの台詞は、わざと間違えています',
  title: '笑ってわかる GA4',
  subtitle: 'イベント・パラメータ・カスタム ディメンションを、サンプルのサイトの「メールの入口」で',
  headline: 'サイトから届く **email_entry = signature** を、「メールの入口」として見る',
  sections: [
    { no: 1, title: 'きほん' },
    { no: 2, title: '設定' },
  ],
  lectures: [G01, G02, G03],
  cast: comedyCast(),
  sources: SOURCES,
  ui: { takeaways: '要点メモ', docs: '出典・参考資料', searchHint: 'email_entry、signature、カスタム ディメンション' },
  docsNote:
    '動画の内容は、2026 年 11 月 2 日に読んだ Google アナリティクスのヘルプ（日本語版と英語版）・Google アナリティクス利用規約・タグ マネージャーのヘルプと、Google タグ（gtag.js）の開発者向けドキュメントがもとです。画面の名前・反映までの時間・上限の数は変わることがあるので、設定の前にヘルプで確かめてください。サンプルのサイト・イベント名・値の意味と、レポートの数字は説明用の架空の例です。ずんだもん（ボケ）の台詞は、わざと間違えています。',
  sourceNote:
    '台本と図は、Google アナリティクスのヘルプ・利用規約、タグ マネージャーのヘルプ、Google タグのドキュメント（2026 年 11 月確認）をもとに、自分の言葉と自分の図で作成。設定の画面は説明用に描いた図で、実際の画面とは細部が違います。Google とは関係のない、個人の勉強用の非公式の動画です',
};
