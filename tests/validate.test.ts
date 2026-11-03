import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { COURSES, coursesIn } from '../content';
import type { Lang } from '../content/i18n';
import { NUDGE_PRODUCT } from '../content/nudge-product/course';
import { CHALKFILE, THEMES } from '../content/themes';
import type { Course, Lecture } from '../content/types';
import { captionLines, formatIssue, SFX_IDS, validateCourse, validateLecture, validateTheme, validateTimeline, VOICE_IDS, type Issue, type TimelineShape } from '../engine/core/validate';
import { mediaFilename, type MediaEntry, type MediaManifest } from '../site/media-shared';
import { PAGE_VERSION_MARK } from '../scripts/site-version';
import { materialProblems, mediaProblems, posterProblems, publishIssues, readSiteConfig, siteProblems, validateAll, type PublishIssue } from '../scripts/validate';
import { VOICES } from '../scripts/voices';
import { course, lecture, say, type Expected } from './fixtures/content/invalid/_base';

const ROOT = path.resolve(import.meta.dir, '..');
const brief = (xs: Issue[]) => xs.map((x) => `${x.level} ${x.rule} ${x.where}`).sort();

describe('今の台本', () => {
  test('全講座・全言語の台本と、テーマ・timeline の形に誤りが無い', async () => {
    const report = await validateAll();
    expect(report.issues.filter((x) => x.level === 'error').map((x) => `${x.where}  ${x.message}`)).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.videos).toBeGreaterThan(0);
    expect(report.themes).toBe(Object.keys(THEMES).length);
  });
});

describe('誤った台本（tests/fixtures/content/invalid）', () => {
  const dir = path.join(import.meta.dir, 'fixtures/content/invalid');
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.startsWith('_'));
  test('見本が 10 本以上ある', () => expect(files.length).toBeGreaterThanOrEqual(10));
  for (const f of files) {
    test(`${f} の誤りと注意を、過不足なく見つける`, async () => {
      const { COURSE, EXPECTED } = (await import(path.join(dir, f))) as { COURSE: Parameters<typeof validateCourse>[0]; EXPECTED: Expected[] };
      const got = validateCourse(COURSE);
      expect(brief(got)).toEqual(EXPECTED.map((e) => e.join(' ')).sort());
      for (const x of got) expect(x.message.length).toBeGreaterThan(0);
    });
  }
  test('土台の講座（壊す前）は、誤りも注意も 0 件', () => {
    expect(validateCourse(course([lecture([{ kind: 'big', heading: '大事なこと', text: '台本が **正本**', lines: say('台本が正本です。') }])]))).toEqual([]);
  });
});

describe('timeline と台本の形（validateTimeline）', () => {
  const lec = lecture([
    { kind: 'big', heading: '大事なこと', text: '台本が正本', lines: say('一つ目です。', '二つ目です。') },
    { kind: 'ending', closing: 'おわり', lines: say('おわりです。') },
  ]);
  const c = course([lec]);
  const tl: TimelineShape = {
    durationInFrames: 300,
    scenes: [
      { start: 0, duration: 150, lines: [{ start: 14, end: 60 }, { start: 70, end: 120 }] },
      { start: 150, duration: 150, lines: [{ start: 14, end: 60 }] },
    ],
  };
  test('形が合えば何も言わない', () => expect(validateTimeline(lec, c, tl)).toEqual([]));
  test('場面の数が違うと誤り（描くと TypeError になる）', () => {
    expect(brief(validateTimeline(lec, c, { ...tl, scenes: tl.scenes.slice(1) }))).toEqual(['error timeline invalid-sample/X01 timeline']);
  });
  test('台詞の数が違うと誤り', () => {
    const scenes = tl.scenes.map((s, i) => (i === 0 ? { ...s, lines: s.lines.slice(1) } : s));
    expect(brief(validateTimeline(lec, c, { ...tl, scenes }))).toEqual(['error timeline invalid-sample/X01 場面 1 timeline']);
  });
  test('timeline が無いのは注意（まだ合成していない）', () => {
    expect(brief(validateTimeline(lec, c, undefined))).toEqual(['warning timeline invalid-sample/X01 timeline']);
  });
});

describe('テーマ（validateTheme）', () => {
  test('今のテーマに誤りが無い', () => {
    for (const t of Object.values(THEMES)) expect(validateTheme(t)).toEqual([]);
  });
  test('#RRGGBB でない色と、足りない色の数を見つける', () => {
    const bad = { ...CHALKFILE, color: { ...CHALKFILE.color, ink: 'red' }, tones: { ...CHALKFILE.tones, amber: '#FFF' }, mesh: CHALKFILE.mesh.slice(0, 3) };
    expect(brief(validateTheme(bad, 'bad'))).toEqual(['error theme bad color.ink', 'error theme bad mesh', 'error theme bad tones.amber'].sort());
  });
});

describe('名前の一覧が、音の側の一覧と合う', () => {
  test('効果音は scripts/mix.py の SFX_DB と同じ', () => {
    const py = readFileSync(path.join(ROOT, 'scripts/mix.py'), 'utf8');
    const start = py.indexOf('SFX_DB = {');
    const block = py.slice(start, py.indexOf('}', start));
    expect([...block.matchAll(/"(\w+)":/g)].map((m) => m[1]).sort()).toEqual([...SFX_IDS].sort());
  });
  test('声は scripts/voices.ts の VOICES と同じ', () => expect(Object.keys(VOICES).sort()).toEqual([...VOICE_IDS].sort()));
});

describe('見込みと表示', () => {
  test('焼き込み字幕の行数の見込み（全角 38px・使える幅 1680px）', () => {
    expect(captionLines('あ'.repeat(40))).toBe(1);
    expect(captionLines('あ'.repeat(60))).toBe(2);
    expect(captionLines('あ'.repeat(90))).toBe(3);
    // 掛け合いの名前札のぶん、1 行に入る文字が減る
    expect(captionLines('あ'.repeat(43))).toBe(1);
    expect(captionLines('あ'.repeat(43), 'ずんだもん')).toBe(2);
  });
  test('動画 1 本だけを検証できる（synth.ts と Studio が使う）', () => {
    const lec = lecture([{ kind: 'flow', heading: '流れ', nodes: [], edges: [{ from: 'a', to: 'b', at: 0 }], lines: say('流れです。') }]);
    expect(brief(validateLecture(lec, course([lec])))).toEqual(
      ['error empty invalid-sample/X01 場面 1 flow.nodes', 'error ref invalid-sample/X01 場面 1 flow.edges[0].from', 'error ref invalid-sample/X01 場面 1 flow.edges[0].to'].sort(),
    );
  });
  test('一覧の 1 行は「止める／注意・場所・中身」', () => {
    expect(formatIssue({ level: 'error', rule: 'ref', where: 'a/X01 場面 1 flow.edges[0].to', message: '行き先が無い' })).toBe('止める  a/X01 場面 1 flow.edges[0].to  行き先が無い');
  });
});

describe('公開で止まること（PR の CI で、公開の CI より先に見つける）', () => {
  const config = readSiteConfig();
  const ja = (courses: Course[]) => (lang: Lang) => (lang === 'ja' ? courses : []);
  const lec = (id: string, patch: Partial<Lecture> = {}) => lecture([{ kind: 'big', heading: '大事なこと', text: '台本', lines: say('台本です。') }], { id, ...patch });

  test('今の講座サイトの設定・教材・ポスター・動画の一覧には、止まるものが無い', () => {
    expect(publishIssues(COURSES, coursesIn)).toEqual([]);
  });
  test('講座サイトの設定・ID・リンクの確かめ（build_site.ts にあったもの）は、文言もそのまま', () => {
    const bad = course([lec('X 01', { docs: [{ title: '公式', url: 'http://example.com/' }] })], {
      id: 'bad course',
      links: [{ label: '関連', url: 'javascript:alert(1)' }],
      sources: [{ id: 's1', publisher: '公式', year: '2026', title: '仕様', url: 'http://example.com/spec', kind: 'official', checked: '2026-11-03', note: '見本' }],
      headline: `版の印 ${PAGE_VERSION_MARK} を書いた`,
    });
    const media = { en: { url: 'https://example.com/media/en/', repo: 'https://github.com/sean-sunagaku/chalkfile' }, zh: { url: 'https://chalkfile.com/stripe-billing/zh/', repo: 'https://github.com/sean-sunagaku/chalkfile' } };
    expect(siteProblems({ ...config, baseUrl: 'http://chalkfile.com/', media }, ja([bad]), [{ ...THEMES.chalkfile, id: 'bad theme' }])).toEqual([
      'site/config.json の baseUrl と repoUrl は https:// で書く',
      'site/config.json の media.en.url は baseUrl と同じ origin にする: https://example.com/media/en/',
      'site/config.json の media.zh.url は baseUrl と同じ origin にする: https://chalkfile.com/stripe-billing/zh/',
      '講座 ID が英数字でない: bad course',
      'bad course のリンクが https:// でない: javascript:alert(1)',
      'レクチャー ID が英数字でない: X 01',
      'X 01 の公式ドキュメントのリンクが https:// でない: http://example.com/',
      'bad course の出典のリンクが https:// でない: http://example.com/spec',
      `bad course の台本に、版の印と同じ文字 ${PAGE_VERSION_MARK} がある`,
      'テーマ ID が英数字でない: bad theme',
    ]);
    // 訳の動画のサイトは、講座 ID・言語のフォルダと重ねない
    const inCourse = { ...config, media: { en: { url: 'https://chalkfile.com/stripe-billing/', repo: 'https://github.com/sean-sunagaku/chalkfile' } } };
    expect(siteProblems(inCourse, coursesIn)).toEqual(['site/config.json の media.en.url は、講座サイトを含まず、講座 ID・言語のフォルダと重ならない場所にする: https://chalkfile.com/stripe-billing/']);
    expect(siteProblems(config, coursesIn)).toEqual([]);
  });
  test('教材の ID の重なりと、質問例の参照先の抜け（build_materials.ts にあったもの）を、全部まとめて返す', () => {
    const c = structuredClone(NUDGE_PRODUCT);
    const m = c.lectures[0].material;
    if (!m) throw new Error('nudge-product の 1 本目に教材が無い');
    // 1 つ目の節を写して同じ ID の節を足し、参照先の無い質問例を足す（台本のほかの所には頼らない）
    m.sections.push({ ...m.sections[0] });
    m.askExamples.push({ q: '見本の質問', refs: ['no-such-section'] });
    expect(materialProblems(c)).toEqual([`nudge-product: ID が重なっている: ${m.sections[0].id}`, `${c.lectures[0].id}: 質問例の参照先が無い: no-such-section`]);
    expect(materialProblems(NUDGE_PRODUCT)).toEqual([]);
  });
  test('公開する言語の全部の動画のポスターを見る（無ければ止める。公開しない言語は見ない）', () => {
    const c = course([lec('X01'), lec('X02', { no: 2 })]);
    const got = posterProblems({ ...config, publishLangs: ['ja'] }, ja([c]), (key) => key === 'X01');
    expect(got.map((x) => `${x.level} ${x.rule} ${x.where}`)).toEqual(['error poster invalid-sample/X02']);
    expect(got[0].message).toContain('site/posters/X02.jpg');
    expect(posterProblems({ ...config, publishLangs: ['ja'] }, (lang) => (lang === 'en' ? [c] : []), () => false)).toEqual([]);
    expect(posterProblems(config, coursesIn)).toEqual([]);
  });
  test('動画の一覧に、通常版は全部、掛け合いの講座（cast）は字幕を焼き込んだ版もあるか', () => {
    const entry = (lecture: string, kind: MediaEntry['kind']) => {
      const e = { lang: 'ja', course: 'invalid-sample', lecture, kind, bytes: 1, sha256: 'a'.repeat(64), tag: 'media-ja-invalid-sample' };
      return { ...e, filename: mediaFilename(e) };
    };
    const manifest: MediaManifest = { schema: 1, entries: [entry('X01', 'standard'), entry('X01', 'captioned'), entry('X02', 'standard')] };
    const plain = course([lec('X01'), lec('X02', { no: 2 }), lec('X03', { no: 3 })]);
    const brief2 = (xs: PublishIssue[]) => xs.map((x) => `${x.rule} ${x.where} ${x.message.includes('通常版') ? 'standard' : 'captioned'}`);
    expect(brief2(mediaProblems(config, ja([plain]), manifest))).toEqual(['media invalid-sample/X03 standard']);
    const cast = { ...plain, cast: { zundamon: { name: 'ずんだもん', tone: 'mint' as const } } };
    expect(brief2(mediaProblems(config, ja([cast]), manifest))).toEqual(['media invalid-sample/X02 captioned', 'media invalid-sample/X03 standard', 'media invalid-sample/X03 captioned']);
  });
});
