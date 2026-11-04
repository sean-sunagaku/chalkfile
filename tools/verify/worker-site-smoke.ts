// 公開サイトか手元の Worker の全ページ・CSP・SW scope を、共通の Playwright project で確かめる。
//   npm run verify:site -- [BASE_URL]（環境変数 BASE_URL も使える。既定は http://127.0.0.1:8787/）
// 前提: 起動済みのサイトと Chrome（PW_CHANNEL で変更）。権限: ネットワークとローカルへの書き込み。
// 副作用: 専用のブラウザ context でサイトを読み、.work/evidence/site-smoke.json と検査の証跡を書く。
import path from 'node:path';
import { readArgs, runMain, showHelp, UsageError } from '../../scripts/lib/args';

export async function runSiteSmoke(base: string): Promise<void> {
  const root = path.resolve(import.meta.dir, '../..');
  const child = Bun.spawn(
    [
      'node',
      path.join(root, 'node_modules/@playwright/test/cli.js'),
      'test',
      '--config',
      path.join(import.meta.dir, 'playwright.config.ts'),
      '--project=smoke',
    ],
    {
      cwd: root,
      env: { ...process.env, BASE_URL: base },
      stdout: 'inherit',
      stderr: 'inherit',
    },
  );
  if (await child.exited) throw new Error('サイトの smoke が失敗した');
}

async function main(argv: string[]) {
  const { values, positionals } = readArgs(argv, {}, { positionals: true });
  if (values.help) return showHelp(import.meta.filename);
  if (positionals.length > 1) throw new UsageError('BASE_URL は 1 つだけ指定する');
  const base = positionals[0] ?? process.env.BASE_URL ?? 'http://127.0.0.1:8787/';
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    throw new UsageError('BASE_URL は http(s) の URL にする');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new UsageError('BASE_URL は認証情報のないサイトのルート URL にする');
  await runSiteSmoke(url.href);
}
if (import.meta.main) await runMain(main);
