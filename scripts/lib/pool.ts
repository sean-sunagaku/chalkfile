// 決まった数ずつ並べて流す（ffmpeg の変換・ページの取得・静止画の書き出し）

/**
 * items を、同時に n 本ずつ流す（1 本終わるたびに次を始める）。1 本でも失敗したら、その失敗で止まる
 * （新しい処理は始めず、流れている分が終わってから、最初の失敗を返す）
 */
export const pool = async <T>(items: readonly T[], n: number, run: (item: T) => Promise<void>): Promise<void> => {
  if (!Number.isSafeInteger(n) || n < 1) throw new RangeError('同時に流す数は 1 以上の整数にする');
  const pending = items.values();
  let failed = false;
  let firstError: unknown;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      // 失敗の検査から取り出しまで await を挟まず、項目を重ねて渡さない。
      while (!failed) {
        const item = pending.next();
        if (item.done) return;
        try {
          await run(item.value);
        } catch (error) {
          if (!failed) {
            failed = true;
            firstError = error;
          }
        }
      }
    }),
  );
  if (failed) throw firstError;
};
