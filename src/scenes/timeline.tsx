// 場面「timeline」: 時間の流れ
import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import type { TimelineScene } from '../../content/types';
import { Glass, Pill, Smart } from '../components/ui';
import { C, GRAD, MONO, PAD, SANS, tone, W } from '../theme';
import { dropY, useAppear, useFocus } from '../timing';
import { defineScene } from './define';

const TimeCard: React.FC<{ it: TimelineScene['items'][number]; x: number; w: number; focus: number }> = ({
  it,
  x,
  w,
  focus,
}) => {
  const p = useAppear(it.at);
  const tt = tone(it.tone);
  // 「SECTION 2　基本の考え方」のような題は、前半を小さなラベルにして、見出しを割らない
  const [kicker, title] = it.title.includes('　') ? it.title.split('　') : [null, it.title];
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: x - 22,
          top: 418,
          width: 44,
          height: 44,
          borderRadius: 99,
          background: focus > 0 ? tt.main : C.surface,
          border: `4px solid ${tt.main}`,
          boxShadow: focus > 0 ? `0 0 34px ${tt.main}` : undefined,
          opacity: p,
          transform: `scale(${0.6 + 0.4 * p})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: x - w / 2,
          top: 500,
          width: w,
          height: 400,
          opacity: p * (focus < 0 ? 0.5 : 1),
          transform: `translateY(${dropY(p, 20)}px) scale(${focus > 0 ? 1.03 : 1})`,
        }}
      >
        <Glass
          t={it.tone}
          active={focus > 0 ? 1 : 0}
          style={{
            height: '100%',
            boxSizing: 'border-box',
            padding: '32px 28px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {kicker ? (
              <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 22, color: tt.text, letterSpacing: 2 }}>
                {kicker}
              </div>
            ) : null}
            <Pill t={it.tone} size={21}>
              {it.sub}
            </Pill>
          </div>
          <div
            style={{ fontFamily: SANS, fontWeight: 900, fontSize: w < 330 ? 32 : 38, color: C.ink, lineHeight: 1.3 }}
          >
            <Smart text={title} t={it.tone} />
          </div>
          {it.detail ? (
            <div
              style={{ fontFamily: SANS, fontWeight: 500, fontSize: w < 330 ? 24 : 27, color: C.sub, lineHeight: 1.55 }}
            >
              <Smart text={it.detail} t={it.tone} />
            </div>
          ) : null}
        </Glass>
      </div>
    </>
  );
};

const Timeline: React.FC<{ s: TimelineScene }> = ({ s }) => {
  const frame = useCurrentFrame();
  const f = useFocus(s.focus);
  const n = s.items.length;
  const colW = (W - PAD * 2) / n;
  const xs = s.items.map((_, i) => PAD + (i + 0.5) * colW);
  const fi = f ? s.items.findIndex((it) => it.key === f.key) : -1;
  const target = fi >= 0 ? xs[fi] : xs[0];
  const fill = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: xs[0],
          width: xs[n - 1] - xs[0],
          top: 436,
          height: 8,
          borderRadius: 9,
          background: C.track,
          opacity: fill,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: xs[0],
          width: Math.max(0, target - xs[0]),
          top: 436,
          height: 8,
          borderRadius: 9,
          background: GRAD,
          boxShadow: C.glow,
        }}
      />
      {s.items.map((it, i) => (
        <TimeCard key={it.key} it={it} x={xs[i]} w={colW - 28} focus={!f ? 0 : i === fi ? 1 : -1} />
      ))}
    </>
  );
};

export const timeline = defineScene({ kind: 'timeline', Component: Timeline });
