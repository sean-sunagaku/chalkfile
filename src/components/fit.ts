// 文字の幅の見込みと、幅に収まる文字の大きさ（タイトル・大きな一文・次の動画の題）。
// 半角の英数字と記号は 0.58em、ほか（かな・漢字・全角の記号）は 1em と見る（文字の合わせ方を 1 つにするのは計画の T3A-14）

/** 文字の幅の見込み（px） */
export const textWidth = (s: string, size: number) =>
  [...s].reduce((w, ch) => w + (/[\x20-\x7E]/.test(ch) ? 0.58 : 1) * size, 0);
/** 幅（px）に収まる文字の大きさ。max より大きくしない */
export const fitSize = (s: string, max: number, width: number) =>
  Math.min(max, Math.floor((max * width) / Math.max(1, textWidth(s, max))));
