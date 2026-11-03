// 場面「concepts」: 用語のカード
import React from 'react';
import type { ConceptsScene } from '../../engine/core/schema';
import { Content } from '../components/content';
import { Glass, IconBadge, Pill } from '../components/ui';
import { usePalette } from '../theme';
import { dropY, useAppear, useCurrentIndex } from '../timing';
import { defineScene } from './define';

const ConceptCardView: React.FC<{ card: ConceptsScene['cards'][number]; active: boolean }> = ({ card, active }) => {
  const { C, SANS, tone } = usePalette();
  const p = useAppear(card.at);
  const tt = tone(card.tone);
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        opacity: p,
        transform: `translateY(${dropY(p)}px) scale(${active ? 1.03 : 1})`,
      }}
    >
      <Glass
        t={card.tone}
        active={active ? 1 : 0}
        style={{ flex: 1, padding: '30px 30px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <IconBadge name={card.icon} t={card.tone} size={66} glow={active ? 0.9 : 0} />
          {card.idPrefix ? (
            <Pill t={card.tone} mono size={22}>
              {card.idPrefix}
            </Pill>
          ) : null}
        </div>
        <div
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: card.en.length > 12 ? 31 : 36,
            color: C.ink,
            lineHeight: 1.15,
            marginTop: 6,
          }}
        >
          {card.en}
        </div>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 25, color: tt.text }}>{card.ja}</div>
        <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 23, color: C.sub, lineHeight: 1.5 }}>
          {card.desc}
        </div>
      </Glass>
    </div>
  );
};

const Concepts: React.FC<{ s: ConceptsScene }> = ({ s }) => {
  const current = useCurrentIndex(s.cards);
  const cols = s.columns ?? 4;
  const rows: ConceptsScene['cards'][] = [];
  for (let i = 0; i < s.cards.length; i += cols) rows.push(s.cards.slice(i, i + cols));
  return (
    <Content style={{ gap: 28 }}>
      {rows.map((row, r) => (
        <div key={r} style={{ display: 'flex', gap: 28, alignItems: 'stretch', minHeight: 330 }}>
          {row.map((c, k) => {
            const idx = r * cols + k;
            return <ConceptCardView key={c.key} card={c} active={idx === current} />;
          })}
          {row.length < cols
            ? Array.from({ length: cols - row.length }, (_, k) => <div key={`p${k}`} style={{ flex: 1 }} />)
            : null}
        </div>
      ))}
    </Content>
  );
};

export const concepts = defineScene({ kind: 'concepts', Component: Concepts });
