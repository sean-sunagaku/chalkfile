// 場面「ending」: 次の章の予告（最後の動画は「おつかれさまでした」）とクレジット
import React from 'react';
import type { EndingScene } from '../../engine/core/schema';
import { lectureCredits } from '../../engine/core/voices';
import { unitOf } from '../components/chrome';
import { Content } from '../components/content';
import { fitSize } from '../components/fit';
import { Glass, gradientText, Icon } from '../components/ui';
import { usePalette } from '../theme';
import { dropY, useAppear, useScene, useText } from '../timing';
import { TYPE } from '../video.config';
import { defineScene } from './define';

const Ending: React.FC<{ s: EndingScene }> = ({ s }) => {
  const { C, DISPLAY, GRAD, MONO, SANS, TONES } = usePalette();
  const { lecture, course, lang } = useScene();
  const text = useText();
  const { label: unit, total } = unitOf(course, text);
  const p = useAppear(0);
  const q = useAppear(0, 14);
  const c = useAppear(0, 26);
  return (
    <Content style={{ alignItems: 'center', gap: 40, top: 150 }}>
      {s.next ? (
        <>
          <div
            style={{ fontFamily: MONO, fontWeight: 700, fontSize: TYPE.label.endingNext, letterSpacing: 8, color: C.muted, opacity: p }}
          >
            {text.next} {unit}
          </div>
          <div style={{ opacity: q, transform: `translateY(${dropY(q)}px)` }}>
            <Glass
              t="violet"
              active={1}
              style={{ padding: '44px 64px', display: 'flex', alignItems: 'center', gap: 44 }}
            >
              <div
                style={{
                  fontFamily: SANS,
                  fontWeight: 900,
                  fontSize: TYPE.display.endingNo,
                  lineHeight: 1,
                  ...gradientText(DISPLAY),
                }}
              >
                {String(s.next.no).padStart(2, '0')}
              </div>
              <div
                style={{
                  fontFamily: SANS,
                  fontWeight: 900,
                  fontSize: fitSize(s.next.title, { role: 'title', max: TYPE.title.nextTitle, width: 1180, fontFamily: SANS, fontWeight: 900 }),
                  color: C.ink,
                  whiteSpace: 'nowrap',
                }}
              >
                {s.next.title}
              </div>
              <Icon name="route" size={56} color={TONES.violet.main} />
            </Glass>
          </div>
        </>
      ) : (
        <>
          <div
            style={{
              fontFamily: SANS,
              fontWeight: 900,
              fontSize: TYPE.display.endingDone,
              opacity: p,
              ...gradientText(DISPLAY),
            }}
          >
            {text.done}
          </div>
          {s.closing ? (
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: TYPE.title.closing, color: C.sub, opacity: q }}>{s.closing}</div>
          ) : null}
        </>
      )}
      {course.standalone ? null : (
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
          <div style={{ fontFamily: MONO, fontSize: TYPE.meta.endingProgress, color: C.muted, marginLeft: 12 }}>
            {text.progress(lecture.no, total)}
          </div>
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          fontFamily: SANS,
          fontSize: TYPE.meta.credits,
          color: C.muted,
          opacity: c,
          textAlign: 'center',
          lineHeight: 1.7,
        }}
      >
        {course.disclaimer ? <div>{course.disclaimer}</div> : null}
        <div>{text.credits(lectureCredits(lecture, lang))}</div>
      </div>
    </Content>
  );
};

export const ending = defineScene({ kind: 'ending', Component: Ending });
