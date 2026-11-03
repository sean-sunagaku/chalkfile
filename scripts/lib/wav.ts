// WAV（RIFF）の読み方。台詞の音声の長さを、ヘッダーから出す
import { closeSync, fstatSync, openSync, readSync } from 'node:fs';

/** WAV の fmt と data のチャンクから読んだ形。bytes は data の大きさ、block は 1 サンプルの全チャンネル分のバイト数 */
type Format = { rate: number; block: number; bytes: number };

/**
 * fmt と data のチャンクを読む。size はファイル全体の大きさ（head が頭だけのときも、data が途中で切れていないかを見る）。
 * data が途中で切れていれば止める（書きかけ・壊れたファイルを使わない）
 */
const formatOf = (head: Buffer, size = head.length): Format => {
  let off = 12;
  let rate = 0;
  let block = 0;
  while (off + 8 <= head.length) {
    const id = head.toString('ascii', off, off + 4);
    const bytes = head.readUInt32LE(off + 4);
    if (id === 'fmt ') {
      rate = head.readUInt32LE(off + 12);
      block = head.readUInt16LE(off + 20);
    }
    if (id === 'data') {
      if (off + 8 + bytes > size)
        throw new Error(`WAV が途中で切れている（data は ${bytes} バイトのはずが ${size - off - 8} バイト）`);
      return { rate, block, bytes };
    }
    off += 8 + bytes + (bytes % 2);
  }
  throw new Error('data チャンクが無い');
};

/** WAV の長さ（秒）。fmt と data のチャンクから出す。data が途中で切れていれば止める（書きかけ・壊れたファイルを使わない） */
export const wavSeconds = (buf: Buffer): number => {
  const { rate, block, bytes } = formatOf(buf);
  return bytes / (rate * block);
};

/**
 * WAV のファイルの長さを、サンプルの数で出す（頭の 64 KiB だけを読む）。samples / rate は wavSeconds と同じ値になる
 * （data の大きさがブロックの倍数なら、どちらも同じ有理数を 1 回だけ丸めた値）。倍数でない WAV は止める
 */
export const wavFileSamples = (file: string): { samples: number; rate: number } => {
  const fd = openSync(file, 'r');
  try {
    const head = Buffer.alloc(64 * 1024);
    const n = readSync(fd, head, 0, head.length, 0);
    const { rate, block, bytes } = formatOf(head.subarray(0, n), fstatSync(fd).size);
    if (!rate || !block) throw new Error('fmt チャンクが無い');
    if (bytes % block) throw new Error(`data の大きさ（${bytes} バイト）が、1 サンプルの大きさ（${block} バイト）の倍数でない`);
    return { samples: bytes / block, rate };
  } finally {
    closeSync(fd);
  }
};
