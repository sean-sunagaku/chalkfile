// 道具の部品（scripts/lib/）の単体テスト。ファイルは一時のフォルダにだけ書く
import { afterAll, describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EXIT, exitCodeOf, MissingError, readArgs, UsageError } from '../scripts/lib/args';
import { readSiteConfig } from '../scripts/lib/config';
import { withLock, writeAtomic } from '../scripts/lib/fsx';
import { sha256File } from '../scripts/lib/hash';
import { pool } from '../scripts/lib/pool';
import { redact, run, runAsync, runInherit, runOrThrow, setVerbose, tailOf, trace } from '../scripts/lib/proc';
import { wavSeconds } from '../scripts/lib/wav';

const ROOT = path.resolve(import.meta.dir, '..');
const sandbox = mkdtempSync(path.join(os.tmpdir(), 'chalkfile-lib-test-'));
afterAll(() => rmSync(sandbox, { recursive: true, force: true }));
let n = 0;
const tmp = () => mkdtempSync(path.join(sandbox, `t${++n}-`));
/** 子のプロセスで流す TS を書き、bun で流す（引数を渡す） */
const child = (dir: string, name: string, source: string) => {
  const file = path.join(dir, `${name}.ts`);
  writeFileSync(file, source);
  return (...args: string[]) => Bun.spawn([process.execPath, file, ...args], { stdout: 'pipe', stderr: 'pipe' });
};
const FSX = JSON.stringify(path.join(ROOT, 'scripts/lib/fsx.ts'));

describe('writeAtomic（一時の名前に書いてから置き換える）', () => {
  test('中身を書き、一時のファイルを残さない。無いフォルダも作る', () => {
    const dir = tmp();
    const file = path.join(dir, 'a/b/x.json');
    writeAtomic(file, '{"x":1}');
    writeAtomic(file, new Uint8Array([1, 2, 3]));
    expect([...readFileSync(file)]).toEqual([1, 2, 3]);
    expect(readdirSync(path.dirname(file))).toEqual(['x.json']);
  });
  test('2 つのプロセスが同じファイルに書き続けても、読む側には、どちらかの中身がそろって見える', async () => {
    const dir = tmp();
    const file = path.join(dir, 'shared.bin');
    const size = 256 * 1024;
    writeAtomic(file, 'a'.repeat(size));
    const run = child(
      dir,
      'writer',
      `import { writeAtomic } from ${FSX};
const [file, ch, size] = process.argv.slice(2);
for (let i = 0; i < 150; i++) writeAtomic(file, ch.repeat(Number(size)));
`,
    );
    const writers = [run(file, 'a', String(size)), run(file, 'b', String(size))];
    const done = Promise.all(writers.map((p) => p.exited));
    let reads = 0;
    let finished = false;
    void done.then(() => {
      finished = true;
    });
    while (!finished) {
      const text = readFileSync(file, 'utf8');
      expect(text.length).toBe(size);
      expect(text === 'a'.repeat(size) || text === 'b'.repeat(size)).toBe(true);
      reads++;
      await Bun.sleep(0);
    }
    expect(await done).toEqual([0, 0]);
    expect(reads).toBeGreaterThan(0);
    expect(readdirSync(dir).filter((f) => f.endsWith('.tmp'))).toEqual([]);
  });
});

describe('withLock（持ち主と時刻を書いたロック）', () => {
  test('2 つのプロセスが同じロックを取り合っても、中は 1 つずつ流れる', async () => {
    const dir = tmp();
    const lock = path.join(dir, 'x.lock');
    const log = path.join(dir, 'log.txt');
    const run = child(
      dir,
      'locker',
      `import { appendFileSync } from 'node:fs';
import { withLock } from ${FSX};
const [lock, log, name] = process.argv.slice(2);
for (let i = 0; i < 8; i++)
  await withLock(lock, async () => {
    appendFileSync(log, name + ' in\\n');
    await Bun.sleep(3);
    appendFileSync(log, name + ' out\\n');
  }, { pollMs: 1 });
`,
    );
    const codes = await Promise.all([run(lock, log, 'a'), run(lock, log, 'b')].map((p) => p.exited));
    expect(codes).toEqual([0, 0]);
    const lines = readFileSync(log, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(32);
    for (let i = 0; i < lines.length; i += 2) {
      expect(lines[i].endsWith(' in')).toBe(true);
      expect(lines[i + 1]).toBe(lines[i].replace(/ in$/, ' out'));
    }
    expect(existsSync(lock)).toBe(false);
  });
  test('ロックに持ち主（pid・ホスト・時刻・用途）を書き、終われば（失敗しても）消す', async () => {
    const dir = tmp();
    const lock = path.join(dir, 'x.lock');
    const seen = await withLock(lock, () => JSON.parse(readFileSync(lock, 'utf8')), { what: '試し' });
    expect(seen).toMatchObject({ pid: process.pid, host: os.hostname(), what: '試し' });
    expect(Number.isNaN(Date.parse(seen.at))).toBe(false);
    expect(existsSync(lock)).toBe(false);
    await expect(
      withLock(lock, () => {
        throw new Error('中で失敗');
      }),
    ).rejects.toThrow('中で失敗');
    expect(existsSync(lock)).toBe(false);
  });
  test('持ち主のプロセスがもう無いロックと、古すぎるロックは取り直す', async () => {
    const dir = tmp();
    const lock = path.join(dir, 'x.lock');
    const gone = Bun.spawn([process.execPath, '-e', '0']);
    await gone.exited;
    const holder = (pid: number, at: string) =>
      JSON.stringify({ pid, host: os.hostname(), at, what: '前の', token: 'old' });
    writeFileSync(lock, holder(gone.pid, new Date().toISOString()));
    expect(await withLock(lock, () => 'とれた', { timeoutMs: 1000 })).toBe('とれた');
    writeFileSync(lock, holder(process.pid, new Date(Date.now() - 60_000).toISOString()));
    expect(await withLock(lock, () => 'とれた', { timeoutMs: 1000, staleMs: 10_000 })).toBe('とれた');
  });
  test('動いている持ち主のロックは取らず、待つ長さを過ぎたら持ち主を出して止める', async () => {
    const dir = tmp();
    const lock = path.join(dir, 'x.lock');
    const holder = {
      pid: process.pid,
      host: os.hostname(),
      at: new Date().toISOString(),
      what: 'ほかの synth',
      token: 'other',
    };
    writeFileSync(lock, JSON.stringify(holder));
    const lines: string[] = [];
    await expect(
      withLock(lock, () => 'x', { timeoutMs: 50, pollMs: 5, log: (l) => void lines.push(l) }),
    ).rejects.toThrow(`pid ${process.pid}`);
    expect(lines).toHaveLength(1);
    // 人のロックは消さない
    expect(JSON.parse(readFileSync(lock, 'utf8')).token).toBe('other');
  });
});

describe('readArgs（node:util の parseArgs を strict で読む）', () => {
  const options = {
    write: { type: 'boolean' },
    base: { type: 'string', default: 'origin/main' },
    course: { type: 'string', multiple: true },
  } as const;
  test('値・既定・くり返し・-h を読む。= の書き方も、分けた書き方も読む', () => {
    const r = readArgs(['--write', '--course', 'a', '--course=b', '--base=HEAD^1', 'L01', '-h'], options, {
      positionals: true,
    });
    expect(r.values).toEqual({ write: true, base: 'HEAD^1', course: ['a', 'b'], help: true });
    expect(r.positionals).toEqual(['L01']);
    expect(readArgs([], options).values).toEqual({ base: 'origin/main' });
  });
  test('知らない引数・値の足りない引数・取らない引数は、使い方の誤り（終了コード 2）にする', () => {
    const errorOf = (args: string[], positionals = false) => {
      try {
        readArgs(args, options, { positionals });
      } catch (e) {
        return { code: exitCodeOf(e), message: (e as Error).message };
      }
      throw new Error('止まらなかった');
    };
    expect(errorOf(['--nope'])).toEqual({ code: EXIT.usage, message: '知らない引数: --nope（使い方は --help）' });
    expect(errorOf(['--base']).code).toBe(EXIT.usage);
    expect(errorOf(['--write=1']).code).toBe(EXIT.usage);
    expect(errorOf(['L01'])).toEqual({
      code: EXIT.usage,
      message: 'この道具は、この引数を取らない: L01（使い方は --help）',
    });
  });
  test('終了コード: 使い方の誤りは 2、前提が足りないのは 3、ほかの失敗は 1', () => {
    expect([new UsageError('x'), new MissingError('x'), new Error('x'), 'x'].map(exitCodeOf)).toEqual([2, 3, 1, 1]);
  });
});

describe('proc（外の道具の流し方と、伏せ字）', () => {
  test('token・Authorization・署名つきの URL の query を伏せる', () => {
    const token = `ghp_${'a'.repeat(36)}`;
    const out = redact(
      `HTTP 401 ${token}\nAuthorization: Bearer abc.def\nGET https://example.com/x?X-Amz-Signature=secret&a=1 github_pat_${'b'.repeat(30)}`,
    );
    for (const secret of [token, 'abc.def', 'X-Amz-Signature=secret', 'b'.repeat(30)])
      expect(out).not.toContain(secret);
    expect(out).toContain('https://example.com/x?［伏せた］');
  });
  test('stderr の終わりの行を、伏せてから 1 行にする', () => {
    const text = ['1', '2', '3', '4', '5', `6 ghp_${'c'.repeat(36)}`].join('\n');
    expect(tailOf(text)).toBe('2 / 3 / 4 / 5 / 6 ［伏せた token］');
    expect(tailOf('x'.repeat(900), 5, 10)).toBe('x'.repeat(10));
  });
  test('終了コードと出力を返し、時間切れを知らせ、道具が無ければ前提が足りない（3）にする', () => {
    expect(run('sh', ['-c', 'echo out; echo err >&2; exit 4'])).toEqual({
      code: 4,
      stdout: 'out\n',
      stderr: 'err\n',
      timedOut: false,
    });
    expect(run('sh', ['-c', 'cat'], { input: 'in' }).stdout).toBe('in');
    expect(run('sh', ['-c', 'sleep 5'], { timeoutMs: 100 }).timedOut).toBe(true);
    expect(() => run('chalkfile-no-such-tool', [])).toThrow(MissingError);
  });
  test('runOrThrow は、失敗したら何が失敗したかと、伏せた stderr の終わりを付けて止める', () => {
    expect(runOrThrow('sh', ['-c', 'printf ok'])).toBe('ok');
    expect(() =>
      runOrThrow('sh', ['-c', `echo "bad ghp_${'d'.repeat(36)}" >&2; exit 3`], { what: '試しの道具' }),
    ).toThrow('試しの道具 が失敗した（終了コード 3）: bad ［伏せた token］');
  });
  test('runAsync は、非同期に流して終了コードと出力を返し、時間切れで止め、道具が無ければ前提が足りない（3）にする', async () => {
    expect(await runAsync('sh', ['-c', 'echo out; echo err >&2; exit 4'])).toEqual({
      code: 4,
      stdout: 'out\n',
      stderr: 'err\n',
      timedOut: false,
    });
    const t0 = performance.now();
    const slow = await runAsync('sh', ['-c', 'sleep 5'], { timeoutMs: 100 });
    expect(slow.timedOut).toBe(true);
    // 止めた道具の子のプロセス（ここでは sleep）が出力を開いたままでも、待たずに返す
    const nested = await runAsync('sh', ['-c', 'sleep 5; :'], { timeoutMs: 100 });
    expect(nested.timedOut).toBe(true);
    expect(performance.now() - t0).toBeLessThan(3000);
    await expect(runAsync('chalkfile-no-such-tool', [])).rejects.toBeInstanceOf(MissingError);
    // 出力が上限を超えたら、終わりの分だけを残す
    expect((await runAsync('sh', ['-c', 'printf 0123456789 >&2'], { maxBuffer: 4 })).stderr).toBe('6789');
  });
  test('runInherit は、時間を過ぎたら止めて、何が終わらなかったかを出す', () => {
    expect(runInherit('sh', ['-c', 'exit 5'])).toBe(5);
    expect(() => runInherit('sh', ['-c', 'sleep 5'], { timeoutMs: 100, what: '試しの読み上げ' })).toThrow(
      '試しの読み上げ が 0 秒で終わらなかったので止めた',
    );
  });
  test('--verbose（setVerbose）のときだけ、流すコマンドと失敗の stderr の全部を、伏せてから標準エラーに出す', () => {
    const lines: string[] = [];
    const error = console.error;
    console.error = (line: string) => void lines.push(line);
    try {
      trace('出さない');
      run('sh', ['-c', 'exit 0']);
      setVerbose(true);
      run('sh', ['-c', `echo "1 ghp_${'e'.repeat(36)}" >&2; echo 2 >&2; exit 7`]);
    } finally {
      setVerbose(false);
      console.error = error;
    }
    expect(lines).toEqual([
      `> sh -c 'echo "1 ghp_${'e'.repeat(36)}" >&2; echo 2 >&2; exit 7'`.replace(`ghp_${'e'.repeat(36)}`, '［伏せた token］'),
      'sh: 終了コード 7。stderr:\n1 ［伏せた token］\n2',
    ]);
  });
});

describe('hash・pool・wav・config', () => {
  test('sha256File は、1 MiB より大きいファイルも、全体を読んだときと同じ値を出す', () => {
    const file = path.join(tmp(), 'big.bin');
    const data = Buffer.alloc(3 * 1024 * 1024 + 17, 7);
    writeFileSync(file, data);
    expect(sha256File(file)).toBe(createHash('sha256').update(data).digest('hex'));
  });
  test('pool は、同時に n 本までで流し、全部を 1 回ずつ流す', async () => {
    let running = 0;
    let most = 0;
    const seen: number[] = [];
    await pool([1, 2, 3, 4, 5, 6, 7], 3, async (x) => {
      running++;
      most = Math.max(most, running);
      await Bun.sleep(5);
      seen.push(x);
      running--;
    });
    expect(most).toBe(3);
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    await pool([], 3, async () => {
      throw new Error('呼ばない');
    });
  });
  test('wavSeconds は、fmt と data のチャンクから長さを出す（48kHz・モノラル・16bit の 1.5 秒）', () => {
    const data = 48000 * 2 * 1.5;
    const head = Buffer.alloc(44);
    head.write('RIFF', 0);
    head.writeUInt32LE(36 + data, 4);
    head.write('WAVEfmt ', 8);
    head.writeUInt32LE(16, 16);
    head.writeUInt16LE(1, 20);
    head.writeUInt16LE(1, 22);
    head.writeUInt32LE(48000, 24);
    head.writeUInt32LE(96000, 28);
    head.writeUInt16LE(2, 32);
    head.writeUInt16LE(16, 34);
    head.write('data', 36);
    head.writeUInt32LE(data, 40);
    expect(wavSeconds(Buffer.concat([head, Buffer.alloc(data)]))).toBe(1.5);
    expect(() => wavSeconds(head.subarray(0, 36))).toThrow('data チャンクが無い');
  });
  test('readSiteConfig は、site/config.json を読む（公開する言語を持つ）', () => {
    const config = readSiteConfig();
    expect(config.publishLangs).toContain('ja');
    expect(config.baseUrl.startsWith('https://')).toBe(true);
  });
});
