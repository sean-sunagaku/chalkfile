import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { LANG_INFO, type Lang } from '../engine/core/i18n';
import { upgradeLecture } from '../engine/core/legacy';
import type { Scene, Tone } from '../engine/core/schema';
import { Background, Caution, Cite, Header, Progress } from './components/chrome';
import { SCENES } from './scenes';
import { alpha, H, ThemeProvider, usePalette, videoPalette } from './theme';
import { fadeInOut, SceneProvider } from './timing';
import { CAPTION, frames, LEAD } from './video.config';
import { useProject } from './video-project';

/** 場面の kind で登録表（src/scenes/index.ts）を引いて描く */
const SceneBody: React.FC<{ s: Scene }> = ({ s }) => {
  // kind で引いた部品なので、s はその部品が受け取る形と合う（部品の型は種類ごとに違うので、ここだけ Scene に広げる）
  const Body = SCENES[s.kind].Component as React.FC<{ s: Scene }>;
  return <Body s={s} />;
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
 * 縮める割合・字幕を残す時間・文字の大きさは src/video.config.ts の CAPTION
 */
const CAPTION_SCALE = CAPTION.scale;
const CAPTION_BAND = H - Math.round(H * CAPTION_SCALE);

/** who: 掛け合いの講座で、話している人の名前と色（講座の cast） */
type Cue = { start: number; end: number; text: string; who?: { name: string; tone: Tone } };

const Captions: React.FC<{ cues: Cue[] }> = ({ cues }) => {
  const { C, SANS, tone } = usePalette();
  const frame = useCurrentFrame();
  let i = -1;
  for (let k = 0; k < cues.length; k++) if (frame >= cues[k].start - LEAD.caption) i = k;
  const cue = cues[i];
  // 台詞の後の短い間では字幕を残す（ちらつかせない）。次の台詞の手前までか、CAPTION.holdSec（0.7 秒）まで
  const until = cue ? Math.min(cue.end + frames(CAPTION.holdSec), (cues[i + 1]?.start ?? Infinity) - LEAD.caption) : -1;
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
        padding: `0 ${CAPTION.sidePad}px`,
      }}
    >
      {show ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: CAPTION.gap }}>
          {cue.who ? (
            <div
              style={{
                flex: 'none',
                fontFamily: SANS,
                fontWeight: 900,
                fontSize: CAPTION.nameSize,
                // 名前札の文字も、今は字幕と同じ白（onCode）。図の色の上の文字（onTone）にするのは見た目の更新（計画の T3A-14）
                color: C.onCode,
                background: tone(cue.who.tone).main,
                borderRadius: 999,
                padding: `6px ${CAPTION.namePadX}px`,
                whiteSpace: 'nowrap',
              }}
            >
              {cue.who.name}
            </div>
          ) : null}
          <div
            style={{
              fontFamily: SANS,
              fontWeight: 700,
              fontSize: CAPTION.size,
              lineHeight: 1.42,
              color: C.onCode,
              textAlign: cue.who ? 'left' : 'center',
              letterSpacing: CAPTION.spacing,
              textWrap: 'balance' as React.CSSProperties['textWrap'],
            }}
          >
            {cue.text}
          </div>
        </div>
      ) : null}
    </div>
  );
};

/** 言語ごとの折り返し。日本語は文節で（「飛べ／る」のような割れを防ぐ）、英語は単語で、中国語は句読点を行頭に置かない */
const WRAP: Record<Lang, React.CSSProperties> = {
  ja: { wordBreak: 'auto-phrase' as React.CSSProperties['wordBreak'] },
  en: { wordBreak: 'normal', overflowWrap: 'break-word' },
  zh: { wordBreak: 'normal', lineBreak: 'strict' },
};

type LectureProps = { id: string; audio?: boolean; theme?: string; captions?: boolean };

/**
 * id は動画の名前（日本語は S01、訳は S01.en。engine/core/i18n.ts の videoKey）。
 * theme を渡すと、講座のテーマの代わりにそのテーマで描く（stills.ts --theme=… でテーマを試すとき）。
 * captions を true にすると、台詞の字幕を焼き込む（音を出せない場所でも要点が分かる動画）。
 */
export const LectureVideo: React.FC<LectureProps> = ({ id, audio = false, theme, captions = false }) => {
  // 描くものの一式（動画・テーマ・timeline）は、src/Root.tsx の ProjectProvider から受け取る（content/ は読まない）
  const project = useProject();
  const video = project.videoOf(id);
  const { course, lang } = video;
  // 台本の古い書き方（中身の文字を見て描き分けていた決まり）を、明示の項目に読み替えてから描く（engine/core/legacy.ts）
  const lecture = upgradeLecture(video.lecture);
  // 置いてある timeline が 1 つだけで、読めたもの（台本と合うかは、描く前に src/Root.tsx の calculateMetadata が確かめる）
  const entries = project.timelines.get(id);
  const tl = entries?.length === 1 ? entries[0].timeline : undefined;
  if (!tl) throw new Error(`${id} の timeline が無いか、読めない（bun scripts/synth.ts ${id} で作る）`);
  // この動画のテーマ（stills.ts --theme=… で上書きできる）。色と書体（言語に合わせる）は ThemeProvider が子の部品に渡す
  const th = project.themeOf(theme || course.theme);
  const { SANS } = videoPalette(th, lang);
  const scenes = lecture.scenes.map((s, i) => {
    const st = tl.scenes[i];
    return (
      <Sequence key={i} from={st.start} durationInFrames={st.duration} name={`${i + 1} ${s.kind}`}>
        <SceneProvider value={{ ...st, scene: s, lecture, index: i, course, lang }}>
          <SceneFrame s={s} duration={st.duration} caution={lecture.caution} />
        </SceneProvider>
      </Sequence>
    );
  });
  const cast = course.cast ?? {};
  const cues: Cue[] = captions
    ? lecture.scenes.flatMap((s, i) =>
        s.lines.map((ln, k) => ({ start: tl.scenes[i].start + tl.scenes[i].lines[k].start, end: tl.scenes[i].start + tl.scenes[i].lines[k].end, text: ln.t, who: cast[ln.v ?? 'narrator'] })),
      )
    : [];
  return (
    <ThemeProvider theme={th} lang={lang}>
      <AbsoluteFill lang={LANG_INFO[lang].html} style={{ fontFamily: SANS, ...WRAP[lang] }}>
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
    </ThemeProvider>
  );
};
