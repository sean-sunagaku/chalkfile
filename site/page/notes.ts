// ノートのタブ: 今の時刻にメモを残す・時刻へ移る・消す・全部のノートを Markdown でコピーする（この端末のブラウザに保存する）
import { type Page, lectureOf } from './context';
import { byId, closest, h, put } from './dom';
import { clock, pad2 } from './format';

let toastTimer: ReturnType<typeof setTimeout> | undefined;

/** 画面の下に短い知らせを出す（読み上げにも伝える） */
export const toast = (message: string) => {
  let el = document.querySelector<HTMLElement>('.toast');
  if (!el) {
    el = h('div', { class: 'toast', role: 'status' });
    document.body.append(el);
  }
  const shown = el;
  shown.textContent = message;
  shown.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    shown.hidden = true;
  }, 2200);
};

/** ノートを用意する。seek は、メモの時刻を押したとき（その時刻へ移って再生する） */
export const createNotes = (page: Page, seek: (t: number) => void) => {
  const { T, tt, video, lectures } = page;
  const notes = page.learning.notes;
  const list = byId('notes');
  const input = byId<HTMLTextAreaElement>('noteText');

  const render = () => {
    const items = notes[lectureOf(page).id] ?? [];
    put(
      list,
      items.length
        ? items.map((n, k) =>
            h(
              'li',
              null,
              h('button', { type: 'button', class: 'stamp', 'data-t': n.t }, clock(n.t)),
              h('div', { class: 'body' }, n.text),
              h('button', { type: 'button', class: 'del', 'data-k': k, 'aria-label': T.noteDelLabel }, T.noteDel),
            ),
          )
        : h('li', { style: 'display:block' }, h('span', { class: 'hint' }, T.noteEmpty)),
    );
  };

  byId('noteAdd').addEventListener('click', () => {
    const text = input.value.trim();
    if (!text) {
      input.focus();
      return;
    }
    const id = lectureOf(page).id;
    notes[id] ??= [];
    notes[id].push({ t: Math.floor(video.currentTime), text, at: Date.now() });
    notes[id].sort((a, b) => a.t - b.t);
    page.store.saveNotes(notes);
    input.value = '';
    render();
    toast(T.noteSaved);
  });
  list.addEventListener('click', (e) => {
    const stamp = closest(e, '.stamp');
    if (stamp) {
      seek(Number(stamp.dataset.t));
      return;
    }
    const del = closest(e, '.del');
    if (del) {
      const k = Number(del.dataset.k);
      notes[lectureOf(page).id]?.splice(k, 1);
      page.store.saveNotes(notes);
      render();
      // 押した「消す」は無くなるので、同じ所（無ければ 1 つ前）のメモの「消す」へ、メモが無くなれば書く欄へフォーカスを移す
      const left = list.querySelectorAll<HTMLButtonElement>('.del');
      (left[Math.min(k, left.length - 1)] ?? input).focus();
    }
  });
  byId('noteCopy').addEventListener('click', () => {
    const out: string[] = [];
    for (const lec of lectures) {
      const items = notes[lec.id] ?? [];
      if (!items.length) continue;
      out.push(`## L${pad2(lec.no)} ${lec.title}`);
      for (const n of items) out.push(`- [${clock(n.t)}] ${n.text.replace(/\n/g, ' ')}`);
      out.push('');
    }
    const text = out.join('\n') || T.notesNone;
    const fallback = () => {
      input.value = text;
      input.select();
      toast(T.copyFallback);
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => toast(T.copied), fallback);
    else fallback();
  });

  /** メモの見出し（今の時刻にメモ）。再生の時刻が進むたびに書き直す */
  const label = (t: number) => {
    byId('noteAddLabel').textContent = tt('noteAt', { t: clock(t) });
  };

  return { render, label };
};
