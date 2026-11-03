// 道具の部品（scripts/lib/）の単体テスト。ファイルは一時のフォルダにだけ書く
import { afterAll, describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { withLock, writeAtomic } from '../scripts/lib/fsx';

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
