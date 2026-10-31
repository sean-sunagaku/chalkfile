import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { courseOf, LECTURES } from '../content';
import { themeOf } from '../content/themes';
import type { Scene } from '../content/types';
import { Background, Caution, Cite, Header, Progress } from './components/chrome';
import timelineJson from './generated/timeline.json';
import { Big, Concepts, Ending, Goals, Opening, Points, Recap, Refs } from './scenes/basic';
import { CodeView, Compare, Numbers, Phone, Quiz, Table, Terminal, Timeline } from './scenes/data';
import { Flow, Sequence as SequenceDiagram, States } from './scenes/diagram';
import { Screens } from './scenes/mock';
import { alpha, applyTheme, C, H, SANS } from './theme';
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
    case 'screens':
      return <Screens s={s} />;
    case 'terminal':
      return <Terminal s={s} />;
    case 'ending':
      return <Ending s={s} />;
  }
};

const SceneFrame: React.FC<{ s: Scene; duration: number; caution?: string }> = ({ s, duration, caution }) => {
  const frame = useCurrentFrame();
  const o = fadeInOut(frame, duration, s.kind === 'opening' ? 1 : 10, s.kind === 'ending' ? 20 : 9);
  const body = s.kind !== 'opening' && s.kind !== 'ending';
  return (
    <AbsoluteFill style={{ opacity: o }}>
      {s.heading && body ? <Header heading={s.heading} /> : null}
      <SceneBody s={s} />
      {caution && body ? <Caution text={caution} /> : null}
      {s.cite && body ? <Cite text={s.cite} /> : null}
    </AbsoluteFill>
  );
};

/* ───────────── 焼き込みの字幕 ─────────────
 * captions=true のとき、場面を縮めて下に字幕の帯を空け、台詞（t）をそのまま出す。
 * 講座サイトは動画の下に自前の字幕を出すので、サイト用の動画は字幕なしで書き出す（render.sh の CAPTIONS=1 で両方作る）。
 */
const CAPTION_SCALE = 0.88;
const CAPTION_BAND = H - Math.round(H * CAPTION_SCALE);

type Cue = { start: number; end: number; text: string };

const Captions: React.FC<{ cues: Cue[] }> = ({ cues }) => {
  const frame = useCurrentFrame();
  let i = -1;
  for (let k = 0; k < cues.length; k++) if (frame >= cues[k].start - 3) i = k;
  const cue = cues[i];
  // 台詞の後の短い間では字幕を残す（ちらつかせない）。次の台詞の手前までか、0.7 秒まで
  const until = cue ? Math.min(cue.end + 21, (cues[i + 1]?.start ?? Infinity) - 3) : -1;
  const show = cue && frame <= until;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 7,
        height: CAPTION_BAND - 7,
        background: alpha(C.code, 0.96),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 120px',
      }}
    >
      {show ? (
        <div
          style={{
            fontFamily: SANS,
            fontWeight: 700,
            fontSize: 38,
            lineHeight: 1.42,
            color: '#FFFFFF',
            textAlign: 'center',
            letterSpacing: 1,
            textWrap: 'balance' as React.CSSProperties['textWrap'],
          }}
        >
          {cue.text}
        </div>
      ) : null}
    </div>
  );
};

/**
 * theme を渡すと、講座のテーマの代わりにそのテーマで描く（stills.mjs --theme=… でテーマを試すとき）。
 * captions を true にすると、日本語の字幕を焼き込む（音を出せない場所でも要点が分かる動画）。
 */
export const LectureVideo: React.FC<{ id: string; audio?: boolean; theme?: string; captions?: boolean }> = ({ id, audio = false, theme, captions = false }) => {
  const lecture = LECTURES.find((l) => l.id === id)!;
  const tl = TIMELINE[id];
  // 子の部品より先に、この動画のテーマの色と書体に差し替える
  applyTheme(themeOf(theme || courseOf(id).theme));
  const scenes = lecture.scenes.map((s, i) => {
    const st = tl.scenes[i];
    return (
      <Sequence key={i} from={st.start} durationInFrames={st.duration} name={`${i + 1} ${s.kind}`}>
        <SceneProvider value={{ ...st, scene: s, lecture, index: i }}>
          <SceneFrame s={s} duration={st.duration} caution={lecture.caution} />
        </SceneProvider>
      </Sequence>
    );
  });
  const cues: Cue[] = captions
    ? lecture.scenes.flatMap((s, i) => s.lines.map((ln, k) => ({ start: tl.scenes[i].start + tl.scenes[i].lines[k].start, end: tl.scenes[i].start + tl.scenes[i].lines[k].end, text: ln.t })))
    : [];
  return (
    // auto-phrase: 日本語を文節で折り返す（「飛べ／る」のような割れを防ぐ）
    <AbsoluteFill lang="ja" style={{ fontFamily: SANS, wordBreak: 'auto-phrase' as React.CSSProperties['wordBreak'] }}>
      <Background />
      {captions ? (
        <>
          <AbsoluteFill style={{ transform: `scale(${CAPTION_SCALE})`, transformOrigin: '50% 0%' }}>{scenes}</AbsoluteFill>
          <Captions cues={cues} />
        </>
      ) : (
        scenes
      )}
      <Progress total={tl.durationInFrames} marks={tl.scenes.slice(1).map((s) => s.start)} />
      {audio ? <Audio src={staticFile(`audio/mix/${id}.wav`)} /> : null}
    </AbsoluteFill>
  );
};
