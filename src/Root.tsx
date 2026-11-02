import React from 'react';
import { Composition } from 'remotion';
import { VIDEOS } from '../content';
import { compositionId } from '../content/i18n';
import { LectureVideo, TIMELINE } from './Lecture';

export const Root: React.FC = () => (
  <>
    {/* まだ合成していない（timeline に無い）動画は飛ばす。章を並行して書いているときも書き出せるように。
        訳の動画は S01.en → コンポジション S01-en（content/i18n.ts の compositionId） */}
    {VIDEOS.filter((v) => TIMELINE[v.key]).map((v) => (
      <Composition
        key={v.key}
        id={compositionId(v.key)}
        component={LectureVideo}
        durationInFrames={TIMELINE[v.key].durationInFrames}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ id: v.key, audio: false, theme: '', captions: false }}
      />
    ))}
  </>
);
