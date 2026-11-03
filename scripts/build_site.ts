// 講座サイトを組み立てる。GitHub Pages にそのまま置ける静的なファイルを site/dist に書く。
//   bun scripts/build_site.ts                  # 全講座（全部の言語）と一覧ページ
//   bun scripts/build_site.ts stripe-billing   # 一部の講座だけ（一覧ページは毎回作る）
//   bun scripts/build_site.ts --strict         # 動画かポスターが無いレクチャーがあれば止める（deploy_pages.sh が使う）
//   SITE_LANGS=ja bun scripts/build_site.ts    # その言語だけのサイトにする（訳の動画のサイトがまだ無いときに、日本語だけ出す）
// 入力: content/（台本・訳・テーマ）、site/data/<key>.json（synth.ts の出力）、content/<講座>/generated/posters/<key>.jpg（render.sh が書くポスター。
//       無ければ site/media/<key>.jpg）、動画の一覧（講座ごとの content/<講座>/generated/media.<言語>.json。scripts/media.ts の readMediaManifest）、
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
import { posterFile } from '../engine/core/generated';
import type { ChapterMaterial, Course, Source, VoiceId } from '../content/types';
import { creditsIn, SITE_CREDITS } from '../content/voices';
import { fill, SITE_TEXT, THEME_SUMMARY, type SiteText } from '../site/i18n';
import { fontLink, themeCss } from './site_theme';
import { asset, buildPwa, bundle, hash } from './pwa';
import { PAGE_VERSION_MARK, pageVersionOf, stampVersion } from './site-version';
import type { Asset, CourseManifest } from '../site/offline-shared';
import { mediaKey, mediaPath, type MediaEntry } from '../site/media-shared';
import { checkMedia, readMediaManifest } from './media';
import { mimeOf } from '../site/mime';
import { assertSiteInvariants } from './site-invariants';
import { mediaRootOf, readSiteConfig, siteProblems } from './validate';

const ROOT = path.resolve(import.meta.dir, '..');
const SITE = path.join(ROOT, 'site');
const DIST = path.join(SITE, 'dist');
const DIST_MEDIA = path.join(SITE, 'dist-media');
const MEDIA = path.join(SITE, 'media');
const ASSETS = path.join(SITE, 'assets');

// site/config.json（形は scripts/validate.ts の SiteConfig）
const config = readSiteConfig();
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
/** 訳の言語の動画のサイトのパス（/media/en/ など。サイトと同じ origin なので、パスだけで指せる） */
const mediaRoot = (lang: Lang): string | null => mediaRootOf(config, lang);

type SiteData = {
  duration: number;
  chapters: { scene: number; start: number; heading: string; kind: string }[];
  cues: { start: number; end: number; text: string; scene: number }[];
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const plain = (s: string) => s.replace(/\*\*/g, '');
/** テンプレートの {{key}} を、その言語の決まった文字（エスケープ済み）にする */
const fillText = (html: string, T: SiteText) => html.replace(/\{\{(\w+)\}\}/g, (m, k: string) => (k in T ? esc(T[k as keyof SiteText]) : m));

/** 講座サイトのクレジット（日本語は全講座で共通の講師と呼び込み。content/voices.ts） */
const credits = SITE_CREDITS;
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
 * ID は URL とファイル名に使うので英数字だけ。リンクは https:// だけ（javascript: などを通さない）。中身は scripts/validate.ts の siteProblems
 * （PR の CI の npm run validate も同じものを流す）。台本の中身の確かめ（注入・隠し文字・秘密情報）は scripts/check_content.ts が受け持つ。
 */
const problems = siteProblems(config, coursesIn);
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

/** ページの中のスクリプト（<script> だけのもの）のハッシュで CSP を作る。ほかのスクリプトは動かない */
const csp = (html: string) => {
  // HTML は無料の assets のまま返し、www は本文の小さなスクリプトで同じ道筋の apex へ移す。
  // http:// や任意の外部hostを移行先に使わない。query/hashも保持する。
  html = html.replace('__CSP__', `__CSP__<script>if(location.hostname==='www.chalkfile.com'){location.replace('https://chalkfile.com'+location.pathname+location.search+location.hash);}</script>`);
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
const mediaManifest = readMediaManifest();
if (strict) checkMedia(mediaManifest);
const videoEntries = new Map(mediaManifest.entries.map((e) => [mediaKey(e), e]));
function videoFor(lang: string, course: string, lecture: string, kind: MediaEntry['kind'], required = true) {
  const entry = videoEntries.get(mediaKey({ lang, course, lecture, kind }));
  if (!entry && required) throw new Error(`動画の一覧がありません: ${lang}/${course}/${lecture}。先に bun scripts/media.ts push`);
  return entry;
}
// 全体buildでは以前のMP4や未公開のページを残さない。元動画には触れない。
if (!wanted.length) rmSync(DIST, { recursive: true, force: true });

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
    // ポスターは講座のフォルダ（content/<講座>/generated/posters/<key>.jpg）から。無ければ書き出したばかりの site/media/<key>.jpg
    const posterSource = (key: string) => (existsSync(path.join(ROOT, posterFile(course.id, key))) ? path.join(ROOT, posterFile(course.id, key)) : path.join(MEDIA, `${key}.jpg`));
    const mediaFiles: { file: string; from: string; data: Buffer; type: string }[] = [];
    for (const lec of lectures) {
      const file = `${lec.key}.jpg`;
      const from = posterSource(lec.key);
      if (existsSync(from)) mediaFiles.push({ file, from, data: readFileSync(from), type: 'image/jpeg' });
      else missing.push(posterFile(course.id, lec.key));
    }
    const courseCreditsList = courseCredits(course, lang);
    // 版は出力から決める（scripts/site-version.ts）。ページとポスターの ?v= には版の印を入れて描き、版が決まってから差し込む
    const json = JSON.stringify({ course: meta, credits: courseCreditsList, pageVersion: PAGE_VERSION_MARK, lang: { code: lang, html: info.html, label: info.label }, text: T,
      lectures: lectures.map(({ key, ...lec }) => ({ ...lec,
        video: mediaPath(videoFor(lang, course.id, lec.id, 'standard')!), poster: `media/${key}.jpg?v=${PAGE_VERSION_MARK}`,
        videoCc: videoFor(lang, course.id, lec.id, 'captioned', false) ? mediaPath(videoFor(lang, course.id, lec.id, 'captioned')!) : '',
      })) }).replace(/</g, '\\u003c');
    const app = appParts(lang, root, { id: cid, title: course.title, pageVersion: PAGE_VERSION_MARK });
    const url = `${base}${cid}/`;
    const firstPoster = `${url}media/${lectures[0].key}.jpg`;
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
    // 保存の manifest に入る、ページのほかのファイル（レクチャーごとに動画・ポスター・字幕版）。ポスターの ?v= は版の印のまま
    const videoAsset = (e: MediaEntry): Asset => ({ url: mediaPath(e), bytes: e.bytes, sha256: e.sha256, type: 'video/mp4' });
    const files = lectures.flatMap((lec) => {
      const poster = mediaFiles.find((f) => f.file === `${lec.key}.jpg`);
      const cc = videoFor(lang, course.id, lec.id, 'captioned', false);
      return [videoAsset(videoFor(lang, course.id, lec.id, 'standard')!),
        ...(poster ? [asset(`${cid}/media/${poster.file}?v=${PAGE_VERSION_MARK}`, poster.data, poster.type)] : []), ...(cc ? [videoAsset(cc)] : [])];
    });
    // 版は、版の印を入れたまま描いたページ（CSP まで）と、動画・ポスターの URL・大きさ・sha256 から計算する。保存した HTML と MP4 を別の版に混ぜない
    const pageVersion = pageVersionOf({ html: csp(html), files });
    const out = path.join(DIST, cid);
    mkdirSync(out, { recursive: true });
    // CSP のハッシュは、版を差し込んだ最終のページから作る
    const page = Buffer.from(csp(stampVersion(html, pageVersion)));
    writeFileSync(path.join(out, 'index.html'), page);
    // 動画とポスターを置く（日本語は講座の media/、訳の言語は動画のサイトの <講座>/）
    const mediaOut = path.join(out, 'media');
    rmSync(mediaOut, { recursive: true, force: true });
    mkdirSync(mediaOut, { recursive: true });
    for (const f of mediaFiles) place(f.from, path.join(mediaOut, f.file));
    // 一部だけの公開・欠けた生成物を「全講座保存」として案内しない。
    const manifestPath = path.join(out, 'offline-manifest.json');
    rmSync(manifestPath, { force: true });
    if (mediaFiles.length === lectures.length) {
      // ページの sha256 と大きさは、版を差し込んだ最終のページから計算する。ポスターの ?v= も版にする
      const saved = [asset(`${cid}/`, page, 'text/html'), ...files.map((f) => ({ ...f, url: stampVersion(f.url, pageVersion) }))];
      const manifest: CourseManifest = { schema: 1, id: cid, title: course.title, pageVersion, revision: hash(JSON.stringify(saved)),
        bytes: saved.reduce((sum, f) => sum + f.bytes, 0), files: saved };
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
  return `${root}${LANG_INFO[l].path}${c.id}/media/${key}.jpg`;
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

// 一覧ページの画像（site/assets）を写す。型は拡張子の対応表（site/mime.ts）から付け、知らない拡張子なら止める
// （SW は起動用ファイルの型を、配信の Content-Type と照らし合わせる。違うと、全員の新しい SW の install が止まる）
const copyDir = (from: string, to: string) => {
  mkdirSync(to, { recursive: true });
  for (const e of readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name);
    const b = path.join(to, e.name);
    if (e.isDirectory()) copyDir(a, b);
    else {
      rmSync(b, { force: true });
      place(a, b);
      shellAssets.push(asset(path.relative(DIST, b).split(path.sep).join('/'), readFileSync(b), mimeOf(b)));
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
// 保存用SHA-256とCSPを保つため、proxyによるHTML/画像の変更と自動beacon挿入を止める。
writeFileSync(path.join(DIST, '_headers'), '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Cache-Control: public, max-age=0, must-revalidate, no-transform\n/sw.js\n  Cache-Control: no-cache, no-transform\n');
writeFileSync(path.join(DIST, '404.html'), csp('<!doctype html><html lang="ja"><head><meta charset="utf-8">__CSP__<meta name="viewport" content="width=device-width"><title>教材が見つかりません｜Chalkfile</title></head><body><h1>教材が見つかりません</h1><p><a href="/">講座一覧へ</a></p></body></html>'));

// 公開物の決まり（Workers の上限・MP4 なし・印の残り・CSP と script・保存の manifest・起動用ファイル）を確かめる。破れていれば止める
assertSiteInvariants({ dist: DIST, scope: base, mediaRoots, media: mediaManifest, shell: shellAssets, courses: generatedManifests.map((m) => m.id) });
const emitted: { name: string; bytes: number }[] = [];
const inspect = (dir: string) => {
  for (const file of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, file.name);
    if (file.isDirectory()) inspect(full);
    else emitted.push({ name: path.relative(DIST, full), bytes: statSync(full).size });
  }
};
inspect(DIST);
console.log(`site/dist: ${emitted.length} files・${(emitted.reduce((n, f) => n + f.bytes, 0) / 1e6).toFixed(1)}MB・MP4なし。公開言語: ${SITE_LANGS.join(',')}`);

if (missing.length) {
  const msg = `まだ動画かポスターが無い: ${missing.join(' ')}（bash scripts/render.sh で作る）`;
  if (strict) {
    console.error(msg);
    process.exit(1);
  }
  console.warn(msg);
}
