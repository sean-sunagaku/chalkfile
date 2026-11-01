import type { Course } from '../types';
import { P01 } from './P01';

/** pstack をざっくり知るお笑い版（1 本だけ）。ずんだもん（ボケ）・先生（ツッコミ）・天の声の掛け合いで、考え方と使い方だけを見せる */
export const PSTACK_COMEDY: Course = {
  id: 'pstack-comedy',
  theme: 'stage',
  disclaimer: 'Cursor 社・pstack の作者とは関係のない、個人が作った非公式の動画です。ボケの台詞は、わざと間違えています',
  title: '笑ってわかる pstack',
  subtitle: 'Cursor 向けのスキル集 pstack を、ずんだもんとざっくり知るお笑い版',
  headline: '**速く進みたいなら、まず深く**のスキル集を、ざっくり',
  sections: [{ no: 1, title: 'ざっくり入門' }],
  lectures: [P01],
  cast: {
    zundamon: { name: 'ずんだもん', tone: 'mint' },
    'zundamon-cry': { name: 'ずんだもん', tone: 'mint' },
    narrator: { name: '先生', tone: 'coral' },
    tsukkomi: { name: '先生', tone: 'coral' },
    tennokoe: { name: '天の声', tone: 'violet' },
  },
  ui: { takeaways: '要点メモ', docs: '公式の説明', searchHint: 'poteto-mode、スキル' },
  docsNote:
    '動画の内容は、2026 年 11 月 1 日に読んだ pstack の README と、各スキル・/poteto-mode の手順書の説明（GitHub の cursor/plugins、版 0.15.36）がもとです。スキルの数・名前・既定のモデルは変わるので、使う前に README で確かめてください。ずんだもん（ボケ）の台詞は、わざと間違えています。',
  sourceNote:
    'ボケの声は VOICEVOX:ずんだもん、天の声は VOICEVOX:玄野武宏。台本は pstack の README と各スキル・手順書の説明（2026 年 11 月確認、版 0.15.36）をもとに作成。Cursor 社・pstack の作者とは関係のない、個人の勉強用の非公式の動画です',
};
