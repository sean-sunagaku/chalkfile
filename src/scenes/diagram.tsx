import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import type { FlowScene, SequenceScene, StatesScene, Tone } from '../../content/types';
import { Glass, IconBadge, Pill, Smart } from '../components/ui';
import { C, MONO, PAD, SANS, TONES, tone } from '../theme';
import { dropY, lineStart, useActiveLine, useAppear, useFocus, useScene } from '../timing';

type Pt = [number, number];
type Side = 'l' | 'r' | 't' | 'b';
type Box = { x: number; y: number; w: number; h: number };

const anchor = (b: Box, side: Side): Pt =>
  side === 'l' ? [b.x - b.w / 2, b.y] : side === 'r' ? [b.x + b.w / 2, b.y] : side === 't' ? [b.x, b.y - b.h / 2] : [b.x, b.y + b.h / 2];

const autoSides = (a: Box, b: Box): [Side, Side] => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) * 0.6 > Math.abs(dy)) return dx > 0 ? ['r', 'l'] : ['l', 'r'];
  return dy > 0 ? ['b', 't'] : ['t', 'b'];
};

const quad = (p0: Pt, c: Pt, p1: Pt, t: number): Pt => [
  (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0],
  (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1],
];

/** 箱から箱への矢印。at の台詞で線が伸び、光の粒が流れる */
const Edge: React.FC<{
  a: Box;
  b: Box;
  at: number;
  label?: string;
  t?: Tone;
  dashed?: boolean;
  bend?: number;
  fromSide?: Side;
  toSide?: Side;
  labelDx?: number;
  labelDy?: number;
  dim: number;
  stagger?: number;
}> = ({ a, b, at, label, t, dashed, bend = 0, fromSide, toSide, labelDx = 0, labelDy = 0, dim, stagger = 0 }) => {
  const frame = useCurrentFrame();
  const { lines } = useScene();
  const start = lineStart(lines, at) - 2 + stagger;
  const draw = interpolate(frame - start, [0, 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const dot = interpolate(frame - start, [4, 26], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const dotO = interpolate(frame - start, [4, 8, 24, 30], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  if (draw <= 0) return null;
  const [fs, ts] = autoSides(a, b);
  const p0 = anchor(a, fromSide ?? fs);
  const p1 = anchor(b, toSide ?? ts);
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];
  const len = Math.hypot(dx, dy) || 1;
  const n: Pt = [-dy / len, dx / len];
  const mid: Pt = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
  const c: Pt = [mid[0] + n[0] * bend * 2, mid[1] + n[1] * bend * 2];
  const tt = tone(t ?? 'slate');
  const col = t ? tt.main : 'rgba(210,216,240,0.75)';
  // 矢じりの向き（終点の接線）
  const tail = quad(p0, c, p1, 0.94);
  const ang = Math.atan2(p1[1] - tail[1], p1[0] - tail[0]);
  const ah = 16;
  const head = [
    [p1[0], p1[1]],
    [p1[0] - ah * Math.cos(ang - 0.42), p1[1] - ah * Math.sin(ang - 0.42)],
    [p1[0] - ah * Math.cos(ang + 0.42), p1[1] - ah * Math.sin(ang + 0.42)],
  ];
  const dp = quad(p0, c, p1, dot);
  const lp = quad(p0, c, p1, 0.5);
  const d = `M ${p0[0]} ${p0[1]} Q ${c[0]} ${c[1]} ${p1[0]} ${p1[1]}`;
  return (
    <>
      <svg width={1920} height={1080} style={{ position: 'absolute', left: 0, top: 0, opacity: dim, overflow: 'visible' }}>
        <path
          d={d}
          fill="none"
          stroke={col}
          strokeWidth={4}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={dashed ? undefined : 1}
          strokeDashoffset={dashed ? undefined : 1 - draw}
          style={dashed ? { strokeDasharray: '10 10', opacity: draw } : undefined}
        />
        <polygon points={head.map((p) => p.join(',')).join(' ')} fill={col} opacity={draw >= 0.98 ? 1 : 0} />
        <circle cx={dp[0]} cy={dp[1]} r={9} fill={col} opacity={dotO} style={{ filter: `drop-shadow(0 0 10px ${col})` }} />
      </svg>
      {label ? (
        <div
          style={{
            position: 'absolute',
            left: lp[0] + labelDx,
            top: lp[1] + labelDy,
            transform: 'translate(-50%, -50%)',
            opacity: draw * dim,
          }}
        >
          <span
            style={{
              display: 'inline-block',
              padding: '7px 16px',
              borderRadius: 12,
              background: 'rgba(12,16,40,0.92)',
              border: `1.5px solid ${t ? `${tt.main}88` : C.line2}`,
              fontFamily: SANS,
              fontWeight: 700,
              fontSize: 22,
              color: t ? tt.text : C.sub,
              whiteSpace: 'nowrap',
            }}
          >
            <Smart text={label} t={t} />
          </span>
        </div>
      ) : null}
    </>
  );
};

const NodeCard: React.FC<{
  label: string;
  sub?: string;
  icon?: Parameters<typeof IconBadge>[0]['name'];
  t: Tone;
  box: Box;
  at: number;
  mono?: boolean;
  focus: number;
}> = ({ label, sub, icon, t, box, at, mono, focus }) => {
  const p = useAppear(at);
  // 箱の幅に収まるよう、見出しの文字を小さくする
  const avail = box.w - 44 - (icon ? 72 : 0);
  const em = [...label].reduce((w, ch) => w + (mono ? 0.6 : /[\x20-\x7E]/.test(ch) ? 0.58 : 1), 0);
  const labelSize = Math.min(mono ? 28 : 32, Math.floor(avail / Math.max(1, em)));
  return (
    <div
      style={{
        position: 'absolute',
        left: box.x - box.w / 2,
        top: box.y - box.h / 2,
        width: box.w,
        height: box.h,
        opacity: p * (focus < 0 ? 0.42 : 1),
        transform: `translateY(${dropY(p, 18)}px) scale(${focus > 0 ? 1.04 : 1})`,
      }}
    >
      <Glass t={t} active={focus > 0 ? 1 : 0} style={{ width: '100%', height: '100%', padding: '0 22px', display: 'flex', alignItems: 'center', gap: 16, boxSizing: 'border-box' }}>
        {icon ? <IconBadge name={icon} t={t} size={56} glow={focus > 0 ? 0.8 : 0} /> : null}
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontFamily: mono ? MONO : SANS, fontWeight: mono ? 700 : 900, fontSize: labelSize, color: C.ink, whiteSpace: 'nowrap' }}>{label}</div>
          {sub ? (
            <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 21, color: C.sub, lineHeight: 1.35 }}>
              <Smart text={sub} t={t} />
            </div>
          ) : null}
        </div>
      </Glass>
    </div>
  );
};

export const Flow: React.FC<{ s: FlowScene }> = ({ s }) => {
  const f = useFocus(s.focus);
  const boxes = new Map(s.nodes.map((n) => [n.key, { x: n.x, y: n.y, w: n.w ?? 320, h: n.h ?? 118 } as Box]));
  const focusOf = (key: string) => (!f ? 0 : f.keys.includes(key) ? 1 : -1);
  const sameAt = new Map<number, number>();
  return (
    <>
      {s.groups?.map((g, i) => (
        <GroupBox key={i} {...g} />
      ))}
      {s.edges.map((e, i) => {
        const k = sameAt.get(e.at) ?? 0;
        sameAt.set(e.at, k + 1);
        const dim = !f ? 1 : f.keys.includes(e.from) && f.keys.includes(e.to) ? 1 : 0.32;
        return <Edge key={i} a={boxes.get(e.from)!} b={boxes.get(e.to)!} {...e} t={e.tone} dim={dim} stagger={k * 12} />;
      })}
      {s.nodes.map((n) => (
        <NodeCard key={n.key} label={n.label} sub={n.sub} icon={n.icon} t={n.tone} box={boxes.get(n.key)!} at={n.at} mono={n.mono} focus={focusOf(n.key)} />
      ))}
    </>
  );
};

const GroupBox: React.FC<{ label: string; x: number; y: number; w: number; h: number; tone: Tone; at: number }> = ({ label, x, y, w, h, tone: t, at }) => {
  const p = useAppear(at);
  const tt = TONES[t];
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: 30,
        border: `2px dashed ${tt.main}66`,
        background: `${tt.soft}`,
        opacity: p * 0.9,
      }}
    >
      <div style={{ position: 'absolute', left: 22, top: 14, fontFamily: SANS, fontWeight: 700, fontSize: 22, color: tt.text, letterSpacing: 1 }}>{label}</div>
    </div>
  );
};

export const States: React.FC<{ s: StatesScene }> = ({ s }) => {
  const f = useFocus(s.focus);
  const boxes = new Map(
    s.nodes.map((n) => {
      const w = Math.max(250, Math.max(n.code.length * (n.key === 'start' ? 30 : 17.5), n.ja.length * 21) + 64);
      return [n.key, { x: n.x, y: n.y, w, h: 104 } as Box];
    }),
  );
  const isFocus = (key: string) => (!f ? 0 : f.keys.includes(key) ? 1 : -1);
  return (
    <>
      {s.edges.map((e, i) => {
        const dim = !f ? 1 : f.keys.includes(e.to) || f.keys.includes(e.from) ? 1 : 0.35;
        // 矢印は行き先の状態の色にする（使える＝ミント、終わり＝コーラル）
        const target = s.nodes.find((n) => n.key === e.to);
        return <Edge key={i} a={boxes.get(e.from)!} b={boxes.get(e.to)!} {...e} t={target?.tone} dim={dim} />;
      })}
      {s.nodes.map((n) => (
        <StateNode key={n.key} n={n} box={boxes.get(n.key)!} focus={isFocus(n.key)} />
      ))}
    </>
  );
};

const StateNode: React.FC<{ n: StatesScene['nodes'][number]; box: Box; focus: number }> = ({ n, box, focus }) => {
  const p = useAppear(n.at);
  const tt = TONES[n.tone];
  const start = n.key === 'start';
  return (
    <div
      style={{
        position: 'absolute',
        left: box.x - box.w / 2,
        top: box.y - box.h / 2,
        width: box.w,
        height: box.h,
        opacity: p * (focus < 0 ? 0.45 : 1),
        transform: `translateY(${dropY(p, 16)}px) scale(${focus > 0 ? 1.06 : 1})`,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          borderRadius: 999,
          background: start ? 'rgba(255,255,255,0.04)' : `linear-gradient(160deg, ${tt.deep}, rgba(255,255,255,0.03))`,
          border: `2px ${start ? 'dashed' : 'solid'} ${focus > 0 ? tt.main : `${tt.main}88`}`,
          boxShadow: focus > 0 ? `0 0 44px ${tt.main}66` : C.shadow,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        <div style={{ fontFamily: start ? SANS : MONO, fontWeight: start ? 900 : 700, fontSize: start ? 30 : 29, color: C.ink }}>{n.code}</div>
        <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 20, color: tt.text }}>{n.ja}</div>
      </div>
      {n.badge ? (
        <div style={{ position: 'absolute', right: -6, top: -18 }}>
          <Pill t={n.tone} size={19}>
            {n.badge}
          </Pill>
        </div>
      ) : null}
    </div>
  );
};

export const Sequence: React.FC<{ s: SequenceScene }> = ({ s }) => {
  const frame = useCurrentFrame();
  const { lines } = useScene();
  const active = useActiveLine();
  const n = s.actors.length;
  const colW = 1728 / n;
  const xOf = (key: string) => PAD + (s.actors.findIndex((a) => a.key === key) + 0.5) * colW;
  const top = 236;
  const firstY = 418;
  const lastY = 968;
  const gap = Math.min(92, (lastY - firstY) / Math.max(1, s.steps.length - 1));
  const latestAt = s.steps.reduce((m, st) => (st.at <= active ? Math.max(m, st.at) : m), -1);
  const seen = new Map<number, number>();
  return (
    <>
      {s.actors.map((a, i) => (
        <Actor key={a.key} a={a} x={PAD + (i + 0.5) * colW} w={Math.min(400, colW - 44)} top={top} />
      ))}
      <svg width={1920} height={1080} style={{ position: 'absolute', left: 0, top: 0 }}>
        {s.actors.map((a, i) => (
          <line key={a.key} x1={PAD + (i + 0.5) * colW} x2={PAD + (i + 0.5) * colW} y1={top + 128} y2={1004} stroke="rgba(255,255,255,0.16)" strokeWidth={2} strokeDasharray="6 10" />
        ))}
      </svg>
      {s.steps.map((st, i) => {
        const k = seen.get(st.at) ?? 0;
        seen.set(st.at, k + 1);
        const y = firstY + i * gap;
        const start = lineStart(lines, st.at) - 2 + k * 14;
        const draw = interpolate(frame - start, [0, 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        if (draw <= 0) return null;
        const x1 = xOf(st.from);
        const x2 = xOf(st.to);
        const dir = Math.sign(x2 - x1) || 1;
        const xa = x1 + dir * 14;
        const xb = x2 - dir * 14;
        const tt = tone(st.tone ?? 'violet');
        const isLatest = st.at === latestAt;
        const dim = isLatest ? 1 : 0.62;
        const xNow = xa + (xb - xa) * draw;
        const dot = interpolate(frame - start, [4, 24], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        const dotO = interpolate(frame - start, [4, 8, 22, 28], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        return (
          <React.Fragment key={i}>
            <svg width={1920} height={1080} style={{ position: 'absolute', left: 0, top: 0, opacity: dim }}>
              <line x1={xa} y1={y} x2={xNow} y2={y} stroke={tt.main} strokeWidth={isLatest ? 5 : 4} strokeLinecap="round" strokeDasharray={st.dashed ? '12 10' : undefined} />
              {draw > 0.97 ? <polygon points={`${xb},${y} ${xb - dir * 18},${y - 10} ${xb - dir * 18},${y + 10}`} fill={tt.main} /> : null}
              <circle cx={xa + (xb - xa) * dot} cy={y} r={10} fill={tt.main} opacity={dotO} style={{ filter: `drop-shadow(0 0 12px ${tt.main})` }} />
            </svg>
            <div
              style={{
                position: 'absolute',
                left: (x1 + x2) / 2,
                top: y - 30,
                transform: 'translate(-50%, -50%)',
                opacity: draw * dim,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  padding: '6px 18px',
                  borderRadius: 12,
                  background: isLatest ? `${tt.main}26` : 'rgba(12,16,40,0.9)',
                  border: `1.5px solid ${tt.main}${isLatest ? 'cc' : '55'}`,
                  fontFamily: SANS,
                  fontWeight: 700,
                  fontSize: 25,
                  color: isLatest ? C.ink : tt.text,
                  whiteSpace: 'nowrap',
                  boxShadow: isLatest ? `0 0 24px ${tt.main}40` : undefined,
                }}
              >
                <Smart text={st.label} t={st.tone} />
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </>
  );
};

const Actor: React.FC<{ a: SequenceScene['actors'][number]; x: number; w: number; top: number }> = ({ a, x, w, top }) => {
  const p = useAppear(0);
  return (
    <div style={{ position: 'absolute', left: x - w / 2, top, width: w, height: 120, opacity: p, transform: `translateY(${dropY(p)}px)` }}>
      <Glass t={a.tone} active={0.4} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', gap: 18, padding: '0 22px', boxSizing: 'border-box' }}>
        <IconBadge name={a.icon} t={a.tone} size={64} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: a.label.length > 9 ? 27 : 32, color: C.ink, whiteSpace: 'nowrap' }}>{a.label}</div>
          {a.sub ? <div style={{ fontFamily: a.sub.includes('/') ? MONO : SANS, fontWeight: 500, fontSize: 20, color: C.sub, whiteSpace: 'nowrap' }}>{a.sub}</div> : null}
        </div>
      </Glass>
    </div>
  );
};
