import type { CourseL10n, LectureL10n } from '../../../../content/i18n';
import type { AuthoredCourse } from '../../../../content/types';
import { X10 } from './X10';

/**
 * at を台詞の id で書いた見本の講座（講座の一覧には並べない。tests/unit/lines.test.ts が読む）。
 * id で at を書く動画を入れる講座は AuthoredCourse にする（content/<講座>/course.ts と同じ形）
 */
export const LINE_IDS: AuthoredCourse = {
  id: 'line-ids',
  prefix: 'X',
  order: 1,
  title: 'id で書く見本',
  subtitle: 'at を台詞の id で書く',
  headline: 'at を台詞の id で書く見本',
  sections: [{ no: 1, title: 'はじめに' }],
  lectures: [X10],
  cast: {
    narrator: { name: '先生', tone: 'coral' },
    zundamon: { name: 'ずんだもん', tone: 'mint' },
  },
  docsNote: '見本のための講座です。',
  sourceNote: '架空のサンプルアプリで作った見本。',
};

const Z = 'zundamon' as const;

/**
 * 英語の訳。台詞の数は日本語と違う（ボケを足した・まとめた）が、日本語の台詞と同じ id を付けたので、画面の要素の at は書き直さない。
 * 画面の図の注も、部品は日本語の台本の blockId のまま
 */
export const X10_EN: LectureL10n = {
  source: '',
  title: 'A sample written with ids',
  summary: 'A sample that writes at with line ids.',
  docs: [{ title: 'About the sample app' }],
  quiz: [{ q: 'What can you write in at?', choices: ['Only a line number', 'A line number or an id'], explain: 'With ids, you do not recount when you add a line.' }],
  takeaways: ['You can write at with a line id'],
  scenes: [
    {
      kind: 'goals',
      heading: 'Goals of this sample',
      items: [{ text: 'Know how to give a line an id' }, { text: 'Write that id in at' }],
      lines: [
        { t: 'There are two goals.' },
        { t: 'Ids! I love ids!', v: Z },
        { id: 'first', t: 'One: give a line an id.', sfx: 'pop' },
        { id: 'second', t: 'Two: write that id in at.', sfx: 'pop' },
      ],
    },
    {
      kind: 'compare',
      heading: 'Numbers and ids',
      left: { title: 'Numbers', items: [{ text: 'Recount' }] },
      right: { title: 'Ids', items: [{ text: 'No recounting' }] },
      verdict: { text: 'With ids, nothing moves when you add a line' },
      lines: [
        { id: 'left', t: 'On the left, at is written with numbers.' },
        { id: 'left-item', t: 'Add a line, and you recount every number after it.', sfx: 'pop' },
        { id: 'right', t: 'On the right, at is written with ids.' },
        { id: 'right-item', t: 'Add a line, and nothing needs recounting.', sfx: 'pop' },
        { id: 'verdict', t: 'With ids, each item stays on the same line.', sfx: 'chime' },
      ],
    },
    {
      kind: 'screens',
      heading: 'Notes point to a part id',
      left: {
        label: 'Before',
        blocks: [{ text: 'Sign up' }, {}, { text: 'Send' }],
        notes: [{ text: 'The title is faint' }, { text: 'The button is faint' }],
      },
      lines: [
        { id: 'before', t: 'This is the screen before.' },
        { t: 'Squint harder!', v: Z },
        { id: 'weak', t: 'The title and the button are faint and hard to read.', sfx: 'pop' },
      ],
    },
    {
      kind: 'quiz',
      question: 'You can write at with a line id',
      explain: 'Give a line an id, and you can show things at the start of that line.',
      lines: [
        { t: 'Quiz time. You can write at with a line id. True or false?' },
        { id: 'reveal', t: 'The answer is true.', sfx: 'correct' },
      ],
    },
  ],
};

export const LINE_IDS_EN: CourseL10n = {
  title: 'A sample written with ids',
  subtitle: 'Write at with line ids',
  headline: 'A sample that writes at with line ids',
  sections: [{ title: 'Introduction' }],
  docsNote: 'A course for samples.',
  sourceNote: 'A sample made with a made-up sample app.',
  cast: { narrator: { name: 'Teacher' }, zundamon: { name: 'Zundamon' } },
  lectures: { X10: X10_EN },
};
