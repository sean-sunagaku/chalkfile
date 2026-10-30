import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadJetBrains } from '@remotion/google-fonts/JetBrainsMono';
import { loadFont as loadNoto } from '@remotion/google-fonts/NotoSansJP';
import { loadFont as loadZenMaru } from '@remotion/google-fonts/ZenMaruGothic';
import { themeOf } from '../content/themes';
import type { FontKey, Theme, Tone } from '../content/types';

export const W = 1920;
export const H = 1080;
export const PAD = 96;
export const CONTENT_TOP = 228;
export const CONTENT_BOTTOM = 1000;

/* ───────────── 色の計算 ───────────── */

const rgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

/** #RRGGBB に透明度を付ける */
export const alpha = (hex: string, a: number) => {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};

/** 2 色を混ぜる（t=0 で a、t=1 で b） */
export const mix = (a: string, b: string, t: number) => {
  const x = rgb(a);
  const y = rgb(b);
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
};

const linear = (stops: string[], deg = 110) => `linear-gradient(${deg}deg, ${stops.join(', ')})`;

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
            : loadJetBrains('normal', { weights: ['400', '500', '700'], subsets: ['latin'] }).fontFamily;
  }
  return families[k]!;
};

/* ───────────── 今のテーマ ─────────────
 * 1 本の動画は 1 つのテーマで描く。LectureVideo が描き始めに applyTheme を呼び、
 * ここの値（ES Modules の live binding）を差し替える。部品は今までどおり C.ink や tone('mint') を読む。
 */

type ToneSet = { main: string; soft: string; deep: string; text: string };

export let THEME: Theme;
export let C: {
  bg0: string;
  bg1: string;
  ink: string;
  sub: string;
  muted: string;
  line: string;
  line2: string;
  /** カードの面（上と下） */
  glass: string;
  glass2: string;
  shadow: string;
  surface: string;
  surface2: string;
  accent: string;
  onAccent: string;
  /** 光（暗い地だけ。明るい地では付けない） */
  glow: string;
  /** 図の上に重ねる札の面 */
  overlay: string;
  /** 色の付かない矢印・線 */
  edge: string;
  /** 縦の補助線 */
  lane: string;
  /** 進み具合の溝と、済んだ所 */
  track: string;
  trackDone: string;
  /** タイトルの後ろを横切る薄い光 */
  sheen: string;
  /** ごく薄い面（始まりの状態・選ばれていない丸） */
  faint: string;
  /** 図の色（tone の main）の上に乗せる文字 */
  onTone: string;
  /** コード・端末の面と、その上の線・行番号・題の帯 */
  code: string;
  codeLine: string;
  codeMuted: string;
  codeBar: string;
};
export let TONES: Record<Tone, ToneSet>;
export let GRAD = '';
export let GRAD_SOFT = '';
/** 大きな数字や文字の塗り */
export let DISPLAY = '';
export let SANS = '';
export let MONO = '';
export let SYNTAX: Theme['syntax'];
export let MESH: string[] = [];

let fontsOf: Theme | null = null;

/** fonts=false は色だけ差し替える（読み込みの前の仮の値。書体は描くテーマの分だけ読む） */
export const applyTheme = (theme: Theme, fonts = true) => {
  if (fonts && fontsOf !== theme) {
    fontsOf = theme;
    SANS = [...theme.fonts.map(family), 'sans-serif'].join(', ');
    MONO = `${family('mono')}, ${SANS}`;
  }
  if (THEME === theme) return;
  THEME = theme;
  const c = theme.color;
  const dark = theme.scheme === 'dark';
  C = {
    bg0: c.bg,
    bg1: c.bg2,
    ink: c.ink,
    sub: c.sub,
    muted: c.muted,
    line: c.line,
    line2: c.line2,
    glass: dark ? 'rgba(255,255,255,0.07)' : c.surface,
    glass2: dark ? 'rgba(255,255,255,0.025)' : c.surface,
    shadow: theme.shadow,
    surface: c.surface,
    surface2: c.surface2,
    accent: c.accent,
    onAccent: c.onAccent,
    glow: dark ? `0 0 18px ${alpha(c.accent, 0.6)}` : 'none',
    overlay: dark ? 'rgba(12,16,40,0.92)' : c.surface,
    edge: dark ? 'rgba(210,216,240,0.75)' : alpha(c.sub, 0.6),
    lane: dark ? 'rgba(255,255,255,0.16)' : alpha(c.ink, 0.16),
    track: dark ? 'rgba(255,255,255,0.10)' : alpha(c.ink, 0.1),
    trackDone: alpha(c.accent, dark ? 0.55 : 0.6),
    sheen: dark ? 'rgba(255,255,255,0.10)' : alpha(c.ink, 0.07),
    faint: dark ? 'rgba(255,255,255,0.05)' : c.surface2,
    onTone: dark ? '#0B0F24' : '#FFFFFF',
    code: c.code,
    codeLine: 'rgba(255,255,255,0.10)',
    codeMuted: 'rgba(255,255,255,0.38)',
    codeBar: 'rgba(255,255,255,0.04)',
  };
  TONES = Object.fromEntries(
    (Object.entries(theme.tones) as [Tone, string][]).map(([k, main]) => [
      k,
      dark
        ? { main, soft: alpha(main, 0.15), deep: alpha(main, 0.32), text: mix(main, '#FFFFFF', 0.45) }
        : { main, soft: alpha(main, 0.1), deep: alpha(main, 0.2), text: mix(main, c.ink, 0.3) },
    ]),
  ) as Record<Tone, ToneSet>;
  GRAD = linear(theme.gradient);
  GRAD_SOFT = linear(theme.gradient.map((x) => alpha(x, 0.22)));
  DISPLAY = linear(theme.display);
  SYNTAX = theme.syntax;
  MESH = theme.mesh;
};

applyTheme(themeOf(), false);

export const tone = (t?: Tone) => TONES[t ?? 'violet'];
