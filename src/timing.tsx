import React, { createContext, useContext } from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Lang } from '../content/i18n';
import type { Course, Lecture, Scene } from '../content/types';
import { VIDEO_TEXT, type VideoText } from './i18n';
import { LEAD } from './video.config';

export type LineTiming = { start: number; end: number };
export type SceneTiming = { start: number; duration: number; lines: LineTiming[] };

/** course と lang は動画の言語のもの（訳の動画では、訳した講座と言語） */
type Ctx = SceneTiming & { scene: Scene; lecture: Lecture; index: number; course: Course; lang: Lang };

const SceneContext = createContext<Ctx | null>(null);

export const SceneProvider: React.FC<{ value: Ctx; children: React.ReactNode }> = ({ value, children }) => (
  <SceneContext.Provider value={value}>{children}</SceneContext.Provider>
);

export const useScene = (): Ctx => {
  const ctx = useContext(SceneContext);
  if (!ctx) throw new Error('SceneProvider の外で使われた');
  return ctx;
};

/** 動画の言語の、部品が出す決まった文字（src/i18n.ts） */
export const useText = (): VideoText => VIDEO_TEXT[useScene().lang];

/** at 番目の台詞が始まるフレーム（場面の頭からの相対） */
export const lineStart = (lines: LineTiming[], at: number): number => {
  if (!lines.length) return 0;
  if (at <= 0) return lines[0].start;
  if (at >= lines.length) return lines[lines.length - 1].end;
  return lines[at].start;
};

export const lineEnd = (lines: LineTiming[], at: number): number => {
  if (!lines.length) return 0;
  return lines[Math.min(Math.max(at, 0), lines.length - 1)].end;
};

/** 台詞 at の頭で 0→1 になる spring。ナレーションより LEAD.appear（4）フレームだけ先に動き出す（src/video.config.ts） */
export const useAppear = (at: number, delay = 0, durationInFrames = 20): number => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { lines } = useScene();
  const start = lineStart(lines, at) + delay - LEAD.appear;
  return spring({ frame: frame - start, fps, config: { damping: 200 }, durationInFrames });
};

/** 今しゃべっている（または最後にしゃべった）台詞の番号 */
export const useActiveLine = (): number => {
  const frame = useCurrentFrame();
  const { lines } = useScene();
  let active = 0;
  for (let i = 0; i < lines.length; i++) if (frame >= lines[i].start - LEAD.appear) active = i;
  return active;
};

/** focus 配列から、今のフレームで有効な項目を選ぶ */
export function useFocus<T extends { at: number }>(focus: T[] | undefined): T | null {
  const frame = useCurrentFrame();
  const { lines } = useScene();
  if (!focus?.length) return null;
  let current: T | null = null;
  for (const f of focus) if (frame >= lineStart(lines, f.at) - LEAD.appear) current = f;
  return current;
}

export const fadeInOut = (frame: number, duration: number, inF = 10, outF = 9) =>
  interpolate(frame, [0, inF, duration - outF, duration], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

/** 上から下へのスライド（px） */
export const dropY = (p: number, dist = 26) => (1 - p) * -dist;
