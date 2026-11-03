// テーマ（content/themes.ts）から、描くときの色の組（パレット）を作る純粋な関数。React・Remotion・Node に依存しない。
//   derivePalette(theme, lang)  部品が使う色（C・TONES・GRAD・DISPLAY・SYNTAX・MESH）と本文の書体の並び（fonts）。テーマと言語ごとに 1 回だけ作って覚える
// 動画は src/theme.ts の ThemeProvider が、これに読み込んだ書体の名前（SANS・MONO）を足して部品に渡す（部品は usePalette() で読む）。
// 講座サイト（scripts/site_theme.ts）も、図の文字色をここから取る（動画とサイトで作り方が違う。下の TONE_TEXT_MIX）。
// 名前は、部品が読んでいた前の src/theme.ts の変数と同じにしてある（C.ink・TONES.mint・tone('mint')・GRAD など）。
// 文字に使う色（補足の muted・図の色の文字 text と strong・図の色の上の文字 on・コードの面の上の補足 codeMuted・グラデーションの上の文字 onGrad）は、
// 地と面に対して下限（CONTRAST_MIN。本文 4.5・大きい文字 3.0）に届くまで濃くする（届いている色は、テーマの色のまま）。組と下限は engine/core/contrast.ts
import { alpha, BLACK, contrastRatio, mix, reachContrast, WHITE } from './color';
import { fontsFor } from './fonts';
import type { Lang } from './i18n';
import type { DarkSurfaces, FontKey, Theme, Tone } from './schema';

/**
 * 図の色 1 つから作る色の組。main は図の色そのもの（形・アイコン・線・面）、soft と deep は薄い面、
 * text は文字（本文の大きさでも読める濃さ）、strong は大きな文字（太字の大きな数・強調。main が読めなければ濃くする）、
 * on は main の面の上に乗せる文字（札・丸の中の数・字幕の名前札）
 */
export type ToneSet = { main: string; soft: string; deep: string; text: string; strong: string; on: string };

/** 文字と地のコントラスト比の下限。本文（地とカードの文字・補足・出典・コード）は 4.5、大きい文字（太字の大きな数・強調・札の上の文字・見出しの塗り）は 3.0 */
export const CONTRAST_MIN = { body: 4.5, large: 3.0 } as const;

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
  /** コードの面の色（code）の上に乗せる文字。焼き込み字幕の文字 */
  onCode: string;
  /** 見出しの下線と同じグラデーション（GRAD）の面の上に乗せる文字（まとめの番号） */
  onGrad: string;
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
 * 図の色（tone）を文字に使うときの作り方。動画と講座サイトで違う
 *   動画（TONES[t].text）: 明るい地は見出しの色（ink）に 0.3 から寄せ始め、地と面（surface・bg2・薄い面 soft）に対して
 *     本文の下限（4.5）に届くまで 0.05 ずつ寄せる。暗い地は白に 0.45 寄せる
 *   講座サイト（site.toneText[t]。--pink など）: 明るい地は ink に 0.22 寄せ、暗い地は図の色のまま（講座サイトの見た目は変えていない）
 */
export const TONE_TEXT_MIX = { video: { light: 0.3, dark: 0.45 }, site: { light: 0.22 } } as const;

/** コードと端末の面（どのテーマでも濃い色）の上の線・題の帯。白を薄く重ねる。行番号と窓の題（codeMuted）は、面に対して本文の下限に届く濃さにする */
const ON_CODE = {
  line: 'rgba(255,255,255,0.10)',
  bar: 'rgba(255,255,255,0.04)',
  /** 行番号と窓の題の白の濃さの、いちばん薄い値 */
  mutedAlpha: 0.38,
} as const;

/** 薄い面（soft）の濃さ（明るい地・暗い地） */
const SOFT = { light: 0.1, dark: 0.15 } as const;

/** 白を a の濃さで重ねた色が、面 under の上で本文の下限に届く、いちばん薄い濃さ（0.02 ずつ上げる） */
const whiteOn = (under: readonly string[], from: number): number => {
  for (let a = from; a < 1; a = Math.round((a + 0.02) * 100) / 100) {
    if (under.every((u) => contrastRatio(mix(u, WHITE, a), u) >= CONTRAST_MIN.body)) return a;
  }
  return 1;
};

/** グラデーションの、文字が乗る真ん中あたり（0.3・0.5・0.7 の所の色） */
export const gradientMiddle = (stops: readonly string[]): string[] =>
  [0.3, 0.5, 0.7].map((t) => {
    const x = t * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(x));
    return mix(stops[i], stops[i + 1], x - i);
  });

const linear = (stops: string[], deg = 110) => `linear-gradient(${deg}deg, ${stops.join(', ')})`;

const toneSets = (theme: Theme): Record<Tone, ToneSet> => {
  const c = theme.color;
  const dark = theme.scheme === 'dark';
  const mixOf = TONE_TEXT_MIX.video;
  return Object.fromEntries(
    (Object.entries(theme.tones) as [Tone, string][]).map(([k, main]) => {
      // 文字が乗る地: カードの面・地の濃いほう・それぞれに薄い面（soft）を重ねたもの
      const soft = dark ? SOFT.dark : SOFT.light;
      const grounds = [c.surface, c.bg2, mix(c.surface, main, soft), mix(c.bg2, main, soft)];
      // 暗い地は白に寄せて明るく、明るい地は見出しの色（ink）に寄せて濃くする
      const toward = dark ? WHITE : c.ink;
      const text = reachContrast(main, toward, grounds, CONTRAST_MIN.body, dark ? mixOf.dark : mixOf.light);
      const strong = reachContrast(main, toward, [c.surface, c.bg2], CONTRAST_MIN.large);
      // 図の色の面の上の文字: 暗い地はテーマの dark.onTone、明るい地は白。白で読めない色（明るい黄色など）は見出しの色
      const light = theme.dark?.onTone ?? WHITE;
      const on = contrastRatio(light, main) >= CONTRAST_MIN.large ? light : c.ink;
      return [k, { main, soft: alpha(main, soft), deep: alpha(main, dark ? 0.32 : 0.2), text, strong, on }];
    }),
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
  const codeShade = mix(c.code, BLACK, 0.18);
  // 補足の文字（レクチャーの番号・出典・注意書き・クレジットなど）は、地と面に対して本文の下限に届くまで、見出しの色に寄せる
  const muted = reachContrast(c.muted, c.ink, [c.bg, c.bg2, c.surface], CONTRAST_MIN.body);
  const codeMutedAlpha = whiteOn([c.code, codeShade], ON_CODE.mutedAlpha);
  // まとめの番号は、グラデーションの真ん中に乗る。onAccent で読めなければ、見出しの色と白の読めるほう
  const middle = gradientMiddle(theme.gradient);
  const readable = (fg: string) => Math.min(...middle.map((g) => contrastRatio(fg, g)));
  const onGrad = readable(c.onAccent) >= CONTRAST_MIN.large ? c.onAccent : readable(c.ink) >= readable(WHITE) ? c.ink : WHITE;
  return {
    THEME: theme,
    C: {
      bg0: c.bg,
      bg1: c.bg2,
      ink: c.ink,
      sub: c.sub,
      muted,
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
      codeShade,
      codeLine: ON_CODE.line,
      codeMuted: alpha(WHITE, codeMutedAlpha),
      codeBar: ON_CODE.bar,
      onCode: WHITE,
      onGrad,
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
