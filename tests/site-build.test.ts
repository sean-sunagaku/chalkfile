// 講座サイトの組み立て（scripts/site/build.ts の buildSite）を、合成の講座（tests/fixtures/content/site-sample）で確かめる。
// 出力のスナップショット（tests/fixtures/content/site-sample/snapshot.json）と比べ、出力が変わったら落ちる。
// bundle（講座のページの画面・offline-client・sw.js）・アイコンの PNG・ハッシュと大きさは、Bun の版で変わるので正規化してから比べる。
// わざと出力を変えたときは、UPDATE_SITE_SNAPSHOT=1 bun test tests/site-build.test.ts で作り直す（本物の講座の site/dist が変わる直しなら、
// サイトの版が変わる。保存した人に「新しい版」が出るので、まとめて出す回に入れる）
import { afterAll, describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { CourseModule, HeroSnippet } from '../content/course-module';
import * as REGISTRY from '../content/courses';
import type { Course } from '../content/types';
import { bundle } from '../scripts/pwa';
import { type BuildSiteOptions, buildSite, disabledRevisionProblems } from '../scripts/site/build';
import { heroSnippetOf } from '../scripts/site/config';
import { scriptHash, WWW_REDIRECT_SCRIPT } from '../scripts/site/csp';
import { type MediaEntry, mediaFilename } from '../site/media-shared';
import { resolveCourse } from '../content/lines';
import SAMPLE from './fixtures/content/site-sample';

/** 合成の講座（台本に書いたままの形を、番号に直したもの） */
const SAMPLE_COURSE = resolveCourse(SAMPLE.course);

const ROOT = path.resolve(import.meta.dir, '..');
const FIXTURE = path.join(ROOT, 'tests/fixtures/content/site-sample');
const SNAPSHOT = path.join(FIXTURE, 'snapshot.json');

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** 合成の講座の動画の一覧（中身は無い。大きさと sha256 は決まった値） */
const sampleMedia = (course: Course) => ({
  schema: 1 as const,
  entries: course.lectures.map((l, i): MediaEntry => {
    const e = {
      lang: 'ja',
      course: course.id,
      lecture: l.id,
      kind: 'standard' as const,
      bytes: 1000 + i,
      sha256: String(i + 1).repeat(64),
      tag: `media-ja-${course.id}`,
    };
    return { ...e, filename: mediaFilename(e) };
  }),
});

/** 合成の講座で組み立てる（一時のフォルダに書く。outDir を渡すと、そこに組み立て直す） */
const buildSample = async (over: Partial<BuildSiteOptions> = {}) => {
  const outDir = over.outDir ?? mkdtempSync(path.join(tmpdir(), 'chalkfile-site-build-'));
  dirs.push(outDir);
  const course = over.courses?.ja[0] ?? SAMPLE_COURSE;
  const result = await buildSite({
    courses: { ja: [course], en: [], zh: [] },
    dataDir: path.join(FIXTURE, 'data'),
    mediaManifest: sampleMedia(course),
    outDir,
    langs: ['ja'],
    hero: SAMPLE.heroSnippet as HeroSnippet,
    strict: true,
    posterOf: (_, key) => path.join(FIXTURE, 'posters', `${key}.jpg`),
    log: () => {},
    warn: () => {},
    ...over,
  });
  return { outDir, result };
};

const sha256 = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');

/** ページに入れる bundle（講座のページの画面と offline-client） */
const bundles = async () => ({
  pageScript: await bundle(path.join(ROOT, 'site/course-page.ts')),
  offlineClient: await bundle(path.join(ROOT, 'site/offline-client.ts')),
});

/**
 * 1 ファイルの正規化した指紋。bundle（sw.js）とアイコン（PNG の圧縮）は、在ることだけを見る。
 * 文字のファイルは、ページに入れる bundle・CSP のハッシュ・sha256（版・revision・ファイルの中身）・保存の manifest の大きさを印にしてから
 */
const fingerprintOf = (rel: string, data: Buffer, b: { pageScript: string; offlineClient: string }): string => {
  if (rel === 'sw.js' || rel.startsWith('icons/')) return 'present';
  if (!/\.(html|json|webmanifest)$|(^|\/)(_headers|\.assetsignore|\.nojekyll)$/.test(rel)) return sha256(data);
  let text = data.toString('utf8').split(b.pageScript).join('<course-page>').split(b.offlineClient).join('<offline-client>');
  text = text.replace(/'sha256-[A-Za-z0-9+/=]+'/g, "'sha256-<hash>'").replace(/[a-f0-9]{64}/g, '<sha256>');
  if (rel.endsWith('offline-manifest.json')) text = text.replace(/"bytes":\d+/g, '"bytes":0');
  return sha256(text);
};

const snapshotOf = async (outDir: string, files: { name: string }[]) => {
  const b = await bundles();
  const names = files.map((f) => f.name.split(path.sep).join('/')).sort();
  return Object.fromEntries(names.map((n) => [n, fingerprintOf(n, readFileSync(path.join(outDir, n)), b)]));
};

/** 台本の抜き出しの行が、file の続いた行と合うか（長い行は「, … },」の前まで）。合わなければ、その行 */
const heroDrift = (snippet: HeroSnippet): string | null => {
  const src = readFileSync(path.join(ROOT, snippet.file), 'utf8')
    .split('\n')
    .map((l) => l.trim());
  const same = (line: string, want: string) => {
    const cut = want.endsWith(', … },') ? want.slice(0, -', … },'.length) : null;
    return cut ? line.startsWith(`${cut}, `) : line === want;
  };
  const lines = snippet.lines.map((l) => l.trim());
  const start = src.findIndex((_, i) => lines.every((want, j) => src[i + j] !== undefined && same(src[i + j], want)));
  return start < 0 ? `${snippet.file} に、この続きの行が無い: ${lines.join(' / ')}` : null;
};

describe('講座サイトの組み立て（合成の講座）', () => {
  test('出力のスナップショット（ハッシュは正規化）', async () => {
    const { outDir, result } = await buildSample();
    const now = await snapshotOf(outDir, result.files);
    if (process.env.UPDATE_SITE_SNAPSHOT === '1') {
      writeFileSync(SNAPSHOT, `${JSON.stringify({ files: now }, null, 2)}\n`);
      return;
    }
    const before = (JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as { files: Record<string, string> }).files;
    const changed = [...new Set([...Object.keys(before), ...Object.keys(now)])]
      .sort()
      .filter((n) => before[n] !== now[n])
      .map((n) => `${n}: ${!(n in before) ? '足した' : !(n in now) ? '無くなった' : '中身が変わった'}`);
    if (changed.length) {
      throw new Error(
        [
          'サイトの出力が、スナップショットと違う（わざと変えたなら UPDATE_SITE_SNAPSHOT=1 bun test tests/site-build.test.ts）:',
          ...changed,
        ].join('\n'),
      );
    }
    expect(result.manifests.map((m) => m.id)).toEqual(['site-sample']);
    expect(result.manifests[0].files).toHaveLength(5);
    expect(result.missing).toEqual([]);
  });

  test('ポスターが無いレクチャーがあれば、strict は止まり、そうでなければ保存の manifest を作らずに知らせる', async () => {
    const posterOf = (_: string, key: string) =>
      path.join(FIXTURE, 'posters', key === 'Y02' ? 'none.jpg' : `${key}.jpg`);
    await expect(buildSample({ posterOf })).rejects.toThrow(
      'まだ動画かポスターが無い: content/site-sample/generated/posters/Y02.jpg',
    );
    const warned: string[] = [];
    const { result } = await buildSample({ posterOf, strict: false, warn: (l) => warned.push(l) });
    expect(result.manifests).toEqual([]);
    expect(warned).toHaveLength(1);
  });

  test('動画の一覧に無いレクチャーがあれば止まる', async () => {
    await expect(
      buildSample({ mediaManifest: { schema: 1, entries: sampleMedia(SAMPLE_COURSE).entries.slice(0, 1) } }),
    ).rejects.toThrow('動画の一覧がありません: ja/site-sample/Y02');
  });

  test('CSP の script-src は、ページに入れる信頼できる script（www の移動・画面・offline-client）のハッシュだけ', async () => {
    const { outDir } = await buildSample();
    const { pageScript, offlineClient } = await bundles();
    const scriptSrc = (rel: string) =>
      /script-src ([^;]+);/.exec(readFileSync(path.join(outDir, rel), 'utf8'))?.[1].split(' ') ?? [];
    expect(scriptSrc('site-sample/index.html')).toEqual(
      [WWW_REDIRECT_SCRIPT, pageScript, offlineClient].map(scriptHash),
    );
    expect(scriptSrc('index.html')).toEqual([WWW_REDIRECT_SCRIPT, offlineClient].map(scriptHash));
    expect(scriptSrc('404.html')).toEqual([scriptHash(WWW_REDIRECT_SCRIPT)]);
  });

  test('ページに入れる 2 本の script（画面と offline-client）は、それぞれ関数で包む（一番上の名前を大域の変数にしない）', async () => {
    for (const code of Object.values(await bundles())) {
      expect(code).toMatch(/^\(\(\)\s*=>\s*\{/);
      expect(code).toMatch(/\}\)\(\);?\s*$/);
    }
  });

  test('台本に置き換えの印（__DOCS_NOTE__・{{tabQuiz}}・__COURSE_JSON__）や </script> を書いても、組み立てが壊れない', async () => {
    const tricky: Course = {
      ...SAMPLE_COURSE,
      title: '見本 __DOCS_NOTE__ の講座',
      headline: '{{tabQuiz}} と __COURSE_JSON__',
      docsNote: '__HEADLINE__ と </script><script>alert(1)</script>',
      lectures: [{ ...SAMPLE_COURSE.lectures[0], title: '__TITLE__ {{sep}}' }, SAMPLE_COURSE.lectures[1]],
    };
    const { outDir } = await buildSample({ courses: { ja: [tricky], en: [], zh: [] } });
    const page = readFileSync(path.join(outDir, 'site-sample/index.html'), 'utf8');
    // 文字は、その場所にそのまま（エスケープし、印に見えなくして）出る。ほかの印の所に差し込まれない
    expect(page).toContain('<title>見本 &#95;_DOCS_NOTE__ の講座｜Chalkfile</title>');
    expect(page).toContain('&#95;_HEADLINE__ と &lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(page.split('&#123;{tabQuiz}} と &#95;_COURSE_JSON__').length).toBeGreaterThan(1);
    // ページで動く script は、組み立てが入れたものだけ（台本の </script><script> は動かない）
    expect(page.match(/<script>/g)).toHaveLength(3);
    // ページの JSON には、台本の文字がそのまま入る（画面の JS が文字として出す）
    const json = /<script id="course-data" type="application\/json">([\s\S]*?)<\/script>/.exec(page)?.[1] ?? '';
    const data = JSON.parse(json) as { course: { title: string }; lectures: { title: string }[] };
    expect(data.course.title).toBe('見本 __DOCS_NOTE__ の講座');
    expect(data.lectures[0].title).toBe('__TITLE__ {{sep}}');
    const home = readFileSync(path.join(outDir, 'index.html'), 'utf8');
    expect(home).toContain('<h3>見本 &#95;_DOCS_NOTE__ の講座</h3>');
  });
});

describe('講座を指定して組み立てる（only）', () => {
  test('sw.js に入れる講座は、出す言語の全部の講座から選ぶ（前に組んだ講座を外さない）', async () => {
    const other: Course = { ...SAMPLE_COURSE, id: 'site-sample-b' };
    const media = { schema: 1 as const, entries: [...sampleMedia(SAMPLE_COURSE).entries, ...sampleMedia(other).entries] };
    const courses = { ja: [SAMPLE_COURSE, other], en: [], zh: [] };
    const { outDir, result: all } = await buildSample({ courses, mediaManifest: media });
    expect(all.courses).toEqual(['site-sample', 'site-sample-b']);
    const swCourses = () => /courses:\s*(\[[^\]]*\])/.exec(readFileSync(path.join(outDir, 'sw.js'), 'utf8'))?.[1];
    const before = swCourses();
    const partial = await buildSample({ courses, mediaManifest: media, outDir, only: ['site-sample'] });
    expect(partial.result.manifests.map((m) => m.id)).toEqual(['site-sample']);
    expect(partial.result.courses).toEqual(['site-sample', 'site-sample-b']);
    expect(swCourses()).toBe(before);
    expect(JSON.parse(before ?? '[]')).toEqual(['site-sample', 'site-sample-b']);
  });
});

describe('無効にした保存版の一覧（site/disabled-revisions.ts）', () => {
  const rev = (c: string) => c.repeat(64);
  test('sw.js の設定に入れる', async () => {
    const { outDir } = await buildSample({ disabledRevisions: [rev('a'), rev('b')] });
    const sw = readFileSync(path.join(outDir, 'sw.js'), 'utf8');
    expect(sw).toMatch(new RegExp(`disabledRevisions:\\s*\\["${rev('a')}",\\s*"${rev('b')}"\\]`));
  });
  test('形の違うもの・重なり・今公開する版は止める', async () => {
    const current = { id: 'site-sample', revision: rev('c') } as Parameters<typeof disabledRevisionProblems>[1][number];
    expect(disabledRevisionProblems([rev('a'), 'abc', rev('a'), rev('c')], [current])).toEqual([
      '無効にした保存版の revision の形が違う（64 字の SHA-256）: abc',
      `無効にした保存版の revision が重なっている: ${rev('a')}`,
      `今公開する版を無効にしている（site-sample）: ${rev('c')}。直した版を公開してから、前の版の revision を入れる`,
    ]);
    const { result } = await buildSample();
    await expect(buildSample({ disabledRevisions: [result.manifests[0].revision] })).rejects.toThrow('今公開する版を無効にしている');
  });
});

describe('一覧のページの最初の画面に出す台本の抜き出し（heroSnippet）', () => {
  const modules = Object.values(REGISTRY) as CourseModule[];
  test('本物の講座に 1 つあり、写した行が file と合う', () => {
    const real = modules.filter((m) => m.heroSnippet);
    expect(real.length).toBeGreaterThan(0);
    for (const m of real) expect(heroDrift(m.heroSnippet as HeroSnippet)).toBeNull();
  });
  test('合成の講座の抜き出しも、file と合う', () => {
    expect(heroDrift(SAMPLE.heroSnippet as HeroSnippet)).toBeNull();
  });
  test('並びで最初の、抜き出しのある講座のものを使う。どれにも無ければ止まる', () => {
    const a = { ...SAMPLE, course: { ...SAMPLE_COURSE, id: 'a' } };
    const b = { course: { ...SAMPLE_COURSE, id: 'b' }, heroSnippet: { file: 'b.ts', lines: ['b'] } };
    expect(heroSnippetOf([b.course, a.course], [a, b])).toEqual(b.heroSnippet);
    expect(heroSnippetOf([a.course, b.course], [a, b])).toEqual(SAMPLE.heroSnippet as HeroSnippet);
    expect(() => heroSnippetOf([b.course], [{ course: b.course }])).toThrow('heroSnippet');
  });
  test('写した行が file と違えば見つける', () => {
    const snippet = SAMPLE.heroSnippet as HeroSnippet;
    expect(heroDrift({ ...snippet, lines: [...snippet.lines.slice(0, 2), "  heading: '別の見出し',"] })).not.toBeNull();
  });
});
