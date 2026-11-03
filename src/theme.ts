import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadJetBrains } from '@remotion/google-fonts/JetBrainsMono';
import { loadFont as loadNoto } from '@remotion/google-fonts/NotoSansJP';
import { loadFont as loadNotoSC } from '@remotion/google-fonts/NotoSansSC';
import { loadFont as loadZenMaru } from '@remotion/google-fonts/ZenMaruGothic';
import React, { createContext, useContext } from 'react';
import type { Lang } from '../content/i18n';
import type { FontKey, Theme } from '../content/types';
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

/* ───────────── 書体（使うテーマの分だけ読み込む） ───────────── */

const families: Partial<Record<FontKey | 'mono', string>> = {};
const family = (k: FontKey | 'mono'): string => {
  if (!families[k]) {
    families[k] =
      k === 'zen-maru'
        ? loadZenMaru('normal', { weights: ['500', '700', '900'], ignoreTooManyRequestsWarning: true }).fontFamily
        : k === 'inter'
          ? loadInter('normal', { weights: ['400', '500', '600', '700', '800', '900'], subsets: ['latin'] }).fontFamily
          : k === 'noto'
            ? loadNoto('normal', { weights: ['400', '500', '700', '900'], ignoreTooManyRequestsWarning: true }).fontFamily
            : k === 'noto-sc'
              ? loadNotoSC('normal', { weights: ['400', '500', '700', '900'], ignoreTooManyRequestsWarning: true }).fontFamily
              : loadJetBrains('normal', { weights: ['400', '500', '700'], subsets: ['latin'] }).fontFamily;
  }
  return families[k]!;
};

/* ───────────── テーマ（ThemeProvider と usePalette） ─────────────
 * 1 本の動画は 1 つのテーマで描く。LectureVideo（src/Lecture.tsx）が ThemeProvider で動画全体を包み、
 * 部品は usePalette() でパレットを読む（const { C, tone, SANS } = usePalette()）。色は engine/core/theme.ts の derivePalette が作る
 */

/** 動画の部品が使うパレット。engine/core/theme.ts の色に、読み込んだ書体の名前（本文の SANS・等幅の MONO）を足す */
export type VideoPalette = Palette & { SANS: string; MONO: string };

const withFonts = new WeakMap<Palette, VideoPalette>();

/** テーマと言語のパレット。書体は、ここで初めて読み込む（テーマと言語ごとに 1 回だけ作る） */
export const videoPalette = (theme: Theme, lang: Lang = 'ja'): VideoPalette => {
  const p = derivePalette(theme, lang);
  let v = withFonts.get(p);
  if (!v) {
    const SANS = [...p.fonts.map(family), 'sans-serif'].join(', ');
    v = { ...p, SANS, MONO: `${family('mono')}, ${SANS}` };
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
