// 静止画の比較（stills-compare.ts）の片側（基準か今）を書き出す部品。stills-compare.ts が、その側のフォルダを cwd にした別のプロセスで流す。
//   使い方: bun scripts/stills-compare-side.ts <job.json>   # 直接は流さない。job.json の形は下の SideJob。結果（SideResult）は <job>.result.json
// 側ごとにプロセスを分ける理由: @remotion/bundler は react・react-dom・remotion を、自分の置き場所から解決する（webpack の alias）。
//   @remotion/renderer は、自分の版に合う Chrome Headless Shell を cwd の node_modules/.remotion に置いて使う。
//   1 つのプロセスで両側を書き出すと、依存の違いが静止画に出ない。そこで bundler と renderer を、その側の node_modules から読む
import type * as Bundler from '@remotion/bundler';
import type * as Renderer from '@remotion/renderer';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** stills-compare.ts が書く仕事 */
export type SideJob = {
  /** その側のフォルダ（src/index.ts と node_modules がある所） */
  dir: string;
  /** ログの頭（基準・今） */
  label: string;
  /** 静止画を書くフォルダ */
  outDir: string;
  /** バンドルを書くフォルダ（stills-compare.ts の一時フォルダの中。終わったら一時フォルダごと消える） */
  bundleDir: string;
  /** 静止画に音は要らないので、空のフォルダを渡す */
  publicDir: string;
  /** 同時に書き出す枚数 */
  concurrency: number;
  stills: { name: string; composition: string; frame: number; inputProps: Record<string, unknown> }[];
};
/** 書き出せなかった静止画（名前 → 理由）。バンドルか Chrome が動かないときは fatal */
export type SideResult = { failed: Record<string, string>; fatal?: string };

const firstLine = (e: unknown) => (e instanceof Error ? e.message : String(e)).split('\n')[0];

/** 決まった数ずつ並べて流す */
const pool = async <T>(items: T[], n: number, run: (x: T) => Promise<void>) => {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) await run(items[next++]);
    }),
  );
};

const jobPath = process.argv[2];
if (!jobPath) throw new Error('使い方: bun scripts/stills-compare-side.ts <job.json>（stills-compare.ts が流す）');
const job: SideJob = JSON.parse(readFileSync(jobPath, 'utf8'));

// 書体を読む要求が多いという警告（@remotion/google-fonts。直すのは計画の T3A-14）は、静止画 1 枚ごとに出て一覧が読めなくなるので、ここでは出さない
for (const k of ['log', 'warn'] as const) {
  const print = console[k].bind(console);
  console[k] = (...args: unknown[]) => {
    if (!args.some((a) => typeof a === 'string' && a.includes('network requests to load fonts'))) print(...args);
  };
}

/** その側の node_modules から読む */
const load = <T>(name: string): Promise<T> => import(Bun.resolveSync(name, job.dir));

const result: SideResult = { failed: {} };
let browser: Awaited<ReturnType<typeof Renderer.openBrowser>> | null = null;
try {
  const { bundle } = await load<typeof Bundler>('@remotion/bundler');
  const { openBrowser, renderStill, selectComposition } = await load<typeof Renderer>('@remotion/renderer');
  const serveUrl = await bundle({
    entryPoint: path.join(job.dir, 'src/index.ts'),
    rootDir: job.dir,
    outDir: job.bundleDir,
    publicDir: job.publicDir,
    onProgress: () => {},
  });
  browser = await openBrowser('chrome', { logLevel: 'error' });
  const puppeteerInstance = browser;
  let done = 0;
  await pool(job.stills, job.concurrency, async ({ name, composition: id, frame, inputProps }) => {
    try {
      const common = { serveUrl, inputProps, puppeteerInstance, logLevel: 'error', onBrowserLog: () => {} } as const;
      const composition = await selectComposition({ ...common, id });
      const output = path.join(job.outDir, name);
      await renderStill({ ...common, composition, output, frame, imageFormat: 'png', overwrite: true });
    } catch (e) {
      result.failed[name] = firstLine(e);
    }
    if (++done % 20 === 0 || done === job.stills.length)
      console.log(`  ${job.label}: 書き出し ${done} / ${job.stills.length}`);
  });
} catch (e) {
  result.fatal = firstLine(e);
} finally {
  await browser?.close({ silent: true }).catch(() => {});
}
writeFileSync(jobPath.replace(/\.json$/, '.result.json'), JSON.stringify(result));
process.exit(result.fatal ? 1 : 0);
