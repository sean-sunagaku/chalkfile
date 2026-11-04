// サイトの文字の色を、置く地の色に対して読める濃さにする（WCAG 2.x の 1.4.3。本文の下限 4.5）。
// テーマの色（content/themes.ts）は動画と共有なので変えず、サイトの CSS に出すときだけ、本文の色へ少しずつ寄せる。
// 比の計算と色の混ぜ方は、動画と同じ式（engine/core/contrast.ts・engine/core/color.ts）
import { mix } from '../../engine/core/color';
import { contrastRatio } from '../../engine/core/contrast';

/** 本文の文字のコントラスト比の下限 */
export const TEXT_CONTRAST = 4.5;
/** ブラウザが重ねた色（薄い色の面）を丸める分の余裕 */
const MARGIN = 0.1;

/**
 * fg を、どの地（grounds）に対しても比が下限（と余裕）以上になるまで、toward（本文の色）へ 1% ずつ寄せた色。
 * はじめから届いていれば fg のまま。寄せきっても届かなければ toward
 */
export const readableOn = (fg: string, grounds: readonly string[], toward: string): string => {
  for (let i = 0; i <= 100; i++) {
    const c = i === 0 ? fg : mix(fg, toward, i / 100);
    if (grounds.every((g) => contrastRatio(c, g) >= TEXT_CONTRAST + MARGIN)) return c;
  }
  return toward;
};
