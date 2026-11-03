// 講座の一覧（COURSES）・訳の一覧（TRANSLATIONS）・動画の一覧（VIDEOS）。講座は content/courses.ts の登録表（1 講座 1 行）から集め、
// Course の order の順に並べる。講座を足すときは、講座のフォルダ（台本・course.ts・index.ts）を作り、content/courses.ts に 1 行を足す。
// 台本の at に書いた台詞の id は、ここで番号に直す（content/lines.ts）。訳は、番号に直す前の日本語の台本に重ねてから直す
import type { CourseModule } from './course-module';
import * as REGISTRY from './courses';
import { LANGS, localizeCourse, parseVideoKey, videoKey, type CourseL10n, type Lang, type TranslatedLang } from './i18n';
import { resolveCourse } from './lines';
import type { AuthoredCourse, Course, Lecture } from './types';

/** 登録した講座（order の順。同じ order なら講座 ID の順。order の重なりは npm run validate が止める） */
const MODULES: CourseModule[] = (Object.values(REGISTRY) as CourseModule[]).sort((a, b) => a.course.order - b.course.order || (a.course.id < b.course.id ? -1 : a.course.id > b.course.id ? 1 : 0));

/** 台本に書いたままの日本語の講座（at に台詞の id が残っている）。訳を重ねる元と、訳のひな形に使う */
export const AUTHORED_COURSES: AuthoredCourse[] = MODULES.map((m) => m.course);

/** 日本語の講座（一覧のページの並び。at は台詞の番号に直したもの） */
export const COURSES: Course[] = AUTHORED_COURSES.map(resolveCourse);

/** 動画を作るときは、全講座のレクチャーをまとめて扱う（ID は講座をまたいで重ならないようにする） */
export const LECTURES: Lecture[] = COURSES.flatMap((c) => c.lectures);

export const courseOf = (lectureId: string): Course => {
  const c = COURSES.find((x) => x.lectures.some((l) => l.id === lectureId));
  if (!c) throw new Error(`どの講座にも無いレクチャー: ${lectureId}`);
  return c;
};

const ids = LECTURES.map((l) => l.id);
const dup = ids.find((id, i) => ids.indexOf(id) !== i);
if (dup) throw new Error(`レクチャー ID が講座をまたいで重なっている: ${dup}`);
// 訳の講座の URL と保存の ID は <言語>/<講座>（en/pstack-comedy）。Service Worker は頭の 2 文字の英小文字を言語のフォルダとして読むので、2 文字の英小文字の講座 ID は使わない
if (COURSES.some((c) => (LANGS as string[]).includes(c.id) || /^[a-z]{2}$/.test(c.id))) throw new Error('講座 ID に 2 文字の英小文字（ja・en・zh などの言語の名前）は使えない（訳の講座の URL の頭と重なる）');

/* ───────────── 訳の講座（content/i18n.ts） ─────────────
 * 言語ごとに、講座 ID → 訳（CourseL10n）。各講座のフォルダの index.ts の translations から集める。訳の講座は、日本語の講座に訳を重ねて作る。
 */
export const TRANSLATIONS: Record<TranslatedLang, Record<string, CourseL10n>> = {
  en: Object.fromEntries(MODULES.flatMap((m) => (m.translations?.en ? [[m.course.id, m.translations.en]] : []))),
  zh: Object.fromEntries(MODULES.flatMap((m) => (m.translations?.zh ? [[m.course.id, m.translations.zh]] : []))),
};

const localized = new Map<Lang, Course[]>();
/** その言語で出す講座（日本語は全部、ほかの言語は訳のある講座だけ。並びは日本語の講座と同じ） */
export const coursesIn = (lang: Lang): Course[] => {
  if (lang === 'ja') return COURSES;
  let list = localized.get(lang);
  if (!list) {
    const tr = TRANSLATIONS[lang];
    for (const id of Object.keys(tr)) if (!COURSES.some((c) => c.id === id)) throw new Error(`訳の講座が日本語の講座に無い: ${lang}/${id}`);
    list = AUTHORED_COURSES.filter((c) => tr[c.id]).map((c) => localizeCourse(c, tr[c.id], lang));
    localized.set(lang, list);
  }
  return list;
};

/** 動画 1 本（レクチャー × 言語）。key は日本語なら S01、ほかは S01.en（content/i18n.ts の videoKey） */
export type Video = { key: string; lang: Lang; lecture: Lecture; course: Course };
export const VIDEOS: Video[] = LANGS.flatMap((lang) => coursesIn(lang).flatMap((course) => course.lectures.map((lecture) => ({ key: videoKey(lecture.id, lang), lang, lecture, course }))));

export const videoOf = (key: string): Video => {
  const v = VIDEOS.find((x) => x.key === key);
  if (!v) {
    const { id, lang } = parseVideoKey(key);
    throw new Error(`動画が無い: ${key}（${lang === 'ja' ? 'どの講座にも無いレクチャー' : `${id} の ${lang} の訳が無い`}）`);
  }
  return v;
};
