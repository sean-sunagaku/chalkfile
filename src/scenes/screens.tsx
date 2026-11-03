// 場面「screens」: 画面の比較（改善前・改善後。架空のアプリの画面と、部品の右の番号つきの注）
import React from 'react';
import type { MockBlock, MockScreen, ScreensScene, Tone } from '../../engine/core/schema';
import { DEVICE, MOCK, WINDOW_LIGHTS } from '../components/app-colors';
import { Icon, Pill, Rich } from '../components/ui';
import { alpha, CONTENT_BOTTOM, CONTENT_TOP, PAD, usePalette } from '../theme';
import { dropY, useAppear, useText } from '../timing';
import { TYPE } from '../video.config';
import { defineScene } from './define';

// 架空のアプリの画面（改善前・改善後）。画面の中の色は「そのアプリの色」なので、講座のテーマではなく M（src/components/app-colors.ts の MOCK）で描く。
// 画面の中の文字の大きさは、図ごと拡大する（zoom）前の大きさ（TYPE.mock）
const M = MOCK;
const T = TYPE.mock;

/** 注の番号の丸（中の数は札の大きさ。丸の径は、数の大きさの 1 / 0.52） */
const DOT = TYPE.label.noteDot / 0.52;
/** 画面の部品に重ねる注の番号の丸（画面の図の中なので、図ごと拡大される） */
const BLOCK_DOT = 34;

type Variant = 'primary' | 'secondary' | 'link' | 'danger';

const Btn: React.FC<{ text: string; variant: Variant; weak?: boolean; flex?: boolean }> = ({ text, variant, weak, flex }) => {
  if (variant === 'link') {
    return <div style={{ fontSize: weak ? T.linkWeak : T.link, color: weak ? M.weak : M.primary, textDecoration: 'underline', fontWeight: 600, alignSelf: 'center', padding: '0 6px' }}>{text}</div>;
  }
  const base: React.CSSProperties = { height: 52, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: T.button, fontWeight: 800, padding: '0 12px', flex: flex ? 1 : undefined, whiteSpace: 'nowrap' };
  if (variant === 'secondary') return <div style={{ ...base, border: `1.5px solid ${weak ? M.weakLine : M.field}`, color: weak ? M.weak : M.ink, background: M.bg }}>{text}</div>;
  if (variant === 'danger') return <div style={{ ...base, background: M.danger, color: M.onPrimary }}>{text}</div>;
  return <div style={{ ...base, background: weak ? M.primaryWeak : M.primary, color: M.onPrimary }}>{text}</div>;
};

const Block: React.FC<{ b: MockBlock }> = ({ b }) => {
  const required = useText().required;
  switch (b.type) {
    case 'title':
      return <div style={{ fontSize: T.title, fontWeight: 900, color: b.weak ? M.weak : M.ink, lineHeight: 1.3 }}>{b.text}</div>;
    case 'text':
      return <div style={{ fontSize: b.small ? T.textSmall : T.text, color: b.weak ? M.weak : M.sub, lineHeight: 1.5 }}>{b.text}</div>;
    case 'field':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {b.label ? (
            <div style={{ fontSize: T.label, fontWeight: 700, color: b.weak ? M.weak : M.ink }}>
              {b.label}
              {b.required ? <span style={{ marginLeft: 8, fontSize: T.required, color: M.danger, fontWeight: 800 }}>{required}</span> : null}
            </div>
          ) : null}
          <div
            style={{
              height: 48,
              borderRadius: 10,
              border: `${b.error ? 2.5 : 1.5}px solid ${b.error ? M.danger : b.weak ? M.weakLine : M.field}`,
              display: 'flex',
              alignItems: 'center',
              padding: '0 14px',
              fontSize: T.field,
              color: b.value ? M.ink : b.weak ? M.weak : M.muted,
              background: M.bg,
            }}
          >
            {b.value ?? b.placeholder ?? ''}
          </div>
          {b.error ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: T.error, fontWeight: 700, color: M.alert.error.fg }}>
              <Icon name="alert" size={18} color={M.alert.error.fg} stroke={2.6} />
              {b.error}
            </div>
          ) : null}
          {b.hint ? <div style={{ fontSize: T.hint, color: M.sub }}>{b.hint}</div> : null}
        </div>
      );
    case 'button':
      return <Btn text={b.text} variant={b.variant} weak={b.weak} />;
    case 'buttons':
      return (
        <div style={{ display: 'flex', gap: 12 }}>
          {b.items.map((x, i) => (
            <Btn key={i} text={x.text} variant={x.variant} weak={x.weak} flex={x.variant !== 'link'} />
          ))}
        </div>
      );
    case 'alert': {
      const a = M.alert[b.tone];
      return (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: a.bg, color: a.fg, borderRadius: 10, padding: '11px 14px', fontSize: T.alert, fontWeight: 700, lineHeight: 1.45 }}>
          <div style={{ paddingTop: 2 }}>
            <Icon name={a.icon} size={20} color={a.fg} stroke={2.6} />
          </div>
          {b.text}
        </div>
      );
    }
    case 'toggle':
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: T.label, fontWeight: 700, color: M.ink }}>{b.label}</div>
            {b.sub ? <div style={{ fontSize: T.sub, color: M.sub, marginTop: 2 }}>{b.sub}</div> : null}
          </div>
          <div style={{ width: 54, height: 30, borderRadius: 99, background: b.on ? M.primary : M.field, position: 'relative', flexShrink: 0 }}>
            <div style={{ position: 'absolute', top: 3, left: b.on ? 27 : 3, width: 24, height: 24, borderRadius: 99, background: M.onPrimary }} />
          </div>
        </div>
      );
    case 'check':
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              border: `2px solid ${b.checked ? M.primary : M.field}`,
              background: b.checked ? M.primary : M.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {b.checked ? <Icon name="check" size={16} color={M.onPrimary} stroke={3.2} /> : null}
          </div>
          <div style={{ fontSize: b.weak ? T.checkWeak : T.check, color: b.weak ? M.weak : M.ink, lineHeight: 1.4 }}>{b.label}</div>
        </div>
      );
    case 'steps':
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {b.items.map((x, i) => {
            const done = i < b.current;
            const on = i === b.current;
            return (
              <React.Fragment key={i}>
                {i ? <div style={{ flex: 1, height: 2, background: done || on ? M.primary : M.field }} /> : null}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 99,
                      background: done || on ? M.primary : M.bg,
                      border: `2px solid ${done || on ? M.primary : M.field}`,
                      color: done || on ? M.onPrimary : M.sub,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: T.stepNo,
                      fontWeight: 800,
                    }}
                  >
                    {done ? <Icon name="check" size={15} color={M.onPrimary} stroke={3.2} /> : i + 1}
                  </div>
                  <div style={{ fontSize: T.step, fontWeight: on ? 800 : 600, color: on ? M.ink : M.sub, whiteSpace: 'nowrap' }}>{x}</div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      );
    case 'list':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {b.items.map((x, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, fontSize: b.weak ? T.listWeak : T.list, color: b.weak ? M.weak : M.sub, lineHeight: 1.45 }}>
              <div style={{ width: 6, height: 6, borderRadius: 9, background: b.weak ? M.weak : M.primary, marginTop: 10, flexShrink: 0 }} />
              {x}
            </div>
          ))}
        </div>
      );
    case 'badge':
      return <div style={{ alignSelf: 'flex-start', fontSize: T.badge, fontWeight: 800, color: M.badge.fg, background: M.badge.bg, borderRadius: 99, padding: '3px 12px' }}>{b.text}</div>;
    case 'divider':
      return <div style={{ height: 1, background: M.weakLine }} />;
    case 'spacer':
      return b.h > 0 ? <div style={{ height: b.h }} /> : null;
  }
};

/** 注の番号の丸。size は丸の径（中の数は径の 0.52） */
const NoteDot: React.FC<{ n: number; t: Tone; p: number; size: number }> = ({ n, t, p, size }) => {
  const { SANS, tone } = usePalette();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 99,
        background: tone(t).main,
        color: tone(t).on,
        fontFamily: SANS,
        fontWeight: 900,
        fontSize: size * 0.52,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        opacity: p,
        transform: `scale(${0.6 + 0.4 * p})`,
        boxShadow: `0 0 0 4px ${alpha(tone(t).main, 0.22)}`,
      }}
    >
      {n}
    </div>
  );
};

/** 画面 1 枚（窓の枠・部品・部品の右の番号） */
const Frame: React.FC<{ sc: MockScreen; device: 'browser' | 'phone'; w: number; h: number; zoom?: number }> = ({ sc, device, w, h, zoom = 1 }) => {
  const { C, SANS } = usePalette();
  const phone = device === 'phone';
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: phone ? 44 : 16,
        background: phone ? DEVICE.mock.body : M.bg,
        border: phone ? `2px solid ${DEVICE.mock.rim}` : `1.5px solid ${C.line2}`,
        boxShadow: C.shadow,
        padding: phone ? 12 : 0,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div style={{ position: 'absolute', inset: phone ? 12 : 0, borderRadius: phone ? 34 : 15, background: M.bg, overflow: 'hidden', fontFamily: SANS }}>
        <div style={{ width: `${100 / zoom}%`, height: `${100 / zoom}%`, transform: `scale(${zoom})`, transformOrigin: '0 0', display: 'flex', flexDirection: 'column' }}>
        {phone ? (
          <div style={{ height: 46, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 6, fontSize: T.phoneBar, fontWeight: 800, color: M.sub }}>{sc.title ?? ''}</div>
        ) : (
          <div style={{ height: 42, background: M.bar, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', flexShrink: 0 }}>
            {WINDOW_LIGHTS.browser.map((c) => (
              <div key={c} style={{ width: 12, height: 12, borderRadius: 99, background: c }} />
            ))}
            <div style={{ marginLeft: 14, flex: 1, height: 26, borderRadius: 8, background: M.bg, display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: T.browserBar, color: M.sub, fontWeight: 600 }}>{sc.title ?? ''}</div>
          </div>
        )}
        <div style={{ flex: 1, padding: phone ? '14px 24px 22px' : '24px 40px 24px 32px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {sc.blocks.map((b, i) => (
            <BlockWithNote key={i} b={b} notes={(sc.notes ?? []).filter((x) => x.block === i)} t={sc.tone} />
          ))}
        </div>
        </div>
      </div>
    </div>
  );
};

const BlockWithNote: React.FC<{ b: MockBlock; notes: NonNullable<MockScreen['notes']>; t: Tone }> = ({ b, notes, t }) => (
  <div style={{ position: 'relative', ...(b.type === 'spacer' && b.h <= 0 ? { flex: 1 } : {}) }}>
    <Block b={b} />
    {notes.map((n, k) => (
      <NoteOnBlock key={n.n} n={n} t={t} k={notes.length - 1 - k} />
    ))}
  </div>
);

const NoteOnBlock: React.FC<{ n: NonNullable<MockScreen['notes']>[number]; t: Tone; k: number }> = ({ n, t, k }) => {
  const { tone } = usePalette();
  const p = useAppear(n.at);
  return (
    <>
      {/* 部品を囲む枠と、右上の番号 */}
      <div style={{ position: 'absolute', inset: -6, borderRadius: 12, border: `3px solid ${alpha(tone(n.tone ?? t).main, 0.85 * p)}`, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', right: -26 + k * 42, top: -18 }}>
        <NoteDot n={n.n} t={n.tone ?? t} p={p} size={BLOCK_DOT} />
      </div>
    </>
  );
};

const NoteList: React.FC<{ sc: MockScreen; size: number }> = ({ sc, size }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: size * 0.42 }}>
    {(sc.notes ?? []).map((n) => (
      <NoteRow key={n.n} n={n} t={sc.tone} size={size} />
    ))}
  </div>
);

const NoteRow: React.FC<{ n: NonNullable<MockScreen['notes']>[number]; t: Tone; size: number }> = ({ n, t, size }) => {
  const { C, SANS } = usePalette();
  const p = useAppear(n.at);
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', opacity: p, transform: `translateY(${dropY(p, 12)}px)` }}>
      <NoteDot n={n.n} t={n.tone ?? t} p={1} size={DOT} />
      <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: size, lineHeight: 1.4, color: C.ink, paddingTop: size * 0.06 }}>
        <Rich text={n.text} t={n.tone ?? t} />
      </div>
    </div>
  );
};

const Labeled: React.FC<{ sc: MockScreen; children: React.ReactNode; style?: React.CSSProperties }> = ({ sc, children, style }) => {
  const p = useAppear(sc.at);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, opacity: p, transform: `translateY(${dropY(p)}px)`, ...style }}>
      <div>
        <Pill t={sc.tone} size={TYPE.label.pillScreen}>
          {sc.label}
        </Pill>
      </div>
      {children}
    </div>
  );
};

const Screens: React.FC<{ s: ScreensScene }> = ({ s }) => {
  const device = s.device ?? 'browser';
  const top = CONTENT_TOP + 4;
  const height = CONTENT_BOTTOM - top;
  if (!s.right) {
    // 1 枚: 左に画面、右に注の一覧
    const w = device === 'phone' ? 470 : 1000;
    return (
      <div style={{ position: 'absolute', left: PAD, right: PAD, top, height, display: 'flex', gap: 70, alignItems: 'flex-start' }}>
        <Labeled sc={s.left}>
          <Frame sc={s.left} device={device} w={w} h={height - 66} zoom={s.zoom ?? (device === 'phone' ? 1.3 : 1.15)} />
        </Labeled>
        <div style={{ flex: 1, paddingTop: 80 }}>
          <NoteList sc={s.left} size={TYPE.body.screenNote} />
        </div>
      </div>
    );
  }
  if (device === 'phone') {
    // スマホ 2 台: [画面][注] [画面][注]。中身は 1.3 倍で描く
    const w = 420;
    return (
      <div style={{ position: 'absolute', left: PAD, right: PAD, top, height, display: 'flex', gap: 40 }}>
        {[s.left, s.right].map((sc, i) => (
          <Labeled key={i} sc={sc} style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 34 }}>
              <Frame sc={sc} device="phone" w={w} h={height - 66} zoom={s.zoom ?? 1.3} />
              <div style={{ flex: 1, paddingTop: 30 }}>
                <NoteList sc={sc} size={TYPE.body.screenNotePhones} />
              </div>
            </div>
          </Labeled>
        ))}
      </div>
    );
  }
  // ブラウザ 2 枚: 横に並べ、注は下に
  const w = 820;
  const fh = 540;
  return (
    <div style={{ position: 'absolute', left: PAD, right: PAD, top, height, display: 'flex', gap: 88 }}>
      {[s.left, s.right].map((sc, i) => (
        <Labeled key={i} sc={sc} style={{ width: w }}>
          <Frame sc={sc} device="browser" w={w} h={fh} zoom={s.zoom ?? 1.1} />
          <div style={{ paddingTop: 6 }}>
            <NoteList sc={sc} size={TYPE.body.screenNoteBrowsers} />
          </div>
        </Labeled>
      ))}
    </div>
  );
};

export const screens = defineScene({ kind: 'screens', Component: Screens });
