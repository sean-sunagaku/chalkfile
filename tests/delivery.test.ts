import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkArtifact, validateWorkerConfig, validateWorkflow } from '../scripts/check_delivery';
import { migrationHtml, migrationUrl } from '../scripts/build_migration';

const workflow = () => Bun.YAML.parse(readFileSync('.github/workflows/deploy.yml', 'utf8')) as any;
test('Workerを先に通すのは/media/だけで、静的404もassetsに任せる', () => {
  const value = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
  expect(() => validateWorkerConfig(value)).not.toThrow();
  for (const first of [true, ['/*'], ['/media/*', '/api/*']]) {
    expect(() => validateWorkerConfig({ ...value, assets: { ...value.assets, run_worker_first: first } })).toThrow();
  }
});
test('公開は main/production・最小権限・SHA固定・検証後のsecret限定にする', () => {
  expect(() => validateWorkflow(workflow())).not.toThrow();
  const mutations: ((v: any) => void)[] = [
    (v) => v.permissions.contents = 'write', (v) => v.on.push.branches.push('feature'),
    (v) => v.jobs.deploy.if += ' || true', (v) => v.jobs.deploy.environment.name = 'preview',
    (v) => v.jobs.deploy.steps[0].uses = 'actions/checkout@main',
    (v) => v.jobs.deploy.steps[0].with['persist-credentials'] = true,
    (v) => v.jobs.deploy.env = { VALUE: '${{ secrets.CLOUDFLARE_API_TOKEN }}' },
    (v) => v.jobs.deploy.steps[3].env = { VALUE: '${{ secrets.CLOUDFLARE_API_TOKEN }}' },
    (v) => v.jobs.deploy.steps.reverse(),
    (v) => v.concurrency['cancel-in-progress'] = true,
  ];
  for (const mutate of mutations) { const value = workflow(); mutate(value); expect(() => validateWorkflow(value)).toThrow(); }
});
test('公開物から機密情報・認証ファイル・MP4を拒否し、値をエラーに出さない', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'chalkfile-delivery-'));
  try {
    writeFileSync(path.join(dir, 'index.html'), '<h1>Chalkfile</h1>');
    expect(checkArtifact(dir)).toBe(1);
    const synthetic = ['ghp', 'X'.repeat(36)].join('_');
    for (const content of [synthetic, `CLOUDFLARE_API_TOKEN: '${'X'.repeat(40)}'`]) {
      writeFileSync(path.join(dir, 'private.txt'), content);
      expect(() => checkArtifact(dir)).toThrow();
      try { checkArtifact(dir); } catch (error) { expect(String(error)).not.toContain(content); }
    }
    rmSync(path.join(dir, 'private.txt'));
    for (const name of ['.env', '.dev.vars', 'video.mp4']) {
      writeFileSync(path.join(dir, name), 'test'); expect(() => checkArtifact(dir)).toThrow(); rmSync(path.join(dir, name));
    }
    mkdirSync(path.join(dir, 'nested')); writeFileSync(path.join(dir, 'nested/private.key'), 'test');
    expect(() => checkArtifact(dir)).toThrow();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('旧URLのパス・query・hashを保持し、移行先originは固定する', () => {
  expect(migrationUrl('/chalkfile/nudge-product/?from=old#N01')).toBe('https://chalkfile.com/nudge-product/?from=old#N01');
  expect(migrationUrl('/chalkfile///evil.example/path?url=https://elsewhere.example/#section')).toBe('https://chalkfile.com/evil.example/path?url=https://elsewhere.example/#section');
  const html = migrationHtml('nudge-product/');
  expect(html).toContain('<link rel="canonical" href="https://chalkfile.com/nudge-product/">');
  expect(html).toContain('http-equiv="refresh"');
  const script = /<script>([\s\S]+)<\/script>/.exec(html)![1];
  expect(() => new Function(script)).not.toThrow();
  expect(script).toContain('next.search=location.search;next.hash=location.hash;');
});
