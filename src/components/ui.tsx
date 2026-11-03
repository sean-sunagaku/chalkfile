import React from 'react';
import type { IconName, Tone } from '../../engine/core/schema';
import { alpha, usePalette, WHITE, type VideoPalette } from '../theme';
import { ICONS } from './icons';

/** アイコン。色を省くと見出しの文字の色（C.ink） */
export const Icon: React.FC<{ name: IconName; size?: number; color?: string; stroke?: number }> = ({ name, size = 36, color, stroke = 2.2 }) => {
  const { C } = usePalette();
  const Cmp = ICONS[name];
  return <Cmp size={size} color={color ?? C.ink} strokeWidth={stroke} />;
};

/** 色つきの丸いアイコン台 */
export const IconBadge: React.FC<{ name: IconName; t?: Tone; size?: number; glow?: number }> = ({ name, t, size = 64, glow = 0 }) => {
  const { THEME, tone } = usePalette();
  const tt = tone(t);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        background: `linear-gradient(145deg, ${tt.deep}, ${tt.soft})`,
        border: `1.5px solid ${alpha(tt.main, 0x55 / 255)}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow:
          glow <= 0
            ? undefined
            : THEME.scheme === 'dark'
              ? `0 0 ${36 * glow}px ${alpha(tt.main, Math.round(90 * glow) / 255)}`
              : `0 ${10 * glow}px ${24 * glow}px -${8 * glow}px ${alpha(tt.main, 0.55)}`,
      }}
    >
      <Icon name={name} size={size * 0.5} color={tt.main} />
    </div>
  );
};

export const Glass: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
  t?: Tone;
  active?: number;
}> = ({ children, style, t, active = 0 }) => {
  const { C, THEME, tone } = usePalette();
  const tt = tone(t);
  const dark = THEME.scheme === 'dark';
  return (
    <div
      style={{
        position: 'relative',
        // 暗い地は、地に白を薄く重ねた面（上は白の 0.07 に active で 0.03 まで足す。下はテーマの dark.glass2）
        background: dark
          ? `linear-gradient(160deg, ${alpha(WHITE, 0.07 + active * 0.03)}, ${C.glass2})`
          : `linear-gradient(160deg, ${alpha(tt.main, 0.07 * active)}, ${alpha(tt.main, 0)} 70%), ${C.glass}`,
        border: `${dark ? 1.5 : 2}px solid ${active > 0 ? alpha(tt.main, Math.round(60 + active * 120) / 255) : C.line}`,
        borderRadius: THEME.radius,
        boxShadow: `${C.shadow}${active > 0 && dark ? `, 0 0 ${48 * active}px ${alpha(tt.main, 0x38 / 255)}` : ''}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const Pill: React.FC<{ children: React.ReactNode; t?: Tone; mono?: boolean; size?: number; style?: React.CSSProperties }> = ({ children, t, mono, size = 22, style }) => {
  const { MONO, SANS, tone } = usePalette();
  const tt = tone(t);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: `${size * 0.28}px ${size * 0.7}px`,
        borderRadius: 999,
        background: tt.soft,
        border: `1.5px solid ${alpha(tt.main, 0x66 / 255)}`,
        color: tt.text,
        fontFamily: mono ? MONO : SANS,
        fontWeight: 700,
        fontSize: size,
        lineHeight: 1.1,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </span>
  );
};

/**
 * グラデーションの文字（塗りを文字の形に切り抜く）。オープニングの番号と題・エンディング・クイズの番号・暗い地の **強調** が使う。
 * 塗り（background）を先に、切り抜き（backgroundClip）を後に置く（逆にすると、background の一括指定が切り抜きを消す）
 */
export const gradientText = (fill: string): React.CSSProperties => ({
  background: fill,
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
});

/** **強調** の見た目。暗い地はグラデーションの文字、チョークのテーマは蛍光ペンの線、ほかは主役の色の文字 */
const emphasis = ({ C, GRAD, THEME, tone }: VideoPalette, t?: Tone): React.CSSProperties => {
  const tt = tone(t);
  if (THEME.scheme === 'dark') {
    return gradientText(t ? `linear-gradient(110deg, ${tt.main}, ${tt.text})` : GRAD);
  }
  if (THEME.decor === 'chalk') {
    return { background: `linear-gradient(180deg, transparent 58%, ${alpha(t ? tt.main : C.accent, t ? 0.3 : 0.62)} 58%, ${alpha(t ? tt.main : C.accent, t ? 0.3 : 0.62)} 92%, transparent 92%)`, color: C.ink };
  }
  return { color: t ? tt.main : C.accent };
};

/** **強調** を色つきで出す */
export const Rich: React.FC<{ text: string; t?: Tone; style?: React.CSSProperties }> = ({ text, t, style }) => {
  const palette = usePalette();
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <span style={style}>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <span key={i} style={emphasis(palette, t)}>
            {p}
          </span>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </span>
  );
};

/** 横に出す注のカード（コードの光る行の注・端末の注）。文字の大きさ・行の高さ・カードの余白は、場面ごとに渡す */
export const NoteCard: React.FC<{ text: string; t?: Tone; active: number; size: number; lineHeight: number; style?: React.CSSProperties }> = ({
  text,
  t,
  active,
  size,
  lineHeight,
  style,
}) => {
  const { C, SANS } = usePalette();
  return (
    <Glass t={t} active={active} style={style}>
      <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: size, color: C.ink, lineHeight }}>
        <Smart text={text} t={t} />
      </div>
    </Glass>
  );
};

/** 英字の識別子（snake_case など）は等幅で出す */
export const Code: React.FC<{ children: React.ReactNode; t?: Tone; size?: number }> = ({ children, t, size }) => {
  const { C, MONO, tone } = usePalette();
  return <span style={{ fontFamily: MONO, fontWeight: 500, color: t ? tone(t).text : C.ink, fontSize: size }}>{children}</span>;
};

/** 文中の `…` と識別子らしい英字を等幅にする */
export const Smart: React.FC<{ text: string; t?: Tone }> = ({ text, t }) => {
  const parts = text.split(/([A-Za-z_][A-Za-z0-9_]*(?:[._/][A-Za-z0-9_{}…]+)+|[a-z]+_[a-z_]+|\{[A-Z_]+\})/g);
  return (
    <>
      {parts.map((p, i) => (i % 2 === 1 ? <Code key={i} t={t}>{p}</Code> : <React.Fragment key={i}>{p}</React.Fragment>))}
    </>
  );
};
