// 外の道具（git・gh・ffmpeg・uv など）の流し方。終了コード・時間切れ・道具が無いことを 1 つの形で返し、
// 失敗を見せるときは、秘密情報に見えるものを伏せた stderr の終わりだけを出す
import { spawnSync } from 'node:child_process';
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
  return { code: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '', timedOut };
};

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

/** 標準入出力をそのまま渡して流し、終了コードを返す（子の道具の出力を、そのまま見せる）。道具が無ければ MissingError */
export const runInherit = (cmd: string, args: string[], opts: Pick<RunOptions, 'cwd' | 'env'> = {}): number => {
  const r = spawnSync(cmd, args, { cwd: opts.cwd, env: opts.env, stdio: 'inherit' });
  if ((r.error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') {
    throw new MissingError(`${cmd} が見つからない（入れてから流す。docs/guide/quickstart.md の「前提の道具」）`);
  }
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
