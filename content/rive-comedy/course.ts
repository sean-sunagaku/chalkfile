import type { Course } from '../types';
import { R01 } from './R01';

/** Rive をざっくり知るお笑い版（1 本だけ）。ずんだもん（ボケ）・先生（ツッコミ）・天の声の掛け合いで、仕組みだけを見せる */
export const RIVE_COMEDY: Course = {
  id: 'rive-comedy',
  theme: 'stage',
  disclaimer: 'Rive 社とは関係のない、個人が作った非公式の動画です。ボケの台詞は、わざと間違えています',
  title: '笑ってわかる Rive アニメーション',
  subtitle: 'Rive を、ずんだもんとざっくり知るお笑い版',
  headline: '**動きを作って、そのまま動かす**道具を、ざっくり',
  sections: [{ no: 1, title: 'ざっくり入門' }],
  lectures: [R01],
  cast: {
    zundamon: { name: 'ずんだもん', tone: 'mint' },
    'zundamon-cry': { name: 'ずんだもん', tone: 'mint' },
    narrator: { name: '先生', tone: 'coral' },
    tsukkomi: { name: '先生', tone: 'coral' },
    tennokoe: { name: '天の声', tone: 'violet' },
    announcer: { name: '天の声', tone: 'violet' },
  },
  ui: { takeaways: '要点メモ', docs: '公式ドキュメント', searchHint: 'ステートマシン、ランタイム' },
  docsNote:
    '動画の内容は、2026 年 11 月 1 日に読んだ Rive の公式ドキュメント（ランタイムとステートマシンのページ）がもとです。機能・対応する環境・料金は変わるので、使う前に公式で確かめてください。ずんだもん（ボケ）の台詞は、わざと間違えています。',
  sourceNote:
    'ボケの声は VOICEVOX:ずんだもん。台本は Rive の公式ドキュメント（2026 年 11 月確認）をもとに作成。Rive 社とは関係のない、個人の勉強用の非公式の動画です',
};
