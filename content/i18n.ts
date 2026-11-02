// 講座の多言語。日本語の台本（content/<講座>/<ID>.ts）が正本で、ほかの言語は「上書きのファイル」を重ねて作る。
//   content/<講座>/<言語>/<ID>.ts      レクチャーの訳（LectureL10n）。台詞は言語ごとに書き直し、画面の文字は場面の順に上書きする
//   content/<講座>/<言語>/course.ts    講座の訳（CourseL10n）。講座名・セクション・配役の名前・出典の説明と、レクチャーの訳を並べる
// 場面・カード・表の行などは、日本語の台本と同じ順番・同じ数で上書きする（色・アイコン・座標・URL は日本語の台本のものを使う）。
// 台詞（lines）だけは丸ごと置き換える（お笑いは直訳せず、言語ごとに作り直すので、数も変わってよい）。
import type { Course, Lecture, Line, Scene, Source, VoiceId } from './types';

/** 講座の言語。ja が正本。zh は簡体字（zh-Hans） */
export type Lang = 'ja' | 'en' | 'zh';
export const LANGS: Lang[] = ['ja', 'en', 'zh'];
/** 訳の言語（日本語の台本に上書きを重ねて作る言語） */
export type TranslatedLang = Exclude<Lang, 'ja'>;
export const TRANSLATED_LANGS: TranslatedLang[] = ['en', 'zh'];

/** 言語の名前（切り替えのリンクに、その言語で出す）・HTML の lang・サイトの URL の頭 */
export const LANG_INFO: Record<Lang, { label: string; html: string; path: string }> = {
  ja: { label: '日本語', html: 'ja', path: '' },
  en: { label: 'English', html: 'en', path: 'en/' },
  zh: { label: '中文', html: 'zh-Hans', path: 'zh/' },
};

export const isLang = (s: string): s is Lang => (LANGS as string[]).includes(s);

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

/** 場面の上書き。kind は日本語の台本の場面と同じものを書く（取り違えを止める）。台詞は丸ごと書く */
export type SceneL10n = { [K in Scene['kind']]: Omit<Override<Extract<Scene, { kind: K }>>, 'kind' | 'lines'> & { kind: K; lines: Line[] } }[Scene['kind']];

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

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
/** 丸ごと置き換える配列（数が変わってよい） */
const REPLACE = new Set(['lines', 'takeaways']);
/** 台詞の番号（何番目の台詞の頭で出すか）を書く項目。台本の検証（engine/core/validate.ts）も、この一覧で at の範囲を見る */
export const AT_KEYS: readonly string[] = ['at', 'textAt', 'subAt', 'revealAt', 'showAt'];

const merge = (base: unknown, over: unknown, where: string, key = ''): unknown => {
  if (over === undefined) return base;
  if (Array.isArray(over)) {
    if (REPLACE.has(key) || !Array.isArray(base)) return over;
    if (over.length !== base.length) throw new Error(`${where}: 日本語の台本と数が合わない（台本 ${base.length}・訳 ${over.length}）`);
    return over.map((o, i) => (isObj(o) && isObj(base[i]) ? merge(base[i], o, `${where}[${i}]`) : o));
  }
  if (isObj(over) && isObj(base)) {
    const out: Record<string, unknown> = { ...base };
    for (const [k, v] of Object.entries(over)) out[k] = merge(base[k], v, `${where}.${k}`, k);
    return out;
  }
  return over;
};

/** 台詞の数が日本語と違う場面で、上書きに書いていない at（日本語の台詞の番号のまま）を探す */
const missingAt = (base: unknown, over: unknown, where: string, out: string[]) => {
  if (Array.isArray(base)) {
    base.forEach((b, i) => missingAt(b, Array.isArray(over) ? over[i] : undefined, `${where}[${i}]`, out));
    return;
  }
  if (!isObj(base)) return;
  for (const [k, v] of Object.entries(base)) {
    if (k === 'lines') continue;
    const o = isObj(over) ? over[k] : undefined;
    if (AT_KEYS.includes(k) && typeof v === 'number' && o === undefined) out.push(`${where}.${k}`);
    else missingAt(v, o, `${where}.${k}`, out);
  }
};

/** 出す番号（at）が、その場面の台詞の数を超えていないか */
const atOutOfRange = (scene: Scene, where: string, out: string[]) => {
  const walk = (v: unknown, path: string) => {
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${path}[${i}]`));
    if (!isObj(v)) return;
    for (const [k, x] of Object.entries(v)) {
      if (k === 'lines') continue;
      if (AT_KEYS.includes(k) && typeof x === 'number' && (x < 0 || x > scene.lines.length)) out.push(`${path}.${k}=${x}（台詞は ${scene.lines.length}）`);
      else walk(x, `${path}.${k}`);
    }
  };
  walk(scene, where);
};

export const localizeLecture = (base: Lecture, tr: LectureL10n, lang: TranslatedLang, course: Course): Lecture => {
  const where = `${base.id}.${lang}`;
  if (tr.scenes.length !== base.scenes.length) throw new Error(`${where}: 場面の数が日本語の台本と合わない（台本 ${base.scenes.length}・訳 ${tr.scenes.length}）`);
  const problems: string[] = [];
  const scenes = base.scenes.map((s, i) => {
    const o = tr.scenes[i];
    if (o.kind !== s.kind) throw new Error(`${where} 場面 ${i + 1}: 種類が日本語の台本と違う（台本 ${s.kind}・訳 ${o.kind}）`);
    if (!o.lines.length) throw new Error(`${where} 場面 ${i + 1}: 台詞が無い`);
    if (o.lines.length !== s.lines.length) missingAt(s, o, `場面 ${i + 1}`, problems);
    const scene = merge(s, o, `${where} 場面 ${i + 1}`) as Scene;
    atOutOfRange(scene, `場面 ${i + 1}`, problems);
    return scene;
  });
  if (problems.length) throw new Error(`${where}: 台詞の数が日本語と違う場面は、画面の要素の at（何番目の台詞で出すか）も書く\n  ${problems.join('\n  ')}`);
  if (base.caution && !tr.caution) throw new Error(`${where}: 日本語の台本に注意書き（caution）があるので、訳も書く`);
  const sectionTitle = tr.section?.title ?? course.sections.find((x) => x.no === base.section.no)?.title ?? base.section.title;
  return {
    ...base,
    title: tr.title,
    summary: tr.summary,
    section: { no: base.section.no, title: sectionTitle },
    docs: merge(base.docs, tr.docs, `${where}.docs`) as Lecture['docs'],
    quiz: merge(base.quiz, tr.quiz, `${where}.quiz`) as Lecture['quiz'],
    takeaways: tr.takeaways,
    caution: tr.caution,
    scenes,
    // 読む教材は、まだ日本語だけ（訳の講座には出さない）
    material: undefined,
  };
};

export const localizeCourse = (base: Course, tr: CourseL10n, lang: TranslatedLang): Course => {
  const where = `${base.id}.${lang}`;
  if (tr.sections.length !== base.sections.length) throw new Error(`${where}: セクションの数が合わない`);
  const sections = base.sections.map((s, i) => ({ no: s.no, title: tr.sections[i].title }));
  const cast = base.cast
    ? Object.fromEntries(Object.entries(base.cast).map(([v, c]) => [v, { ...c!, name: tr.cast?.[v as VoiceId]?.name ?? c!.name }]))
    : undefined;
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
    links: base.links ? (merge(base.links, tr.links, `${where}.links`) as Course['links']) : undefined,
    sources,
    // 章の計画（準備中の章）と読む教材は、まだ日本語だけ
    syllabus: undefined,
    lectures: [],
  };
  shell.lectures = base.lectures.filter((l) => tr.lectures[l.id]).map((l) => localizeLecture(l, tr.lectures[l.id], lang, shell));
  for (const id of Object.keys(tr.lectures)) if (!base.lectures.some((l) => l.id === id)) throw new Error(`${where}: 日本語の講座に無いレクチャーの訳: ${id}`);
  return shell;
};

/* ───────────── 訳し残しの点検 ───────────── */

/** 文字として画面・字幕・サイトに出ない項目（色・アイコン・ID・URL・効果音・声・コードの中身） */
const NOT_TEXT = new Set(['kind', 'key', 'tone', 'icon', 'v', 'sfx', 'sfxAfter', 'bgm', 'url', 'id', 'lang', 'theme', 'from', 'to', 'evidence', 'variant', 'type', 'device', 'unitLabel', 'idPrefix', 'code', 'cmd', 'out', 'file', 'fromSide', 'toSide', 'op', 'mono', 'checked', 's']);
const KANA = /[\u3040-\u30FF\u31F0-\u31FF\uFF66-\uFF9F]/;
const HAN = /[\u3400-\u4DBF\u4E00-\u9FFF]/;
/** 日本語・中国語の句読点と全角の記号（英語の文には出さない） */
const CJK_PUNCT = /[\u3000-\u303F\uFF01-\uFF65]/;

/**
 * 訳した講座に、日本語のまま残った文字が無いかを探す。en は仮名・漢字・全角の記号、zh は仮名を探す（漢字は中国語でも使う。「・」も仮名の範囲）。
 * base（日本語の講座）を渡すと、zh は、同じ場所の日本語とまったく同じで漢字が 3 字以上の文（仮名の無い見出しや文が訳されずに残ったもの）も探す。
 * 1〜2 字の語（人・秒・命令）は中国語でも同じ字を使うので数えない
 */
export const untranslated = (course: Course, lang: TranslatedLang, base?: Course): string[] => {
  const out: string[] = [];
  const hanCount = (s: string) => s.match(new RegExp(HAN.source, 'g'))?.length ?? 0;
  const bad = (s: string, ja: unknown) => KANA.test(s) || (lang === 'en' && (HAN.test(s) || CJK_PUNCT.test(s))) || (lang === 'zh' && s === ja && hanCount(s) >= 3);
  const walk = (v: unknown, ja: unknown, path: string, key = '') => {
    if (NOT_TEXT.has(key)) return;
    if (typeof v === 'string') {
      if (bad(v, ja)) out.push(`${path}: ${v.slice(0, 60)}`);
      return;
    }
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, Array.isArray(ja) ? ja[i] : undefined, `${path}[${i}]`, key));
    if (isObj(v)) for (const [k, x] of Object.entries(v)) walk(x, isObj(ja) ? ja[k] : undefined, `${path}.${k}`, k);
  };
  const { lectures, ...rest } = course;
  walk(rest, base, `${course.id}.${lang}`);
  for (const lec of lectures) walk(lec, base?.lectures.find((l) => l.id === lec.id), `${course.id}.${lang}/${lec.id}`);
  return out;
};
