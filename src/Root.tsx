import React from 'react';
import { Composition } from 'remotion';
import { LECTURES } from '../content';
import { LectureVideo, TIMELINE } from './Lecture';

export const Root: React.FC = () => (
  <>
    {/* まだ合成していない（timeline に無い）レクチャーは飛ばす。章を並行して書いているときも書き出せるように */}
    {LECTURES.filter((l) => TIMELINE[l.id]).map((l) => (
      <Composition
        key={l.id}
        id={l.id}
        component={LectureVideo}
        durationInFrames={TIMELINE[l.id].durationInFrames}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ id: l.id, audio: false, theme: '', captions: false }}
      />
    ))}
  </>
);
