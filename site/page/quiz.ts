// 確認クイズのタブ: 選ぶとすぐ答えと解説を出し、答えをこの端末に残す。「もう一度」で、そのレクチャーの答えを消す
import { type Page, lectureOf } from './context';
import { byId, closest, h, put } from './dom';

export const createQuiz = (page: Page) => {
  const { T, tt } = page;
  const answers = page.learning.quiz;
  const box = byId('quiz');

  const render = () => {
    const lec = lectureOf(page);
    const picked = answers[lec.id] ?? {};
    let right = 0;
    let answered = 0;
    const questions = lec.quiz.map((q, qi) => {
      const choice = picked[String(qi)];
      const done = choice !== undefined;
      if (done) {
        answered += 1;
        if (choice === q.answer) right += 1;
      }
      return h(
        'div',
        { class: 'q' },
        h('div', { class: 'qt' }, h('span', { class: 'n' }, `Q${qi + 1}`), q.q),
        h(
          'div',
          { class: 'choices' },
          q.choices.map((c, ci) =>
            h(
              'button',
              {
                type: 'button',
                class: `choice${done ? (ci === q.answer ? ' right' : ci === choice ? ' wrong' : '') : ''}`,
                'data-q': qi,
                'data-c': ci,
                disabled: done,
              },
              c,
            ),
          ),
        ),
        done &&
          h(
            'div',
            { class: `explain${choice === q.answer ? '' : ' bad'}` },
            choice === q.answer ? T.quizRight : tt('quizAnswer', { a: q.choices[q.answer] }),
            q.explain,
          ),
      );
    });
    put(
      box,
      questions,
      h(
        'div',
        { class: 'tools' },
        h('span', { class: 'score' }, answered ? tt('quizScore', { n: lec.quiz.length, r: right }) : T.quizHint),
        answered > 0 && h('button', { type: 'button', class: 'btn', id: 'quizReset' }, T.quizRetry),
      ),
    );
  };

  box.addEventListener('click', (e) => {
    const id = lectureOf(page).id;
    const b = closest<HTMLButtonElement>(e, '.choice');
    if (b && !b.disabled) {
      answers[id] ??= {};
      answers[id][String(b.dataset.q)] = Number(b.dataset.c);
      page.store.saveQuiz(answers);
      render();
      return;
    }
    if (closest(e, '#quizReset')) {
      delete answers[id];
      page.store.saveQuiz(answers);
      render();
    }
  });

  return { render };
};
