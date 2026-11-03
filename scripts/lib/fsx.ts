// ファイルの書き方の決まり。同じ作業フォルダで道具を並べて流しても（別々の動画の synth を 2 つなど）、ファイルが壊れないようにする。
//   writeAtomic: 同じフォルダの一時の名前に書いてから置き換える（読む側には、前の中身か新しい中身のどちらかだけが見える）
//   withLock:    ロックのファイル（持ち主の pid・ホスト・時刻・用途を書く）を作ってから流す。持ち主のいない古いロックは取り直す
import { randomBytes } from 'node:crypto';
import { linkSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** file と同じフォルダの、ほかと重ならない一時の名前（.<名前>.<pid>.<乱数>.tmp）。rename で置き換えるので、同じフォルダに置く */
export const tempPath = (file: string): string =>
  path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`);

/**
 * 一時の名前に書いてから置き換える。途中で止まっても、前の中身か新しい中身のどちらかになる。
 * 同時に書いても、どちらか一方の中身がそろって残る（混ざらない）
 */
export const writeAtomic = (file: string, data: string | Uint8Array): void => {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = tempPath(file);
  try {
    writeFileSync(tmp, data, { flag: 'wx' });
    renameSync(tmp, file);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
};

/** ロックのファイルの中身（持ち主） */
type Holder = { pid: number; host: string; at: string; what: string; token: string };

export type LockOptions = {
  /** ロックの用途（待つときと、止まるときに出す） */
  what?: string;
  /** 持ち主が終わるのを待つ長さ（ミリ秒。既定 10 分）。過ぎたら、持ち主を出して止める */
  timeoutMs?: number;
  /** これより古いロックは、持ち主のプロセスが動いていても取り直す（ミリ秒。既定 6 時間） */
  staleMs?: number;
  /** 待つときに、確かめ直す間（ミリ秒） */
  pollMs?: number;
  /** 待ち始めたときに 1 回だけ出す */
  log?: (line: string) => void;
};

const readHolder = (file: string): Holder | null => {
  try {
    const v = JSON.parse(readFileSync(file, 'utf8')) as Partial<Holder>;
    return typeof v.pid === 'number' && typeof v.token === 'string' ? (v as Holder) : null;
  } catch {
    return null;
  }
};

/** pid のプロセスが、このホストで動いているか（権限が無くて確かめられないものは、動いているとみなす） */
const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
};

/** 取り直してよいロックか: 持ち主がこのホストのもう無いプロセスか、staleMs より古い。中身が読めないものは取り直さない（書きかけかもしれない） */
const isStale = (h: Holder | null, staleMs: number): boolean => {
  if (!h) return false;
  const age = Date.now() - Date.parse(h.at);
  if (Number.isFinite(age) && age > staleMs) return true;
  return h.host === os.hostname() && !alive(h.pid);
};

/** ロックを作る（中身を書いた一時のファイルを link する。中身の無いロックが見える時間を作らない）。もうあれば false */
const create = (file: string, holder: Holder): boolean => {
  const tmp = tempPath(file);
  writeFileSync(tmp, `${JSON.stringify(holder)}\n`, { flag: 'wx' });
  try {
    linkSync(tmp, file);
    return true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EEXIST') return false;
    throw e;
  } finally {
    rmSync(tmp, { force: true });
  }
};

/** 古いロックをどける。どけたものが、古いと判断したロックそのものでなければ（その間に取り直された）、元に戻す */
const removeStale = (file: string, stale: Holder): void => {
  const moved = tempPath(file);
  try {
    renameSync(file, moved);
  } catch {
    return;
  }
  if (readHolder(moved)?.token === stale.token) rmSync(moved, { force: true });
  else {
    try {
      linkSync(moved, file);
    } catch {
      // その間に、また別のプロセスがロックを作った。そちらを残す
    }
    rmSync(moved, { force: true });
  }
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * ロックのファイルを作ってから fn を流し、終わったら（失敗しても）消す。ほかのプロセスが持っていれば、終わるのを待つ。
 * 持ち主のプロセスがもう無い（同じホスト）か、staleMs より古いロックは取り直す。同じ作業フォルダのほか、
 * 共有のキャッシュのように、ほかの作業フォルダの道具ともぶつかる所に使う
 */
export const withLock = async <T>(file: string, fn: () => Promise<T> | T, opts: LockOptions = {}): Promise<T> => {
  const { what = path.basename(file), timeoutMs = 10 * 60_000, staleMs = 6 * 3_600_000, pollMs = 200, log } = opts;
  mkdirSync(path.dirname(file), { recursive: true });
  const me: Holder = {
    pid: process.pid,
    host: os.hostname(),
    at: new Date().toISOString(),
    what,
    token: randomBytes(8).toString('hex'),
  };
  const deadline = Date.now() + timeoutMs;
  let told = false;
  while (!create(file, { ...me, at: new Date().toISOString() })) {
    const holder = readHolder(file);
    if (holder && isStale(holder, staleMs)) {
      removeStale(file, holder);
      continue;
    }
    if (Date.now() > deadline) {
      const who = holder ? `pid ${holder.pid}（${holder.host}・${holder.at}・${holder.what}）` : '読めない持ち主';
      throw new Error(
        `${what} のロックが ${Math.round(timeoutMs / 1000)} 秒たっても外れない: ${file}（持ち主は ${who}。そのプロセスが無いなら、このファイルを消す）`,
      );
    }
    if (!told && log) {
      log(`${what}: ほかのプロセス（pid ${holder?.pid ?? '?'}）が終わるのを待つ`);
      told = true;
    }
    await sleep(pollMs);
  }
  try {
    return await fn();
  } finally {
    // 自分のロックだけを消す（取り直されていたら、触らない）
    if (readHolder(file)?.token === me.token) rmSync(file, { force: true });
  }
};
