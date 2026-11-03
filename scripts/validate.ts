// 台本と、公開で止まることを検証する。誤り（error）があれば 1 で終える。PR の CI（.github/workflows/check.yml）も流す。
//   bun scripts/validate.ts             # 誤りの一覧と、注意（warning）の数と内訳
//   bun scripts/validate.ts --warnings  # 注意も一覧にする
//   bun scripts/validate.ts --json      # 結果を JSON で出す（CI・ほかの道具が読む）
//   npm run chalk -- validate           # 1 つの入口から、台本とファイルの点検（check_content.ts）と一緒に流す
// 見るもの
//   台本（engine/core/validate.ts）: 全講座・全言語の台本と、テーマ・timeline（content/<講座>/generated/timeline/。形と指紋）・
//     講座をまたいだもの（レクチャー ID の頭文字・一覧の並び・講座 ID が重ならないか）
//   公開で止まること（このファイル）: 講座サイトの設定・ID・リンク（siteProblems。scripts/build_site.ts も組み立ての前に呼ぶ）、
//     教材の ID と参照（materialProblems。scripts/build_materials.ts も書き出す前に呼ぶ）、公開する言語（site/config.json の publishLangs）の
//     全部の動画のポスター（content/<講座>/generated/posters/）と動画の一覧（content/<講座>/generated/media.<言語>.json）。
//     これまで main の公開の CI でしか分からなかった（GA4 のポスターの入れ忘れ）ので、PR で先に止める。
//     講座のページのクレジットが、講座の動画で使った全部の声を含むか（creditProblems。今は注意）。
//     公開した動画が、今の台本で書き出したものか（mediaInputProblems。動画の一覧の inputs と、今の台本・描き方の指紋を比べる）
// 誤り: 描くと止まるか黙って崩れるもの（矢印の行き先・at の範囲・表の幅・注の位置・テーマ・効果音・声など）と、
//       手で書いた派生データ（セクション・クイズの番号・次の動画・syllabus）の食い違い・台本と形の合わない timeline・公開で止まること
//       （書き出したあとで台本が変わった、公開した動画も）
// 注意: 見込み（焼き込み字幕が 3 行・見出しの幅）・style.md の目安（表 6 行×3 列・コード 18 行）・** の対応・意図かもしれない食い違い・
//       書き出したあとで描き方のコードだけが変わった、公開した動画
// 知らせ（失敗にも注意にもしない。GitHub Actions では ::notice::）: 書き出しの記録（inputs）の無い、公開した動画の数
// synth.ts の最初（対象の動画だけ）と Studio（src/Root.tsx。その動画だけ止める）も、同じ台本の検証を使う
// 終了コード: 0 誤りなし・1 誤りがある・2 使い方の誤り
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { LANG_INFO, LANGS, type Lang, videoKey } from '../content/i18n';
import { THEMES } from '../content/themes';
import type { Course, Theme } from '../content/types';
import { creditsIn, voicesOf } from '../content/voices';
import { formatIssues, RULES, validateCourse, validateCourses, validateTheme, validateTimelineFiles, type Issue, type Rule } from '../engine/core/validate';
import { mediaListFile, posterFile } from '../engine/core/generated';
import { mediaKey, type MediaManifest } from '../site/media-shared';
import { readArgs, runMain, showHelp } from './lib/args';
import { readSiteConfig, type SiteConfig } from './lib/config';
import { ROOT } from './lib/paths';
import { readMediaLists } from './media-lists';
import { PAGE_VERSION_MARK } from './site-version';
import { courseCredits } from './site/model';
import { fileHasher } from './stages/pipeline/digest';
import { type PublishedCheck, publishedChecks, srcDigest } from './stages/video/inputs';
import { readTimelinesByKey } from './timelines';

/** 公開で止まることの種類（台本の検証の RULES に足す。engine/core/validate.ts は台本だけを見るので、こちらに置く） */
export const PUBLISH_RULES = { site: '講座サイトの設定・ID・リンク', material: '教材の ID と参照', poster: 'ポスター', media: '動画の一覧', credit: '声のクレジット', inputs: '動画の書き出しの記録' } as const;
/** 公開で止まることの 1 件（形は台本の Issue と同じで、rule だけが PUBLISH_RULES の名前） */
export type PublishIssue = Omit<Issue, 'rule'> & { rule: keyof typeof PUBLISH_RULES };

/** notices: 失敗にも注意にもしない知らせ（書き出しの記録の無い動画の数など） */
export type Report = { ok: boolean; errors: number; warnings: number; courses: number; videos: number; themes: number; issues: (Issue | PublishIssue)[]; notices: string[] };

/* ───────────── 講座サイトの設定と、公開で止まること ───────────── */

/** site/config.json の形と読み方（scripts/build_site.ts も、ここから読む。置き場所は scripts/lib/config.ts） */
export { readSiteConfig, type SiteConfig };

/** 訳の言語の動画のサイトのパス（/media/en/ など。サイトと同じ origin なので、パスだけで指せる）。日本語と、動画のサイトの無い言語は null */
export const mediaRootOf = (config: SiteConfig, lang: Lang): string | null => {
  const m = lang === 'ja' ? undefined : config.media?.[lang];
  return m ? new URL(m.url.endsWith('/') ? m.url : `${m.url}/`).pathname : null;
};

const ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const HTTPS = /^https:\/\/[^\s"'<>`]+$/;

/**
 * 講座サイトの安全のための確かめ（scripts/build_site.ts が組み立ての前に呼ぶ。中身と文言は build_site.ts にあったときのまま）。
 * ID は URL とファイル名に使うので英数字だけ。リンクは https:// だけ（javascript: などを通さない）。
 * 台本の中身の確かめ（注入・隠し文字・秘密情報）は scripts/check_content.ts が受け持つ。
 * coursesIn は言語ごとの講座（content/index.ts の coursesIn）。公開しない言語の講座も見る
 */
export const siteProblems = (config: SiteConfig, coursesIn: (lang: Lang) => Course[], themes: readonly Theme[] = Object.values(THEMES)): string[] => {
  const base = config.baseUrl.endsWith('/') ? config.baseUrl : `${config.baseUrl}/`;
  const problems: string[] = [];
  if (!HTTPS.test(config.baseUrl) || !HTTPS.test(config.repoUrl)) problems.push('site/config.json の baseUrl と repoUrl は https:// で書く');
  for (const [lang, m] of Object.entries(config.media ?? {})) {
    if (!m || !HTTPS.test(m.url) || !HTTPS.test(m.repo)) problems.push(`site/config.json の media.${lang} の url と repo は https:// で書く`);
    // 動画のサイトは講座サイトと同じ origin（Service Worker が中身を確かめて保存でき、Range もそのまま動く）
    else if (new URL(m.url).origin !== new URL(base).origin) problems.push(`site/config.json の media.${lang}.url は baseUrl と同じ origin にする: ${m.url}`);
    else {
      // 講座サイトを含むパスに置くと、ページと動画の区別（Service Worker）が崩れる。講座サイトの下に置くとき（chalkfile.com/media/ など）は、
      // 頭のフォルダの名前を、講座 ID・言語のフォルダと重ねない
      // biome-ignore lint/style/noNonNullAssertion: media に書いた訳の言語には、動画のサイトのパスが必ずある（build_site.ts にあったときのまま）
      const mp = mediaRootOf(config, lang as Lang)!;
      const bp = new URL(base).pathname;
      const head = mp.startsWith(bp) ? mp.slice(bp.length).split('/')[0] : '';
      if (bp.startsWith(mp) || coursesIn('ja').some((c) => c.id === head) || LANGS.some((l) => LANG_INFO[l].path === `${head}/`)) {
        problems.push(`site/config.json の media.${lang}.url は、講座サイトを含まず、講座 ID・言語のフォルダと重ならない場所にする: ${m.url}`);
      }
    }
  }
  for (const lang of LANGS)
    for (const c of coursesIn(lang)) {
      if (!ID.test(c.id)) problems.push(`講座 ID が英数字でない: ${c.id}`);
      for (const ln of c.links ?? []) if (!HTTPS.test(ln.url)) problems.push(`${c.id} のリンクが https:// でない: ${ln.url}`);
      for (const lec of c.lectures) {
        if (!ID.test(lec.id)) problems.push(`レクチャー ID が英数字でない: ${lec.id}`);
        for (const d of lec.docs) if (!HTTPS.test(d.url)) problems.push(`${lec.id} の公式ドキュメントのリンクが https:// でない: ${d.url}`);
        // 節 ID・図 ID はページの中の id 属性とリンク先になるので英数字だけ
        const m = lec.material;
        if (m) for (const id of [m.id, ...m.sections.map((x) => x.id), ...m.figures.map((x) => x.id), m.exercise.id]) if (!ID.test(id)) problems.push(`${lec.id} の教材の ID が英数字でない: ${id}`);
      }
      for (const x of c.sources ?? []) if (!HTTPS.test(x.url)) problems.push(`${c.id} の出典のリンクが https:// でない: ${x.url}`);
      // 版の印（scripts/site-version.ts）は、版が決まるとページの中で全部置き換えるので、台本には書けない
      if (JSON.stringify(c).includes(PAGE_VERSION_MARK)) problems.push(`${c.id} の台本に、版の印と同じ文字 ${PAGE_VERSION_MARK} がある`);
    }
  for (const t of themes) if (!ID.test(t.id)) problems.push(`テーマ ID が英数字でない: ${t.id}`);
  return problems;
};

/**
 * 教材の ID と参照（scripts/build_materials.ts が書き出す前に呼ぶ。中身と文言は build_materials.ts にあったときのまま）。
 * 節 ID・図 ID が重なっていないか（AI チャットの参照先がぶれないように）と、質問例の参照先があるか。教材を作る講座（syllabus のある講座）に使う
 */
export const materialProblems = (c: Course): string[] => {
  const problems: string[] = [];
  const ids = [...c.lectures.flatMap((l) => (l.material ? [l.material.id, ...l.material.sections.map((s) => s.id), ...l.material.figures.map((f) => f.id), l.material.exercise.id] : [])), ...(c.syllabus?.chapters.map((ch) => ch.id) ?? [])];
  const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i && !c.syllabus?.chapters.some((ch) => ch.id === id && c.lectures.some((l) => l.material?.id === id)));
  if (dupIds.length) problems.push(`${c.id}: ID が重なっている: ${[...new Set(dupIds)].join(' ')}`);
  for (const lec of c.lectures) {
    if (!lec.material) continue;
    for (const a of lec.material.askExamples) for (const r of a.refs) if (!ids.includes(r)) problems.push(`${lec.id}: 質問例の参照先が無い: ${r}`);
  }
  return problems;
};

/** 公開する言語（publishLangs）の全部の動画。key は動画の名前（S01・S01.en） */
const publishedVideos = (config: SiteConfig, coursesIn: (lang: Lang) => Course[]) =>
  config.publishLangs.flatMap((lang) => coursesIn(lang).flatMap((course) => course.lectures.map((lecture) => ({ lang, course, lecture, key: videoKey(lecture.id, lang) }))));

/**
 * 公開する言語の全部の動画に、ポスター（content/<講座>/generated/posters/<key>.jpg）があるか。
 * 公開の CI の checkout には Git に入れたものしか無いので、無いと build_site --strict で止まる（GA4 のポスターの入れ忘れ）
 */
export const posterProblems = (config: SiteConfig, coursesIn: (lang: Lang) => Course[], hasPoster = (file: string) => existsSync(path.join(ROOT, file))): PublishIssue[] =>
  publishedVideos(config, coursesIn)
    .filter((v) => !hasPoster(posterFile(v.course.id, v.key)))
    .map((v) => ({ level: 'error', rule: 'poster', where: `${v.course.id}/${v.key}`, message: `ポスター ${posterFile(v.course.id, v.key)} が無い（npm run render -- ${v.key} が作る。Git に入れる）` }));

/**
 * 動画の一覧（講座ごとの content/<講座>/generated/media.<言語>.json をつないだもの）に、公開する言語の全部の動画があるか。通常版は全部（無いと build_site が止まる）。
 * 掛け合いの講座（cast がある）は、字幕を焼き込んだ版も（講座サイトは、字幕をオンにするとこちらを流す）
 */
export const mediaProblems = (config: SiteConfig, coursesIn: (lang: Lang) => Course[], manifest: MediaManifest): PublishIssue[] => {
  const keys = new Set(manifest.entries.map(mediaKey));
  const out: PublishIssue[] = [];
  for (const v of publishedVideos(config, coursesIn)) {
    const has = (kind: 'standard' | 'captioned') => keys.has(mediaKey({ lang: v.lang, course: v.course.id, lecture: v.lecture.id, kind }));
    const where = `${v.course.id}/${v.key}`;
    const list = mediaListFile(v.course.id, v.lang);
    const push = `bun scripts/media.ts push --course ${v.course.id}${v.lang === 'ja' ? '' : ` --lang ${v.lang}`}`;
    if (!has('standard')) out.push({ level: 'error', rule: 'media', where, message: `動画の一覧（${list}）に通常版が無い（書き出してから ${push}）` });
    if (v.course.cast && !has('captioned')) {
      out.push({ level: 'error', rule: 'media', where, message: `動画の一覧（${list}）に字幕を焼き込んだ版が無い（掛け合いの講座は CAPTIONS=1 で書き出してから ${push}）` });
    }
  }
  return out;
};

/**
 * 講座のページに出す声のクレジットの文（ページの {voices} は scripts/site/model.ts の courseCredits、{note} は講座の sourceNote）。
 * 今の courseCredits は、日本語は全講座で共通の講師と呼び込み、訳は使った声から作る（creditsIn）
 */
const pageCreditText = (course: Course, lang: Lang): string =>
  [...courseCredits(course, lang), course.sourceNote ?? ''].join('\n');

/**
 * 講座のページのクレジットが、講座の動画で使った全部の声のクレジットを含むか（キャラクターの利用規約。VOICEVOX は「VOICEVOX:キャラ名」）。
 * 日本語のページは講師と呼び込みしか出さないので、ほかの声（ずんだもん・玄野武宏など）は講座の sourceNote に書く（comedy.md）。
 * 今は注意（warning）にする。ページのクレジットを使った声から作るように直したら（サイトの版が変わるので、ほかのサイトの直しとまとめて出す）、
 * level を誤り（error）にする
 */
export const creditProblems = (coursesIn: (lang: Lang) => Course[], level: Issue['level'] = 'warning'): PublishIssue[] =>
  LANGS.flatMap((lang) =>
    coursesIn(lang).flatMap((course) => {
      const shown = pageCreditText(course, lang);
      const lacking = creditsIn(lang, course.lectures.flatMap(voicesOf)).filter((c) => !shown.includes(c));
      return lacking.length
        ? [{ level, rule: 'credit' as const, where: lang === 'ja' ? course.id : `${course.id}（${lang}）`, message: `講座のページのクレジットに ${lacking.join('・')} が無い（講座の sourceNote に「ボケの声は VOICEVOX:ずんだもん」のように書く）` }]
        : [];
    }),
  );

/**
 * 公開した動画（講座ごとの動画の一覧の entries）が、今の台本で書き出したものか。項目の inputs（書き出したときの指紋）と、
 * 今の台本・描き方の指紋（scripts/stages/video/inputs.ts）を比べる。
 *   誤り: 書き出したあとで、台本の側（動画が描く台本の項目・テーマの値・声のクレジット・timeline）が変わった（動画が古い）
 *   注意: 描き方の側（src・engine・依存の版など）だけが変わった（見た目が変わる直しなら、書き出し直す。一覧のファイルごとに 1 件）
 *   知らせ: inputs の無い項目（記録より前に置いた動画。次の media push で記録する。全部で 1 行。失敗にも注意にもしない）
 * timeline の無い動画は比べない（timeline の確かめが、別に止める）
 */
export const mediaInputProblems = (checks: readonly PublishedCheck[]): { issues: PublishIssue[]; notices: string[] } => {
  const issues: PublishIssue[] = [];
  const byVideo = new Map<string, PublishedCheck[]>();
  for (const c of checks.filter((x) => x.result === 'script')) byVideo.set(c.video.key, [...(byVideo.get(c.video.key) ?? []), c]);
  for (const [key, list] of byVideo) {
    const { course, lang } = list[0].video;
    const kinds = list.map((c) => (c.kind === 'captioned' ? '字幕版' : '通常版')).join('・');
    issues.push({
      level: 'error',
      rule: 'inputs',
      where: `${course.id}/${key}`,
      message: `公開した動画（${kinds}）が台本より古い。書き出したあとで、動画が描く台本（画面の文・場面・テーマ・timeline など）が変わった（npm run chalk -- build --to render --video ${key} で書き出し直し、media push --course ${course.id}${lang === 'ja' ? '' : ` --lang ${lang}`}）`,
    });
  }
  const byFile = new Map<string, string[]>();
  for (const c of checks.filter((x) => x.result === 'src')) byFile.set(c.file, [...new Set([...(byFile.get(c.file) ?? []), c.video.key])]);
  for (const [file, keys] of byFile)
    issues.push({
      level: 'warning',
      rule: 'inputs',
      where: file,
      message: `書き出したあとで、描き方のコード（src・engine・依存の版など）だけが変わった動画が ${keys.length} 本（${keys.join(' ')}）。見た目が変わる直しなら、書き出し直して media push`,
    });
  const none = checks.filter((x) => x.result === 'none');
  const notices = none.length
    ? [
        `動画の一覧に、書き出しの記録（inputs）の無い動画が ${none.length} 本（${new Set(none.map((c) => c.file)).size} 個の一覧）。台本と比べられないので、次の media push で記録する`,
      ]
    : [];
  return { issues, notices };
};

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** 公開で止まること（講座サイトの設定・ID・リンク、教材の ID と参照、公開する言語のポスターと動画の一覧、講座のページの声のクレジット）。courses は日本語の講座 */
export const publishIssues = (courses: Course[], coursesIn: (lang: Lang) => Course[]): PublishIssue[] => {
  const out: PublishIssue[] = [];
  const fail = (rule: PublishIssue['rule'], where: string, message: string) => out.push({ level: 'error', rule, where, message });
  let config: SiteConfig;
  try {
    config = readSiteConfig();
  } catch (e) {
    fail('site', 'site/config.json', messageOf(e));
    return out;
  }
  for (const message of siteProblems(config, coursesIn)) fail('site', '講座サイト', message);
  for (const c of courses.filter((x) => x.syllabus)) for (const message of materialProblems(c)) fail('material', c.id, message);
  out.push(...posterProblems(config, coursesIn), ...creditProblems(coursesIn));
  try {
    out.push(...mediaProblems(config, coursesIn, readMediaLists(courses.map((c) => c.id))));
  } catch (e) {
    fail('media', 'content/<講座>/generated/media.<言語>.json', messageOf(e));
  }
  return out;
};

/* ───────────── 講座の登録 ───────────── */

/**
 * 講座のフォルダ（content/<講座 ID>/index.ts）と、登録表（content/courses.ts の COURSES）が合うか。フォルダの名前は講座 ID にする
 * （生成物の置き場所 content/<講座 ID>/generated/ にも使う）。dirs は index.ts のある講座のフォルダの名前（渡さなければ content/ を見る）
 */
export const registryProblems = (courses: readonly Course[], dirs = courseDirs()): Issue[] => {
  const ids = courses.map((c) => c.id);
  return [
    ...dirs
      .filter((d) => !ids.includes(d))
      .map((d): Issue => ({ level: 'error', rule: 'course-id', where: `content/${d}/index.ts`, message: `講座のフォルダがあるのに、content/courses.ts に登録が無い（export { default as … } from './${d}'; の 1 行を足す）` })),
    ...ids
      .filter((id) => !dirs.includes(id))
      .map((id): Issue => ({ level: 'error', rule: 'course-id', where: id, message: `講座のフォルダ content/${id}/（index.ts）が無い。フォルダの名前は講座 ID にする` })),
  ];
};

/** index.ts のある講座のフォルダの名前 */
const courseDirs = (): string[] =>
  readdirSync(path.join(ROOT, 'content'), { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(path.join(ROOT, 'content', d.name, 'index.ts')))
    .map((d) => d.name)
    .sort();

/* ───────────── 全部 ───────────── */

/** 全講座・全言語を検証する。台本の読み込み（訳の重ね方）で止まったときも、誤りとして返す */
export const validateAll = async (): Promise<Report> => {
  const issues: (Issue | PublishIssue)[] = [];
  const notices: string[] = [];
  let courses = 0;
  let videos = 0;
  for (const [id, theme] of Object.entries(THEMES)) {
    issues.push(...validateTheme(theme, `content/themes.ts ${id}`));
    if (theme.id !== id) issues.push({ level: 'error', rule: 'theme', where: `content/themes.ts ${id}`, message: `THEMES のキー（${id}）とテーマの id（${theme.id}）が違う` });
  }
  try {
    const { COURSES, coursesIn, VIDEOS } = await import('../content');
    // timeline は動画ごとのファイル（content/<講座>/generated/timeline/<key>.json）。指紋で、台本を直したのに合成し直していない動画も見つける
    const timelines = readTimelinesByKey();
    // 講座をまたいだもの（頭文字・並び・講座 ID の重なり）。並行の PR が講座を足すと、マージするまで気づけない
    issues.push(...validateCourses(COURSES), ...registryProblems(COURSES));
    const keys = new Set<string>();
    for (const lang of LANGS) {
      for (const course of coursesIn(lang)) {
        courses++;
        issues.push(...validateCourse(course));
        for (const lec of course.lectures) {
          videos++;
          const key = videoKey(lec.id, lang);
          keys.add(key);
          issues.push(...validateTimelineFiles(lec, course, timelines.get(key) ?? []));
        }
      }
    }
    // 台本に無い動画の timeline（消した動画・名前を変えた動画）。Studio には出ないが、残しておくと紛らわしい
    for (const [key, entries] of timelines) {
      if (keys.has(key)) continue;
      for (const e of entries) issues.push({ level: 'warning', rule: 'timeline', where: e.file, message: '台本に無い動画の timeline（消した動画なら bun scripts/synth.ts --prune で消す）' });
    }
    issues.push(...publishIssues(COURSES, coursesIn));
    // 公開した動画が、今の台本で書き出したものか（動画の一覧の inputs）。一覧が読めないときは、publishIssues が動画の一覧の誤りで止める
    try {
      const found = mediaInputProblems(publishedChecks(ROOT, VIDEOS, srcDigest(ROOT, fileHasher(ROOT, null))));
      issues.push(...found.issues);
      notices.push(...found.notices);
    } catch (e) {
      if (!issues.some((x) => x.rule === 'media' && x.level === 'error'))
        issues.push({ level: 'error', rule: 'inputs', where: 'content/<講座>/generated/media.<言語>.json', message: messageOf(e) });
    }
  } catch (e) {
    // 台本の読み込みで止まったとき（訳の重ね方の誤りは止まらずに、その動画の誤りになる。content/i18n.ts の l10nProblems）
    issues.push({ level: 'error', rule: 'scenes', where: 'content/（読み込み）', message: messageOf(e) });
  }
  const errors = issues.filter((x) => x.level === 'error').length;
  return { ok: errors === 0, errors, warnings: issues.length - errors, courses, videos, themes: Object.keys(THEMES).length, issues, notices };
};

/** 種類の名前（台本の検証と、公開で止まること） */
const LABELS: Record<Rule | PublishIssue['rule'], string> = { ...RULES, ...PUBLISH_RULES };

/** 注意の内訳（種類ごとの数） */
const breakdown = (issues: (Issue | PublishIssue)[]) => {
  const n = new Map<string, number>();
  for (const x of issues) n.set(LABELS[x.rule], (n.get(LABELS[x.rule]) ?? 0) + 1);
  return [...n].map(([k, v]) => `${k} ${v}`).join('・');
};

const main = async (argv: string[]) => {
  const { values } = readArgs(argv, { json: { type: 'boolean' }, warnings: { type: 'boolean' } });
  if (values.help) return showHelp(import.meta.filename);
  const report = await validateAll();
  if (values.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const errors = report.issues.filter((x) => x.level === 'error');
    const warnings = report.issues.filter((x) => x.level === 'warning');
    const shown = values.warnings ? [...errors, ...warnings] : errors;
    // 表示に使うのは level・where・message だけ（rule の種類は問わない）
    if (shown.length) console.log(formatIssues(shown as Issue[]));
    console.log(
      `台本と公開の検証: 誤り ${report.errors} 件・注意 ${report.warnings} 件（${report.courses} 講座・${report.videos} 本の動画・${report.themes} テーマ。訳の講座も数える）`,
    );
    if (warnings.length) console.log(`注意の内訳: ${breakdown(warnings)}${values.warnings ? '' : '（一覧は --warnings）'}`);
    // 知らせ（失敗にも注意にもしない）。GitHub Actions では注釈にする
    for (const n of report.notices) console.log(process.env.GITHUB_ACTIONS === 'true' ? `::notice::${n}` : `知らせ: ${n}`);
  }
  return report.ok ? 0 : 1;
};

if (import.meta.main) await runMain(main);
