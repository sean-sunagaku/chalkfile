// 確認クイズのタブ: 選ぶとすぐ答えと解説を出し、答えをこの端末に残す。「もう一度」で、そのレクチャーの答えを消す。
// 答えたときは、その問いの選択肢の class だけを変えて解説を足し、フォーカスを解説へ移す（作り直すと、押したボタンが消えてフォーカスが飛ぶ）
import { type Page, lectureOf } from './context';
import type { LectureData } from './data';
import { byId, closest, h, put } from './dom';

type Question = LectureData['quiz'][number];

export const createQuiz = (page: Page) => {
  const { T, tt } = page;
  const answers = page.learning.quiz;
  const box = byId('quiz');
  const score = h('span', { class: 'score' });
  const tools = h('div', { class: 'tools' });

  /** 選んだ選択肢の印（正解と、違う選択肢を選んだときのその選択肢） */
  const choiceClass = (ci: number, q: Question, choice: number | undefined) =>
    choice === undefined ? 'choice' : `choice${ci === q.answer ? ' right' : ci === choice ? ' wrong' : ''}`;

  /** 解説（フォーカスを移せるように tabindex="-1"） */
  const explanation = (q: Question, choice: number) =>
    h(
      'div',
      { class: `explain${choice === q.answer ? '' : ' bad'}`, tabindex: -1 },
      choice === q.answer ? T.quizRight : tt('quizAnswer', { a: q.choices[q.answer]! }),
      q.explain,
    );

  /** 正解の数と「もう一度」 */
  const renderScore = () => {
    const lec = lectureOf(page);
    const picked = answers[lec.id] ?? {};
    const answered = lec.quiz.filter((_, qi) => picked[String(qi)] !== undefined).length;
    const right = lec.quiz.filter((q, qi) => picked[String(qi)] === q.answer).length;
    score.textContent = answered ? tt('quizScore', { n: lec.quiz.length, r: right }) : T.quizHint;
    put(tools, score, answered > 0 && h('button', { type: 'button', class: 'btn', id: 'quizReset' }, T.quizRetry));
  };

  /** レクチャーを開いたとき・「もう一度」のときに作る */
  const render = () => {
    const lec = lectureOf(page);
    const picked = answers[lec.id] ?? {};
    put(
      box,
      lec.quiz.map((q, qi) => {
        const choice = picked[String(qi)];
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
                  class: choiceClass(ci, q, choice),
                  'data-q': qi,
                  'data-c': ci,
                  disabled: choice !== undefined,
                },
                c,
              ),
            ),
          ),
          choice !== undefined && explanation(q, choice),
        );
      }),
      tools,
    );
    renderScore();
  };

  /** 答える: その問いの選択肢の印を変え、解説を足して、フォーカスを解説へ移す */
  const answer = (b: HTMLButtonElement) => {
    const lec = lectureOf(page);
    const qi = Number(b.dataset.q);
    const choice = Number(b.dataset.c);
    const q = lec.quiz[qi];
    const item = b.closest('.q');
    if (!q || !item) return;
    answers[lec.id] ??= {};
    answers[lec.id]![String(qi)] = choice;
    page.store.saveQuiz(answers);
    for (const c of Array.from(item.querySelectorAll<HTMLButtonElement>('.choice'))) {
      c.className = choiceClass(Number(c.dataset.c), q, choice);
      c.disabled = true;
    }
    const explain = explanation(q, choice);
    item.append(explain);
    explain.focus();
    renderScore();
  };

  box.addEventListener('click', (e) => {
    const b = closest<HTMLButtonElement>(e, '.choice');
    if (b && !b.disabled) {
      answer(b);
      return;
    }
    if (closest(e, '#quizReset')) {
      delete answers[lectureOf(page).id];
      page.store.saveQuiz(answers);
      render();
      box.querySelector<HTMLButtonElement>('.choice')?.focus();
    }
  });

  return { render };
};
