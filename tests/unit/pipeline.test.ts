// 段の組み立て（scripts/stages/pipeline/runner.ts）を、偽の段で確かめる。偽の段は一時のフォルダのファイルを読み書きするだけで、
// 本物の道具（synth・mix・render・サイトの組み立て）は流さない。
// 何も変えていなければ流さない・変えた単位だけを流す・前の段の出力が同じなら次の段を流さない・高い段は記録が無くても出力を残す・
// 描き方のコードだけの変化は既定で流さない・--force・--dry-run・流している間に入力が変わったら記録しない・記録の形
import { afterAll, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { canonical, digest, fileHasher } from '../../scripts/stages/pipeline/digest';
import {
  build,
  type Ctx,
  commit,
  begin,
  nextRuns,
  type Stage,
  statusOf,
  unitStatus,
  willRun,
} from '../../scripts/stages/pipeline/runner';
import { readState, STATE_DIR, stateFile } from '../../scripts/stages/pipeline/state';

const sandbox = mkdtempSync(path.join(os.tmpdir(), 'chalkfile-pipeline-test-'));
afterAll(() => rmSync(sandbox, { recursive: true, force: true }));
let n = 0;

/**
 * 偽の段 3 つ。a: in/<u>.txt を大文字にして out/a/<u>.txt へ（安い段）。b: out/a/<u>.txt を逆さにして out/b/<u>.txt へ（安い段）。
 * c: out/b/<u>.txt と code.txt から out/c/<u>.txt へ（高い段。記録が無くても出力を残す。code.txt だけの変化は既定で流さない）
 */
const world = () => {
  const root = mkdtempSync(path.join(sandbox, `w${++n}-`));
  const runs: string[] = [];
  const read = (f: string) => readFileSync(path.join(root, f), 'utf8');
  const write = (f: string, text: string) => {
    mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    writeFileSync(path.join(root, f), text);
  };
  const hasher = fileHasher(root, null);
  const ctx: Ctx = { root, hasher };
  const sha = (f: string) => hasher.sha256(f)?.slice(0, 16) ?? '';
  let during: (() => void) | null = null;
  let fail = '';
  const mk = (
    name: string,
    needs: string[],
    from: (u: string) => string,
    to: (u: string) => string,
    make: (text: string) => string,
    extra: Partial<Stage> = {},
  ): Stage => ({
    name,
    label: name,
    needs,
    unrecorded: 'run',
    units: (t) => [...t.keys],
    deps: (u) => needs.map((s) => ({ stage: s, unit: u })),
    fingerprint: (u) =>
      existsSync(path.join(root, from(u))) ? { parts: { input: sha(from(u)) } } : { missing: `${from(u)} が無い` },
    outputs: (u) => [to(u)],
    run: (units) => {
      if (fail === name) return 1;
      for (const u of units) {
        runs.push(`${name} ${u}`);
        write(to(u), make(read(from(u))));
      }
      during?.();
      return 0;
    },
    tools: () => ({ fake: '1' }),
    ...extra,
  });
  const a = mk(
    'a',
    [],
    (u) => `in/${u}.txt`,
    (u) => `out/a/${u}.txt`,
    (t) => t.toUpperCase(),
  );
  const b = mk(
    'b',
    ['a'],
    (u) => `out/a/${u}.txt`,
    (u) => `out/b/${u}.txt`,
    (t) => [...t].reverse().join(''),
  );
  const c = mk(
    'c',
    ['b'],
    (u) => `out/b/${u}.txt`,
    (u) => `out/c/${u}.txt`,
    (t) => `${t}!`,
    {
      unrecorded: 'keep',
      advisory: ['code'],
      fingerprint: (u) =>
        existsSync(path.join(root, `out/b/${u}.txt`))
          ? { parts: { input: sha(`out/b/${u}.txt`), code: sha('code.txt') } }
          : { missing: 'b が無い' },
    },
  );
  write('in/x.txt', 'x1');
  write('in/y.txt', 'y1');
  write('code.txt', 'v1');
  return {
    root,
    ctx,
    stages: [a, b, c],
    runs,
    read,
    write,
    target: { keys: ['x', 'y'] },
    /** 流している間に呼ぶ（入力を変える） */
    setDuring: (fn: (() => void) | null) => {
      during = fn;
    },
    setFail: (name: string) => {
      fail = name;
    },
    take: () => runs.splice(0),
  };
};
const quiet = { log: () => {} };

describe('build（古くなった単位だけを流す）', () => {
  test('記録が無い安い段は流して記録し、何も変えていなければ、もう一度流しても何も流さない', async () => {
    const w = world();
    const first = await build(w.ctx, w.stages, 'b', w.target, quiet);
    expect(first.code).toBe(0);
    expect(w.take()).toEqual(['a x', 'a y', 'b x', 'b y']);
    expect(w.read('out/b/x.txt')).toBe('1X');
    const again = await build(w.ctx, w.stages, 'b', w.target, quiet);
    expect(again.code).toBe(0);
    expect(w.take()).toEqual([]);
    expect(again.recorded).toBe(0);
    const s = statusOf(w.ctx, w.stages.slice(0, 2), w.target);
    expect(s.stages.flatMap((x) => x.units.map((u) => u.state))).toEqual(['fresh', 'fresh', 'fresh', 'fresh']);
  });
  test('入力を変えた単位だけを流す。前の段の出力が同じなら、次の段は流さない', async () => {
    const w = world();
    await build(w.ctx, w.stages, 'b', w.target, quiet);
    w.take();
    w.write('in/x.txt', 'x2');
    await build(w.ctx, w.stages, 'b', w.target, quiet);
    expect(w.take()).toEqual(['a x', 'b x']);
    // 大文字にすると同じになる変更（x2 → X2）: a は流すが、出力が同じなので b は流さない
    w.write('in/x.txt', 'X2');
    await build(w.ctx, w.stages, 'b', w.target, quiet);
    expect(w.take()).toEqual(['a x']);
  });
  test('対象の段の前の段も流す。対象より後ろの段は流さない', async () => {
    const w = world();
    await build(w.ctx, w.stages, 'a', w.target, quiet);
    expect(w.take()).toEqual(['a x', 'a y']);
    expect(existsSync(path.join(w.root, 'out/b/x.txt'))).toBe(false);
  });
  test('高い段（keep）は、記録が無くても出力があれば流さない。出力が無ければ流す。--force なら流す', async () => {
    const w = world();
    await build(w.ctx, w.stages, 'b', w.target, quiet);
    w.write('out/c/x.txt', '前に作った出力');
    w.take();
    const r = await build(w.ctx, w.stages, 'c', w.target, quiet);
    expect(w.take()).toEqual(['c y']);
    expect(r.plan.find((p) => p.stage === 'c')?.kept.map((s) => s.unit)).toEqual(['x']);
    expect(w.read('out/c/x.txt')).toBe('前に作った出力');
    await build(w.ctx, w.stages, 'c', w.target, { ...quiet, force: true });
    expect(w.take()).toEqual(['a x', 'a y', 'b x', 'b y', 'c x', 'c y']);
    expect(w.read('out/c/x.txt')).toBe('1X!');
  });
  test('advisory の部分（描き方のコード）だけが変わった単位は、既定では流さず、--src で流す', async () => {
    const w = world();
    await build(w.ctx, w.stages, 'c', w.target, quiet);
    w.take();
    w.write('code.txt', 'v2');
    const s = unitStatus(w.ctx, w.stages[2], 'x');
    expect(s).toMatchObject({ state: 'stale', changed: ['code'], advisoryOnly: true });
    await build(w.ctx, w.stages, 'c', w.target, quiet);
    expect(w.take()).toEqual([]);
    await build(w.ctx, w.stages, 'c', w.target, { ...quiet, advisory: true });
    expect(w.take()).toEqual(['c x', 'c y']);
  });
  test('出力を手で変えた・消したら古い（記録の sha256 と比べる）', async () => {
    const w = world();
    await build(w.ctx, w.stages, 'b', w.target, quiet);
    w.take();
    w.write('out/b/x.txt', '手で直した');
    rmSync(path.join(w.root, 'out/b/y.txt'));
    expect(unitStatus(w.ctx, w.stages[1], 'x')).toMatchObject({ state: 'stale', outputs: 'changed' });
    expect(unitStatus(w.ctx, w.stages[1], 'y')).toMatchObject({ state: 'stale', outputs: 'missing' });
    await build(w.ctx, w.stages, 'b', w.target, quiet);
    expect(w.take()).toEqual(['b x', 'b y']);
    expect(w.read('out/b/x.txt')).toBe('1X');
  });
  test('--dry-run は何も流さず・何も書かず、流す単位と、前の段のあとで確かめる単位を返す', async () => {
    const w = world();
    await build(w.ctx, w.stages, 'c', w.target, quiet);
    w.take();
    w.write('in/x.txt', 'x2');
    const before = readdirSync(path.join(w.root, STATE_DIR), { recursive: true }).map(String).sort();
    const r = await build(w.ctx, w.stages, 'c', w.target, { ...quiet, dryRun: true });
    expect(w.take()).toEqual([]);
    expect(readdirSync(path.join(w.root, STATE_DIR), { recursive: true }).map(String).sort()).toEqual(before);
    expect(r.plan.map((p) => [p.stage, p.run.map((s) => s.unit), p.later])).toEqual([
      ['a', ['x'], []],
      ['b', [], ['x']],
      ['c', [], ['x']],
    ]);
  });
  test('流している間に入力が変わったら、記録しない（次の build で流し直す）', async () => {
    const w = world();
    w.setDuring(() => w.write('in/x.txt', '流している間に直した'));
    const r = await build(w.ctx, w.stages, 'a', w.target, quiet);
    w.setDuring(null);
    expect(r.notRecorded.join('\n')).toContain('a x: 流している間に入力が変わった');
    expect(readState(w.root, 'a', 'x')).toBeNull();
    expect(readState(w.root, 'a', 'y')).not.toBeNull();
  });
  test('道具が失敗したら、その終了コードで止まり、記録しない（後ろの段も流さない）', async () => {
    const w = world();
    w.setFail('b');
    const r = await build(w.ctx, w.stages, 'c', w.target, quiet);
    expect(r.code).toBe(1);
    expect(w.take()).toEqual(['a x', 'a y']);
    expect(readState(w.root, 'b', 'x')).toBeNull();
    expect(existsSync(path.join(w.root, STATE_DIR, 'b', 'x.pending.json'))).toBe(false);
  });
});

describe('status（記録と今の入力を比べる。何も流さない）', () => {
  test('前の段の単位が流れるものなら、新しい単位も「前の段を待つ」にし、次に流す段に入れる', async () => {
    const w = world();
    await build(w.ctx, w.stages, 'c', w.target, quiet);
    w.take();
    w.write('in/y.txt', 'y2');
    const r = statusOf(w.ctx, w.stages, w.target);
    const states = Object.fromEntries(r.stages.map((s) => [s.stage.name, s.units.map((u) => `${u.unit} ${u.state}`)]));
    expect(states).toEqual({ a: ['x fresh', 'y stale'], b: ['x fresh', 'y pending'], c: ['x fresh', 'y pending'] });
    expect(nextRuns(r)).toEqual([
      { stage: 'a', units: ['y'] },
      { stage: 'b', units: ['y'] },
      { stage: 'c', units: ['y'] },
    ]);
    expect(w.take()).toEqual([]);
  });
  test('入力がそろわない単位は古い（理由を出す）。記録の無い単位は「記録が無い」と、出力のあるなし', () => {
    const w = world();
    rmSync(path.join(w.root, 'in/y.txt'));
    expect(unitStatus(w.ctx, w.stages[0], 'y')).toMatchObject({ state: 'stale', reasons: ['in/y.txt が無い'] });
    expect(unitStatus(w.ctx, w.stages[0], 'x')).toMatchObject({ state: 'unrecorded', outputs: 'missing' });
    expect(willRun(w.stages[0], unitStatus(w.ctx, w.stages[0], 'x'))).toBe(true);
  });
  test('記録の代わり（fallback）が partial なら、記録に無い部分は比べない', () => {
    const w = world();
    w.write('out/c/x.txt', 'c');
    const c: Stage = {
      ...w.stages[2],
      fingerprint: () => ({ parts: { input: 'aaaa', code: 'bbbb', audio: 'cccc' } }),
      fallback: () => ({
        parts: { input: 'aaaa', code: 'bbbb' },
        outputs: { 'out/c/x.txt': { sha256: w.ctx.hasher.sha256('out/c/x.txt') ?? '', bytes: 1 } },
        partial: true,
        from: 'fallback',
      }),
    };
    expect(unitStatus(w.ctx, c, 'x')).toMatchObject({ state: 'fresh', from: 'fallback' });
  });
});

describe('記録（.work/state/<段>/<単位>.json）', () => {
  test('形: schema・段・単位・指紋（parts の指紋）・出力の sha256 と大きさ・道具の版・時刻。一時のファイルを残さない', async () => {
    const w = world();
    await build(w.ctx, w.stages, 'a', w.target, quiet);
    const s = JSON.parse(readFileSync(stateFile(w.root, 'a', 'x'), 'utf8'));
    expect(Object.keys(s)).toEqual(['schema', 'stage', 'unit', 'fingerprint', 'parts', 'outputs', 'tools', 'at']);
    expect(s).toMatchObject({ schema: 1, stage: 'a', unit: 'x', tools: { fake: '1' } });
    expect(s.fingerprint).toBe(digest(s.parts));
    expect(s.outputs).toEqual({
      'out/a/x.txt': { sha256: new Bun.CryptoHasher('sha256').update('X1').digest('hex'), bytes: 2 },
    });
    expect(readdirSync(path.join(w.root, STATE_DIR, 'a')).sort()).toEqual(['x.json', 'y.json']);
  });
  test('begin のあとで入力が変われば、commit は記録しない。同じなら記録する。出力が無ければ記録しない', () => {
    const w = world();
    const a = w.stages[0];
    w.write('out/a/x.txt', 'X1');
    begin(w.ctx, a, 'x');
    w.write('in/x.txt', 'x9');
    expect(commit(w.ctx, a, 'x')).toBe('流している間に入力が変わった（もう一度流す）');
    begin(w.ctx, a, 'x');
    expect(commit(w.ctx, a, 'x')).toBeNull();
    expect(readState(w.root, 'a', 'x')?.parts).toEqual({ input: w.ctx.hasher.sha256('in/x.txt')?.slice(0, 16) ?? '' });
    expect(commit(w.ctx, a, 'y')).toBe('出力が無い: out/a/y.txt');
    expect(commit(w.ctx, { ...a, recordable: () => '字幕版を作っていない' }, 'x')).toBe('字幕版を作っていない');
  });
  test('段と単位の名前は、ファイルの名前に使える形だけ（フォルダの外を指せない）', () => {
    expect(() => stateFile(sandbox, 'a', '../x')).toThrow('形が違う');
    expect(() => stateFile(sandbox, '../a', 'x')).toThrow('形が違う');
    expect(stateFile(sandbox, 'render', 'S01.en')).toBe(path.join(sandbox, STATE_DIR, 'render', 'S01.en.json'));
  });
  test('形の違う記録・ほかの単位の記録は、記録が無いとみなす', () => {
    const w = world();
    w.write(
      `${STATE_DIR}/a/x.json`,
      JSON.stringify({ schema: 1, stage: 'a', unit: 'y', fingerprint: 'f', parts: {}, outputs: {}, tools: {}, at: '' }),
    );
    expect(readState(w.root, 'a', 'x')).toBeNull();
    w.write(`${STATE_DIR}/a/x.json`, '{');
    expect(readState(w.root, 'a', 'x')).toBeNull();
  });
});

describe('指紋の部品（scripts/stages/pipeline/digest.ts）', () => {
  test('canonical はキーの順・値の無い項目に左右されない。配列の順は変わる', () => {
    expect(canonical({ b: 1, a: [1, undefined], c: undefined })).toBe('{"a":[1,null],"b":1}');
    expect(digest({ a: 1, b: 2 })).toBe(digest({ b: 2, a: 1 }));
    expect(digest([1, 2])).not.toBe(digest([2, 1]));
    expect(digest({ a: 1 })).toMatch(/^[0-9a-f]{16}$/);
  });
  test('FileHasher は中身を読み、大きさ・時刻・inode が同じなら覚えた値を使う。書き換えたら読み直す。覚えた値は save で書く', () => {
    const w = world();
    const cache = path.join(w.root, 'hashes.json');
    const h = fileHasher(w.root, cache);
    const one = h.sha256('in/x.txt');
    expect(one).toBe(new Bun.CryptoHasher('sha256').update('x1').digest('hex'));
    w.write('in/x.txt', 'x2');
    expect(h.sha256('in/x.txt')).toBe(new Bun.CryptoHasher('sha256').update('x2').digest('hex'));
    expect(h.sha256('in/none.txt')).toBeNull();
    h.save();
    expect(Object.keys(JSON.parse(readFileSync(cache, 'utf8')))).toEqual(['in/x.txt']);
  });
});
