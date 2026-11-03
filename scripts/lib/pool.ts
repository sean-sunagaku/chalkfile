// 決まった数ずつ並べて流す（ffmpeg の変換・ページの取得・静止画の書き出し）

/**
 * items を、同時に n 本ずつ流す（1 本終わるたびに次を始める）。1 本でも失敗したら、その失敗で止まる
 * （流れている分は、最後まで流れる）
 */
export const pool = async <T>(items: readonly T[], n: number, run: (item: T) => Promise<void>): Promise<void> => {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) await run(items[next++]);
    }),
  );
};
