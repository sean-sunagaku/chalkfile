import { describe, expect, test } from 'bun:test';
import { pool } from '../../scripts/lib/pool';

/** 時間に頼らず、処理が終わる順番を決める。 */
const deferred = () => {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

describe('並行処理の失敗と終了', () => {
  test('失敗したら次を始めず、処理中のものが終わってから元の失敗を返す', async () => {
    const first = deferred();
    const second = deferred();
    const error = new Error('変換に失敗');
    const started: number[] = [];
    let settled = false;
    const result = pool([1, 2, 3, 4], 2, async (item) => {
      started.push(item);
      await (item === 1 ? first.promise : second.promise);
    }).then(
      () => {
        settled = true;
        return { ok: true };
      },
      (reason: unknown) => {
        settled = true;
        return { ok: false, reason };
      },
    );
    expect(started).toEqual([1, 2]);
    first.reject(error);
    await first.promise.catch(() => {});
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(started).toEqual([1, 2]);
    second.resolve();
    expect(await result).toEqual({ ok: false, reason: error });
    expect(started).toEqual([1, 2]);
  });

  test('最初の失敗が undefined でも、後から起きた失敗で上書きしない', async () => {
    const first = deferred();
    const second = deferred();
    const result = pool([first, second], 2, (item) => item.promise).then(
      () => ({ ok: true }),
      (reason: unknown) => ({ ok: false, reason }),
    );
    first.reject(undefined);
    await first.promise.catch(() => {});
    second.reject(new Error('後からの失敗'));
    expect(await result).toEqual({ ok: false, reason: undefined });
  });

  test('同期的に例外が出たときも、残りの処理を始めない', async () => {
    const started: number[] = [];
    const error = new Error('開始できない');
    await expect(
      pool([1, 2, 3], 2, (item) => {
        started.push(item);
        throw error;
      }),
    ).rejects.toBe(error);
    expect(started).toEqual([1]);
  });

  test('不正な同時実行数は、空の一覧でも拒否する', async () => {
    for (const n of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
      let called = false;
      const run = async () => {
        called = true;
      };
      await expect(pool([1], n, run)).rejects.toBeInstanceOf(RangeError);
      await expect(pool([], n, run)).rejects.toBeInstanceOf(RangeError);
      expect(called).toBe(false);
    }
  });

  test('同時実行数が件数より多くても、各項目は 1 回ずつ終わる', async () => {
    const seen: number[] = [];
    await pool([1, 2, 3], 10, async (item) => {
      seen.push(item);
    });
    expect(seen).toEqual([1, 2, 3]);
  });
});
