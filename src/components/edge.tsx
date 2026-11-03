// 箱から箱への矢印（流れの図と状態の図）
import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import type { Tone } from '../../content/types';
import { C, SANS, tone } from '../theme';
import { lineStart, useScene } from '../timing';
import { Smart } from './ui';

type Pt = [number, number];
type Side = 'l' | 'r' | 't' | 'b';
export type Box = { x: number; y: number; w: number; h: number };

const anchor = (b: Box, side: Side): Pt =>
  side === 'l' ? [b.x - b.w / 2, b.y] : side === 'r' ? [b.x + b.w / 2, b.y] : side === 't' ? [b.x, b.y - b.h / 2] : [b.x, b.y + b.h / 2];

const autoSides = (a: Box, b: Box): [Side, Side] => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) * 0.6 > Math.abs(dy)) return dx > 0 ? ['r', 'l'] : ['l', 'r'];
  return dy > 0 ? ['b', 't'] : ['t', 'b'];
};

const quad = (p0: Pt, c: Pt, p1: Pt, t: number): Pt => [
  (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0],
  (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1],
];

/** 箱から箱への矢印。at の台詞で線が伸び、光の粒が流れる */
export const Edge: React.FC<{
  a: Box;
  b: Box;
  at: number;
  label?: string;
  t?: Tone;
  dashed?: boolean;
  bend?: number;
  fromSide?: Side;
  toSide?: Side;
  labelDx?: number;
  labelDy?: number;
  dim: number;
  stagger?: number;
}> = ({ a, b, at, label, t, dashed, bend = 0, fromSide, toSide, labelDx = 0, labelDy = 0, dim, stagger = 0 }) => {
  const frame = useCurrentFrame();
  const { lines } = useScene();
  const start = lineStart(lines, at) - 2 + stagger;
  const draw = interpolate(frame - start, [0, 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const dot = interpolate(frame - start, [4, 26], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const dotO = interpolate(frame - start, [4, 8, 24, 30], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  if (draw <= 0) return null;
  const [fs, ts] = autoSides(a, b);
  const p0 = anchor(a, fromSide ?? fs);
  const p1 = anchor(b, toSide ?? ts);
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];
  const len = Math.hypot(dx, dy) || 1;
  const n: Pt = [-dy / len, dx / len];
  const mid: Pt = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
  const c: Pt = [mid[0] + n[0] * bend * 2, mid[1] + n[1] * bend * 2];
  const tt = tone(t ?? 'slate');
  const col = t ? tt.main : C.edge;
  // 矢じりの向き（終点の接線）
  const tail = quad(p0, c, p1, 0.94);
  const ang = Math.atan2(p1[1] - tail[1], p1[0] - tail[0]);
  const ah = 16;
  const head = [
    [p1[0], p1[1]],
    [p1[0] - ah * Math.cos(ang - 0.42), p1[1] - ah * Math.sin(ang - 0.42)],
    [p1[0] - ah * Math.cos(ang + 0.42), p1[1] - ah * Math.sin(ang + 0.42)],
  ];
  const dp = quad(p0, c, p1, dot);
  const lp = quad(p0, c, p1, 0.5);
  const d = `M ${p0[0]} ${p0[1]} Q ${c[0]} ${c[1]} ${p1[0]} ${p1[1]}`;
  return (
    <>
      <svg width={1920} height={1080} style={{ position: 'absolute', left: 0, top: 0, opacity: dim, overflow: 'visible' }}>
        <path
          d={d}
          fill="none"
          stroke={col}
          strokeWidth={4}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={dashed ? undefined : 1}
          strokeDashoffset={dashed ? undefined : 1 - draw}
          style={dashed ? { strokeDasharray: '10 10', opacity: draw } : undefined}
        />
        <polygon points={head.map((p) => p.join(',')).join(' ')} fill={col} opacity={draw >= 0.98 ? 1 : 0} />
        <circle cx={dp[0]} cy={dp[1]} r={9} fill={col} opacity={dotO} style={{ filter: `drop-shadow(0 0 10px ${col})` }} />
      </svg>
      {label ? (
        <div
          style={{
            position: 'absolute',
            left: lp[0] + labelDx,
            top: lp[1] + labelDy,
            transform: 'translate(-50%, -50%)',
            opacity: draw * dim,
          }}
        >
          <span
            style={{
              display: 'inline-block',
              padding: '7px 16px',
              borderRadius: 12,
              background: C.overlay,
              border: `1.5px solid ${t ? `${tt.main}88` : C.line2}`,
              fontFamily: SANS,
              fontWeight: 700,
              fontSize: 22,
              color: t ? tt.text : C.sub,
              whiteSpace: 'nowrap',
            }}
          >
            <Smart text={label} t={t} />
          </span>
        </div>
      ) : null}
    </>
  );
};
