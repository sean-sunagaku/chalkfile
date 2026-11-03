import React, { createContext, useContext } from 'react';
import { FONTS } from '../engine/core/fonts';
import type { Lang } from '../engine/core/i18n';
import type { Theme } from '../engine/core/schema';
import { derivePalette, type Palette } from '../engine/core/theme';
import { CONTENT, VIDEO } from './video.config';

// 画面の大きさと内容の枠の値は src/video.config.ts。部品はここから短い名前で読む
export const W = VIDEO.width;
export const H = VIDEO.height;
export const PAD = CONTENT.pad;
export const CONTENT_TOP = CONTENT.top;
export const CONTENT_BOTTOM = CONTENT.bottom;

/* ───────────── 色の計算（engine/core/color.ts） ───────────── */

export { alpha, BLACK, WHITE } from '../engine/core/color';

/* ───────────── テーマ（ThemeProvider と usePalette） ─────────────
 * 1 本の動画は 1 つのテーマで描く。LectureVideo（src/Lecture.tsx）が ThemeProvider で動画全体を包み、
 * 部品は usePalette() でパレットを読む（const { C, tone, SANS } = usePalette()）。色は engine/core/theme.ts の derivePalette が作る。
 * 書体の名前は engine/core/fonts.ts の FONTS。ファイルは手元の engine/fonts/ から、src/fonts.ts の useFonts が読み込む（src/Lecture.tsx）
 */

/** 動画の部品が使うパレット。engine/core/theme.ts の色に、書体の名前（本文の SANS・等幅の MONO。CSS の font-family）を足す */
export type VideoPalette = Palette & { SANS: string; MONO: string };

const withFonts = new WeakMap<Palette, VideoPalette>();

/** テーマと言語のパレット（テーマと言語ごとに 1 回だけ作る）。書体の読み込みは src/fonts.ts の useFonts */
export const videoPalette = (theme: Theme, lang: Lang = 'ja'): VideoPalette => {
  const p = derivePalette(theme, lang);
  let v = withFonts.get(p);
  if (!v) {
    const SANS = [...p.fonts.map((f) => FONTS[f].family), 'sans-serif'].join(', ');
    v = { ...p, SANS, MONO: `${FONTS.mono.family}, ${SANS}` };
    withFonts.set(p, v);
  }
  return v;
};

const PaletteContext = createContext<VideoPalette | null>(null);

/** 子の部品に、このテーマと言語のパレットを渡す */
export const ThemeProvider: React.FC<{ theme: Theme; lang: Lang; children: React.ReactNode }> = ({ theme, lang, children }) =>
  React.createElement(PaletteContext.Provider, { value: videoPalette(theme, lang) }, children);

/** 今描いているテーマのパレット */
export const usePalette = (): VideoPalette => {
  const p = useContext(PaletteContext);
  if (!p) throw new Error('ThemeProvider の外で usePalette が使われた（src/Lecture.tsx の LectureVideo が ThemeProvider で包む）');
  return p;
};
