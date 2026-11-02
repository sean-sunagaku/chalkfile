// 台本から台詞ごとの音声を作り、場面と台詞の時刻（タイムライン）を決める。日本語は VOICEVOX、英語と中国語は Kokoro（scripts/tts_kokoro.py）。
//   bun scripts/synth.ts                 # 全部の動画（全部の言語）
//   bun scripts/synth.ts L03 L05         # 日本語の一部だけ
//   bun scripts/synth.ts P01.en P01.zh   # 訳の動画（レクチャー ID.言語）
//   bun scripts/synth.ts 'P01.*' '*.en'  # P01 の全部の言語・英語の全部
// 出力（<key> は動画の名前。日本語は L01、訳は L01.en）:
//   .work/tts/<hash>.wav                 台詞の音声（同じ文・同じ声なら再利用）
//   src/generated/timeline.json          Remotion が読む場面・台詞の開始フレーム
//   .work/plan/<key>.json                mix.py が読むミックスの設計図（音声はこのフォルダからの相対パス）
//   site/data/<key>.json, <key>.vtt      講座サイトの台本と字幕
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { VIDEOS, type Video } from '../content';
import type { Lang } from '../content/i18n';
import type { Lecture, Scene, VoiceId } from '../content/types';
import { creditsIn, KOKORO, SITE_CREDITS, speechIn, ttsKeyIn, VOICES } from './voices';

const ROOT = path.resolve(import.meta.dir, '..');
const CACHE_ONLY = process.argv.includes('--cached-only');
const ENGINE = process.env.VOICEVOX_URL ?? 'http://127.0.0.1:50021';
const FPS = 30;

// 間の取り方（秒）
const LEAD_IN = 0.45;
const OPENING_LEAD_IN = 2.05; // ジングルの「ドン」（sting_intro の 2.0 秒）に合わせて呼び込む
const GAP = 0.3;
const MIN_GAP = 0.05;
const TAIL = 0.75;
const ENDING_TAIL = 4.0; // 締めのジングル（3.5 秒）を最後まで鳴らす

const dir = (p: string) => {
  mkdirSync(p, { recursive: true });
  return p;
};
const TTS_DIR = dir(path.join(ROOT, '.work/tts'));
const PLAN_DIR = dir(path.join(ROOT, '.work/plan'));
const KANA_DIR = dir(path.join(ROOT, '.work/kana'));
const SPEECH_DIR = dir(path.join(ROOT, '.work/speech'));
const GEN_DIR = dir(path.join(ROOT, 'src/generated'));
const SITE_DATA = dir(path.join(ROOT, 'site/data'));

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
  const key = ttsKeyIn(text, voice, 'ja');
  const file = path.join(TTS_DIR, `${key}.wav`);
  const kanaFile = path.join(TTS_DIR, `${key}.kana`);
  if (existsSync(file) && existsSync(kanaFile)) {
    return { file, sec: wavSeconds(readFileSync(file)), kana: readFileSync(kanaFile, 'utf8') };
  }
  if (CACHE_ONLY) throw new Error(`音声のキャッシュが足りません: ${key}。先に materials.ts pull で確認してください。`);
  const q = await fetch(`${ENGINE}/audio_query?speaker=${v.speaker}&text=${encodeURIComponent(text)}`, { method: 'POST' }).catch((e) => {
    throw new Error(`VOICEVOX（${ENGINE}）に届かない。台詞を変えていないなら、先に素材を取り出す（bun scripts/materials.ts pull）: ${text}`, { cause: e });
  });
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

/** 英語と中国語の台詞。Kokoro はまとめて先に作る（kokoroAll）ので、ここは作った音声を読むだけ */
const cached = (text: string, voice: VoiceId, lang: Lang): { file: string; sec: number; kana: string } => {
  const key = ttsKeyIn(text, voice, lang);
  const file = path.join(TTS_DIR, `${key}.wav`);
  const kanaFile = path.join(TTS_DIR, `${key}.kana`);
  if (!existsSync(file) || !existsSync(kanaFile)) throw new Error(`音声が無い（Kokoro で作れなかった）: ${text}`);
  return { file, sec: wavSeconds(readFileSync(file)), kana: readFileSync(kanaFile, 'utf8') };
};

/** 訳の動画で、まだ音声の無い台詞を Kokoro でまとめて作る（モデルの読み込みを 1 回にする） */
const kokoroAll = (videos: Video[]) => {
  const jobs = new Map<string, { key: string; text: string } & (typeof KOKORO)['en'][VoiceId]>();
  for (const vid of videos) {
    if (vid.lang === 'ja') continue;
    for (const scene of vid.lecture.scenes)
      for (const line of scene.lines) {
        const voice = line.v ?? 'narrator';
        const text = speechIn(line, vid.lang);
        const key = ttsKeyIn(text, voice, vid.lang);
        if (!existsSync(path.join(TTS_DIR, `${key}.wav`)) || !existsSync(path.join(TTS_DIR, `${key}.kana`))) jobs.set(key, { key, text, ...KOKORO[vid.lang][voice] });
      }
  }
  if (!jobs.size) return;
  const file = path.join(ROOT, '.work', 'kokoro-jobs.json');
  writeFileSync(file, JSON.stringify([...jobs.values()]));
  console.log(`Kokoro で ${jobs.size} 本の台詞を読み上げる（初回はモデルのダウンロードがある）`);
  const r = spawnSync('uv', ['run', '--quiet', path.join(ROOT, 'scripts/tts_kokoro.py'), file, TTS_DIR], { cwd: ROOT, stdio: 'inherit' });
  rmSync(file, { force: true });
  if (r.error || r.status !== 0) {
    throw new Error('Kokoro の読み上げに失敗した。uv が要る（README の「作り直す」）。台詞を変えていないなら、先に素材を取り出す（bun scripts/materials.ts pull）', { cause: r.error });
  }
};

type TimedLine = { start: number; end: number; file: string; text: string; voice: VoiceId; sfx?: string; sfxAfter?: string; bgm?: string; pauseAfter: number };
type TimedScene = { kind: Scene['kind']; heading: string; start: number; end: number; lines: TimedLine[] };

const sec2f = (s: number) => Math.round(s * FPS);

const buildLecture = async (lec: Lecture, lang: Lang, key: string) => {
  const scenes: TimedScene[] = [];
  const kanaLog: string[] = [];
  // 訳の動画は、聞き取りの点検（scripts/check_speech.py）用に、台詞と音声の対応を書く
  const speech: { at: string; voice: VoiceId; t: string; speech: string; file: string }[] = [];
  let t = 0;
  for (const [si, scene] of lec.scenes.entries()) {
    const start = t;
    let cursor = start + (scene.kind === 'opening' ? OPENING_LEAD_IN : LEAD_IN);
    const lines: TimedLine[] = [];
    for (const [li, line] of scene.lines.entries()) {
      const voice = line.v ?? 'narrator';
      const text = speechIn(line, lang);
      const { file, sec, kana } = lang === 'ja' ? await synth(text, voice) : cached(text, voice, lang);
      kanaLog.push(`${key} s${si + 1}-${li + 1} [${voice}] ${line.t}${text !== line.t && lang !== 'ja' ? `\n    読み: ${text}` : ''}\n    ${kana}`);
      if (lang !== 'ja') speech.push({ at: `s${si + 1}-${li + 1}`, voice, t: line.t, speech: text, file: path.relative(ROOT, file) });
      // フレームに丸めた開始時刻を正にする（映像と音を同じ時刻で揃える）
      const ls = sec2f(cursor) / FPS;
      // 負の pause は台詞の間を詰める（食い気味のツッコミ）。声が重ならないよう 0.05 秒は空ける
      const pauseAfter = Math.max(MIN_GAP, GAP + (line.pause ?? 0));
      lines.push({ start: ls, end: ls + sec, file, text: line.t, voice, sfx: line.sfx, sfxAfter: line.sfxAfter, bgm: line.bgm, pauseAfter });
      cursor = ls + sec + (li === scene.lines.length - 1 ? 0 : pauseAfter);
    }
    const tail = (scene.kind === 'ending' ? ENDING_TAIL : TAIL) + (scene.hold ?? 0);
    const end = sec2f(cursor + tail) / FPS;
    scenes.push({ kind: scene.kind, heading: scene.heading ?? '', start, end, lines });
    t = end;
  }
  writeFileSync(path.join(KANA_DIR, `${key}.txt`), kanaLog.join('\n'));
  if (lang !== 'ja') writeFileSync(path.join(SPEECH_DIR, `${key}.json`), JSON.stringify({ key, lang, lines: speech }, null, 1));
  return { scenes, duration: t };
};

const wanted = process.argv.slice(2).filter((a) => a !== '--cached-only');
// L01（日本語）・L01.en（訳）・'L01.*'（全部の言語）・'*.en'（その言語の全部）
const pick = (w: string, v: Video) => w === v.key || w === `${v.lecture.id}.*` || w === `*.${v.lang}`;
for (const w of wanted) if (!VIDEOS.some((v) => pick(w, v))) throw new Error(`動画が無い: ${w}（例: L01、P01.en、'P01.*'、'*.zh'）`);
const published = JSON.parse(readFileSync(path.join(ROOT, 'site/config.json'), 'utf8')).publishLangs as string[];
const targets = wanted.length ? VIDEOS.filter((v) => wanted.some((w) => pick(w, v))) : VIDEOS.filter((v) => published.includes(v.lang));
if (!CACHE_ONLY) kokoroAll(targets);

const timelinePath = path.join(GEN_DIR, 'timeline.json');
const timeline: Record<string, unknown> = existsSync(timelinePath) ? JSON.parse(readFileSync(timelinePath, 'utf8')) : {};

for (const { key, lang, lecture: lec, course } of targets) {
  const t0 = Date.now();
  const { scenes, duration } = await buildLecture(lec, lang, key);

  timeline[key] = {
    fps: FPS,
    durationInFrames: sec2f(duration),
    scenes: scenes.map((s) => ({
      start: sec2f(s.start),
      duration: sec2f(s.end) - sec2f(s.start),
      lines: s.lines.map((l) => ({ start: sec2f(l.start - s.start), end: sec2f(l.end - s.start) })),
    })),
  };

  writeFileSync(
    path.join(PLAN_DIR, `${key}.json`),
    JSON.stringify(
      {
        id: key,
        duration,
        scenes: scenes.map((s) => ({
          kind: s.kind,
          start: s.start,
          end: s.end,
          // 手元の場所に縛られないよう、このフォルダからの相対パスで書く
          lines: s.lines.map((l) => ({ file: path.relative(ROOT, l.file), start: l.start, end: l.end, sfx: l.sfx, sfxAfter: l.sfxAfter, bgm: l.bgm, pauseAfter: l.pauseAfter })),
        })),
      },
      null,
      1,
    ),
  );

  // 掛け合いの講座は、サイトの台本と字幕に話している人の名前を付ける（「ずんだもん：…」）
  const cast = course.cast ?? {};
  const said = (l: TimedLine) => (cast[l.voice] ? `${cast[l.voice]!.name}：${l.text}` : l.text);
  const cues = scenes.flatMap((s, si) => s.lines.map((l) => ({ start: +l.start.toFixed(2), end: +l.end.toFixed(2), text: said(l), scene: si, heading: s.heading })));
  writeFileSync(
    path.join(SITE_DATA, `${key}.json`),
    JSON.stringify({ id: key, duration: +duration.toFixed(2), chapters: scenes.map((s, si) => ({ scene: si, start: +s.start.toFixed(2), heading: s.heading || lec.title, kind: s.kind })), cues }),
  );
  const ts = (x: number) => {
    const h = Math.floor(x / 3600);
    const m = Math.floor((x % 3600) / 60);
    const s = x % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`;
  };
  writeFileSync(path.join(SITE_DATA, `${key}.vtt`), `WEBVTT\n\n${cues.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text}\n`).join('\n')}`);

  console.log(`${key} ${(duration / 60).toFixed(2)} 分  ${scenes.length} 場面  ${cues.length} 台詞  (${((Date.now() - t0) / 1000).toFixed(0)} 秒)`);
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
  for (const { key } of targets) latest[key] = timeline[key];
  writeFileSync(timelinePath, JSON.stringify(latest));
} finally {
  rmSync(lockDir, { recursive: true, force: true });
}
// 講座サイトのクレジット（全講座で共通の声）と、動画のエンディングに出すレクチャーごとのクレジット（使った声だけ）
writeFileSync(path.join(GEN_DIR, 'credits.json'), JSON.stringify(SITE_CREDITS));
const lectureCredits: Record<string, string[]> = Object.fromEntries(
  VIDEOS.map((v) => [v.key, creditsIn(v.lang, v.lecture.scenes.flatMap((s) => s.lines.map((ln) => ln.v ?? 'narrator')))]),
);
writeFileSync(path.join(GEN_DIR, 'lecture-credits.json'), JSON.stringify(lectureCredits));
