// 場面「phone」: スマホの画面の流れ
import type React from 'react';
import { useCurrentFrame } from 'remotion';
import type { PhoneScene, PhoneScreen } from '../../engine/core/schema';
import { DEVICE, PHONE_APP } from '../components/app-colors';
import { DeviceFrame } from '../components/frame';
import { Icon, Smart } from '../components/ui';
import { CONTENT_BOTTOM, CONTENT_TOP, H, PAD, usePalette } from '../theme';
import { dropY, lineStart, ramp, useAppear, useScene } from '../timing';
import { LEAD, TYPE } from '../video.config';
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
      <div style={{ fontWeight: 900, fontSize: TYPE.mock.appBrand, color: A.brand, letterSpacing: 1 }}>{sc.brand}</div>
      {sc.brandSub ? (
        <div style={{ fontSize: TYPE.mock.appBrandSub, color: A.brandSub, marginTop: 2 }}>{sc.brandSub}</div>
      ) : null}
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
            fontSize: TYPE.mock.appTitle,
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
            fontSize: TYPE.mock.appLead,
            fontWeight: 700,
            color: A.lead[sc.kind],
            fontFamily: sc.leadMono ? MONO : SANS,
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
                fontSize: TYPE.mock.appBody,
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
                fontSize: TYPE.mock.appButton,
              }}
            >
              {sc.primary}
            </div>
          ) : null}
          {sc.secondary ? (
            <div style={{ textAlign: 'center', fontSize: TYPE.mock.appLink, color: A.secondary, fontWeight: 700 }}>
              {sc.secondary}
            </div>
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
  // starts は screens と同じ長さ。cur はこの配列の走査で得る添字。
  const starts = s.screens.map((sc) => lineStart(lines, sc.at) - LEAD.appear);
  let cur = -1;
  starts.forEach((st, i) => {
    if (frame >= st) cur = i;
  });
  const enter = cur >= 0 ? ramp(frame - starts[cur]!, 0, 14) : 0;
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
          opacity: appear,
          transform: `translateY(${dropY(appear)}px)`,
        }}
      >
        <DeviceFrame width={pw} height={ph} screen={DEVICE.screen} notch glow={A.glow}>
          {sc ? (
            <div
              style={{ position: 'absolute', inset: 0, transform: `translateX(${(1 - enter) * 60}px)`, opacity: enter }}
            >
              <Screen sc={sc} />
            </div>
          ) : null}
        </DeviceFrame>
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
                  fontSize: TYPE.label.phoneStepNo,
                  color: on ? tt.on : tt.strong,
                  boxShadow: on ? `0 0 26px ${tt.main}` : undefined,
                }}
              >
                {i + 1}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div
                  style={{
                    fontFamily: SANS,
                    fontWeight: 900,
                    fontSize: on ? TYPE.title.phoneStep : TYPE.title.phoneStepDim,
                    color: C.ink,
                  }}
                >
                  {x.title}
                </div>
                {on ? (
                  <div
                    style={{
                      fontFamily: SANS,
                      fontWeight: 500,
                      fontSize: TYPE.body.phoneCaption,
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
