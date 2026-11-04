// TS の道具が書き、Python の道具が読む JSON（受け渡し。形は scripts/lib/handoff.ts、読む側は scripts/audio/handoff.py）。
// TS の型で書いたものを Python の側が読めるか、形の違うものを読める文で止めるか、版（schema）の数が同じかを、python3 で読んで確かめる。
// 効果音の一覧（content/sfx.ts）と、その書き出し（scripts/audio/sfx.json）・合成（scripts/audio/music/sfx.py）・台本の検証の一覧も比べる
import { required } from '../support/required';
import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SFX } from '../../content/sfx';
import { KOKORO } from '../../content/voices';
import { SFX_IDS } from '../../engine/core/validate';
import { type KokoroJobs, type Plan, SCHEMA, SFX_JSON, type Speech, sfxJson } from '../../scripts/lib/handoff';

const ROOT = path.resolve(import.meta.dir, '../..');
const python = Bun.which('python3');
const dir = mkdtempSync(path.join(os.tmpdir(), 'chalkfile-handoff-test-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** Python の側（scripts/audio/handoff.py）で読む。読めたら ok、形が違えば HandoffError の文を返す */
const DRIVER = `
import json, sys
from pathlib import Path
sys.path.insert(0, "scripts")
from audio.handoff import SCHEMA, HandoffError, read_kokoro_jobs, read_plan, read_sfx, read_speech
kind = sys.argv[1]
if kind == "schema":
    print(json.dumps(SCHEMA, sort_keys=True))
    raise SystemExit(0)
file = Path(sys.argv[2])
try:
    if kind == "plan":
        read_plan(file, read_sfx())
    elif kind == "speech":
        read_speech(file)
    elif kind == "kokoro":
        read_kokoro_jobs(file)
    else:
        print(json.dumps(read_sfx(file), sort_keys=True))
        raise SystemExit(0)
    print("ok")
except HandoffError as e:
    print(f"HandoffError: {e}")
`;
const readInPython = (kind: string, name: string, data: unknown): string => {
  const file = path.join(dir, name);
  writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data));
  const r = Bun.spawnSync([python ?? 'python3', '-B', '-c', DRIVER, kind, file], { cwd: ROOT, stdin: 'ignore' });
  if (r.exitCode !== 0) throw new Error(`python3 が失敗した: ${r.stderr.toString()}`);
  return r.stdout.toString().trim();
};

// TS の型どおりの見本（時刻は、synth.ts が書くのと同じく整数と小数が混ざる）
const PLAN: Plan = {
  schema: SCHEMA.plan,
  id: 'X01',
  duration: 12.5,
  scenes: [
    {
      kind: 'opening',
      start: 0,
      end: 4.2,
      lines: [{ file: '.work/tts/0123456789abcdef.wav', start: 2.0333, end: 3.9, pauseAfter: 0.3 }],
    },
    {
      kind: 'quiz',
      start: 4.2,
      end: 12.5,
      lines: [
        {
          file: '.work/tts/fedcba9876543210.wav',
          start: 5,
          end: 7.25,
          pauseAfter: 0.6,
          sfx: 'harisen',
          sfxAfter: 'chin',
          bgm: 'cut',
        },
        { file: '.work/tts/00ff00ff00ff00ff.wav', start: 8, end: 11, pauseAfter: 0.3, bgm: 'back' },
      ],
    },
  ],
};
const SPEECH: Speech = {
  schema: SCHEMA.speech,
  key: 'X01.en',
  lang: 'en',
  lines: [
    {
      at: 's1-1',
      voice: 'zundamon',
      t: 'Hello **world**.',
      speech: 'Hello world.',
      file: '.work/tts/0123456789abcdef.wav',
    },
  ],
};
const JOBS: KokoroJobs = {
  schema: SCHEMA.kokoroJobs,
  jobs: [
    { key: '0123456789abcdef', text: 'Hello.', ...KOKORO.en.narrator },
    { key: 'fedcba9876543210', text: '你好。', ...KOKORO.zh.tennokoe },
  ],
};
type Json = Record<string, unknown>;
const planWith = (edit: (p: Json & { scenes: Json[] }) => void) => {
  const p = structuredClone(PLAN) as unknown as Json & { scenes: Json[] };
  edit(p);
  return p;
};
const firstLine = (p: { scenes: Json[] }) => required((required(p.scenes[1]).lines as Json[])[0]);

describe.skipIf(!python)('Python の側（scripts/audio/handoff.py）が、TS の型で書いたものを読む', () => {
  test('版（schema）の数が、TS の SCHEMA と同じ', () => {
    const r = Bun.spawnSync([python ?? 'python3', '-B', '-c', DRIVER, 'schema'], { cwd: ROOT, stdin: 'ignore' });
    expect(JSON.parse(r.stdout.toString())).toEqual({ ...SCHEMA });
  });
  test('型どおりの設計図・聞き取りの対応・Kokoro の仕事を読める（schema を書く前の形も）', () => {
    expect(readInPython('plan', 'X01.json', PLAN)).toBe('ok');
    expect(readInPython('speech', 'X01.en.json', SPEECH)).toBe('ok');
    expect(readInPython('kokoro', 'jobs.json', JOBS)).toBe('ok');
    const { schema: _p, ...legacyPlan } = PLAN;
    const { schema: _s, ...legacySpeech } = SPEECH;
    expect(readInPython('plan', 'X01.json', legacyPlan)).toBe('ok');
    expect(readInPython('speech', 'X01.en.json', legacySpeech)).toBe('ok');
    expect(readInPython('kokoro', 'jobs.json', JOBS.jobs)).toBe('ok');
  });
  test('形の違う設計図は、ファイルと項目の場所を書いた文で止める（KeyError などで落ちない）', () => {
    const cases: [Json, string][] = [
      [
        { ...PLAN, schema: 2 },
        'X01.json: 形の版（schema）が 2。この道具が読めるのは 1（書いた道具と読む道具の版を合わせる）',
      ],
      [planWith((p) => delete p.duration), 'X01.json: duration が無い'],
      [planWith((p) => (firstLine(p).start = '5')), "X01.json: scenes[1].lines[0].start は数にする（今は 文字: '5'）"],
      [
        planWith((p) => (firstLine(p).start = true)),
        'X01.json: scenes[1].lines[0].start は数にする（今は 真偽: True）',
      ],
      [
        planWith((p) => (firstLine(p).bgm = 'stop')),
        "X01.json: scenes[1].lines[0].bgm は cut・back のどれか（今は 'stop'）",
      ],
      [
        planWith((p) => (firstLine(p).sfxAfter = 'boing')),
        'X01.json: scenes[1].lines[0].sfxAfter の効果音「boing」が一覧（content/sfx.ts）に無い',
      ],
      [planWith((p) => (p.scenes = {} as unknown as Json[])), 'X01.json: scenes は配列にする（今は オブジェクト）'],
      [planWith((p) => (p.id = 'X02')), "X01.json: id が 'X02'（ファイルの名前の 'X01' と同じにする）"],
    ];
    for (const [data, message] of cases)
      expect(readInPython('plan', 'X01.json', data)).toBe(`HandoffError: ${message}`);
    expect(readInPython('plan', 'X01.json', '{"id": ')).toStartWith(
      'HandoffError: ミックスの設計図（X01.json）が JSON として読めない',
    );
  });
  test('形の違う聞き取りの対応と Kokoro の仕事も止める', () => {
    const { file: _f, ...noFile } = required(SPEECH.lines[0]);
    expect(readInPython('speech', 'X01.en.json', { ...SPEECH, lines: [noFile] })).toBe(
      'HandoffError: X01.en.json: lines[0].file が無い',
    );
    const badG2p = [{ ...JOBS.jobs[0], g2p: 'x' }];
    expect(readInPython('kokoro', 'jobs.json', badG2p)).toBe(
      "HandoffError: jobs.json: jobs[0].g2p は a・b・z のどれか（今は 'x'）",
    );
    expect(readInPython('kokoro', 'jobs.json', { ...JOBS, schema: 0 })).toStartWith(
      'HandoffError: jobs.json: 形の版（schema）が 0',
    );
  });
  test('効果音の一覧（scripts/audio/sfx.json）を、名前と音量（dB）で読む', () => {
    const got = JSON.parse(readInPython('sfx', 'sfx.json', readFileSync(path.join(ROOT, SFX_JSON), 'utf8')));
    expect(got).toEqual(Object.fromEntries(Object.entries(SFX).map(([name, s]) => [name, s.db])));
  });
});

describe('効果音の一覧（正本は content/sfx.ts）', () => {
  test('scripts/audio/sfx.json が、content/sfx.ts から作ったものと同じ（ずれたら npm run gen で作り直す）', () => {
    expect(readFileSync(path.join(ROOT, SFX_JSON), 'utf8')).toBe(sfxJson());
  });
  test('合成（scripts/audio/music/sfx.py の SFX）と台本の検証（SFX_IDS）が、同じ名前を持つ', () => {
    const py = readFileSync(path.join(ROOT, 'scripts/audio/music/sfx.py'), 'utf8');
    const start = py.indexOf('\nSFX = {');
    const block = py.slice(start, py.indexOf('}', start));
    const names = Object.keys(SFX).sort();
    expect([...block.matchAll(/"(\w+)":/g)].map((m) => m[1]).sort()).toEqual(names);
    expect([...SFX_IDS].sort() as string[]).toEqual(names);
  });
  test('mix.py は、音量を一覧から読む（mix.py に音量の表を書かない）', () => {
    const py = readFileSync(path.join(ROOT, 'scripts/mix.py'), 'utf8');
    expect(py).toContain('read_sfx()');
    expect(py).not.toMatch(/"harisen":\s*-?\d/);
  });
});
