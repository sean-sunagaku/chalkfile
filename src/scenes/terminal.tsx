// 場面「terminal」: 端末（コマンドと出力、横の注）
import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import type { TerminalOut, TerminalScene, Theme } from '../../content/types';
import { terminalText } from '../../engine/core/scenes';
import { Glass, Smart } from '../components/ui';
import { CONTENT_BOTTOM, CONTENT_TOP, mix, PAD, usePalette } from '../theme';
import { dropY, lineStart, useActiveLine, useAppear, useScene } from '../timing';
import { LEAD } from '../video.config';
import { defineScene } from './define';

/** 出力の行の色（書かなければ薄い色。ok は成功、info は目を向けてほしい行） */
const outColor = (o: TerminalOut, SYNTAX: Theme['syntax']) => {
  const t = typeof o === 'string' ? undefined : o.tone;
  return t === 'ok' ? SYNTAX.string : t === 'info' ? SYNTAX.fn : SYNTAX.comment;
};

const Terminal: React.FC<{ s: TerminalScene }> = ({ s }) => {
  const { C, MONO, SYNTAX } = usePalette();
  const frame = useCurrentFrame();
  const { lines } = useScene();
  const box = useAppear(0);
  const lh = 40;
  const fs = 23;
  const tw = 1210;
  const top = CONTENT_TOP + 6;
  let y = 88;
  const pos = s.entries.map((e) => {
    const at = y;
    y += ((e.cmd ? 1 : 0) + (e.out?.length ?? 0)) * lh + 34;
    return at;
  });
  const height = Math.min(CONTENT_BOTTOM - top, y + 10);
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: PAD,
          top,
          width: tw,
          height,
          opacity: box,
          transform: `translateY(${dropY(box)}px)`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 22,
            background: `linear-gradient(180deg, ${C.code}, ${mix(C.code, '#000000', 0.18)})`,
            border: `1.5px solid ${C.line2}`,
            boxShadow: C.shadow,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: 56,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '0 24px',
              borderBottom: `1.5px solid ${C.codeLine}`,
              background: C.codeBar,
            }}
          >
            {['#FF6F7D', '#FFC260', '#4CE2B2'].map((c) => (
              <div key={c} style={{ width: 14, height: 14, borderRadius: 99, background: c, opacity: 0.85 }} />
            ))}
            <div style={{ marginLeft: 14, fontFamily: MONO, fontSize: 20, color: C.codeMuted }}>{s.title}</div>
          </div>
          {s.entries.map((e, i) => {
            const st = lineStart(lines, e.at) - LEAD.appear;
            const len = e.cmd?.length ?? 0;
            const typed = e.cmd
              ? Math.floor(
                  interpolate(frame - st, [0, Math.min(34, len * 0.6)], [0, len], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                  }),
                )
              : 0;
            const outO = interpolate(frame - st - (e.cmd ? Math.min(34, len * 0.6) : 0), [0, 8], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            if (frame < st) return null;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: 30,
                  right: 30,
                  top: pos[i],
                  fontFamily: MONO,
                  fontSize: fs,
                  lineHeight: `${lh}px`,
                }}
              >
                {e.cmd ? (
                  <div style={{ whiteSpace: 'pre', color: SYNTAX.plain }}>
                    <span style={{ color: SYNTAX.string }}>$ </span>
                    {e.cmd.slice(0, typed)}
                    {typed < len || Math.floor(frame / 15) % 2 === 0 ? (
                      <span style={{ background: SYNTAX.plain, color: C.code }}> </span>
                    ) : null}
                  </div>
                ) : null}
                {(e.out ?? []).map((o, k) => (
                  <div
                    key={k}
                    style={{
                      whiteSpace: 'pre',
                      color: outColor(o, SYNTAX),
                      opacity: outO,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {terminalText(o)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
      {(() => {
        let prev = -Infinity;
        return s.entries.map((e, i) => {
          if (!e.note) return null;
          const h = e.note.length > 16 ? 112 : 74;
          const y = Math.max(top + pos[i] - 4, prev + 14);
          prev = y + h;
          return <TermNote key={i} at={e.at} text={e.note} y={y} left={PAD + tw + 40} />;
        });
      })()}
    </>
  );
};

const TermNote: React.FC<{ at: number; text: string; y: number; left: number }> = ({ at, text, y, left }) => {
  const { C, SANS } = usePalette();
  const p = useAppear(at, 10);
  const on = useActiveLine() === at;
  return (
    <div
      style={{
        position: 'absolute',
        left,
        right: PAD,
        top: y,
        opacity: p * (on ? 1 : 0.6),
        transform: `translateX(${(1 - p) * -16}px)`,
      }}
    >
      <Glass t="mint" active={on ? 1 : 0} style={{ padding: '18px 22px' }}>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 25, color: C.ink, lineHeight: 1.4 }}>
          <Smart text={text} t="mint" />
        </div>
      </Glass>
    </div>
  );
};

export const terminal = defineScene({ kind: 'terminal', Component: Terminal });
