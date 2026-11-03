// 作業フォルダの作り方（scripts/worktree.ts）と、生成物の片付け（scripts/clean.ts）。本物の作業フォルダ・branch・キャッシュには触れない
import { afterAll, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CLEAN, targetsOf } from '../scripts/clean';
import { UsageError } from '../scripts/lib/args';
import { planOf } from '../scripts/worktree';

const ROOT = path.resolve(import.meta.dir, '..');
const sandbox = mkdtempSync(path.join(os.tmpdir(), 'chalkfile-worktree-test-'));
afterAll(() => rmSync(sandbox, { recursive: true, force: true }));
const git = (...args: string[]) => Bun.spawnSync(['git', ...args], { cwd: ROOT }).stdout.toString();

describe('worktree.ts（npm run worktree:new -- <type>/<slug>）', () => {
  test('名前は <type>/<slug>。既定の場所は、この作業フォルダの隣の chalkfile-<slug>、分かれる元は origin/main', () => {
    expect(planOf('feat/new-course', {}, '/x/chalkfile')).toEqual({
      branch: 'feat/new-course',
      slug: 'new-course',
      dir: '/x/chalkfile-new-course',
      base: 'origin/main',
    });
    expect(planOf('docs/a1', { base: 'HEAD', dir: 'tmp/w' }, '/x/chalkfile')).toMatchObject({
      dir: '/x/chalkfile/tmp/w',
      base: 'HEAD',
    });
  });
  test.each([undefined, 'new-course', 'Feat/x', 'feat/X', 'feat/', 'feat/a/b', 'wip/x', 'feat/-x'])(
    '使い方の誤り: %s',
    (name) => {
      expect(() => planOf(name)).toThrow(UsageError);
    },
  );
  test('--dry-run は何をするかを出すだけで、作業フォルダも branch も作らない', () => {
    const before = git('worktree', 'list', '--porcelain') + git('branch', '--list', 'test/dry-run-only');
    const dir = path.join(sandbox, 'never');
    const r = Bun.spawnSync([process.execPath, 'scripts/worktree.ts', 'test/dry-run-only', '--dir', dir, '--dry-run'], {
      cwd: ROOT,
    });
    expect(r.exitCode).toBe(0);
    expect(r.stdout.toString()).toContain(
      `git worktree add -b test/dry-run-only ${path.relative(ROOT, dir)} origin/main`,
    );
    expect(existsSync(dir)).toBe(false);
    expect(git('worktree', 'list', '--porcelain') + git('branch', '--list', 'test/dry-run-only')).toBe(before);
  });
  test('もうある場所には作らない（使い方の誤り）', () => {
    const r = Bun.spawnSync([process.execPath, 'scripts/worktree.ts', 'test/exists', '--dir', sandbox, '--dry-run'], {
      cwd: ROOT,
    });
    expect(r.exitCode).toBe(2);
    expect(r.stderr.toString()).toContain('作る場所がもうある');
  });
});

describe('clean.ts（npm run clean）', () => {
  test('消すのは out/・public/audio/mix/・site/dist/・.work/state/ のうち有るものだけ。共有のキャッシュは --cache のときだけ', () => {
    const root = mkdtempSync(path.join(sandbox, 'root-'));
    const cache = mkdtempSync(path.join(sandbox, 'cache-'));
    for (const rel of ['out/master', 'site/dist', 'site/data', '.work/tts', 'content/x'])
      mkdirSync(path.join(root, rel), { recursive: true });
    mkdirSync(path.join(cache, 'tts'));
    writeFileSync(path.join(cache, 'tts', 'a.wav'), 'wav');
    const env = { CHALKFILE_CACHE_DIR: cache };
    expect(targetsOf(false, root, env)).toEqual([path.join(root, 'out'), path.join(root, 'site/dist')]);
    expect(targetsOf(true, root, env)).toEqual([
      path.join(root, 'out'),
      path.join(root, 'site/dist'),
      path.join(cache, 'tts'),
    ]);
    expect(CLEAN).toEqual(['out', 'public/audio/mix', 'site/dist', '.work/state']);
  });
  test('共有のキャッシュの場所が、家のフォルダや作業フォルダそのものなら、消さずに止める', () => {
    const root = mkdtempSync(path.join(sandbox, 'root-'));
    expect(() => targetsOf(true, root, { CHALKFILE_CACHE_DIR: os.homedir() })).toThrow(
      '共有のキャッシュの場所がおかしい',
    );
    expect(() => targetsOf(true, root, { CHALKFILE_CACHE_DIR: root })).toThrow('共有のキャッシュの場所がおかしい');
    expect(() => targetsOf(true, root, { CHALKFILE_CACHE_DIR: '/' })).toThrow('共有のキャッシュの場所がおかしい');
  });
  test('--dry-run は消すものを出すだけで、何も消さない', () => {
    const cache = mkdtempSync(path.join(sandbox, 'cache-'));
    mkdirSync(path.join(cache, 'tts'));
    writeFileSync(path.join(cache, 'tts', 'a.wav'), 'wav');
    const r = Bun.spawnSync([process.execPath, 'scripts/clean.ts', '--cache', '--dry-run'], {
      cwd: ROOT,
      env: { ...process.env, CHALKFILE_CACHE_DIR: cache },
    });
    expect(r.exitCode).toBe(0);
    expect(r.stdout.toString()).toContain(`消すもの: ${path.join(cache, 'tts')}`);
    expect(r.stdout.toString()).toContain('何も消していない');
    expect(existsSync(path.join(cache, 'tts', 'a.wav'))).toBe(true);
  });
});
