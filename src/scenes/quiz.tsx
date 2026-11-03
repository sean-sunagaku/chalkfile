// 場面「quiz」: ○×クイズ
import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { QuizScene } from '../../content/types';
import { Glass, Pill, Smart } from '../components/ui';
import { C, CONTENT_TOP, DISPLAY, MONO, PAD, SANS, TONES } from '../theme';
import { dropY, lineEnd, lineStart, useAppear, useScene, useText } from '../timing';
import { defineScene } from './define';

const Quiz: React.FC<{ s: QuizScene }> = ({ s }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { lines, lecture, course } = useScene();
  const text = useText();
  // 「1 / 3」の分母は、このレクチャーのクイズの場面の数（もとは 7 で固定だった）
  const quizTotal = lecture.scenes.filter((x) => x.kind === 'quiz').length;
  const q = useAppear(0);
  const thinkStart = lineEnd(lines, 0) + 3;
  const revealF = lineStart(lines, s.revealAt) - 2;
  const think = interpolate(frame, [thinkStart, revealF], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const thinkO = interpolate(frame, [thinkStart - 4, thinkStart + 4, revealF - 2, revealF + 4], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const stamp = spring({ frame: frame - revealF, fps, config: { damping: 11, mass: 0.6 }, durationInFrames: 30 });
  const ex = spring({ frame: frame - revealF - 10, fps, config: { damping: 200 }, durationInFrames: 22 });
  const ok = s.answer;
  const tt = TONES[ok ? 'mint' : 'coral'];
  const remain = Math.max(1, Math.ceil(3 * (1 - think)));
  return (
    <>
      <div style={{ position: 'absolute', left: PAD, top: CONTENT_TOP + 10, display: 'flex', alignItems: 'center', gap: 34, opacity: q }}>
        <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: 150, lineHeight: 1, background: DISPLAY, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Q{s.no}</div>
        {course.standalone ? null : (
          <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 26, color: C.muted, letterSpacing: 4 }}>{s.no} / {quizTotal}</div>
        )}
        {/* 考える時間だけ出す札。大きな「Q1」の下に置くと、書体によって文字の下の端と重なるので、横に並べる */}
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 30, color: TONES.amber.text, opacity: thinkO }}>{text.quizThink}</div>
      </div>
      <div style={{ position: 'absolute', left: PAD, right: PAD, top: 420, opacity: q, transform: `translateY(${dropY(q)}px)` }}>
        <Glass t="violet" active={stamp > 0.05 ? 0.4 : 1} style={{ padding: '40px 52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 40 }}>
          <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: 54, color: C.ink, lineHeight: 1.35 }}>
            <Smart text={s.question} t="violet" />
          </div>
          <div style={{ position: 'relative', width: 150, height: 150, flexShrink: 0 }}>
            <div style={{ position: 'absolute', inset: 0, opacity: thinkO }}>
              <svg width={150} height={150} viewBox="0 0 150 150">
                <circle cx={75} cy={75} r={62} fill="none" stroke={C.track} strokeWidth={10} />
                <circle cx={75} cy={75} r={62} fill="none" stroke={TONES.amber.main} strokeWidth={10} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={think} transform="rotate(-90 75 75)" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, fontWeight: 900, fontSize: 64, color: TONES.amber.main }}>{remain}</div>
            </div>
            <div
              style={{
                position: 'absolute',
                inset: -40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: Math.min(1, stamp * 1.4),
                transform: `scale(${0.4 + 0.6 * stamp}) rotate(${(1 - stamp) * -24}deg)`,
              }}
            >
              <div
                style={{
                  width: 210,
                  height: 210,
                  borderRadius: 999,
                  border: `10px solid ${tt.main}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: SANS,
                  fontWeight: 900,
                  fontSize: 150,
                  color: tt.main,
                  background: C.overlay,
                  boxShadow: `0 0 60px ${tt.main}88`,
                  lineHeight: 1,
                }}
              >
                {ok ? '○' : '×'}
              </div>
            </div>
          </div>
        </Glass>
      </div>
      <div style={{ position: 'absolute', left: PAD, right: PAD, top: 720, opacity: ex, transform: `translateY(${dropY(ex)}px)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
          <Pill t={ok ? 'mint' : 'coral'} size={30}>
            {ok ? text.quizTrue : text.quizFalse}
          </Pill>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 40, color: C.ink, lineHeight: 1.45 }}>
            <Smart text={s.explain} t={ok ? 'mint' : 'coral'} />
          </div>
        </div>
      </div>
    </>
  );
};

export const quiz = defineScene({ kind: 'quiz', Component: Quiz });
