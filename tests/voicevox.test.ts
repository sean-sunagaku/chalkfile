// VOICEVOX の呼び出し（scripts/stages/voice/voicevox.ts）と、synth の声のそろえ方を、偽の VOICEVOX（手元の HTTP サーバー）で確かめる。
// 本物のエンジンにはつながない。止まったままのエンジン・つながらないエンジン・5xx・4xx・正しい応答を作る
import { afterAll, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Video } from '../content';
import { MissingError, UsageError } from '../scripts/lib/args';
import { outDirs } from '../scripts/stages/timeline/emit';
import { kanaOf, timeoutFromEnv, voicevox } from '../scripts/stages/voice/voicevox';
import { type Ctx, synthVideos } from '../scripts/synth';
import { ttsKeysIn, voicevoxRecipe } from '../scripts/voices';
import { course, lecture } from './fixtures/content/invalid/_base';

const sandbox = mkdtempSync(path.join(os.tmpdir(), 'chalkfile-voicevox-test-'));
const servers: { stop: (force?: boolean) => void }[] = [];
afterAll(() => {
  for (const s of servers) s.stop(true);
  rmSync(sandbox, { recursive: true, force: true });
});

/** 偽の VOICEVOX を立てて、URL を返す */
const fake = (handler: (path: string, req: Request) => Response | Promise<Response>) => {
  const server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: (req) => handler(new URL(req.url).pathname, req) });
  servers.push(server);
  return `http://127.0.0.1:${server.port}`;
};
/** 何も答えないエンジン（つながるが、止まったまま） */
const hung = () => fake(() => new Promise<Response>(() => {}));
/** 立っていないエンジン（つながらない） */
const absent = () => {
  const server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: () => new Response('') });
  const url = `http://127.0.0.1:${server.port}`;
  server.stop(true);
  return url;
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
const QUERY = {
  accent_phrases: [
    { moras: [{ text: 'コ' }, { text: 'ン' }], pause_mora: { text: '、' } },
    { moras: [{ text: 'ニ' }, { text: 'チ' }, { text: 'ワ' }], pause_mora: null },
  ],
  speedScale: 1,
};
/** 正しく答えるエンジン。calls に問い合わせを数え、bodies に synthesis に渡した設計を残す。fail は、最初の何回かを失敗させる */
const working = (fail: Partial<Record<string, number[]>> = {}) => {
  const calls: Record<string, number> = {};
  const bodies: Record<string, unknown>[] = [];
  const queries: string[] = [];
  const url = fake(async (p, req) => {
    const name = p.slice(1);
    calls[name] = (calls[name] ?? 0) + 1;
    const status = fail[name]?.[calls[name] - 1];
    if (status) return new Response('{"detail":"だめ"}', { status });
    if (name === 'version') return Response.json('0.99.0');
    if (name === 'audio_query') {
      queries.push(new URL(req.url).search);
      return Response.json(QUERY);
    }
    if (name === 'synthesis') {
      bodies.push(await req.json());
      return new Response(wav(1.5), { headers: { 'Content-Type': 'audio/wav' } });
    }
    return new Response('', { status: 404 });
  });
  return { url, calls, bodies, queries };
};
/** 合成のレシピ（先生の声と、全部の声で共通の出力の形） */
const VOICE = voicevoxRecipe({ speaker: 29, speed: 1.06, intonation: 1.12, pitch: 0 });
const quiet = { warn: () => {} };

describe('VOICEVOX の呼び出し', () => {
  test('止まったままのエンジンでも、決まった時間（時間切れ × 試す回数と、間の待ち）で失敗する（終了コード 3）', async () => {
    const engine = voicevox({ url: hung(), timeoutMs: 200, attempts: 2, backoffMs: 50, ...quiet });
    const t0 = performance.now();
    const err = await engine.synthesize('こんにちは', VOICE).catch((e: unknown) => e);
    const ms = performance.now() - t0;
    expect(err).toBeInstanceOf(MissingError);
    expect((err as Error).message).toContain('0.2 秒で答えない（2 回試した');
    expect((err as Error).message).toContain('VOICEVOX_TIMEOUT');
    expect(ms).toBeGreaterThanOrEqual(2 * 200 + 50 - 30);
    expect(ms).toBeLessThan(2000);
  });
  test('つながらないエンジンも、試す回数のあとで止める（素材の取り出しを案内する）', async () => {
    const warned: string[] = [];
    const engine = voicevox({
      url: absent(),
      timeoutMs: 1000,
      attempts: 3,
      backoffMs: 10,
      warn: (l) => warned.push(l),
    });
    const err = await engine.synthesize('こんにちは', VOICE).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MissingError);
    expect((err as Error).message).toContain('つながらない');
    expect((err as Error).message).toContain('bun scripts/materials.ts pull');
    expect(warned).toHaveLength(2);
    expect(warned[0]).toContain('（2/3 回目）');
  });
  test('5xx は少し待って流し直し、通れば WAV と読みを返す。版は最初の 1 回だけ問い合わせる', async () => {
    const e = working({ audio_query: [503], synthesis: [502] });
    const warned: string[] = [];
    const engine = voicevox({ url: e.url, timeoutMs: 1000, attempts: 3, backoffMs: 10, warn: (l) => warned.push(l) });
    const a = await engine.synthesize('こんにちは', VOICE);
    const b = await engine.synthesize('こんにちは', VOICE);
    expect(a.kana).toBe('コン、ニチワ');
    expect(a.wav.equals(wav(1.5))).toBe(true);
    expect(b.kana).toBe(a.kana);
    expect(await engine.version()).toBe('0.99.0');
    expect(e.calls).toEqual({ version: 1, audio_query: 3, synthesis: 3 });
    expect(warned).toHaveLength(2);
    expect(warned[0]).toContain('VOICEVOX の audio_query が 503 を返した。');
    expect(warned[1]).toContain('VOICEVOX の synthesis が 502 を返した。');
    expect(warned[1]).toContain('待って流し直す（2/3 回目）');
  });
  test('声の設定と出力の形（音量・前後の無音・48kHz・モノラル）を入れて synthesis に渡す', async () => {
    const e = working();
    await voicevox({ url: e.url, ...quiet }).synthesize('こんにちは', VOICE);
    expect(e.queries).toEqual([`?speaker=29&text=${encodeURIComponent('こんにちは')}`]);
    expect(e.bodies[0]).toMatchObject({
      speedScale: 1.06,
      intonationScale: 1.12,
      pitchScale: 0,
      volumeScale: 1,
      prePhonemeLength: 0.08,
      postPhonemeLength: 0.12,
      outputSamplingRate: 48000,
      outputStereo: false,
    });
  });
  test('レシピがエンジンの版を決めていて、今のエンジンと違えば、合成せずに止める（終了コード 3）', async () => {
    const e = working();
    const pinned = voicevoxRecipe({ speaker: 29, speed: 1.06, intonation: 1.12, pitch: 0, engineVersion: '0.14.0' });
    const err = await voicevox({ url: e.url, ...quiet })
      .synthesize('こんにちは', pinned)
      .catch((x: unknown) => x);
    expect(err).toBeInstanceOf(MissingError);
    expect((err as Error).message).toContain('VOICEVOX 0.14.0 を決めているが');
    expect(e.calls).toEqual({ version: 1 });
    // 同じ版なら合成し、その版を返す
    const same = voicevoxRecipe({ speaker: 29, speed: 1.06, intonation: 1.12, pitch: 0, engineVersion: '0.99.0' });
    expect((await voicevox({ url: e.url, ...quiet }).synthesize('こんにちは', same)).engineVersion).toBe('0.99.0');
  });
  test('4xx は流し直さない（どの台詞かを出す。終了コード 1）', async () => {
    const e = working({ audio_query: [422, 422, 422] });
    const err = await voicevox({ url: e.url, attempts: 3, backoffMs: 10, ...quiet })
      .synthesize('こんにちは', VOICE)
      .catch((x: unknown) => x);
    expect(err).not.toBeInstanceOf(MissingError);
    expect((err as Error).message).toBe('audio_query 422: こんにちは');
    expect(e.calls.audio_query).toBe(1);
  });
  test('読み（アクセント句のモーラをつなぎ、句の切れ目に「、」）と、時間切れの環境変数（秒）', () => {
    expect(kanaOf(QUERY.accent_phrases)).toBe('コン、ニチワ');
    expect(timeoutFromEnv({})).toBe(60_000);
    expect(timeoutFromEnv({ VOICEVOX_TIMEOUT: '2.5' })).toBe(2500);
    expect(() => timeoutFromEnv({ VOICEVOX_TIMEOUT: 'abc' })).toThrow(UsageError);
    expect(() => timeoutFromEnv({ VOICEVOX_TIMEOUT: '0' })).toThrow(UsageError);
  });
});

describe('synth の声のそろえ方（偽の VOICEVOX と一時のフォルダ）', () => {
  const lec = lecture([
    { kind: 'opening', title: '見本', lines: [{ t: 'はじめます。', v: 'announcer' }] },
    { kind: 'ending', closing: 'おわり', lines: [{ t: 'おわりです。' }] },
  ]);
  const video: Video = { key: 'X01', lang: 'ja', lecture: lec, course: course([lec]) };
  const ctxOf = (url: string, opts: { cacheOnly?: boolean; timeoutMs?: number } = {}) => {
    const dir = mkdtempSync(path.join(sandbox, 'synth-'));
    const ctx: Ctx = {
      store: { cache: path.join(dir, 'cache'), local: path.join(dir, 'local') },
      out: outDirs(path.join(dir, 'root')),
      cacheOnly: opts.cacheOnly ?? false,
      engine: voicevox({ url, timeoutMs: opts.timeoutMs ?? 1000, attempts: 2, backoffMs: 10, ...quiet }),
      log: () => {},
    };
    return { dir, ctx };
  };

  test('VOICEVOX が止まったままなら、決まった時間で止まり、出力も声も書かない', async () => {
    const { dir, ctx } = ctxOf(hung(), { timeoutMs: 200 });
    const t0 = performance.now();
    const err = await synthVideos(ctx, [video]).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MissingError);
    expect(performance.now() - t0).toBeLessThan(2000);
    expect(readdirSync(dir)).toEqual([]);
  });
  test('無い声は VOICEVOX で作って共有のキャッシュに書き、次からはキャッシュだけで作れる', async () => {
    const e = working();
    const { dir, ctx } = ctxOf(e.url);
    await synthVideos(ctx, [video]);
    expect(e.calls).toEqual({ version: 1, audio_query: 2, synthesis: 2 });
    const cached = readdirSync(ctx.store.cache).sort();
    // 新しく作った声は、v2 の鍵（合成のレシピから作る）の名前で置く
    const [v2] = ttsKeysIn('はじめます。', 'announcer', 'ja');
    expect(cached).toContain(`${v2}.wav`);
    expect(readFileSync(path.join(ctx.store.cache, `${v2}.kana`), 'utf8')).toBe('コン、ニチワ');
    expect(cached.filter((f) => f.endsWith('.wav'))).toHaveLength(2);
    expect(cached.filter((f) => f.endsWith('.kana'))).toHaveLength(2);
    expect(existsSync(path.join(dir, 'root/content/invalid-sample/generated/timeline/X01.json'))).toBe(true);
    // 同じキャッシュで、声を作らずに（エンジンにつながずに）作り直せる
    const again = ctxOf(absent(), { cacheOnly: true });
    await synthVideos({ ...again.ctx, store: ctx.store }, [video]);
    expect(readdirSync(again.ctx.out.plan)).toEqual(['X01.json']);
    // キャッシュに無ければ、--cached-only は前提が足りない（終了コード 3）
    await expect(synthVideos(again.ctx, [video])).rejects.toBeInstanceOf(MissingError);
  });
  test('前の名前（v1）の声があれば、それを使い、VOICEVOX にはつながない（作業フォルダの .work/tts も探す）', async () => {
    const e = working();
    const { ctx } = ctxOf(e.url);
    const v1 = (text: string, voice: 'announcer' | 'narrator') => ttsKeysIn(text, voice, 'ja')[1];
    mkdirSync(ctx.store.local, { recursive: true });
    for (const [text, voice] of [
      ['はじめます。', 'announcer'],
      ['おわりです。', 'narrator'],
    ] as const) {
      writeFileSync(path.join(ctx.store.local, `${v1(text, voice)}.wav`), wav(0.5));
      writeFileSync(path.join(ctx.store.local, `${v1(text, voice)}.kana`), 'カナ');
    }
    await synthVideos(ctx, [video]);
    expect(e.calls).toEqual({});
    const plan = JSON.parse(readFileSync(path.join(ctx.out.plan, 'X01.json'), 'utf8'));
    expect(plan.scenes[0].lines[0].file).toBe(`.work/tts/${v1('はじめます。', 'announcer')}.wav`);
  });
});
