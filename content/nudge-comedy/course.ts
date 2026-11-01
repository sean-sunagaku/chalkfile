import { NUDGE_PRODUCT } from '../nudge-product/course';
import type { Course } from '../types';
import { W01 } from './W01';

/**
 * ナッジ講座のお笑い版。中身（主張・出典・クイズ）は真面目版（nudge-product）と同じで、
 * ボケ（ずんだもん）・ツッコミ（先生）・天の声の掛け合いで進む。教材と実践課題は真面目版に置く。
 */
export const NUDGE_COMEDY: Course = {
  id: 'nudge-comedy',
  unitLabel: 'CHAPTER',
  theme: 'stage',
  disclaimer: 'ボケの台詞は、わざと間違えています。正しい内容は、ツッコミと画面で確かめてください',
  title: '笑って覚えるナッジ理論',
  subtitle: 'ナッジ講座のお笑い版。ボケとツッコミの掛け合いで覚える',
  headline: '**笑った瞬間**が、わかった瞬間',
  sections: NUDGE_PRODUCT.sections,
  lectures: [W01],
  cast: {
    zundamon: { name: 'ずんだもん', tone: 'mint' },
    'zundamon-cry': { name: 'ずんだもん', tone: 'mint' },
    narrator: { name: '先生', tone: 'coral' },
    tsukkomi: { name: '先生', tone: 'coral' },
    tennokoe: { name: '天の声', tone: 'violet' },
    announcer: { name: '天の声', tone: 'violet' },
  },
  sources: NUDGE_PRODUCT.sources,
  links: [{ label: '真面目版（教材・実践課題つき）', url: 'https://sean-sunagaku.github.io/chalkfile/nudge-product/' }],
  ui: { takeaways: '要点メモ', docs: '出典・参考資料', searchHint: '監禁、買収、スラッジ' },
  docsNote:
    '動画の主張と出典は、真面目版の講座「ナッジ理論をプロダクト改善に活かす」の第 1 章と同じです（2026 年 10 月 30 日に開いて確かめた研究論文・公式資料）。ずんだもん（ボケ）の台詞は、笑いのためにわざと間違えています。正しい内容は、先生のツッコミと画面の表で確かめてください。読む教材と実践課題は、真面目版にあります。効果を約束するものではありません。',
  sourceNote:
    'ボケの声は VOICEVOX:ずんだもん。台本と図は、真面目版のナッジ講座と同じ研究・公式資料（Thaler & Sunstein など、2026 年 10 月確認）をもとに作成。サンプル家計簿は架空のアプリで、数字は説明用の仮の例です',
};
