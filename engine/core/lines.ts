// 台詞の id と、画面の要素の at（台詞を指す番号）の読み込み。台本の at は、台詞の番号のほかに、同じ場面の台詞の id でも書ける
// （engine/core/schema.ts の At）。読み込むとき（content/index.ts と、訳の重ね方 engine/core/i18n.ts）に id を番号に直してから、
// 台本の検証（engine/core/validate.ts）にかける。描く側（src/）と声を作る側（scripts/）が受け取るのは、at が番号の台本だけ。
//   resolveLecture(lecture)  動画 1 本の at の id と、画面の図の注の blockId（部品の id）を番号に直す
//   resolveCourse(course)    講座の全部の動画
// 直すところが無い動画・場面は、同じオブジェクトをそのまま返す（今までの数で書いた台本は、読み込みの前と後で同じもの）。
// 直せない id（場面に無い台詞・画面に無い部品・重なった id）は書いたまま残し、台本の検証がその動画の誤りにする（ほかの動画は描ける）。
// engine/core の外を import しない（Biome の noRestrictedImports が止める。scripts/materials.ts の gc と scripts/reading-diff.ts は、content/ と engine/core/ だけを取り出して読む）
import { AT_KEYS } from './fields';
import type { At, AuthoredCourse, AuthoredLecture, AuthoredScene, Course, Lecture, MockScreen, Scene } from './schema';

export { AT_KEYS };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** 名前 → 番号（同じ名前が 2 つあれば、最初のもの。重なりは台本の検証が誤りにする） */
const indexById = (items: readonly unknown[]): Map<string, number> => {
  const out = new Map<string, number>();
  items.forEach((x, i) => {
    const id = isObj(x) ? x.id : undefined;
    if (typeof id === 'string' && id && !out.has(id)) out.set(id, i);
  });
  return out;
};

/** 値の中の at の id を番号に直す（変わらなければ同じ値を返す）。skip は見ない項目（場面の台詞そのもの） */
const resolveAt = (v: unknown, lines: Map<string, number>, skip?: string): unknown => {
  if (Array.isArray(v)) {
    const out = v.map((x) => resolveAt(x, lines));
    return out.some((x, i) => x !== v[i]) ? out : v;
  }
  if (!isObj(v)) return v;
  let out: Record<string, unknown> | undefined;
  for (const [k, x] of Object.entries(v)) {
    if (k === skip) continue;
    const next = AT_KEYS.includes(k) && typeof x === 'string' ? (lines.get(x) ?? x) : resolveAt(x, lines);
    if (next === x) continue;
    out ??= { ...v };
    out[k] = next;
  }
  return out ?? v;
};

/** 画面の図 1 枚の注の blockId を、部品の番号（block）に直す。block を書いた注は、そのまま（食い違いは台本の検証が見る） */
const resolveNotes = (screen: MockScreen<At> | undefined) => {
  if (!screen?.notes?.some((n) => n.blockId !== undefined && n.block === undefined)) return screen;
  const blocks = indexById(screen.blocks ?? []);
  return {
    ...screen,
    notes: screen.notes.map((n) => {
      const block = n.blockId !== undefined && n.block === undefined ? blocks.get(n.blockId) : undefined;
      return block === undefined ? n : { ...n, block };
    }),
  };
};

/** 場面 1 つの at の id と、注の blockId を番号に直す */
export const resolveScene = (scene: AuthoredScene): Scene => {
  let s: AuthoredScene = scene;
  if (s.kind === 'screens') {
    const left = resolveNotes(s.left);
    const right = resolveNotes(s.right);
    if (left !== s.left || right !== s.right) s = { ...s, left: left ?? s.left, right };
  }
  const lines = indexById(Array.isArray(s.lines) ? s.lines : []);
  // 台詞の id が無い場面は、at に文字を書いていても直せない（書いたまま残し、台本の検証が誤りにする）
  const out = lines.size ? (resolveAt(s, lines, 'lines') as AuthoredScene) : s;
  // 直せなかった id は文字のまま残る。描く前に台本の検証が止める（src/Root.tsx・scripts/synth.ts）
  return out as Scene;
};

/** 動画 1 本の at の id と、注の blockId を番号に直す（直すところが無ければ、同じ動画をそのまま返す） */
export const resolveLecture = (lecture: AuthoredLecture): Lecture => {
  const scenes = lecture.scenes.map(resolveScene);
  return scenes.every((s, i) => s === lecture.scenes[i]) ? (lecture as Lecture) : { ...lecture, scenes };
};

/** 講座の全部の動画の at を番号に直す（直すところが無ければ、同じ講座をそのまま返す） */
export const resolveCourse = (course: AuthoredCourse): Course => {
  const lectures = course.lectures.map(resolveLecture);
  return lectures.every((l, i) => l === course.lectures[i]) ? (course as Course) : { ...course, lectures };
};
