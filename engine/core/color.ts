// 色の計算（#RRGGBB の色に透明度を付ける・2 色を混ぜる）。React・Remotion・Node に依存しない。
// 動画のパレット（engine/core/theme.ts）・講座サイトの色（scripts/site_theme.ts）・コントラスト比（engine/core/contrast.ts）が、同じ式を使う。
// コントラスト比の式（luminance・contrastRatio）もここに置く（パレットが、読める濃さの色を作るのに使う）。
// テーマの色は #RRGGBB で書く（台本の検証の validateTheme が形を確かめる）。形の違う色を渡すと、黙って壊れた色を返さずに止める

/** テーマの色の形（#RRGGBB） */
export const HEX = /^#[0-9A-Fa-f]{6}$/;

export const isHex = (v: unknown): v is string => typeof v === 'string' && HEX.test(v);

/** 白と黒。暗い地に重ねる薄い白・コードの面を沈める黒・飾りのマスクの濃さに使う */
export const WHITE = '#FFFFFF';
export const BLACK = '#000000';

/** #RRGGBB を、赤・緑・青の 0〜255 に分ける */
export const rgb = (hex: string): [number, number, number] => {
  if (!isHex(hex)) throw new Error(`#RRGGBB でない色: ${String(hex)}（テーマの色は #RRGGBB で書く）`);
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
};

/** #RRGGBB に透明度を付ける（rgba(r,g,b,a)） */
export const alpha = (hex: string, a: number): string => {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};

/** 2 色を混ぜる（t=0 で a、t=1 で b）。小文字の #rrggbb を返す */
export const mix = (a: string, b: string, t: number): string => {
  const x = rgb(a);
  const y = rgb(b);
  // x と y はともに RGB の 3 要素。map の添字は y の範囲内。
  return `#${x
    .map((v, i) =>
      Math.round(v + (y[i]! - v) * t)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
};

/** 相対輝度（0〜1。WCAG 2.x の式）。sRGB の値を直線の明るさに戻して、目の感じ方の重みで足す */
export const luminance = (hex: string): number => {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number]; // map は RGB の要素数を保つ
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** 文字と地のコントラスト比（1〜21）。どちらが文字でも同じ */
export const contrastRatio = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

/**
 * 色を toward に 0.05 ずつ寄せて、どの地に対してもコントラスト比が min に届いた色（from から寄せ始める。届かなければ toward）。
 * 動画のパレットが、補足の文字・図の色の文字を、テーマの色から読める濃さにするのに使う
 */
export const reachContrast = (
  fg: string,
  toward: string,
  grounds: readonly string[],
  min: number,
  from = 0,
): string => {
  for (let i = Math.round(from * 20); i <= 20; i++) {
    // 寄せない（0）ときは、もとの色をそのまま返す（書き方も変えない）
    const c = i === 0 ? fg : mix(fg, toward, i / 20);
    if (grounds.every((g) => contrastRatio(c, g) >= min)) return c;
  }
  return mix(fg, toward, 1);
};
