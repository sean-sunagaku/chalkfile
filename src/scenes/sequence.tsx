// 場面「sequence」: やりとりの図（登場人物の縦の線と、横の矢印）
import React from 'react';
import { useCurrentFrame } from 'remotion';
import type { SequenceScene } from '../../engine/core/schema';
import { ARROW_TIMING, arrowProgress, GlowDot } from '../components/arrow';
import { fitSize } from '../components/fit';
import { Glass, IconBadge, Smart } from '../components/ui';
import { alpha, H, PAD, usePalette, W } from '../theme';
import { dropY, lineStart, useAppear, useLatestAt, useScene } from '../timing';
import { LEAD, TYPE } from '../video.config';

/** 登場人物の札の中の左右の余白（枠を含む）・アイコン・アイコンと名前の間 */
const ACTOR_INNER = 22 * 2 + 4;
const ACTOR_ICON = 64;
const ACTOR_GAP = 18;
import { defineScene } from './define';

const Sequence: React.FC<{ s: SequenceScene }> = ({ s }) => {
  const { C, SANS, tone } = usePalette();
  const frame = useCurrentFrame();
  const { lines } = useScene();
  const latestAt = useLatestAt(s.steps);
  const n = s.actors.length;
  const colW = (W - PAD * 2) / n;
  const xOf = (key: string) => PAD + (s.actors.findIndex((a) => a.key === key) + 0.5) * colW;
  const top = 236;
  const firstY = 418;
  const lastY = 968;
  const gap = Math.min(92, (lastY - firstY) / Math.max(1, s.steps.length - 1));
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
        const { draw, dot, dotO } = arrowProgress(frame - start, ARROW_TIMING);
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
              <GlowDot x={xa + (xb - xa) * dot} y={y} r={10} blur={12} color={tt.main} opacity={dotO} />
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
                  background: isLatest ? alpha(tt.main, 0x26 / 255) : C.overlay,
                  border: `1.5px solid ${alpha(tt.main, (isLatest ? 0xcc : 0x55) / 255)}`,
                  fontFamily: SANS,
                  fontWeight: 700,
                  fontSize: TYPE.label.step,
                  color: isLatest ? C.ink : tt.text,
                  whiteSpace: 'nowrap',
                  boxShadow: isLatest ? `0 0 24px ${alpha(tt.main, 0x40 / 255)}` : undefined,
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
  const { C, MONO, SANS } = usePalette();
  const p = useAppear(0);
  // 名前と補足は 1 行。札の幅に入るまで縮める（札の下限まで）
  const room = w - ACTOR_INNER - ACTOR_ICON - ACTOR_GAP;
  const labelSize = fitSize(a.label, { role: 'label', max: TYPE.label.actorLabel, width: room, fontFamily: SANS, fontWeight: 900 });
  const subSize = a.sub
    ? fitSize(a.sub, { role: 'label', max: TYPE.label.actorSub, width: room, fontFamily: a.subMono ? MONO : SANS, fontWeight: 500 })
    : TYPE.label.actorSub;
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
          gap: ACTOR_GAP,
          padding: '0 22px',
          boxSizing: 'border-box',
        }}
      >
        <IconBadge name={a.icon} t={a.tone} size={ACTOR_ICON} />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: SANS,
              fontWeight: 900,
              fontSize: labelSize,
              color: C.ink,
              whiteSpace: 'nowrap',
            }}
          >
            {a.label}
          </div>
          {a.sub ? (
            <div
              style={{
                fontFamily: a.subMono ? MONO : SANS,
                fontWeight: 500,
                fontSize: subSize,
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
