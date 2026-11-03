import React from 'react';
import { Composition } from 'remotion';
import { compositionId } from '../engine/core/i18n';
import type { Video } from '../engine/core/schema';
import type { TimelineEntry } from '../engine/core/timeline';
import { validateLecture, validateTimelineFiles, type Issue } from '../engine/core/validate';
import { LectureVideo } from './Lecture';
import { VIDEO } from './video.config';
import { ProjectProvider, type VideoProject } from './video-project';

/**
 * その動画の台本の誤り（engine/core/validate.ts）と、台本と合わない timeline（形・置き場所・指紋が古い）。
 * 描くと途中で止まるか、黙って崩れるか、台詞と画面がずれる
 */
const errorsOf = (v: Video, entries: TimelineEntry[]): Issue[] => {
  try {
    return [...validateLecture(v.lecture, v.course), ...validateTimelineFiles(v.lecture, v.course, entries)].filter((x) => x.level === 'error');
  } catch (e) {
    return [{ level: 'error', rule: 'scenes', where: `${v.course.id}/${v.key}`, message: `台本を確かめられなかった: ${e instanceof Error ? e.message : String(e)}` }];
  }
};

/** Studio はこの文をその動画の場所に出す（改行は詰まって出るので、1 件ずつ「・」で始める） */
const failure = (key: string, errors: Issue[]) =>
  new Error(`${key} の台本か timeline に誤りが ${errors.length} 件ある。直すまで描かない（全部の一覧は bun scripts/validate.ts）\n${errors.map((x) => `・${x.where}  ${x.message}`).join('\n')}`);

/**
 * Remotion のルート（コンポジションの一覧）。描くものの一式（project。src/index.ts が src/project.ts の PROJECT を渡す）を、
 * ProjectProvider で動画 1 本の部品に配る。ここと src/Lecture.tsx は content/ を読まない
 */
export const Root: React.FC<{ project: VideoProject }> = ({ project }) => (
  <ProjectProvider project={project}>
    {/* まだ合成していない（timeline のファイルが無い）動画は飛ばす。章を並行して書いているときも書き出せるように。
        訳の動画は S01.en → コンポジション S01-en（engine/core/i18n.ts の compositionId）。
        fps と長さは timeline のファイルから calculateMetadata で出す。台本に誤りがある動画と、timeline が台本と合わない（古い）動画だけ、
        描く前（calculateMetadata）で止める。Studio はその動画の場所に誤りの一覧を出し、ほかの動画は開ける */}
    {project.videos
      .filter((v) => project.timelines.has(v.key))
      .map((v) => {
        const entries = project.timelines.get(v.key) ?? [];
        const errors = errorsOf(v, entries);
        const timeline = entries[0]?.timeline;
        return (
          <Composition
            key={v.key}
            id={compositionId(v.key)}
            component={LectureVideo}
            width={VIDEO.width}
            height={VIDEO.height}
            defaultProps={{ id: v.key, audio: false, theme: '', captions: false }}
            calculateMetadata={() => {
              if (errors.length || !timeline) throw failure(v.key, errors);
              return { fps: timeline.fps, durationInFrames: timeline.durationInFrames };
            }}
          />
        );
      })}
  </ProjectProvider>
);
