// 外の道具（git・gh・ffmpeg・uv など）の流し方。終了コード・時間切れ・道具が無いことを 1 つの形で返し、
// 失敗を見せるときは、秘密情報に見えるものを伏せた stderr の終わりだけを出す。
// --verbose を受け取った道具は setVerbose(true) を呼ぶ。そのあとは、流すコマンドと、失敗したときの stderr の全部（伏せてから）も出す
import { spawn, spawnSync } from 'node:child_process';
import { MissingError } from './args';

/**
 * 秘密情報に見えるもの（token・Authorization・署名つきの URL の query）を伏せる。gh・git のエラーの出力を見せる前に通す。
 * 道具は既存の認証を内部で使う。認証ファイル・token・HTTP header を読み出したり表示したりしない
 */
export const redact = (text: string): string =>
  text
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/g, '［伏せた token］')
    .replace(/(authorization:?\s*)(?:bearer\s+|token\s+|basic\s+)?\S+/gi, '$1［伏せた］')
    .replace(/(https?:\/\/[^\s"'<>?]+)\?[^\s"'<>]*/g, '$1?［伏せた］');

/** 出力の終わりの lines 行を、伏せてから 1 行につなぐ（chars 字まで） */
export const tailOf = (text: string, lines = 5, chars = 500): string =>
  redact(text).trim().split('\n').slice(-lines).join(' / ').slice(0, chars);

/* ───────────── --verbose ───────────── */

let verbose = false;
/** --verbose（-v）を受け取った道具が呼ぶ。流すコマンド・外への問い合わせ・失敗したときの stderr の全部を、標準エラーに出す */
export const setVerbose = (on: boolean): void => {
  verbose = on;
};
/** --verbose のときだけ、1 行を標準エラーに出す（秘密情報に見えるものは伏せる） */
export const trace = (line: string): void => {
  if (verbose) console.error(redact(line));
};
/** 流すコマンドを、見せる形にする（空白などを含む引数は引用符で囲む） */
const shown = (cmd: string, args: string[]) =>
  [cmd, ...args].map((a) => (/^[\w@%+=:,./-]+$/.test(a) ? a : `'${a.replace(/'/g, `'\\''`)}'`)).join(' ');
/** 失敗したときの stderr を、--verbose なら全部出す（伏せてから） */
const traceFailure = (cmd: string, r: RunResult) => {
  if (!verbose || (r.code === 0 && !r.timedOut)) return;
  trace(`${cmd}: ${r.timedOut ? '時間切れで止めた' : `終了コード ${r.code}`}${r.stderr.trim() ? `。stderr:\n${r.stderr.trimEnd()}` : ''}`);
};

export type RunOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  /** 標準入力に渡す文字 */
  input?: string;
  /** これより長くかかったら止める（ミリ秒） */
  timeoutMs?: number;
  /** 受け取る出力の上限（バイト。既定 64 MiB） */
  maxBuffer?: number;
};
export type RunResult = { code: number; stdout: string; stderr: string; timedOut: boolean };

/** 流して、終了コードと出力を返す（失敗しても止めない）。道具が無ければ MissingError */
export const run = (cmd: string, args: string[], opts: RunOptions = {}): RunResult => {
  trace(`> ${shown(cmd, args)}`);
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd,
    env: opts.env,
    input: opts.input,
    timeout: opts.timeoutMs,
    maxBuffer: opts.maxBuffer ?? 64 * 1024 * 1024,
    encoding: 'utf8',
    stdio: [opts.input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
  });
  const code = (r.error as NodeJS.ErrnoException | undefined)?.code;
  if (code === 'ENOENT')
    throw new MissingError(`${cmd} が見つからない（入れてから流す。docs/guide/quickstart.md の「前提の道具」）`);
  const timedOut = code === 'ETIMEDOUT';
  if (r.error && !timedOut) throw r.error;
  const result = { code: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '', timedOut };
  traceFailure(cmd, result);
  return result;
};

/**
 * 流して、終了コードと出力を返す（非同期。ffmpeg を並べて流すときなど）。失敗しても止めない。道具が無ければ MissingError。
 * timeoutMs を過ぎたら止め（SIGKILL）、timedOut を true にする。出力は maxBuffer（既定 64 MiB）を超えたら、終わりの分だけを残す
 */
export const runAsync = (cmd: string, args: string[], opts: Omit<RunOptions, 'input'> = {}): Promise<RunResult> =>
  new Promise((resolve, reject) => {
    trace(`> ${shown(cmd, args)}`);
    const limit = opts.maxBuffer ?? 64 * 1024 * 1024;
    const child = spawn(cmd, args, { cwd: opts.cwd, env: opts.env, stdio: ['ignore', 'pipe', 'pipe'] });
    const collect = () => {
      let chunks: Buffer[] = [];
      let size = 0;
      return {
        push: (b: Buffer) => {
          chunks.push(b);
          size += b.length;
          if (size > limit) {
            const all = Buffer.concat(chunks).subarray(-limit);
            chunks = [all];
            size = all.length;
          }
        },
        text: () => Buffer.concat(chunks).toString('utf8'),
      };
    };
    const out = collect();
    const err = collect();
    child.stdout.on('data', out.push);
    child.stderr.on('data', err.push);
    let timedOut = false;
    const timer =
      opts.timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
            timedOut = true;
            child.kill('SIGKILL');
          }, opts.timeoutMs);
    child.on('error', (e: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      reject(
        e.code === 'ENOENT'
          ? new MissingError(`${cmd} が見つからない（入れてから流す。docs/guide/quickstart.md の「前提の道具」）`)
          : e,
      );
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const result = { code: code ?? 1, stdout: out.text(), stderr: err.text(), timedOut };
      traceFailure(cmd, result);
      resolve(result);
    });
  });

/**
 * 流して、標準出力を返す。失敗したら（終了コードが 0 でない・時間切れ）、what と、伏せた stderr の終わりを付けて止める
 */
export const runOrThrow = (cmd: string, args: string[], opts: RunOptions & { what?: string } = {}): string => {
  const r = run(cmd, args, opts);
  if (r.code === 0 && !r.timedOut) return r.stdout;
  const why = r.timedOut ? `${Math.round((opts.timeoutMs ?? 0) / 1000)} 秒で終わらなかった` : `終了コード ${r.code}`;
  const detail = tailOf(r.stderr);
  throw new Error(
    `${opts.what ?? `${cmd} ${args[0] ?? ''}`.trim()} が失敗した（${why}）${detail ? `: ${detail}` : ''}`,
  );
};

/**
 * 標準入出力をそのまま渡して流し、終了コードを返す（子の道具の出力を、そのまま見せる）。道具が無ければ MissingError。
 * timeoutMs を過ぎたら止めて、what（無ければコマンドの名前）が終わらなかったことを投げる
 */
export const runInherit = (
  cmd: string,
  args: string[],
  opts: Pick<RunOptions, 'cwd' | 'env' | 'timeoutMs'> & { what?: string } = {},
): number => {
  trace(`> ${shown(cmd, args)}`);
  const r = spawnSync(cmd, args, { cwd: opts.cwd, env: opts.env, stdio: 'inherit', timeout: opts.timeoutMs });
  const code = (r.error as NodeJS.ErrnoException | undefined)?.code;
  if (code === 'ENOENT') {
    throw new MissingError(`${cmd} が見つからない（入れてから流す。docs/guide/quickstart.md の「前提の道具」）`);
  }
  if (code === 'ETIMEDOUT')
    throw new Error(
      `${opts.what ?? cmd} が ${Math.round((opts.timeoutMs ?? 0) / 1000)} 秒で終わらなかったので止めた`,
    );
  if (r.error) throw r.error;
  return r.status ?? 1;
};

/**
 * git の参照のロック（.git の refs の <名前>.lock）を、ほかの作業フォルダの fetch と取り合ったときの失敗。
 * 作業フォルダ（worktree）は .git を共有するので、2 つの作業フォルダで同時に fetch すると起きうる。少し待って流し直せば通る
 */
const REF_LOCKED =
  /cannot lock ref|unable to update local ref|Unable to create '[^']*\.lock'|fetching ref \S+ failed: reference already exists/i;
const sleepSync = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/** git fetch を流す。参照のロックの取り合いで失敗したときだけ、少し待って 4 回まで流し直す（ほかの失敗は、すぐに止める） */
export const gitFetch = (cwd: string, args: string[]): void => {
  for (let attempt = 1; ; attempt++) {
    const r = run('git', ['fetch', ...args], { cwd });
    if (r.code === 0) return;
    if (attempt >= 5 || !REF_LOCKED.test(r.stderr))
      throw new Error(`git fetch が失敗した: ${tailOf(r.stderr) || `終了コード ${r.code}`}`);
    sleepSync(250 * 2 ** (attempt - 1));
  }
};
