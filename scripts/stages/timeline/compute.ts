// 1 本の動画の時刻（場面と台詞の始まり）を、台詞の音声の長さから決める。純粋な関数だけを置く（ファイルを読まない・書かない）。
// scripts/synth.ts が声（scripts/stages/voice/）の長さと読みを渡して呼び、ここで作った形を scripts/stages/timeline/emit.ts が書く。
// 正解の値は tests/synth-compute.test.ts が照らす（間の取り方を変えたら、そのテストの値も直す）
import type { Lang } from '../../../content/i18n';
import type { Course, Lecture, Line, Scene, VoiceId } from '../../../content/types';
import { speechIn } from '../../../content/voices';
import { TIMELINE_SCHEMA, TIMING, type TimelineFile, timelineFingerprint } from '../../../engine/core/timeline';

/** 台詞 1 つの声。file は場所に縛られない名前（.work/tts/<鍵>.wav）、sec は長さ（秒）、kana は読み（訳は Kokoro に渡した音素） */
export type LineVoice = { file: string; sec: number; kana: string };

/** 時刻を決めた台詞（秒。start は動画の頭から） */
export type TimedLine = {
  start: number;
  end: number;
  file: string;
  /** 画面の文（字幕に出す） */
  text: string;
  voice: VoiceId;
  sfx?: Line['sfx'];
  sfxAfter?: Line['sfxAfter'];
  bgm?: Line['bgm'];
  /** この台詞のあとの間（秒） */
  pauseAfter: number;
};
/** 時刻を決めた場面（秒） */
export type TimedScene = { kind: Scene['kind']; heading: string; start: number; end: number; lines: TimedLine[] };
/** 時刻を決めた動画 1 本（duration は秒） */
export type Timed = { scenes: TimedScene[]; duration: number };

/**
 * 場面と台詞の時刻を決める。voices[場面][台詞] はその台詞の声（台本の順）。
 * 台詞の開始はフレームに丸めた時刻を正にする（映像と音を同じ時刻でそろえる）。場面の終わりもフレームに丸める
 */
export const layout = (lecture: Lecture, voices: LineVoice[][], fps: number, timing = TIMING): Timed => {
  const toFrame = (s: number) => Math.round(s * fps);
  const scenes: TimedScene[] = [];
  let t = 0;
  for (const [si, scene] of lecture.scenes.entries()) {
    const start = t;
    // オープニングは、ジングルの「ドン」のあとに呼び込む
    let cursor = start + (scene.kind === 'opening' ? timing.openingLeadIn : timing.leadIn);
    const lines: TimedLine[] = [];
    for (const [li, line] of scene.lines.entries()) {
      const voice = voices[si]?.[li];
      if (!voice) throw new Error(`声が渡されていない: ${lecture.id} s${si + 1}-${li + 1}`);
      const ls = toFrame(cursor) / fps;
      // 負の pause は台詞の間を詰める（食い気味のツッコミ）。声が重ならないよう、最短の間は空ける
      const pauseAfter = Math.max(timing.minGap, timing.gap + (line.pause ?? 0));
      lines.push({
        start: ls,
        end: ls + voice.sec,
        file: voice.file,
        text: line.t,
        voice: line.v ?? 'narrator',
        sfx: line.sfx,
        sfxAfter: line.sfxAfter,
        bgm: line.bgm,
        pauseAfter,
      });
      cursor = ls + voice.sec + (li === scene.lines.length - 1 ? 0 : pauseAfter);
    }
    // エンディングは、締めのジングルを最後まで鳴らす。hold は場面の最後に足す余白（クイズの考える時間など）
    const tail = (scene.kind === 'ending' ? timing.endingTail : timing.tail) + (scene.hold ?? 0);
    const end = toFrame(cursor + tail) / fps;
    scenes.push({ kind: scene.kind, heading: scene.heading ?? '', start, end, lines });
    t = end;
  }
  return { scenes, duration: t };
};

/* ───────────── 出力の形 ───────────── */

/** timeline（Remotion が読む場面と台詞の開始フレーム。指紋つき） */
export const timelineOf = (key: string, lecture: Lecture, lang: Lang, timed: Timed, fps: number): TimelineFile => {
  const toFrame = (s: number) => Math.round(s * fps);
  return {
    schema: TIMELINE_SCHEMA,
    key,
    fps,
    durationInFrames: toFrame(timed.duration),
    fingerprint: timelineFingerprint(lecture, lang),
    scenes: timed.scenes.map((s) => ({
      start: toFrame(s.start),
      duration: toFrame(s.end) - toFrame(s.start),
      lines: s.lines.map((l) => ({ start: toFrame(l.start - s.start), end: toFrame(l.end - s.start) })),
    })),
  };
};

/** ミックスの設計図（scripts/mix.py が読む）。音声は場所に縛られない名前（.work/tts/<鍵>.wav）で書く。項目の並びも出力のバイト列に入る */
export const planOf = (key: string, timed: Timed) => ({
  id: key,
  duration: timed.duration,
  scenes: timed.scenes.map((s) => ({
    kind: s.kind,
    start: s.start,
    end: s.end,
    lines: s.lines.map((l) => ({
      file: l.file,
      start: l.start,
      end: l.end,
      sfx: l.sfx,
      sfxAfter: l.sfxAfter,
      bgm: l.bgm,
      pauseAfter: l.pauseAfter,
    })),
  })),
});

/**
 * 講座サイトの台本（章と、字幕の時刻と文）。掛け合いの講座は、話している人の名前を付ける（「ずんだもん：…」）。
 * サイトの字幕（WebVTT）は、ブラウザがこの cues から作る（site/template.html）。VTT のファイルは作らない
 */
export const siteDataOf = (key: string, lecture: Lecture, course: Course, timed: Timed) => {
  const cast = course.cast ?? {};
  const said = (l: TimedLine) => {
    const who = cast[l.voice];
    return who ? `${who.name}：${l.text}` : l.text;
  };
  return {
    id: key,
    duration: +timed.duration.toFixed(2),
    chapters: timed.scenes.map((s, si) => ({
      scene: si,
      start: +s.start.toFixed(2),
      heading: s.heading || lecture.title,
      kind: s.kind,
    })),
    cues: timed.scenes.flatMap((s, si) =>
      s.lines.map((l) => ({
        start: +l.start.toFixed(2),
        end: +l.end.toFixed(2),
        text: said(l),
        scene: si,
        heading: s.heading,
      })),
    ),
  };
};

/** 台詞ごとの読みの記録（.work/kana/<key>.txt）。訳は、画面の文と読み上げた文が違えば、読み上げた文も書く */
export const kanaLogOf = (key: string, lecture: Lecture, lang: Lang, voices: LineVoice[][]): string =>
  lecture.scenes
    .flatMap((scene, si) =>
      scene.lines.map((line, li) => {
        const text = speechIn(line, lang);
        const said = text !== line.t && lang !== 'ja' ? `\n    読み: ${text}` : '';
        return `${key} s${si + 1}-${li + 1} [${line.v ?? 'narrator'}] ${line.t}${said}\n    ${voices[si][li].kana}`;
      }),
    )
    .join('\n');

/** 訳の動画の、台詞と音声の対応（scripts/check_speech.py の聞き取りの点検が読む）。日本語は null */
export const speechFileOf = (key: string, lecture: Lecture, lang: Lang, voices: LineVoice[][]) =>
  lang === 'ja'
    ? null
    : {
        key,
        lang,
        lines: lecture.scenes.flatMap((scene, si) =>
          scene.lines.map((line, li) => ({
            at: `s${si + 1}-${li + 1}`,
            voice: line.v ?? 'narrator',
            t: line.t,
            speech: speechIn(line, lang),
            file: voices[si][li].file,
          })),
        ),
      };
