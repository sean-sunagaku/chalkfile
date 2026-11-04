// 場面「states」: 状態の図
import type React from 'react';
import type { StatesScene } from '../../engine/core/schema';
import { type Box, Edge } from '../components/edge';
import { textWidth } from '../components/fit';
import { Pill } from '../components/ui';
import { alpha, usePalette } from '../theme';
import { dropY, useAppear, useFocus } from '../timing';
import { TYPE } from '../video.config';

/** 状態の札の幅の下限と、文字のほかの幅（左右の余白と枠） */
const MIN_W = 250;
const INNER = 64;

import { defineScene } from './define';

const States: React.FC<{ s: StatesScene }> = ({ s }) => {
  const { MONO, SANS } = usePalette();
  const f = useFocus(s.focus);
  // 札の幅は、名前（code）と読み（ja）の広いほうを測って決める
  const boxes = new Map(
    s.nodes.map((n) => {
      const start = n.variant === 'start';
      const code = textWidth(n.code, start ? TYPE.label.stateStart : TYPE.label.stateCode, {
        fontFamily: start ? SANS : MONO,
        fontWeight: start ? 900 : 700,
      });
      const ja = textWidth(n.ja, TYPE.label.stateReading, { fontFamily: SANS, fontWeight: 500 });
      return [n.key, { x: n.x, y: n.y, w: Math.max(MIN_W, Math.ceil(Math.max(code, ja)) + INNER), h: 104 } as Box];
    }),
  );
  const isFocus = (key: string) => (!f ? 0 : f.keys.includes(key) ? 1 : -1);
  return (
    <>
      {s.edges.map((e, i) => {
        const dim = !f ? 1 : f.keys.includes(e.to) || f.keys.includes(e.from) ? 1 : 0.35;
        // 矢印は行き先の状態の色にする（使える＝ミント、終わり＝コーラル）
        const target = s.nodes.find((n) => n.key === e.to);
        return <Edge key={i} a={boxes.get(e.from)!} b={boxes.get(e.to)!} {...e} t={target?.tone} dim={dim} />;
      })}
      {s.nodes.map((n) => (
        <StateNode key={n.key} n={n} box={boxes.get(n.key)!} focus={isFocus(n.key)} />
      ))}
    </>
  );
};

const StateNode: React.FC<{ n: StatesScene['nodes'][number]; box: Box; focus: number }> = ({ n, box, focus }) => {
  const { C, MONO, SANS, TONES } = usePalette();
  const p = useAppear(n.at);
  const tt = TONES[n.tone];
  const start = n.variant === 'start';
  return (
    <div
      style={{
        position: 'absolute',
        left: box.x - box.w / 2,
        top: box.y - box.h / 2,
        width: box.w,
        height: box.h,
        opacity: p * (focus < 0 ? 0.45 : 1),
        transform: `translateY(${dropY(p, 16)}px) scale(${focus > 0 ? 1.06 : 1})`,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          borderRadius: 999,
          background: start ? C.faint : `linear-gradient(160deg, ${tt.deep}, ${C.glass2})`,
          border: `2px ${start ? 'dashed' : 'solid'} ${focus > 0 ? tt.main : alpha(tt.main, 0x88 / 255)}`,
          boxShadow: focus > 0 ? `0 0 44px ${alpha(tt.main, 0x66 / 255)}` : C.shadow,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        <div
          style={{
            fontFamily: start ? SANS : MONO,
            fontWeight: start ? 900 : 700,
            fontSize: start ? TYPE.label.stateStart : TYPE.label.stateCode,
            color: C.ink,
          }}
        >
          {n.code}
        </div>
        <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: TYPE.label.stateReading, color: tt.text }}>
          {n.ja}
        </div>
      </div>
      {n.badge ? (
        <div style={{ position: 'absolute', right: -6, top: -18 }}>
          <Pill t={n.tone} size={TYPE.label.pillBadge}>
            {n.badge}
          </Pill>
        </div>
      ) : null}
    </div>
  );
};

export const states = defineScene({ kind: 'states', Component: States });
