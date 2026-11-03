// 台本のタブ: 今のレクチャーの台詞（場面の見出しごと。押すとその時刻へ）・全レクチャーの台本の検索・再生に合わせた印とスクロール
import { type Page, lectureOf } from './context';
import { byId, closest, h, put } from './dom';
import { clock, pad2 } from './format';

/** 検索の結果に出す数の上限 */
const MAX_HITS = 200;

/**
 * 台本を用意する。seek は今のレクチャーの時刻へ移って再生するとき、openAt は別のレクチャーの時刻を開いて再生するとき（検索の結果）
 */
export const createTranscript = (page: Page, seek: (t: number) => void, openAt: (i: number, t: number) => void) => {
  const { tt, lectures } = page;
  const box = byId('transcript');
  const query = byId<HTMLInputElement>('q');
  const follow = byId<HTMLInputElement>('follow');
  const prefs = page.learning.prefs;
  let cueIndex = -1;

  /** 今のレクチャーの台詞 */
  const render = () => {
    const lec = lectureOf(page);
    const out: HTMLElement[] = [];
    let scene = -1;
    lec.cues.forEach((c, k) => {
      if (c.scene !== scene) {
        scene = c.scene;
        out.push(h('h4', null, lec.chapters[c.scene]?.heading ?? ''));
      }
      out.push(
        h(
          'button',
          { type: 'button', class: 'cue', 'data-k': k, 'data-t': c.start },
          h('span', { class: 't' }, clock(c.start)),
          h('span', null, c.text),
        ),
      );
    });
    put(box, out);
  };

  /** 全レクチャーの台詞から探す（大文字と小文字を区別しない）。空なら今のレクチャーの台詞に戻す */
  const search = (q: string) => {
    const words = q.trim().toLowerCase();
    if (!words) {
      render();
      return;
    }
    const out: HTMLElement[] = [];
    let hits = 0;
    lectures.forEach((lec, li) => {
      for (const c of lec.cues) {
        const at = c.text.toLowerCase().indexOf(words);
        if (at === -1) continue;
        hits += 1;
        if (hits > MAX_HITS) return;
        out.push(
          h(
            'button',
            { type: 'button', class: 'cue', 'data-li': li, 'data-t': c.start },
            h('span', { class: 't' }, h('span', { class: 'hit-lec' }, `L${pad2(lec.no)}`), h('br'), clock(c.start)),
            h(
              'span',
              null,
              c.text.slice(0, at),
              h('mark', null, c.text.slice(at, at + words.length)),
              c.text.slice(at + words.length),
            ),
          ),
        );
      }
    });
    put(box, out.length ? out : h('p', { class: 'hint', style: 'padding:10px' }, tt('searchNone', { q })));
  };
  query.addEventListener('input', () => search(query.value));
  box.addEventListener('click', (e) => {
    const b = closest(e, '.cue');
    if (!b) return;
    const t = Number(b.dataset.t);
    if (b.dataset.li !== undefined && Number(b.dataset.li) !== page.current) {
      openAt(Number(b.dataset.li), t);
      return;
    }
    seek(t + 0.01);
  });
  follow.checked = prefs.follow !== false;
  follow.addEventListener('change', () => {
    prefs.follow = follow.checked;
    page.store.savePrefs(prefs);
  });

  /** 再生している台詞に印を付け、追従がオンで台本のタブを見ている（検索していない）ときは、その台詞が見える所へスクロールする */
  const markCue = (k: number) => {
    if (k === cueIndex) return false;
    cueIndex = k;
    box.querySelector('.cue.on')?.classList.remove('on');
    const el = box.querySelector<HTMLElement>(`.cue[data-k="${k}"]`);
    if (el) {
      el.classList.add('on');
      if (prefs.follow && !byId('p-transcript').hidden && !query.value) {
        box.scrollTop = el.offsetTop - box.offsetTop - box.clientHeight / 3;
      }
    }
    return true;
  };

  /** レクチャーを開いたとき（印を消す） */
  const reset = () => {
    cueIndex = -1;
  };

  return { render, markCue, reset };
};
