// 文字と地の色のコントラスト比（WCAG 2.x の相対輝度の式）。テーマの文字と地の組を数で見る。
// 今は数を出して記録するだけ（tests/engine.test.ts）。下限（本文 4.5・大きい文字 3.0）で止めるのは、見た目の更新（計画の T3A-14）でまとめて行う。
// 組の色は、描くときと同じパレット（engine/core/theme.ts の derivePalette）から取る。React・Remotion・Node に依存しない
import type { Theme, Tone } from '../../content/types';
import { rgb } from './color';
import { derivePalette } from './theme';

/** 相対輝度（0〜1）。sRGB の値を直線の明るさに戻して、目の感じ方の重みで足す */
export const luminance = (hex: string): number => {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** コントラスト比（1〜21）。どちらが文字でも同じ */
export const contrastRatio = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

export type ContrastPair = { role: string; fg: string; bg: string; ratio: number };

/**
 * テーマの、文字と地の組。role は「文字/地」で、tone ごとの組は「…:tone の名前」。
 * 暗いテーマのカードは、地の上に薄い白を重ねた面（src/components/ui.tsx の Glass）なので、surface は近い値として見る。
 * caption は焼き込み字幕の文字と名前札（パレットの onCode。今はテーマによらず白）
 */
export const themeContrast = (theme: Theme): ContrastPair[] => {
  const c = theme.color;
  const { C, TONES } = derivePalette(theme);
  const pairs: [string, string, string][] = [
    ['ink/bg', c.ink, c.bg],
    ['sub/surface', c.sub, c.surface],
    ['muted/bg2', c.muted, c.bg2],
    ['onAccent/accent', c.onAccent, c.accent],
    ['caption/code', C.onCode, c.code],
    ...Object.entries(theme.syntax).map(([k, v]): [string, string, string] => [`syntax.${k}/code`, v, c.code]),
  ];
  for (const t of Object.keys(theme.tones) as Tone[]) {
    const main = theme.tones[t];
    pairs.push([`tone.main/surface:${t}`, main, c.surface]);
    pairs.push([`tone.text/surface:${t}`, TONES[t].text, c.surface]);
    pairs.push([`onTone/tone.main:${t}`, C.onTone, main]);
    pairs.push([`caption/tone.main:${t}`, C.onCode, main]);
  }
  return pairs.map(([role, fg, bg]) => ({ role, fg, bg, ratio: contrastRatio(fg, bg) }));
};

/** 組の一覧を、役割ごとのいちばん低い比にまとめる（tone ごと・syntax ごとの組は 1 つにする）。数は小数 2 桁に丸める */
export const contrastSummary = (pairs: ContrastPair[]): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const p of pairs) {
    const role = p.role.replace(/:.*$/, '').replace(/^syntax\.\w+/, 'syntax');
    out[role] = Math.min(out[role] ?? Infinity, Math.round(p.ratio * 100) / 100);
  }
  return out;
};
