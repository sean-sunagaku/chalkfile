// 場面「table」: 表
import React from 'react';
import type { TableScene } from '../../content/types';
import { Content } from '../components/content';
import { Glass, Smart } from '../components/ui';
import { CONTENT_BOTTOM, CONTENT_TOP, usePalette } from '../theme';
import { dropY, useAppear, useLatestAt } from '../timing';
import { defineScene } from './define';

const Row: React.FC<{
  r: TableScene['rows'][number];
  widths: number[];
  mono: number[];
  fontSize: number;
  on: boolean;
  h: number;
}> = ({ r, widths, mono, fontSize, on, h }) => {
  const { C, MONO, SANS, tone } = usePalette();
  const p = useAppear(r.at);
  const tt = tone(r.tone ?? 'slate');
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        minHeight: h,
        borderTop: `1.5px solid ${C.line}`,
        background: on ? tt.soft : 'transparent',
        opacity: p,
        transform: `translateY(${dropY(p, 14)}px)`,
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 10,
          bottom: 10,
          width: 6,
          borderRadius: 9,
          background: tt.main,
          opacity: on ? 1 : 0.6,
        }}
      />
      {r.cells.map((c, i) => (
        <div
          key={i}
          style={{
            width: `${widths[i] * 100}%`,
            padding: '14px 28px',
            display: 'flex',
            alignItems: 'center',
            fontFamily: mono.includes(i) ? MONO : SANS,
            fontWeight: i === 0 ? 700 : 500,
            fontSize: mono.includes(i) ? fontSize * 0.92 : fontSize,
            color: i === 0 || on ? C.ink : C.sub,
            lineHeight: 1.42,
            boxSizing: 'border-box',
            wordBreak: 'break-word',
          }}
        >
          {mono.includes(i) ? c : <Smart text={c} t={r.tone} />}
        </div>
      ))}
    </div>
  );
};

const Table: React.FC<{ s: TableScene }> = ({ s }) => {
  const { SANS, TONES } = usePalette();
  const latest = useLatestAt(s.rows);
  const fontSize = s.fontSize ?? 30;
  const widths = s.widths ?? s.columns.map(() => 1 / s.columns.length);
  const head = useAppear(0);
  const avail = CONTENT_BOTTOM - CONTENT_TOP - 90;
  const rowH = Math.min(118, Math.max(64, Math.floor(avail / s.rows.length)));
  return (
    <Content>
      <Glass style={{ overflow: 'hidden', opacity: head }}>
        <div style={{ display: 'flex', background: TONES.violet.soft }}>
          {s.columns.map((c, i) => (
            <div
              key={i}
              style={{
                width: `${widths[i] * 100}%`,
                padding: '18px 28px',
                fontFamily: SANS,
                fontWeight: 700,
                fontSize: 24,
                color: TONES.violet.text,
                letterSpacing: 2,
                boxSizing: 'border-box',
              }}
            >
              {c}
            </div>
          ))}
        </div>
        {s.rows.map((r, i) => (
          <Row key={i} r={r} widths={widths} mono={s.mono ?? []} fontSize={fontSize} on={r.at === latest} h={rowH} />
        ))}
      </Glass>
    </Content>
  );
};

export const table = defineScene({ kind: 'table', Component: Table });
