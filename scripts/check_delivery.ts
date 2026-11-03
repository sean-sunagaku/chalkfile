import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { checkSecrets } from './check_content';

export const DEPLOY_GUARD = "github.repository == 'sean-sunagaku/chalkfile' && github.ref == 'refs/heads/main'";
export function validateWorkerConfig(value: any) {
  if (value.name !== 'chalkfile' || value.assets?.directory !== './site/dist' ||
      JSON.stringify(value.assets?.run_worker_first) !== JSON.stringify(['/media/*']) || value.assets?.not_found_handling !== '404-page') {
    throw new Error('静的サイトをWorkerへ通さない配信設定が不正です。');
  }
  // /media/* の失敗を Workers Logs で見えるようにしておく（W-13）。logs.enabled があれば、そちらが優先する。
  if ((value.observability?.logs?.enabled ?? value.observability?.enabled) !== true) throw new Error('Workers Logs（observability）が有効ではありません。');
}
export function validateWorkflow(value: any) {
  const fail = () => { throw new Error('Actions の公開条件・権限・secret の範囲・順序が不正です。'); };
  if (JSON.stringify(value.permissions) !== JSON.stringify({ contents: 'read' }) ||
      JSON.stringify(value.on?.push?.branches) !== JSON.stringify(['main']) || Object.keys(value.on).some((k) => !['push', 'workflow_dispatch'].includes(k)) ||
      value.concurrency?.group !== 'chalkfile-production' || value.concurrency?.['cancel-in-progress'] !== false || value.env) fail();
  const job = value.jobs?.deploy;
  if (!job || Object.keys(value.jobs).length !== 1 || job.if !== DEPLOY_GUARD || job.environment?.name !== 'production' || job.env || job.permissions) fail();
  const steps = job.steps as any[];
  for (const step of steps) {
    if (step.uses && !/^[A-Za-z0-9_./-]+@[a-f0-9]{40}$/.test(step.uses)) fail();
    if (step.uses?.startsWith('actions/checkout@') && step.with?.['persist-credentials'] !== false) fail();
    if (step.name !== 'Deploy' && JSON.stringify(step).includes('secrets.')) fail();
  }
  const index = (text: string) => steps.findIndex((s) => typeof s.run === 'string' && s.run.includes(text));
  const install = index('npm ci --ignore-scripts'), media = index('bun scripts/media.ts check'), build = index('bun scripts/build_site.ts --strict');
  const deploy = index('npx --no-install wrangler deploy --env=""'), verify = index('bun scripts/verify_public.ts');
  if (!(install >= 0 && install < media && media < build && build < deploy && deploy < verify) ||
      steps[deploy]?.name !== 'Deploy' || steps[deploy]?.env?.CLOUDFLARE_API_TOKEN !== '${{ secrets.CLOUDFLARE_API_TOKEN }}' ||
      steps[deploy]?.env?.CLOUDFLARE_ACCOUNT_ID !== '${{ vars.CLOUDFLARE_ACCOUNT_ID }}' || !steps[deploy]?.run.includes('exit 1')) fail();
}
export function checkArtifact(dir: string) {
  let count = 0;
  const findings: Parameters<typeof checkSecrets>[2] = [];
  const inspect = (folder: string) => {
    for (const f of readdirSync(folder, { withFileTypes: true })) {
      const file = path.join(folder, f.name);
      if (f.isSymbolicLink() || /^(\.env(?:\..*)?|\.dev\.vars(?:\..*)?|.*\.(pem|key|local))$/.test(f.name)) throw new Error('公開物にローカル設定か認証ファイルがあります。');
      if (f.isDirectory()) { inspect(file); continue; }
      if (f.name.endsWith('.mp4') || statSync(file).size > 25 * 1024 ** 2) throw new Error('静的公開物に動画か大きすぎるファイルがあります。');
      count++;
      if (!/\.(png|jpg|jpeg|webp|ico)$/.test(f.name)) checkSecrets(readFileSync(file, 'utf8'), file, findings);
    }
  };
  inspect(dir);
  if (count > 20000 || findings.length) throw new Error('公開物の件数か機密情報の点検に失敗しました。値は表示しません。');
  return count;
}
if (import.meta.main) {
  const root = path.resolve(import.meta.dir, '..');
  validateWorkflow(Bun.YAML.parse(readFileSync(path.join(root, '.github/workflows/deploy.yml'), 'utf8')));
  validateWorkerConfig(JSON.parse(readFileSync(path.join(root, 'wrangler.jsonc'), 'utf8')));
  for (const name of ['check.yml', 'deploy.yml']) {
    const text = readFileSync(path.join(root, '.github/workflows', name), 'utf8');
    for (const m of text.matchAll(/uses:\s*(\S+)/g)) if (!/@[a-f0-9]{40}$/.test(m[1])) throw new Error('Action は SHA で固定してください。');
  }
  const dir = path.resolve(process.argv[2] ?? path.join(root, 'site/dist'));
  console.log(`Actions の公開条件と静的公開物 ${checkArtifact(dir)} files を確認。機密情報・MP4の混入なし。`);
}
