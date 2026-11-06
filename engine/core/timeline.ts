// 動画 1 本の timeline（場面と台詞が始まるフレーム）のファイルの形・書き方・指紋（React・Remotion・Node に依存しない）。
// 置き場所は content/<講座>/generated/timeline/<key>.json（engine/core/generated.ts）。scripts/synth.ts が音声の長さを測って書き、
// Remotion（src/project.ts が集め、src/Root.tsx が台本と照らし合わせる）・台本の検証（engine/core/validate.ts・scripts/validate.ts）・静止画・教材が読む。
// 指紋は「時刻に効く入力」のハッシュで、台本を直したのに合成し直していない動画を、Studio と validate が見つける
import { parseTimelineFile } from './generated';
import { sha256Hex } from './hash';
import type { Lang } from './i18n';
import type { Lecture } from './schema';
import { STING, VIDEO } from './video-config';
import { KOKORO, speechIn, VOICES } from './voices';

/** ファイルの形の版。形を変えたら上げる（読む側は、知らない版を誤りにする） */
export const TIMELINE_SCHEMA = 1;

/** 台詞 1 つ。場面の頭からのフレーム */
export type TimelineLine = { start: number; end: number };
/** 場面 1 つ。start は動画の頭からのフレーム */
export type TimelineScene = { start: number; duration: number; lines: TimelineLine[] };
/** 動画 1 本の timeline。key は動画の名前（S01・S01.en）、fingerprint は時刻に効く入力の指紋（timelineFingerprint） */
export type TimelineFile = {
  schema: typeof TIMELINE_SCHEMA;
  key: string;
  fps: number;
  durationInFrames: number;
  fingerprint: string;
  scenes: TimelineScene[];
};

/** 時刻の決め方（秒）。scripts/synth.ts が使い、指紋にも入る（変えると、全部の動画の timeline が古くなる） */
export const TIMING = {
  /** 場面の頭から、最初の台詞まで */
  leadIn: 0.45,
  /** オープニングは、ジングルの「ドン」（engine/core/video-config.ts の STING。今は 2.0 秒）の 0.05 秒あとに呼び込む */
  openingLeadIn: STING.introHitSec + 0.05,
  /** 台詞の間（これに台詞の pause を足す） */
  gap: 0.3,
  /** 負の pause で詰めても空ける、最短の間（声を重ねない） */
  minGap: 0.05,
  /** 場面の最後の台詞のあと */
  tail: 0.75,
  /** エンディングの最後（締めのジングル 3.5 秒を最後まで鳴らす） */
  endingTail: 4.0,
} as const;

/** 指紋の作り方の版。入れるものを変えたら上げる（全部の動画を合成し直す。声を変えていなければ --cached-only でよい） */
const RECIPE = 1;

/**
 * 時刻に効く入力（scripts/synth.ts の時刻の計算が読むもの）の指紋（sha256 の頭 16 字）。
 * 入れるもの: fps・時刻の決め方（TIMING）・場面の種類と hold・台詞ごとの読み（speechIn）と声の設定（音声の鍵と同じもの）・pause・sfx・sfxAfter・bgm。
 * 画面の文字（t）は、読み（s が無ければ t を辞書で開いたもの）を通してだけ入る。訳の動画は、訳を重ねたあとのレクチャーとその言語を渡す
 */
export const timelineFingerprint = (lecture: Lecture, lang: Lang): string => {
  const input = {
    recipe: RECIPE,
    fps: VIDEO.fps,
    timing: TIMING,
    scenes: lecture.scenes.map((s) => ({
      kind: s.kind,
      hold: s.hold ?? 0,
      lines: s.lines.map((l) => {
        const voice = l.v ?? 'narrator';
        return [
          speechIn(l, lang),
          lang === 'ja' ? VOICES[voice] : KOKORO[lang][voice],
          l.pause ?? 0,
          l.sfx ?? null,
          l.sfxAfter ?? null,
          l.bgm ?? null,
        ];
      }),
    })),
  };
  return sha256Hex(JSON.stringify(input)).slice(0, 16);
};

/* ───────────── 読む・書く ───────────── */

const isInt = (x: unknown, min: number): x is number => typeof x === 'number' && Number.isInteger(x) && x >= min;
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

/** 読んだ JSON が timeline の形か。違えば、どこが違うかを投げる（where はエラーに出す場所） */
export const parseTimeline = (value: unknown, where: string): TimelineFile => {
  const fail = (what: string): never => {
    throw new Error(`${where}: ${what}`);
  };
  if (!isObj(value)) return fail('JSON のオブジェクトでない');
  if (value.schema !== TIMELINE_SCHEMA) fail(`schema が ${TIMELINE_SCHEMA} でない（${JSON.stringify(value.schema)}）`);
  if (typeof value.key !== 'string' || !value.key) fail('key が無い');
  if (!isInt(value.fps, 1)) fail('fps が正の整数でない');
  if (!isInt(value.durationInFrames, 1)) fail('durationInFrames が正の整数でない');
  if (typeof value.fingerprint !== 'string' || !/^[0-9a-f]{16}$/.test(value.fingerprint))
    fail('fingerprint が 16 字の 16 進でない');
  if (!Array.isArray(value.scenes) || !value.scenes.length) fail('scenes が無い');
  let previousStart = -1;
  (value.scenes as unknown[]).forEach((s, i) => {
    if (!isObj(s) || !isInt(s.start, 0) || !isInt(s.duration, 1) || !Array.isArray(s.lines))
      fail(`場面 ${i + 1} の start・duration・lines の形が違う`);
    const scene = s as Record<string, unknown> & { start: number; lines: unknown[] };
    scene.lines.forEach((l, k) => {
      if (!isObj(l) || !isInt(l.start, 0) || !isInt(l.end, 0))
        fail(`場面 ${i + 1} の台詞 ${k + 1} の start・end が整数でない`);
      // 台詞と字幕は開始時刻から検索する。同時開始と声の重なりは保ち、順番だけを確かめる。
      const start = scene.start + (l as TimelineLine).start;
      if (start < previousStart) fail(`場面 ${i + 1} の台詞 ${k + 1} の開始時刻が前の台詞より早い`);
      previousStart = start;
    });
  });
  return value as TimelineFile;
};

/** キーを名前の順に並べる（書き直しても同じバイトになり、差分は変わった値の行だけになる） */
const sortKeys = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(sortKeys)
    : isObj(v)
      ? Object.fromEntries(
          Object.entries(v)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([k, x]) => [k, sortKeys(x)]),
        )
      : v;

/** ファイルに書く中身（キーを並べ、2 スペースで字下げし、最後に改行） */
export const timelineJson = (t: TimelineFile): string => `${JSON.stringify(sortKeys(t), null, 2)}\n`;

/* ───────────── 置いてあるファイル ───────────── */

/** 置いてある timeline のファイル 1 つ。読めなかったときは error に理由を入れる（その動画だけを止める） */
export type TimelineEntry = { file: string; course: string; key: string; timeline?: TimelineFile; error?: string };

/** ファイルのパス（リポジトリの直下から）と、読んだ JSON（読めなかったら Error）から、置いてある timeline を作る */
export const timelineEntry = (file: string, value: unknown): TimelineEntry => {
  const at = parseTimelineFile(file);
  if (!at)
    return {
      file,
      course: '',
      key: '',
      error: `${file}: timeline の置き場所（content/<講座>/generated/timeline/<key>.json）でない`,
    };
  if (value instanceof Error) return { file, ...at, error: `${file}: 読めない（${value.message}）` };
  try {
    const timeline = parseTimeline(value, file);
    if (timeline.key !== at.key)
      return { file, ...at, error: `${file}: 中の key（${timeline.key}）がファイルの名前と違う` };
    return { file, ...at, timeline };
  } catch (e) {
    return { file, ...at, error: e instanceof Error ? e.message : String(e) };
  }
};

/** 動画の名前 → 置いてあるファイル（ふつうは 1 つ。2 つ以上なら、講座のフォルダをまたいで同じ名前がある） */
export const entriesByKey = (entries: TimelineEntry[]): Map<string, TimelineEntry[]> => {
  const out = new Map<string, TimelineEntry[]>();
  for (const e of entries) out.set(e.key, [...(out.get(e.key) ?? []), e]);
  return out;
};
