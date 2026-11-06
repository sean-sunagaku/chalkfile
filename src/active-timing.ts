/** 開始時刻順の台詞・字幕から、先出しを含めて最後に始まった添字を引く。同時刻なら後の台詞を使う。 */
export const lastStartedIndex = (cues: readonly { start: number }[], frame: number, lead = 0): number => {
  let low = 0;
  let high = cues.length;
  while (low < high) {
    const mid = low + Math.floor((high - low) / 2);
    // biome-ignore lint/style/noNonNullAssertion: low < high <= cues.length の内側を選ぶ
    if (frame >= cues[mid]!.start - lead) low = mid + 1;
    else high = mid;
  }
  return low - 1;
};
