// 場面「states」: 状態の図
import React from 'react';
import type { StatesScene } from '../../content/types';
import { Edge, type Box } from '../components/edge';
import { Pill } from '../components/ui';
import { C, MONO, SANS, TONES } from '../theme';
import { dropY, useAppear, useFocus } from '../timing';
import { defineScene } from './define';

const States: React.FC<{ s: StatesScene }> = ({ s }) => {
  const f = useFocus(s.focus);
  const boxes = new Map(
    s.nodes.map((n) => {
      const w = Math.max(250, Math.max(n.code.length * (n.key === 'start' ? 30 : 17.5), n.ja.length * 21) + 64);
      return [n.key, { x: n.x, y: n.y, w, h: 104 } as Box];
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
  const p = useAppear(n.at);
  const tt = TONES[n.tone];
  const start = n.key === 'start';
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
          border: `2px ${start ? 'dashed' : 'solid'} ${focus > 0 ? tt.main : `${tt.main}88`}`,
          boxShadow: focus > 0 ? `0 0 44px ${tt.main}66` : C.shadow,
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
            fontSize: start ? 30 : 29,
            color: C.ink,
          }}
        >
          {n.code}
        </div>
        <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 20, color: tt.text }}>{n.ja}</div>
      </div>
      {n.badge ? (
        <div style={{ position: 'absolute', right: -6, top: -18 }}>
          <Pill t={n.tone} size={19}>
            {n.badge}
          </Pill>
        </div>
      ) : null}
    </div>
  );
};

export const states = defineScene({ kind: 'states', Component: States });
