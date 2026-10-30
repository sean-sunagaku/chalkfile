import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { alpha, C, GRAD, H, MESH, MONO, PAD, SANS, THEME, W } from '../theme';
import { courseOf } from '../../content';
import { dropY, useScene } from '../timing';

/** ゆっくり漂う小さな粒（暗い地では光、明るい地ではチョークの粉） */
const Specks: React.FC<{ count: number; glow: boolean; base: number }> = ({ count, glow, base }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const seed = (i * 7919) % 997;
        const r = 2 + (seed % 3);
        const x = ((seed * 37) % W) + Math.sin(t * 0.25 + i) * 18;
        const y = 120 + ((seed * 53) % (H - 200)) + Math.cos(t * 0.2 + i * 1.7) * 14;
        const o = base + base * 1.2 * (0.5 + 0.5 * Math.sin(t * 0.8 + i * 2.1));
        const col = MESH[i % MESH.length];
        return (
          <div
            key={i}
            style={{ position: 'absolute', left: x, top: y, width: r * 2, height: r * 2, borderRadius: 99, background: col, opacity: o, boxShadow: glow ? `0 0 ${r * 6}px ${col}` : undefined }}
          />
        );
      })}
    </>
  );
};

/** 動かない背景（圧縮しやすいように大きな面は動かさない）。飾りはテーマの decor で変わる */
export const Background: React.FC = () => {
  const base = `linear-gradient(180deg, ${C.bg0}, ${C.bg1})`;
  if (THEME.decor === 'band') {
    // 斜めのグラデーションの帯と、細い縦の補助線（帳票のような静かな地）
    return (
      <AbsoluteFill style={{ background: base, overflow: 'hidden' }}>
        <AbsoluteFill
          style={{
            backgroundImage: `linear-gradient(90deg, ${alpha(C.ink, 0.045)} 1px, transparent 1px)`,
            backgroundSize: `${(W - PAD * 2) / 4}px 100%`,
            backgroundPosition: `${PAD}px 0`,
          }}
        />
        {/* 右上の角を斜めに切る帯（見出しの右端より右・講座名の札の後ろ） */}
        <AbsoluteFill
          style={{
            clipPath: 'polygon(1060px 0, 1920px 0, 1920px 330px)',
            background: [
              `radial-gradient(520px 300px at 92% 4%, ${alpha(MESH[3] ?? MESH[0], 0.9)}, transparent 70%)`,
              `linear-gradient(118deg, ${MESH[0]} 52%, ${MESH[1]} 68%, ${MESH[2] ?? MESH[1]} 86%)`,
            ].join(','),
          }}
        />
        {/* 左下にも細い斜めの帯を 1 本（画面の重心を下げる） */}
        <AbsoluteFill
          style={{
            clipPath: 'polygon(0 1006px, 640px 1080px, 0 1080px)',
            background: `linear-gradient(100deg, ${alpha(MESH[0], 0.55)}, ${alpha(MESH[3] ?? MESH[1], 0.55)})`,
          }}
        />
      </AbsoluteFill>
    );
  }
  if (THEME.decor === 'chalk') {
    // 方眼の点と、チョークの粉のにじみ
    return (
      <AbsoluteFill style={{ background: base }}>
        <AbsoluteFill
          style={{
            background: [
              `radial-gradient(900px 560px at 4% -8%, ${alpha(MESH[0], 0.3)}, transparent 62%)`,
              `radial-gradient(760px 520px at 104% 10%, ${alpha(MESH[1], 0.22)}, transparent 62%)`,
              `radial-gradient(1000px 640px at 98% 110%, ${alpha(MESH[2], 0.24)}, transparent 62%)`,
              `radial-gradient(760px 520px at -6% 106%, ${alpha(MESH[3], 0.2)}, transparent 62%)`,
            ].join(','),
          }}
        />
        <AbsoluteFill
          style={{
            backgroundImage: `radial-gradient(${alpha(C.ink, 0.11)} 1.3px, transparent 1.3px)`,
            backgroundSize: '40px 40px',
            maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.85), rgba(0,0,0,0.4))',
          }}
        />
        <Specks count={10} glow={false} base={0.16} />
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ background: C.bg0 }}>
      <AbsoluteFill
        style={{
          background: [
            `radial-gradient(1100px 700px at 8% -10%, ${alpha(MESH[1], 0.3)}, transparent 60%)`,
            `radial-gradient(900px 620px at 102% 8%, ${alpha(MESH[0], 0.2)}, transparent 62%)`,
            `radial-gradient(1100px 760px at 96% 112%, ${alpha(MESH[2], 0.18)}, transparent 60%)`,
            `radial-gradient(800px 600px at -6% 108%, ${alpha(MESH[3], 0.1)}, transparent 62%)`,
            base,
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
      <Specks count={14} glow base={0.18} />
    </AbsoluteFill>
  );
};

/** 右上の講座名（どの講座のレクチャーかで変わる）。帯の上に乗るテーマでは白い札にする */
export const CourseMark: React.FC<{ scale?: number }> = ({ scale = 1 }) => {
  const { lecture } = useScene();
  const chip = THEME.decor === 'band';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12 * scale,
        ...(chip ? { background: C.surface, borderRadius: 999, padding: `${8 * scale}px ${18 * scale}px`, boxShadow: C.shadow } : {}),
      }}
    >
      <div style={{ width: 16 * scale, height: 16 * scale, borderRadius: 6 * scale, background: GRAD, boxShadow: C.glow }} />
      <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 22 * scale, color: chip ? C.ink : C.sub, letterSpacing: 1 }}>{courseOf(lecture.id).title}</div>
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
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 7, background: C.track }}>
      <div style={{ height: '100%', width: `${p * 100}%`, background: GRAD, boxShadow: C.glow }} />
      {marks.map((m, i) => (
        <div key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(m / total) * 100}%`, width: 3, background: C.bg0, opacity: 0.8 }} />
      ))}
    </div>
  );
};
