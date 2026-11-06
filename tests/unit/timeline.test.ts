// 動画ごとの timeline（content/<講座>/generated/timeline/<key>.json）の形・書き方・指紋と、置いてあるファイルの確かめ

import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { VIDEOS } from '../../content';
import type { Lecture } from '../../content/types';
import { parseTimelineFile, timelineFile } from '../../engine/core/generated';
import { sha256Hex } from '../../engine/core/hash';
import {
  parseTimeline,
  TIMELINE_SCHEMA,
  type TimelineFile,
  timelineEntry,
  timelineFingerprint,
  timelineJson,
} from '../../engine/core/timeline';
import { validateTimeline, validateTimelineFiles } from '../../engine/core/validate';
import { readTimelineEntries, timelineFiles } from '../../scripts/timelines';
import { course, lecture, say } from '../fixtures/content/invalid/_base';
import { required } from '../support/required';

const ROOT = path.resolve(import.meta.dir, '../..');
const brief = (xs: { level: string; rule: string; where: string }[]) =>
  xs.map((x) => `${x.level} ${x.rule} ${x.where}`).sort();

describe('SHA-256（engine/core/hash.ts。Remotion と bun で同じ値にする）', () => {
  test('node:crypto と同じ（空・ブロックの境目・日本語と絵文字・長い文）', () => {
    for (const text of [
      '',
      'abc',
      'a'.repeat(55),
      'a'.repeat(56),
      'a'.repeat(64),
      'a'.repeat(119),
      'あいう🎉'.repeat(50),
      JSON.stringify(required(VIDEOS[0]).lecture),
    ]) {
      expect(sha256Hex(text)).toBe(createHash('sha256').update(text).digest('hex'));
    }
  });
});

describe('置き場所（engine/core/generated.ts）', () => {
  test('講座のフォルダの generated/timeline/<key>.json。パスから講座と動画の名前に戻せる', () => {
    expect(timelineFile('ga4-comedy', 'G01')).toBe('content/ga4-comedy/generated/timeline/G01.json');
    expect(parseTimelineFile('content/rive-comedy/generated/timeline/R01.en.json')).toEqual({
      course: 'rive-comedy',
      key: 'R01.en',
    });
    expect(parseTimelineFile('src/generated/timeline.json')).toBeNull();
  });
});

const lec = lecture([
  { kind: 'opening', title: '見本', lines: say('はじめます。') },
  {
    kind: 'big',
    heading: '大事なこと',
    text: '台本が正本',
    lines: [
      { t: '一つ目です。', s: 'ひとつめです。' },
      { t: '二つ目です。', pause: 0.2 },
    ],
  },
  { kind: 'ending', closing: 'おわり', lines: say('おわりです。') },
]);
const c = course([lec]);
const testScene = (value: Lecture, scene: number) => required(value.scenes[scene]);
const testLine = (value: Lecture, scene: number, line: number) => required(testScene(value, scene).lines[line]);
const file = (patch: Partial<TimelineFile> = {}): TimelineFile => ({
  schema: TIMELINE_SCHEMA,
  key: 'X01',
  fps: 30,
  durationInFrames: 400,
  fingerprint: timelineFingerprint(lec, 'ja'),
  scenes: [
    { start: 0, duration: 150, lines: [{ start: 61, end: 120 }] },
    {
      start: 150,
      duration: 150,
      lines: [
        { start: 14, end: 60 },
        { start: 70, end: 120 },
      ],
    },
    { start: 300, duration: 100, lines: [{ start: 14, end: 60 }] },
  ],
  ...patch,
});

describe('指紋（時刻に効く入力のハッシュ）', () => {
  const fp = (change: (l: Lecture) => void, lang: 'ja' | 'en' = 'ja') => {
    const l = structuredClone(lec);
    change(l);
    return timelineFingerprint(l, lang);
  };
  const base = timelineFingerprint(lec, 'ja');
  test('16 字の 16 進で、同じ台本なら同じ', () => {
    expect(base).toMatch(/^[0-9a-f]{16}$/);
    expect(fp(() => {})).toBe(base);
  });
  test('読み・声・間・効果音・BGM・hold・場面の種類が変わると変わる', () => {
    const changes: [string, (l: Lecture) => void][] = [
      [
        '読み（s）',
        (l) => {
          testLine(l, 1, 0).s = 'ひとつめ。';
        },
      ],
      [
        '読み（s の無い台詞の t）',
        (l) => {
          testLine(l, 1, 1).t = '二つ目でした。';
        },
      ],
      [
        '声',
        (l) => {
          testLine(l, 1, 0).v = 'zundamon';
        },
      ],
      [
        'pause',
        (l) => {
          testLine(l, 1, 1).pause = 0.3;
        },
      ],
      [
        'sfx',
        (l) => {
          testLine(l, 1, 0).sfx = 'pop';
        },
      ],
      [
        'sfxAfter',
        (l) => {
          testLine(l, 1, 0).sfxAfter = 'chin';
        },
      ],
      [
        'bgm',
        (l) => {
          testLine(l, 1, 0).bgm = 'cut';
        },
      ],
      [
        'hold',
        (l) => {
          testScene(l, 1).hold = 2;
        },
      ],
      [
        '場面の種類',
        (l) => {
          l.scenes[1] = { kind: 'goals', items: [], lines: testScene(l, 1).lines };
        },
      ],
      [
        '台詞の数',
        (l) => {
          testScene(l, 1).lines.pop();
        },
      ],
    ];
    for (const [what, change] of changes) expect(`${what} ${fp(change) !== base}`).toBe(`${what} true`);
  });
  test('読みの決まっている台詞の画面の文字（t）・見出しは入らない（時刻に効かない）', () => {
    expect(
      fp((l) => {
        testLine(l, 1, 0).t = '一つ目の文を直した。';
      }),
    ).toBe(base);
    expect(
      fp((l) => {
        testScene(l, 1).heading = '見出しを直した';
      }),
    ).toBe(base);
  });
  test('訳の動画は、その言語の声（Kokoro）で作る', () => {
    expect(timelineFingerprint(lec, 'en')).not.toBe(base);
  });
});

describe('ファイルの形と書き方', () => {
  test('同じ場面でも場面をまたいでも、台詞の開始時刻が逆順なら止める', () => {
    const reversed = file({
      scenes: [
        {
          start: 0,
          duration: 100,
          lines: [
            { start: 20, end: 30 },
            { start: 10, end: 40 },
          ],
        },
      ],
    });
    expect(() => parseTimeline(reversed, 'x.json')).toThrow('場面 1 の台詞 2 の開始時刻が前の台詞より早い');
    const acrossScenes = file({
      scenes: [
        { start: 0, duration: 100, lines: [{ start: 120, end: 140 }] },
        { start: 100, duration: 100, lines: [{ start: 10, end: 40 }] },
      ],
    });
    expect(() => parseTimeline(acrossScenes, 'x.json')).toThrow('場面 2 の台詞 1 の開始時刻が前の台詞より早い');
  });
  test('同時に始まる台詞と、終わる前に次が始まる台詞は保つ', () => {
    const overlap = file({
      scenes: [
        {
          start: 0,
          duration: 100,
          lines: [
            { start: 10, end: 50 },
            { start: 10, end: 60 },
            { start: 20, end: 70 },
          ],
        },
      ],
    });
    expect(parseTimeline(overlap, 'x.json')).toBe(overlap);
  });
  test('キーを並べ、2 スペースで字下げし、最後に改行。読み直すと同じ', () => {
    const text = timelineJson(file());
    expect(text.endsWith('}\n')).toBe(true);
    expect(text.split('\n').slice(1, 6)).toEqual([
      '  "durationInFrames": 400,',
      `  "fingerprint": "${file().fingerprint}",`,
      '  "fps": 30,',
      '  "key": "X01",',
      '  "scenes": [',
    ]);
    expect(timelineJson(parseTimeline(JSON.parse(text), 'x'))).toBe(text);
  });
  test('形の違うファイルは、どこが違うかを言って止める', () => {
    const bad: [unknown, string][] = [
      [null, 'JSON のオブジェクトでない'],
      [{ ...file(), schema: 2 }, 'schema が 1 でない'],
      [{ ...file(), fps: 0 }, 'fps が正の整数でない'],
      [{ ...file(), fingerprint: 'abc' }, 'fingerprint が 16 字の 16 進でない'],
      [{ ...file(), scenes: [] }, 'scenes が無い'],
      [
        { ...file(), scenes: [{ start: 0, duration: 10, lines: [{ start: 1.5, end: 2 }] }] },
        '場面 1 の台詞 1 の start・end が整数でない',
      ],
    ];
    for (const [value, message] of bad) expect(() => parseTimeline(value, 'x.json')).toThrow(`x.json: ${message}`);
  });
  test('置いてあるファイルは、置き場所・読めるか・中の key とファイルの名前が合うかを見る', () => {
    expect(timelineEntry('content/c/generated/timeline/X01.json', file()).timeline?.key).toBe('X01');
    expect(timelineEntry('content/c/generated/timeline/X02.json', file()).error).toContain(
      '中の key（X01）がファイルの名前と違う',
    );
    expect(timelineEntry('content/c/generated/timeline/X01.json', new Error('Unexpected token')).error).toContain(
      '読めない',
    );
    expect(timelineEntry('src/generated/timeline.json', {}).error).toContain('timeline の置き場所');
  });
});

describe('台本と照らし合わせる（validateTimeline・validateTimelineFiles）', () => {
  const entry = (patch: Partial<TimelineFile> = {}, at = 'invalid-sample') =>
    timelineEntry(`content/${at}/generated/timeline/X01.json`, file(patch));
  test('合えば何も言わない', () => {
    expect(validateTimeline(lec, c, file())).toEqual([]);
    expect(validateTimelineFiles(lec, c, [entry()])).toEqual([]);
  });
  test('指紋が今の台本と違えば「timeline が古い」（台本を直したのに合成し直していない）', () => {
    const got = validateTimeline(lec, c, file({ fingerprint: '0'.repeat(16) }));
    expect(brief(got)).toEqual(['error timeline invalid-sample/X01 timeline']);
    expect(required(got[0]).message).toContain('timeline が古い');
    expect(required(got[0]).message).toContain('bun scripts/synth.ts X01');
  });
  test('fps が動画と違う・場面が続いていない・長さが場面の終わりと違うと誤り', () => {
    expect(required(validateTimeline(lec, c, file({ fps: 60 }))[0]).message).toContain('fps（60）');
    const gap = file();
    required(gap.scenes[2]).start = 310;
    expect(required(validateTimeline(lec, c, gap)[0]).message).toContain('前の場面の終わり（300）と続いていない');
    expect(required(validateTimeline(lec, c, file({ durationInFrames: 401 }))[0]).message).toContain(
      '動画の長さ（401）',
    );
  });
  test('ファイルが無ければ注意、2 つ以上・置き場所が違う・読めないときは誤り', () => {
    expect(brief(validateTimelineFiles(lec, c, []))).toEqual(['warning timeline invalid-sample/X01 timeline']);
    expect(required(validateTimelineFiles(lec, c, [entry(), entry({}, 'other')])[0]).message).toContain(
      '2 つ以上の講座のフォルダにある',
    );
    expect(required(validateTimelineFiles(lec, c, [entry({}, 'other')])[0]).message).toContain('置き場所が違う');
    expect(required(validateTimelineFiles(lec, c, [entry({ schema: 9 as 1 })])[0]).message).toContain(
      'schema が 1 でない',
    );
  });
});

describe('置いてある timeline（content/<講座>/generated/timeline）', () => {
  const entries = readTimelineEntries();
  test('全部の動画に 1 つずつあり、台本に無い動画のファイルは無い', () => {
    expect(entries.map((e) => e.key).sort()).toEqual(VIDEOS.map((v) => v.key).sort());
    for (const v of VIDEOS) expect(timelineFiles()).toContain(timelineFile(v.course.id, v.key));
  });
  test('どれも synth と同じ書き方（読み直して書くと同じバイト）で、台本と合う（指紋も今の台本と同じ）', () => {
    for (const e of entries) {
      const v = VIDEOS.find((x) => x.key === e.key);
      if (!e.timeline || !v) throw new Error(e.error ?? `台本に無い: ${e.file}`);
      expect(readFileSync(path.join(ROOT, e.file), 'utf8')).toBe(timelineJson(e.timeline));
      expect(validateTimelineFiles(v.lecture, v.course, [e]).map((x) => x.message)).toEqual([]);
    }
  });
});
