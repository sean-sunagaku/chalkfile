// 文字と地の色のコントラスト比（WCAG 2.x の相対輝度の式）。テーマの文字と地の組を数で見る。
// 今は数を出して記録するだけ（tests/engine.test.ts）。下限（本文 4.5・大きい文字 3.0）で止めるのは、見た目の更新（計画の T3A-14）でまとめて行う。
// React・Remotion・Node に依存しない
import type { Theme, Tone } from '../../content/types';

const HEX = /^#[0-9A-Fa-f]{6}$/;

const channels = (hex: string): [number, number, number] => {
  if (!HEX.test(hex)) throw new Error(`#RRGGBB でない色: ${hex}`);
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
};

/** 相対輝度（0〜1）。sRGB の値を直線の明るさに戻して、目の感じ方の重みで足す */
export const luminance = (hex: string): number => {
  const [r, g, b] = channels(hex).map((c) => {
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

/** 2 色を混ぜる（t=0 で a、t=1 で b）。src/theme.ts の mix と同じ式（T3A-04 で 1 つにする） */
export const mixHex = (a: string, b: string, t: number): string => {
  const x = channels(a);
  const y = channels(b);
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
};

/** 図の色（tone）から作る文字色。src/theme.ts の applyTheme と同じ作り方（暗い地は白に、明るい地は ink に寄せる） */
export const toneText = (theme: Theme, t: Tone): string =>
  theme.scheme === 'dark' ? mixHex(theme.tones[t], '#FFFFFF', 0.45) : mixHex(theme.tones[t], theme.color.ink, 0.3);

/** 図の色の上に乗せる文字（src/theme.ts の C.onTone） */
export const onTone = (theme: Theme): string => (theme.scheme === 'dark' ? '#0B0F24' : '#FFFFFF');

/** 字幕の文字と名前札の文字（src/Lecture.tsx の Captions。テーマによらず白） */
export const CAPTION_TEXT = '#FFFFFF';

export type ContrastPair = { role: string; fg: string; bg: string; ratio: number };

/**
 * テーマの、文字と地の組。role は「文字/地」で、tone ごとの組は「…:tone の名前」。
 * 暗いテーマのカードは、地の上に薄い白を重ねた面（src/components/ui.tsx の Glass）なので、surface は近い値として見る
 */
export const themeContrast = (theme: Theme): ContrastPair[] => {
  const c = theme.color;
  const pairs: [string, string, string][] = [
    ['ink/bg', c.ink, c.bg],
    ['sub/surface', c.sub, c.surface],
    ['muted/bg2', c.muted, c.bg2],
    ['onAccent/accent', c.onAccent, c.accent],
    ['caption/code', CAPTION_TEXT, c.code],
    ...Object.entries(theme.syntax).map(([k, v]): [string, string, string] => [`syntax.${k}/code`, v, c.code]),
  ];
  for (const t of Object.keys(theme.tones) as Tone[]) {
    const main = theme.tones[t];
    pairs.push([`tone.main/surface:${t}`, main, c.surface]);
    pairs.push([`tone.text/surface:${t}`, toneText(theme, t), c.surface]);
    pairs.push([`onTone/tone.main:${t}`, onTone(theme), main]);
    pairs.push([`caption/tone.main:${t}`, CAPTION_TEXT, main]);
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
