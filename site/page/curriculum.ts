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
      { class: 'ring done', viewBox: '0 0 24 24', role: 'img', 'aria-label': page.T.ringDone },
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
    {
      class: 'ring',
      viewBox: '0 0 24 24',
      role: 'img',
      'aria-label': page.tt('ringWatched', { p: Math.round(max * 100) }),
    },
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
  const { T, tt, tn, lectures } = page;
  const course = page.data.course;
  const progress = page.learning.progress;
  /** 本数（講座の呼び名が CHAPTER なら章の数。数で形の変わる言語は tn が選ぶ） */
  const count = (n: number) => tn(course.unitLabel === 'CHAPTER' ? 'chapterCount' : 'lectureCount', n);

  /** 上の帯の完了の数と棒・見出しの下と右の欄の、本数と長さ */
  const renderCourseProgress = () => {
    const done = lectures.filter((l) => progress[l.id]?.done).length;
    byId('cpBar').style.width = `${(done / lectures.length) * 100}%`;
    byId('cpLabel').textContent = tt('cpLabel', { done, total: lectures.length });
    const total = lectures.reduce((a, l) => a + l.duration, 0);
    const all = lectures.length + course.planned.length;
    const plan = course.planned.length ? tt('planned', { count: count(all) }) : '';
    const min = Math.round(total / 60);
    byId('curSum').textContent = tt('curSum', { count: count(lectures.length), min, plan });
    byId('courseMeta').textContent = tt('courseMeta', {
      sections: tn('sectionCount', course.sections.length),
      count: count(lectures.length),
      min,
      plan,
    });
  };

  const box = byId('sections');
  /** 作った右の欄の、書き換える所（レクチャーのボタンとセクションの完了の数） */
  let built: { buttons: HTMLButtonElement[]; counts: { el: HTMLElement; items: number[] }[] } | null = null;
  /** 輪の形が変わったか（完了か、見た割合の % が変わったとき） */
  const ringKey = (p: Progress | undefined) => (p?.done ? 'done' : String(Math.round(Math.min(1, p?.max ?? 0) * 100)));

  /**
   * 右の欄（セクションごとのレクチャーと、まだ作っていない章）を作る。構造が変わったときだけ作り、ふだんは update で今ある要素を書き換える
   * （再生中の進み具合の保存のたびに作り直すと、フォーカスが飛ぶ）。作り直したら、フォーカスのあったレクチャーのボタンへ data-i で戻す
   */
  const build = () => {
    const active = document.activeElement;
    const focused = active instanceof HTMLElement && box.contains(active) ? active.dataset.i : undefined;
    const buttons: HTMLButtonElement[] = [];
    const counts: { el: HTMLElement; items: number[] }[] = [];
    put(
      box,
      course.sections.map((sec) => {
        const items = lectures.map((l, i) => ({ l, i })).filter((x) => x.l.section.no === sec.no);
        const count = h('span', { class: 'cnt' });
        counts.push({ el: count, items: items.map((x) => x.i) });
        return h(
          'div',
          { class: 'sec' },
          h(
            'div',
            { class: 'sec-head' },
            h('div', { class: 'name' }, h('span', { class: 'no' }, `SECTION ${sec.no}`), sec.title),
            count,
          ),
          items.map((x) => {
            const b = h(
              'button',
              { type: 'button', class: 'lec', 'data-i': x.i, 'data-ring': ringKey(progress[x.l.id]) },
              ring(page, progress[x.l.id], x.i),
              h('span', { class: 'ttl' }, x.l.title),
              h('span', { class: 'dur' }, clock(x.l.duration)),
            );
            buttons.push(b);
            return b;
          }),
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
    built = { buttons, counts };
    if (focused !== undefined) box.querySelector<HTMLElement>(`button.lec[data-i="${focused}"]`)?.focus();
  };

  /** 右の欄の進み具合（輪・セクションの完了の数・今のレクチャーの印）を、今ある要素のまま書き換える。まだ作っていなければ作る */
  const renderCurriculum = () => {
    if (!built) build();
    if (!built) return;
    for (const b of built.buttons) {
      const i = Number(b.dataset.i);
      const p = progress[lectures[i].id];
      if (i === page.current) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
      const key = ringKey(p);
      if (b.dataset.ring !== key) {
        b.querySelector('svg.ring')?.replaceWith(ring(page, p, i));
        b.dataset.ring = key;
      }
    }
    for (const c of built.counts) {
      const text = `${c.items.filter((i) => progress[lectures[i].id]?.done).length} / ${c.items.length}`;
      if (c.el.textContent !== text) c.el.textContent = text;
    }
  };
  box.addEventListener('click', (e) => {
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
