// 講座サイトを組み立てる。GitHub Pages にそのまま置ける静的なファイルを site/dist に書く。
//   bun scripts/build_site.ts                  # 全講座（全部の言語）と一覧ページ
//   bun scripts/build_site.ts stripe-billing   # 一部の講座だけ（一覧ページは毎回作る）
//   bun scripts/build_site.ts --strict         # 動画かポスターが無いレクチャーがあれば止める（deploy_pages.sh が使う）
//   SITE_LANGS=ja bun scripts/build_site.ts    # その言語だけのサイトにする（訳の動画のサイトがまだ無いときに、日本語だけ出す）
// 入力: content/（台本・訳・テーマ）、site/data/<key>.json（synth.ts の出力）、site/media/<key>.mp4|jpg（render.sh の出力）、
//       site/template.html（講座のページ）、site/home.html（一覧のページ）、site/i18n.ts（サイトの決まった文字）、site/assets/、site/config.json
// 出力: site/dist/index.html と site/dist/<講座>/（日本語）、site/dist/<言語>/ と site/dist/<言語>/<講座>/（訳）、
//       site/dist-media/<言語>/<講座>/（訳の動画とポスター。config.json の media のサイトに出す）
// 動画は、日本語は講座の media/ に置く。訳は、同じ origin の別の GitHub Pages のサイト（config.json の media）に置く
// （Pages は 1 サイト 1GB まで。同じ origin なので、オフライン保存と途中への移動（Range）はそのまま動く）。
// 色・書体・背景の飾りは講座のテーマ（content/themes.ts）から作る。一覧ページは既定のテーマ（Chalkfile）
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, linkSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { COURSES, coursesIn } from '../content';
import { isLang, LANG_INFO, LANGS, videoKey, type Lang } from '../content/i18n';
import { THEMES, themeOf } from '../content/themes';
import type { ChapterMaterial, Course, Source, VoiceId } from '../content/types';
import { fill, SITE_TEXT, THEME_SUMMARY, type SiteText } from '../site/i18n';
import { fontLink, themeCss } from './site_theme';
import { asset, buildPwa, bundle, hash } from './pwa';
import { creditsIn } from './voices';
import type { Asset, CourseManifest } from '../site/offline-shared';

const ROOT = path.resolve(import.meta.dir, '..');
const SITE = path.join(ROOT, 'site');
const DIST = path.join(SITE, 'dist');
const DIST_MEDIA = path.join(SITE, 'dist-media');
const MEDIA = path.join(SITE, 'media');
const ASSETS = path.join(SITE, 'assets');

/** media: 訳の言語の動画を置くサイト（url はサイトの URL、repo は gh-pages を置くリポジトリ） */
type Config = { series: string; seriesSub: string; baseUrl: string; repoUrl: string; publishLangs: Lang[]; media?: Partial<Record<Lang, { url: string; repo: string }>> };
const config = JSON.parse(readFileSync(path.join(SITE, 'config.json'), 'utf8')) as Config;
const base = config.baseUrl.endsWith('/') ? config.baseUrl : `${config.baseUrl}/`;
/** サイトに出す言語（既定は全部）。SITE_LANGS=ja のように絞ると、外した言語のページ・切り替え・動画のサイトを作らない */
const SITE_LANGS: Lang[] = (() => {
  const v = process.env.SITE_LANGS?.trim() || config.publishLangs.join(',');
  if (!v) return [...LANGS];
  const ls = v.split(',').map((x) => x.trim());
  for (const l of ls) if (!isLang(l)) throw new Error(`SITE_LANGS は ${LANGS.join(',')} から選ぶ: ${l}`);
  for (const l of ls) if (!config.publishLangs.includes(l as Lang)) throw new Error(`未公開の言語はビルドしない: ${l}`);
  if (!ls.includes('ja')) throw new Error('SITE_LANGS には ja（一覧と日本語の講座）を入れる');
  return LANGS.filter((l) => ls.includes(l));
})();
/** 訳の言語の動画のサイトのパス（/chalkfile-media-en/ など。サイトと同じ origin なので、パスだけで指せる） */
const mediaRoot = (lang: Lang): string | null => {
  const m = lang === 'ja' ? undefined : config.media?.[lang];
  return m ? new URL(m.url.endsWith('/') ? m.url : `${m.url}/`).pathname : null;
};

type SiteData = {
  duration: number;
  chapters: { scene: number; start: number; heading: string; kind: string }[];
  cues: { start: number; end: number; text: string; scene: number }[];
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const plain = (s: string) => s.replace(/\*\*/g, '');
/** テンプレートの {{key}} を、その言語の決まった文字（エスケープ済み）にする */
const fillText = (html: string, T: SiteText) => html.replace(/\{\{(\w+)\}\}/g, (m, k: string) => (k in T ? esc(T[k as keyof SiteText]) : m));

const credits = JSON.parse(readFileSync(path.join(ROOT, 'src/generated/credits.json'), 'utf8')) as string[];
const template = readFileSync(path.join(SITE, 'template.html'), 'utf8');
const home = readFileSync(path.join(SITE, 'home.html'), 'utf8');
const offlinePanel = readFileSync(path.join(SITE, 'offline-panel.html'), 'utf8');
const offlineCss = readFileSync(path.join(SITE, 'offline.css'), 'utf8');
const offlineClient = await bundle(path.join(SITE, 'offline-client.ts'));
const generatedManifests: CourseManifest[] = [];
const shellAssets: Asset[] = [];
/** ページの言語の、保存機能の画面（offline-client.ts）に渡す文字 */
const LOCALE: Record<Lang, string> = { ja: 'ja-JP', en: 'en-US', zh: 'zh-CN' };
const appParts = (lang: Lang, root: string, course?: { id: string; title: string; pageVersion: string }) => ({
  head: `<link rel="manifest" href="${root}manifest.webmanifest"><link rel="apple-touch-icon" href="${root}icons/icon-180.png"><meta name="theme-color" content="${themeOf().color.bg}"><meta name="apple-mobile-web-app-capable" content="yes">`,
  panel: fillText(offlinePanel.replace('__COURSE_HIDDEN__', course ? '' : 'hidden').replace('__LIBRARY_OPEN__', course ? '' : 'open'), SITE_TEXT[lang]),
  script: `<script id="pwa-data" type="application/json">${JSON.stringify({
    root,
    course,
    courses: coursesIn(lang).map((c) => ({ id: `${LANG_INFO[lang].path}${c.id}`, title: c.title })),
    lang,
    locale: LOCALE[lang],
    text: SITE_TEXT[lang],
  }).replace(/</g, '\\u003c')}</script><script>${offlineClient}</script>`,
});

const favicon = (ink: string, accent: string) =>
  'data:image/svg+xml,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x="3" y="7" width="26" height="18" rx="5" fill="${ink}"/><rect x="3" y="20" width="26" height="5" rx="2" fill="${accent}"/></svg>`);

const OG_LOCALE: Record<Lang, string> = { ja: 'ja_JP', en: 'en_US', zh: 'zh_CN' };
// 検索と SNS の共有で使う <head> の中身。alternates は、同じページのほかの言語（hreflang）
const headMeta = (o: { title: string; description: string; url: string; image?: string; icon: string; lang: Lang; alternates: { lang: Lang; url: string }[] }) =>
  [
    `<meta name="description" content="${esc(o.description)}">`,
    `<link rel="canonical" href="${esc(o.url)}">`,
    ...o.alternates.map((a) => `<link rel="alternate" hreflang="${LANG_INFO[a.lang].html}" href="${esc(a.url)}">`),
    ...o.alternates.filter((a) => a.lang === 'ja').map((a) => `<link rel="alternate" hreflang="x-default" href="${esc(a.url)}">`),
    `<link rel="icon" href="${o.icon}">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:site_name" content="${esc(config.series)}">`,
    `<meta property="og:title" content="${esc(o.title)}">`,
    `<meta property="og:description" content="${esc(o.description)}">`,
    `<meta property="og:url" content="${esc(o.url)}">`,
    `<meta property="og:locale" content="${OG_LOCALE[o.lang]}">`,
    o.image ? `<meta property="og:image" content="${esc(o.image)}">` : '',
    `<meta name="twitter:card" content="${o.image ? 'summary_large_image' : 'summary'}">`,
  ]
    .filter(Boolean)
    .join('\n');

/** 言語の切り替え（今の言語に aria-current）。courseId があれば、その講座の訳へ。訳が無い言語は、その言語の一覧へ */
const langNav = (lang: Lang, root: string, label: string, courseId?: string) => {
  if (SITE_LANGS.length < 2) return '';
  return `<nav class="langs" aria-label="${esc(label)}">${SITE_LANGS.map((l) => {
    const has = courseId && coursesIn(l).some((c) => c.id === courseId);
    const href = `${root}${LANG_INFO[l].path}${has ? `${courseId}/` : ''}`;
    return `<a href="${esc(href)}" hreflang="${LANG_INFO[l].html}" lang="${LANG_INFO[l].html}"${l === lang ? ' aria-current="page"' : ''}>${esc(LANG_INFO[l].label)}</a>`;
  }).join('')}</nav>`;
};

// 同じディスクならハードリンク（容量を食わない）、だめならコピー
const place = (from: string, to: string) => {
  try {
    linkSync(from, to);
  } catch {
    copyFileSync(from, to);
  }
};

/** 教材の出典の id を、サイトに出す形（発行元・年・URL）に開く */
const materialForSite = (course: Course, m: ChapterMaterial) => {
  const src = new Map((course.sources ?? []).map((x) => [x.id, x]));
  const pick = (ids: string[] | undefined) =>
    (ids ?? []).map((id) => {
      const x = src.get(id);
      if (!x) throw new Error(`${course.id} ${m.id}: 出典が sources に無い: ${id}`);
      return { publisher: x.publisher, year: x.year, title: x.title, url: x.url, kind: x.kind, checked: x.checked } satisfies Omit<Source, 'id' | 'note'>;
    });
  return {
    id: m.id,
    goals: m.goals,
    prerequisites: m.prerequisites,
    sections: m.sections.map((x) => ({ id: x.id, title: x.title, body: x.body, evidence: x.evidence, sources: pick(x.sources) })),
    figures: m.figures,
    exercise: m.exercise,
    summary: m.summary,
    askExamples: m.askExamples,
  };
};

const readData = (key: string): SiteData | null => {
  const f = path.join(SITE, 'data', `${key}.json`);
  return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as SiteData) : null;
};
const minutesOf = (course: Course, lang: Lang) => course.lectures.reduce((a, l) => a + (readData(videoKey(l.id, lang))?.duration ?? 0), 0) / 60;

/* ───────────── 安全のための確かめ ─────────────
 * ID は URL とファイル名に使うので英数字だけ。リンクは https:// だけ（javascript: などを通さない）。
 * 台本の中身の確かめ（注入・隠し文字・秘密情報）は scripts/check_content.ts が受け持つ。
 */
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const HTTPS = /^https:\/\/[^\s"'<>`]+$/;
const problems: string[] = [];
if (!HTTPS.test(config.baseUrl) || !HTTPS.test(config.repoUrl)) problems.push('site/config.json の baseUrl と repoUrl は https:// で書く');
for (const [lang, m] of Object.entries(config.media ?? {})) {
  if (!m || !HTTPS.test(m.url) || !HTTPS.test(m.repo)) problems.push(`site/config.json の media.${lang} の url と repo は https:// で書く`);
  // 動画のサイトは講座サイトと同じ origin（Service Worker が中身を確かめて保存でき、Range もそのまま動く）
  else if (new URL(m.url).origin !== new URL(base).origin) problems.push(`site/config.json の media.${lang}.url は baseUrl と同じ origin にする: ${m.url}`);
  else {
    // 講座サイトを含むパスに置くと、ページと動画の区別（Service Worker）が崩れる。講座サイトの下に置くとき（chalkfile.com/media/ など）は、
    // 頭のフォルダの名前を、講座 ID・言語のフォルダと重ねない
    const mp = mediaRoot(lang as Lang)!;
    const bp = new URL(base).pathname;
    const head = mp.startsWith(bp) ? mp.slice(bp.length).split('/')[0] : '';
    if (bp.startsWith(mp) || COURSES.some((c) => c.id === head) || LANGS.some((l) => LANG_INFO[l].path === `${head}/`)) {
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
  }
for (const t of Object.values(THEMES)) if (!ID.test(t.id)) problems.push(`テーマ ID が英数字でない: ${t.id}`);
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

/** ページの中のスクリプト（<script> だけのもの）のハッシュで CSP を作る。ほかのスクリプトは動かない */
const csp = (html: string) => {
  const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`);
  const policy = [
    "default-src 'self'",
    `script-src ${hashes.length ? hashes.join(' ') : "'none'"}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    'font-src https://fonts.gstatic.com',
    "img-src 'self' data:",
    "media-src 'self' blob:",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
  return html.replace('__CSP__', () => `<meta http-equiv="Content-Security-Policy" content="${policy}">`);
};

const strict = process.argv.includes('--strict');
const wanted = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const missing: string[] = [];

/** 講座の動画で使った声のクレジット。日本語は全講座で共通（講師と呼び込み。ほかの声は講座の sourceNote） */
const courseCredits = (course: Course, lang: Lang): string[] =>
  lang === 'ja' ? credits : creditsIn(lang, course.lectures.flatMap((l) => l.scenes.flatMap((s) => s.lines.map((ln) => (ln.v ?? 'narrator') as VoiceId))));

// 訳の言語の、前に作ったページと動画のサイトを消す（site/dist と site/dist-media は丸ごと公開するので、残っていると出てしまう）。
// 外した言語（SITE_LANGS）は消すだけ。全部の講座を作るときは作り直す（訳をやめた講座を残さない）
for (const l of LANGS) {
  if (!LANG_INFO[l].path || (SITE_LANGS.includes(l) && wanted.length)) continue;
  rmSync(path.join(DIST, LANG_INFO[l].path), { recursive: true, force: true });
  rmSync(path.join(DIST_MEDIA, l), { recursive: true, force: true });
}

for (const lang of SITE_LANGS) {
  const T = SITE_TEXT[lang];
  const info = LANG_INFO[lang];
  // ページから見たサイトの最上位（日本語の講座は ../、訳の講座は ../../）
  const root = lang === 'ja' ? '../' : '../../';
  const mRoot = mediaRoot(lang);
  for (const course of coursesIn(lang).filter((c) => !wanted.length || wanted.includes(c.id))) {
    const theme = themeOf(course.theme);
    const cid = `${info.path}${course.id}`;
    const lectures = course.lectures.map((lec) => {
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
    const minutes = minutesOf(course, lang);
    const links = [...(course.links ?? []), { label: T.repoLink, url: config.repoUrl }];
    // 計画だけある章（まだ動画が無い）は、カリキュラムに「準備中」で出す
    const made = new Set(course.lectures.map((l) => l.id));
    const planned = (course.syllabus?.chapters ?? []).filter((ch) => !made.has(ch.lectureId)).map((ch) => ({ no: ch.no, section: ch.section, title: ch.title, minutes: ch.minutes }));
    const meta = {
      id: course.id,
      title: course.title,
      subtitle: course.subtitle,
      sections: course.sections,
      sourceNote: course.sourceNote,
      disclaimer: course.disclaimer ?? '',
      links,
      unitLabel: course.unitLabel ?? 'LECTURE',
      ui: course.ui ?? {},
      planned,
    };
    const mediaFiles: { file: string; data: Buffer; type: string }[] = [];
    for (const lec of lectures) for (const ext of ['mp4', 'jpg']) {
      const file = `${lec.key}.${ext}`;
      const from = path.join(MEDIA, file);
      if (existsSync(from)) mediaFiles.push({ file, data: readFileSync(from), type: ext === 'mp4' ? 'video/mp4' : 'image/jpeg' });
      else missing.push(file);
    }
    // 字幕を焼き込んだ版（render.sh の CAPTIONS=1 が書く <key>.cc.mp4）。あるレクチャーは、字幕オンのときにこちらを流す（全画面でも字幕が見える）
    const withCc = new Set(lectures.filter((lec) => existsSync(path.join(MEDIA, `${lec.key}.cc.mp4`))).map((lec) => lec.key));
    for (const key of withCc) mediaFiles.push({ file: `${key}.cc.mp4`, data: readFileSync(path.join(MEDIA, `${key}.cc.mp4`)), type: 'video/mp4' });
    // 動画の場所。日本語（と動画のサイトが無い言語）は講座の media/、訳の言語は動画のサイトの <講座>/（同じ origin のパス）
    const mediaUrl = mRoot ? `${mRoot}${course.id}/` : 'media/';
    const manifestMedia = mRoot ? `${mRoot}${course.id}/` : `${cid}/media/`;
    const courseCreditsList = courseCredits(course, lang);
    // 版は教材・表示・動画の全入力で決まる。保存した HTML と MP4 を別の版に混ぜない。
    const pageVersion = hash(JSON.stringify({ lang, meta, credits: courseCreditsList, lectures, theme, template, offlinePanel, offlineCss, offlineClient, text: T,
      builder: readFileSync(import.meta.path, 'utf8'), media: mediaFiles.map((f) => [f.file, hash(f.data)]), mediaUrl }));
    const json = JSON.stringify({ course: meta, credits: courseCreditsList, pageVersion, lang: { code: lang, html: info.html, label: info.label }, text: T,
      lectures: lectures.map(({ key, ...lec }) => ({ ...lec,
        video: `${mediaUrl}${key}.mp4?v=${pageVersion}`, poster: `${mediaUrl}${key}.jpg?v=${pageVersion}`,
        videoCc: withCc.has(key) ? `${mediaUrl}${key}.cc.mp4?v=${pageVersion}` : '',
      })) }).replace(/</g, '\\u003c');
    const app = appParts(lang, root, { id: cid, title: course.title, pageVersion });
    const url = `${base}${cid}/`;
    const firstPoster = mRoot ? `${new URL(base).origin}${mRoot}${course.id}/${lectures[0].key}.jpg` : `${url}media/${lectures[0].key}.jpg`;
    const html = fillText(template, T)
      .replace('__LANG__', () => info.html)
      .replace('__HOME__', () => '../')
      .replace('__LANG_NAV__', () => langNav(lang, root, T.langNav, course.id))
      .replace('__EV_HINT_TAIL__', () => esc(T.evHintTail).replace('{id}', '<span class="mono">xx-01-s01</span>'))
      .replace('__NOTE_AT_ZERO__', () => esc(fill(T.noteAt, { t: '00:00' })))
      .replace('__PWA_HEAD__', () => app.head)
      .replace('__OFFLINE_CSS__', () => offlineCss)
      .replace('__OFFLINE_PANEL__', () => app.panel)
      .replace('__PWA_SCRIPT__', () => app.script)
      .replace('__TITLE__', () => esc(fill(T.pageTitle, { course: course.title, series: config.series })))
      .replace('__HEAD_META__', () =>
        headMeta({
          title: course.title,
          description: fill(T.metaCourse, { headline: plain(course.headline), n: lectures.length, min: Math.round(minutes), extra: lectures.some((l) => l.material) ? T.metaExtra : '' }),
          url,
          image: firstPoster,
          icon: favicon(theme.color.ink, theme.color.accent),
          lang,
          alternates: SITE_LANGS.filter((l) => coursesIn(l).some((c) => c.id === course.id)).map((l) => ({ lang: l, url: `${base}${LANG_INFO[l].path}${course.id}/` })),
        }),
      )
      .replace('__FONT_LINK__', () => fontLink(theme, lang))
      .replace('__THEME_CSS__', () => themeCss(theme, lang))
      .replace('__SERIES__', () => esc(config.series))
      .replace('__BRAND_SUB__', () => esc(course.title))
      .replace('__HEADLINE__', () => esc(plain(course.headline)))
      .replace('__DOCS_NOTE__', () => esc(course.docsNote))
      .replace('__COURSE_JSON__', () => json);
    const out = path.join(DIST, cid);
    mkdirSync(out, { recursive: true });
    const page = Buffer.from(csp(html));
    writeFileSync(path.join(out, 'index.html'), page);
    // 動画とポスターを置く（日本語は講座の media/、訳の言語は動画のサイトの <講座>/）
    const mediaOut = mRoot ? path.join(DIST_MEDIA, lang, course.id) : path.join(out, 'media');
    rmSync(mediaOut, { recursive: true, force: true });
    mkdirSync(mediaOut, { recursive: true });
    for (const f of mediaFiles) place(path.join(MEDIA, f.file), path.join(mediaOut, f.file));
    // 一部だけの公開・欠けた生成物を「全講座保存」として案内しない。
    const manifestPath = path.join(out, 'offline-manifest.json');
    rmSync(manifestPath, { force: true });
    if (mediaFiles.length === lectures.length * 2 + withCc.size) {
      const files = [asset(`${cid}/`, page, 'text/html'), ...mediaFiles.map((f) => asset(`${manifestMedia}${f.file}?v=${pageVersion}`, f.data, f.type))];
      const manifest: CourseManifest = { schema: 1, id: cid, title: course.title, pageVersion, revision: hash(JSON.stringify(files)),
        bytes: files.reduce((sum, f) => sum + f.bytes, 0), files };
      generatedManifests.push(manifest);
      writeFileSync(manifestPath, JSON.stringify(manifest));
    }
    console.log(`site/dist/${cid}/index.html ${(html.length / 1024).toFixed(0)} KB  ${lectures.length} レクチャー  合計 ${minutes.toFixed(1)} 分  テーマ ${theme.id}${mRoot ? `  動画 ${mRoot}` : ''}`);
  }
}

/* ───────────── 一覧のページ（言語ごと） ───────────── */

const brand = themeOf();
const S = brand.syntax;

// 最初の画面に出す、本物の台本の抜き出し（長い行は 3 つ目の項目までで切る）
const heroFile = 'content/stripe-billing/L02.ts';
const heroLines = (() => {
  const src = readFileSync(path.join(ROOT, heroFile), 'utf8').split('\n');
  const at = src.findIndex((l) => l.includes("kind: 'concepts'"));
  return src.slice(at - 1, at + 8).map((l) => {
    const t = l.replace(/^ {4}/, '');
    if (t.length <= 56) return t;
    const parts = t.split(', ');
    return `${parts.slice(0, 3).join(', ')}, … },`;
  });
})();
// 文字列・キー・数・省略記号を 1 回の走査で塗る（塗った span の中をもう一度塗らない）
const highlightTs = (line: string) =>
  esc(line).replace(/('[^']*')|\b([a-z][A-Za-z]*)(?=:)|\b(\d+)\b|(…)/g, (m, str, key, num) =>
    `<span style="color:${str ? S.string : key ? S.fn : num ? S.number : S.comment}">${m}</span>`,
  );

/** 講座のカード。href・画像はその一覧ページからの場所。tags は事実の札に足すもの（言語など） */
const courseCard = (c: Course, lang: Lang, o: { href: string; poster: string; tags: string[] }) => {
  const T = SITE_TEXT[lang];
  const t = themeOf(c.theme);
  const minutes = minutesOf(c, (c.lang ?? 'ja') as Lang);
  const style = `--card-grad: linear-gradient(100deg, ${t.gradient.join(', ')}); --card-soft: ${t.color.surface2}; --card-ink: ${t.tones.violet}`;
  const count = c.unitLabel === 'CHAPTER' ? `${fill(T.cardChapters, { n: c.lectures.length })}${c.syllabus ? fill(T.cardPlanned, { n: c.syllabus.chapters.length }) : ''}` : fill(T.cardLectures, { n: c.lectures.length });
  return [
    `<a class="course" href="${esc(o.href)}" style="${esc(style)}"${c.lang && c.lang !== lang ? ` lang="${LANG_INFO[c.lang].html}"` : !c.lang && lang !== 'ja' ? ' lang="ja"' : ''}>`,
    `  <div class="poster"><img src="${esc(o.poster)}" alt="" width="1280" height="720" loading="lazy"></div>`,
    '  <div class="body">',
    `    <h3>${esc(c.title)}</h3>`,
    `    <p>${esc(plain(c.headline))}</p>`,
    `    <ul class="facts"><li>${esc(count)}</li><li>${esc(fill(T.cardMinutes, { min: Math.round(minutes) }))}</li><li class="is-theme">${esc(fill(T.cardTheme, { theme: t.label }))}</li>${o.tags.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>`,
    `    <span class="go">${esc(T.cardOpen)}</span>`,
    '  </div>',
    '</a>',
  ].join('\n');
};

/** 一覧ページから見た、講座の最初の動画のポスター */
const posterOf = (c: Course, lang: Lang, root: string) => {
  const l = (c.lang ?? 'ja') as Lang;
  const key = videoKey(c.lectures[0].id, l);
  const m = mediaRoot(l);
  return m ? `${m}${c.id}/${key}.jpg` : `${root}${LANG_INFO[l].path}${c.id}/media/${key}.jpg`;
};

mkdirSync(DIST, { recursive: true });
for (const lang of SITE_LANGS) {
  const T = SITE_TEXT[lang];
  const info = LANG_INFO[lang];
  // 一覧ページから見たサイトの最上位（日本語は ./、訳は ../）
  const root = lang === 'ja' ? './' : '../';
  const courses = coursesIn(lang);
  const cards = courses
    .map((c) => {
      // 日本語の一覧では、訳のある講座に言語の札を付ける
      const tags = lang === 'ja' ? SITE_LANGS.filter((l) => l !== 'ja' && coursesIn(l).some((x) => x.id === c.id)).map((l) => LANG_INFO[l].label) : [];
      return courseCard(c, lang, { href: `${c.id}/`, poster: posterOf(c, lang, root), tags: tags.length ? [tags.join('・')] : [] });
    })
    .join('\n');
  // 訳の一覧では、まだ訳していない講座を「日本語だけ」として並べる
  const others = lang === 'ja' ? [] : COURSES.filter((c) => !courses.some((x) => x.id === c.id));
  const otherSection = others.length
    ? [
        '    <section id="more-courses" aria-labelledby="more-title">',
        `      <h2 id="more-title">${esc(T.homeOtherTitle)}</h2>`,
        `      <p class="lede">${esc(T.homeOtherLede)}</p>`,
        '      <div class="courses">',
        others.map((c) => courseCard(c, lang, { href: `${root}${c.id}/`, poster: posterOf(c, lang, root), tags: [T.cardLang] })).join('\n'),
        '      </div>',
        '    </section>',
      ].join('\n')
    : '';
  const themeCards = Object.values(THEMES)
    .map((t) => {
      const img = `assets/themes/${t.id}.jpg`;
      const sw = [t.color.bg, t.color.ink, t.color.accent, t.tones.pink, t.tones.cyan, t.tones.mint];
      const summary = lang === 'ja' ? t.summary : (THEME_SUMMARY[lang][t.id] ?? t.summary);
      return [
        '<article class="theme">',
        existsSync(path.join(SITE, img)) ? `  <img src="${root}${img}" alt="${esc(fill(T.themeAlt, { theme: t.label }))}" width="960" height="540" loading="lazy">` : '',
        '  <div class="body">',
        `    <h3>${esc(t.label)} <code>theme: '${esc(t.id)}'</code></h3>`,
        `    <div class="swatches" aria-hidden="true">${sw.map((c) => `<span style="background:${c}"></span>`).join('')}</div>`,
        `    <p>${esc(summary)}</p>`,
        '  </div>',
        '</article>',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');
  const app = appParts(lang, root);
  const url = `${base}${info.path}`;
  const homeHtml = fillText(home, T)
    .replace('__LANG__', () => info.html)
    .replace('__LANG_NAV__', () => langNav(lang, root, T.langNav))
    .replace('__PWA_HEAD__', () => app.head)
    .replace('__OFFLINE_CSS__', () => offlineCss)
    .replace('__OFFLINE_PANEL__', () => app.panel)
    .replace('__PWA_SCRIPT__', () => app.script)
    .replace('__TITLE__', () => esc(fill(T.homeDocTitle, { series: config.series })))
    .replace('__HEAD_META__', () =>
      headMeta({
        title: config.series,
        description: lang === 'ja' ? config.seriesSub : T.homeDesc,
        url,
        image: `${base}assets/hero.jpg`,
        icon: favicon(brand.color.ink, brand.color.accent),
        lang,
        alternates: SITE_LANGS.map((l) => ({ lang: l, url: `${base}${LANG_INFO[l].path}` })),
      }),
    )
    .replace('__FONT_LINK__', () => fontLink(brand, lang))
    .replace('__THEME_CSS__', () => themeCss(brand, lang))
    .replaceAll('__SERIES__', () => esc(config.series))
    .replace('__FIRST_COURSE__', () => (courses[0] ? `${courses[0].id}/` : `${root}${COURSES[0].id}/`))
    .replace('__HERO_FILE__', () => esc(heroFile))
    .replace('__HERO_CODE__', () => heroLines.map(highlightTs).join('\n'))
    .replace('__HERO_IMAGE__', () => `${root}assets/hero.jpg`)
    .replace('__COURSES__', () => cards)
    .replace('__OTHER_COURSES__', () => otherSection)
    .replace('__THEMES__', () => themeCards)
    .replaceAll('__REPO__', () => esc(config.repoUrl))
    .replace('__CREDITS__', () => esc(fill(T.homeCredits, { voices: (lang === 'ja' ? credits : courseCreditsAll(lang)).join(T.creditsSep) })));
  const dir = path.join(DIST, info.path);
  mkdirSync(dir, { recursive: true });
  const homePage = Buffer.from(csp(homeHtml));
  writeFileSync(path.join(dir, 'index.html'), homePage);
  shellAssets.push(asset(info.path || './', homePage, 'text/html'));
}

/** その言語の全講座で使った声 */
function courseCreditsAll(lang: Lang): string[] {
  return creditsIn(lang, coursesIn(lang).flatMap((c) => c.lectures.flatMap((l) => l.scenes.flatMap((s) => s.lines.map((ln) => (ln.v ?? 'narrator') as VoiceId)))));
}

// 一覧ページの画像（site/assets）を写す
const copyDir = (from: string, to: string) => {
  mkdirSync(to, { recursive: true });
  for (const e of readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name);
    const b = path.join(to, e.name);
    if (e.isDirectory()) copyDir(a, b);
    else {
      rmSync(b, { force: true });
      place(a, b);
      shellAssets.push(asset(path.relative(DIST, b).split(path.sep).join('/'), readFileSync(b), 'image/jpeg'));
    }
  }
};
// 名前を変えた画像が残らないように、写す前に消す
rmSync(path.join(DIST, 'assets'), { recursive: true, force: true });
if (existsSync(ASSETS)) copyDir(ASSETS, path.join(DIST, 'assets'));
// トップの講座サムネイルも小さな起動用ファイルとして保持。動画は選択した講座だけ取得する。
// 訳の講座のサムネイル（動画のサイトにある）は入れない。起動用ファイルが 1 つでも取れないと Service Worker の install 全体が失敗するので、
// 動画のサイトの反映が講座サイトより遅れたり、Pages が未設定だったりしても、講座サイトの更新が止まらないようにする
for (const c of coursesIn('ja')) {
  const f = posterOf(c, 'ja', '');
  const local = path.join(DIST, f);
  if (existsSync(local)) shellAssets.push(asset(f, readFileSync(local), 'image/jpeg'));
}
const mediaRoots = Object.fromEntries(SITE_LANGS.flatMap((l) => (mediaRoot(l) ? [[l, mediaRoot(l)!]] : [])));
await buildPwa(SITE, DIST, brand, generatedManifests.map((m) => m.id), shellAssets, mediaRoots);
// GitHub Pages に Jekyll を通させない（そのまま配る）
writeFileSync(path.join(DIST, '.nojekyll'), '');
// MP4 とローカル設定は静的 assets に送らない。
writeFileSync(path.join(DIST, '.assetsignore'), '**/*.mp4\n.*\n');
rmSync(path.join(DIST, '_redirects'), { force: true });
writeFileSync(path.join(DIST, '_headers'), '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n/sw.js\n  Cache-Control: no-cache\n');
writeFileSync(path.join(DIST, '404.html'), '<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>教材が見つかりません｜Chalkfile</title><h1>教材が見つかりません</h1><p><a href="/">講座一覧へ</a></p></html>');

/* ───────────── 訳の言語の動画のサイト（site/dist-media/<言語>/） ───────────── */

for (const lang of SITE_LANGS) {
  const m = mediaRoot(lang);
  if (!m) continue;
  const dir = path.join(DIST_MEDIA, lang);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, '.nojekyll'), '');
  const site = `${base}${LANG_INFO[lang].path}`;
  // 動画だけのサイト。人が開いたときのために、講座サイトへの案内だけを置く（スクリプトなし）
  writeFileSync(
    path.join(dir, 'index.html'),
    `<!doctype html>\n<html lang="${LANG_INFO[lang].html}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(config.series)} media (${lang})</title>\n<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">\n<meta name="robots" content="noindex"><style>body { font-family: system-ui,sans-serif; line-height: 1.8; margin: 10vh auto; padding: 24px; max-width: 36em; }</style></head>\n<body><h1>${esc(config.series)} media (${esc(LANG_INFO[lang].label)})</h1><p>This site only hosts the ${esc(LANG_INFO[lang].label)} videos of the ${esc(config.series)} course site. Watch them on the course site.</p><p><a href="${esc(site)}">${esc(site)}</a></p></body></html>\n`,
  );
  writeFileSync(
    path.join(dir, 'README.md'),
    `# ${config.series} media (${lang})\n\n${config.series}（${config.repoUrl}）の講座サイト ${site} の、${LANG_INFO[lang].label} の動画とポスターだけを置く GitHub Pages のサイトです。\n\`scripts/deploy_pages.sh\` が gh-pages を 1 コミットで置き換えます（手で編集しない）。\n\nThis site only hosts the ${LANG_INFO[lang].label} videos of the ${config.series} course site (${site}). The gh-pages branch is replaced on every deploy by \`scripts/deploy_pages.sh\` in ${config.repoUrl}.\n`,
  );
}

const du = (dir: string): number => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).reduce((s, e) => s + (e.isDirectory() ? du(path.join(dir, e.name)) : statSync(path.join(dir, e.name)).size), 0) : 0);
const sizes = [{ name: 'site/dist', bytes: du(DIST) }, ...SITE_LANGS.filter(mediaRoot).map((l) => ({ name: `site/dist-media/${l}`, bytes: du(path.join(DIST_MEDIA, l)) }))];
console.log(`site/dist/ ほか  講座 ${SITE_LANGS.map((l) => `${l} ${coursesIn(l).length}`).join('・')}  テーマ ${Object.keys(THEMES).length} つ  大きさ ${sizes.map((s) => `${s.name} ${(s.bytes / 1e6).toFixed(0)}MB`).join('・')}`);
// GitHub Pages は 1 サイト 1GB まで。超えそうなら公開しない（動画の置き場所を分ける。README の「公開」）
const over = sizes.filter((s) => s.bytes > 950e6);
if (over.length) {
  const msg = `GitHub Pages の上限（1 サイト 1GB）に近い: ${over.map((s) => `${s.name} ${(s.bytes / 1e6).toFixed(0)}MB`).join('・')}`;
  if (strict) {
    console.error(msg);
    process.exit(1);
  }
  console.warn(msg);
}

if (missing.length) {
  const msg = `まだ動画かポスターが無い: ${missing.join(' ')}（bash scripts/render.sh で作る）`;
  if (strict) {
    console.error(msg);
    process.exit(1);
  }
  console.warn(msg);
}
