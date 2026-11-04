// 講座の多言語。日本語の台本（content/<講座>/<ID>.ts）が正本で、ほかの言語は「上書きのファイル」を重ねて作る。
//   content/<講座>/<言語>/<ID>.ts      レクチャーの訳（LectureL10n）。台詞は言語ごとに書き直し、画面の文字は場面の順に上書きする
//   content/<講座>/<言語>/course.ts    講座の訳（CourseL10n）。講座名・セクション・配役の名前・出典の説明と、レクチャーの訳を並べる
// 場面・カード・表の行などは、日本語の台本と同じ順番・同じ数で上書きする（色・アイコン・座標・URL は日本語の台本のものを使う）。
// 台詞（lines）だけは丸ごと置き換える（お笑いは直訳せず、言語ごとに作り直すので、数も変わってよい）。
// 日本語の台本の at が台詞の id なら、訳の台詞に同じ id を付ければ、台詞の数が違っても at を書き直さなくてよい（重ねたあとで番号に直す。engine/core/lines.ts）
import { AT_KEYS, COURSE_FIELDS, fieldShape, isListShape, keyFieldOf, LECTURE_FIELDS, type Shape, sceneShape, type Visit, walkCourse, walkLecture } from './fields';
import { isLang, type Lang, type TranslatedLang } from './langs';
import { resolveLecture } from './lines';
import type { At, AuthoredCourse, AuthoredLecture, Course, Lecture, Line, Scene, Source, VoiceId } from './schema';

export { AT_KEYS };

// 言語の一覧と名前の正本は ./langs（Service Worker と Worker にも入るので、ほかのファイルを読まないファイルにする）。台本と道具は、今までどおりここから読む
export { isLang, LANG_INFO, LANGS, type Lang, TRANSLATED_LANGS, type TranslatedLang } from './langs';

/** 動画 1 本の名前。日本語はレクチャー ID のまま（S01）、ほかは言語を付ける（S01.en）。timeline・音・字幕・動画のファイル名に使う */
export const videoKey = (lectureId: string, lang: Lang) => (lang === 'ja' ? lectureId : `${lectureId}.${lang}`);
/** 動画の名前を、レクチャー ID と言語に分ける */
export const parseVideoKey = (key: string): { id: string; lang: Lang } => {
  const [id, lang = 'ja'] = key.split('.');
  if (!isLang(lang) || key.split('.').length > 2) throw new Error(`動画の名前が読めない: ${key}（例: S01、S01.en）`);
  return { id, lang };
};
/** Remotion のコンポジションの ID（ドットが使えないのでハイフンにする。S01.en → S01-en） */
export const compositionId = (key: string) => key.replace(/\./g, '-');

/* ───────────── 訳の型 ───────────── */

type Primitive = string | number | boolean | null | undefined;
/** 上書き。オブジェクトは一部だけ書けばよく、配列は日本語の台本と同じ数で、順に重ねる */
export type Override<T> = T extends Primitive ? T : T extends (infer U)[] ? Override<U>[] : { [K in keyof T]?: Override<T[K]> };

/**
 * 場面の上書き。kind は日本語の台本の場面と同じものを書く（取り違えを止める）。台詞は丸ごと書く。
 * at は台詞の番号か、訳の台詞の id（台本と同じく At）
 */
export type SceneL10n = { [K in Scene['kind']]: Omit<Override<Extract<Scene<At>, { kind: K }>>, 'kind' | 'lines'> & { kind: K; lines: Line[] } }[Scene['kind']];

export type LectureL10n = {
  /** 訳したときの、日本語の台本の指紋（bun scripts/i18n.ts stamp が書く）。台本が変わると bun scripts/i18n.ts status が知らせる */
  source: string;
  title: string;
  summary: string;
  section?: { title: string };
  /** 出典のリンクの題（日本語の台本と同じ順・同じ数） */
  docs?: { title: string }[];
  /** 確認クイズ（日本語の台本と同じ順・同じ数。答えの番号は日本語の台本のもの） */
  quiz: { q: string; choices: string[]; explain: string }[];
  takeaways: string[];
  caution?: string;
  scenes: SceneL10n[];
};

export type CourseL10n = {
  title: string;
  subtitle: string;
  headline: string;
  /** セクションの名前（日本語の講座と同じ順・同じ数） */
  sections: { title: string }[];
  docsNote: string;
  sourceNote: string;
  disclaimer?: string;
  /** 掛け合いの配役の名前（色は日本語の講座のもの） */
  cast?: Partial<Record<VoiceId, { name: string }>>;
  ui?: Course['ui'];
  /** 見出しの横のリンクの名前（日本語の講座と同じ順・同じ数） */
  links?: { label: string }[];
  /** 出典の説明（id ごと。題名は原題のままでよい） */
  sources?: Record<string, Partial<Pick<Source, 'title' | 'publisher' | 'year' | 'note'>>>;
  /**
   * 1 本だけの動画（番号と根拠の札を出さない）。日本語の講座が「表示は少なく」の決まりの前に作ったままでも、
   * 訳の動画は決まりに合わせる（comedy.md）。書かなければ日本語の講座と同じ
   */
  standalone?: boolean;
  /** レクチャーの訳（レクチャー ID ごと）。まだ訳していないレクチャーは、その言語の講座に出さない */
  lectures: Record<string, LectureL10n>;
};

/* ───────────── 重ね方 ───────────── */
// 重ね方は、項目の役目（engine/core/fields.ts）にそって決める。
//   台詞（lines）・要点（takeaways）は丸ごと置き換える
//   key を持つ配列（cards・nodes・actors・timeline の items・画面の図の部品の id）は、訳の項目に key を書けば key で重ね、書かなければ位置で重ねる
//   ほかの配列は位置で重ね、数が日本語と違えば誤りにする
// 誤りは投げずに、動画（講座）ごとに集める（l10nProblems）。台本の検証がその動画の誤りとして出し、Studio はその動画だけを止める

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** 訳を重ねたときの誤り 1 つ。where は動画（講座）の中の場所（場面 2 concepts.cards[0].at など）、message は直し方 */
export type L10nProblem = { where: string; message: string };
const PROBLEMS = new WeakMap<object, L10nProblem[]>();

/**
 * 訳の動画（訳の講座）を作ったときの誤り。台本の検証（engine/core/validate.ts）が、その動画（講座）の誤りとして出す。
 * 誤りがあっても、訳の動画は作る（直せる所まで重ね、重ねられない所は日本語の台本のまま）。動画の一覧から消さないので、Studio はその動画の場所に誤りを出せる
 */
export const l10nProblems = (x: Lecture | Course): readonly L10nProblem[] => PROBLEMS.get(x) ?? [];

/** 重ねるときの文脈。linesDiffer: 台詞の数が日本語と違う場面（数の at を訳で書き直さないと、違う台詞で出る） */
type Ctx = { problems: L10nProblem[]; linesDiffer: boolean };

/** 訳で書き直していない数の at（台詞の数が日本語と違う場面だけ。id の at は、訳の台詞の同じ id に付くので見ない） */
const numericAts = (base: unknown, where: string, ctx: Ctx, top = false) => {
  if (!ctx.linesDiffer) return;
  if (Array.isArray(base)) {
    base.forEach((b, i) => { numericAts(b, `${where}[${i}]`, ctx); });
    return;
  }
  if (!isObj(base)) return;
  for (const [k, v] of Object.entries(base)) {
    if (top && k === 'lines') continue;
    if (AT_KEYS.includes(k) && typeof v === 'number') ctx.problems.push({ where: `${where}.${k}`, message: MISSING_AT });
    else numericAts(v, `${where}.${k}`, ctx);
  }
};
const MISSING_AT = '台詞の数が日本語と違う場面なので、画面の要素の at（何番目の台詞で出すか）も訳に書く（日本語の台本の at を台詞の id で書けば、訳の台詞に同じ id を付けるだけでよい）';

/** key で重ねる配列（訳の項目の key で、日本語の台本の項目を引く。並びは日本語の台本のまま） */
const mergeByKey = (base: unknown[], over: unknown[], key: string, where: string, item: Shape | undefined, ctx: Ctx): unknown[] => {
  const index = new Map<unknown, number>();
  base.forEach((b, i) => { if (isObj(b) && b[key] !== undefined && !index.has(b[key])) index.set(b[key], i); });
  const byBase = new Map<number, unknown>();
  over.forEach((o, i) => {
    const k = isObj(o) ? o[key] : undefined;
    const at = index.get(k);
    if (at === undefined) ctx.problems.push({ where: `${where}[${i}].${key}`, message: `${key}「${String(k)}」が、日本語の台本に無い（あるのは ${[...index.keys()].join('・') || 'なし'}）` });
    else if (byBase.has(at)) ctx.problems.push({ where: `${where}[${i}].${key}`, message: `${key}「${String(k)}」を、訳に 2 回書いている` });
    else byBase.set(at, o);
  });
  const missing = base.filter((_, i) => !byBase.has(i)).map((b) => String(isObj(b) ? b[key] : b));
  if (missing.length) ctx.problems.push({ where, message: `訳に無い ${key}: ${missing.join('・')}（key で重ねる配列は、日本語の台本の項目を全部書く）` });
  return base.map((b, i) => {
    if (byBase.has(i)) return merge(b, byBase.get(i), `${where}[${i}]`, item, ctx);
    numericAts(b, `${where}[${i}]`, ctx);
    return b;
  });
};

const merge = (base: unknown, over: unknown, where: string, shape: Shape | undefined, ctx: Ctx, top = false): unknown => {
  if (over === undefined) {
    numericAts(base, where, ctx, top);
    return base;
  }
  if (Array.isArray(over)) {
    const list = isListShape(shape) ? shape : undefined;
    if (list?.$replace || !Array.isArray(base)) return over;
    const key = keyFieldOf(list?.$list);
    const keyed = key ? over.filter((o) => isObj(o) && o[key] !== undefined).length : 0;
    if (key && keyed) {
      if (keyed === over.length) return mergeByKey(base, over, key, where, list?.$list, ctx);
      ctx.problems.push({ where, message: `訳の項目の ${key} は、全部に書くか、全部に書かない（書いた項目は ${key} で、書かない項目は位置で重ねるので、混ぜると決まらない）` });
      return base;
    }
    if (over.length !== base.length) {
      ctx.problems.push({ where, message: `日本語の台本と数が合わない（台本 ${base.length}・訳 ${over.length}）` });
      return base;
    }
    return over.map((o, i) => (isObj(o) && isObj(base[i]) ? merge(base[i], o, `${where}[${i}]`, list?.$list, ctx) : o));
  }
  if (isObj(over) && isObj(base)) {
    const out: Record<string, unknown> = { ...base };
    // 訳に書いていない項目の中の、数の at（台詞の数が違う場面だけ）
    for (const [k, v] of Object.entries(base)) {
      if (over[k] !== undefined || (top && k === 'lines')) continue;
      if (AT_KEYS.includes(k) && typeof v === 'number') {
        if (ctx.linesDiffer) ctx.problems.push({ where: `${where}.${k}`, message: MISSING_AT });
      } else numericAts(v, `${where}.${k}`, ctx);
    }
    for (const [k, v] of Object.entries(over)) if (v !== undefined) out[k] = merge(base[k], v, `${where}.${k}`, fieldShape(shape, base, k), ctx);
    return out;
  }
  return over;
};

/** 動画 1 本の訳。日本語の台本（at の id を番号に直す前のもの）に訳を重ね、重ねたあとで at の id を番号に直す */
export const localizeLecture = (base: AuthoredLecture, tr: LectureL10n, course: Pick<Course, 'sections'>): Lecture => {
  const problems: L10nProblem[] = [];
  const ctx = (linesDiffer: boolean): Ctx => ({ problems, linesDiffer });
  const sameCount = tr.scenes.length === base.scenes.length;
  if (!sameCount) problems.push({ where: 'scenes', message: `場面の数が日本語の台本と合わない（台本 ${base.scenes.length}・訳 ${tr.scenes.length}）` });
  const scenes = base.scenes.map((s, i): Scene<At> => {
    const o = tr.scenes[i];
    const where = `場面 ${i + 1} ${s.kind}`;
    if (!sameCount || !o) return s;
    if (o.kind !== s.kind) {
      problems.push({ where: `場面 ${i + 1}`, message: `種類が日本語の台本と違う（台本 ${s.kind}・訳 ${o.kind}）` });
      return s;
    }
    if (!o.lines?.length) {
      problems.push({ where: `${where} lines`, message: '台詞が無い' });
      return s;
    }
    return merge(s, o, where, sceneShape(s.kind), ctx(o.lines.length !== s.lines.length), true) as Scene<At>;
  });
  if (base.caution && !tr.caution) problems.push({ where: 'caution', message: '日本語の台本に注意書き（caution）があるので、訳も書く' });
  const sectionTitle = tr.section?.title ?? course.sections.find((x) => x.no === base.section.no)?.title ?? base.section.title;
  const lecture = resolveLecture({
    ...base,
    title: tr.title,
    summary: tr.summary,
    section: { no: base.section.no, title: sectionTitle },
    docs: merge(base.docs, tr.docs, 'docs', LECTURE_FIELDS.docs, ctx(false)) as Lecture['docs'],
    quiz: merge(base.quiz, tr.quiz, 'quiz', LECTURE_FIELDS.quiz, ctx(false)) as Lecture['quiz'],
    takeaways: tr.takeaways,
    caution: tr.caution,
    scenes,
    // 読む教材は、まだ日本語だけ（訳の講座には出さない）
    material: undefined,
  });
  // 訳の動画は、日本語の動画とは別のオブジェクト（上で作った写し）なので、誤りは訳の動画にだけ付く
  if (problems.length) PROBLEMS.set(lecture, problems);
  return lecture;
};

/** 講座の訳。日本語の講座（at の id を番号に直す前のもの）に訳を重ねる */
export const localizeCourse = (base: AuthoredCourse, tr: CourseL10n, lang: TranslatedLang): Course => {
  const problems: L10nProblem[] = [];
  if (tr.sections.length !== base.sections.length) problems.push({ where: 'sections', message: `セクションの数が合わない（講座 ${base.sections.length}・訳 ${tr.sections.length}）` });
  const sections = base.sections.map((s, i) => ({ no: s.no, title: tr.sections[i]?.title ?? s.title }));
  const cast = base.cast
    ? Object.fromEntries(Object.entries(base.cast).flatMap(([v, c]) => (c ? [[v, { ...c, name: tr.cast?.[v as VoiceId]?.name ?? c.name }]] : [])))
    : undefined;
  const knownSources = new Set(base.sources?.map((source) => source.id) ?? []);
  for (const id of Object.keys(tr.sources ?? {})) {
    if (!knownSources.has(id)) problems.push({ where: `sources.${id}`, message: `日本語の講座に無い出典の訳: ${id}` });
  }
  const sources = base.sources?.map((s) => ({ ...s, ...(tr.sources?.[s.id] ?? {}) }));
  const shell: Course = {
    ...base,
    lang,
    title: tr.title,
    subtitle: tr.subtitle,
    headline: tr.headline,
    sections,
    docsNote: tr.docsNote,
    sourceNote: tr.sourceNote,
    disclaimer: tr.disclaimer ?? base.disclaimer,
    standalone: tr.standalone ?? base.standalone,
    cast,
    ui: { ...(base.ui ?? {}), ...(tr.ui ?? {}) },
    links: base.links ? (merge(base.links, tr.links, 'links', COURSE_FIELDS.links, { problems, linesDiffer: false }) as Course['links']) : undefined,
    sources,
    // 章の計画（準備中の章）と読む教材は、まだ日本語だけ
    syllabus: undefined,
    lectures: [],
  };
  shell.lectures = base.lectures.filter((l) => tr.lectures[l.id]).map((l) => localizeLecture(l, tr.lectures[l.id], shell));
  for (const id of Object.keys(tr.lectures)) if (!base.lectures.some((l) => l.id === id)) problems.push({ where: `lectures.${id}`, message: `日本語の講座に無いレクチャーの訳: ${id}` });
  if (problems.length) PROBLEMS.set(shell, problems);
  return shell;
};

/* ───────────── 訳し残しの点検 ───────────── */

const KANA = /[぀-ヿㇰ-ㇿｦ-ﾟ]/;
const HAN = /[㐀-䶿一-鿿]/;
/** 日本語・中国語の句読点と全角の記号（英語の文には出さない） */
const CJK_PUNCT = /[　-〿！-･]/;

/**
 * 訳した講座に、日本語のまま残った文字が無いかを探す。en は仮名・漢字・全角の記号、zh は仮名を探す（漢字は中国語でも使う。「・」も仮名の範囲）。
 * base（日本語の講座）を渡すと、zh は、同じ場所の日本語とまったく同じで漢字が 3 字以上の文（仮名の無い見出しや文が訳されずに残ったもの）も探す。
 * 1〜2 字の語（人・秒・命令）は中国語でも同じ字を使うので数えない。
 * 見るのは訳す文字（engine/core/fields.ts の text）と、形に書いていない項目の文字。色・アイコン・ID・URL・コード・端末の出力・読み上げる文（s）は見ない
 */
export const untranslated = (course: Course, lang: TranslatedLang, base?: AuthoredCourse): string[] => {
  const out: string[] = [];
  const hanCount = (s: string) => s.match(new RegExp(HAN.source, 'g'))?.length ?? 0;
  const bad = (s: string, ja: unknown) => KANA.test(s) || (lang === 'en' && (HAN.test(s) || CJK_PUNCT.test(s))) || (lang === 'zh' && s === ja && hanCount(s) >= 3);
  const visit: Visit = (role, v, ja, path) => {
    if ((role === 'text' || role === undefined) && typeof v === 'string' && bad(v, ja)) out.push(`${path}: ${v.slice(0, 60)}`);
  };
  walkCourse(course, base, `${course.id}.${lang}`, visit);
  for (const lec of course.lectures) walkLecture(lec, base?.lectures.find((l) => l.id === lec.id), `${course.id}.${lang}/${lec.id}`, visit);
  return out;
};
