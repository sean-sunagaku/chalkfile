// syllabus（講座の設計）と動画の二重持ちの食い違い: 番号とセクションは誤り、題と status は注意。syllabus に無い動画は誤り
import type { PlannedChapter } from '../../../../content/types';
import { course, lecture, say, W, type Expected } from './_base';

const chapter = (patch: Partial<PlannedChapter>): PlannedChapter => ({
  id: 'sample-01',
  lectureId: 'X01',
  no: 1,
  section: 1,
  title: '検証の見本',
  question: '何を確かめる？',
  goals: [],
  prerequisites: [],
  minutes: 5,
  storyline: [],
  exercise: '',
  sources: [],
  status: 'produced',
  ...patch,
});

const scenes = () => [{ kind: 'big' as const, heading: '大事なこと', text: '台本が正本', lines: say('台本が正本です。') }];

export const COURSE = course([lecture(scenes()), lecture(scenes(), { id: 'X02', no: 2, title: '二本目' })], {
  syllabus: {
    audience: '見本',
    prerequisites: [],
    outcomes: [],
    finalProject: '',
    sample: '架空のサンプルアプリ',
    chapters: [chapter({ no: 2, title: '別の題', status: 'planned' }), chapter({ id: 'sample-03', lectureId: 'X09', no: 3, section: 9 })],
  },
});

export const EXPECTED: Expected[] = [
  ['error', 'syllabus', `${W} syllabus.no`],
  ['warning', 'syllabus', `${W} syllabus.title`],
  ['warning', 'syllabus', `${W} syllabus.status`],
  ['error', 'syllabus', 'invalid-sample/X02 syllabus'],
  ['error', 'syllabus', 'invalid-sample syllabus.chapters[1].section'],
  ['warning', 'syllabus', 'invalid-sample syllabus.chapters[1].status'],
];
