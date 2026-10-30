import {
  AppWindow,
  Apple,
  BellRing,
  BookOpen,
  CalendarDays,
  Check,
  Clock,
  Code as CodeIcon,
  CreditCard,
  Database,
  FileText,
  Flag,
  FlaskConical,
  Gift,
  Heart,
  JapaneseYen,
  KeyRound,
  Layers,
  LayoutDashboard,
  Link,
  ListChecks,
  Lock,
  Map as MapIcon,
  Package,
  Receipt,
  Repeat,
  Route,
  Scale,
  Search,
  Server,
  ShieldCheck,
  Smartphone,
  Tag,
  TriangleAlert,
  User,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import React from 'react';
import type { IconName, Tone } from '../../content/types';
import { alpha, C, GRAD, MONO, SANS, THEME, tone } from '../theme';

const ICONS: Record<IconName, LucideIcon> = {
  user: User,
  browser: AppWindow,
  server: Server,
  database: Database,
  card: CreditCard,
  stripe: CreditCard,
  bell: BellRing,
  receipt: Receipt,
  tag: Tag,
  box: Package,
  file: FileText,
  portal: LayoutDashboard,
  shield: ShieldCheck,
  clock: Clock,
  flask: FlaskConical,
  key: KeyRound,
  check: Check,
  x: X,
  repeat: Repeat,
  zap: Zap,
  lock: Lock,
  heart: Heart,
  phone: Smartphone,
  code: CodeIcon,
  book: BookOpen,
  scale: Scale,
  yen: JapaneseYen,
  flag: Flag,
  map: MapIcon,
  list: ListChecks,
  alert: TriangleAlert,
  link: Link,
  apple: Apple,
  gift: Gift,
  calendar: CalendarDays,
  route: Route,
  search: Search,
  layers: Layers,
};

export const Icon: React.FC<{ name: IconName; size?: number; color?: string; stroke?: number }> = ({ name, size = 36, color = C.ink, stroke = 2.2 }) => {
  const Cmp = ICONS[name];
  return <Cmp size={size} color={color} strokeWidth={stroke} />;
};

/** 色つきの丸いアイコン台 */
export const IconBadge: React.FC<{ name: IconName; t?: Tone; size?: number; glow?: number }> = ({ name, t, size = 64, glow = 0 }) => {
  const tt = tone(t);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        background: `linear-gradient(145deg, ${tt.deep}, ${tt.soft})`,
        border: `1.5px solid ${tt.main}55`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow:
          glow <= 0
            ? undefined
            : THEME.scheme === 'dark'
              ? `0 0 ${36 * glow}px ${tt.main}${Math.round(90 * glow).toString(16).padStart(2, '0')}`
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
  const tt = tone(t);
  const dark = THEME.scheme === 'dark';
  return (
    <div
      style={{
        position: 'relative',
        background: dark
          ? `linear-gradient(160deg, rgba(255,255,255,${0.07 + active * 0.03}), rgba(255,255,255,0.025))`
          : `linear-gradient(160deg, ${alpha(tt.main, 0.07 * active)}, ${alpha(tt.main, 0)} 70%), ${C.glass}`,
        border: `${dark ? 1.5 : 2}px solid ${active > 0 ? `${tt.main}${Math.round(60 + active * 120).toString(16).padStart(2, '0')}` : C.line}`,
        borderRadius: THEME.radius,
        boxShadow: `${C.shadow}${active > 0 && dark ? `, 0 0 ${48 * active}px ${tt.main}38` : ''}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const Pill: React.FC<{ children: React.ReactNode; t?: Tone; mono?: boolean; size?: number; style?: React.CSSProperties }> = ({ children, t, mono, size = 22, style }) => {
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
        border: `1.5px solid ${tt.main}66`,
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

/** **強調** の見た目。暗い地はグラデーションの文字、チョークのテーマは蛍光ペンの線、ほかは主役の色の文字 */
const emphasis = (t?: Tone): React.CSSProperties => {
  const tt = tone(t);
  if (THEME.scheme === 'dark') {
    return { background: t ? `linear-gradient(110deg, ${tt.main}, ${tt.text})` : GRAD, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' };
  }
  if (THEME.decor === 'chalk') {
    return { background: `linear-gradient(180deg, transparent 58%, ${alpha(t ? tt.main : C.accent, t ? 0.3 : 0.62)} 58%, ${alpha(t ? tt.main : C.accent, t ? 0.3 : 0.62)} 92%, transparent 92%)`, color: C.ink };
  }
  return { color: t ? tt.main : C.accent };
};

/** **強調** を色つきで出す */
export const Rich: React.FC<{ text: string; t?: Tone; style?: React.CSSProperties }> = ({ text, t, style }) => {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <span style={style}>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <span key={i} style={emphasis(t)}>
            {p}
          </span>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </span>
  );
};

/** 英字の識別子（snake_case など）は等幅で出す */
export const Code: React.FC<{ children: React.ReactNode; t?: Tone; size?: number }> = ({ children, t, size }) => (
  <span style={{ fontFamily: MONO, fontWeight: 500, color: t ? tone(t).text : C.ink, fontSize: size }}>{children}</span>
);

/** 文中の `…` と識別子らしい英字を等幅にする */
export const Smart: React.FC<{ text: string; t?: Tone }> = ({ text, t }) => {
  const parts = text.split(/([A-Za-z_][A-Za-z0-9_]*(?:[._/][A-Za-z0-9_{}…]+)+|[a-z]+_[a-z_]+|\{[A-Z_]+\})/g);
  return (
    <>
      {parts.map((p, i) => (i % 2 === 1 ? <Code key={i} t={t}>{p}</Code> : <React.Fragment key={i}>{p}</React.Fragment>))}
    </>
  );
};
