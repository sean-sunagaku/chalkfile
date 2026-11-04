// 講座の登録から、台本・訳・動画の一覧を作る。教材を付けるかは呼ぶ側で決める。
import type { CourseModule } from './course-module';
import {
  type CourseL10n,
  LANGS,
  type Lang,
  localizeCourse,
  parseVideoKey,
  type TranslatedLang,
  videoKey,
} from './i18n';
import { resolveCourse } from './lines';
import { type Reading, useReading } from './reading';
import type { AuthoredCourse, Course, Lecture, Video } from './schema';

// 同じ登録から教材付きと動画専用の一覧を作っても、台詞に付ける辞書の同一性を保つ。
const EMPTY_READINGS = new WeakMap<CourseModule, Reading>();
const moduleReading = (module: CourseModule): Reading => {
  if (module.reading) return module.reading;
  let reading = EMPTY_READINGS.get(module);
  if (!reading) {
    reading = {};
    EMPTY_READINGS.set(module, reading);
  }
  return reading;
};

export const createCatalog = (
  registry: readonly CourseModule[],
  decorate: (course: AuthoredCourse) => AuthoredCourse = (course) => course,
) => {
  /** 登録した講座（order の順。同じ order なら講座 ID の順。order の重なりは npm run validate が止める） */
  const MODULES: CourseModule[] = [...registry].sort(
    (a, b) => a.course.order - b.course.order || (a.course.id < b.course.id ? -1 : a.course.id > b.course.id ? 1 : 0),
  );

  /** 台本に書いたままの日本語の講座（at に台詞の id が残っている）。訳を重ねる元と、訳のひな形に使う */
  const AUTHORED_COURSES: AuthoredCourse[] = MODULES.map((m) => decorate(m.course));

  /**
   * 講座の読みの辞書（content/<講座>/reading.ts）を、その講座の日本語の台詞に付ける（content/reading.ts）。辞書の無い講座にも、空の辞書を付ける
   * （2 つの講座で同じ台詞のオブジェクトを使っていると、どちらの辞書で読むか決まらないので、その台詞を SHARED_LINES に挙げる。テストが 0 を確かめる）
   */
  const SHARED_LINES: string[] = MODULES.flatMap((m) => {
    const reading = moduleReading(m);
    return m.course.lectures.flatMap((l) =>
      l.scenes.flatMap((s, i) => useReading(s.lines, reading).map(() => `${m.course.id}/${l.id} 場面 ${i + 1}`)),
    );
  });

  /** 日本語の講座（一覧のページの並び。at は台詞の番号に直したもの） */
  const COURSES: Course[] = AUTHORED_COURSES.map(resolveCourse);

  /** 動画を作るときは、全講座のレクチャーをまとめて扱う（ID は講座をまたいで重ならないようにする） */
  const LECTURES: Lecture[] = COURSES.flatMap((c) => c.lectures);

  const courseOf = (lectureId: string): Course => {
    const c = COURSES.find((x) => x.lectures.some((l) => l.id === lectureId));
    if (!c) throw new Error(`どの講座にも無いレクチャー: ${lectureId}`);
    return c;
  };

  const ids = LECTURES.map((l) => l.id);
  const dup = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dup) throw new Error(`レクチャー ID が講座をまたいで重なっている: ${dup}`);
  // 訳の講座の URL と保存の ID は <言語>/<講座>（en/pstack-comedy）。言語のフォルダは言語の一覧（content/langs.ts）から読む。
  // 言語の名前と、これから足す言語の名前（2 文字の英小文字）は、講座 ID に使わない
  if (COURSES.some((c) => (LANGS as string[]).includes(c.id) || /^[a-z]{2}$/.test(c.id)))
    throw new Error(
      '講座 ID に 2 文字の英小文字（ja・en・zh などの言語の名前）は使えない（訳の講座の URL の頭と重なる）',
    );

  /* ───────────── 訳の講座（content/i18n.ts） ─────────────
   * 言語ごとに、講座 ID → 訳（CourseL10n）。各講座のフォルダの index.ts の translations から集める。訳の講座は、日本語の講座に訳を重ねて作る。
   */
  const TRANSLATIONS: Record<TranslatedLang, Record<string, CourseL10n>> = {
    en: Object.fromEntries(MODULES.flatMap((m) => (m.translations?.en ? [[m.course.id, m.translations.en]] : []))),
    zh: Object.fromEntries(MODULES.flatMap((m) => (m.translations?.zh ? [[m.course.id, m.translations.zh]] : []))),
  };

  const localized = new Map<Lang, Course[]>();
  /** その言語で出す講座（日本語は全部、ほかの言語は訳のある講座だけ。並びは日本語の講座と同じ） */
  const coursesIn = (lang: Lang): Course[] => {
    if (lang === 'ja') return COURSES;
    let list = localized.get(lang);
    if (!list) {
      const tr = TRANSLATIONS[lang];
      for (const id of Object.keys(tr))
        if (!COURSES.some((c) => c.id === id)) throw new Error(`訳の講座が日本語の講座に無い: ${lang}/${id}`);
      // filter で訳がある講座だけを選んでいる。
      list = AUTHORED_COURSES.filter((c) => tr[c.id]).map((c) => localizeCourse(c, tr[c.id]!, lang));
      localized.set(lang, list);
    }
    return list;
  };

  /** 動画 1 本（レクチャー × 言語）。型は engine/core/schema.ts の Video */
  const VIDEOS: Video[] = LANGS.flatMap((lang) =>
    coursesIn(lang).flatMap((course) =>
      course.lectures.map((lecture) => ({ key: videoKey(lecture.id, lang), lang, lecture, course })),
    ),
  );

  const videoOf = (key: string): Video => {
    const v = VIDEOS.find((x) => x.key === key);
    if (!v) {
      const { id, lang } = parseVideoKey(key);
      throw new Error(
        `動画が無い: ${key}（${lang === 'ja' ? 'どの講座にも無いレクチャー' : `${id} の ${lang} の訳が無い`}）`,
      );
    }
    return v;
  };

  return { AUTHORED_COURSES, SHARED_LINES, COURSES, LECTURES, courseOf, TRANSLATIONS, coursesIn, VIDEOS, videoOf };
};
