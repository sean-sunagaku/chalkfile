// 場面「concepts」: 用語のカード
import React from 'react';
import type { ConceptsScene } from '../../engine/core/schema';
import { Content } from '../components/content';
import { fitSize } from '../components/fit';
import { Glass, IconBadge, Pill } from '../components/ui';
import { PAD, usePalette, W } from '../theme';
import { dropY, useAppear, useCurrentIndex } from '../timing';
import { TYPE } from '../video.config';

/** カードの間と、カードの中の左右の余白（枠を含む） */
const GAP = 28;
const INNER = 64;
import { defineScene } from './define';

const ConceptCardView: React.FC<{ card: ConceptsScene['cards'][number]; active: boolean; width: number }> = ({ card, active, width }) => {
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
            <Pill t={card.tone} mono size={TYPE.label.pill}>
              {card.idPrefix}
            </Pill>
          ) : null}
        </div>
        <div
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            // 英語の名前は 1 行に入るまで縮める（題の下限まで。それでも入らなければ折り返す）
            fontSize: fitSize(card.en, { role: 'title', max: TYPE.title.conceptTerm, width: width - INNER, fontFamily: SANS, fontWeight: 900 }),
            color: C.ink,
            lineHeight: 1.15,
            marginTop: 6,
          }}
        >
          {card.en}
        </div>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: TYPE.label.conceptReading, color: tt.text }}>{card.ja}</div>
        <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: TYPE.body.conceptDesc, color: C.sub, lineHeight: 1.5 }}>
          {card.desc}
        </div>
      </Glass>
    </div>
  );
};

const Concepts: React.FC<{ s: ConceptsScene }> = ({ s }) => {
  const current = useCurrentIndex(s.cards);
  const cols = s.columns ?? 4;
  const width = (W - PAD * 2 - GAP * (cols - 1)) / cols;
  const rows: ConceptsScene['cards'][] = [];
  for (let i = 0; i < s.cards.length; i += cols) rows.push(s.cards.slice(i, i + cols));
  return (
    <Content style={{ gap: GAP }}>
      {rows.map((row, r) => (
        <div key={r} style={{ display: 'flex', gap: GAP, alignItems: 'stretch', minHeight: 330 }}>
          {row.map((c, k) => {
            const idx = r * cols + k;
            return <ConceptCardView key={c.key} card={c} active={idx === current} width={width} />;
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
