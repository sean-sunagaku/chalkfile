// 講座サイトを組み立てる。GitHub Pages にそのまま置ける静的なファイルを site/dist に書く。
//   bun scripts/build_site.ts                  # 全講座と一覧ページ
//   bun scripts/build_site.ts stripe-billing   # 一部の講座だけ（一覧ページは毎回作る）
//   bun scripts/build_site.ts --strict         # 動画かポスターが無いレクチャーがあれば止める（deploy_pages.sh が使う）
// 入力: content/（台本）、site/data/<id>.json（synth.ts の出力）、site/media/<id>.mp4|jpg（render.sh の出力）、
//       site/template.html（講座のページ）、site/home.html（一覧のページ）、site/config.json（シリーズ名・公開 URL・GitHub）
// 出力: site/dist/index.html、site/dist/<講座>/index.html、site/dist/<講座>/media/（site/media のハードリンク）
import { copyFileSync, existsSync, linkSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { COURSES } from '../content';
import type { Course } from '../content/types';

const ROOT = path.resolve(import.meta.dir, '..');
const SITE = path.join(ROOT, 'site');
const DIST = path.join(SITE, 'dist');
const MEDIA = path.join(SITE, 'media');

type Config = { series: string; seriesSub: string; baseUrl: string; repoUrl: string };
const config = JSON.parse(readFileSync(path.join(SITE, 'config.json'), 'utf8')) as Config;
const base = config.baseUrl.endsWith('/') ? config.baseUrl : `${config.baseUrl}/`;

type SiteData = {
  duration: number;
  chapters: { scene: number; start: number; heading: string; kind: string }[];
  cues: { start: number; end: number; text: string; scene: number }[];
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
// **…** をグラデーションの文字にする
const headline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<span class="grad">$1</span>');
const plain = (s: string) => s.replace(/\*\*/g, '');

const credits = JSON.parse(readFileSync(path.join(ROOT, 'src/generated/credits.json'), 'utf8')) as string[];
const template = readFileSync(path.join(SITE, 'template.html'), 'utf8');
const home = readFileSync(path.join(SITE, 'home.html'), 'utf8');

const FAVICON =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF6FA3"/><stop offset=".5" stop-color="#9C8CFF"/><stop offset="1" stop-color="#45D3F4"/></linearGradient></defs><rect x="4" y="4" width="24" height="24" rx="8" fill="url(#g)"/></svg>',
  );

// 検索と SNS の共有で使う <head> の中身
const headMeta = (o: { title: string; description: string; url: string; image?: string }) =>
  [
    `<meta name="description" content="${esc(o.description)}">`,
    `<link rel="canonical" href="${esc(o.url)}">`,
    `<link rel="icon" href="${FAVICON}">`,
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

const readData = (id: string): SiteData | null => {
  const f = path.join(SITE, 'data', `${id}.json`);
  return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as SiteData) : null;
};
const minutesOf = (course: Course) => course.lectures.reduce((a, l) => a + (readData(l.id)?.duration ?? 0), 0) / 60;

const strict = process.argv.includes('--strict');
const wanted = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const missing: string[] = [];

for (const course of COURSES.filter((c) => !wanted.length || wanted.includes(c.id))) {
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
  const meta = { id: course.id, title: course.title, subtitle: course.subtitle, sections: course.sections, sourceNote: course.sourceNote, links };
  const json = JSON.stringify({ course: meta, credits, lectures }).replace(/</g, '\\u003c');
  const url = `${base}${course.id}/`;
  const html = template
    .replace('__TITLE__', () => esc(`${course.title}｜${config.series}`))
    .replace('__HEAD_META__', () =>
      headMeta({
        title: course.title,
        description: `${plain(course.headline)}。${lectures.length} 本・約 ${Math.round(minutes)} 分の動画と、台本・確認クイズ。`,
        url,
        image: `${url}media/${course.lectures[0].id}.jpg`,
      }),
    )
    .replace('__SERIES__', () => esc(config.series))
    .replace('__BRAND_SUB__', () => esc(course.title))
    .replace('__HEADLINE__', () => headline(course.headline))
    .replace('__DOCS_NOTE__', () => esc(course.docsNote))
    .replace('__COURSE_JSON__', () => json);
  const out = path.join(DIST, course.id);
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, 'index.html'), html);
  rmSync(path.join(out, 'media'), { recursive: true, force: true });
  mkdirSync(path.join(out, 'media'));
  for (const lec of course.lectures) {
    for (const ext of ['mp4', 'jpg']) {
      const f = path.join(MEDIA, `${lec.id}.${ext}`);
      if (existsSync(f)) place(f, path.join(out, 'media', `${lec.id}.${ext}`));
      else missing.push(`${lec.id}.${ext}`);
    }
  }
  console.log(`site/dist/${course.id}/index.html ${(html.length / 1024).toFixed(0)} KB  ${lectures.length} レクチャー  合計 ${minutes.toFixed(1)} 分`);
}

// 一覧のページ（講座が増えたらカードが増える）
const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const cards = COURSES.map((c) => {
  const minutes = minutesOf(c);
  const poster = `${c.id}/media/${c.lectures[0].id}.jpg`;
  return [
    `<a class="card" href="${c.id}/">`,
    `  <div class="poster"><img src="${poster}" alt="" width="1280" height="720" loading="lazy"></div>`,
    '  <div class="card-body">',
    `    <h3>${esc(c.title)}</h3>`,
    `    <p class="lead">${esc(plain(c.headline))}</p>`,
    `    <div class="meta"><span>${c.lectures.length} レクチャー</span><span>約 ${Math.round(minutes)} 分</span></div>`,
    `    <ul class="secs">${c.sections.map((s) => `<li>${esc(s.title)}</li>`).join('')}</ul>`,
    `    <span class="go">講座を開く${arrow}</span>`,
    '  </div>',
    '</a>',
  ].join('\n');
}).join('\n');
const first = COURSES[0];
const homeHtml = home
  .replace('__TITLE__', () => esc(config.series))
  .replace('__HEAD_META__', () =>
    headMeta({ title: config.series, description: config.seriesSub, url: base, image: `${base}${first.id}/media/${first.lectures[0].id}.jpg` }),
  )
  .replaceAll('__SERIES__', () => esc(config.series))
  .replace('__SERIES_SUB__', () => esc(config.seriesSub))
  .replace('__COURSES__', () => cards)
  .replaceAll('__REPO__', () => esc(config.repoUrl))
  .replace('__CREDITS__', () => esc(`ナレーション ${credits.join('・')}　動画 Remotion　BGM・効果音はプログラムで合成したオリジナル`));
mkdirSync(DIST, { recursive: true });
writeFileSync(path.join(DIST, 'index.html'), homeHtml);
// GitHub Pages に Jekyll を通させない（そのまま配る）
writeFileSync(path.join(DIST, '.nojekyll'), '');
console.log(`site/dist/index.html  講座 ${COURSES.length} つ`);

if (missing.length) {
  const msg = `まだ動画かポスターが無い: ${missing.join(' ')}（bash scripts/render.sh で作る）`;
  if (strict) {
    console.error(msg);
    process.exit(1);
  }
  console.warn(msg);
}
