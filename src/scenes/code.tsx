// 場面「code」: コード（光らせる行と、横の注）
import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import type { CodeScene, Theme } from '../../engine/core/schema';
import { textWidth } from '../components/fit';
import { CodeWindow } from '../components/frame';
import { italicComments, tokenize } from '../components/syntax';
import { NoteCard } from '../components/ui';
import { alpha, CONTENT_BOTTOM, CONTENT_TOP, H, PAD, usePalette, W } from '../theme';
import { dropY, lineStart, ramp, useAppear, useCurrentIndex, useScene } from '../timing';
import { LEAD, TYPE, TYPE_MIN } from '../video.config';
import { defineScene } from './define';

/** 1 行を、言語ごとの規則で色分けして描く（規則は src/components/syntax.ts。text は色を付けない） */
const highlight = (line: string, lang: CodeScene['lang'], SYNTAX: Theme['syntax']): React.ReactNode[] => {
  const italic = italicComments(lang);
  let at = 0;
  return tokenize(line, lang).map((t) => {
    const key = at;
    at += t.text.length;
    return t.kind ? (
      <span key={key} style={{ color: SYNTAX[t.kind], fontStyle: italic && t.kind === 'comment' ? 'italic' : undefined }}>
        {t.text}
      </span>
    ) : (
      <React.Fragment key={key}>{t.text}</React.Fragment>
    );
  });
};

const CodeView: React.FC<{ s: CodeScene }> = ({ s }) => {
  const { C, MONO, SYNTAX, tone } = usePalette();
  const frame = useCurrentFrame();
  const { lines } = useScene();
  const activeMark = useCurrentIndex(s.marks);
  const codeLines = s.code.split('\n');
  const edTop = CONTENT_TOP + 6;
  const codeTop = 72; // タイトルバーの下
  const pad = 26;
  // 行数が多いときは、エディタが内容の枠に収まるまで文字を小さくする
  const fit = Math.floor((CONTENT_BOTTOM - edTop - codeTop - pad * 2 - 6) / codeLines.length / 1.52);
  const hasNotes = s.marks.some((m) => m.note);
  const edW = hasNotes ? 1150 : W - PAD * 2;
  // 横にもはみ出さないように、いちばん長い行を測って決める（行番号の列と左右の余白を除いた幅に入れる）
  const sample = 100;
  const widest = Math.max(1, ...codeLines.map((ln) => textWidth(ln, sample, { fontFamily: MONO, fontWeight: 400 })));
  const fitW = Math.floor(((edW - 64 - 48) * sample) / widest);
  // 縮めても、コードの下限より小さくしない（収まらないほど長いコードは、台本の検証が場面を分けるように言う）
  const fontSize = Math.max(TYPE_MIN.code, Math.min(s.fontSize ?? TYPE.code.code, fit, fitW));
  const lh = Math.round(fontSize * 1.52);
  const show = lineStart(lines, s.showAt ?? 0) - LEAD.code;
  const editorH = Math.min(CONTENT_BOTTOM - edTop, codeTop + pad * 2 + lh * codeLines.length);
  const enter = ramp(frame - show, 0, 14);
  // 注釈は今の 1 つだけ。光っている行の高さに合わせて出す
  const noteH = 112;
  const linesTop = edTop + codeTop - 16 + pad;
  const notePos = s.marks.map((m) => {
    const center = linesTop + ((m.from + m.to) / 2 - 0.5) * lh;
    const y = Math.min(Math.max(center - noteH / 2, CONTENT_TOP), CONTENT_BOTTOM - noteH);
    return { y, center };
  });
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: PAD,
          top: edTop,
          width: edW,
          height: editorH,
          opacity: enter,
          transform: `translateY(${dropY(enter, 16)}px)`,
        }}
      >
        <CodeWindow title={s.file}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: codeTop - 16 + pad }}>
            {s.marks.map((m, i) => {
              const on = i === activeMark;
              const p = ramp(frame - (lineStart(lines, m.at) - LEAD.appear), 0, 8);
              if (!on) return null;
              const tt = tone(m.tone ?? 'violet');
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: 10,
                    right: 10,
                    top: (m.from - 1) * lh - 4,
                    height: (m.to - m.from + 1) * lh + 8,
                    borderRadius: 12,
                    background: alpha(tt.main, 0.22),
                    borderLeft: `5px solid ${tt.main}`,
                    boxShadow: `0 0 30px ${alpha(tt.main, 0x30 / 255)}`,
                    opacity: p,
                  }}
                />
              );
            })}
            {codeLines.map((ln, i) => {
              const o = ramp(frame - show - i * 1.2, 0, 8);
              const inMark = activeMark >= 0 && i + 1 >= s.marks[activeMark].from && i + 1 <= s.marks[activeMark].to;
              return (
                <div
                  key={i}
                  style={{
                    height: lh,
                    display: 'flex',
                    alignItems: 'center',
                    fontFamily: MONO,
                    fontSize,
                    whiteSpace: 'pre',
                    opacity: o * (activeMark >= 0 && !inMark ? 0.55 : 1),
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <span
                    style={{
                      width: 64,
                      flexShrink: 0,
                      textAlign: 'right',
                      paddingRight: 22,
                      color: C.codeMuted,
                      fontSize: Math.max(TYPE_MIN.code, Math.round(fontSize * 0.8)),
                    }}
                  >
                    {i + 1}
                  </span>
                  <span style={{ color: SYNTAX.plain }}>{highlight(ln, s.lang, SYNTAX)}</span>
                </div>
              );
            })}
          </div>
        </CodeWindow>
      </div>
      {hasNotes
        ? s.marks.map((m, i) => {
            if (!m.note || (i !== activeMark && i !== activeMark - 1)) return null;
            // ひとつ前の注釈は、次の注釈が出るときに消す
            const out = i === activeMark - 1 ? lineStart(lines, s.marks[activeMark].at) - LEAD.appear : null;
            return (
              <Note key={i} m={m} y={notePos[i].y} center={notePos[i].center} left={PAD + edW} out={out} h={noteH} />
            );
          })
        : null}
    </>
  );
};

const Note: React.FC<{
  m: CodeScene['marks'][number];
  y: number;
  center: number;
  left: number;
  out: number | null;
  h: number;
}> = ({ m, y, center, left, out, h }) => {
  const { tone } = usePalette();
  const frame = useCurrentFrame();
  const p = useAppear(m.at, 2);
  const o =
    out === null
      ? p
      : p * interpolate(frame - out, [0, 8], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  if (o <= 0.001) return null;
  const tt = tone(m.tone ?? 'violet');
  return (
    <>
      <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, opacity: o }}>
        <path
          d={`M ${left + 4} ${center} C ${left + 30} ${center}, ${left + 24} ${y + h / 2}, ${left + 52} ${y + h / 2}`}
          fill="none"
          stroke={tt.main}
          strokeWidth={3}
        />
        <circle cx={left + 4} cy={center} r={6} fill={tt.main} />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: left + 52,
          width: W - PAD - left - 52,
          top: y,
          height: h,
          opacity: o,
          transform: `translateX(${(1 - p) * -18}px)`,
        }}
      >
        <NoteCard
          text={m.note ?? ''}
          t={m.tone}
          active={1}
          size={TYPE.body.codeNote}
          lineHeight={1.38}
          style={{ height: '100%', boxSizing: 'border-box', padding: '0 28px', display: 'flex', alignItems: 'center' }}
        />
      </div>
    </>
  );
};

export const code = defineScene({ kind: 'code', Component: CodeView });
