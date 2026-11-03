// 講座のテーマ（content/themes.ts）から、講座サイトの書体の読み込みと色の決まり（CSS）を作る。
// 動画と同じパレット（engine/core/theme.ts の derivePalette）と色の計算（engine/core/color.ts）から作るので、動画とサイトのトンマナがそろう。
// 図の文字色（--pink など）は、パレットの site.toneText（動画の文字色と、混ぜる割合が違う。そろえるのは、動画とサイトの見た目をまとめて更新する回）
import type { Lang } from '../content/i18n';
import type { FontKey, Theme } from '../content/types';
import { alpha } from '../engine/core/color';
import { derivePalette } from '../engine/core/theme';

const FONT: Record<FontKey, { family: string; query: string }> = {
  'zen-maru': { family: '"Zen Maru Gothic"', query: 'Zen+Maru+Gothic:wght@500;700;900' },
  inter: { family: '"Inter"', query: 'Inter:wght@400;500;600;700;800' },
  noto: { family: '"Noto Sans JP"', query: 'Noto+Sans+JP:wght@400;500;700;900' },
  'noto-sc': { family: '"Noto Sans SC"', query: 'Noto+Sans+SC:wght@400;500;700;900' },
};

export const fontLink = (t: Theme, lang: Lang = 'ja') =>
  `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${[...derivePalette(t, lang).fonts.map((f) => FONT[f].query), 'JetBrains+Mono:wght@500;700']
    .map((q) => `family=${q}`)
    .join('&')}&display=swap">`;

/** 書体が読めないときの、端末の書体（中国語は簡体字の書体、ほかは日本語の書体） */
const SYSTEM: Record<Lang, string[]> = {
  ja: ['"Hiragino Sans"', '"Hiragino Kaku Gothic ProN"', '"Yu Gothic"'],
  en: ['"Hiragino Sans"', '"Hiragino Kaku Gothic ProN"', '"Yu Gothic"'],
  zh: ['"PingFang SC"', '"Hiragino Sans GB"', '"Microsoft YaHei"'],
};
const fontBody = (t: Theme, lang: Lang) => [...derivePalette(t, lang).fonts.map((f) => FONT[f].family), ...SYSTEM[lang], 'system-ui', 'sans-serif'].join(', ');

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

export const themeCss = (t: Theme, lang: Lang = 'ja') => {
  const c = t.color;
  const light = t.scheme === 'light';
  // 図の色を文字に使うときの色（明るい地では、図の色だと薄いので、見出しの色を少し混ぜて読める濃さにする）
  const ink = derivePalette(t, lang).site.toneText;
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
    '--pink': ink.pink,
    '--violet': ink.violet,
    '--cyan': ink.cyan,
    '--mint': ink.mint,
    '--amber': ink.amber,
    '--coral': ink.coral,
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
    '--font-body': fontBody(t, lang),
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
