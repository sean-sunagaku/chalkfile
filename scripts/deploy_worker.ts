// Worker を出し、公開したものを確かめ、通らなければ前の版に戻す。CI の deploy ジョブの「Deploy」の手順が流す（token はこの手順だけが持つ）。
//   bun scripts/deploy_worker.ts [--main <commit>]                              # 本番（https://chalkfile.com/）に出す
//   bun scripts/deploy_worker.ts --env preview --origin <URL> [--drill]         # preview に出す（持ち主が手元で rollback を試すとき）
// 流れ:
//   1. 今の版を控える（wrangler deployments status）
//   2. wrangler deploy（devDependency の固定の版）
//   3. 公開したページの HTML と sw.js が、組み立てた site/dist と同じバイトになるのを待つ（新しい版が届いたか・no-transform が効いているか）
//   4. verify_public（トップと全部の動画の Range）と HTML の smoke（tests/worker-site-smoke.ts。全ページ・SW の scope・CSP）
//   5. 3 か 4 が通らなければ（4 は間をおいて 1 回だけ流し直す）、1 で控えた版へ wrangler rollback して、1 で終える
// - 確かめのコマンドには、Cloudflare の token と account ID を渡さない（環境変数から外して流す）
// - --main を付けると、main の先頭がその commit でないときは何も出さずに終える（古い実行を流し直して、古い版を出さない）
// - --drill は preview だけ。確かめをわざと失敗させて、rollback が動くかを試す（docs/operations/recovery.md の「rollback を試す（preview）」）
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

const ROOT = path.resolve(import.meta.dir, '..');
const WRANGLER = ['npx', '--no-install', 'wrangler'];
/** 確かめのコマンドに渡さない環境変数（Cloudflare の token と account） */
const SECRET_ENV = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'];
export const PRODUCTION_ORIGIN = 'https://chalkfile.com/';

export type Env = Record<string, string | undefined>;
export type Run = (
  cmd: string[],
  opts: { capture: boolean; env: Env },
) => Promise<{ code: number; stdout: string; stderr: string }>;
export type Deps = {
  run: Run;
  fetch: (url: URL, init: RequestInit) => Promise<Response>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  log: (line: string) => void;
  /** GitHub のジョブの要約（$GITHUB_STEP_SUMMARY）に足す。手元では捨てる */
  summary: (markdown: string) => void;
  env: Env;
};
export type Options = {
  target: 'production' | 'preview';
  origin: string;
  /** 組み立てた site/dist */
  dist: string;
  /** main の先頭であるべき commit（CI の github.sha） */
  main?: string;
  drill: boolean;
  /** 公開したものが組み立てたものと同じになるのを待つ長さと、確かめを流し直すまでの間（ミリ秒） */
  waitMs: number;
  retryMs: number;
};
export type Outcome = 'deployed' | 'skipped' | 'rolled-back' | 'failed';

const envFlag = (o: Options) => (o.target === 'production' ? '--env=' : '--env=preview');
const withoutSecrets = (env: Env): Env =>
  Object.fromEntries(Object.entries(env).filter(([k]) => !SECRET_ENV.includes(k)));

/** main の先頭の commit（git ls-remote。token は渡さない） */
async function mainHead(d: Deps): Promise<string> {
  const r = await d.run(['git', 'ls-remote', '--exit-code', 'origin', 'refs/heads/main'], {
    capture: true,
    env: withoutSecrets(d.env),
  });
  const sha = /^([0-9a-f]{40})\s/.exec(r.stdout)?.[1];
  if (r.code !== 0 || !sha) throw new Error('main の先頭の commit を読めない（git ls-remote origin refs/heads/main）');
  return sha;
}

/** 今の版の Version ID。まだ一度も出していなければ null。段階的に出している途中なら止める（どこへ戻すか決められない） */
export async function activeVersion(o: Options, d: Deps): Promise<string | null> {
  const r = await d.run([...WRANGLER, 'deployments', 'status', '--json', envFlag(o)], { capture: true, env: d.env });
  if (r.code !== 0) {
    if (/has no deployments|does not exist/i.test(`${r.stdout}\n${r.stderr}`)) return null;
    throw new Error('今の版を読めない（wrangler deployments status）。token と account の設定を確かめる');
  }
  let versions: unknown;
  try {
    versions = JSON.parse(r.stdout.slice(r.stdout.indexOf('{'))).versions;
  } catch {
    throw new Error('wrangler deployments status --json の出力を読めない');
  }
  const list = Array.isArray(versions) ? versions : [];
  const id = list.length === 1 ? (list[0] as { version_id?: unknown }).version_id : undefined;
  if (typeof id !== 'string' || !id)
    throw new Error('いまは段階的な公開の途中か、版を読めない。自動では出さない（持ち主が状態を確かめる）');
  return id;
}

/** 組み立てたサイトのページ（index.html のあるフォルダ）と sw.js の、URL のパスとファイル */
export function servedFiles(dist: string): [route: string, file: string][] {
  const pages = (dir: string, prefix: string): [string, string][] => {
    const entries = readdirSync(dir, { withFileTypes: true });
    return [
      ...(entries.some((e) => e.isFile() && e.name === 'index.html')
        ? [[prefix, path.join(dir, 'index.html')] as [string, string]]
        : []),
      ...entries
        .filter((e) => e.isDirectory())
        .sort((a, b) => (a.name < b.name ? -1 : 1))
        .flatMap((e) => pages(path.join(dir, e.name), `${prefix}${e.name}/`)),
    ];
  };
  if (!existsSync(path.join(dist, 'index.html'))) throw new Error(`組み立てたサイトが無い: ${dist}`);
  return [...pages(dist, '/'), ['/sw.js', path.join(dist, 'sw.js')]];
}

/** 公開したものが、組み立てたものと同じバイトでないパスの一覧（空なら同じ） */
async function differences(o: Options, d: Deps, files: [string, string][]): Promise<string[]> {
  const out: string[] = [];
  for (const [route, file] of files) {
    try {
      const r = await d.fetch(new URL(route, o.origin), {
        redirect: 'manual',
        headers: { Accept: route.endsWith('/') ? 'text/html' : '*/*' },
        signal: AbortSignal.timeout(20000),
      });
      const body = new Uint8Array(await r.arrayBuffer());
      if (r.status !== 200 || !Buffer.from(body).equals(readFileSync(file))) out.push(route);
    } catch {
      out.push(route);
    }
  }
  return out;
}

/** 公開したものが組み立てたものと同じになるまで待つ。waitMs を過ぎても違うパスの一覧を返す */
async function waitServed(o: Options, d: Deps): Promise<string[]> {
  const files = servedFiles(o.dist);
  const until = d.now() + o.waitMs;
  for (;;) {
    const diff = await differences(o, d, files);
    if (!diff.length || d.now() >= until) return diff;
    await d.sleep(5000);
  }
}

/** 公開後の確かめ（token を渡さない）。通らなかったものの名前を返す */
async function checks(o: Options, d: Deps): Promise<string[]> {
  const env = withoutSecrets(d.env);
  const failed: string[] = [];
  for (const [name, cmd] of [
    ['verify_public（トップと全部の動画の Range）', ['bun', 'scripts/verify_public.ts', o.origin]],
    ['HTML の smoke（全ページ・SW の scope・CSP）', ['bun', 'tests/worker-site-smoke.ts', o.origin]],
  ] as const) {
    d.log(`確かめる: ${name}`);
    if ((await d.run([...cmd], { capture: false, env })).code !== 0) failed.push(name);
  }
  return failed;
}

async function rollback(o: Options, d: Deps, previous: string, reason: string): Promise<boolean> {
  d.log(`前の版 ${previous} に戻す（${reason}）`);
  const message = `公開後の確かめが通らないので戻す（${d.env.GITHUB_SHA?.slice(0, 7) ?? '手元'}）`.slice(0, 100);
  const r = await d.run([...WRANGLER, 'rollback', previous, envFlag(o), '--message', message, '--yes'], {
    capture: false,
    env: d.env,
  });
  const now = await activeVersion(o, d).catch(() => null);
  const ok = r.code === 0 && now === previous;
  d.log(
    ok
      ? `前の版 ${previous} に戻した`
      : `前の版に戻せたかを確かめられない（今の版: ${now ?? '読めない'}）。持ち主が手で戻す`,
  );
  return ok;
}

/** 出して、確かめて、通らなければ戻す。終わり方を返す（deployed と skipped のほかは、公開は失敗） */
export async function deployWorker(o: Options, d: Deps): Promise<Outcome> {
  if (o.drill && o.target !== 'preview')
    throw new Error('--drill は --env preview だけで使う（本番の確かめを、わざと失敗させない）');
  const where = o.target === 'production' ? '本番' : 'preview';
  if (o.main) {
    const head = await mainHead(d);
    if (head !== o.main) {
      const line = `main の先頭が ${head.slice(0, 7)} に進んでいるので、${o.main.slice(0, 7)} は出さない（新しい実行が出す）`;
      d.log(line);
      d.summary(`### 公開（${where}）\n\n- ${line}\n`);
      return 'skipped';
    }
  }
  const previous = await activeVersion(o, d);
  d.log(previous ? `今の版: ${previous}` : '今の版が無い（初めての公開。確かめが通らなくても、戻す版が無い）');

  const deploy = await d.run([...WRANGLER, 'deploy', envFlag(o)], { capture: false, env: d.env });
  if (deploy.code !== 0) {
    const now = await activeVersion(o, d).catch(() => undefined);
    if (previous && now && now !== previous) {
      const back = await rollback(o, d, previous, 'wrangler deploy が途中で止まった');
      d.summary(
        `### 公開（${where}）\n\n- wrangler deploy が途中で止まったので、前の版 \`${previous}\` に${back ? '戻した' : '戻せなかった'}\n`,
      );
      return back ? 'rolled-back' : 'failed';
    }
    d.log('wrangler deploy が止まった。今の版は変わっていない');
    d.summary(`### 公開（${where}）\n\n- wrangler deploy が止まった。今の版は変わっていない\n`);
    return 'failed';
  }
  const current = await activeVersion(o, d);
  d.log(`出した版: ${current}`);

  const problems: string[] = [];
  const diff = await waitServed(o, d);
  if (diff.length) problems.push(`公開した ${diff.join('・')} が、組み立てたものと同じにならない`);
  else {
    let failed = await checks(o, d);
    if (failed.length) {
      d.log(`確かめが通らない（${failed.join('・')}）。${Math.round(o.retryMs / 1000)} 秒おいて、もう 1 回流す`);
      await d.sleep(o.retryMs);
      failed = await checks(o, d);
    }
    problems.push(...failed.map((name) => `${name} が通らない`));
  }
  if (o.drill) problems.push('--drill で、確かめをわざと失敗にした');
  const head = `### 公開（${where}）\n\n- 出した版: \`${current}\`（前の版: \`${previous ?? 'なし'}\`）\n`;
  if (!problems.length) {
    d.summary(`${head}- 公開したページと sw.js は、組み立てたものと同じ\n- verify_public と HTML の smoke が通った\n`);
    return 'deployed';
  }
  for (const p of problems) d.log(p);
  if (!previous) {
    d.summary(`${head}- 確かめが通らない: ${problems.join(' / ')}\n- 戻す版が無い。持ち主が直す\n`);
    return 'failed';
  }
  const back = await rollback(o, d, previous, problems.join(' / '));
  d.summary(
    `${head}- 確かめが通らない: ${problems.join(' / ')}\n- 前の版 \`${previous}\` に${back ? '戻した' : '戻せなかった（持ち主が手で戻す）'}\n`,
  );
  return back ? 'rolled-back' : 'failed';
}

/** コマンドを流す（capture のときは、標準出力を受け取り、標準エラーは画面にも出す） */
const runCommand: Run = (cmd, { capture, env }) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd[0], cmd.slice(1), {
      cwd: ROOT,
      env: env as NodeJS.ProcessEnv,
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'inherit', 'inherit'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (b: Buffer) => {
      stdout += b.toString();
    });
    child.stderr?.on('data', (b: Buffer) => {
      stderr += b.toString();
      process.stderr.write(b);
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });

const USAGE = `使い方:
  bun scripts/deploy_worker.ts [--main <commit>]                        本番（${PRODUCTION_ORIGIN}）に出す（CI の Deploy の手順）
  bun scripts/deploy_worker.ts --env preview --origin <URL> [--drill]   preview に出す（--drill で、確かめをわざと失敗させて rollback を試す）`;

if (import.meta.main) {
  let values: { env?: string; origin?: string; main?: string; drill?: boolean; help?: boolean };
  try {
    ({ values } = parseArgs({
      options: {
        env: { type: 'string' },
        origin: { type: 'string' },
        main: { type: 'string' },
        drill: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
      },
      strict: true,
    }));
  } catch (error) {
    console.error(`${error instanceof Error ? error.message : String(error)}\n${USAGE}`);
    process.exit(2);
  }
  if (values.help) {
    console.log(USAGE);
    process.exit(0);
  }
  const target = values.env === 'preview' ? 'preview' : 'production';
  const origin = values.origin ?? (target === 'production' ? PRODUCTION_ORIGIN : undefined);
  if (
    (values.env !== undefined && !['production', 'preview'].includes(values.env)) ||
    !origin ||
    !/^https:\/\/[^/@\s]+\/$/.test(origin) ||
    (target === 'production' && (origin !== PRODUCTION_ORIGIN || values.drill)) ||
    (values.main !== undefined && !/^[0-9a-f]{40}$/.test(values.main))
  ) {
    console.error(
      `引数が違う（preview は --origin https://…/ が要る。本番の origin は ${PRODUCTION_ORIGIN} だけで、--drill は preview だけ）\n${USAGE}`,
    );
    process.exit(2);
  }
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  const outcome = await deployWorker(
    {
      target,
      origin,
      dist: path.join(ROOT, 'site/dist'),
      main: values.main,
      drill: values.drill ?? false,
      waitMs: 120000,
      retryMs: 30000,
    },
    {
      run: runCommand,
      fetch: (url, init) => fetch(url, init),
      sleep: (ms) => Bun.sleep(ms),
      now: () => Date.now(),
      log: (line) => console.log(line),
      summary: (markdown) => {
        if (summaryFile) appendFileSync(summaryFile, markdown);
      },
      env: process.env,
    },
  ).catch((error: unknown): never => {
    // 出す前に止まったとき（今の版を読めない など）。何も出していない
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
  console.log(
    `公開: ${{ deployed: '出した', skipped: '出さなかった（main の先頭ではない）', 'rolled-back': '確かめが通らず、前の版に戻した', failed: '失敗した' }[outcome]}`,
  );
  if (outcome === 'rolled-back' || outcome === 'failed') process.exit(1);
}
