// 場面「recap」: まとめ
import React from 'react';
import type { RecapScene } from '../../content/types';
import { Content } from '../components/content';
import { Glass, Smart } from '../components/ui';
import { alpha, usePalette } from '../theme';
import { dropY, useAppear, useCurrentIndex } from '../timing';
import { defineScene } from './define';

const RecapRow: React.FC<{ text: string; at: number; i: number; active: boolean }> = ({ text, at, i, active }) => {
  const { C, GRAD, MONO, SANS, THEME } = usePalette();
  const p = useAppear(at);
  return (
    <div style={{ opacity: p, transform: `translateY(${dropY(p)}px)` }}>
      <Glass
        active={active ? 1 : 0}
        t="violet"
        style={{ padding: '30px 40px', display: 'flex', alignItems: 'center', gap: 34 }}
      >
        <div
          style={{
            width: 76,
            height: 76,
            borderRadius: 999,
            background: GRAD,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: MONO,
            fontWeight: 700,
            fontSize: 34,
            color: C.onAccent,
            flexShrink: 0,
            boxShadow: active
              ? THEME.scheme === 'dark'
                ? `0 0 30px ${alpha(C.accent, 0.7)}`
                : `0 10px 22px -8px ${alpha(C.accent, 0.7)}`
              : undefined,
          }}
        >
          {i + 1}
        </div>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 44, color: C.ink, lineHeight: 1.35 }}>
          <Smart text={text} t="violet" />
        </div>
      </Glass>
    </div>
  );
};

const Recap: React.FC<{ s: RecapScene }> = ({ s }) => {
  const current = useCurrentIndex(s.items);
  return (
    <Content style={{ gap: s.items.length > 3 ? 22 : 32 }}>
      {s.items.map((it, i) => (
        <RecapRow key={i} text={it.text} at={it.at} i={i} active={i === current} />
      ))}
    </Content>
  );
};

export const recap = defineScene({ kind: 'recap', Component: Recap });
