import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { LECTURES } from '../content';
import type { Scene } from '../content/types';
import { Background, Header, Progress } from './components/chrome';
import timelineJson from './generated/timeline.json';
import { Big, Concepts, Ending, Goals, Opening, Points, Recap, Refs } from './scenes/basic';
import { CodeView, Compare, Numbers, Phone, Quiz, Table, Terminal, Timeline } from './scenes/data';
import { Flow, Sequence as SequenceDiagram, States } from './scenes/diagram';
import { SANS } from './theme';
import { fadeInOut, SceneProvider, type SceneTiming } from './timing';

export type LectureTimeline = { fps: number; durationInFrames: number; scenes: SceneTiming[] };
export const TIMELINE = timelineJson as unknown as Record<string, LectureTimeline>;

const SceneBody: React.FC<{ s: Scene }> = ({ s }) => {
  switch (s.kind) {
    case 'opening':
      return <Opening s={s} />;
    case 'goals':
      return <Goals s={s} />;
    case 'points':
      return <Points s={s} />;
    case 'concepts':
      return <Concepts s={s} />;
    case 'sequence':
      return <SequenceDiagram s={s} />;
    case 'flow':
      return <Flow s={s} />;
    case 'states':
      return <States s={s} />;
    case 'code':
      return <CodeView s={s} />;
    case 'table':
      return <Table s={s} />;
    case 'compare':
      return <Compare s={s} />;
    case 'big':
      return <Big s={s} />;
    case 'numbers':
      return <Numbers s={s} />;
    case 'timeline':
      return <Timeline s={s} />;
    case 'quiz':
      return <Quiz s={s} />;
    case 'recap':
      return <Recap s={s} />;
    case 'refs':
      return <Refs s={s} />;
    case 'phone':
      return <Phone s={s} />;
    case 'terminal':
      return <Terminal s={s} />;
    case 'ending':
      return <Ending s={s} />;
  }
};

const SceneFrame: React.FC<{ s: Scene; duration: number }> = ({ s, duration }) => {
  const frame = useCurrentFrame();
  const o = fadeInOut(frame, duration, s.kind === 'opening' ? 1 : 10, s.kind === 'ending' ? 20 : 9);
  return (
    <AbsoluteFill style={{ opacity: o }}>
      {s.heading && s.kind !== 'opening' && s.kind !== 'ending' ? <Header heading={s.heading} /> : null}
      <SceneBody s={s} />
    </AbsoluteFill>
  );
};

export const LectureVideo: React.FC<{ id: string; audio?: boolean }> = ({ id, audio = false }) => {
  const lecture = LECTURES.find((l) => l.id === id)!;
  const tl = TIMELINE[id];
  return (
    // auto-phrase: 日本語を文節で折り返す（「飛べ／る」のような割れを防ぐ）
    <AbsoluteFill lang="ja" style={{ fontFamily: SANS, wordBreak: 'auto-phrase' as React.CSSProperties['wordBreak'] }}>
      <Background />
      {lecture.scenes.map((s, i) => {
        const st = tl.scenes[i];
        return (
          <Sequence key={i} from={st.start} durationInFrames={st.duration} name={`${i + 1} ${s.kind}`}>
            <SceneProvider value={{ ...st, scene: s, lecture, index: i }}>
              <SceneFrame s={s} duration={st.duration} />
            </SceneProvider>
          </Sequence>
        );
      })}
      <Progress total={tl.durationInFrames} marks={tl.scenes.slice(1).map((s) => s.start)} />
      {audio ? <Audio src={staticFile(`audio/mix/${id}.wav`)} /> : null}
    </AbsoluteFill>
  );
};
