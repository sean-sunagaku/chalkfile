// 場面「phone」: スマホの画面の流れ
import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import type { PhoneScene, PhoneScreen } from '../../content/types';
import { Icon, Smart } from '../components/ui';
import { C, CONTENT_BOTTOM, CONTENT_TOP, H, MONO, PAD, SANS, TONES } from '../theme';
import { dropY, lineStart, useAppear, useScene } from '../timing';
import { LEAD } from '../video.config';
import { defineScene } from './define';

const Screen: React.FC<{ sc: PhoneScreen }> = ({ sc }) => {
  const done = sc.kind === 'done';
  return (
    <div style={{ position: 'absolute', inset: 0, background: done ? '#F1FFF8' : '#FFF4F8', padding: '64px 22px 22px', display: 'flex', flexDirection: 'column', fontFamily: SANS }}>
      <div style={{ fontWeight: 900, fontSize: 25, color: '#E2477F', letterSpacing: 1 }}>{sc.brand}</div>
      {sc.brandSub ? <div style={{ fontSize: 17, color: '#9A6B7E', marginTop: 2 }}>{sc.brandSub}</div> : null}
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

const Phone: React.FC<{ s: PhoneScene }> = ({ s }) => {
  const frame = useCurrentFrame();
  const { lines } = useScene();
  const appear = useAppear(0);
  const starts = s.screens.map((sc) => lineStart(lines, sc.at) - LEAD.appear);
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
      <div style={{ position: 'absolute', left: px + pw + 110, right: PAD, top: CONTENT_TOP + 20, bottom: H - CONTENT_BOTTOM, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 26 }}>
        {s.screens.map((x, i) => {
          const on = i === cur;
          const seen = i <= cur;
          const tt = TONES[x.kind === 'done' ? 'mint' : 'pink'];
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

export const phone = defineScene({ kind: 'phone', Component: Phone });
