// 講座のページに入れるデータ（純粋。ファイルを読み書きしない）。台本（Course）と講義のデータ（synth.ts が書く site/data/<key>.json）から、
// ページの中の JSON（template.html の __COURSE_JSON__。画面の JS が読む）の形を作る。講義のデータは呼ぶ側が読んで渡す
import { LANG_INFO, type Lang, videoKey } from '../../content/i18n';
import type { ChapterMaterial, Course, Source, VoiceId } from '../../content/types';
import { creditsIn, SITE_CREDITS } from '../../content/voices';
import type { SiteText } from '../../site/i18n';
import { type MediaEntry, mediaPath } from '../../site/media-shared';
import { PAGE_VERSION_MARK } from '../site-version';
import type { SiteConfig } from '../validate';
import { type Html, jsonHtml } from './html';

/** 講義のデータ（synth.ts が書く site/data/<key>.json の、サイトが使う所） */
export type SiteData = {
  duration: number;
  chapters: { scene: number; start: number; heading: string; kind: string }[];
  cues: { start: number; end: number; text: string; scene: number }[];
};
/** 動画の名前（S01・S01.en）から講義のデータを引く。無ければ null */
export type ReadData = (key: string) => SiteData | null;

/** 台本の強調（**）を外す（説明文・カードの文に使う） */
export const plain = (s: string) => s.replace(/\*\*/g, '');

/** 教材の出典の id を、サイトに出す形（発行元・年・URL）に開く */
export const materialForSite = (course: Course, m: ChapterMaterial) => {
  const src = new Map((course.sources ?? []).map((x) => [x.id, x]));
  const pick = (ids: string[] | undefined) =>
    (ids ?? []).map((id) => {
      const x = src.get(id);
      if (!x) throw new Error(`${course.id} ${m.id}: 出典が sources に無い: ${id}`);
      return {
        publisher: x.publisher,
        year: x.year,
        title: x.title,
        url: x.url,
        kind: x.kind,
        checked: x.checked,
      } satisfies Omit<Source, 'id' | 'note'>;
    });
  return {
    id: m.id,
    goals: m.goals,
    prerequisites: m.prerequisites,
    sections: m.sections.map((x) => ({
      id: x.id,
      title: x.title,
      body: x.body,
      evidence: x.evidence,
      sources: pick(x.sources),
    })),
    figures: m.figures,
    exercise: m.exercise,
    summary: m.summary,
    askExamples: m.askExamples,
  };
};

/** 講座の 1 レクチャー（ページの JSON の lectures の 1 つ。key は動画の名前で、JSON には入れない） */
export type LectureModel = ReturnType<typeof lectureModels>[number];

/** 講座のレクチャー。講義のデータが無ければ止める（先に synth.ts を流す） */
export const lectureModels = (course: Course, lang: Lang, T: SiteText, readData: ReadData) =>
  course.lectures.map((lec) => {
    const key = videoKey(lec.id, lang);
    const d = readData(key);
    if (!d) throw new Error(`site/data/${key}.json がありません。先に bun scripts/synth.ts ${key} を流す`);
    return {
      id: lec.id,
      key,
      no: lec.no,
      section: lec.section,
      title: lec.title,
      summary: lec.summary,
      docs: lec.docs,
      quiz: lec.quiz,
      takeaways: lec.takeaways,
      caution: lec.caution ?? '',
      material: lec.material ? materialForSite(course, lec.material) : null,
      duration: d.duration,
      chapters: d.chapters.map((c) => ({
        start: c.start,
        heading: c.kind === 'opening' ? T.opening : c.kind === 'ending' ? T.ending : c.heading,
      })),
      cues: d.cues.map((c) => ({ start: c.start, end: c.end, text: c.text, scene: c.scene })),
    };
  });

/** 講座の動画の合計の長さ（分）。講義のデータの無い動画は 0 と数える */
export const minutesOf = (course: Course, lang: Lang, readData: ReadData) =>
  course.lectures.reduce((a, l) => a + (readData(videoKey(l.id, lang))?.duration ?? 0), 0) / 60;

/** 台詞の声（v が無ければ先生） */
const voicesOf = (courses: readonly Course[]): VoiceId[] =>
  courses.flatMap((c) =>
    c.lectures.flatMap((l) => l.scenes.flatMap((s) => s.lines.map((ln) => (ln.v ?? 'narrator') as VoiceId))),
  );

/** 講座の動画で使った声のクレジット。日本語は全講座で共通（講師と呼び込み。ほかの声は講座の sourceNote） */
export const courseCredits = (course: Course, lang: Lang): string[] =>
  lang === 'ja' ? SITE_CREDITS : creditsIn(lang, voicesOf([course]));

/** 一覧のページのクレジット。日本語は全講座で共通、訳の言語はその言語の全講座で使った声 */
export const homeCredits = (courses: readonly Course[], lang: Lang): string[] =>
  lang === 'ja' ? SITE_CREDITS : creditsIn(lang, voicesOf(courses));

/** 講座の情報（ページの JSON の course）。計画だけある章（まだ動画が無い）は、カリキュラムに「準備中」で出す */
export const courseMeta = (course: Course, T: SiteText, config: SiteConfig) => {
  const made = new Set(course.lectures.map((l) => l.id));
  const planned = (course.syllabus?.chapters ?? [])
    .filter((ch) => !made.has(ch.lectureId))
    .map((ch) => ({ no: ch.no, section: ch.section, title: ch.title, minutes: ch.minutes }));
  return {
    id: course.id,
    title: course.title,
    subtitle: course.subtitle,
    sections: course.sections,
    sourceNote: course.sourceNote,
    disclaimer: course.disclaimer ?? '',
    links: [...(course.links ?? []), { label: T.repoLink, url: config.repoUrl }],
    unitLabel: course.unitLabel ?? 'LECTURE',
    ui: course.ui ?? {},
    planned,
  };
};

/** レクチャーの動画（通常版は必ず。字幕を焼き込んだ版は無ければ undefined） */
export type VideoFor = (lecture: string, kind: MediaEntry['kind']) => MediaEntry | undefined;

/**
 * ページの中の JSON（template.html の __COURSE_JSON__）。版とポスターの ?v= は版の印のまま（scripts/site-version.ts）。
 * < は \u003c にする（html.ts の jsonHtml。台本の文字が </script> を含んでも、ページの script を閉じない）
 */
export const courseJson = (o: {
  course: Course;
  lang: Lang;
  T: SiteText;
  config: SiteConfig;
  lectures: LectureModel[];
  video: VideoFor;
}): Html => {
  const info = LANG_INFO[o.lang];
  const standard = (id: string) => {
    const e = o.video(id, 'standard');
    if (!e) throw new Error(`動画の一覧がありません: ${o.lang}/${o.course.id}/${id}。先に bun scripts/media.ts push`);
    return e;
  };
  return jsonHtml({
    course: courseMeta(o.course, o.T, o.config),
    credits: courseCredits(o.course, o.lang),
    pageVersion: PAGE_VERSION_MARK,
    lang: { code: o.lang, html: info.html, label: info.label },
    text: o.T,
    lectures: o.lectures.map(({ key, ...lec }) => {
      const cc = o.video(lec.id, 'captioned');
      return {
        ...lec,
        video: mediaPath(standard(lec.id)),
        poster: `media/${key}.jpg?v=${PAGE_VERSION_MARK}`,
        videoCc: cc ? mediaPath(cc) : '',
      };
    }),
  });
};
