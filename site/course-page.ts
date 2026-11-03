// 講座のページの画面。組み立て（scripts/site/build.ts）が、offline-client と同じように Bun で 1 本にまとめ、site/template.html の
// __PAGE_SCRIPT__ の所に入れる（保存版の HTML が 1 枚で完結するよう、外のファイルを読まない。外の JS にすると、SW を更新したときに
// 古い保存版が壊れる）。CSP は、まとめたものの SHA-256 を組み立てが先に計算して書く（scripts/site/csp.ts）。
// データはページの中の JSON（#course-data。形は site/page/data.ts の CourseData）。学習の記録は site/page/storage.ts。
// 役割ごとの部品（site/page/）: player（動画・字幕・速度・全画面・次へ）・curriculum（カリキュラムと進み具合）・overview（概要）・
// transcript（台本と検索）・notes（ノート）・quiz（クイズ）・material（教材・実践課題・AI に聞く）・tabs（タブ）・keyboard（ショートカット）
import type { CourseTextBase } from './i18n';
import { texts } from './lib/text';
import { type Page, lectureOf } from './page/context';
import { createCurriculum } from './page/curriculum';
import type { CourseData } from './page/data';
import { byId, h, put, svg } from './page/dom';
import { findCue, pad2, safeUrl } from './page/format';
import { bindKeyboard } from './page/keyboard';
import { createMaterial } from './page/material';
import { createNotes } from './page/notes';
import { createOverview } from './page/overview';
import { createPlayer } from './page/player';
import { createQuiz } from './page/quiz';
import { openStore, pageStorage, storagePrefix } from './page/storage';
import { createTabs } from './page/tabs';
import { createTranscript } from './page/transcript';

const data = JSON.parse(byId('course-data').textContent ?? '') as CourseData;
const T = data.text;
const { tt, tn } = texts<CourseTextBase>(T, data.lang.html);
const store = openStore(pageStorage(), storagePrefix(data.lang.code, data.course.id));
const page: Page = {
  data,
  lectures: data.lectures,
  T,
  tt,
  tn,
  learning: store.read(),
  store,
  video: byId<HTMLVideoElement>('video'),
  current: 0,
};
const { video } = page;
const progress = page.learning.progress;
const unit = data.course.unitLabel || 'LECTURE';
/** 進み具合が、最後に保存してから変わった（4 秒ごとと、ページを離れるときに保存する） */
let dirtyProgress = false;

const player = createPlayer(page, () => load(page.current + 1, true));
const curriculum = createCurriculum(page, (i) => load(i, true));
const overview = createOverview(page, player.seekAndPlay);
const tabs = createTabs(page);
const transcript = createTranscript(page, player.seekAndPlay, openAt);
const notes = createNotes(page, player.seekAndPlay);
const quiz = createQuiz(page);
const material = createMaterial(page, tabs.show);

function saveProgress() {
  if (!dirtyProgress) return;
  dirtyProgress = false;
  store.saveProgress(progress);
  curriculum.renderCurriculum();
}

/** レクチャーを開く（autoplay なら再生する） */
function load(i: number, autoplay: boolean) {
  if (!Number.isInteger(i) || i < 0 || i >= page.lectures.length) return;
  saveProgress();
  page.current = i;
  const lec = page.lectures[i];
  transcript.reset();
  const p = progress[lec.id];
  player.open(lec, p && !p.done ? p.t : 0, autoplay);
  byId('nowEyebrow').textContent = `${unit} ${pad2(lec.no)}${T.sep}SECTION ${lec.section.no} ${lec.section.title}`;
  byId('nowTitle').textContent = lec.title;
  overview.render(lec);
  transcript.render();
  notes.render();
  quiz.render();
  material.render(lec, store.tab());
  curriculum.renderDone();
  curriculum.renderCurriculum();
  const prev = byId<HTMLButtonElement>('prevBtn');
  const next = byId<HTMLButtonElement>('nextBtn');
  // 押したボタンが端で押せなくなるときは、フォーカスを反対のボタンへ移す（押せないボタンからはフォーカスが消える）
  const focused = document.activeElement;
  prev.disabled = i === 0;
  next.disabled = i === page.lectures.length - 1;
  if (focused === prev && prev.disabled && !next.disabled) next.focus();
  if (focused === next && next.disabled && !prev.disabled) prev.focus();
  try {
    history.replaceState(null, '', `#${lec.id}`);
  } catch {
    // 履歴を書けなくても続ける
  }
  store.saveLast(lec.id);
}

/** 別のレクチャーの時刻を開いて再生する（台本の検索の結果） */
function openAt(i: number, t: number) {
  load(i, false);
  const go = () => {
    video.removeEventListener('loadedmetadata', go);
    player.seekAndPlay(t);
  };
  video.addEventListener('loadedmetadata', go);
}

// 再生の時刻に合わせて、字幕・台本とチャプターの印・進み具合・メモの見出しを進める
video.addEventListener('timeupdate', () => {
  const lec = lectureOf(page);
  const t = video.currentTime;
  const k = findCue(lec.cues, t);
  const cue = k >= 0 ? lec.cues[k] : null;
  // 短い間で字幕がちらつかないように、台詞の終わりから 0.7 秒は残す
  player.caption(cue && t <= cue.end + 0.7 ? cue.text : '');
  if (transcript.markCue(k)) overview.markChapter(t);
  progress[lec.id] ??= { t: 0, max: 0, done: false };
  const p = progress[lec.id];
  p.t = t;
  if (lec.duration) p.max = Math.max(p.max, t / lec.duration);
  if (!p.done && p.max > 0.94) {
    p.done = true;
    curriculum.renderAll();
  }
  dirtyProgress = true;
  notes.label(t);
});
setInterval(saveProgress, 4000);
window.addEventListener('pagehide', saveProgress);

// 終わったら完了にし、次のレクチャーがあれば案内する
video.addEventListener('ended', () => {
  const id = lectureOf(page).id;
  progress[id] ??= { t: 0, max: 0, done: false };
  progress[id].done = true;
  progress[id].t = 0;
  store.saveProgress(progress);
  curriculum.renderAll();
  if (page.current < page.lectures.length - 1) player.offerNext(page.lectures[page.current + 1]);
});
byId('prevBtn').addEventListener('click', () => load(page.current - 1, true));
byId('nextBtn').addEventListener('click', () => load(page.current + 1, true));
bindKeyboard(player, () => load(page.current + 1, true));

// ── はじめに開く ──
byId('credits').textContent = page.tt('credits', {
  voices: data.credits.join(T.creditsSep),
  note: data.course.sourceNote,
});
if (data.course.disclaimer) {
  byId('courseNote').textContent = data.course.disclaimer;
  byId('courseNote').hidden = false;
}
if (data.course.links.length) {
  const links = byId('links');
  put(
    links,
    data.course.links.map((ln) =>
      h(
        'a',
        { href: safeUrl(ln.url, location.href), target: '_blank', rel: 'noopener noreferrer' },
        ln.label,
        svg(
          'svg',
          { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.2, 'aria-hidden': 'true' },
          svg('path', { d: 'M7 17L17 7M9 7h8v8' }),
        ),
      ),
    ),
  );
  links.hidden = false;
}
const ui = data.course.ui;
if (ui.takeaways) byId('takeawaysTitle').textContent = ui.takeaways;
if (ui.docs) byId('tab-docs').textContent = ui.docs;
if (ui.searchHint) {
  byId<HTMLInputElement>('q').placeholder = page.tt('searchPhHint', {
    unit: unit === 'CHAPTER' ? T.unitWordChapter : T.unitWordLecture,
    hint: ui.searchHint,
  });
}
player.setCc(page.learning.prefs.cc);
curriculum.renderCourseProgress();
const fromHash = location.hash.replace('#', '');
const startId = page.lectures.some((l) => l.id === fromHash) ? fromHash : (store.last() ?? page.lectures[0].id);
load(
  Math.max(
    0,
    page.lectures.findIndex((l) => l.id === startId),
  ),
  false,
);
tabs.show(store.tab() ?? 'overview');
