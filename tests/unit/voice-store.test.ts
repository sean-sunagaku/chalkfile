// 声の置き場所（scripts/stages/voice/store.ts）と、Kokoro の足りない台詞・声の記録（scripts/stages/voice/kokoro.ts）。
// ファイルは一時のフォルダにだけ書く。Kokoro そのもの（uv と Python）は流さない

import { afterAll, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Video } from '../../content';
import { kokoroJobs, kokoroJobsJson, kokoroVersion, writeMetas } from '../../scripts/stages/voice/kokoro';
import {
  metaJson,
  readMeta,
  readVoice,
  type VoiceMeta,
  type VoiceStore,
  versionsOf,
  writeVoice,
} from '../../scripts/stages/voice/store';
import { recipeIn, ttsKeysIn } from '../../scripts/voices';
import { course, lecture } from '../fixtures/content/invalid/_base';
import { required } from '../support/required';

const sandbox = mkdtempSync(path.join(os.tmpdir(), 'chalkfile-voice-store-'));
afterAll(() => rmSync(sandbox, { recursive: true, force: true }));
let n = 0;
const storeOf = (): VoiceStore => {
  const dir = path.join(sandbox, `s${++n}`);
  return { cache: path.join(dir, 'cache'), local: path.join(dir, 'local') };
};
/** 無音の WAV（48kHz・モノラル・16bit） */
const wav = (sec: number) => {
  const data = Buffer.alloc(Math.round(sec * 48000) * 2);
  const head = Buffer.alloc(44);
  head.write('RIFF', 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write('WAVEfmt ', 8);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(48000, 24);
  head.writeUInt32LE(96000, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write('data', 36);
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
};
const meta = (key: string, engineVersion: string): VoiceMeta => ({
  schema: 1,
  key,
  text: 'こんにちは。',
  recipe: recipeIn('narrator', 'ja'),
  engineVersion,
});

describe('声の記録（<鍵>.meta.json。読みの隣）', () => {
  test('作った声は、音声・記録・読みを書き、読むときに記録も読む（v1 の声は記録なし）', () => {
    const store = storeOf();
    writeVoice(store, 'k2', wav(1), 'カナ', meta('k2', '0.25.0'));
    expect(readFileSync(path.join(store.cache, 'k2.meta.json'), 'utf8')).toBe(metaJson(meta('k2', '0.25.0')));
    expect(readVoice(store, ['k2'])).toMatchObject({
      key: 'k2',
      sec: 1,
      kana: 'カナ',
      meta: { engineVersion: '0.25.0' },
    });
    // 記録の無い声（前の名前の v1）も使える
    mkdirSync(store.local, { recursive: true });
    writeFileSync(path.join(store.local, 'k1.wav'), wav(0.5));
    writeFileSync(path.join(store.local, 'k1.kana'), 'カナ');
    const v1 = readVoice(store, ['nothing', 'k1']);
    expect(v1).toMatchObject({ key: 'k1', sec: 0.5 });
    expect(v1?.meta).toBeUndefined();
  });
  test('記録の形はキーの並びまで決まっている（同じ声なら同じバイト列）。形が違う・鍵が違う記録は読まない', () => {
    const shuffled = {
      engineVersion: '0.25.0',
      text: 'こんにちは。',
      key: 'k',
      schema: 1 as const,
      recipe: recipeIn('narrator', 'ja'),
    };
    expect(metaJson(shuffled)).toBe(metaJson(meta('k', '0.25.0')));
    expect(metaJson(meta('k', '0.25.0')).startsWith('{\n "schema": 1,\n "key": "k",\n "text": ')).toBe(true);
    const dir = path.join(sandbox, 'bad-meta');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'a.meta.json'), metaJson(meta('b', '0.25.0')));
    writeFileSync(path.join(dir, 'c.meta.json'), '{"schema":2}');
    writeFileSync(path.join(dir, 'd.meta.json'), '{');
    for (const key of ['a', 'c', 'd', 'none']) expect(readMeta(dir, key)).toBeUndefined();
  });
  test('動画の声のエンジンの版を数える（記録の無い声は数えない）', () => {
    const v = (key: string, version?: string) => ({
      key,
      file: `.work/tts/${key}.wav`,
      sec: 1,
      kana: '',
      ...(version ? { meta: meta(key, version) } : {}),
    });
    expect([
      ...versionsOf([
        [v('a', '0.24.1'), v('b')],
        [v('c', '0.25.0'), v('d', '0.24.1')],
      ]),
    ]).toEqual([
      ['0.24.1', 2],
      ['0.25.0', 1],
    ]);
  });
});

describe('Kokoro の足りない台詞と声の記録', () => {
  const lec = lecture([
    { kind: 'opening', title: 'Sample', lines: [{ t: 'Hello.', v: 'announcer' }] },
    { kind: 'ending', closing: 'Bye', lines: [{ t: 'Bye.' }, { t: 'Bye.' }] },
  ]);
  const video: Video = { key: 'X01.en', lang: 'en', lecture: lec, course: course([lec]) };
  test('v2 → v1 の順に探して、どちらも無い台詞だけを、v2 の鍵で 1 本ずつ作る（同じ台詞は 1 本）', () => {
    const store = storeOf();
    const [hello2, hello1] = ttsKeysIn('Hello.', 'announcer', 'en');
    const [bye2] = ttsKeysIn('Bye.', 'narrator', 'en');
    // Hello. は前の名前（v1）の声がある
    mkdirSync(store.local, { recursive: true });
    writeFileSync(path.join(store.local, `${hello1}.wav`), wav(0.5));
    writeFileSync(path.join(store.local, `${hello1}.kana`), 'həlˈO');
    const jobs = kokoroJobs(store, [video]);
    expect(jobs.map((j) => [j.key, j.text, j.voice, j.speed])).toEqual([[bye2, 'Bye.', 'af_heart', 1]]);
    expect(required(jobs[0]).recipe as unknown).toEqual(recipeIn('narrator', 'en'));
    expect(hello2).not.toBe(hello1);
  });
  test('Kokoro が書き終えた声（音声と読みがそろったもの）にだけ、レシピと依存の版の記録を置く', () => {
    const store = storeOf();
    const jobs = kokoroJobs(store, [video]);
    expect(jobs).toHaveLength(2);
    // 1 本目だけ、Kokoro が書き終えた
    mkdirSync(store.cache, { recursive: true });
    writeFileSync(path.join(store.cache, `${required(jobs[0]).key}.wav`), wav(1));
    writeFileSync(path.join(store.cache, `${required(jobs[0]).key}.kana`), 'həlˈO');
    writeMetas(store, jobs, 'kokoro==0.9.4');
    expect(readMeta(store.cache, required(jobs[0]).key)).toEqual({
      schema: 1,
      key: required(jobs[0]).key,
      text: required(jobs[0]).text,
      recipe: required(jobs[0]).recipe,
      engineVersion: 'kokoro==0.9.4',
    });
    expect(readMeta(store.cache, required(jobs[1]).key)).toBeUndefined();
  });
  test.skipIf(!Bun.which('python3'))(
    'Kokoro の仕事のファイルは { schema, jobs } の形で、scripts/audio/handoff.py の read_kokoro_jobs で読める（レシピは渡さない）',
    () => {
      const jobs = kokoroJobs(storeOf(), [video]);
      const text = kokoroJobsJson(jobs);
      expect(JSON.parse(text)).toEqual({ schema: 1, jobs: jobs.map(({ recipe: _, ...j }) => j) });
      const file = path.join(sandbox, 'jobs.json');
      writeFileSync(file, text);
      const py = [
        'import sys',
        "sys.path.insert(0, 'scripts')",
        'from pathlib import Path',
        'from audio.handoff import read_kokoro_jobs',
        'jobs = read_kokoro_jobs(Path(sys.argv[1]))',
        "print(len(jobs), jobs[0]['key'], jobs[0]['voice'])",
      ].join('\n');
      const r = Bun.spawnSync(['python3', '-c', py, file], { cwd: path.resolve(import.meta.dir, '../..') });
      expect(r.stdout.toString().trim()).toBe(`2 ${required(jobs[0]).key} ${required(jobs[0]).voice}`);
    },
  );
  test('Kokoro の版は、scripts/tts_kokoro.py の頭書きで固定した依存の版', () => {
    expect(kokoroVersion()).toMatch(/^kokoro==[\d.]+ misaki\[en,zh\]==[\d.]+ .*torch==[\d.]+/);
    const file = path.join(sandbox, 'tts.py');
    writeFileSync(file, '# /// script\n# dependencies = [\n#   "kokoro==1.0",\n#   "numpy",\n# ]\n# ///\n');
    expect(kokoroVersion(file)).toBe('kokoro==1.0');
    writeFileSync(file, '"""頭書きが無い"""\n');
    expect(() => kokoroVersion(file)).toThrow('依存の版');
  });
});
