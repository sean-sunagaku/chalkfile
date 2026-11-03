import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { CHALKFILE, THEMES } from '../content/themes';
import { captionLines, formatIssue, SFX_IDS, validateCourse, validateLecture, validateTheme, validateTimeline, VOICE_IDS, type Issue, type TimelineShape } from '../engine/core/validate';
import { validateAll } from '../scripts/validate';
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
