// 講座サイトを組み立てる。GitHub Pages にそのまま置ける静的なファイルを site/dist に書く。
//   bun scripts/build_site.ts                  # 全講座と一覧ページ
//   bun scripts/build_site.ts stripe-billing   # 一部の講座だけ（一覧ページは毎回作る）
//   bun scripts/build_site.ts --strict         # 動画かポスターが無いレクチャーがあれば止める（deploy_pages.sh が使う）
// 入力: content/（台本とテーマ）、site/data/<id>.json（synth.ts の出力）、site/media/<id>.mp4|jpg（render.sh の出力）、
//       site/template.html（講座のページ）、site/home.html（一覧のページ）、site/assets/（一覧ページの画像）、site/config.json
// 出力: site/dist/index.html、site/dist/<講座>/index.html、site/dist/<講座>/media/・site/dist/assets/（ハードリンク）
// 色・書体・背景の飾りは講座のテーマ（content/themes.ts）から作る。一覧ページは既定のテーマ（Chalkfile）
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, linkSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { COURSES } from '../content';
import { THEMES, themeOf } from '../content/themes';
import type { ChapterMaterial, Course, Source } from '../content/types';
import { fontLink, themeCss } from './site_theme';
import { asset, buildPwa, bundle, hash } from './pwa';
import type { Asset, CourseManifest } from '../site/offline-shared';

const ROOT = path.resolve(import.meta.dir, '..');
const SITE = path.join(ROOT, 'site');
const DIST = path.join(SITE, 'dist');
const MEDIA = path.join(SITE, 'media');
const ASSETS = path.join(SITE, 'assets');

type Config = { series: string; seriesSub: string; baseUrl: string; repoUrl: string };
const config = JSON.parse(readFileSync(path.join(SITE, 'config.json'), 'utf8')) as Config;
const base = config.baseUrl.endsWith('/') ? config.baseUrl : `${config.baseUrl}/`;

type SiteData = {
  duration: number;
  chapters: { scene: number; start: number; heading: string; kind: string }[];
  cues: { start: number; end: number; text: string; scene: number }[];
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const plain = (s: string) => s.replace(/\*\*/g, '');

const credits = JSON.parse(readFileSync(path.join(ROOT, 'src/generated/credits.json'), 'utf8')) as string[];
const template = readFileSync(path.join(SITE, 'template.html'), 'utf8');
const home = readFileSync(path.join(SITE, 'home.html'), 'utf8');
const offlinePanel = readFileSync(path.join(SITE, 'offline-panel.html'), 'utf8');
const offlineCss = readFileSync(path.join(SITE, 'offline.css'), 'utf8');
const offlineClient = await bundle(path.join(SITE, 'offline-client.ts'));
const generatedManifests: CourseManifest[] = [];
const shellAssets: Asset[] = [];
const appParts = (root: string, course?: { id: string; title: string; pageVersion: string }) => ({
  head: `<link rel="manifest" href="${root}manifest.webmanifest"><link rel="apple-touch-icon" href="${root}icons/icon-180.png"><meta name="theme-color" content="${themeOf().color.bg}"><meta name="apple-mobile-web-app-capable" content="yes">`,
  panel: offlinePanel.replace('__COURSE_HIDDEN__', course ? '' : 'hidden').replace('__LIBRARY_OPEN__', course ? '' : 'open'),
  script: `<script id="pwa-data" type="application/json">${JSON.stringify({ root, course, courses: COURSES.map((c) => ({ id: c.id, title: c.title })) }).replace(/</g, '\\u003c')}</script><script>${offlineClient}</script>`,
});

const favicon = (ink: string, accent: string) =>
  'data:image/svg+xml,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x="3" y="7" width="26" height="18" rx="5" fill="${ink}"/><rect x="3" y="20" width="26" height="5" rx="2" fill="${accent}"/></svg>`);

// 検索と SNS の共有で使う <head> の中身
const headMeta = (o: { title: string; description: string; url: string; image?: string; icon: string }) =>
  [
    `<meta name="description" content="${esc(o.description)}">`,
    `<link rel="canonical" href="${esc(o.url)}">`,
    `<link rel="icon" href="${o.icon}">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:site_name" content="${esc(config.series)}">`,
    `<meta property="og:title" content="${esc(o.title)}">`,
    `<meta property="og:description" content="${esc(o.description)}">`,
    `<meta property="og:url" content="${esc(o.url)}">`,
    o.image ? `<meta property="og:image" content="${esc(o.image)}">` : '',
    `<meta name="twitter:card" content="${o.image ? 'summary_large_image' : 'summary'}">`,
  ]
    .filter(Boolean)
    .join('\n');

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

const readData = (id: string): SiteData | null => {
  const f = path.join(SITE, 'data', `${id}.json`);
  return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as SiteData) : null;
};
const minutesOf = (course: Course) => course.lectures.reduce((a, l) => a + (readData(l.id)?.duration ?? 0), 0) / 60;

/* ───────────── 安全のための確かめ ─────────────
 * ID は URL とファイル名に使うので英数字だけ。リンクは https:// だけ（javascript: などを通さない）。
 * 台本の中身の確かめ（注入・隠し文字・秘密情報）は scripts/check_content.ts が受け持つ。
 */
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const HTTPS = /^https:\/\/[^\s"'<>`]+$/;
const problems: string[] = [];
if (!HTTPS.test(config.baseUrl) || !HTTPS.test(config.repoUrl)) problems.push('site/config.json の baseUrl と repoUrl は https:// で書く');
for (const c of COURSES) {
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

for (const course of COURSES.filter((c) => !wanted.length || wanted.includes(c.id))) {
  const theme = themeOf(course.theme);
  const lectures = course.lectures.map((lec) => {
    const d = readData(lec.id);
    if (!d) throw new Error(`site/data/${lec.id}.json がありません。先に bun scripts/synth.ts ${lec.id} を流す`);
    return {
      id: lec.id,
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
        heading: c.kind === 'opening' ? 'オープニング' : c.kind === 'ending' ? 'エンディング' : c.heading,
      })),
      cues: d.cues.map((c) => ({ start: c.start, end: c.end, text: c.text, scene: c.scene })),
    };
  });
  const minutes = minutesOf(course);
  const links = [...(course.links ?? []), { label: 'ソースと作り方（GitHub）', url: config.repoUrl }];
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
  for (const lec of course.lectures) for (const ext of ['mp4', 'jpg']) {
    const file = `${lec.id}.${ext}`;
    const from = path.join(MEDIA, file);
    if (existsSync(from)) mediaFiles.push({ file, data: readFileSync(from), type: ext === 'mp4' ? 'video/mp4' : 'image/jpeg' });
    else missing.push(file);
  }
  // 版は教材・表示・動画の全入力で決まる。保存した HTML と MP4 を別の版に混ぜない。
  const pageVersion = hash(JSON.stringify({ meta, credits, lectures, theme, template, offlinePanel, offlineCss, offlineClient,
    builder: readFileSync(import.meta.path, 'utf8'), media: mediaFiles.map((f) => [f.file, hash(f.data)]) }));
  const json = JSON.stringify({ course: meta, credits, pageVersion, lectures: lectures.map((lec) => ({ ...lec,
    video: `media/${lec.id}.mp4?v=${pageVersion}`, poster: `media/${lec.id}.jpg?v=${pageVersion}`,
  })) }).replace(/</g, '\\u003c');
  const app = appParts('../', { id: course.id, title: course.title, pageVersion });
  const url = `${base}${course.id}/`;
  const html = template
    .replace('__PWA_HEAD__', () => app.head)
    .replace('__OFFLINE_CSS__', () => offlineCss)
    .replace('__OFFLINE_PANEL__', () => app.panel)
    .replace('__PWA_SCRIPT__', () => app.script)
    .replace('__TITLE__', () => esc(`${course.title}｜${config.series}`))
    .replace('__HEAD_META__', () =>
      headMeta({
        title: course.title,
        description: `${plain(course.headline)}。${lectures.length} 本・約 ${Math.round(minutes)} 分の動画と、台本・確認クイズ${lectures.some((l) => l.material) ? '・読む教材・実践課題' : ''}。`,
        url,
        image: `${url}media/${course.lectures[0].id}.jpg`,
        icon: favicon(theme.color.ink, theme.color.accent),
      }),
    )
    .replace('__FONT_LINK__', () => fontLink(theme))
    .replace('__THEME_CSS__', () => themeCss(theme))
    .replace('__SERIES__', () => esc(config.series))
    .replace('__BRAND_SUB__', () => esc(course.title))
    .replace('__HEADLINE__', () => esc(plain(course.headline)))
    .replace('__DOCS_NOTE__', () => esc(course.docsNote))
    .replace('__COURSE_JSON__', () => json);
  const out = path.join(DIST, course.id);
  mkdirSync(out, { recursive: true });
  const page = Buffer.from(csp(html));
  writeFileSync(path.join(out, 'index.html'), page);
  rmSync(path.join(out, 'media'), { recursive: true, force: true });
  mkdirSync(path.join(out, 'media'));
  for (const lec of course.lectures) {
    for (const ext of ['mp4', 'jpg']) {
      const f = path.join(MEDIA, `${lec.id}.${ext}`);
      if (existsSync(f)) place(f, path.join(out, 'media', `${lec.id}.${ext}`));
    }
  }
  // 一部だけの公開・欠けた生成物を「全講座保存」として案内しない。
  const manifestPath = path.join(out, 'offline-manifest.json');
  rmSync(manifestPath, { force: true });
  if (mediaFiles.length === course.lectures.length * 2) {
    const files = [asset(`${course.id}/`, page, 'text/html'), ...mediaFiles.map((f) => asset(`${course.id}/media/${f.file}?v=${pageVersion}`, f.data, f.type))];
    const manifest: CourseManifest = { schema: 1, id: course.id, title: course.title, pageVersion, revision: hash(JSON.stringify(files)),
      bytes: files.reduce((sum, f) => sum + f.bytes, 0), files };
    generatedManifests.push(manifest);
    writeFileSync(manifestPath, JSON.stringify(manifest));
  }
  console.log(`site/dist/${course.id}/index.html ${(html.length / 1024).toFixed(0)} KB  ${lectures.length} レクチャー  合計 ${minutes.toFixed(1)} 分  テーマ ${theme.id}`);
}

/* ───────────── 一覧のページ ───────────── */

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

const courseCards = COURSES.map((c) => {
  const t = themeOf(c.theme);
  const minutes = minutesOf(c);
  const style = `--card-grad: linear-gradient(100deg, ${t.gradient.join(', ')}); --card-soft: ${t.color.surface2}; --card-ink: ${t.tones.violet}`;
  return [
    `<a class="course" href="${c.id}/" style="${esc(style)}">`,
    `  <div class="poster"><img src="${c.id}/media/${c.lectures[0].id}.jpg" alt="" width="1280" height="720" loading="lazy"></div>`,
    '  <div class="body">',
    `    <h3>${esc(c.title)}</h3>`,
    `    <p>${esc(plain(c.headline))}</p>`,
    `    <ul class="facts"><li>${c.unitLabel === 'CHAPTER' ? `${c.lectures.length} 章${c.syllabus ? ` ／ 計画 ${c.syllabus.chapters.length} 章` : ''}` : `${c.lectures.length} レクチャー`}</li><li>約 ${Math.round(minutes)} 分</li><li class="is-theme">テーマ: ${esc(t.label)}</li></ul>`,
    `    <span class="go">講座を開く</span>`,
    '  </div>',
    '</a>',
  ].join('\n');
}).join('\n');

const themeCards = Object.values(THEMES)
  .map((t) => {
    const img = `assets/themes/${t.id}.jpg`;
    const sw = [t.color.bg, t.color.ink, t.color.accent, t.tones.pink, t.tones.cyan, t.tones.mint];
    return [
      '<article class="theme">',
      existsSync(path.join(SITE, img)) ? `  <img src="${img}" alt="${esc(t.label)} のテーマで描いた動画の 1 場面" width="960" height="540" loading="lazy">` : '',
      '  <div class="body">',
      `    <h3>${esc(t.label)} <code>theme: '${esc(t.id)}'</code></h3>`,
      `    <div class="swatches" aria-hidden="true">${sw.map((c) => `<span style="background:${c}"></span>`).join('')}</div>`,
      `    <p>${esc(t.summary)}</p>`,
      '  </div>',
      '</article>',
    ]
      .filter(Boolean)
      .join('\n');
  })
  .join('\n');

const first = COURSES[0];
const homeHtml = home
  .replace('__PWA_HEAD__', () => appParts('./').head)
  .replace('__OFFLINE_CSS__', () => offlineCss)
  .replace('__OFFLINE_PANEL__', () => appParts('./').panel)
  .replace('__PWA_SCRIPT__', () => appParts('./').script)
  .replace('__TITLE__', () => esc(`${config.series}：台本から講座動画を作る`))
  .replace('__HEAD_META__', () =>
    headMeta({ title: config.series, description: config.seriesSub, url: base, image: `${base}assets/hero.jpg`, icon: favicon(brand.color.ink, brand.color.accent) }),
  )
  .replace('__FONT_LINK__', () => fontLink(brand))
  .replace('__THEME_CSS__', () => themeCss(brand))
  .replaceAll('__SERIES__', () => esc(config.series))
  .replace('__FIRST_COURSE__', () => `${first.id}/`)
  .replace('__HERO_FILE__', () => esc(heroFile))
  .replace('__HERO_CODE__', () => heroLines.map(highlightTs).join('\n'))
  .replace('__HERO_IMAGE__', () => 'assets/hero.jpg')
  .replace('__COURSES__', () => courseCards)
  .replace('__THEMES__', () => themeCards)
  .replaceAll('__REPO__', () => esc(config.repoUrl))
  .replace('__CREDITS__', () => esc(`ナレーション ${credits.join('・')}　動画 Remotion　BGM・効果音はプログラムで合成したオリジナル`));
mkdirSync(DIST, { recursive: true });
const homePage = Buffer.from(csp(homeHtml));
writeFileSync(path.join(DIST, 'index.html'), homePage);
shellAssets.push(asset('./', homePage, 'text/html'));

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
for (const c of COURSES) {
  const f = `${c.id}/media/${c.lectures[0].id}.jpg`;
  if (existsSync(path.join(DIST, f))) shellAssets.push(asset(f, readFileSync(path.join(DIST, f)), 'image/jpeg'));
}
await buildPwa(SITE, DIST, brand, generatedManifests.map((m) => m.id), shellAssets);
// GitHub Pages に Jekyll を通させない（そのまま配る）
writeFileSync(path.join(DIST, '.nojekyll'), '');
console.log(`site/dist/index.html  講座 ${COURSES.length} つ  テーマ ${Object.keys(THEMES).length} つ`);

if (missing.length) {
  const msg = `まだ動画かポスターが無い: ${missing.join(' ')}（bash scripts/render.sh で作る）`;
  if (strict) {
    console.error(msg);
    process.exit(1);
  }
  console.warn(msg);
}
