// WAV（RIFF）の読み方。台詞の音声の長さを、ヘッダーから出す

/** WAV の長さ（秒）。fmt と data のチャンクから出す。data が途中で切れていれば止める（書きかけ・壊れたファイルを使わない） */
export const wavSeconds = (buf: Buffer): number => {
  let off = 12;
  let rate = 0;
  let block = 0;
  while (off < buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') {
      rate = buf.readUInt32LE(off + 12);
      block = buf.readUInt16LE(off + 20);
    }
    if (id === 'data') {
      if (off + 8 + size > buf.length)
        throw new Error(`WAV が途中で切れている（data は ${size} バイトのはずが ${buf.length - off - 8} バイト）`);
      return size / (rate * block);
    }
    off += 8 + size + (size % 2);
  }
  throw new Error('data チャンクが無い');
};
