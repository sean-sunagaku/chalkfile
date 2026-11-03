// 矢印の動き（線を引く・光の粒が線の上を進む）と、光の粒。
// 流れの図と状態の図の矢印（src/components/edge.tsx の Edge）と、やりとりの図の矢印（src/scenes/sequence.tsx）が使う
import type React from 'react';
import { interpolate } from 'remotion';
import { ramp } from '../timing';

/** 矢印の動きの時刻（線を引き始めてからのフレーム） */
export type ArrowTiming = {
  /** 線を引く（0→1） */
  draw: [number, number];
  /** 光の粒が、線の頭から終わりまで進む（0→1） */
  dot: [number, number];
  /** 光の粒が出て、消える（0→1→1→0） */
  dotFade: [number, number, number, number];
};

/** 流れの図・状態の図の矢印（Edge） */
export const EDGE_TIMING: ArrowTiming = { draw: [0, 16], dot: [4, 26], dotFade: [4, 8, 24, 30] };

/** やりとりの図の矢印。光の粒が少し早く着く（Edge とそろえると見た目が変わるので、見た目の更新 T3A-14 でまとめる） */
export const STEP_TIMING: ArrowTiming = { draw: [0, 16], dot: [4, 24], dotFade: [4, 8, 22, 28] };

/** f（線を引き始めてからのフレーム）での、線の伸び（draw）・光の粒の位置（dot）・光の粒の濃さ（dotO） */
export const arrowProgress = (f: number, t: ArrowTiming) => ({
  draw: ramp(f, ...t.draw),
  dot: ramp(f, ...t.dot),
  dotO: interpolate(f, t.dotFade, [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
});

/** 線の上を進む光の粒（SVG の中に置く）。blur は光のにじみの大きさ（px） */
export const GlowDot: React.FC<{ x: number; y: number; r: number; blur: number; color: string; opacity: number }> = ({
  x,
  y,
  r,
  blur,
  color,
  opacity,
}) => (
  <circle
    cx={x}
    cy={y}
    r={r}
    fill={color}
    opacity={opacity}
    style={{ filter: `drop-shadow(0 0 ${blur}px ${color})` }}
  />
);
