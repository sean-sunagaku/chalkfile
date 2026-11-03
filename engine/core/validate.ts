// 台本の検証。描く前・声を作る前に、台本の誤りを見つける（React・Remotion・Node に依存しない純粋な関数）。
//   validateCourse(course, ctx)       講座 1 つ（講座の項目と、全部の動画）。ctx は台本の外の一覧（テーマの id）
//   validateCourses(courses)          講座をまたいだもの（頭文字・並び・講座 ID が重ならないか。日本語の講座の一覧を渡す）
//   validateLecture(lecture, course)  動画 1 本（訳の動画は、訳を重ねたあとのレクチャーと訳の講座を渡す）
//   validateTimeline(lecture, course, timeline)  synth が書いた timeline が台本の形と合うか（指紋が今の台本と同じか）
//   validateTimelineFiles(lecture, course, files)  置いてある timeline のファイル（重なり・置き場所・読めるか）と、上の確かめ
//   validateTheme(theme)              テーマの色の形（#RRGGBB）と、要る項目（暗い地は面と線の色 dark も）
// 呼ぶ場所: bun scripts/validate.ts（全講座・全言語）・scripts/synth.ts の最初（対象の動画だけ）・src/Root.tsx（Studio はその動画だけを止める）
// 結果は { where: '講座/動画 場面 n 項目', message, level, rule } の一覧。
//   error: 描くと止まるか黙って崩れる誤りと、手で書いた派生データ（セクション・クイズの番号・次の動画・syllabus）の食い違いと、訳の重ね方の誤り
//   warning: 見込み（焼き込み字幕が 3 行・見出しの幅）・style.md の目安・** の対応・意図かもしれない派生データの違い・古い書き方（engine/core/legacy.ts）
// engine/core の外を import しない。台本の外の一覧のうち、中身（content/）にあるもの（テーマの一覧）は、validateCourse を呼ぶ側が渡す（CourseContext）
import { assertNever } from './assert';
import { isHex } from './color';
import { timelineFile } from './generated';
import { AT_KEYS, l10nProblems, videoKey, type Lang } from './i18n';
import { legacyUses } from './legacy';
import { COURSE_SCHEMA_VERSION, isKnownSchemaVersion, schemaVersionOf } from './migrate';
import { SCENE_INFO, SCENE_KINDS } from './scenes';
import type { Course, DarkSurfaces, Evidence, FontKey, Lecture, Line, Scene, SfxId, TerminalTone, Theme, Tone, VoiceId } from './schema';
import { timelineFingerprint, type TimelineEntry } from './timeline';
import { CAPTION, CONTENT, HEADING, VIDEO } from './video-config';
import { VIDEO_TEXT } from './video-text';

export type Level = 'error' | 'warning';

/** 誤りと注意の種類（一覧の内訳と、テストで何が見つかったかを見分けるのに使う） */
export const RULES = {
  scenes: '場面の並び',
  l10n: '訳の重ね方',
  kind: '場面の種類',
  lines: '台詞',
  'line-id': '台詞の id',
  at: '台詞の番号（at）',
  key: 'key の抜けと重なり',
  ref: '矢印・focus の行き先',
  empty: '中身が空',
  table: '表の幅とセル',
  'code-marks': 'コードの光らせる行',
  'mock-notes': '画面の図の注',
  quiz: 'クイズ',
  'quiz-no': 'クイズの番号',
  theme: 'テーマ',
  sfx: '効果音',
  voice: '声',
  tone: '色の名前',
  evidence: '根拠の札',
  hold: '場面の後の間',
  section: 'セクション',
  'ending-next': 'エンディングの次の動画',
  syllabus: 'syllabus と動画',
  'lecture-no': '動画の番号',
  timeline: 'timeline と台本',
  prefix: 'レクチャー ID の頭文字（prefix）',
  order: '講座の並び（order）',
  'course-id': '講座 ID',
  schema: '台本の形の版（schemaVersion）',
  'caption-lines': '焼き込み字幕の行数（見込み）',
  'heading-width': '見出しの幅（見込み）',
  style: 'style.md の目安（表・コードの大きさ）',
  emphasis: '強調の **',
  legacy: '古い書き方（明示の項目に書き換えるとよい）',
} as const;
export type Rule = keyof typeof RULES;

export type Issue = { where: string; message: string; level: Level; rule: Rule };

/* ───────────── 名前の一覧（型と同じものを、実行時に確かめる用に持つ。足し忘れると型で止まる） ───────────── */
// 場面の種類の一覧は engine/core/scenes.ts の SCENE_INFO（教材の絵コンテと同じ一覧）

/** 効果音（scripts/mix.py の SFX_DB と public/audio/sfx/<名前>.wav） */
const SFX_SET: Record<SfxId, true> = { pop: true, whoosh: true, chime: true, tick: true, reveal: true, correct: true, type: true, harisen: true, chin: true, drumroll: true, deden: true, zuko: true };
export const SFX_IDS = Object.keys(SFX_SET) as SfxId[];

/** 声（engine/core/voices.ts の VOICES と KOKORO） */
const VOICE_SET: Record<VoiceId, true> = { narrator: true, announcer: true, zundamon: true, 'zundamon-cry': true, tsukkomi: true, tennokoe: true };
export const VOICE_IDS = Object.keys(VOICE_SET) as VoiceId[];

const TONE_SET: Record<Tone, true> = { pink: true, violet: true, cyan: true, mint: true, amber: true, coral: true, slate: true };
/** 端末の出力の色（src/scenes/terminal.tsx） */
const TERMINAL_TONE_SET: Record<TerminalTone, true> = { ok: true, info: true };
const EVIDENCE_SET: Record<Evidence, true> = { research: true, official: true, practice: true, example: true };

const has = <K extends string>(set: Record<K, true>, v: unknown): v is K => typeof v === 'string' && Object.hasOwn(set, v);
const names = (set: Record<string, true>) => Object.keys(set).join('・');

/* ───────────── 画面の大きさの見込み ─────────────
 * 大きさは部品と同じ engine/core/video-config.ts の値（実際に測る形に変えるのは、見た目の更新のとき）。文字の幅は見積もりなので、注意にとどめる。
 * 半角の英数字と記号は平均 0.5em、ほか（かな・漢字・全角の記号）は 1em と見る。2026-11-02 に、字幕つきの静止画 22 枚（日本語・英語・中国語）と
 * 見出し 4 枚を書き出して、行数と幅がこの見込みと合うことを確かめた（Zen Maru Gothic の英字は約 0.44em、Inter はもう少し広い）
 */
const LAYOUT = {
  /** 焼き込み字幕（src/Lecture.tsx の Captions）。使える幅は画面の幅から左右の余白を引いたもの（今は 1680px）。名前札は、文字の幅に左右の余白と札と文の間を足す */
  caption: { size: CAPTION.size, spacing: CAPTION.spacing, width: VIDEO.width - CAPTION.sidePad * 2, lines: CAPTION.lines, nameSize: CAPTION.nameSize, namePad: CAPTION.namePadX * 2, gap: CAPTION.gap },
  /** 場面の見出し（src/components/chrome.tsx の Header）。折り返さない。使える幅は内容の枠の幅（今は 1728px）。根拠の札は、文字の幅に札の余白とアイコン（chipPad）と見出しとの間を足す */
  heading: { size: HEADING.size, spacing: HEADING.spacing, width: VIDEO.width - CONTENT.pad * 2, chipSize: HEADING.chipSize, chipSpacing: HEADING.chipSpacing, chipPad: HEADING.chipPad, gap: HEADING.gap },
};

/** 文字の幅の見込み（px）。半角の英数字と記号は 0.5em、ほか（かな・漢字・全角の記号）は 1em。字間は 1 字ごとに足す */
export const estimateWidth = (text: string, size: number, spacing = 0): number =>
  [...text].reduce((w, ch) => w + (/[\x20-\x7E]/.test(ch) ? 0.5 : 1) * size + spacing, 0);

/** 焼き込み字幕の、文字の幅の見込みと、1 行に使える幅（px）。name は掛け合いの名前札（講座の cast） */
const captionFit = (text: string, name?: string) => {
  const c = LAYOUT.caption;
  const tag = name ? estimateWidth(name, c.nameSize) + c.namePad + c.gap : 0;
  return { width: estimateWidth(text, c.size, c.spacing), line: c.width - tag };
};

/** 焼き込み字幕の行数の見込み */
export const captionLines = (text: string, name?: string): number => {
  const { width, line } = captionFit(text, name);
  return Math.ceil(width / line);
};

/* ───────────── 小さな道具 ───────────── */

const push = (out: Issue[], level: Level, rule: Rule, where: string, message: string): void => {
  out.push({ where, message, level, rule });
};
const list = <T>(x: T[] | undefined | null): T[] => (Array.isArray(x) ? x : []);
const isInt = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x);
const count = (s: string, sub: string) => s.split(sub).length - 1;

/** 動画の場所（講座/動画。訳の動画は S01.en） */
export const videoWhere = (lecture: Lecture, course: Course) => `${course.id}/${videoKey(lecture.id, course.lang ?? 'ja')}`;
const courseWhere = (course: Course) => (course.lang && course.lang !== 'ja' ? `${course.id}（${course.lang}）` : course.id);

type Leaf = (key: string, value: unknown, path: string) => void;
/** 値を末端までたどる。配列の中の値は、配列の項目の名前で呼ぶ（cells[1] の key は cells） */
const walk = (v: unknown, path: string, key: string, leaf: Leaf): void => {
  if (Array.isArray(v)) { v.forEach((x, i) => { walk(x, `${path}[${i}]`, key, leaf); }); return; }
  if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k, k, leaf);
    return;
  }
  leaf(key, v, path);
};

/** key の一覧を作る。抜けと重なりは誤り（矢印と focus が、どれを指すか決まらない） */
const keysOf = (items: { key?: unknown }[], where: string, out: Issue[]): Set<string> => {
  const seen = new Set<string>();
  items.forEach((it, i) => {
    const k = it?.key;
    if (typeof k !== 'string' || !k) { push(out, 'error', 'key', `${where}[${i}].key`, 'key が無い'); return; }
    if (seen.has(k)) push(out, 'error', 'key', `${where}[${i}].key`, `key「${k}」が重なっている（矢印と focus が、どれを指すか決まらない）`);
    seen.add(k);
  });
  return seen;
};

/** 行き先の key が一覧にあるか */
const refTo = (keys: Set<string>, k: unknown, what: string, effect: string, where: string, out: Issue[]) => {
  if (typeof k === 'string' && keys.has(k)) return;
  push(out, 'error', 'ref', where, `${what}「${String(k)}」が無い（あるのは ${[...keys].join('・') || 'なし'}）。${effect}`);
};

/** 中身の一覧が空でないか */
const notEmpty = (x: unknown[] | undefined, what: string, where: string, out: Issue[]) => {
  if (!list(x).length) push(out, 'error', 'empty', where, `${what}が無い（画面に何も出ない）`);
};

/* ───────────── 場面 ───────────── */

/** ** を強調として描く項目（src/components/ui.tsx の Rich で描く）。ほかの項目の ** は、そのまま文字として出る */
const richField = (s: Scene, path: string) => (s.kind === 'big' && path === 'text') || (s.kind === 'screens' && /^(left|right)\.notes\[\d+\]\.text$/.test(path));
/** 文字として描かない項目（コード・端末・読み上げ・URL）。** を見ない */
const LITERAL = new Set(['code', 'cmd', 'out', 'url', 'file', 's']);

const checkEmphasis = (text: string, rich: boolean, where: string, out: Issue[]) => {
  const n = count(text, '**');
  if (!n) return;
  if (!rich) push(out, 'warning', 'emphasis', where, 'この項目の ** は強調にならず、そのまま文字で出る（強調できるのは big の text と画面の図の注だけ）');
  else if (n % 2) push(out, 'warning', 'emphasis', where, `強調の ** が閉じていない（${n} 個）`);
};

/** 場面の台詞の id の一覧。空の id と、同じ場面の中の重なりは誤り（at がどの台詞を指すか決まらない） */
const lineIds = (lines: Line[], sw: string, out: Issue[]): Set<string> => {
  const seen = new Set<string>();
  lines.forEach((ln, k) => {
    const id: unknown = ln?.id;
    if (id === undefined) return;
    const w = `${sw} lines[${k}].id`;
    if (typeof id !== 'string' || !id.trim()) push(out, 'error', 'line-id', w, `台詞の id は空でない文字で書く（書いたのは ${JSON.stringify(id)}）`);
    else if (seen.has(id)) push(out, 'error', 'line-id', w, `台詞の id「${id}」が、同じ場面の中で重なっている（at がどの台詞を指すか決まらない）`);
    else seen.add(id);
  });
  return seen;
};

const checkLine = (line: Line, k: number, sw: string, course: Course, out: Issue[]) => {
  const w = `${sw} lines[${k}]`;
  if (typeof line?.t !== 'string' || !line.t.trim()) push(out, 'error', 'lines', `${w}.t`, '台詞が空（字幕も声も作れない）');
  if (line?.v !== undefined && !has(VOICE_SET, line.v)) push(out, 'error', 'voice', `${w}.v`, `声「${String(line.v)}」が無い（あるのは ${names(VOICE_SET)}）`);
  for (const key of ['sfx', 'sfxAfter'] as const) {
    if (line?.[key] !== undefined && !has(SFX_SET, line[key])) push(out, 'error', 'sfx', `${w}.${key}`, `効果音「${String(line[key])}」が無い（あるのは ${names(SFX_SET)}）`);
  }
  if (line?.bgm !== undefined && line.bgm !== 'cut' && line.bgm !== 'back') push(out, 'error', 'lines', `${w}.bgm`, `bgm は cut か back（書いたのは ${String(line.bgm)}）`);
  if (typeof line?.t !== 'string') return;
  checkEmphasis(line.t, false, `${w}.t`, out);
  const name = course.cast?.[line.v ?? 'narrator']?.name;
  const { width, line: room } = captionFit(line.t, name);
  const n = Math.ceil(width / room);
  if (n > LAYOUT.caption.lines) {
    push(out, 'warning', 'caption-lines', `${w}.t`, `焼き込み字幕が ${n} 行になる見込み（文字の幅は約 ${Math.round(width)}px、帯の 2 行に入るのは約 ${Math.round(room * 2)}px まで）。台詞を短くするか、2 つに分ける`);
  }
};

const checkHeading = (s: Scene, sw: string, course: Course, lang: Lang, out: Issue[]) => {
  if (!s.heading || s.kind === 'opening' || s.kind === 'ending') return;
  const h = LAYOUT.heading;
  const chip = s.evidence && has(EVIDENCE_SET, s.evidence) && !course.standalone ? h.chipPad + estimateWidth(VIDEO_TEXT[lang].evidence[s.evidence], h.chipSize, h.chipSpacing) + h.gap : 0;
  const width = estimateWidth(s.heading, h.size, h.spacing);
  if (width > h.width - chip) {
    push(out, 'warning', 'heading-width', `${sw} heading`, `見出しが 1 行に入らない見込み（約 ${Math.round(width)}px・使える幅 ${Math.round(h.width - chip)}px${chip ? '。根拠の札のぶんを引いた幅' : ''}）。短くする`);
  }
};

/** 場面の種類ごとの中身（参照の行き先・範囲・数） */
const checkBody = (s: Scene, sw: string, out: Issue[]) => {
  const w = (path: string) => `${sw} ${s.kind}.${path}`;
  switch (s.kind) {
    case 'opening':
      if (!s.title?.trim()) push(out, 'error', 'empty', w('title'), '題が無い');
      return;
    case 'goals':
    case 'points':
    case 'recap':
      return notEmpty(s.items, '項目（items）', w('items'), out);
    case 'concepts':
      notEmpty(s.cards, 'カード（cards）', w('cards'), out);
      keysOf(list(s.cards), w('cards'), out);
      return;
    case 'sequence': {
      notEmpty(s.actors, '登場人物（actors）', w('actors'), out);
      notEmpty(s.steps, '矢印（steps）', w('steps'), out);
      const keys = keysOf(list(s.actors), w('actors'), out);
      list(s.steps).forEach((st, i) => {
        refTo(keys, st?.from, '矢印の出どころ', '矢印が画面の外に描かれる', w(`steps[${i}].from`), out);
        refTo(keys, st?.to, '矢印の行き先', '矢印が画面の外に描かれる', w(`steps[${i}].to`), out);
      });
      return;
    }
    case 'flow':
    case 'states': {
      notEmpty(s.nodes, '箱（nodes）', w('nodes'), out);
      const keys = keysOf(list<{ key?: unknown }>(s.nodes), w('nodes'), out);
      list<{ from?: unknown; to?: unknown }>(s.edges).forEach((e, i) => {
        refTo(keys, e?.from, '矢印の出どころ', '描くと TypeError で止まる', w(`edges[${i}].from`), out);
        refTo(keys, e?.to, '矢印の行き先', '描くと TypeError で止まる', w(`edges[${i}].to`), out);
      });
      list<{ keys?: unknown[] }>(s.focus).forEach((f, i) => { list(f?.keys).forEach((k, j) => { refTo(keys, k, 'focus の箱', 'focus が光らせない', w(`focus[${i}].keys[${j}]`), out); }); });
      return;
    }
    case 'code': {
      const n = typeof s.code === 'string' ? s.code.split('\n').length : 0;
      if (!n || !s.code.trim()) push(out, 'error', 'empty', w('code'), 'コードが無い');
      list(s.marks).forEach((m, i) => {
        if (!isInt(m?.from) || !isInt(m?.to) || m.from < 1 || m.to > n) {
          push(out, 'error', 'code-marks', w(`marks[${i}]`), `光らせる行 ${String(m?.from)}〜${String(m?.to)} が、コードの行（1〜${n}）の外`);
        } else if (m.from > m.to) {
          push(out, 'error', 'code-marks', w(`marks[${i}]`), `光らせる行の始まり（${m.from}）が終わり（${m.to}）より後`);
        }
      });
      if (n > 18) push(out, 'warning', 'style', w('code'), `コードが ${n} 行ある（style.md の目安は 18 行まで。場面を分けて、光らせる行を絞る）`);
      return;
    }
    case 'table': {
      const n = list(s.columns).length;
      if (!n) push(out, 'error', 'empty', w('columns'), '列（columns）が無い');
      notEmpty(s.rows, '行（rows）', w('rows'), out);
      if (s.widths !== undefined) {
        if (list(s.widths).length !== n) push(out, 'error', 'table', w('widths'), `widths の数（${list(s.widths).length}）が列の数（${n}）と合わない（列の幅が NaN% になる）`);
        else {
          const sum = s.widths.reduce((a, b) => a + b, 0);
          if (s.widths.some((x) => !(x > 0))) push(out, 'error', 'table', w('widths'), 'widths に 0 以下の幅がある');
          else if (Math.abs(sum - 1) > 0.01) push(out, 'warning', 'table', w('widths'), `widths の合計が 1 でない（${+sum.toFixed(3)}）。表の幅が内容の枠とずれる`);
        }
      }
      list(s.rows).forEach((r, i) => {
        if (list(r?.cells).length !== n) push(out, 'error', 'table', w(`rows[${i}].cells`), `セルの数（${list(r?.cells).length}）が列の数（${n}）と合わない`);
      });
      list(s.mono).forEach((m, i) => {
        if (!isInt(m) || m < 0 || m >= n) push(out, 'error', 'table', w(`mono[${i}]`), `等幅にする列の番号（${String(m)}）が、列（0〜${n - 1}）の外`);
      });
      const rows = list(s.rows).length;
      if (rows > 6 || n > 3) push(out, 'warning', 'style', w(rows > 6 ? 'rows' : 'columns'), `表が ${rows} 行 × ${n} 列ある（style.md の目安は 6 行・3 列まで。場面を分ける）`);
      return;
    }
    case 'compare':
      return;
    case 'big':
      if (!s.text?.trim()) push(out, 'error', 'empty', w('text'), '大きな文字（text）が無い');
      return;
    case 'numbers':
      return notEmpty(s.items, '数字（items）', w('items'), out);
    case 'timeline': {
      notEmpty(s.items, '項目（items）', w('items'), out);
      const keys = keysOf(list(s.items), w('items'), out);
      list(s.focus).forEach((f, i) => { f?.key !== null && refTo(keys, f?.key, 'focus の項目', 'focus が何も光らせず、進み具合の線も伸びない', w(`focus[${i}].key`), out); });
      list(s.items).forEach((it, i) => {
        if (typeof it?.title === 'string' && count(it.title, '　') > 1) push(out, 'warning', 'style', w(`items[${i}].title`), '題に全角の空白が 2 つ以上ある（1 つ目で札と題に分け、3 つ目より後は出ない）');
      });
      return;
    }
    case 'quiz':
      if (isInt(s.revealAt) && s.revealAt < 1) push(out, 'error', 'quiz', w('revealAt'), `答え合わせ（revealAt: ${s.revealAt}）が問いの台詞（0）と同時になる。1 以上にする`);
      if (typeof s.answer !== 'boolean') push(out, 'error', 'quiz', w('answer'), 'answer は true（正しい）か false（誤解）');
      return;
    case 'refs':
      return notEmpty(s.refs, '参考（refs）', w('refs'), out);
    case 'phone':
      return notEmpty(s.screens, '画面（screens）', w('screens'), out);
    case 'screens':
      for (const side of ['left', 'right'] as const) {
        const sc = s[side];
        if (!sc) continue;
        const blocks = list(sc.blocks).length;
        if (!blocks) push(out, 'error', 'empty', w(`${side}.blocks`), '画面の部品（blocks）が無い');
        const blockIds = new Map<string, number>();
        list(sc.blocks).forEach((b, i) => {
          const id: unknown = b?.id;
          if (id === undefined) return;
          if (typeof id !== 'string' || !id.trim()) push(out, 'error', 'mock-notes', w(`${side}.blocks[${i}].id`), `部品の id は空でない文字で書く（書いたのは ${JSON.stringify(id)}）`);
          else if (blockIds.has(id)) push(out, 'error', 'mock-notes', w(`${side}.blocks[${i}].id`), `部品の id「${id}」が、同じ画面の中で重なっている（注の blockId がどの部品を指すか決まらない）`);
          else blockIds.set(id, i);
        });
        const seen = new Set<number>();
        list(sc.notes).forEach((nt, i) => {
          // blockId（部品の id）は、読み込むとき（engine/core/lines.ts）に block（番号）に直る
          const found = nt?.blockId === undefined ? undefined : blockIds.get(nt.blockId);
          if (nt?.blockId !== undefined && found === undefined) {
            push(out, 'error', 'mock-notes', w(`${side}.notes[${i}].blockId`), `注の blockId「${String(nt.blockId)}」が、この画面の部品に無い（id のある部品は ${[...blockIds.keys()].join('・') || 'なし'}。注の枠と番号が出ない）`);
          } else if (found !== undefined && nt.block !== found) {
            push(out, 'error', 'mock-notes', w(`${side}.notes[${i}].blockId`), `注の block（${String(nt.block)}）と blockId「${nt.blockId}」（${found} 番目の部品）が、違う部品を指している（どちらか 1 つにする）`);
          } else if (nt?.block === undefined) {
            push(out, 'error', 'mock-notes', w(`${side}.notes[${i}].block`), '注を付ける部品が無い（block か blockId を書く。注の枠と番号が出ない）');
          } else if (!isInt(nt.block) || nt.block < 0 || nt.block >= blocks) {
            push(out, 'error', 'mock-notes', w(`${side}.notes[${i}].block`), `注の block（${String(nt?.block)}）が部品の範囲（0〜${blocks - 1}）の外（注の枠と番号が出ない）`);
          }
          if (seen.has(nt?.n)) push(out, 'error', 'mock-notes', w(`${side}.notes[${i}].n`), `注の番号 ${nt.n} が、同じ画面の中で重なっている`);
          seen.add(nt?.n);
        });
      }
      return;
    case 'terminal':
      notEmpty(s.entries, '入力と出力（entries）', w('entries'), out);
      list(s.entries).forEach((e, i) => {
        list(e?.out).forEach((o, k) => {
          if (typeof o === 'string') return;
          const at = w(`entries[${i}].out[${k}]`);
          if (typeof o?.text !== 'string') push(out, 'error', 'empty', `${at}.text`, '出力の行の文字（text）が無い');
          if (o?.tone !== undefined && !has(TERMINAL_TONE_SET, o.tone)) push(out, 'error', 'tone', `${at}.tone`, `端末の出力の色「${String(o.tone)}」が無い（あるのは ${names(TERMINAL_TONE_SET)}。書かなければ薄い色）`);
        });
      });
      return;
    case 'ending':
      return;
    default:
      // 場面の種類を足したのに、ここで扱っていないと型で止まる（知らない種類は checkScene が先に誤りにする）
      return assertNever(s, '場面の種類');
  }
};

/** 場面に共通のこと: 台詞・at の範囲・色の名前・根拠の札・** */
const checkScene = (s: Scene, i: number, where: string, course: Course, lang: Lang, out: Issue[]) => {
  const sw = `${where} 場面 ${i + 1}`;
  if (!s || typeof s !== 'object') { push(out, 'error', 'kind', sw, '場面が空'); return; }
  if (!Object.hasOwn(SCENE_INFO, s.kind)) {
    push(out, 'error', 'kind', sw, `場面の種類「${String((s as { kind?: unknown }).kind)}」が無い（あるのは ${SCENE_KINDS.join('・')}）`);
    return;
  }
  const lines = list(s.lines);
  if (!lines.length) push(out, 'error', 'lines', `${sw} lines`, '台詞が無い（場面は台詞で進むので、1 つは書く）');
  lines.forEach((ln, k) => { checkLine(ln, k, sw, course, out); });
  const ids = lineIds(lines, sw, out);
  if (s.hold !== undefined && !(typeof s.hold === 'number' && s.hold >= 0)) push(out, 'error', 'hold', `${sw} hold`, `hold は 0 以上の秒（書いたのは ${String(s.hold)}）`);
  if (s.evidence !== undefined && !has(EVIDENCE_SET, s.evidence)) push(out, 'error', 'evidence', `${sw} evidence`, `根拠の種類「${String(s.evidence)}」が無い（あるのは ${names(EVIDENCE_SET)}）`);
  for (const [key, value] of Object.entries(s)) {
    if (key === 'lines') continue;
    walk(value, key, key, (k, v, path) => {
      const at = `${sw} ${s.kind}.${path}`;
      if (AT_KEYS.includes(k) && v !== undefined) {
        // 台詞の id で書いた at は、読み込むとき（engine/core/lines.ts）に番号に直る。文字のまま残ったものは、場面に無い id
        if (typeof v === 'string') push(out, 'error', 'at', at, `台詞の id「${v}」が、この場面の台詞に無い（あるのは ${[...ids].join('・') || 'なし。台詞に id を付ける'}）`);
        else if (typeof v !== 'number' || !Number.isInteger(v)) push(out, 'error', 'at', at, `台詞の番号が整数でない: ${String(v)}`);
        else if (v < 0 || v > lines.length) push(out, 'error', 'at', at, `台詞の番号 ${v} が範囲の外（この場面の台詞は ${lines.length} 個。0〜${lines.length} で書く）`);
      }
      // 画面の図の部品（blocks）の tone は注意の帯の種類（error・info・warn・success）、端末の出力（out）の tone は ok・info で、図の色ではない
      if (k === 'tone' && v !== undefined && !/(^|\.)(blocks|out)\[/.test(path) && !has(TONE_SET, v)) push(out, 'error', 'tone', at, `色の名前「${String(v)}」が無い（あるのは ${names(TONE_SET)}）`);
      if (typeof v === 'string' && !LITERAL.has(k) && !/(^|\.)out\[\d+\]\.text$/.test(path)) checkEmphasis(v, richField(s, path), at, out);
    });
  }
  checkBody(s, sw, out);
  checkHeading(s, sw, course, lang, out);
  for (const u of legacyUses(s)) push(out, 'warning', 'legacy', `${sw} ${u.path}`, u.message);
};

/* ───────────── 手で書いた派生データ（セクション・クイズの番号・次の動画・syllabus） ───────────── */

const SECTION_LABEL = /^SECTION\s*(\d+)[\s　]+(.+)$/;

const checkDerived = (lec: Lecture, course: Course, where: string, out: Issue[]) => {
  const sections = list(course.sections);
  const sec = sections.find((x) => x.no === lec.section?.no);
  if (!sec) push(out, 'error', 'section', `${where} section.no`, `セクション ${String(lec.section?.no)} が講座の sections に無い（あるのは ${sections.map((x) => x.no).join('・') || 'なし'}）`);
  else if (sec.title !== lec.section.title) push(out, 'error', 'section', `${where} section.title`, `セクションの題「${lec.section.title}」が、講座の sections の ${sec.no}「${sec.title}」と違う`);

  const scenes = list(lec.scenes);
  scenes.forEach((s, i) => {
    if (s?.kind !== 'opening' || !s.section) return;
    const m = SECTION_LABEL.exec(s.section);
    const w = `${where} 場面 ${i + 1} opening.section`;
    if (m && Number(m[1]) !== lec.section?.no) push(out, 'error', 'section', w, `札の「SECTION ${m[1]}」が、この動画のセクション（${String(lec.section?.no)}）と違う`);
    else if (sec && (m ? m[2] : s.section) !== sec.title) push(out, 'warning', 'section', w, `札の題「${m ? m[2] : s.section}」が、セクションの題「${sec.title}」と違う`);
  });

  // クイズの番号は、この動画の何問目か（画面に Q1・1 / 3 と出る）
  let q = 0;
  scenes.forEach((s, i) => {
    if (s?.kind !== 'quiz') return;
    q++;
    if (s.no !== q) push(out, 'error', 'quiz-no', `${where} 場面 ${i + 1} quiz.no`, `クイズの番号 no: ${String(s.no)} が、この動画の ${q} 問目と合わない（画面に Q${String(s.no)} と出る）`);
  });

  // エンディングの次の動画は、講座の次の番号の動画（まだ無ければ syllabus の章）
  const nextNo = lec.no + 1;
  const nextLec = list(course.lectures).find((l) => l.no === nextNo);
  const nextCh = list(course.syllabus?.chapters).find((c) => c.no === nextNo);
  scenes.forEach((s, i) => {
    if (s?.kind !== 'ending') return;
    const w = `${where} 場面 ${i + 1} ending.next`;
    if (!s.next) {
      if (nextLec && !course.standalone) push(out, 'warning', 'ending-next', w, `次の動画（${nextLec.id}）があるのに、エンディングに next が無い`);
      return;
    }
    if (s.next.no !== nextNo) { push(out, 'error', 'ending-next', `${w}.no`, `次の番号 ${s.next.no} が、この動画の次（${nextNo}）と合わない`); return; }
    const title = nextLec?.title ?? nextCh?.title;
    if (title === undefined) push(out, 'warning', 'ending-next', w, `次の ${nextNo} 本目が講座にまだ無い（予告として書いたなら、このままでよい）`);
    else if (s.next.title !== title) push(out, 'warning', 'ending-next', `${w}.title`, `次の題「${s.next.title}」が、${nextLec ? `次の動画（${nextLec.id}）` : 'syllabus の章'}の題「${title}」と違う`);
  });

  // syllabus（講座の設計）にある章と、動画の二重持ち
  if (course.syllabus) {
    const ch = list(course.syllabus.chapters).find((c) => c.lectureId === lec.id);
    const w = `${where} syllabus`;
    if (!ch) push(out, 'error', 'syllabus', w, `講座の syllabus に、この動画（${lec.id}）の章が無い`);
    else {
      if (ch.no !== lec.no) push(out, 'error', 'syllabus', `${w}.no`, `syllabus の番号 ${ch.no} が、動画の番号 ${lec.no} と違う`);
      if (ch.section !== lec.section?.no) push(out, 'error', 'syllabus', `${w}.section`, `syllabus のセクション ${ch.section} が、動画のセクション ${String(lec.section?.no)} と違う`);
      if (ch.title !== lec.title) push(out, 'warning', 'syllabus', `${w}.title`, `syllabus の題「${ch.title}」が、動画の題「${lec.title}」と違う`);
      if (ch.status !== 'produced') push(out, 'warning', 'syllabus', `${w}.status`, `動画があるのに、syllabus の status が ${ch.status} のまま`);
    }
  }
  const total = course.syllabus?.chapters.length ?? list(course.lectures).length;
  if (!isInt(lec.no) || lec.no < 1 || lec.no > total) push(out, 'warning', 'lecture-no', `${where} no`, `動画の番号 ${String(lec.no)} が、講座の本数（1〜${total}）の外（進み具合の点が光らない）`);
};

/* ───────────── 入口 ───────────── */

/** 動画 1 本。訳の動画は、訳を重ねたあとのレクチャーと、訳の講座（coursesIn(lang) のもの）を渡す */
export const validateLecture = (lecture: Lecture, course: Course): Issue[] => {
  const out: Issue[] = [];
  const where = videoWhere(lecture, course);
  const lang: Lang = course.lang ?? 'ja';
  // 訳の動画は、訳を重ねたときの誤り（engine/core/i18n.ts の localizeLecture が集めたもの）も、この動画の誤りにする
  for (const p of l10nProblems(lecture)) push(out, 'error', 'l10n', `${where} ${p.where}`, p.message);
  const scenes = list(lecture.scenes);
  if (!scenes.length) push(out, 'error', 'scenes', `${where} scenes`, '場面が無い');
  scenes.forEach((s, i) => { checkScene(s, i, where, course, lang, out); });
  list(lecture.quiz).forEach((qz, i) => {
    const n = list(qz?.choices).length;
    if (n < 2) push(out, 'error', 'quiz', `${where} quiz[${i}].choices`, `選択肢が ${n} つ（2 つ以上書く）`);
    if (!isInt(qz?.answer) || qz.answer < 0 || qz.answer >= n) push(out, 'error', 'quiz', `${where} quiz[${i}].answer`, `答えの番号 ${String(qz?.answer)} が、選択肢の範囲（0〜${n - 1}）の外`);
  });
  checkDerived(lecture, course, where, out);
  return out;
};

/**
 * 講座の検証が読む、台本の外の一覧。core は中身（content/）を読まないので、呼ぶ側（scripts/validate.ts とテスト）が渡す。
 *   themes: テーマの id（content/themes.ts の THEMES のキー）。講座の theme は、この中のどれかを書く
 */
export type CourseContext = { themes: readonly string[] };

/** 講座 1 つ（講座の項目と、全部の動画） */
export const validateCourse = (course: Course, ctx: CourseContext): Issue[] => {
  const out: Issue[] = [];
  const where = courseWhere(course);
  for (const p of l10nProblems(course)) push(out, 'error', 'l10n', `${where} ${p.where}`, p.message);
  // 台本の形の版（書かなければ 1）。読めない版は、読み込み（engine/core/migrate.ts）が今の形に直せていない
  const version = schemaVersionOf(course);
  if (!isKnownSchemaVersion(version)) {
    push(out, 'error', 'schema', `${where} schemaVersion`, `台本の形の版 ${JSON.stringify(version)} を読めない（このエンジンが読めるのは 1〜${COURSE_SCHEMA_VERSION}。新しい形で書いた台本なら、main を取り込んでエンジンを新しくする）`);
  }
  if (course.theme !== undefined && !ctx.themes.includes(course.theme)) {
    push(out, 'error', 'theme', `${where} theme`, `テーマ「${course.theme}」が無い（content/themes.ts の THEMES にあるのは ${ctx.themes.join('・')}）`);
  }
  const dup = <T>(xs: T[], rule: Rule, what: string, w: string) => xs.forEach((x, i) => { xs.indexOf(x) !== i && push(out, 'error', rule, w, `${what} ${String(x)} が重なっている`); });
  dup(list(course.sections).map((s) => s.no), 'section', 'セクションの番号', `${where} sections`);
  dup(list(course.lectures).map((l) => l.id), 'lecture-no', '動画の ID', `${where} lectures`);
  dup(list(course.lectures).map((l) => l.no), 'lecture-no', '動画の番号', `${where} lectures`);
  // レクチャー ID は頭文字と 2 桁の番号（G01）。頭文字そのものの形と重なりは validateCourses が見る
  if (typeof course.prefix === 'string' && PREFIX.test(course.prefix)) {
    const idShape = new RegExp(`^${course.prefix}\\d{2}$`);
    list(course.lectures).forEach((l, i) => {
      if (!idShape.test(l.id)) push(out, 'error', 'prefix', `${where} lectures[${i}].id`, `レクチャー ID「${l.id}」が、頭文字 ${course.prefix} と 2 桁の番号（${course.prefix}01）の形でない`);
    });
  }
  for (const [voice, c] of Object.entries(course.cast ?? {})) {
    if (!has(VOICE_SET, voice)) push(out, 'error', 'voice', `${where} cast.${voice}`, `声「${voice}」が無い（あるのは ${names(VOICE_SET)}）`);
    if (!has(TONE_SET, c?.tone)) push(out, 'error', 'tone', `${where} cast.${voice}.tone`, `色の名前「${String(c?.tone)}」が無い（あるのは ${names(TONE_SET)}）`);
  }
  if (course.syllabus) {
    const chapters = list(course.syllabus.chapters);
    dup(chapters.map((c) => c.no), 'syllabus', 'syllabus の章の番号', `${where} syllabus.chapters`);
    dup(chapters.map((c) => c.lectureId), 'syllabus', 'syllabus の動画の ID', `${where} syllabus.chapters`);
    chapters.forEach((c, i) => {
      const w = `${where} syllabus.chapters[${i}]`;
      if (!list(course.sections).some((s) => s.no === c.section)) push(out, 'error', 'syllabus', `${w}.section`, `セクション ${c.section} が講座の sections に無い`);
      if (c.status === 'produced' && !list(course.lectures).some((l) => l.id === c.lectureId)) push(out, 'warning', 'syllabus', `${w}.status`, `status が produced なのに、動画（${c.lectureId}）が講座に無い`);
    });
  }
  for (const lec of list(course.lectures)) out.push(...validateLecture(lec, course));
  return out;
};

/** レクチャー ID の頭文字（英大文字 1 字） */
const PREFIX = /^[A-Z]$/;
/** 講座に使わない頭文字（X はテストの見本の講座が使う） */
const RESERVED_PREFIXES = ['X'];

/** まだどの講座も使っていない頭文字（エラーと docs/guide/new-course.md の表に出す） */
export const freePrefixes = (courses: readonly Course[]): string[] =>
  [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].filter((c) => !RESERVED_PREFIXES.includes(c) && !courses.some((x) => x.prefix === c));

/**
 * 講座をまたいだ確かめ（日本語の講座の一覧を渡す）。並行の PR が講座を足すと、マージするまでぶつかりに気づけないもの:
 * 頭文字（prefix）の形と重なり（エラーに空いている文字を出す）・並び（order）の重なり・講座 ID の重なりと、言語の名前（2 文字の英小文字）との重なり
 */
export const validateCourses = (courses: readonly Course[]): Issue[] => {
  const out: Issue[] = [];
  const free = () => `空いている文字: ${freePrefixes(courses).join(' ') || 'なし'}（X はテストの見本が使う）`;
  courses.forEach((c, i) => {
    const where = `${c.id} prefix`;
    if (typeof c.prefix !== 'string' || !PREFIX.test(c.prefix)) {
      push(out, 'error', 'prefix', where, `頭文字（prefix）は英大文字 1 字で書く（書いたのは ${JSON.stringify(c.prefix)}）。${free()}`);
    } else if (RESERVED_PREFIXES.includes(c.prefix)) {
      push(out, 'error', 'prefix', where, `頭文字 ${c.prefix} はテストの見本が使うので、講座には使わない。${free()}`);
    } else {
      const first = courses.findIndex((x) => x.prefix === c.prefix);
      if (first !== i) push(out, 'error', 'prefix', where, `頭文字 ${c.prefix} が ${courses[first].id} と重なっている（レクチャー ID がぶつかる）。${free()}`);
    }
    if (!isInt(c.order) || c.order < 1) {
      push(out, 'error', 'order', `${c.id} order`, `order（一覧の並び）は 1 以上の整数で書く（書いたのは ${JSON.stringify(c.order)}）`);
    } else {
      const first = courses.findIndex((x) => x.order === c.order);
      if (first !== i) {
        const used = [...new Set(courses.map((x) => x.order))].filter((n) => isInt(n)).sort((a, b) => a - b);
        push(out, 'error', 'order', `${c.id} order`, `order ${c.order} が ${courses[first].id} と重なっている（一覧の並びが決まらない）。使っている数: ${used.join(' ')}`);
      }
    }
    if (courses.findIndex((x) => x.id === c.id) !== i) push(out, 'error', 'course-id', `${c.id}`, `講座 ID ${c.id} が 2 つの講座で重なっている（content/courses.ts に同じ講座を 2 回並べていないか）`);
    // 訳の講座の URL と保存の ID は <言語>/<講座>（en/pstack-comedy）。Service Worker は頭の 2 文字の英小文字を言語のフォルダとして読む
    if (/^[a-z]{2}$/.test(c.id)) push(out, 'error', 'course-id', `${c.id}`, `講座 ID に 2 文字の英小文字（ja・en・zh などの言語の名前）は使えない（訳の講座の URL の頭と重なる）`);
  });
  return out;
};

/**
 * synth が書く timeline の形（engine/core/timeline.ts の TimelineFile。台本の形と合うかを見るのに要る所）。
 * fps と fingerprint はファイルには必ずある。テストの見本のように無いときは、その 2 つを見ない
 */
export type TimelineShape = {
  durationInFrames: number;
  fps?: number;
  fingerprint?: string;
  scenes: { start: number; duration: number; lines: { start: number; end: number }[] }[];
};

/**
 * timeline が台本と合うか。場面や台詞の数が違うと、描く途中で TypeError になるか、台詞と画面がずれる。
 * 指紋（時刻に効く入力のハッシュ）が今の台本と違えば「timeline が古い」（台本を直したのに合成し直していない）
 */
export const validateTimeline = (lecture: Lecture, course: Course, timeline: TimelineShape | undefined): Issue[] => {
  const out: Issue[] = [];
  const where = videoWhere(lecture, course);
  const lang = course.lang ?? 'ja';
  const key = videoKey(lecture.id, lang);
  const fix = `bun scripts/synth.ts ${key} で作り直す`;
  if (!timeline) {
    push(out, 'warning', 'timeline', `${where} timeline`, `timeline が無い（まだ合成していない。${fix}）`);
    return out;
  }
  const scenes = list(lecture.scenes);
  const ts = list(timeline.scenes);
  if (ts.length !== scenes.length) {
    push(out, 'error', 'timeline', `${where} timeline`, `timeline の場面の数（${ts.length}）が台本（${scenes.length}）と合わない。${fix}`);
    return out;
  }
  scenes.forEach((s, i) => {
    const a = list(ts[i]?.lines).length;
    const b = list(s?.lines).length;
    if (a !== b) push(out, 'error', 'timeline', `${where} 場面 ${i + 1} timeline`, `timeline の台詞の数（${a}）が台本（${b}）と合わない。${fix}`);
  });
  // 場面は頭から隙間なく続き、最後の場面の終わりが動画の長さになる（手で直した・マージで混ざった timeline を見つける）
  let at = 0;
  for (const [i, s] of ts.entries()) {
    if (s.start !== at) {
      push(out, 'error', 'timeline', `${where} 場面 ${i + 1} timeline`, `場面の始まり（${s.start}）が、前の場面の終わり（${at}）と続いていない。${fix}`);
      break;
    }
    at = s.start + s.duration;
  }
  if (at !== timeline.durationInFrames && !out.length) push(out, 'error', 'timeline', `${where} timeline`, `動画の長さ（${timeline.durationInFrames}）が、場面の終わり（${at}）と違う。${fix}`);
  if (timeline.fps !== undefined && timeline.fps !== VIDEO.fps) push(out, 'error', 'timeline', `${where} timeline`, `timeline の fps（${timeline.fps}）が動画の fps（${VIDEO.fps}。engine/core/video-config.ts）と違う。${fix}`);
  if (timeline.fingerprint !== undefined && !out.length) {
    let now: string;
    try {
      now = timelineFingerprint(lecture, lang);
    } catch (e) {
      // 読み上げる文を作れない台詞（辞書に無い英字が残った・空）。synth も同じ所で止まる
      push(out, 'error', 'timeline', `${where} timeline`, `timeline の指紋を計算できない: ${e instanceof Error ? e.message : String(e)}`);
      return out;
    }
    if (timeline.fingerprint !== now) {
      push(out, 'error', 'timeline', `${where} timeline`, `timeline が古い（台詞の読み・声・間・効果音・場面の種類か hold が、合成したときと違う。指紋 ${timeline.fingerprint} → ${now}）。${fix}（台詞の声を変えていなければ --cached-only でよい）`);
    }
  }
  return out;
};

/**
 * 置いてある timeline のファイル（その動画の名前のもの全部）が、動画と合うか。無ければ注意（まだ合成していない）。
 * 2 つ以上ある・講座のフォルダが違う・読めないときは誤り。1 つあれば validateTimeline で台本と照らし合わせる
 */
export const validateTimelineFiles = (lecture: Lecture, course: Course, entries: readonly TimelineEntry[]): Issue[] => {
  const where = `${videoWhere(lecture, course)} timeline`;
  const key = videoKey(lecture.id, course.lang ?? 'ja');
  const out: Issue[] = [];
  if (entries.length > 1) {
    push(out, 'error', 'timeline', where, `timeline が 2 つ以上の講座のフォルダにある: ${entries.map((e) => e.file).join('・')}（${timelineFile(course.id, key)} だけを残す）`);
    return out;
  }
  const [entry] = entries;
  if (!entry) return validateTimeline(lecture, course, undefined);
  if (entry.course !== course.id) {
    push(out, 'error', 'timeline', where, `timeline の置き場所が違う: ${entry.file}（${timelineFile(course.id, key)} に置く。bun scripts/synth.ts ${key} --prune）`);
    return out;
  }
  if (!entry.timeline) {
    push(out, 'error', 'timeline', where, `${entry.error ?? '読めない'}（bun scripts/synth.ts ${key} で作り直す）`);
    return out;
  }
  return validateTimeline(lecture, course, entry.timeline);
};

/* ───────────── テーマ ───────────── */

/** テーマの項目（engine/core/schema.ts の Theme）。項目を型に足したのに、ここに書き忘れると型で止まる */
const COLOR_KEYS: Record<keyof Theme['color'], true> = { bg: true, bg2: true, surface: true, surface2: true, ink: true, sub: true, muted: true, line: true, line2: true, accent: true, onAccent: true, code: true };
const SYNTAX_KEYS: Record<keyof Theme['syntax'], true> = { plain: true, comment: true, string: true, keyword: true, deco: true, number: true, fn: true };
const DARK_KEYS: Record<keyof DarkSurfaces, true> = { glass: true, glass2: true, overlay: true, edge: true, lane: true, track: true, sheen: true, faint: true, onTone: true };
const FONT_SET: Record<FontKey, true> = { 'zen-maru': true, noto: true, inter: true, 'noto-sc': true };

/** 暗い地の面と線に書ける rgba()（0〜255 の 3 つと、0〜1 の透明度） */
const RGBA = /^rgba\((\d{1,3}),(\d{1,3}),(\d{1,3}),(0|1|0?\.\d+)\)$/;
const isRgba = (v: unknown): boolean => {
  const m = typeof v === 'string' ? RGBA.exec(v.replace(/\s+/g, '')) : null;
  return !!m && [m[1], m[2], m[3]].every((x) => Number(x) <= 255);
};

/**
 * テーマの形。色は #RRGGBB（透明度を付ける所・混ぜる所で壊れないように）、要る項目がそろっているか。
 * 暗い地のテーマは、面と線の色（dark）も要る。dark の色は #RRGGBB か rgba()（図の色の上の文字 onTone は、コントラスト比を数えるので #RRGGBB）
 */
export const validateTheme = (theme: Theme, where = `テーマ ${theme?.id}`): Issue[] => {
  const out: Issue[] = [];
  const error = (path: string, message: string) => push(out, 'error', 'theme', `${where} ${path}`, message);
  const color = (v: unknown, path: string) => {
    if (!isHex(v)) error(path, v === undefined ? '色が無い（#RRGGBB で書く）' : `色が #RRGGBB でない: ${String(v)}`);
  };
  for (const key of ['id', 'label', 'summary'] as const) {
    if (typeof theme[key] !== 'string' || !theme[key].trim()) error(key, `${key} が無い`);
  }
  for (const k of Object.keys(COLOR_KEYS) as (keyof Theme['color'])[]) color(theme.color?.[k], `color.${k}`);
  for (const t of Object.keys(TONE_SET) as Tone[]) color(theme.tones?.[t], `tones.${t}`);
  for (const k of Object.keys(SYNTAX_KEYS) as (keyof Theme['syntax'])[]) color(theme.syntax?.[k], `syntax.${k}`);
  for (const key of ['gradient', 'display', 'mesh'] as const) list(theme[key]).forEach((v, i) => { color(v, `${key}[${i}]`); });
  if (list(theme.gradient).length < 2) error('gradient', 'gradient は 2 色以上');
  if (list(theme.display).length < 2) error('display', 'display は 2 色以上');
  // 背景の飾り（src/components/chrome.tsx）: chalk と stars は mesh の 4 色目まで使う
  const meshMin = theme.decor === 'band' ? 2 : 4;
  if (list(theme.mesh).length < meshMin) error('mesh', `decor が ${theme.decor} のときの mesh は ${meshMin} 色以上`);
  if (!['chalk', 'band', 'stars'].includes(theme.decor)) error('decor', `decor は chalk・band・stars のどれか（書いたのは ${String(theme.decor)}）`);
  if (theme.scheme !== 'light' && theme.scheme !== 'dark') error('scheme', 'scheme は light か dark');
  if (!list(theme.fonts).length) error('fonts', '書体（fonts）が無い');
  list(theme.fonts).forEach((f, i) => {
    if (!has(FONT_SET, f)) error(`fonts[${i}]`, `書体「${String(f)}」が無い（あるのは ${names(FONT_SET)}）`);
  });
  if (typeof theme.shadow !== 'string' || !theme.shadow.trim()) error('shadow', 'カードの影（shadow）が無い（CSS の box-shadow で書く）');
  if (!(typeof theme.radius === 'number' && theme.radius >= 0)) error('radius', `角の丸み（radius）は 0 以上の数（書いたのは ${String(theme.radius)}）`);
  if (theme.scheme === 'dark') {
    if (!theme.dark) error('dark', '暗い地のテーマは、面と線の色（dark）を書く（content/themes.ts の NIGHT を見本にする）');
    else {
      for (const k of Object.keys(DARK_KEYS) as (keyof DarkSurfaces)[]) {
        const v: unknown = theme.dark[k];
        if (k === 'onTone') color(v, 'dark.onTone');
        else if (!isHex(v) && !isRgba(v)) error(`dark.${k}`, v === undefined ? '色が無い（#RRGGBB か rgba() で書く）' : `色が #RRGGBB か rgba() でない: ${String(v)}`);
      }
    }
  } else if (theme.dark !== undefined) {
    push(out, 'warning', 'theme', `${where} dark`, '明るい地のテーマは dark を使わない（明るい地の面と線は color から作る）');
  }
  return out;
};

/* ───────────── 表示 ───────────── */

const LABEL: Record<Level, string> = { error: '止める', warning: '注意  ' };
export const formatIssue = (x: Issue) => `${LABEL[x.level]}  ${x.where}  ${x.message}`;
export const formatIssues = (xs: Issue[]) => xs.map(formatIssue).join('\n');
