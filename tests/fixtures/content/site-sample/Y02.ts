import type { Lecture } from '../../../../content/types';

/** 講座サイトの見本の 2 本目（保存の失敗・遅れ・更新を差し込む動画） */
export const Y02: Lecture = {
  id: 'Y02',
  no: 2,
  section: { no: 1, title: 'はじめに' },
  title: '更新と削除の見本',
  summary: '新しい版への更新と、保存の削除を確かめるための、短い見本の動画。',
  docs: [{ title: 'サンプルアプリの更新', url: 'https://example.com/docs/update' }],
  quiz: [
    {
      q: '保存を消すと、学習メモも消える？',
      choices: ['消える', '消えない'],
      answer: 1,
      explain: '保存の削除で消すのは教材と動画だけ。学習メモと進み具合は残す。',
    },
  ],
  takeaways: ['新しい版は、全部そろってから切り替える', '保存を消しても、学習メモは残る'],
  scenes: [
    {
      kind: 'big',
      heading: '新しい版',
      text: '全部そろってから **切り替える**',
      tone: 'mint',
      lines: [{ t: '新しい版は、全部のファイルがそろってから切り替えます。' }],
    },
    {
      kind: 'ending',
      closing: '見本はここまで',
      lines: [{ t: 'これで、見本はおしまいです。' }],
    },
  ],
};
