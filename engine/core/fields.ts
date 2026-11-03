// 項目の役目（場面の種類ごと・動画・講座）。訳の重ね方と訳し残しの点検（engine/core/i18n.ts）・訳の指紋とひな形（scripts/i18n.ts）・
// at の読み込み（engine/core/lines.ts）と検証（engine/core/validate.ts）が、この 1 か所を読む。
//   text   訳す文字（画面・字幕・サイトに出る）。訳し残しの点検と、訳の指紋に入る
//   at     台詞を指す番号か、同じ場面の台詞の id（engine/core/schema.ts の At）
//   key    項目の名前（cards・nodes・actors・timeline の items の key、画面の図の部品の id、台詞の id、出典の id）。
//          訳の項目に key を書くと、日本語の台本の項目と key で重ねる（書かなければ位置で重ねる）
//   value  訳さない値（色・アイコン・座標・URL・コード・端末の出力・効果音・声・番号・読み上げる文 s など）
// 配列は { $list: 項目の形 }。訳で丸ごと置き換える配列（台詞・要点）には $replace を付ける。文字の配列は 'text' と書く。
// 種類で形が変わる項目（画面の図の部品）は { $union: 種類の項目, of: 種類ごとの形 }、名前で引く表（配役）は { $record: 形 }。
// 場面の型（engine/core/schema.ts）に項目を足すと、ここに書くまで型で止まる（FieldsOf）。
// engine/core の外を import しない（Biome の noRestrictedImports が止める。scripts/materials.ts の gc と scripts/reading-diff.ts は、content/ と engine/core/ だけを取り出して読む）
import type { Course, Lecture, Line, MockBlock, Scene, SceneBase } from './schema';

export type Role = 'text' | 'at' | 'key' | 'value';
/** 配列。$replace: 訳で丸ごと置き換える（数が変わってよい） */
export type ListShape = { readonly $list: Shape; readonly $replace?: true };
/** 種類で形が変わる項目（$union の項目の値で、of の形を選ぶ） */
export type UnionShape = { readonly $union: string; readonly of: Readonly<Record<string, ObjectShape>> };
/** 名前で引く表（中の値は、どれも同じ形） */
export type RecordShape = { readonly $record: Shape };
export type ObjectShape = { readonly [field: string]: Shape };
export type Shape = Role | ListShape | UnionShape | RecordShape | ObjectShape;

type Prim = string | number | boolean | null;
/**
 * 値の型に合う形（文字・数・真偽は役目、文字の配列は役目、オブジェクトの配列は $list、オブジェクトは中の項目の形）。
 * 文字とオブジェクトのどちらでもよい値（端末の出力の行）は、訳さない値（value）としてだけ書ける
 */
type ShapeOf<V> = [V] extends [Prim]
  ? Role
  : [Extract<V, Prim>] extends [never]
    ? [V] extends [readonly (infer U)[]]
      ? [U] extends [Prim]
        ? Role | { readonly $list: Role; readonly $replace?: true }
        : { readonly $list: ShapeOf<U>; readonly $replace?: true } | 'value'
      : FieldsOf<V> | UnionShape | RecordShape | 'value'
    : 'value';
/** 型の全部の項目の形（書き忘れた項目があると型で止まる） */
export type FieldsOf<T> = { readonly [K in keyof T]-?: ShapeOf<Exclude<T[K], undefined>> };

/* ───────────── 台詞と、どの場面にもある項目 ───────────── */

/** 台詞。s（読み上げる文）は訳の点検と指紋に入れない（読みの直しで、訳を見直さなくてよい） */
export const LINE_FIELDS: FieldsOf<Line> = { id: 'key', t: 'text', s: 'value', v: 'value', pause: 'value', sfx: 'value', sfxAfter: 'value', bgm: 'value' };

/** どの場面にもある項目。台詞は訳で丸ごと置き換える */
export const BASE_FIELDS: FieldsOf<SceneBase> = {
  heading: 'text',
  lines: { $list: LINE_FIELDS, $replace: true },
  hold: 'value',
  evidence: 'value',
  cite: 'text',
};

/* ───────────── 場面の種類ごとの項目 ───────────── */

type BlockOf<T extends MockBlock['type']> = Extract<MockBlock, { type: T }>;
/** 画面の図の部品（種類 type ごと） */
const BLOCK_FIELDS: { readonly [T in MockBlock['type']]: FieldsOf<BlockOf<T>> } = {
  title: { id: 'key', type: 'value', text: 'text', weak: 'value' },
  text: { id: 'key', type: 'value', text: 'text', weak: 'value', small: 'value' },
  field: { id: 'key', type: 'value', label: 'text', placeholder: 'text', value: 'text', error: 'text', hint: 'text', required: 'value', weak: 'value' },
  button: { id: 'key', type: 'value', text: 'text', variant: 'value', weak: 'value' },
  buttons: { id: 'key', type: 'value', items: { $list: { text: 'text', variant: 'value', weak: 'value' } } },
  alert: { id: 'key', type: 'value', text: 'text', tone: 'value' },
  toggle: { id: 'key', type: 'value', label: 'text', on: 'value', sub: 'text' },
  check: { id: 'key', type: 'value', label: 'text', checked: 'value', weak: 'value' },
  steps: { id: 'key', type: 'value', items: 'text', current: 'value' },
  list: { id: 'key', type: 'value', items: 'text', weak: 'value' },
  badge: { id: 'key', type: 'value', text: 'text' },
  divider: { id: 'key', type: 'value' },
  spacer: { id: 'key', type: 'value', h: 'value' },
};

const MOCK_SCREEN = {
  label: 'text',
  tone: 'value',
  title: 'text',
  blocks: { $list: { $union: 'type', of: BLOCK_FIELDS } },
  notes: { $list: { n: 'value', text: 'text', block: 'value', blockId: 'value', at: 'at', tone: 'value' } },
  at: 'at',
} as const;

const COMPARE_SIDE = { title: 'text', sub: 'text', tone: 'value', icon: 'value', at: 'at', items: { $list: { text: 'text', at: 'at' } } } as const;

/** 矢印（flow・states）の訳さない値 */
const EDGE_VALUES = { from: 'value', to: 'value', bend: 'value', fromSide: 'value', toSide: 'value', labelDx: 'value', labelDy: 'value' } as const;

type Own<K extends Scene['kind']> = Omit<Extract<Scene, { kind: K }>, keyof SceneBase | 'kind'>;

/** 場面の種類ごとの項目（どの場面にもある項目 BASE_FIELDS と kind は除く） */
export const SCENE_FIELDS: { readonly [K in Scene['kind']]: FieldsOf<Own<K>> } = {
  opening: { section: 'text', title: 'text', titleLines: 'text', subtitle: 'text' },
  goals: { items: { $list: { text: 'text', at: 'at' } } },
  points: { items: { $list: { title: 'text', body: 'text', at: 'at', tone: 'value', icon: 'value' } }, columns: 'value', numbered: 'value' },
  concepts: {
    cards: { $list: { key: 'key', en: 'text', ja: 'text', desc: 'text', idPrefix: 'value', tone: 'value', icon: 'value', at: 'at' } },
    columns: 'value',
  },
  sequence: {
    actors: { $list: { key: 'key', label: 'text', sub: 'text', subMono: 'value', tone: 'value', icon: 'value' } },
    steps: { $list: { from: 'value', to: 'value', label: 'text', at: 'at', dashed: 'value', tone: 'value' } },
  },
  flow: {
    nodes: { $list: { key: 'key', label: 'text', sub: 'text', x: 'value', y: 'value', w: 'value', h: 'value', tone: 'value', icon: 'value', at: 'at', mono: 'value' } },
    groups: { $list: { label: 'text', x: 'value', y: 'value', w: 'value', h: 'value', tone: 'value', at: 'at' } },
    edges: { $list: { ...EDGE_VALUES, label: 'text', at: 'at', tone: 'value', dashed: 'value' } },
    focus: { $list: { keys: 'value', at: 'at' } },
  },
  states: {
    nodes: { $list: { key: 'key', code: 'value', ja: 'text', x: 'value', y: 'value', tone: 'value', at: 'at', badge: 'text', variant: 'value' } },
    edges: { $list: { ...EDGE_VALUES, label: 'text', at: 'at' } },
    focus: { $list: { keys: 'value', at: 'at' } },
  },
  code: {
    lang: 'value',
    file: 'value',
    code: 'value',
    marks: { $list: { from: 'value', to: 'value', at: 'at', note: 'text', tone: 'value' } },
    showAt: 'at',
    fontSize: 'value',
  },
  table: { columns: 'text', rows: { $list: { cells: 'text', at: 'at', tone: 'value' } }, widths: 'value', mono: 'value', fontSize: 'value' },
  compare: { left: COMPARE_SIDE, right: COMPARE_SIDE, verdict: { text: 'text', at: 'at', tone: 'value' } },
  big: { kicker: 'text', text: 'text', textAt: 'at', sub: 'text', subAt: 'at', tone: 'value', icon: 'value' },
  numbers: {
    items: { $list: { label: 'text', value: 'value', prefix: 'text', suffix: 'text', decimals: 'value', at: 'at', tone: 'value', note: 'text', op: 'value' } },
    footnote: { text: 'text', at: 'at' },
  },
  timeline: {
    items: { $list: { key: 'key', kicker: 'text', title: 'text', sub: 'text', detail: 'text', at: 'at', tone: 'value' } },
    focus: { $list: { key: 'value', at: 'at' } },
  },
  quiz: { no: 'value', question: 'text', answer: 'value', explain: 'text', revealAt: 'at' },
  recap: { items: { $list: { text: 'text', at: 'at' } } },
  refs: { refs: { $list: { title: 'text', url: 'value', note: 'text', at: 'at' } } },
  phone: {
    screens: {
      $list: {
        at: 'at',
        title: 'text',
        kind: 'value',
        brand: 'text',
        brandSub: 'text',
        lead: 'text',
        leadMono: 'value',
        body: 'text',
        primary: 'text',
        secondary: 'text',
        caption: 'text',
      },
    },
  },
  screens: { device: 'value', zoom: 'value', left: MOCK_SCREEN, right: MOCK_SCREEN },
  terminal: { title: 'text', entries: { $list: { cmd: 'value', out: 'value', at: 'at', note: 'text' } } },
  ending: { next: { no: 'value', title: 'text' }, closing: 'text' },
};

/** 場面 1 つの形（種類の分からない場面は、どの場面にもある項目だけ） */
export const sceneShape = (kind: unknown): ObjectShape => ({
  ...BASE_FIELDS,
  kind: 'value',
  ...(typeof kind === 'string' && Object.hasOwn(SCENE_FIELDS, kind) ? SCENE_FIELDS[kind as Scene['kind']] : {}),
});

/* ───────────── 動画と講座 ───────────── */

/** 動画の項目。場面（scenes）は種類ごとの形でたどる（walkLecture）。読む教材（material）は、まだ訳さない */
export const LECTURE_FIELDS: FieldsOf<Lecture> = {
  id: 'value',
  no: 'value',
  section: { no: 'value', title: 'text' },
  title: 'text',
  summary: 'text',
  docs: { $list: { title: 'text', url: 'value' } },
  quiz: { $list: { q: 'text', choices: 'text', answer: 'value', explain: 'text' } },
  takeaways: { $list: 'text', $replace: true },
  caution: 'text',
  scenes: 'value',
  material: 'value',
};

/** 講座の項目。動画（lectures）は walkLecture でたどる。章の計画（syllabus）は、まだ訳さない */
export const COURSE_FIELDS: FieldsOf<Course> = {
  id: 'value',
  schemaVersion: 'value',
  prefix: 'value',
  order: 'value',
  lang: 'value',
  title: 'text',
  subtitle: 'text',
  headline: 'text',
  sections: { $list: { no: 'value', title: 'text' } },
  lectures: 'value',
  docsNote: 'text',
  sourceNote: 'text',
  links: { $list: { label: 'text', url: 'value' } },
  theme: 'value',
  disclaimer: 'text',
  cast: { $record: { name: 'text', tone: 'value' } },
  unitLabel: 'value',
  standalone: 'value',
  syllabus: 'value',
  sources: { $list: { id: 'key', title: 'text', url: 'value', publisher: 'text', year: 'text', kind: 'value', checked: 'value', note: 'text' } },
  ui: { takeaways: 'text', docs: 'text', searchHint: 'text' },
};

/* ───────────── 形をたどる ───────────── */

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export const isListShape = (s: Shape | undefined): s is ListShape => isObj(s) && '$list' in s;
const isUnion = (s: Shape | undefined): s is UnionShape => isObj(s) && '$union' in s;
const isRecord = (s: Shape | undefined): s is RecordShape => isObj(s) && '$record' in s;

/** オブジェクトの項目 k の形（種類で形が変わる項目は、base の種類で選ぶ。形に無い項目は undefined） */
export const fieldShape = (shape: Shape | undefined, base: unknown, k: string): Shape | undefined => {
  if (isUnion(shape)) {
    const variant = isObj(base) ? shape.of[String(base[shape.$union])] : undefined;
    return variant?.[k];
  }
  if (isRecord(shape)) return shape.$record;
  if (isObj(shape) && !isListShape(shape)) return (shape as ObjectShape)[k];
  return undefined;
};

/** 配列の項目の名前の項目（key・id）。種類で形が変わる項目は、どの種類にもある名前の項目 */
export const keyFieldOf = (item: Shape | undefined): string | undefined => {
  if (isUnion(item)) {
    const variants = Object.values(item.of);
    const [first] = variants;
    return first ? Object.keys(first).find((k) => variants.every((v) => v[k] === 'key')) : undefined;
  }
  if (!isObj(item) || isListShape(item) || isRecord(item)) return undefined;
  return Object.keys(item).find((k) => (item as ObjectShape)[k] === 'key');
};

/** たどった値 1 つ。role が undefined なら、形に書いていない項目（engine/core/schema.ts に無い項目） */
export type Visit = (role: Role | undefined, value: unknown, ja: unknown, path: string) => void;

/**
 * 値を形にそってたどる。ja は日本語の講座の同じ場所の値（訳の講座を、日本語の講座と比べるとき。配列は位置で引く）。
 * 文字の配列（text）は 1 つずつ、訳さない値（value）のオブジェクトと配列は丸ごと 1 回で呼ぶ
 */
export const walkShape = (v: unknown, ja: unknown, shape: Shape | undefined, path: string, visit: Visit): void => {
  if (v === undefined) return;
  const at = (x: unknown, i: number | string) => (Array.isArray(x) || isObj(x) ? (x as Record<string, unknown>)[i] : undefined);
  if (typeof shape === 'string') {
    if (shape === 'text' && Array.isArray(v)) v.forEach((x, i) => { visit(shape, x, at(ja, i), `${path}[${i}]`); });
    else visit(shape, v, ja, path);
    return;
  }
  if (Array.isArray(v)) {
    const item = isListShape(shape) ? shape.$list : undefined;
    v.forEach((x, i) => { walkShape(x, at(ja, i), item, `${path}[${i}]`, visit); });
    return;
  }
  if (!isObj(v)) {
    visit(undefined, v, ja, path);
    return;
  }
  for (const [k, x] of Object.entries(v)) walkShape(x, at(ja, k), fieldShape(shape, v, k), `${path}.${k}`, visit);
};

/** 場面 1 つをたどる */
export const walkScene = (scene: unknown, ja: unknown, path: string, visit: Visit): void =>
  walkShape(scene, ja, sceneShape(isObj(scene) ? scene.kind : undefined), path, visit);

/** 動画 1 本をたどる（場面は種類ごとの形で。項目の並びは動画のオブジェクトの順） */
export const walkLecture = (lecture: unknown, ja: unknown, path: string, visit: Visit): void => {
  if (!isObj(lecture)) return;
  const jaObj = isObj(ja) ? ja : undefined;
  for (const [k, x] of Object.entries(lecture)) {
    if (k === 'scenes' && Array.isArray(x)) {
      const jaScenes = Array.isArray(jaObj?.scenes) ? jaObj.scenes : [];
      x.forEach((s, i) => { walkScene(s, jaScenes[i], `${path}.scenes[${i}]`, visit); });
    } else walkShape(x, jaObj?.[k], fieldShape(LECTURE_FIELDS, lecture, k), `${path}.${k}`, visit);
  }
};

/** 講座の項目をたどる（動画 lectures は除く。動画は walkLecture で 1 本ずつ） */
export const walkCourse = (course: unknown, ja: unknown, path: string, visit: Visit): void => {
  if (!isObj(course)) return;
  const jaObj = isObj(ja) ? ja : undefined;
  for (const [k, x] of Object.entries(course)) if (k !== 'lectures') walkShape(x, jaObj?.[k], fieldShape(COURSE_FIELDS, course, k), `${path}.${k}`, visit);
};

/* ───────────── 形から作る一覧 ───────────── */

/** 形の中の、役目が role の項目の名前（重なりなし。見つけた順） */
const namesOf = (want: (role: Shape, name: string) => boolean): string[] => {
  const out = new Set<string>();
  const walk = (shape: Shape, name: string) => {
    if (want(shape, name)) out.add(name);
    if (typeof shape === 'string') return;
    if (isListShape(shape)) return walk(shape.$list, name);
    if (isUnion(shape)) { for (const v of Object.values(shape.of)) walk(v, name); return; }
    if (isRecord(shape)) return walk(shape.$record, name);
    for (const [k, s] of Object.entries(shape)) walk(s, k);
  };
  for (const s of [BASE_FIELDS, ...Object.values(SCENE_FIELDS), LECTURE_FIELDS, COURSE_FIELDS] as Shape[]) walk(s, '');
  return [...out];
};

/** 台詞の番号（at）を書く項目の名前。台本の検証と at の読み込みは、この名前の項目を見る */
export const AT_KEYS: readonly string[] = namesOf((s) => s === 'at');

/** 訳で丸ごと置き換える配列の名前（台詞・要点。数が変わってよい） */
export const REPLACE: readonly string[] = namesOf((s) => isListShape(s) && !!s.$replace);

/** 訳す文字を、場所（動画の中の場所）と文字の組で、動画の項目の順に並べる。訳の指紋は、これから作る（scripts/i18n.ts） */
export const lectureTexts = (lecture: unknown): [path: string, text: string][] => {
  const out: [string, string][] = [];
  // 形に書いていない項目（型に無い項目）の文字も、念のため入れる（変わったら訳を見直す）
  walkLecture(lecture, undefined, '', (role, v, _ja, path) => {
    if ((role === 'text' || role === undefined) && typeof v === 'string') out.push([path, v]);
  });
  return out;
};
