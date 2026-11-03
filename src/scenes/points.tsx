// 場面「points」: 要点のカード
import React from 'react';
import type { PointsScene } from '../../content/types';
import { Content } from '../components/content';
import { Glass, IconBadge, Smart } from '../components/ui';
import { usePalette } from '../theme';
import { dropY, useActiveLine, useAppear } from '../timing';
import { defineScene } from './define';

const PointCard: React.FC<{
  item: PointsScene['items'][number];
  index: number;
  numbered?: boolean;
  active: boolean;
  tall: boolean;
}> = ({ item, index, numbered, active, tall }) => {
  const { C, MONO, SANS, tone } = usePalette();
  const p = useAppear(item.at);
  const tt = tone(item.tone);
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        opacity: p,
        transform: `translateY(${dropY(p)}px) scale(${active ? 1.015 : 1})`,
      }}
    >
      <Glass
        t={item.tone}
        active={active ? 1 : 0}
        style={{
          flex: 1,
          padding: tall ? '44px 42px' : '32px 36px',
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {item.icon ? (
            <IconBadge name={item.icon} t={item.tone} size={tall ? 84 : 70} glow={active ? 0.8 : 0} />
          ) : (
            <div />
          )}
          {numbered ? (
            <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: tall ? 64 : 52, color: tt.main, opacity: 0.85 }}>
              {String(index + 1).padStart(2, '0')}
            </div>
          ) : null}
        </div>
        <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: tall ? 42 : 36, lineHeight: 1.3, color: C.ink }}>
          <Smart text={item.title} t={item.tone} />
        </div>
        {item.body ? (
          <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: tall ? 29 : 26, lineHeight: 1.55, color: C.sub }}>
            <Smart text={item.body} t={item.tone} />
          </div>
        ) : null}
      </Glass>
    </div>
  );
};

const Points: React.FC<{ s: PointsScene }> = ({ s }) => {
  const active = useActiveLine();
  const cols = s.columns ?? Math.min(3, s.items.length);
  const rows: PointsScene['items'][] = [];
  for (let i = 0; i < s.items.length; i += cols) rows.push(s.items.slice(i, i + cols));
  const current = s.items.reduce((acc, it, i) => (it.at <= active ? i : acc), -1);
  const tall = rows.length === 1;
  return (
    <Content style={{ gap: 32, justifyContent: 'center' }}>
      {rows.map((row, r) => (
        <div key={r} style={{ display: 'flex', gap: 32, alignItems: 'stretch', minHeight: tall ? 470 : 0 }}>
          {row.map((it, c) => {
            const idx = r * cols + c;
            return (
              <PointCard key={idx} item={it} index={idx} numbered={s.numbered} active={idx === current} tall={tall} />
            );
          })}
          {row.length < cols && rows.length > 1
            ? Array.from({ length: cols - row.length }, (_, k) => <div key={`pad${k}`} style={{ flex: 1 }} />)
            : null}
        </div>
      ))}
    </Content>
  );
};

export const points = defineScene({ kind: 'points', Component: Points });
