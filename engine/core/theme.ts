// テーマ（content/themes.ts）から、描くときの色の組（パレット）を作る純粋な関数。React・Remotion・Node に依存しない。
//   derivePalette(theme, lang)  部品が使う色（C・TONES・GRAD・DISPLAY・SYNTAX・MESH）と本文の書体の並び（fonts）。テーマと言語ごとに 1 回だけ作って覚える
// 動画は src/theme.ts の ThemeProvider が、これに読み込んだ書体の名前（SANS・MONO）を足して部品に渡す（部品は usePalette() で読む）。
// 講座サイト（scripts/site_theme.ts）も、図の文字色をここから取る（動画とサイトで作り方が違う。下の TONE_TEXT_MIX）。
// 名前は、部品が読んでいた前の src/theme.ts の変数と同じにしてある（C.ink・TONES.mint・tone('mint')・GRAD など）
import { alpha, BLACK, mix, WHITE } from './color';
import { fontsFor } from './fonts';
import type { Lang } from './i18n';
import type { DarkSurfaces, FontKey, Theme, Tone } from './schema';

/** 図の色 1 つから作る色の組。main は図の色そのもの、soft と deep は薄い面、text は文字に使う濃さ */
export type ToneSet = { main: string; soft: string; deep: string; text: string };

/** 部品が使う色（テーマの color と、そこから作る面・線・文字の色） */
export type PaletteColors = {
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
  /** コード・端末の面と、その下の端（黒に寄せた色）・その上の線・行番号・題の帯 */
  code: string;
  codeShade: string;
  codeLine: string;
  codeMuted: string;
  codeBar: string;
  /** コードの面の色（code）の上に乗せる文字。焼き込み字幕の文字と名前札 */
  onCode: string;
};

export type Palette = {
  THEME: Theme;
  C: PaletteColors;
  TONES: Record<Tone, ToneSet>;
  /** 見出しの下線・進み具合の線の塗り */
  GRAD: string;
  /** 大きな数字や文字の塗り */
  DISPLAY: string;
  SYNTAX: Theme['syntax'];
  MESH: string[];
  /** 本文の書体の並び（言語に合わせる。中国語は Noto Sans SC。engine/core/fonts.ts の fontsFor） */
  fonts: FontKey[];
  /** 図の色の組。省くと violet */
  tone: (t?: Tone) => ToneSet;
  /** 講座サイトが使う色（scripts/site_theme.ts）。図の文字色は、動画の TONES[t].text と作り方が違う */
  site: { toneText: Record<Tone, string> };
};

/**
 * 図の色（tone）を文字に使うときの作り方。動画と講座サイトで違う（今の見た目のまま残す。そろえるのは計画の T3A-14）
 *   動画（TONES[t].text）: 明るい地は見出しの色（ink）に 0.3 寄せ、暗い地は白に 0.45 寄せる
 *   講座サイト（site.toneText[t]。--pink など）: 明るい地は ink に 0.22 寄せ、暗い地は図の色のまま
 */
export const TONE_TEXT_MIX = { video: { light: 0.3, dark: 0.45 }, site: { light: 0.22 } } as const;

/** コードと端末の面（どのテーマでも濃い色）の上の線・行番号・題の帯。白を薄く重ねる */
const ON_CODE = {
  line: 'rgba(255,255,255,0.10)',
  muted: 'rgba(255,255,255,0.38)',
  bar: 'rgba(255,255,255,0.04)',
} as const;

const linear = (stops: string[], deg = 110) => `linear-gradient(${deg}deg, ${stops.join(', ')})`;

const toneSets = (theme: Theme): Record<Tone, ToneSet> => {
  const dark = theme.scheme === 'dark';
  const mixOf = TONE_TEXT_MIX.video;
  return Object.fromEntries(
    (Object.entries(theme.tones) as [Tone, string][]).map(([k, main]) => [
      k,
      dark
        ? { main, soft: alpha(main, 0.15), deep: alpha(main, 0.32), text: mix(main, WHITE, mixOf.dark) }
        : { main, soft: alpha(main, 0.1), deep: alpha(main, 0.2), text: mix(main, theme.color.ink, mixOf.light) },
    ]),
  ) as Record<Tone, ToneSet>;
};

/** 面と線。明るい地は color から作り、暗い地はテーマの dark に書いた値を使う（地の暗さと色みで合う値が違うため） */
const surfaces = (theme: Theme): DarkSurfaces => {
  const c = theme.color;
  if (theme.scheme !== 'dark') {
    return {
      glass: c.surface,
      glass2: c.surface,
      overlay: c.surface,
      edge: alpha(c.sub, 0.6),
      lane: alpha(c.ink, 0.16),
      track: alpha(c.ink, 0.1),
      sheen: alpha(c.ink, 0.07),
      faint: c.surface2,
      onTone: WHITE,
    };
  }
  if (!theme.dark)
    throw new Error(
      `暗い地のテーマ（${theme.id}）に dark（面と線の色）が無い。content/themes.ts の NIGHT を見本に書く`,
    );
  return theme.dark;
};

const build = (theme: Theme, lang: Lang): Palette => {
  const c = theme.color;
  const dark = theme.scheme === 'dark';
  const s = surfaces(theme);
  const TONES = toneSets(theme);
  return {
    THEME: theme,
    C: {
      bg0: c.bg,
      bg1: c.bg2,
      ink: c.ink,
      sub: c.sub,
      muted: c.muted,
      line: c.line,
      line2: c.line2,
      glass: s.glass,
      glass2: s.glass2,
      shadow: theme.shadow,
      surface: c.surface,
      surface2: c.surface2,
      accent: c.accent,
      onAccent: c.onAccent,
      glow: dark ? `0 0 18px ${alpha(c.accent, 0.6)}` : 'none',
      overlay: s.overlay,
      edge: s.edge,
      lane: s.lane,
      track: s.track,
      trackDone: alpha(c.accent, dark ? 0.55 : 0.6),
      sheen: s.sheen,
      faint: s.faint,
      onTone: s.onTone,
      code: c.code,
      codeShade: mix(c.code, BLACK, 0.18),
      codeLine: ON_CODE.line,
      codeMuted: ON_CODE.muted,
      codeBar: ON_CODE.bar,
      onCode: WHITE,
    },
    TONES,
    GRAD: linear(theme.gradient),
    DISPLAY: linear(theme.display),
    SYNTAX: theme.syntax,
    MESH: theme.mesh,
    fonts: fontsFor(theme, lang),
    tone: (t) => TONES[t ?? 'violet'],
    site: {
      toneText: Object.fromEntries(
        (Object.entries(theme.tones) as [Tone, string][]).map(([k, main]) => [
          k,
          dark ? main : mix(main, c.ink, TONE_TEXT_MIX.site.light),
        ]),
      ) as Record<Tone, string>,
    },
  };
};

const memo = new WeakMap<Theme, Map<Lang, Palette>>();

/** テーマと言語のパレット。同じテーマ（同じオブジェクト）と言語なら、前に作ったものを返す */
export const derivePalette = (theme: Theme, lang: Lang = 'ja'): Palette => {
  let byLang = memo.get(theme);
  if (!byLang) {
    byLang = new Map();
    memo.set(theme, byLang);
  }
  let p = byLang.get(lang);
  if (!p) {
    p = build(theme, lang);
    byLang.set(lang, p);
  }
  return p;
};
