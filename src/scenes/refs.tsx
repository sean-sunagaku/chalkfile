// 場面「refs」: 参考資料
import React from 'react';
import type { RefsScene } from '../../content/types';
import { Content } from '../components/content';
import { Glass, IconBadge } from '../components/ui';
import { C, MONO, SANS, TONES } from '../theme';
import { dropY, useAppear } from '../timing';
import { defineScene } from './define';

const RefCard: React.FC<{ r: RefsScene['refs'][number]; i: number }> = ({ r, i }) => {
  const p = useAppear(r.at, i * 8);
  return (
    <div style={{ flex: 1, display: 'flex', opacity: p, transform: `translateY(${dropY(p)}px)` }}>
      <Glass t="cyan" style={{ flex: 1, padding: '44px 46px', display: 'flex', flexDirection: 'column', gap: 22 }}>
        <IconBadge name={i === 0 ? 'file' : 'book'} t={i === 0 ? 'violet' : 'cyan'} size={84} />
        <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: 44, color: C.ink }}>{r.title}</div>
        <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: 25, color: TONES.cyan.text, lineHeight: 1.45, wordBreak: 'break-all' }}>{r.url}</div>
        <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 30, color: C.sub }}>{r.note}</div>
      </Glass>
    </div>
  );
};

const Refs: React.FC<{ s: RefsScene }> = ({ s }) => (
  <Content>
    <div style={{ display: 'flex', gap: 36, minHeight: 470 }}>
      {s.refs.map((r, i) => (
        <RefCard key={i} r={r} i={i} />
      ))}
    </div>
  </Content>
);

export const refs = defineScene({ kind: 'refs', Component: Refs });
