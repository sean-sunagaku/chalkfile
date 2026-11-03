import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadJetBrains } from '@remotion/google-fonts/JetBrainsMono';
import { loadFont as loadNoto } from '@remotion/google-fonts/NotoSansJP';
import { loadFont as loadNotoSC } from '@remotion/google-fonts/NotoSansSC';
import { loadFont as loadZenMaru } from '@remotion/google-fonts/ZenMaruGothic';
import type { Lang } from '../content/i18n';
import { fontsFor, themeOf } from '../content/themes';
import type { FontKey, Theme, Tone } from '../content/types';
import { derivePalette, type PaletteColors, type ToneSet } from '../engine/core/theme';
import { CONTENT, VIDEO } from './video.config';

// 画面の大きさと内容の枠の値は src/video.config.ts。部品はここから短い名前で読む
export const W = VIDEO.width;
export const H = VIDEO.height;
export const PAD = CONTENT.pad;
export const CONTENT_TOP = CONTENT.top;
export const CONTENT_BOTTOM = CONTENT.bottom;

/* ───────────── 色の計算（engine/core/color.ts） ───────────── */

export { alpha, mix } from '../engine/core/color';

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

/* ───────────── 今のテーマ ─────────────
 * 1 本の動画は 1 つのテーマで描く。LectureVideo が描き始めに applyTheme を呼び、
 * ここの値（ES Modules の live binding）を差し替える。色は engine/core/theme.ts の derivePalette が作る（テーマごとに 1 回）
 */

export let THEME: Theme;
export let C: PaletteColors;
export let TONES: Record<Tone, ToneSet>;
export let GRAD = '';
/** 大きな数字や文字の塗り */
export let DISPLAY = '';
export let SANS = '';
export let MONO = '';
export let SYNTAX: Theme['syntax'];
export let MESH: string[] = [];

let fontsOf = '';

/** fonts=false は色だけ差し替える（読み込みの前の仮の値。書体は描くテーマと言語の分だけ読む） */
export const applyTheme = (theme: Theme, fonts = true, lang: Lang = 'ja') => {
  if (fonts && fontsOf !== `${theme.id}:${lang}`) {
    fontsOf = `${theme.id}:${lang}`;
    SANS = [...fontsFor(theme, lang).map(family), 'sans-serif'].join(', ');
    MONO = `${family('mono')}, ${SANS}`;
  }
  if (THEME === theme) return;
  const p = derivePalette(theme);
  THEME = theme;
  C = p.C;
  TONES = p.TONES;
  GRAD = p.GRAD;
  DISPLAY = p.DISPLAY;
  SYNTAX = p.SYNTAX;
  MESH = p.MESH;
};

applyTheme(themeOf(), false);

export const tone = (t?: Tone) => TONES[t ?? 'violet'];
