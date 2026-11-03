// 場面「numbers」: 数字（数え上げる）
import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import type { NumbersScene } from '../../content/types';
import { Glass } from '../components/ui';
import { C, CONTENT_BOTTOM, CONTENT_TOP, H, PAD, SANS, tone } from '../theme';
import { dropY, lineStart, useAppear, useScene } from '../timing';
import { defineScene } from './define';

const NumRow: React.FC<{ it: NumbersScene['items'][number]; last: boolean }> = ({ it, last }) => {
  const frame = useCurrentFrame();
  const { lines } = useScene();
  const p = useAppear(it.at);
  const start = lineStart(lines, it.at);
  const c = interpolate(frame - start, [0, 26], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const eased = 1 - Math.pow(1 - c, 3);
  const v = it.value * eased;
  const tt = tone(it.tone);
  const text = (it.decimals ? v.toFixed(it.decimals) : Math.round(v).toLocaleString('ja-JP'));
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 28,
        padding: last ? '26px 10px 6px' : '18px 10px',
        borderTop: last ? `2px solid ${C.line2}` : undefined,
        opacity: p,
        transform: `translateY(${dropY(p, 14)}px)`,
      }}
    >
      <div style={{ width: 70, fontFamily: SANS, fontWeight: 900, fontSize: 60, color: tt.main, textAlign: 'center' }}>{it.op}</div>
      <div style={{ flex: 1, fontFamily: SANS, fontWeight: 700, fontSize: last ? 44 : 38, color: last ? C.ink : C.sub }}>{it.label}</div>
      <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: last ? 104 : 72, color: last ? tt.main : C.ink, fontVariantNumeric: 'tabular-nums', textShadow: last ? `0 0 40px ${tt.main}66` : undefined }}>
        {it.prefix ?? ''}
        {text}
        <span style={{ fontSize: last ? 52 : 40, marginLeft: 6 }}>{it.suffix}</span>
      </div>
    </div>
  );
};

const Numbers: React.FC<{ s: NumbersScene }> = ({ s }) => {
  const f = useAppear(s.footnote?.at ?? 99);
  // 枠は最初の数字と一緒に出す（数字の前の台詞の間、空の枠を見せない）
  const box = useAppear(Math.min(...s.items.map((it) => it.at)));
  return (
    <div style={{ position: 'absolute', left: PAD, right: PAD, top: CONTENT_TOP, bottom: H - CONTENT_BOTTOM, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26 }}>
      <div style={{ width: 1260, opacity: box }}>
        <Glass t="mint" active={0.4} style={{ padding: '28px 56px 32px' }}>
          {s.items.map((it, i) => (
            <NumRow key={i} it={it} last={i === s.items.length - 1} />
          ))}
        </Glass>
      </div>
      {s.footnote ? (
        <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 26, color: C.muted, opacity: f }}>{s.footnote.text}</div>
      ) : null}
    </div>
  );
};

export const numbers = defineScene({ kind: 'numbers', Component: Numbers });
