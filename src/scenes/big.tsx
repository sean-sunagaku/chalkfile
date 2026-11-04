// 場面「big」: 大きな一文
import type React from 'react';
import { useCurrentFrame } from 'remotion';
import type { BigScene } from '../../engine/core/schema';
import { Content } from '../components/content';
import { textWidth } from '../components/fit';
import { IconBadge, Rich, Smart } from '../components/ui';
import { usePalette } from '../theme';
import { dropY, useAppear } from '../timing';
import { TYPE } from '../video.config';
import { defineScene } from './define';

/** 大きい文字で並べた幅がこれを超える文は、ひと回り小さくする（px。内容の幅 1640 の 2 行の手前） */
const LONG_STATEMENT = 3000;

const Big: React.FC<{ s: BigScene }> = ({ s }) => {
  const { C, SANS, tone } = usePalette();
  const k = useAppear(0);
  const t = useAppear(s.textAt ?? 0, 2, 24);
  const sub = useAppear(s.subAt ?? s.textAt ?? 0, 8);
  const frame = useCurrentFrame();
  const pulse = 1 + 0.012 * Math.sin(frame / 14);
  const tt = tone(s.tone);
  return (
    <Content style={{ alignItems: 'center', textAlign: 'center', gap: 34 }}>
      {s.icon ? (
        <div style={{ opacity: k, transform: `translateY(${dropY(k)}px) scale(${pulse})` }}>
          <IconBadge name={s.icon} t={s.tone} size={112} glow={0.9} />
        </div>
      ) : null}
      {s.kicker ? (
        <div
          style={{
            fontFamily: SANS,
            fontWeight: 700,
            fontSize: TYPE.body.bigKicker,
            color: tt.text,
            opacity: k,
            transform: `translateY(${dropY(k, 14)}px)`,
            maxWidth: 1500,
          }}
        >
          <Smart text={s.kicker} t={s.tone} />
        </div>
      ) : null}
      <div
        style={{
          fontFamily: SANS,
          fontWeight: 900,
          // 長い文（大きい文字で 2 行近くになる文）は、ひと回り小さくする
          fontSize:
            textWidth(s.text.replace(/\*\*/g, ''), TYPE.display.statement, { fontFamily: SANS, fontWeight: 900 }) >
            LONG_STATEMENT
              ? TYPE.display.statementLong
              : TYPE.display.statement,
          lineHeight: 1.28,
          color: C.ink,
          maxWidth: 1640,
          opacity: t,
          transform: `translateY(${dropY(t, 22)}px)`,
        }}
      >
        <Rich text={s.text} t={s.tone} />
      </div>
      {s.sub ? (
        <div
          style={{
            fontFamily: SANS,
            fontWeight: 500,
            fontSize: TYPE.body.bigSub,
            color: C.sub,
            maxWidth: 1500,
            lineHeight: 1.5,
            opacity: sub,
            transform: `translateY(${dropY(sub, 14)}px)`,
          }}
        >
          <Smart text={s.sub} t={s.tone} />
        </div>
      ) : null}
    </Content>
  );
};

export const big = defineScene({ kind: 'big', Component: Big });
