// 場面「goals」: ゴールの一覧
import React from 'react';
import type { GoalsScene } from '../../content/types';
import { Content } from '../components/content';
import { Glass, Smart } from '../components/ui';
import { C, MONO, SANS, TONES } from '../theme';
import { dropY, useActiveLine, useAppear } from '../timing';
import { defineScene } from './define';

const GoalRow: React.FC<{ text: string; at: number; index: number; active: boolean }> = ({ text, at, index, active }) => {
  const p = useAppear(at);
  const draw = useAppear(at, 6, 24);
  return (
    <div style={{ opacity: p, transform: `translateY(${dropY(p)}px)` }}>
      <Glass t="mint" active={active ? 1 : 0} style={{ padding: '38px 48px', display: 'flex', alignItems: 'center', gap: 36 }}>
        <svg width={80} height={80} viewBox="0 0 72 72" style={{ flexShrink: 0 }}>
          <circle cx={36} cy={36} r={32} fill={TONES.mint.soft} stroke={TONES.mint.main} strokeWidth={3} opacity={0.9} />
          <path d="M22 37 L32 47 L51 26" fill="none" stroke={TONES.mint.main} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={50} strokeDashoffset={50 * (1 - draw)} />
        </svg>
        <div style={{ fontFamily: MONO, fontSize: 24, fontWeight: 700, color: C.muted, letterSpacing: 3, width: 96 }}>
          {String(index + 1).padStart(2, '0')}
        </div>
        <div style={{ fontFamily: SANS, fontSize: 50, fontWeight: 700, color: C.ink, lineHeight: 1.3 }}>
          <Smart text={text} t="mint" />
        </div>
      </Glass>
    </div>
  );
};

const Goals: React.FC<{ s: GoalsScene }> = ({ s }) => {
  const active = useActiveLine();
  const current = s.items.reduce((acc, it, i) => (it.at <= active ? i : acc), -1);
  const gap = s.items.length > 3 ? 20 : 30;
  return (
    <Content style={{ gap }}>
      {s.items.map((it, i) => (
        <GoalRow key={i} text={it.text} at={it.at} index={i} active={i === current} />
      ))}
    </Content>
  );
};

export const goals = defineScene({ kind: 'goals', Component: Goals });
