// ファイルの sha256。大きいファイル（動画・音声）も、全体をメモリに読まずに 1 MiB ずつ読む
import { createHash } from 'node:crypto';
import { closeSync, openSync, readSync } from 'node:fs';

/** ファイルの sha256（16 進） */
export const sha256File = (file: string): string => {
  const hash = createHash('sha256');
  const buf = Buffer.allocUnsafe(1 << 20);
  const fd = openSync(file, 'r');
  try {
    for (let n = readSync(fd, buf, 0, buf.length, null); n > 0; n = readSync(fd, buf, 0, buf.length, null))
      hash.update(buf.subarray(0, n));
  } finally {
    closeSync(fd);
  }
  return hash.digest('hex');
};
