import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { type Deps, deployWorker, type Env, type Options, type Run, servedFiles } from '../../scripts/deploy_worker';
import { required } from '../support/required';

const MAIN = 'c'.repeat(40);
const TOKEN = ['cfat', 'X'.repeat(44)].join('_');
let dist = '';
beforeAll(() => {
  dist = mkdtempSync(path.join(tmpdir(), 'chalkfile-deploy-'));
  writeFileSync(path.join(dist, 'index.html'), '<h1>top</h1>');
  writeFileSync(path.join(dist, 'sw.js'), 'self.x=1');
  mkdirSync(path.join(dist, 'course'));
  writeFileSync(path.join(dist, 'course/index.html'), '<h1>course</h1>');
  mkdirSync(path.join(dist, 'assets'));
  writeFileSync(path.join(dist, 'assets/a.png'), 'png');
});
afterAll(() => rmSync(dist, { recursive: true, force: true }));

type Fake = {
  /** wrangler deployments status が返す版（呼ぶたびに 1 つずつ進む。最後のものを使い続ける） */
  versions?: (string | null)[];
  deploy?: number;
  /** 確かめ（verify_public・HTML の smoke）の終了コード（呼ぶたびに 1 つずつ進む） */
  checks?: number[];
  /** 公開したものの中身（無ければ、組み立てたものと同じ） */
  served?: Record<string, string>;
  head?: string;
  statusError?: string;
};
const options = (o: Partial<Options> = {}): Options => ({
  target: 'production',
  origin: 'https://chalkfile.com/',
  dist,
  main: MAIN,
  drill: false,
  waitMs: 20000,
  retryMs: 1000,
  ...o,
});
const fake = (f: Fake = {}) => {
  const calls: { cmd: string[]; env: Env }[] = [];
  const versions = [...(f.versions ?? ['v-old', 'v-new'])];
  const checks = [...(f.checks ?? [])];
  let clock = 0;
  const run: Run = async (cmd, { env }) => {
    calls.push({ cmd, env });
    const text = cmd.join(' ');
    if (text.startsWith('git ls-remote'))
      return { code: 0, stdout: `${f.head ?? MAIN}\trefs/heads/main\n`, stderr: '' };
    if (text.includes('deployments status')) {
      if (f.statusError) return { code: 1, stdout: '', stderr: f.statusError };
      const v = versions.length > 1 ? versions.shift() : versions[0];
      if (v === null) return { code: 1, stdout: '', stderr: 'The Worker chalkfile has no deployments.' };
      if (v === 'error') return { code: 1, stdout: '', stderr: 'Authentication error [code: 10000]' };
      return {
        code: 0,
        stdout: JSON.stringify({ id: 'd', versions: [{ version_id: v, percentage: 100 }] }),
        stderr: '',
      };
    }
    if (text.includes('wrangler deploy')) return { code: f.deploy ?? 0, stdout: '', stderr: '' };
    if (text.includes('wrangler rollback')) {
      versions.splice(0, versions.length, required(cmd[4]));
      return { code: 0, stdout: '', stderr: '' };
    }
    if (text.startsWith('bun '))
      return { code: checks.length ? (checks.shift() as number) : 0, stdout: '', stderr: '' };
    throw new Error(`知らないコマンド: ${text}`);
  };
  const files = Object.fromEntries(servedFiles(dist).map(([route, file]) => [route, Bun.file(file)]));
  const deps: Deps = {
    run,
    fetch: async (url) => {
      const route = url.pathname;
      if (f.served?.[route] !== undefined) return new Response(f.served[route]);
      return files[route] ? new Response(await files[route].arrayBuffer()) : new Response('', { status: 404 });
    },
    sleep: async (ms) => {
      clock += ms;
    },
    now: () => clock,
    log: () => {},
    summary: () => {},
    env: {
      PATH: process.env.PATH,
      CLOUDFLARE_API_TOKEN: TOKEN,
      CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32),
      GITHUB_SHA: MAIN,
    },
  };
  const ran = (word: string) => calls.filter((c) => c.cmd.join(' ').includes(word));
  return { deps, calls, ran };
};

describe('Worker を出して、確かめて、通らなければ前の版に戻す', () => {
  test('確かめが通れば、戻さない', async () => {
    const { deps, ran } = fake();
    expect(await deployWorker(options(), deps)).toBe('deployed');
    expect(ran('wrangler deploy --env=')).toHaveLength(1);
    expect(ran('verify_public')).toHaveLength(1);
    expect(ran('worker-site-smoke')).toHaveLength(1);
    expect(ran('rollback')).toHaveLength(0);
  });
  test('確かめのコマンドと git には token と account を渡さない。wrangler には渡す', async () => {
    const { deps, calls } = fake();
    await deployWorker(options(), deps);
    for (const c of calls) {
      const wrangler = c.cmd.includes('wrangler');
      expect(c.env.CLOUDFLARE_API_TOKEN === TOKEN).toBe(wrangler);
      expect(c.env.CLOUDFLARE_ACCOUNT_ID !== undefined).toBe(wrangler);
      expect(c.cmd.join(' ')).not.toContain(TOKEN);
    }
    expect(calls.filter((c) => c.cmd[0] === 'npx').every((c) => c.cmd[1] === '--no-install')).toBe(true);
  });
  test('確かめが 2 回続けて通らなければ、控えた前の版に戻して失敗で終える', async () => {
    const { deps, ran } = fake({ checks: [1, 0, 1, 0] });
    expect(await deployWorker(options(), deps)).toBe('rolled-back');
    expect(ran('verify_public')).toHaveLength(2);
    const rollback = required(ran('rollback')[0]);
    expect(rollback.cmd.slice(0, 6)).toEqual(['npx', '--no-install', 'wrangler', 'rollback', 'v-old', '--env=']);
    expect(rollback.cmd).toContain('--yes');
    expect(required(rollback.cmd[rollback.cmd.indexOf('--message') + 1]).length).toBeLessThanOrEqual(100);
  });
  test('1 回目だけ通らなければ、流し直して通れば戻さない', async () => {
    const { deps, ran } = fake({ checks: [0, 1, 0, 0] });
    expect(await deployWorker(options(), deps)).toBe('deployed');
    expect(ran('worker-site-smoke')).toHaveLength(2);
    expect(ran('rollback')).toHaveLength(0);
  });
  test('公開した HTML が組み立てたものと同じにならなければ、待ったあとで戻す', async () => {
    const { deps, ran } = fake({
      served: {
        '/course/': '<h1>course</h1><script src="https://static.cloudflareinsights.com/beacon.min.js"></script>',
      },
    });
    expect(await deployWorker(options(), deps)).toBe('rolled-back');
    expect(ran('verify_public')).toHaveLength(0);
    expect(ran('rollback')).toHaveLength(1);
  });
  test('wrangler deploy が止まり、版が変わっていなければ、戻さずに失敗で終える', async () => {
    const { deps, ran } = fake({ deploy: 1, versions: ['v-old'] });
    expect(await deployWorker(options(), deps)).toBe('failed');
    expect(ran('rollback')).toHaveLength(0);
    expect(ran('verify_public')).toHaveLength(0);
  });
  test('wrangler deploy が途中で止まり、版が変わっていれば、前の版に戻す', async () => {
    const { deps, ran } = fake({ deploy: 1, versions: ['v-old', 'v-half'] });
    expect(await deployWorker(options(), deps)).toBe('rolled-back');
    expect(required(ran('rollback')[0]).cmd[4]).toBe('v-old');
  });
  test('main の先頭でなければ、何も出さない', async () => {
    const { deps, ran } = fake({ head: 'd'.repeat(40) });
    expect(await deployWorker(options(), deps)).toBe('skipped');
    expect(ran('wrangler')).toHaveLength(0);
  });
  test('今の版を読めなければ、出す前に止まる', async () => {
    const { deps, ran } = fake({ statusError: 'Authentication error [code: 10000]' });
    await expect(deployWorker(options(), deps)).rejects.toThrow('今の版を読めない');
    expect(ran('wrangler deploy --env')).toHaveLength(0);
  });
  test('出したあとで版を読めなくても、確かめて、通らなければ控えた版に戻す', async () => {
    const { deps, ran } = fake({ versions: ['v-old', 'error', 'v-old'], checks: [1, 1, 1, 1] });
    expect(await deployWorker(options(), deps)).toBe('rolled-back');
    expect(ran('verify_public')).toHaveLength(2);
    expect(required(ran('rollback')[0]).cmd[4]).toBe('v-old');
  });
  test('初めての公開で確かめが通らなければ、戻す版が無いので失敗で終える', async () => {
    const { deps, ran } = fake({ versions: [null, 'v-new'], checks: [1, 1, 1, 1] });
    expect(await deployWorker(options(), deps)).toBe('failed');
    expect(ran('rollback')).toHaveLength(0);
  });
  test('--drill は preview だけで、確かめが通っても前の版に戻す', async () => {
    await expect(deployWorker(options({ drill: true }), fake().deps)).rejects.toThrow('--drill');
    const { deps, ran } = fake();
    const preview = options({
      target: 'preview',
      origin: 'https://chalkfile-preview.example.workers.dev/',
      main: undefined,
      drill: true,
    });
    expect(await deployWorker(preview, deps)).toBe('rolled-back');
    expect(required(ran('wrangler deploy --env')[0]).cmd).toContain('--env=preview');
    expect(required(ran('rollback')[0]).cmd).toContain('--env=preview');
    expect(ran('git ls-remote')).toHaveLength(0);
  });
});

test('公開したものと比べるのは、全部のページと sw.js', () => {
  expect(servedFiles(dist).map(([route]) => route)).toEqual(['/', '/course/', '/sw.js']);
});
