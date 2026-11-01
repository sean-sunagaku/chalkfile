import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { BigScene, ConceptsScene, EndingScene, GoalsScene, OpeningScene, PointsScene, RecapScene, RefsScene } from '../../content/types';
import { courseOf } from '../../content';
import { CourseMark, unitOf } from '../components/chrome';
import { Glass, Icon, IconBadge, Pill, Rich, Smart } from '../components/ui';
import credits from '../generated/credits.json';
import lectureCredits from '../generated/lecture-credits.json';
import { alpha, C, CONTENT_BOTTOM, CONTENT_TOP, DISPLAY, GRAD, MESH, MONO, PAD, SANS, THEME, TONES, tone } from '../theme';
import { dropY, useActiveLine, useAppear, useScene } from '../timing';

/** ジングルの「ドン」が鳴るフレーム（sting_intro の 2.0 秒。synth.ts の OPENING_LEAD_IN と合わせる） */
export const HIT_FRAME = 60;

const textWidth = (s: string, size: number) => [...s].reduce((w, ch) => w + (/[\x20-\x7E]/.test(ch) ? 0.58 : 1) * size, 0);
const fitSize = (s: string, max: number, width: number) => Math.min(max, Math.floor((max * width) / Math.max(1, textWidth(s, max))));

const Content: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div
    style={{
      position: 'absolute',
      left: PAD,
      right: PAD,
      top: CONTENT_TOP,
      bottom: 1080 - CONTENT_BOTTOM,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      ...style,
    }}
  >
    {children}
  </div>
);

export const Opening: React.FC<{ s: OpeningScene }> = ({ s }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { lecture } = useScene();
  const hit = spring({ frame: frame - HIT_FRAME, fps, config: { damping: 14, mass: 0.7 }, durationInFrames: 40 });
  const soft = spring({ frame: frame - HIT_FRAME, fps, config: { damping: 200 }, durationInFrames: 26 });
  const early = interpolate(frame, [4, 28], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const sweep = interpolate(frame, [HIT_FRAME - 30, HIT_FRAME + 8], [-0.3, 1.3], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const ring = (k: number) => {
    const f = frame - HIT_FRAME - k * 6;
    return { s: interpolate(f, [0, 50], [0.6, 1.7], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }), o: interpolate(f, [0, 8, 50], [0, 0.55, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) };
  };
  const titleLines = s.title.split('　');
  const sub2 = spring({ frame: frame - HIT_FRAME - 12, fps, config: { damping: 200 }, durationInFrames: 24 });
  const no = String(lecture.no).padStart(2, '0');
  const course = courseOf(lecture.id);
  const { label: unit, total } = unitOf(lecture.id);
  return (
    <>
      <div style={{ position: 'absolute', left: PAD, top: 64, opacity: early }}>
        <CourseMark scale={1.15} />
      </div>
      {/* 光の帯 */}
      <div
        style={{
          position: 'absolute',
          top: -200,
          bottom: -200,
          width: 220,
          left: `${sweep * 100}%`,
          transform: 'rotate(18deg)',
          background: `linear-gradient(90deg, transparent, ${C.sheen}, transparent)`,
          filter: 'blur(8px)',
        }}
      />
      <div style={{ position: 'absolute', left: PAD + 20, top: 250, width: 520, height: 520, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {[0, 1, 2].map((k) => {
          const r = ring(k);
          return (
            <div
              key={k}
              style={{
                position: 'absolute',
                width: 420,
                height: 420,
                borderRadius: 999,
                border: `3px solid ${MESH[k % MESH.length]}`,
                transform: `scale(${r.s})`,
                opacity: r.o,
              }}
            />
          );
        })}
        <div
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: 330,
            lineHeight: 1,
            letterSpacing: -10,
            background: DISPLAY,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            transform: `scale(${0.7 + 0.3 * hit})`,
            opacity: soft,
            filter: `blur(${(1 - soft) * 14}px)${THEME.scheme === 'dark' ? ` drop-shadow(0 0 40px ${alpha(C.accent, 0.45)})` : ''}`,
          }}
        >
          {no}
        </div>
      </div>
      <div style={{ position: 'absolute', left: 660, right: PAD, top: 250, height: 520, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 22 }}>
        <div style={{ opacity: early, transform: `translateY(${dropY(early)}px)` }}>
          <Pill t="violet" size={26}>
            {s.section}
          </Pill>
        </div>
        <div style={{ opacity: soft, transform: `translateX(${(1 - soft) * -40}px)` }}>
          {titleLines.map((ln, i) => (
            <div
              key={i}
              style={{
                fontFamily: SANS,
                fontWeight: 900,
                fontSize: fitSize(ln, i === 0 && titleLines.length > 1 ? 104 : 96, 1160),
                lineHeight: 1.18,
                color: C.ink,
                whiteSpace: 'nowrap',
                ...(i === 0 && titleLines.length > 1
                  ? { background: DISPLAY, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }
                  : {}),
              }}
            >
              {ln}
            </div>
          ))}
        </div>
        <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 36, color: C.sub, opacity: sub2, transform: `translateY(${dropY(sub2, 14)}px)` }}>
          <Smart text={s.subtitle} />
        </div>
      </div>
      <div style={{ position: 'absolute', left: PAD, right: PAD, bottom: 70, display: 'flex', alignItems: 'center', gap: 14, opacity: early }}>
        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 22, color: C.muted, letterSpacing: 4, marginRight: 10 }}>
          {unit} {no} / {total}
        </div>
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            style={{
              width: i + 1 === lecture.no ? 46 : 14,
              height: 14,
              borderRadius: 99,
              background: i + 1 === lecture.no ? GRAD : i + 1 < lecture.no ? C.trackDone : C.track,
            }}
          />
        ))}
        {course.disclaimer ? <div style={{ marginLeft: 'auto', fontFamily: SANS, fontWeight: 500, fontSize: 21, color: C.muted }}>{course.disclaimer}</div> : null}
      </div>
    </>
  );
};

const GoalRow: React.FC<{ text: string; at: number; index: number; active: boolean }> = ({ text, at, index, active }) => {
  const p = useAppear(at);
  const draw = useAppear(at, 6, 24);
  return (
    <div style={{ opacity: p, transform: `translateY(${dropY(p)}px)` }}>
      <Glass t="mint" active={active ? 1 : 0} style={{ padding: '38px 48px', display: 'flex', alignItems: 'center', gap: 36 }}>
        <svg width={80} height={80} viewBox="0 0 72 72" style={{ flexShrink: 0 }}>
          <circle cx={36} cy={36} r={32} fill={TONES.mint.soft} stroke={TONES.mint.main} strokeWidth={3} opacity={0.9} />
          <path d="M22 37 L32 47 L51 26" fill="none" stroke={TONES.mint.main} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={50} strokeDashoffset={50 * (1 - draw)} />
        </svg>
        <div style={{ fontFamily: MONO, fontSize: 24, fontWeight: 700, color: C.muted, letterSpacing: 3, width: 96 }}>
          {String(index + 1).padStart(2, '0')}
        </div>
        <div style={{ fontFamily: SANS, fontSize: 50, fontWeight: 700, color: C.ink, lineHeight: 1.3 }}>
          <Smart text={text} t="mint" />
        </div>
      </Glass>
    </div>
  );
};

export const Goals: React.FC<{ s: GoalsScene }> = ({ s }) => {
  const active = useActiveLine();
  const current = s.items.reduce((acc, it, i) => (it.at <= active ? i : acc), -1);
  const gap = s.items.length > 3 ? 20 : 30;
  return (
    <Content style={{ gap }}>
      {s.items.map((it, i) => (
        <GoalRow key={i} text={it.text} at={it.at} index={i} active={i === current} />
      ))}
    </Content>
  );
};

const PointCard: React.FC<{ item: PointsScene['items'][number]; index: number; numbered?: boolean; active: boolean; tall: boolean }> = ({ item, index, numbered, active, tall }) => {
  const p = useAppear(item.at);
  const tt = tone(item.tone);
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', opacity: p, transform: `translateY(${dropY(p)}px) scale(${active ? 1.015 : 1})` }}>
      <Glass t={item.tone} active={active ? 1 : 0} style={{ flex: 1, padding: tall ? '44px 42px' : '32px 36px', display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {item.icon ? <IconBadge name={item.icon} t={item.tone} size={tall ? 84 : 70} glow={active ? 0.8 : 0} /> : <div />}
          {numbered ? (
            <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: tall ? 64 : 52, color: tt.main, opacity: 0.85 }}>{String(index + 1).padStart(2, '0')}</div>
          ) : null}
        </div>
        <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: tall ? 42 : 36, lineHeight: 1.3, color: C.ink }}>
          <Smart text={item.title} t={item.tone} />
        </div>
        {item.body ? (
          <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: tall ? 29 : 26, lineHeight: 1.55, color: C.sub }}>
            <Smart text={item.body} t={item.tone} />
          </div>
        ) : null}
      </Glass>
    </div>
  );
};

export const Points: React.FC<{ s: PointsScene }> = ({ s }) => {
  const active = useActiveLine();
  const cols = s.columns ?? Math.min(3, s.items.length);
  const rows: PointsScene['items'][] = [];
  for (let i = 0; i < s.items.length; i += cols) rows.push(s.items.slice(i, i + cols));
  const current = s.items.reduce((acc, it, i) => (it.at <= active ? i : acc), -1);
  const tall = rows.length === 1;
  return (
    <Content style={{ gap: 32, justifyContent: 'center' }}>
      {rows.map((row, r) => (
        <div key={r} style={{ display: 'flex', gap: 32, alignItems: 'stretch', minHeight: tall ? 470 : 0 }}>
          {row.map((it, c) => {
            const idx = r * cols + c;
            return <PointCard key={idx} item={it} index={idx} numbered={s.numbered} active={idx === current} tall={tall} />;
          })}
          {row.length < cols && rows.length > 1
            ? Array.from({ length: cols - row.length }, (_, k) => <div key={`pad${k}`} style={{ flex: 1 }} />)
            : null}
        </div>
      ))}
    </Content>
  );
};

const ConceptCardView: React.FC<{ card: ConceptsScene['cards'][number]; active: boolean; dim: boolean }> = ({ card, active, dim }) => {
  const p = useAppear(card.at);
  const tt = tone(card.tone);
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', opacity: p * (dim ? 0.5 : 1), transform: `translateY(${dropY(p)}px) scale(${active ? 1.03 : 1})` }}>
      <Glass t={card.tone} active={active ? 1 : 0} style={{ flex: 1, padding: '30px 30px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <IconBadge name={card.icon} t={card.tone} size={66} glow={active ? 0.9 : 0} />
          {card.idPrefix ? (
            <Pill t={card.tone} mono size={22}>
              {card.idPrefix}
            </Pill>
          ) : null}
        </div>
        <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: card.en.length > 12 ? 31 : 36, color: C.ink, lineHeight: 1.15, marginTop: 6 }}>{card.en}</div>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 25, color: tt.text }}>{card.ja}</div>
        <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 23, color: C.sub, lineHeight: 1.5 }}>{card.desc}</div>
      </Glass>
    </div>
  );
};

export const Concepts: React.FC<{ s: ConceptsScene }> = ({ s }) => {
  const active = useActiveLine();
  const cols = s.columns ?? 4;
  const rows: ConceptsScene['cards'][] = [];
  for (let i = 0; i < s.cards.length; i += cols) rows.push(s.cards.slice(i, i + cols));
  const current = s.cards.reduce((acc, c, i) => (c.at <= active ? i : acc), -1);
  return (
    <Content style={{ gap: 28 }}>
      {rows.map((row, r) => (
        <div key={r} style={{ display: 'flex', gap: 28, alignItems: 'stretch', minHeight: 330 }}>
          {row.map((c, k) => {
            const idx = r * cols + k;
            return <ConceptCardView key={c.key} card={c} active={idx === current} dim={false} />;
          })}
          {row.length < cols ? Array.from({ length: cols - row.length }, (_, k) => <div key={`p${k}`} style={{ flex: 1 }} />) : null}
        </div>
      ))}
    </Content>
  );
};

export const Big: React.FC<{ s: BigScene }> = ({ s }) => {
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
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 32, color: tt.text, opacity: k, transform: `translateY(${dropY(k, 14)}px)`, maxWidth: 1500 }}>
          <Smart text={s.kicker} t={s.tone} />
        </div>
      ) : null}
      <div
        style={{
          fontFamily: SANS,
          fontWeight: 900,
          fontSize: textWidth(s.text.replace(/\*\*/g, ''), 88) > 3000 ? 70 : 88,
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
        <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 36, color: C.sub, maxWidth: 1500, lineHeight: 1.5, opacity: sub, transform: `translateY(${dropY(sub, 14)}px)` }}>
          <Smart text={s.sub} t={s.tone} />
        </div>
      ) : null}
    </Content>
  );
};

const RecapRow: React.FC<{ text: string; at: number; i: number; active: boolean }> = ({ text, at, i, active }) => {
  const p = useAppear(at);
  return (
    <div style={{ opacity: p, transform: `translateY(${dropY(p)}px)` }}>
      <Glass active={active ? 1 : 0} t="violet" style={{ padding: '30px 40px', display: 'flex', alignItems: 'center', gap: 34 }}>
        <div
          style={{
            width: 76,
            height: 76,
            borderRadius: 999,
            background: GRAD,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: MONO,
            fontWeight: 700,
            fontSize: 34,
            color: C.onAccent,
            flexShrink: 0,
            boxShadow: active ? (THEME.scheme === 'dark' ? `0 0 30px ${alpha(C.accent, 0.7)}` : `0 10px 22px -8px ${alpha(C.accent, 0.7)}`) : undefined,
          }}
        >
          {i + 1}
        </div>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 44, color: C.ink, lineHeight: 1.35 }}>
          <Smart text={text} t="violet" />
        </div>
      </Glass>
    </div>
  );
};

export const Recap: React.FC<{ s: RecapScene }> = ({ s }) => {
  const active = useActiveLine();
  const current = s.items.reduce((acc, it, i) => (it.at <= active ? i : acc), -1);
  return (
    <Content style={{ gap: s.items.length > 3 ? 22 : 32 }}>
      {s.items.map((it, i) => (
        <RecapRow key={i} text={it.text} at={it.at} i={i} active={i === current} />
      ))}
    </Content>
  );
};

const RefCard: React.FC<{ r: RefsScene['refs'][number]; i: number }> = ({ r, i }) => {
  const p = useAppear(r.at, i * 8);
  return (
    <div style={{ flex: 1, display: 'flex', opacity: p, transform: `translateY(${dropY(p)}px)` }}>
      <Glass t="cyan" style={{ flex: 1, padding: '44px 46px', display: 'flex', flexDirection: 'column', gap: 22 }}>
        <IconBadge name={i === 0 ? 'file' : 'book'} t={i === 0 ? 'violet' : 'cyan'} size={84} />
        <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: 44, color: C.ink }}>{r.title}</div>
        <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: 25, color: TONES.cyan.text, lineHeight: 1.45, wordBreak: 'break-all' }}>{r.url}</div>
        <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 30, color: C.sub }}>{r.note}</div>
      </Glass>
    </div>
  );
};

export const Refs: React.FC<{ s: RefsScene }> = ({ s }) => (
  <Content>
    <div style={{ display: 'flex', gap: 36, minHeight: 470 }}>
      {s.refs.map((r, i) => (
        <RefCard key={i} r={r} i={i} />
      ))}
    </div>
  </Content>
);

export const Ending: React.FC<{ s: EndingScene }> = ({ s }) => {
  const { lecture } = useScene();
  const course = courseOf(lecture.id);
  const { label: unit, total } = unitOf(lecture.id);
  const p = useAppear(0);
  const q = useAppear(0, 14);
  const c = useAppear(0, 26);
  return (
    <Content style={{ alignItems: 'center', gap: 40, top: 150 }}>
      {s.next ? (
        <>
          <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 28, letterSpacing: 8, color: C.muted, opacity: p }}>NEXT {unit}</div>
          <div style={{ opacity: q, transform: `translateY(${dropY(q)}px)` }}>
            <Glass t="violet" active={1} style={{ padding: '44px 64px', display: 'flex', alignItems: 'center', gap: 44 }}>
              <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: 120, lineHeight: 1, background: DISPLAY, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
                {String(s.next.no).padStart(2, '0')}
              </div>
              <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: fitSize(s.next.title, 64, 1180), color: C.ink, whiteSpace: 'nowrap' }}>{s.next.title}</div>
              <Icon name="route" size={56} color={TONES.violet.main} />
            </Glass>
          </div>
        </>
      ) : (
        <>
          <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: 110, opacity: p, background: DISPLAY, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
            おつかれさまでした
          </div>
          {s.closing ? <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 42, color: C.sub, opacity: q }}>{s.closing}</div> : null}
        </>
      )}
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', opacity: c }}>
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            style={{
              width: i + 1 === lecture.no ? 46 : 16,
              height: 16,
              borderRadius: 99,
              background: i + 1 <= lecture.no ? GRAD : C.track,
              opacity: i + 1 < lecture.no ? 0.6 : 1,
            }}
          />
        ))}
        <div style={{ fontFamily: MONO, fontSize: 24, color: C.muted, marginLeft: 12 }}>{lecture.no} / {total} 完了</div>
      </div>
      <div style={{ position: 'absolute', bottom: 0, fontFamily: SANS, fontSize: 22, color: C.muted, opacity: c, textAlign: 'center', lineHeight: 1.7 }}>
        {course.disclaimer ? <div>{course.disclaimer}</div> : null}
        <div>ナレーション　{((lectureCredits as Record<string, string[]>)[lecture.id] ?? (credits as string[])).join('　')}　／　BGM・効果音　オリジナル（プログラムで合成）</div>
      </div>
    </Content>
  );
};
