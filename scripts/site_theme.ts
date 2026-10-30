// 講座のテーマ（content/themes.ts）から、講座サイトの書体の読み込みと色の決まり（CSS）を作る。
// 動画（src/theme.ts）と同じテーマの値から作るので、動画とサイトのトンマナがそろう。
import type { FontKey, Theme } from '../content/types';

const rgb = (hex: string) => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const alpha = (hex: string, a: number) => `rgba(${rgb(hex).join(',')},${a})`;
const mix = (a: string, b: string, t: number) => {
  const x = rgb(a);
  const y = rgb(b);
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
};

const FONT: Record<FontKey, { family: string; query: string }> = {
  'zen-maru': { family: '"Zen Maru Gothic"', query: 'Zen+Maru+Gothic:wght@500;700;900' },
  inter: { family: '"Inter"', query: 'Inter:wght@400;500;600;700;800' },
  noto: { family: '"Noto Sans JP"', query: 'Noto+Sans+JP:wght@400;500;700;900' },
};

export const fontLink = (t: Theme) =>
  `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${[...t.fonts.map((f) => FONT[f].query), 'JetBrains+Mono:wght@500;700']
    .map((q) => `family=${q}`)
    .join('&')}&display=swap">`;

const fontBody = (t: Theme) => [...t.fonts.map((f) => FONT[f].family), '"Hiragino Sans"', '"Hiragino Kaku Gothic ProN"', '"Yu Gothic"', 'system-ui', 'sans-serif'].join(', ');

/** 背景の飾り（動画の decor と同じ考え方） */
const decorCss = (t: Theme) => {
  const m = t.mesh;
  if (t.decor === 'band') {
    return `body { background: var(--ink); }
.decor { position: absolute; top: 0; right: 0; width: min(820px, 64vw); height: 340px; pointer-events: none; z-index: 0;
  clip-path: polygon(30% 0, 100% 0, 100% 100%);
  background: radial-gradient(420px 240px at 92% 6%, ${alpha(m[3] ?? m[0], 0.9)}, transparent 70%), linear-gradient(118deg, ${m[0]} 46%, ${m[1]} 66%, ${m[2] ?? m[1]} 88%); }
@media (max-width: 900px) { .decor { height: 150px; width: 64vw; } }`;
  }
  if (t.decor === 'chalk') {
    return `body { background:
  radial-gradient(${alpha(t.color.ink, 0.085)} 1.2px, transparent 1.2px) 0 0 / 28px 28px,
  radial-gradient(900px 560px at 2% -6%, ${alpha(m[0], 0.32)}, transparent 62%),
  radial-gradient(760px 520px at 104% 4%, ${alpha(m[1], 0.2)}, transparent 62%),
  radial-gradient(900px 640px at 100% 104%, ${alpha(m[2], 0.2)}, transparent 62%),
  var(--ink);
  background-attachment: fixed; }
.decor { display: none; }`;
  }
  return `body { background:
  radial-gradient(1100px 700px at 8% -10%, ${alpha(m[1], 0.22)}, transparent 60%),
  radial-gradient(900px 620px at 102% 8%, ${alpha(m[0], 0.14)}, transparent 62%),
  var(--ink);
  background-attachment: fixed; }
.decor { display: none; }`;
};

export const themeCss = (t: Theme) => {
  const c = t.color;
  const light = t.scheme === 'light';
  // 明るい地では、図の色を文字に使うと薄いので、見出しの色を少し混ぜて読める濃さにする
  const ink = (hex: string) => (light ? mix(hex, c.ink, 0.22) : hex);
  const vars: Record<string, string> = {
    '--ink': c.bg,
    '--panel': c.surface,
    '--raise': c.surface2,
    '--line': c.line,
    '--fg': c.ink,
    '--fg-2': c.sub,
    '--muted': c.muted,
    '--accent': c.accent,
    '--on-accent': c.onAccent,
    '--pink': ink(t.tones.pink),
    '--violet': ink(t.tones.violet),
    '--cyan': ink(t.tones.cyan),
    '--mint': ink(t.tones.mint),
    '--amber': ink(t.tones.amber),
    '--coral': ink(t.tones.coral),
    '--pink-soft': alpha(t.tones.pink, light ? 0.1 : 0.14),
    '--violet-soft': alpha(t.tones.violet, light ? 0.1 : 0.16),
    '--cyan-soft': alpha(t.tones.cyan, light ? 0.1 : 0.13),
    '--mint-soft': alpha(t.tones.mint, light ? 0.1 : 0.14),
    '--coral-soft': alpha(t.tones.coral, light ? 0.1 : 0.15),
    '--mark': alpha(c.accent, light ? 0.38 : 0.5),
    '--grad': `linear-gradient(100deg, ${t.gradient.join(', ')})`,
    '--shadow': t.shadow,
    '--stage': c.code,
    '--radius': `${Math.min(t.radius, 18)}px`,
    '--font-body': fontBody(t),
    '--font-mono': '"JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, monospace',
  };
  return `:root {
${Object.entries(vars)
  .map(([k, v]) => `  ${k}: ${v};`)
  .join('\n')}
  color-scheme: ${t.scheme};
}
${decorCss(t)}`;
};
