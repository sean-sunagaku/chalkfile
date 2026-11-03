// 端末と窓の枠（中に架空のアプリの画面・コード・端末を入れる「そのものの形」）。どの場面も同じ形と色で描く。
//   DeviceFrame   スマホの本体（スマホの画面の流れ src/scenes/phone.tsx と、画面の図 src/scenes/screens.tsx のスマホ）
//   WindowLights  窓の左上の信号の 3 色（コード・端末の窓と、画面の図のブラウザの窓）
//   CodeWindow    コードと端末の窓（濃い面と、上の帯の信号と題。src/scenes/code.tsx・terminal.tsx）
// 色は src/components/app-colors.ts の DEVICE と WINDOW_LIGHTS（テーマで変えない、そのものの色）
import type React from 'react';
import { usePalette } from '../theme';
import { TYPE } from '../video.config';
import { DEVICE, WINDOW_LIGHTS } from './app-colors';

/** スマホの本体の角の丸み・縁と画面の間（幅に対する割合） */
const DEVICE_RADIUS = 0.125;
const DEVICE_INSET = 0.031;

/**
 * スマホの本体。width・height は本体の外の大きさ。中の画面（children）は、本体の縁の内側に、角を丸めて切り抜く。
 * notch は画面の上の切り欠き（画面の流れ）、glow は本体のまわりの光（画面の流れ。アプリの色）
 */
export const DeviceFrame: React.FC<{
  width: number;
  height: number;
  screen: string;
  notch?: boolean;
  glow?: string;
  children: React.ReactNode;
}> = ({ width, height, screen, notch, glow, children }) => {
  const { C } = usePalette();
  const radius = Math.round(width * DEVICE_RADIUS);
  const inset = Math.round(width * DEVICE_INSET);
  // 画面の角は、本体の角から縁の幅を引いたものより少しだけ丸くする（縁の線の太さの分）
  const screenRadius = radius - inset + 2;
  return (
    <div style={{ position: 'relative', width, height }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: radius,
          background: DEVICE.body,
          border: `2px solid ${DEVICE.rim}`,
          boxShadow: glow ? `${C.shadow}, 0 0 60px ${glow}` : C.shadow,
        }}
      />
      <div style={{ position: 'absolute', inset, borderRadius: screenRadius, overflow: 'hidden', background: screen }}>
        {children}
        {notch ? (
          <div
            style={{
              position: 'absolute',
              top: Math.round(width * 0.027),
              left: '50%',
              transform: 'translateX(-50%)',
              width: Math.round(width * 0.245),
              height: Math.round(width * 0.067),
              borderRadius: 99,
              background: DEVICE.body,
            }}
          />
        ) : null}
      </div>
    </div>
  );
};

/** 窓の左上の信号の 3 色。size は丸の径、gap は丸の間（px） */
export const WindowLights: React.FC<{ size: number; gap: number }> = ({ size, gap }) => (
  <div style={{ display: 'flex', gap, flexShrink: 0 }}>
    {WINDOW_LIGHTS.map((c) => (
      <div key={c} style={{ width: size, height: size, borderRadius: 99, background: c, opacity: 0.85 }} />
    ))}
  </div>
);

/** コードと端末の窓。大きさは置く場所（親）に合わせる。中身（children）は、窓の左上を基準に置く */
export const CodeWindow: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  const { C, MONO } = usePalette();
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        borderRadius: 22,
        background: `linear-gradient(180deg, ${C.code}, ${C.codeShade})`,
        border: `1.5px solid ${C.line2}`,
        boxShadow: C.shadow,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: CODE_BAR,
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          borderBottom: `1.5px solid ${C.codeLine}`,
          background: C.codeBar,
        }}
      >
        <WindowLights size={14} gap={12} />
        <div
          style={{
            marginLeft: 26,
            fontFamily: MONO,
            fontSize: TYPE.label.windowTitle,
            color: C.codeMuted,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title}
        </div>
      </div>
      {children}
    </div>
  );
};

/** コードと端末の窓の、上の帯の高さ（px） */
export const CODE_BAR = 56;
