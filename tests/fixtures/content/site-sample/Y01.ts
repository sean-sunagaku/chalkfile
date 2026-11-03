import type { Lecture } from '../../../../content/types';

/** 講座サイトの見本の 1 本目（確認クイズ・公式ドキュメント・メモ・チャプター 2 つ） */
export const Y01: Lecture = {
  id: 'Y01',
  no: 1,
  section: { no: 1, title: 'はじめに' },
  title: '保存と再生の見本',
  summary: '講座サイトの保存・再生・オフラインを確かめるための、短い見本の動画。',
  docs: [{ title: 'サンプルアプリの説明', url: 'https://example.com/docs/offline' }],
  quiz: [
    {
      q: '保存した講座は、通信が無いときに見られる？',
      choices: ['見られる', '見られない'],
      answer: 0,
      explain: '保存した講座は、教材と全部の動画をこの端末に置くので、通信が無くても見られる。',
    },
  ],
  takeaways: ['保存すると、通信が無くても見られる', '保存は講座ごとに選ぶ'],
  scenes: [
    {
      kind: 'opening',
      section: 'SECTION 1　はじめに',
      title: '保存と再生の見本',
      lines: [{ t: '見本 1。保存と再生の見本。', v: 'announcer', pause: 0.3 }],
    },
    {
      kind: 'big',
      heading: 'オフラインで学ぶ',
      text: '**保存** すれば通信なしで見られる',
      tone: 'violet',
      lines: [{ t: '保存した講座は、通信が無くても見られます。' }],
    },
  ],
};
