// 色の計算（#RRGGBB の色に透明度を付ける・2 色を混ぜる）。React・Remotion・Node に依存しない。
// 動画のパレット（engine/core/theme.ts）・講座サイトの色（scripts/site_theme.ts）・コントラスト比（engine/core/contrast.ts）が、同じ式を使う。
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
  return `#${x
    .map((v, i) =>
      Math.round(v + (y[i] - v) * t)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
};
