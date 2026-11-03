// クイズ: サイトの確認クイズの答えの番号が選択肢の外・選択肢が 1 つ。動画のクイズの番号（no）が何問目かと合わない・答え合わせが問いと同時
import { course, lecture, say, W, type Expected } from './_base';

export const COURSE = course([
  lecture(
    [
      { kind: 'quiz', heading: 'クイズ', no: 2, question: '台本が正本である', answer: true, explain: '作り直せる', revealAt: 0, lines: say('○か×か。', '正解は○です。') },
    ],
    {
      quiz: [
        { q: '正本は？', choices: ['台本', '動画'], answer: 2, explain: '台本が正本' },
        { q: '一つだけ', choices: ['はい'], answer: 0, explain: '選べない' },
      ],
    },
  ),
]);

export const EXPECTED: Expected[] = [
  ['error', 'quiz', `${W} quiz[0].answer`],
  ['error', 'quiz', `${W} quiz[1].choices`],
  ['error', 'quiz-no', `${W} 場面 1 quiz.no`],
  ['error', 'quiz', `${W} 場面 1 quiz.revealAt`],
];
