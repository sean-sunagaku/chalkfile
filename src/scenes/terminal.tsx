// 場面「terminal」: 端末（コマンドと出力、横の注）
import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import type { TerminalOut, TerminalScene, Theme } from '../../engine/core/schema';
import { terminalText } from '../../engine/core/scenes';
import { lineCount } from '../components/fit';
import { CodeWindow } from '../components/frame';
import { NoteCard } from '../components/ui';
import { CONTENT_BOTTOM, CONTENT_TOP, PAD, usePalette, W } from '../theme';
import { dropY, lineStart, ramp, useActiveLine, useAppear, useScene } from '../timing';
import { LEAD, TYPE } from '../video.config';

/** 横の注のカードの左右の余白（枠を含む）と、1 行・2 行のときの高さ */
const NOTE_INNER = 22 * 2 + 4;
const NOTE_H = { one: 74, two: 112 } as const;
import { defineScene } from './define';

/** 出力の行の色（書かなければ薄い色。ok は成功、info は目を向けてほしい行） */
const outColor = (o: TerminalOut, SYNTAX: Theme['syntax']) => {
  const t = typeof o === 'string' ? undefined : o.tone;
  return t === 'ok' ? SYNTAX.string : t === 'info' ? SYNTAX.fn : SYNTAX.comment;
};

const Terminal: React.FC<{ s: TerminalScene }> = ({ s }) => {
  const { C, MONO, SANS, SYNTAX } = usePalette();
  const frame = useCurrentFrame();
  const { lines } = useScene();
  const box = useAppear(0);
  const lh = 40;
  const fs = TYPE.code.terminal;
  const tw = 1210;
  const noteLeft = PAD + tw + 40;
  const noteRoom = W - PAD - noteLeft - NOTE_INNER;
  const top = CONTENT_TOP + 6;
  let y = 88;
  // pos は entries と同じ長さで作る。描くときの添字も entries の map から得る。
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
        <CodeWindow title={s.title}>
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
            const outO = ramp(frame - st - (e.cmd ? Math.min(34, len * 0.6) : 0), 0, 8);
            if (frame < st) return null;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: 30,
                  right: 30,
                  top: pos[i]!,
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
        </CodeWindow>
      </div>
      {(() => {
        let prev = -Infinity;
        return s.entries.map((e, i) => {
          if (!e.note) return null;
          // 注のカードの高さは、測った文字が 1 行に入るかで決める（重ならないように、次の注をその下に置く）
          const h = lineCount(e.note, TYPE.body.terminalNote, noteRoom, { fontFamily: SANS, fontWeight: 700 }) > 1 ? NOTE_H.two : NOTE_H.one;
          const y = Math.max(top + pos[i]! - 4, prev + 14);
          prev = y + h;
          return <TermNote key={i} at={e.at} text={e.note} y={y} left={noteLeft} />;
        });
      })()}
    </>
  );
};

const TermNote: React.FC<{ at: number; text: string; y: number; left: number }> = ({ at, text, y, left }) => {
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
      <NoteCard text={text} t="mint" active={on ? 1 : 0} size={TYPE.body.terminalNote} lineHeight={1.4} style={{ padding: '18px 22px' }} />
    </div>
  );
};

export const terminal = defineScene({ kind: 'terminal', Component: Terminal });
