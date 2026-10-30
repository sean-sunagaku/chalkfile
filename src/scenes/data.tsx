import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { CodeScene, CompareScene, CompareSide, NumbersScene, PhoneScene, PhoneScreen, QuizScene, TableScene, TerminalScene, TimelineScene } from '../../content/types';
import { Glass, Icon, IconBadge, Pill, Smart } from '../components/ui';
import { alpha, C, CONTENT_BOTTOM, CONTENT_TOP, DISPLAY, GRAD, mix, MONO, PAD, SANS, SYNTAX, TONES, tone } from '../theme';
import { dropY, lineEnd, lineStart, useActiveLine, useAppear, useFocus, useScene } from '../timing';

/* ───────────── コード ───────────── */

const RX = /(#.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b(?:def|return|if|not|in|for|and|or|try|except|class|async|await|None|True|False|import|from|with|as|elif|else|while|is)\b)|(@[\w.]+)|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_]\w*(?=\())/gm;

// JSON はキー（: が続く文字列）・値の文字列・true/false/null・数値を塗り分ける
const RX_JSON = /("(?:[^"\\]|\\.)*"(?=\s*:))|("(?:[^"\\]|\\.)*")|(\b(?:true|false|null)\b)|(-?\b\d+(?:\.\d+)?\b)/gm;

const highlight = (line: string, lang: CodeScene['lang']): React.ReactNode[] => {
  const out: React.ReactNode[] = [];
  let last = 0;
  const json = lang === 'json';
  for (const m of line.matchAll(json ? RX_JSON : RX)) {
    const i = m.index ?? 0;
    if (i > last) out.push(line.slice(last, i));
    const color = json
      ? m[1] ? SYNTAX.fn : m[2] ? SYNTAX.string : m[3] ? SYNTAX.keyword : SYNTAX.number
      : m[1] ? SYNTAX.comment : m[2] ? SYNTAX.string : m[3] ? SYNTAX.keyword : m[4] ? SYNTAX.deco : m[5] ? SYNTAX.number : SYNTAX.fn;
    out.push(
      <span key={i} style={{ color, fontStyle: !json && m[1] ? 'italic' : undefined }}>
        {m[0]}
      </span>,
    );
    last = i + m[0].length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
};

export const CodeView: React.FC<{ s: CodeScene }> = ({ s }) => {
  const frame = useCurrentFrame();
  const { lines } = useScene();
  const active = useActiveLine();
  const codeLines = s.code.split('\n');
  const edTop = CONTENT_TOP + 6;
  const codeTop = 72; // タイトルバーの下
  const pad = 26;
  // 行数が多いときは、エディタが内容の枠に収まるまで文字を小さくする
  const fit = Math.floor((CONTENT_BOTTOM - edTop - codeTop - pad * 2 - 6) / codeLines.length / 1.52);
  const hasNotes = s.marks.some((m) => m.note);
  const edW = hasNotes ? 1150 : 1728;
  // 横にもはみ出さないように（英数字は 0.6em、日本語は 1em として最も長い行で決める）
  const widestEm = Math.max(...codeLines.map((ln) => [...ln].reduce((w, ch) => w + (/[\x00-\x7F]/.test(ch) ? 0.6 : 1), 0)));
  const fitW = Math.floor((edW - 64 - 48) / Math.max(1, widestEm));
  const fontSize = Math.min(s.fontSize ?? 26, fit, fitW);
  const lh = Math.round(fontSize * 1.52);
  const show = lineStart(lines, s.showAt ?? 0) - 6;
  const editorH = Math.min(CONTENT_BOTTOM - edTop, codeTop + pad * 2 + lh * codeLines.length);
  const activeMark = s.marks.reduce<number>((acc, m, i) => (m.at <= active ? i : acc), -1);
  const enter = interpolate(frame - show, [0, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
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
      <div style={{ position: 'absolute', left: PAD, top: edTop, width: edW, height: editorH, opacity: enter, transform: `translateY(${dropY(enter, 16)}px)` }}>
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 22,
            background: `linear-gradient(180deg, ${C.code}, ${mix(C.code, '#000000', 0.18)})`,
            border: `1.5px solid ${C.line2}`,
            boxShadow: C.shadow,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div style={{ height: 56, display: 'flex', alignItems: 'center', gap: 12, padding: '0 24px', borderBottom: `1.5px solid ${C.codeLine}`, background: C.codeBar }}>
            {['#FF6F7D', '#FFC260', '#4CE2B2'].map((c) => (
              <div key={c} style={{ width: 14, height: 14, borderRadius: 99, background: c, opacity: 0.85 }} />
            ))}
            <div style={{ marginLeft: 14, fontFamily: MONO, fontSize: 20, color: C.codeMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.file}</div>
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: codeTop - 16 + pad }}>
            {s.marks.map((m, i) => {
              const on = i === activeMark;
              const p = interpolate(frame - (lineStart(lines, m.at) - 4), [0, 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
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
                    boxShadow: `0 0 30px ${tt.main}30`,
                    opacity: p,
                  }}
                />
              );
            })}
            {codeLines.map((ln, i) => {
              const o = interpolate(frame - show - i * 1.2, [0, 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
              const inMark = activeMark >= 0 && i + 1 >= s.marks[activeMark].from && i + 1 <= s.marks[activeMark].to;
              return (
                <div key={i} style={{ height: lh, display: 'flex', alignItems: 'center', fontFamily: MONO, fontSize, whiteSpace: 'pre', opacity: o * (activeMark >= 0 && !inMark ? 0.55 : 1), position: 'relative', overflow: 'hidden' }}>
                  <span style={{ width: 64, flexShrink: 0, textAlign: 'right', paddingRight: 22, color: C.codeMuted, fontSize: fontSize * 0.8 }}>{i + 1}</span>
                  <span style={{ color: SYNTAX.plain }}>{highlight(ln, s.lang)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {hasNotes
        ? s.marks.map((m, i) => {
            if (!m.note || (i !== activeMark && i !== activeMark - 1)) return null;
            // ひとつ前の注釈は、次の注釈が出るときに消す
            const out = i === activeMark - 1 ? lineStart(lines, s.marks[activeMark].at) - 4 : null;
            return <Note key={i} m={m} y={notePos[i].y} center={notePos[i].center} left={PAD + edW} out={out} h={noteH} />;
          })
        : null}
    </>
  );
};

const Note: React.FC<{ m: CodeScene['marks'][number]; y: number; center: number; left: number; out: number | null; h: number }> = ({ m, y, center, left, out, h }) => {
  const frame = useCurrentFrame();
  const p = useAppear(m.at, 2);
  const o = out === null ? p : p * interpolate(frame - out, [0, 8], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  if (o <= 0.001) return null;
  const tt = tone(m.tone ?? 'violet');
  return (
    <>
      <svg width={1920} height={1080} style={{ position: 'absolute', left: 0, top: 0, opacity: o }}>
        <path d={`M ${left + 4} ${center} C ${left + 30} ${center}, ${left + 24} ${y + h / 2}, ${left + 52} ${y + h / 2}`} fill="none" stroke={tt.main} strokeWidth={3} />
        <circle cx={left + 4} cy={center} r={6} fill={tt.main} />
      </svg>
      <div style={{ position: 'absolute', left: left + 52, width: 1824 - left - 52, top: y, height: h, opacity: o, transform: `translateX(${(1 - p) * -18}px)` }}>
        <Glass t={m.tone} active={1} style={{ height: '100%', boxSizing: 'border-box', padding: '0 28px', display: 'flex', alignItems: 'center' }}>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 30, color: C.ink, lineHeight: 1.38 }}>
            <Smart text={m.note!} t={m.tone} />
          </div>
        </Glass>
      </div>
    </>
  );
};

/* ───────────── 表 ───────────── */

const Row: React.FC<{ r: TableScene['rows'][number]; widths: number[]; mono: number[]; fontSize: number; on: boolean; h: number }> = ({ r, widths, mono, fontSize, on, h }) => {
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
      <div style={{ position: 'absolute', left: 0, top: 10, bottom: 10, width: 6, borderRadius: 9, background: tt.main, opacity: on ? 1 : 0.6 }} />
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

export const Table: React.FC<{ s: TableScene }> = ({ s }) => {
  const active = useActiveLine();
  const fontSize = s.fontSize ?? 30;
  const widths = s.widths ?? s.columns.map(() => 1 / s.columns.length);
  const latest = s.rows.reduce((m, r) => (r.at <= active ? Math.max(m, r.at) : m), -1);
  const head = useAppear(0);
  const avail = CONTENT_BOTTOM - CONTENT_TOP - 90;
  const rowH = Math.min(118, Math.max(64, Math.floor(avail / s.rows.length)));
  return (
    <div style={{ position: 'absolute', left: PAD, right: PAD, top: CONTENT_TOP, bottom: 1080 - CONTENT_BOTTOM, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <Glass style={{ overflow: 'hidden', opacity: head }}>
        <div style={{ display: 'flex', background: TONES.violet.soft }}>
          {s.columns.map((c, i) => (
            <div key={i} style={{ width: `${widths[i] * 100}%`, padding: '18px 28px', fontFamily: SANS, fontWeight: 700, fontSize: 24, color: TONES.violet.text, letterSpacing: 2, boxSizing: 'border-box' }}>
              {c}
            </div>
          ))}
        </div>
        {s.rows.map((r, i) => (
          <Row key={i} r={r} widths={widths} mono={s.mono ?? []} fontSize={fontSize} on={r.at === latest} h={rowH} />
        ))}
      </Glass>
    </div>
  );
};

/* ───────────── 比較 ───────────── */

const SideCard: React.FC<{ side: CompareSide; dir: -1 | 1 }> = ({ side, dir }) => {
  const p = useAppear(side.at);
  const tt = tone(side.tone);
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', opacity: p, transform: `translateX(${(1 - p) * 30 * dir}px)` }}>
      <Glass t={side.tone} active={0.6} style={{ flex: 1, padding: '38px 44px', display: 'flex', flexDirection: 'column', gap: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          {side.icon ? <IconBadge name={side.icon} t={side.tone} size={76} glow={0.5} /> : null}
          <div>
            <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: side.title.length > 14 ? 36 : 44, color: C.ink, lineHeight: 1.2 }}>
              <Smart text={side.title} t={side.tone} />
            </div>
            {side.sub ? <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 24, color: tt.text, marginTop: 4 }}><Smart text={side.sub} t={side.tone} /></div> : null}
          </div>
        </div>
        <div style={{ height: 2, background: `linear-gradient(90deg, ${tt.main}88, transparent)` }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {side.items.map((it, i) => (
            <SideItem key={i} text={it.text} at={it.at} k={i} t={side.tone} />
          ))}
        </div>
      </Glass>
    </div>
  );
};

const SideItem: React.FC<{ text: string; at: number; k: number; t: CompareSide['tone'] }> = ({ text, at, k, t }) => {
  const p = useAppear(at, k * 6);
  const tt = tone(t);
  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', opacity: p, transform: `translateY(${dropY(p, 12)}px)` }}>
      <div style={{ width: 14, height: 14, borderRadius: 99, background: tt.main, marginTop: 16, flexShrink: 0, boxShadow: `0 0 12px ${tt.main}` }} />
      <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 33, color: C.ink, lineHeight: 1.45 }}>
        <Smart text={text} t={t} />
      </div>
    </div>
  );
};

export const Compare: React.FC<{ s: CompareScene }> = ({ s }) => {
  const v = useAppear(s.verdict?.at ?? 99);
  const vt = tone(s.verdict?.tone ?? 'violet');
  return (
    <div style={{ position: 'absolute', left: PAD, right: PAD, top: CONTENT_TOP, bottom: 1080 - CONTENT_BOTTOM, display: 'flex', flexDirection: 'column', gap: 30, justifyContent: 'center' }}>
      <div style={{ display: 'flex', gap: 40, alignItems: 'stretch', minHeight: s.verdict ? 470 : 600 }}>
        <SideCard side={s.left} dir={-1} />
        <SideCard side={s.right} dir={1} />
      </div>
      {s.verdict ? (
        <div style={{ opacity: v, transform: `translateY(${dropY(v, 16)}px)` }}>
          <div
            style={{
              borderRadius: 24,
              padding: 2,
              background: GRAD,
              boxShadow: `0 0 40px ${vt.main}40`,
            }}
          >
            <div style={{ borderRadius: 22, background: C.overlay, padding: '26px 38px', display: 'flex', alignItems: 'center', gap: 24 }}>
              <Icon name="check" size={44} color={vt.main} stroke={3} />
              <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: 36, color: C.ink, lineHeight: 1.4 }}>
                <Smart text={s.verdict.text} t={s.verdict.tone} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

/* ───────────── 数字 ───────────── */

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

export const Numbers: React.FC<{ s: NumbersScene }> = ({ s }) => {
  const f = useAppear(s.footnote?.at ?? 99);
  // 枠は最初の数字と一緒に出す（数字の前の台詞の間、空の枠を見せない）
  const box = useAppear(Math.min(...s.items.map((it) => it.at)));
  return (
    <div style={{ position: 'absolute', left: PAD, right: PAD, top: CONTENT_TOP, bottom: 1080 - CONTENT_BOTTOM, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26 }}>
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

/* ───────────── 時系列 ───────────── */

const TimeCard: React.FC<{ it: TimelineScene['items'][number]; x: number; w: number; focus: number }> = ({ it, x, w, focus }) => {
  const p = useAppear(it.at);
  const tt = tone(it.tone);
  // 「SECTION 2　Stripe の基本」は前半を小さなラベルにして、見出しを割らない
  const [kicker, title] = it.title.includes('　') ? it.title.split('　') : [null, it.title];
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: x - 22,
          top: 418,
          width: 44,
          height: 44,
          borderRadius: 99,
          background: focus > 0 ? tt.main : C.surface,
          border: `4px solid ${tt.main}`,
          boxShadow: focus > 0 ? `0 0 34px ${tt.main}` : undefined,
          opacity: p,
          transform: `scale(${0.6 + 0.4 * p})`,
        }}
      />
      <div style={{ position: 'absolute', left: x - w / 2, top: 500, width: w, height: 400, opacity: p * (focus < 0 ? 0.5 : 1), transform: `translateY(${dropY(p, 20)}px) scale(${focus > 0 ? 1.03 : 1})` }}>
        <Glass t={it.tone} active={focus > 0 ? 1 : 0} style={{ height: '100%', boxSizing: 'border-box', padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {kicker ? <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 22, color: tt.text, letterSpacing: 2 }}>{kicker}</div> : null}
            <Pill t={it.tone} size={21}>
              {it.sub}
            </Pill>
          </div>
          <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: w < 330 ? 32 : 38, color: C.ink, lineHeight: 1.3 }}>
            <Smart text={title} t={it.tone} />
          </div>
          {it.detail ? (
            <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: w < 330 ? 24 : 27, color: C.sub, lineHeight: 1.55 }}>
              <Smart text={it.detail} t={it.tone} />
            </div>
          ) : null}
        </Glass>
      </div>
    </>
  );
};

export const Timeline: React.FC<{ s: TimelineScene }> = ({ s }) => {
  const frame = useCurrentFrame();
  const f = useFocus(s.focus);
  const n = s.items.length;
  const colW = 1728 / n;
  const xs = s.items.map((_, i) => PAD + (i + 0.5) * colW);
  const fi = f ? s.items.findIndex((it) => it.key === f.key) : -1;
  const target = fi >= 0 ? xs[fi] : xs[0];
  const fill = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <>
      <div style={{ position: 'absolute', left: xs[0], width: xs[n - 1] - xs[0], top: 436, height: 8, borderRadius: 9, background: C.track, opacity: fill }} />
      <div style={{ position: 'absolute', left: xs[0], width: Math.max(0, target - xs[0]), top: 436, height: 8, borderRadius: 9, background: GRAD, boxShadow: C.glow }} />
      {s.items.map((it, i) => (
        <TimeCard key={it.key} it={it} x={xs[i]} w={colW - 28} focus={!f ? 0 : i === fi ? 1 : -1} />
      ))}
    </>
  );
};

/* ───────────── クイズ ───────────── */

export const Quiz: React.FC<{ s: QuizScene }> = ({ s }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { lines, lecture } = useScene();
  // 「1 / 3」の分母は、このレクチャーのクイズの場面の数（もとは 7 で固定だった）
  const quizTotal = lecture.scenes.filter((x) => x.kind === 'quiz').length;
  const q = useAppear(0);
  const thinkStart = lineEnd(lines, 0) + 3;
  const revealF = lineStart(lines, s.revealAt) - 2;
  const think = interpolate(frame, [thinkStart, revealF], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const thinkO = interpolate(frame, [thinkStart - 4, thinkStart + 4, revealF - 2, revealF + 4], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const stamp = spring({ frame: frame - revealF, fps, config: { damping: 11, mass: 0.6 }, durationInFrames: 30 });
  const ex = spring({ frame: frame - revealF - 10, fps, config: { damping: 200 }, durationInFrames: 22 });
  const ok = s.answer;
  const tt = TONES[ok ? 'mint' : 'coral'];
  const remain = Math.max(1, Math.ceil(3 * (1 - think)));
  return (
    <>
      <div style={{ position: 'absolute', left: PAD, top: CONTENT_TOP + 10, display: 'flex', alignItems: 'center', gap: 34, opacity: q }}>
        <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: 150, lineHeight: 1, background: DISPLAY, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Q{s.no}</div>
        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 26, color: C.muted, letterSpacing: 4 }}>{s.no} / {quizTotal}</div>
      </div>
      <div style={{ position: 'absolute', left: PAD, right: PAD, top: 420, opacity: q, transform: `translateY(${dropY(q)}px)` }}>
        <Glass t="violet" active={stamp > 0.05 ? 0.4 : 1} style={{ padding: '40px 52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 40 }}>
          <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: 54, color: C.ink, lineHeight: 1.35 }}>
            <Smart text={s.question} t="violet" />
          </div>
          <div style={{ position: 'relative', width: 150, height: 150, flexShrink: 0 }}>
            <div style={{ position: 'absolute', inset: 0, opacity: thinkO }}>
              <svg width={150} height={150} viewBox="0 0 150 150">
                <circle cx={75} cy={75} r={62} fill="none" stroke={C.track} strokeWidth={10} />
                <circle cx={75} cy={75} r={62} fill="none" stroke={TONES.amber.main} strokeWidth={10} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={think} transform="rotate(-90 75 75)" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, fontWeight: 900, fontSize: 64, color: TONES.amber.main }}>{remain}</div>
            </div>
            <div
              style={{
                position: 'absolute',
                inset: -40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: Math.min(1, stamp * 1.4),
                transform: `scale(${0.4 + 0.6 * stamp}) rotate(${(1 - stamp) * -24}deg)`,
              }}
            >
              <div
                style={{
                  width: 210,
                  height: 210,
                  borderRadius: 999,
                  border: `10px solid ${tt.main}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: SANS,
                  fontWeight: 900,
                  fontSize: 150,
                  color: tt.main,
                  background: C.overlay,
                  boxShadow: `0 0 60px ${tt.main}88`,
                  lineHeight: 1,
                }}
              >
                {ok ? '○' : '×'}
              </div>
            </div>
          </div>
        </Glass>
      </div>
      <div style={{ position: 'absolute', left: PAD, right: PAD, top: 720, opacity: ex, transform: `translateY(${dropY(ex)}px)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
          <Pill t={ok ? 'mint' : 'coral'} size={30}>
            {ok ? '正しい' : '誤解'}
          </Pill>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 40, color: C.ink, lineHeight: 1.45 }}>
            <Smart text={s.explain} t={ok ? 'mint' : 'coral'} />
          </div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: PAD, top: 360, fontFamily: SANS, fontWeight: 700, fontSize: 28, color: TONES.amber.text, opacity: thinkO }}>
        ○ か × か？
      </div>
    </>
  );
};

/* ───────────── スマホの画面 ───────────── */

const Screen: React.FC<{ sc: PhoneScreen }> = ({ sc }) => {
  if (sc.kind === 'stripe') {
    return (
      <div style={{ position: 'absolute', inset: 0, background: '#FFFFFF', padding: '68px 26px 26px', display: 'flex', flexDirection: 'column', gap: 16, fontFamily: SANS }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#5B6178', fontSize: 19, fontWeight: 700 }}>
          <Icon name="lock" size={20} color="#5B6178" /> 支払いページ（Stripe がホスト）
        </div>
        <div style={{ fontSize: 31, fontWeight: 900, color: '#1D2340' }}>{sc.lead}</div>
        <div style={{ borderRadius: 14, background: '#F4F5FA', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sc.body.slice(0, 2).map((b, i) => (
            <div key={i} style={{ fontSize: 21, fontWeight: i === 0 ? 900 : 500, color: i === 0 ? '#1F9D6E' : '#30365A' }}>{b}</div>
          ))}
        </div>
        <div style={{ fontSize: 19, color: '#6B718C', marginTop: 4 }}>{sc.body[2]}</div>
        {['1234 1234 1234 1234', 'MM / YY　　CVC'].map((ph) => (
          <div key={ph} style={{ height: 54, borderRadius: 10, border: '1.5px solid #D5D8E6', display: 'flex', alignItems: 'center', padding: '0 14px', fontFamily: MONO, fontSize: 19, color: '#9AA0B8' }}>
            {ph}
          </div>
        ))}
        <div style={{ fontSize: 17, color: '#6B718C', lineHeight: 1.5 }}>{sc.note ?? '無料期間のあと毎月 1,000 円で自動更新。解約はいつでもプラン管理ページから。'}</div>
        <div style={{ marginTop: 'auto', height: 62, borderRadius: 12, background: '#1D2340', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 23 }}>{sc.primary}</div>
      </div>
    );
  }
  const done = sc.kind === 'done';
  return (
    <div style={{ position: 'absolute', inset: 0, background: done ? '#F1FFF8' : '#FFF4F8', padding: '64px 22px 22px', display: 'flex', flexDirection: 'column', fontFamily: SANS }}>
      <div style={{ fontWeight: 900, fontSize: 25, color: '#E2477F', letterSpacing: 1 }}>{sc.brand ?? 'サンプルアプリ'}</div>
      <div style={{ fontSize: 17, color: '#9A6B7E', marginTop: 2 }}>{sc.brandSub ?? 'Pro プラン'}</div>
      <div
        style={{
          marginTop: 22,
          borderRadius: 22,
          background: '#FFFFFF',
          boxShadow: '0 12px 30px rgba(226,71,127,0.14)',
          padding: '24px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          flex: 1,
        }}
      >
        {done ? (
          <div style={{ alignSelf: 'center', width: 76, height: 76, borderRadius: 99, background: '#D9FBEC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={44} color="#1F9D6E" stroke={3} />
          </div>
        ) : null}
        <div style={{ fontSize: 29, fontWeight: 900, color: '#2A2238', lineHeight: 1.3, textAlign: done ? 'center' : 'left' }}>{sc.title}</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: done ? '#1F9D6E' : '#E2477F', fontFamily: sc.lead?.startsWith('?') ? MONO : SANS, textAlign: done ? 'center' : 'left', wordBreak: 'break-all' }}>{sc.lead}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 6 }}>
          {sc.body.map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 20, color: '#4A4058', lineHeight: 1.45 }}>
              <div style={{ width: 7, height: 7, borderRadius: 9, background: done ? '#1F9D6E' : '#E2477F', marginTop: 10, flexShrink: 0 }} />
              {b}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sc.primary ? (
            <div style={{ height: 62, borderRadius: 999, background: done ? 'linear-gradient(90deg, #22B07D, #3FD3A0)' : 'linear-gradient(90deg, #E2477F, #FF7BA8)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 21 }}>
              {sc.primary}
            </div>
          ) : null}
          {sc.secondary ? <div style={{ textAlign: 'center', fontSize: 20, color: '#8E8299', fontWeight: 700 }}>{sc.secondary}</div> : null}
        </div>
      </div>
    </div>
  );
};

export const Phone: React.FC<{ s: PhoneScene }> = ({ s }) => {
  const frame = useCurrentFrame();
  const { lines } = useScene();
  const appear = useAppear(0);
  const starts = s.screens.map((sc) => lineStart(lines, sc.at) - 4);
  let cur = -1;
  starts.forEach((st, i) => {
    if (frame >= st) cur = i;
  });
  const enter = cur >= 0 ? interpolate(frame - starts[cur], [0, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 0;
  const pw = 450;
  const ph = 772;
  const px = PAD + 120;
  const py = CONTENT_TOP + 2;
  const sc = cur >= 0 ? s.screens[cur] : null;
  return (
    <>
      <div style={{ position: 'absolute', left: px, top: py, width: pw, height: ph, opacity: appear, transform: `translateY(${dropY(appear)}px)` }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 56, background: '#05070F', border: '2px solid rgba(255,255,255,0.22)', boxShadow: `${C.shadow}, 0 0 60px rgba(255,111,163,0.18)` }} />
        <div style={{ position: 'absolute', left: 14, top: 14, right: 14, bottom: 14, borderRadius: 44, overflow: 'hidden', background: '#1A1F38' }}>
          {sc ? (
            <div style={{ position: 'absolute', inset: 0, transform: `translateX(${(1 - enter) * 60}px)`, opacity: enter }}>
              <Screen sc={sc} />
            </div>
          ) : null}
          <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', width: 110, height: 30, borderRadius: 99, background: '#05070F' }} />
        </div>
      </div>
      <div style={{ position: 'absolute', left: px + pw + 110, right: PAD, top: CONTENT_TOP + 20, bottom: 1080 - CONTENT_BOTTOM, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 26 }}>
        {s.screens.map((x, i) => {
          const on = i === cur;
          const seen = i <= cur;
          const tt = TONES[x.kind === 'stripe' ? 'cyan' : x.kind === 'done' ? 'mint' : 'pink'];
          return (
            <div key={i} style={{ display: 'flex', gap: 24, alignItems: 'flex-start', opacity: seen ? (on ? 1 : 0.5) : 0.18 }}>
              <div
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 99,
                  flexShrink: 0,
                  background: on ? tt.main : C.faint,
                  border: `2.5px solid ${tt.main}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: MONO,
                  fontWeight: 700,
                  fontSize: 26,
                  color: on ? C.onTone : tt.main,
                  boxShadow: on ? `0 0 26px ${tt.main}` : undefined,
                }}
              >
                {i + 1}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: on ? 42 : 34, color: C.ink }}>{x.title}</div>
                {on ? (
                  <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 28, color: C.sub, lineHeight: 1.5, opacity: enter }}>
                    <Smart text={x.caption} t="pink" />
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

/* ───────────── ターミナル ───────────── */

export const Terminal: React.FC<{ s: TerminalScene }> = ({ s }) => {
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
      <div style={{ position: 'absolute', left: PAD, top, width: tw, height, opacity: box, transform: `translateY(${dropY(box)}px)` }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 22, background: `linear-gradient(180deg, ${C.code}, ${mix(C.code, '#000000', 0.18)})`, border: `1.5px solid ${C.line2}`, boxShadow: C.shadow, overflow: 'hidden' }}>
          <div style={{ height: 56, display: 'flex', alignItems: 'center', gap: 12, padding: '0 24px', borderBottom: `1.5px solid ${C.codeLine}`, background: C.codeBar }}>
            {['#FF6F7D', '#FFC260', '#4CE2B2'].map((c) => (
              <div key={c} style={{ width: 14, height: 14, borderRadius: 99, background: c, opacity: 0.85 }} />
            ))}
            <div style={{ marginLeft: 14, fontFamily: MONO, fontSize: 20, color: C.codeMuted }}>{s.title}</div>
          </div>
          {s.entries.map((e, i) => {
            const st = lineStart(lines, e.at) - 4;
            const len = e.cmd?.length ?? 0;
            const typed = e.cmd ? Math.floor(interpolate(frame - st, [0, Math.min(34, len * 0.6)], [0, len], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })) : 0;
            const outO = interpolate(frame - st - (e.cmd ? Math.min(34, len * 0.6) : 0), [0, 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            if (frame < st) return null;
            return (
              <div key={i} style={{ position: 'absolute', left: 30, right: 30, top: pos[i], fontFamily: MONO, fontSize: fs, lineHeight: `${lh}px` }}>
                {e.cmd ? (
                  <div style={{ whiteSpace: 'pre', color: SYNTAX.plain }}>
                    <span style={{ color: SYNTAX.string }}>$ </span>
                    {e.cmd.slice(0, typed)}
                    {typed < len || Math.floor(frame / 15) % 2 === 0 ? <span style={{ background: SYNTAX.plain, color: C.code }}> </span> : null}
                  </div>
                ) : null}
                {(e.out ?? []).map((o, k) => (
                  <div key={k} style={{ whiteSpace: 'pre', color: o.includes('[200]') ? SYNTAX.string : o.startsWith('-->') ? SYNTAX.fn : SYNTAX.comment, opacity: outO, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {o}
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
  const p = useAppear(at, 10);
  const active = useActiveLine();
  const on = active === at || (active > at && active < at + 1);
  return (
    <div style={{ position: 'absolute', left, right: PAD, top: y, opacity: p * (on ? 1 : 0.6), transform: `translateX(${(1 - p) * -16}px)` }}>
      <Glass t="mint" active={on ? 1 : 0} style={{ padding: '18px 22px' }}>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 25, color: C.ink, lineHeight: 1.4 }}>
          <Smart text={text} t="mint" />
        </div>
      </Glass>
    </div>
  );
};
