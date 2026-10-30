// 台本から VOICEVOX で台詞ごとの音声を作り、場面と台詞の時刻（タイムライン）を決める。
//   bun scripts/synth.ts            # 全レクチャー
//   bun scripts/synth.ts L03 L05    # 一部だけ
// 出力:
//   .work/tts/<hash>.wav                 台詞の音声（同じ文・同じ声なら再利用）
//   src/generated/timeline.json          Remotion が読む場面・台詞の開始フレーム
//   .work/plan/<id>.json                 mix.py が読むミックスの設計図
//   site/data/<id>.json, <id>.vtt        講座サイトの台本と字幕
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { LECTURES } from '../content';
import { toSpeech } from '../content/reading';
import type { Lecture, Line, Scene, VoiceId } from '../content/types';

const ROOT = path.resolve(import.meta.dir, '..');
const ENGINE = process.env.VOICEVOX_URL ?? 'http://127.0.0.1:50021';
const FPS = 30;

const VOICES: Record<VoiceId, { speaker: number; speed: number; intonation: number; pitch: number; credit: string }> = {
  // No.7（ノーマル）: 講師。Whisper での聞き取りが候補の中で一番正確だった
  narrator: { speaker: 29, speed: 1.06, intonation: 1.12, pitch: 0, credit: 'VOICEVOX:No.7' },
  // 青山龍星（ノーマル）: レクチャー名の呼び込み
  announcer: { speaker: 13, speed: 1.0, intonation: 1.25, pitch: 0, credit: 'VOICEVOX:青山龍星' },
};

// 間の取り方（秒）
const LEAD_IN = 0.45;
const OPENING_LEAD_IN = 2.05; // ジングルの「ドン」（sting_intro の 2.0 秒）に合わせて呼び込む
const GAP = 0.3;
const TAIL = 0.75;
const ENDING_TAIL = 4.0; // 締めのジングル（3.5 秒）を最後まで鳴らす

const dir = (p: string) => {
  mkdirSync(p, { recursive: true });
  return p;
};
const TTS_DIR = dir(path.join(ROOT, '.work/tts'));
const PLAN_DIR = dir(path.join(ROOT, '.work/plan'));
const KANA_DIR = dir(path.join(ROOT, '.work/kana'));
const GEN_DIR = dir(path.join(ROOT, 'src/generated'));
const SITE_DATA = dir(path.join(ROOT, 'site/data'));

const speechOf = (line: Line): string => {
  const s = toSpeech(line.s ?? line.t);
  if (/[A-Za-z]/.test(s)) throw new Error(`英字が残っている: ${s}`);
  return s;
};

const wavSeconds = (buf: Buffer): number => {
  // RIFF の fmt と data チャンクから長さを出す
  let off = 12;
  let rate = 0;
  let block = 0;
  while (off < buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') {
      rate = buf.readUInt32LE(off + 12);
      block = buf.readUInt16LE(off + 20);
    }
    if (id === 'data') return size / (rate * block);
    off += 8 + size + (size % 2);
  }
  throw new Error('data チャンクが無い');
};

const synth = async (text: string, voice: VoiceId): Promise<{ file: string; sec: number; kana: string }> => {
  const v = VOICES[voice];
  const key = createHash('sha1').update(JSON.stringify([text, v])).digest('hex').slice(0, 16);
  const file = path.join(TTS_DIR, `${key}.wav`);
  const kanaFile = path.join(TTS_DIR, `${key}.kana`);
  if (existsSync(file) && existsSync(kanaFile)) {
    return { file, sec: wavSeconds(readFileSync(file)), kana: readFileSync(kanaFile, 'utf8') };
  }
  const q = await fetch(`${ENGINE}/audio_query?speaker=${v.speaker}&text=${encodeURIComponent(text)}`, { method: 'POST' });
  if (!q.ok) throw new Error(`audio_query ${q.status}: ${text}`);
  const query = await q.json();
  query.speedScale = v.speed;
  query.intonationScale = v.intonation;
  query.pitchScale = v.pitch;
  query.volumeScale = 1.0;
  query.prePhonemeLength = 0.08;
  query.postPhonemeLength = 0.12;
  query.outputSamplingRate = 48000;
  query.outputStereo = false;
  const kana = query.accent_phrases
    .map((ap: { moras: { text: string }[]; pause_mora?: { text: string } | null }) =>
      ap.moras.map((m) => m.text).join('') + (ap.pause_mora ? '、' : ''))
    .join('');
  const s = await fetch(`${ENGINE}/synthesis?speaker=${v.speaker}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query),
  });
  if (!s.ok) throw new Error(`synthesis ${s.status}: ${text}`);
  const buf = Buffer.from(await s.arrayBuffer());
  writeFileSync(file, buf);
  writeFileSync(kanaFile, kana);
  return { file, sec: wavSeconds(buf), kana };
};

type TimedLine = { start: number; end: number; file: string; text: string; voice: VoiceId; sfx?: string; pauseAfter: number };
type TimedScene = { kind: Scene['kind']; heading: string; start: number; end: number; lines: TimedLine[] };

const sec2f = (s: number) => Math.round(s * FPS);

const buildLecture = async (lec: Lecture) => {
  const scenes: TimedScene[] = [];
  const kanaLog: string[] = [];
  let t = 0;
  for (const [si, scene] of lec.scenes.entries()) {
    const start = t;
    let cursor = start + (scene.kind === 'opening' ? OPENING_LEAD_IN : LEAD_IN);
    const lines: TimedLine[] = [];
    for (const [li, line] of scene.lines.entries()) {
      const voice = line.v ?? 'narrator';
      const text = speechOf(line);
      const { file, sec, kana } = await synth(text, voice);
      kanaLog.push(`${lec.id} s${si + 1}-${li + 1} [${voice}] ${line.t}\n    ${kana}`);
      // フレームに丸めた開始時刻を正にする（映像と音を同じ時刻で揃える）
      const ls = sec2f(cursor) / FPS;
      const pauseAfter = GAP + (line.pause ?? 0);
      lines.push({ start: ls, end: ls + sec, file, text: line.t, voice, sfx: line.sfx, pauseAfter });
      cursor = ls + sec + (li === scene.lines.length - 1 ? 0 : pauseAfter);
    }
    const tail = (scene.kind === 'ending' ? ENDING_TAIL : TAIL) + (scene.hold ?? 0);
    const end = sec2f(cursor + tail) / FPS;
    scenes.push({ kind: scene.kind, heading: scene.heading ?? '', start, end, lines });
    t = end;
  }
  writeFileSync(path.join(KANA_DIR, `${lec.id}.txt`), kanaLog.join('\n'));
  return { scenes, duration: t };
};

const wanted = process.argv.slice(2);
const targets = wanted.length ? LECTURES.filter((l) => wanted.includes(l.id)) : LECTURES;

const timelinePath = path.join(GEN_DIR, 'timeline.json');
const timeline: Record<string, unknown> = existsSync(timelinePath) ? JSON.parse(readFileSync(timelinePath, 'utf8')) : {};

for (const lec of targets) {
  const t0 = Date.now();
  const { scenes, duration } = await buildLecture(lec);

  timeline[lec.id] = {
    fps: FPS,
    durationInFrames: sec2f(duration),
    scenes: scenes.map((s) => ({
      start: sec2f(s.start),
      duration: sec2f(s.end) - sec2f(s.start),
      lines: s.lines.map((l) => ({ start: sec2f(l.start - s.start), end: sec2f(l.end - s.start) })),
    })),
  };

  writeFileSync(
    path.join(PLAN_DIR, `${lec.id}.json`),
    JSON.stringify(
      {
        id: lec.id,
        duration,
        scenes: scenes.map((s) => ({
          kind: s.kind,
          start: s.start,
          end: s.end,
          lines: s.lines.map((l) => ({ file: l.file, start: l.start, end: l.end, sfx: l.sfx, pauseAfter: l.pauseAfter })),
        })),
      },
      null,
      1,
    ),
  );

  const cues = scenes.flatMap((s, si) => s.lines.map((l) => ({ start: +l.start.toFixed(2), end: +l.end.toFixed(2), text: l.text, scene: si, heading: s.heading })));
  writeFileSync(
    path.join(SITE_DATA, `${lec.id}.json`),
    JSON.stringify({ id: lec.id, duration: +duration.toFixed(2), chapters: scenes.map((s, si) => ({ scene: si, start: +s.start.toFixed(2), heading: s.heading || lec.title, kind: s.kind })), cues }),
  );
  const ts = (x: number) => {
    const h = Math.floor(x / 3600);
    const m = Math.floor((x % 3600) / 60);
    const s = x % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`;
  };
  writeFileSync(path.join(SITE_DATA, `${lec.id}.vtt`), `WEBVTT\n\n${cues.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text}\n`).join('\n')}`);

  console.log(`${lec.id} ${(duration / 60).toFixed(2)} 分  ${scenes.length} 場面  ${cues.length} 台詞  (${((Date.now() - t0) / 1000).toFixed(0)} 秒)`);
}

// 複数の synth を同時に流しても互いの結果を消さないように、ロックを取ってから読み直し、自分のレクチャーだけ差し替える
const lockDir = `${timelinePath}.lock`;
for (let i = 0; ; i++) {
  try {
    mkdirSync(lockDir);
    break;
  } catch {
    if (i > 600) throw new Error(`${lockDir} が 60 秒外れない（前の synth が落ちたなら消す）`);
    Bun.sleepSync(100);
  }
}
try {
  const latest: Record<string, unknown> = existsSync(timelinePath) ? JSON.parse(readFileSync(timelinePath, 'utf8')) : {};
  for (const lec of targets) latest[lec.id] = timeline[lec.id];
  writeFileSync(timelinePath, JSON.stringify(latest));
} finally {
  rmSync(lockDir, { recursive: true, force: true });
}
writeFileSync(path.join(GEN_DIR, 'credits.json'), JSON.stringify(Object.values(VOICES).map((v) => v.credit)));
