// 概要のタブ: 要約・注意書き・要点・チャプター（押すとその時刻へ）・公式ドキュメントのタブのリンク
import { type Page, lectureOf } from './context';
import type { LectureData } from './data';
import { byId, closest, h, put, svg } from './dom';
import { clock, hostOf, safeUrl } from './format';

const OPEN_ICON = 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5';

/** 概要を用意する。seek は、チャプターを押したとき（その時刻へ移って再生する） */
export const createOverview = (page: Page, seek: (t: number) => void) => {
  const chapters = byId('chapters');
  chapters.addEventListener('click', (e) => {
    const b = closest(e, 'button');
    if (b) seek(Number(b.dataset.t));
  });

  /** レクチャーを開いたときに描く */
  const render = (lec: LectureData) => {
    byId('summary').textContent = lec.summary;
    const caution = byId('caution');
    caution.textContent = lec.caution || '';
    caution.hidden = !lec.caution;
    put(
      byId('takeaways'),
      lec.takeaways.map((t) => h('li', null, h('span', null, t))),
    );
    put(
      chapters,
      lec.chapters.map((c, k) =>
        h(
          'li',
          null,
          h(
            'button',
            { type: 'button', 'data-t': c.start, 'data-k': k },
            h('span', { class: 't' }, clock(c.start)),
            h('span', null, c.heading),
          ),
        ),
      ),
    );
    put(
      byId('docs'),
      lec.docs.map((d) =>
        h(
          'li',
          null,
          h(
            'a',
            { href: safeUrl(d.url, location.href), target: '_blank', rel: 'noopener noreferrer' },
            h('span', null, h('span', null, d.title), h('span', { class: 'host' }, hostOf(d.url))),
            svg(
              'svg',
              {
                viewBox: '0 0 24 24',
                fill: 'none',
                stroke: 'currentColor',
                'stroke-width': 2,
                'aria-hidden': 'true',
              },
              svg('path', { d: OPEN_ICON }),
            ),
          ),
        ),
      ),
    );
  };

  /** 再生している時刻のチャプターに印を付ける */
  const markChapter = (t: number) => {
    const at = lectureOf(page).chapters.reduce((a, c, i) => (c.start <= t + 0.2 ? i : a), 0);
    for (const b of Array.from(chapters.querySelectorAll<HTMLButtonElement>('button'))) {
      b.classList.toggle('on', Number(b.dataset.k) === at);
    }
  };

  return { render, markChapter };
};
