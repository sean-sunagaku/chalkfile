// 場面「sequence」: やりとりの図（登場人物の縦の線と、横の矢印）
import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import type { SequenceScene } from '../../content/types';
import { Glass, IconBadge, Smart } from '../components/ui';
import { C, H, MONO, PAD, SANS, tone, W } from '../theme';
import { dropY, lineStart, useActiveLine, useAppear, useScene } from '../timing';
import { LEAD } from '../video.config';
import { defineScene } from './define';

const Sequence: React.FC<{ s: SequenceScene }> = ({ s }) => {
  const frame = useCurrentFrame();
  const { lines } = useScene();
  const active = useActiveLine();
  const n = s.actors.length;
  const colW = (W - PAD * 2) / n;
  const xOf = (key: string) => PAD + (s.actors.findIndex((a) => a.key === key) + 0.5) * colW;
  const top = 236;
  const firstY = 418;
  const lastY = 968;
  const gap = Math.min(92, (lastY - firstY) / Math.max(1, s.steps.length - 1));
  const latestAt = s.steps.reduce((m, st) => (st.at <= active ? Math.max(m, st.at) : m), -1);
  const seen = new Map<number, number>();
  return (
    <>
      {s.actors.map((a, i) => (
        <Actor key={a.key} a={a} x={PAD + (i + 0.5) * colW} w={Math.min(400, colW - 44)} top={top} />
      ))}
      <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0 }}>
        {s.actors.map((a, i) => (
          <line
            key={a.key}
            x1={PAD + (i + 0.5) * colW}
            x2={PAD + (i + 0.5) * colW}
            y1={top + 128}
            y2={1004}
            stroke={C.lane}
            strokeWidth={2}
            strokeDasharray="6 10"
          />
        ))}
      </svg>
      {s.steps.map((st, i) => {
        const k = seen.get(st.at) ?? 0;
        seen.set(st.at, k + 1);
        const y = firstY + i * gap;
        const start = lineStart(lines, st.at) - LEAD.draw + k * 14;
        const draw = interpolate(frame - start, [0, 16], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        if (draw <= 0) return null;
        const x1 = xOf(st.from);
        const x2 = xOf(st.to);
        const dir = Math.sign(x2 - x1) || 1;
        const xa = x1 + dir * 14;
        const xb = x2 - dir * 14;
        const tt = tone(st.tone ?? 'violet');
        const isLatest = st.at === latestAt;
        const dim = isLatest ? 1 : 0.62;
        const xNow = xa + (xb - xa) * draw;
        const dot = interpolate(frame - start, [4, 24], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const dotO = interpolate(frame - start, [4, 8, 22, 28], [0, 1, 1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        return (
          <React.Fragment key={i}>
            <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, opacity: dim }}>
              <line
                x1={xa}
                y1={y}
                x2={xNow}
                y2={y}
                stroke={tt.main}
                strokeWidth={isLatest ? 5 : 4}
                strokeLinecap="round"
                strokeDasharray={st.dashed ? '12 10' : undefined}
              />
              {draw > 0.97 ? (
                <polygon points={`${xb},${y} ${xb - dir * 18},${y - 10} ${xb - dir * 18},${y + 10}`} fill={tt.main} />
              ) : null}
              <circle
                cx={xa + (xb - xa) * dot}
                cy={y}
                r={10}
                fill={tt.main}
                opacity={dotO}
                style={{ filter: `drop-shadow(0 0 12px ${tt.main})` }}
              />
            </svg>
            <div
              style={{
                position: 'absolute',
                left: (x1 + x2) / 2,
                top: y - 30,
                transform: 'translate(-50%, -50%)',
                opacity: draw * dim,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  padding: '6px 18px',
                  borderRadius: 12,
                  background: isLatest ? `${tt.main}26` : C.overlay,
                  border: `1.5px solid ${tt.main}${isLatest ? 'cc' : '55'}`,
                  fontFamily: SANS,
                  fontWeight: 700,
                  fontSize: 25,
                  color: isLatest ? C.ink : tt.text,
                  whiteSpace: 'nowrap',
                  boxShadow: isLatest ? `0 0 24px ${tt.main}40` : undefined,
                }}
              >
                <Smart text={st.label} t={st.tone} />
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </>
  );
};

const Actor: React.FC<{ a: SequenceScene['actors'][number]; x: number; w: number; top: number }> = ({
  a,
  x,
  w,
  top,
}) => {
  const p = useAppear(0);
  return (
    <div
      style={{
        position: 'absolute',
        left: x - w / 2,
        top,
        width: w,
        height: 120,
        opacity: p,
        transform: `translateY(${dropY(p)}px)`,
      }}
    >
      <Glass
        t={a.tone}
        active={0.4}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          padding: '0 22px',
          boxSizing: 'border-box',
        }}
      >
        <IconBadge name={a.icon} t={a.tone} size={64} />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: SANS,
              fontWeight: 900,
              fontSize: a.label.length > 9 ? 27 : 32,
              color: C.ink,
              whiteSpace: 'nowrap',
            }}
          >
            {a.label}
          </div>
          {a.sub ? (
            <div
              style={{
                fontFamily: a.sub.includes('/') ? MONO : SANS,
                fontWeight: 500,
                fontSize: 20,
                color: C.sub,
                whiteSpace: 'nowrap',
              }}
            >
              {a.sub}
            </div>
          ) : null}
        </div>
      </Glass>
    </div>
  );
};

export const sequence = defineScene({ kind: 'sequence', Component: Sequence });
