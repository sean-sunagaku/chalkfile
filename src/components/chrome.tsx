import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, GRAD, H, MONO, PAD, SANS, W } from '../theme';
import { courseOf } from '../../content';
import { dropY, useScene } from '../timing';

/** 動かない背景（圧縮しやすいように大きな面は動かさない）と、ゆっくり漂う小さな光 */
export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const sparks = Array.from({ length: 14 }, (_, i) => {
    const seed = (i * 7919) % 997;
    const x = (seed * 37) % W;
    const y = 120 + ((seed * 53) % (H - 200));
    const r = 2 + (seed % 3);
    const dx = Math.sin(t * 0.25 + i) * 18;
    const dy = Math.cos(t * 0.2 + i * 1.7) * 14;
    const o = 0.18 + 0.22 * (0.5 + 0.5 * Math.sin(t * 0.8 + i * 2.1));
    const col = ['#FF6FA3', '#9C8CFF', '#45D3F4', '#4CE2B2'][i % 4];
    return { x: x + dx, y: y + dy, r, o, col };
  });
  return (
    <AbsoluteFill style={{ background: C.bg0 }}>
      <AbsoluteFill
        style={{
          background: [
            'radial-gradient(1100px 700px at 8% -10%, rgba(156,140,255,0.30), transparent 60%)',
            'radial-gradient(900px 620px at 102% 8%, rgba(255,111,163,0.20), transparent 62%)',
            'radial-gradient(1100px 760px at 96% 112%, rgba(69,211,244,0.18), transparent 60%)',
            'radial-gradient(800px 600px at -6% 108%, rgba(76,226,178,0.10), transparent 62%)',
            `linear-gradient(180deg, ${C.bg0}, ${C.bg1})`,
          ].join(','),
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.075) 1.2px, transparent 1.2px)',
          backgroundSize: '44px 44px',
          maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.9), rgba(0,0,0,0.35))',
        }}
      />
      {sparks.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: s.x,
            top: s.y,
            width: s.r * 2,
            height: s.r * 2,
            borderRadius: 99,
            background: s.col,
            opacity: s.o,
            boxShadow: `0 0 ${s.r * 6}px ${s.col}`,
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

/** 右上の講座名（どの講座のレクチャーかで変わる） */
export const CourseMark: React.FC<{ scale?: number }> = ({ scale = 1 }) => {
  const { lecture } = useScene();
  return (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12 * scale }}>
    <div
      style={{
        width: 16 * scale,
        height: 16 * scale,
        borderRadius: 6 * scale,
        background: GRAD,
        boxShadow: '0 0 18px rgba(156,140,255,0.6)',
      }}
    />
    <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 22 * scale, color: C.sub, letterSpacing: 1 }}>
      {courseOf(lecture.id).title}
    </div>
  </div>
  );
};

/** 場面の見出し（ヘッダー） */
export const Header: React.FC<{ heading: string }> = ({ heading }) => {
  const frame = useCurrentFrame();
  const { lecture } = useScene();
  const p = interpolate(frame, [0, 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const bar = interpolate(frame, [6, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', left: PAD, right: PAD, top: 52, height: 150 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 21, letterSpacing: 5, color: C.muted }}>
          LECTURE {String(lecture.no).padStart(2, '0')}
          <span style={{ fontFamily: SANS, letterSpacing: 2, marginLeft: 18, color: C.sub, fontWeight: 500 }}>{lecture.title}</span>
        </div>
        <CourseMark />
      </div>
      <div
        style={{
          marginTop: 14,
          fontFamily: SANS,
          fontWeight: 900,
          fontSize: 60,
          lineHeight: 1.18,
          color: C.ink,
          letterSpacing: 1,
          opacity: p,
          transform: `translateY(${dropY(p, 18)}px)`,
          whiteSpace: 'nowrap',
        }}
      >
        {heading}
      </div>
      <div style={{ marginTop: 12, height: 5, width: 180 * bar, borderRadius: 9, background: GRAD }} />
    </div>
  );
};

/** レクチャー全体の進み具合（下端の細い線） */
export const Progress: React.FC<{ total: number; marks: number[] }> = ({ total, marks }) => {
  const frame = useCurrentFrame();
  const p = Math.min(1, frame / total);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 7, background: 'rgba(255,255,255,0.06)' }}>
      <div style={{ height: '100%', width: `${p * 100}%`, background: GRAD, boxShadow: '0 0 16px rgba(156,140,255,0.7)' }} />
      {marks.map((m, i) => (
        <div key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(m / total) * 100}%`, width: 3, background: C.bg0, opacity: 0.8 }} />
      ))}
    </div>
  );
};
