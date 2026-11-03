// 場面「opening」: タイトル（ジングルの「ドン」で番号と題が出る）
import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { OpeningScene } from '../../content/types';
import { CourseMark, unitOf } from '../components/chrome';
import { fitSize } from '../components/fit';
import { gradientText, Pill, Smart } from '../components/ui';
import { alpha, PAD, usePalette } from '../theme';
import { dropY, ramp, useScene, useText } from '../timing';
import { frames, STING } from '../video.config';
import { defineScene } from './define';

/** ジングルの「ドン」が鳴るフレーム（src/video.config.ts の STING.introHitSec。今は 2.0 秒 = 60 フレーム） */
const HIT_FRAME = frames(STING.introHitSec);

const Opening: React.FC<{ s: OpeningScene }> = ({ s }) => {
  const { C, DISPLAY, GRAD, MESH, MONO, SANS, THEME } = usePalette();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { lecture, course } = useScene();
  const text = useText();
  const hit = spring({ frame: frame - HIT_FRAME, fps, config: { damping: 14, mass: 0.7 }, durationInFrames: 40 });
  const soft = spring({ frame: frame - HIT_FRAME, fps, config: { damping: 200 }, durationInFrames: 26 });
  const early = ramp(frame, 4, 28);
  const sweep = interpolate(frame, [HIT_FRAME - 30, HIT_FRAME + 8], [-0.3, 1.3], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ring = (k: number) => {
    const f = frame - HIT_FRAME - k * 6;
    return {
      s: interpolate(f, [0, 50], [0.6, 1.7], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
      o: interpolate(f, [0, 8, 50], [0, 0.55, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
    };
  };
  // タイトルの行（titleLines。書かなければ 1 行）。古い書き方（全角の空白・改行で分ける）は、描く前に engine/core/legacy.ts が読み替える
  const titleLines = s.titleLines ?? [s.title];
  const sub2 = spring({ frame: frame - HIT_FRAME - 12, fps, config: { damping: 200 }, durationInFrames: 24 });
  const no = String(lecture.no).padStart(2, '0');
  const { label: unit, total } = unitOf(course, text);
  const solo = course.standalone === true;
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
      <div
        style={{
          position: 'absolute',
          left: PAD + 20,
          top: 250,
          width: 520,
          height: 520,
          display: solo ? 'none' : 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
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
            ...gradientText(DISPLAY),
            transform: `scale(${0.7 + 0.3 * hit})`,
            opacity: soft,
            filter: `blur(${(1 - soft) * 14}px)${THEME.scheme === 'dark' ? ` drop-shadow(0 0 40px ${alpha(C.accent, 0.45)})` : ''}`,
          }}
        >
          {no}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: solo ? PAD : 660,
          right: PAD,
          top: 250,
          height: 520,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 22,
        }}
      >
        {s.section ? (
          <div style={{ opacity: early, transform: `translateY(${dropY(early)}px)` }}>
            <Pill t="violet" size={26}>
              {s.section}
            </Pill>
          </div>
        ) : null}
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
                  ? gradientText(DISPLAY)
                  : {}),
              }}
            >
              {ln}
            </div>
          ))}
        </div>
        {s.subtitle ? (
          <div
            style={{
              fontFamily: SANS,
              fontWeight: 500,
              fontSize: 36,
              color: C.sub,
              opacity: sub2,
              transform: `translateY(${dropY(sub2, 14)}px)`,
            }}
          >
            <Smart text={s.subtitle} />
          </div>
        ) : null}
      </div>
      <div
        style={{
          position: 'absolute',
          left: PAD,
          right: PAD,
          bottom: 70,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          opacity: early,
        }}
      >
        {solo ? null : (
          <>
            {/* 注意書きが長い言語（英語）でも、番号は折り返さない */}
            <div
              style={{
                fontFamily: MONO,
                fontWeight: 700,
                fontSize: 22,
                color: C.muted,
                letterSpacing: 4,
                marginRight: 10,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {unit} {no} / {total}
            </div>
            {Array.from({ length: total }, (_, i) => (
              <div
                key={i}
                style={{
                  flexShrink: 0,
                  width: i + 1 === lecture.no ? 46 : 14,
                  height: 14,
                  borderRadius: 99,
                  background: i + 1 === lecture.no ? GRAD : i + 1 < lecture.no ? C.trackDone : C.track,
                }}
              />
            ))}
          </>
        )}
        {course.disclaimer ? (
          <div
            style={{
              marginLeft: 'auto',
              fontFamily: SANS,
              fontWeight: 500,
              fontSize: 21,
              color: C.muted,
              textAlign: 'right',
            }}
          >
            {course.disclaimer}
          </div>
        ) : null}
      </div>
    </>
  );
};

export const opening = defineScene({ kind: 'opening', Component: Opening });
