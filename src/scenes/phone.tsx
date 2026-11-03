// 場面「phone」: スマホの画面の流れ
import React from 'react';
import { useCurrentFrame } from 'remotion';
import type { PhoneScene, PhoneScreen } from '../../content/types';
import { DEVICE, PHONE_APP } from '../components/app-colors';
import { Icon, Smart } from '../components/ui';
import { CONTENT_BOTTOM, CONTENT_TOP, H, PAD, usePalette } from '../theme';
import { dropY, lineStart, ramp, useAppear, useScene } from '../timing';
import { LEAD } from '../video.config';
import { defineScene } from './define';

/** 架空のアプリの色（講座のテーマではなく、そのアプリの色。src/components/app-colors.ts） */
const A = PHONE_APP;

const Screen: React.FC<{ sc: PhoneScreen }> = ({ sc }) => {
  const { MONO, SANS } = usePalette();
  const done = sc.kind === 'done';
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: A.bg[sc.kind],
        padding: '64px 22px 22px',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: SANS,
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 25, color: A.brand, letterSpacing: 1 }}>{sc.brand}</div>
      {sc.brandSub ? <div style={{ fontSize: 17, color: A.brandSub, marginTop: 2 }}>{sc.brandSub}</div> : null}
      <div
        style={{
          marginTop: 22,
          borderRadius: 22,
          background: A.card,
          boxShadow: A.cardShadow,
          padding: '24px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          flex: 1,
        }}
      >
        {done ? (
          <div
            style={{
              alignSelf: 'center',
              width: 76,
              height: 76,
              borderRadius: 99,
              background: A.check.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="check" size={44} color={A.check.fg} stroke={3} />
          </div>
        ) : null}
        <div
          style={{
            fontSize: 29,
            fontWeight: 900,
            color: A.ink,
            lineHeight: 1.3,
            textAlign: done ? 'center' : 'left',
          }}
        >
          {sc.title}
        </div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: A.lead[sc.kind],
            fontFamily: sc.lead?.startsWith('?') ? MONO : SANS,
            textAlign: done ? 'center' : 'left',
            wordBreak: 'break-all',
          }}
        >
          {sc.lead}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 6 }}>
          {sc.body.map((b, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                fontSize: 20,
                color: A.body,
                lineHeight: 1.45,
              }}
            >
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 9,
                  background: A.lead[sc.kind],
                  marginTop: 10,
                  flexShrink: 0,
                }}
              />
              {b}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sc.primary ? (
            <div
              style={{
                height: 62,
                borderRadius: 999,
                background: A.primary[sc.kind],
                color: A.onPrimary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: 21,
              }}
            >
              {sc.primary}
            </div>
          ) : null}
          {sc.secondary ? (
            <div style={{ textAlign: 'center', fontSize: 20, color: A.secondary, fontWeight: 700 }}>{sc.secondary}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const Phone: React.FC<{ s: PhoneScene }> = ({ s }) => {
  const { C, MONO, SANS, TONES } = usePalette();
  const frame = useCurrentFrame();
  const { lines } = useScene();
  const appear = useAppear(0);
  const starts = s.screens.map((sc) => lineStart(lines, sc.at) - LEAD.appear);
  let cur = -1;
  starts.forEach((st, i) => {
    if (frame >= st) cur = i;
  });
  const enter = cur >= 0 ? ramp(frame - starts[cur], 0, 14) : 0;
  const pw = 450;
  const ph = 772;
  const px = PAD + 120;
  const py = CONTENT_TOP + 2;
  const sc = cur >= 0 ? s.screens[cur] : null;
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: px,
          top: py,
          width: pw,
          height: ph,
          opacity: appear,
          transform: `translateY(${dropY(appear)}px)`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 56,
            background: DEVICE.phone.body,
            border: `2px solid ${DEVICE.phone.rim}`,
            boxShadow: `${C.shadow}, 0 0 60px ${DEVICE.phone.glow}`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 14,
            top: 14,
            right: 14,
            bottom: 14,
            borderRadius: 44,
            overflow: 'hidden',
            background: DEVICE.phone.screen,
          }}
        >
          {sc ? (
            <div
              style={{ position: 'absolute', inset: 0, transform: `translateX(${(1 - enter) * 60}px)`, opacity: enter }}
            >
              <Screen sc={sc} />
            </div>
          ) : null}
          <div
            style={{
              position: 'absolute',
              top: 12,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 110,
              height: 30,
              borderRadius: 99,
              background: DEVICE.phone.notch,
            }}
          />
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: px + pw + 110,
          right: PAD,
          top: CONTENT_TOP + 20,
          bottom: H - CONTENT_BOTTOM,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 26,
        }}
      >
        {s.screens.map((x, i) => {
          const on = i === cur;
          const seen = i <= cur;
          const tt = TONES[x.kind === 'done' ? 'mint' : 'pink'];
          return (
            <div
              key={i}
              style={{ display: 'flex', gap: 24, alignItems: 'flex-start', opacity: seen ? (on ? 1 : 0.5) : 0.18 }}
            >
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
                  <div
                    style={{
                      fontFamily: SANS,
                      fontWeight: 500,
                      fontSize: 28,
                      color: C.sub,
                      lineHeight: 1.5,
                      opacity: enter,
                    }}
                  >
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
