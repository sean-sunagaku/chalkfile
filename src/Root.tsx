import React from 'react';
import { Composition } from 'remotion';
import { VIDEOS, type Video } from '../content';
import { compositionId } from '../content/i18n';
import { validateLecture, validateTimeline, type Issue } from '../engine/core/validate';
import { LectureVideo, TIMELINE } from './Lecture';
import { VIDEO } from './video.config';

/** その動画の台本の誤り（engine/core/validate.ts）と、台本と形の合わない timeline。描くと途中で止まるか、黙って崩れる */
const errorsOf = (v: Video): Issue[] => {
  try {
    return [...validateLecture(v.lecture, v.course), ...validateTimeline(v.lecture, v.course, TIMELINE[v.key])].filter((x) => x.level === 'error');
  } catch (e) {
    return [{ level: 'error', rule: 'scenes', where: `${v.course.id}/${v.key}`, message: `台本を確かめられなかった: ${e instanceof Error ? e.message : String(e)}` }];
  }
};

/** Studio はこの文をその動画の場所に出す（改行は詰まって出るので、1 件ずつ「・」で始める） */
const failure = (key: string, errors: Issue[]) =>
  new Error(`${key} の台本に誤りが ${errors.length} 件ある。直すまで描かない（全部の一覧は bun scripts/validate.ts）\n${errors.map((x) => `・${x.where}  ${x.message}`).join('\n')}`);

export const Root: React.FC = () => (
  <>
    {/* まだ合成していない（timeline に無い）動画は飛ばす。章を並行して書いているときも書き出せるように。
        訳の動画は S01.en → コンポジション S01-en（content/i18n.ts の compositionId）。
        台本に誤りがある動画だけ、描く前（calculateMetadata）で止める。Studio はその動画の場所に誤りの一覧を出し、ほかの動画は開ける */}
    {VIDEOS.filter((v) => TIMELINE[v.key]).map((v) => {
      const errors = errorsOf(v);
      return (
        <Composition
          key={v.key}
          id={compositionId(v.key)}
          component={LectureVideo}
          durationInFrames={TIMELINE[v.key].durationInFrames}
          fps={VIDEO.fps}
          width={VIDEO.width}
          height={VIDEO.height}
          defaultProps={{ id: v.key, audio: false, theme: '', captions: false }}
          {...(errors.length
            ? {
                calculateMetadata: () => {
                  throw failure(v.key, errors);
                },
              }
            : {})}
        />
      );
    })}
  </>
);
