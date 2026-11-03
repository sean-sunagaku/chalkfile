// カリキュラム（右の欄のセクションとレクチャー・見た割合の輪・準備中の章）と、講座の進み具合（上の帯・見出しの下の数）・完了の札
import type { Page } from './context';
import { byId, closest, h, put, svg } from './dom';
import { clock } from './format';
import type { Progress } from './storage';

/** 見た割合の輪（完了は丸に印） */
const ring = (page: Page, p: Progress | undefined, i: number) => {
  if (p?.done) {
    return svg(
      'svg',
      { class: 'ring done', viewBox: '0 0 24 24', 'aria-label': page.T.ringDone },
      svg('circle', { class: 'disc', cx: 12, cy: 12, r: 11 }),
      svg('path', {
        class: 'tick',
        d: 'M7 12.4l3.3 3.3L17 9',
        fill: 'none',
        'stroke-width': 2.4,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      }),
    );
  }
  const max = Math.min(1, p?.max ?? 0);
  const c = 2 * Math.PI * 10;
  return svg(
    'svg',
    { class: 'ring', viewBox: '0 0 24 24', 'aria-label': page.tt('ringWatched', { p: Math.round(max * 100) }) },
    svg('circle', { class: 'bg', cx: 12, cy: 12, r: 10, fill: 'none', 'stroke-width': 2.5 }),
    max > 0 &&
      svg('circle', {
        class: 'fg',
        cx: 12,
        cy: 12,
        r: 10,
        fill: 'none',
        'stroke-width': 2.5,
        'stroke-linecap': 'round',
        'stroke-dasharray': `${(c * max).toFixed(1)} ${c.toFixed(1)}`,
        transform: 'rotate(-90 12 12)',
      }),
    svg('text', { class: 'num', x: 12, y: 15.2, 'text-anchor': 'middle' }, i + 1),
  );
};

/** カリキュラムを用意する。onPick は、レクチャーを選んだとき（その番号） */
export const createCurriculum = (page: Page, onPick: (i: number) => void) => {
  const { T, tt, lectures } = page;
  const course = page.data.course;
  const progress = page.learning.progress;
  const unitWord = (n: number) =>
    course.unitLabel === 'CHAPTER'
      ? n === 1
        ? T.unitChapter1
        : T.unitChapter
      : n === 1
        ? T.unitLecture1
        : T.unitLecture;

  /** 上の帯の完了の数と棒・見出しの下と右の欄の、本数と長さ */
  const renderCourseProgress = () => {
    const done = lectures.filter((l) => progress[l.id]?.done).length;
    byId('cpBar').style.width = `${(done / lectures.length) * 100}%`;
    byId('cpLabel').textContent = tt('cpLabel', { done, total: lectures.length });
    const total = lectures.reduce((a, l) => a + l.duration, 0);
    const all = lectures.length + course.planned.length;
    const plan = course.planned.length ? tt('planned', { n: all, unit: unitWord(all) }) : '';
    const min = Math.round(total / 60);
    byId('curSum').textContent = tt('curSum', { n: lectures.length, unit: unitWord(lectures.length), min, plan });
    const sections = course.sections.length;
    byId('courseMeta').textContent = tt('courseMeta', {
      sections,
      sec: sections === 1 ? T.unitSection1 : T.unitSection,
      n: lectures.length,
      unit: unitWord(lectures.length),
      min,
      plan,
    });
  };

  /** 右の欄（セクションごとのレクチャーと、まだ作っていない章） */
  const renderCurriculum = () => {
    put(
      byId('sections'),
      course.sections.map((sec) => {
        const items = lectures.map((l, i) => ({ l, i })).filter((x) => x.l.section.no === sec.no);
        const done = items.filter((x) => progress[x.l.id]?.done).length;
        return h(
          'div',
          { class: 'sec' },
          h(
            'div',
            { class: 'sec-head' },
            h('div', { class: 'name' }, h('span', { class: 'no' }, `SECTION ${sec.no}`), sec.title),
            h('span', { class: 'cnt' }, `${done} / ${items.length}`),
          ),
          items.map((x) =>
            h(
              'button',
              { type: 'button', class: 'lec', 'data-i': x.i, 'aria-current': x.i === page.current ? 'true' : null },
              ring(page, progress[x.l.id], x.i),
              h('span', { class: 'ttl' }, x.l.title),
              h('span', { class: 'dur' }, clock(x.l.duration)),
            ),
          ),
          course.planned
            .filter((p) => p.section === sec.no)
            .map((p) =>
              h(
                'div',
                { class: 'lec planned', 'aria-disabled': 'true' },
                svg(
                  'svg',
                  { class: 'ring', viewBox: '0 0 24 24', 'aria-hidden': 'true' },
                  svg('circle', {
                    class: 'bg',
                    cx: 12,
                    cy: 12,
                    r: 10,
                    fill: 'none',
                    'stroke-width': 2.5,
                    'stroke-dasharray': '3 3',
                  }),
                  svg('text', { class: 'num', x: 12, y: 15.2, 'text-anchor': 'middle' }, p.no),
                ),
                h('span', { class: 'ttl' }, p.title),
                h('span', { class: 'soon' }, tt('soon', { min: p.minutes })),
              ),
            ),
        );
      }),
    );
  };
  byId('sections').addEventListener('click', (e) => {
    const b = closest(e, 'button.lec');
    if (b) onPick(Number(b.dataset.i));
  });

  /** 完了の札（今のレクチャー） */
  const renderDone = () => {
    const done = !!progress[page.lectures[page.current].id]?.done;
    const b = byId('doneToggle');
    b.setAttribute('aria-pressed', done ? 'true' : 'false');
    const label = b.querySelector('span');
    if (label) label.textContent = done ? T.doneOn : T.doneOff;
  };

  /** 進み具合が変わったときに描き直すもの（完了の札・右の欄・上の帯） */
  const renderAll = () => {
    renderDone();
    renderCurriculum();
    renderCourseProgress();
  };
  byId('doneToggle').addEventListener('click', () => {
    const id = page.lectures[page.current].id;
    progress[id] ??= { t: 0, max: 0, done: false };
    progress[id].done = !progress[id].done;
    page.store.saveProgress(progress);
    renderAll();
  });

  return { renderCourseProgress, renderCurriculum, renderDone, renderAll };
};
