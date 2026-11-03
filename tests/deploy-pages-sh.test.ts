import { describe, expect, test } from 'bun:test';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// scripts/legacy/deploy_pages.sh を、一時の bare リポジトリを origin にした作業フォルダで流す。
// 点検と移行案内の組み立て（bun）は偽物に置き換え、GitHub・chalkfile.com・本物の gh-pages には触れない
const FAKE_BUN = `#!/bin/sh
echo "bun $*" >> "$FAKE_LOG"
if [ "$1" = scripts/build_migration.ts ]; then
  rm -rf site/migration-dist && mkdir -p site/migration-dist
  printf moved > site/migration-dist/index.html; printf new > site/migration-dist/new.html; : > site/migration-dist/.nojekyll
fi
`;

/** origin（bare）に main と今の gh-pages（index.html・old.html）を置き、main を取り出した作業フォルダで deploy_pages.sh を流せるようにする */
const sandbox = (body: (s: ReturnType<typeof setup>) => void) => {
  const s = setup();
  try {
    body(s);
  } finally {
    rmSync(s.dir, { recursive: true, force: true });
  }
};
const setup = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'chalkfile-pages-'));
  // 手元の Git の設定（hooks・署名など）は使わない
  const env = {
    ...process.env,
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    PATH: `${path.join(dir, 'bin')}:${process.env.PATH}`,
    FAKE_LOG: path.join(dir, 'calls.log'),
  };
  const git = (cwd: string, ...args: string[]) => {
    const r = Bun.spawnSync(['git', ...args], { cwd, env });
    if (r.exitCode !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr.toString()}`);
    return r.stdout.toString().trim();
  };
  const origin = path.join(dir, 'origin.git');
  const pages = path.join(dir, 'pages');
  const work = path.join(dir, 'work');
  git(dir, 'init', '-q', '--bare', origin);
  mkdirSync(pages);
  writeFileSync(path.join(pages, 'index.html'), 'old');
  writeFileSync(path.join(pages, 'old.html'), 'old');
  git(pages, 'init', '-q', '-b', 'gh-pages');
  git(pages, 'add', '-A');
  git(pages, '-c', 'user.name=old', '-c', 'user.email=old@example.com', 'commit', '-q', '-m', 'old');
  git(pages, 'push', '-q', origin, 'gh-pages');
  mkdirSync(path.join(work, 'scripts/legacy'), { recursive: true });
  copyFileSync(
    path.join(import.meta.dir, '../scripts/legacy/deploy_pages.sh'),
    path.join(work, 'scripts/legacy/deploy_pages.sh'),
  );
  writeFileSync(path.join(work, '.gitignore'), 'site/migration-dist/\n');
  git(work, 'init', '-q', '-b', 'main');
  git(work, 'config', 'user.name', 'chalkfile');
  git(work, 'config', 'user.email', 'chalkfile@users.noreply.github.com');
  git(work, 'remote', 'add', 'origin', origin);
  git(work, 'add', '-A');
  git(work, 'commit', '-q', '-m', 'main');
  git(work, 'push', '-q', 'origin', 'main');
  mkdirSync(path.join(dir, 'bin'));
  writeFileSync(path.join(dir, 'bin/bun'), FAKE_BUN);
  chmodSync(path.join(dir, 'bin/bun'), 0o755);
  const run = (...args: string[]) => {
    const r = Bun.spawnSync(['bash', 'scripts/legacy/deploy_pages.sh', ...args], { cwd: work, env });
    return { code: r.exitCode, stdout: r.stdout.toString(), stderr: r.stderr.toString() };
  };
  return {
    dir,
    git,
    origin,
    work,
    run,
    pagesSha: () => git(origin, 'rev-parse', 'gh-pages'),
    backups: () => git(work, 'for-each-ref', '--format=%(objectname)', 'refs/chalkfile-backups'),
    calls: () => (existsSync(env.FAKE_LOG) ? readFileSync(env.FAKE_LOG, 'utf8').trim().split('\n') : []),
  };
};

describe('deploy_pages.sh は、今の gh-pages の SHA を確かめて渡したときだけ置き換える', () => {
  test('--help と知らない引数では何も流さない', () =>
    sandbox((s) => {
      const before = s.pagesSha();
      const help = s.run('--help');
      expect(help.code).toBe(0);
      expect(help.stdout).toContain('--confirm <SHA>');
      for (const args of [['--force'], ['--confirm'], ['--confirm', '']]) expect(s.run(...args).code).toBe(2);
      expect(s.calls()).toEqual([]);
      expect(s.pagesSha()).toBe(before);
    }));
  test('引数なしは下見だけ。置き換える中身と今の SHA を出し、push も復旧用の参照もしない', () =>
    sandbox((s) => {
      const before = s.pagesSha();
      const r = s.run();
      expect(r.code).toBe(0);
      for (const line of [
        `今の gh-pages: ${before}`,
        '足す    .nojekyll',
        '足す    new.html',
        '変える  index.html',
        '消す    old.html',
        `--confirm ${before}`,
      ])
        expect(r.stdout).toContain(line);
      expect(r.stdout).not.toContain('移行案内にしました');
      expect(s.calls()).toContain('bun scripts/check_content.ts --require-denylist');
      expect(s.pagesSha()).toBe(before);
      expect(s.backups()).toBe('');
    }));
  test('--confirm の SHA が今の gh-pages と違えば、点検の前に止まる', () =>
    sandbox((s) => {
      const before = s.pagesSha();
      const r = s.run('--confirm', '0'.repeat(40));
      expect(r.code).toBe(1);
      expect(r.stderr).toContain('下見をやり直し');
      expect(s.calls()).toEqual([]);
      expect(s.pagesSha()).toBe(before);
    }));
  test('最新の origin/main でなければ、--confirm があっても止まる', () =>
    sandbox((s) => {
      const before = s.pagesSha();
      s.git(s.work, 'commit', '-q', '--allow-empty', '-m', 'push していない変更');
      expect(s.run('--confirm', before).code).toBe(1);
      expect(s.pagesSha()).toBe(before);
    }));
  test('--confirm に今の SHA を渡すと、移行案内に置き換えて、前の版を復旧用の参照に残す', () =>
    sandbox((s) => {
      const before = s.pagesSha();
      const r = s.run('--confirm', before);
      expect(r.code).toBe(0);
      expect(s.pagesSha()).not.toBe(before);
      expect(s.git(s.origin, 'ls-tree', '-r', '--name-only', 'gh-pages').split('\n')).toEqual([
        '.nojekyll',
        'index.html',
        'new.html',
      ]);
      expect(s.git(s.origin, 'show', 'gh-pages:index.html')).toBe('moved');
      expect(s.backups()).toBe(before);
    }));
});
