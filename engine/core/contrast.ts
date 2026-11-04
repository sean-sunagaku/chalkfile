// 文字と地の色のコントラスト比（WCAG 2.x の相対輝度の式）。テーマの、文字と地の組と下限を、役割ごとに決める。
// 下限は engine/core/theme.ts の CONTRAST_MIN（本文 4.5・大きい文字 3.0）。全部のテーマで下限に届くことを、テスト（tests/unit/engine.test.ts）と
// 台本の検証（engine/core/validate.ts の validateTheme）が確かめる。組の色は、描くときと同じパレット（derivePalette）から取る。
// React・Remotion・Node に依存しない
import { contrastRatio, mix, WHITE } from './color';
import type { Theme, Tone } from './schema';
import { CONTRAST_MIN, derivePalette, gradientMiddle } from './theme';

/** コントラスト比の式は engine/core/color.ts（パレットも使う） */
export { contrastRatio, luminance } from './color';

export type ContrastPair = { role: string; fg: string; bg: string; ratio: number; min: number };

/** rgba(r,g,b,a) の白を、地に重ねた色（コードの面の上の行番号と窓の題） */
const over = (ground: string, rgba: string): string => {
  const a = Number(/rgba\(255,255,255,([\d.]+)\)/.exec(rgba)?.[1] ?? 1);
  return mix(ground, WHITE, a);
};

/**
 * テーマの、文字と地の組（役割・文字の色・地の色・比・下限）。role は「文字/地」で、tone ごとの組は「…:tone の名前」。
 * 本文（4.5）: 見出しと本文の文字（ink・sub）・補足（muted。レクチャーの番号・出典・注意書き・クレジット）・図の色の文字（tone の text）・
 *   焼き込み字幕（onCode）・コードの色分け（syntax）・コードの行番号と窓の題（codeMuted）
 * 大きい文字（3.0）: 太字の大きな数と強調（tone の strong。明るい地の強調の主役の色 accent）・図の色の面の上の文字（tone の on。札・丸の中の数・名前札）・
 *   主役の色の上の文字（onAccent）・まとめの番号（onGrad。グラデーションの真ん中）・大きな番号の塗り（display）
 * 暗いテーマのカードは、地の上に薄い白を重ねた面（src/components/ui.tsx の Glass）なので、surface は近い値として見る
 */
export const themeContrast = (theme: Theme): ContrastPair[] => {
  const c = theme.color;
  const { C, TONES, SYNTAX } = derivePalette(theme);
  const B = CONTRAST_MIN.body;
  const L = CONTRAST_MIN.large;
  const codeShade = C.codeShade;
  const pairs: [string, string, string, number][] = [
    ['ink/bg', C.ink, c.bg, B],
    ['ink/bg2', C.ink, c.bg2, B],
    ['ink/surface', C.ink, c.surface, B],
    ['sub/surface', C.sub, c.surface, B],
    ['sub/bg2', C.sub, c.bg2, B],
    ['muted/bg', C.muted, c.bg, B],
    ['muted/bg2', C.muted, c.bg2, B],
    ['muted/surface', C.muted, c.surface, B],
    ['caption/code', C.onCode, c.code, B],
    ['codeMuted/code', over(c.code, C.codeMuted), c.code, B],
    ['codeMuted/codeShade', over(codeShade, C.codeMuted), codeShade, B],
    ...Object.entries(SYNTAX).map(([k, v]): [string, string, string, number] => [`syntax.${k}/code`, v, c.code, B]),
    ['onAccent/accent', c.onAccent, c.accent, L],
    ...theme.display.flatMap((d, i): [string, string, string, number][] => [
      [`display/bg:${i}`, d, c.bg, L],
      [`display/bg2:${i}`, d, c.bg2, L],
    ]),
  ];
  // まとめの番号はグラデーションの真ん中に乗る（パレットと同じ所の色で見る）
  gradientMiddle(theme.gradient).forEach((g, i) => {
    pairs.push([`onGrad/gradient:${i}`, C.onGrad, g, L]);
  });
  // 明るい地の、チョークでないテーマの強調（tone を書かないとき）は、主役の色の文字（src/components/ui.tsx の emphasis）
  if (theme.scheme === 'light' && theme.decor !== 'chalk') pairs.push(['accent/bg', c.accent, c.bg, L], ['accent/surface', c.accent, c.surface, L]);
  const soft = theme.scheme === 'dark' ? 0.15 : 0.1;
  for (const t of Object.keys(theme.tones) as Tone[]) {
    const { main, text, strong, on } = TONES[t];
    pairs.push(
      [`tone.text/surface:${t}`, text, c.surface, B],
      [`tone.text/bg2:${t}`, text, c.bg2, B],
      [`tone.text/soft:${t}`, text, mix(c.surface, main, soft), B],
      [`tone.strong/surface:${t}`, strong, c.surface, L],
      [`tone.strong/bg2:${t}`, strong, c.bg2, L],
      [`tone.on/main:${t}`, on, main, L],
    );
  }
  return pairs.map(([role, fg, bg, min]) => ({ role, fg, bg, ratio: contrastRatio(fg, bg), min }));
};

/** 下限に届かない組（無ければ空） */
export const contrastProblems = (theme: Theme): ContrastPair[] => themeContrast(theme).filter((p) => p.ratio < p.min);

/** 組の一覧を、役割ごとのいちばん低い比にまとめる（tone ごと・syntax ごと・色ごとの組は 1 つにする）。数は小数 2 桁に丸める */
export const contrastSummary = (pairs: ContrastPair[]): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const p of pairs) {
    const role = p.role.replace(/:.*$/, '').replace(/^syntax\.\w+/, 'syntax');
    out[role] = Math.min(out[role] ?? Infinity, Math.round(p.ratio * 100) / 100);
  }
  return out;
};
