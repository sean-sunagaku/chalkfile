// 台本から台詞ごとの音声を作り、場面と台詞の時刻（タイムライン）を決める。日本語は VOICEVOX、英語と中国語は Kokoro（scripts/tts_kokoro.py）。
//   bun scripts/synth.ts                 # 公開する言語（site/config.json の publishLangs）の全部の動画
//   bun scripts/synth.ts L03 L05         # 日本語の一部だけ
//   bun scripts/synth.ts P01.en P01.zh   # 訳の動画（レクチャー ID.言語）
//   bun scripts/synth.ts 'P01.*' '*.en'  # P01 の全部の言語・英語の全部
//   bun scripts/synth.ts --course ga4-comedy   # その講座の全部の動画（全部の言語）
//   --cached-only                        # 声を作らない（素材の声だけを使う。CI と、timeline を作り直すとき）
//   --prune                              # 台本に無い動画の timeline のファイルを消す（付けなければ、残っていることを知らせるだけ）
// 出力（<key> は動画の名前。日本語は L01、訳は L01.en）:
//   .work/tts/<hash>.wav                 台詞の音声（同じ文・同じ声なら再利用）
//   content/<講座>/generated/timeline/<key>.json   Remotion が読む場面・台詞の開始フレーム（指紋つき。Git に入れる。自分の動画のファイルだけを書く）
//   .work/plan/<key>.json                mix.py が読むミックスの設計図（音声はこのフォルダからの相対パス）
//   site/data/<key>.json, <key>.vtt      講座サイトの台本と字幕
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { VIDEOS, type Video } from '../content';
import type { Lang } from '../content/i18n';
import type { Lecture, Scene, VoiceId } from '../content/types';
import { KOKORO, speechIn, VOICES } from '../content/voices';
import { timelineFile } from '../engine/core/generated';
import { TIMELINE_SCHEMA, TIMING, timelineFingerprint, timelineJson } from '../engine/core/timeline';
import { formatIssues, validateLecture } from '../engine/core/validate';
import { VIDEO } from '../src/video.config';
import { timelineFiles } from './timelines';
import { ttsKeyIn } from './voices';

const ROOT = path.resolve(import.meta.dir, '..');
const CACHE_ONLY = process.argv.includes('--cached-only');
const ENGINE = process.env.VOICEVOX_URL ?? 'http://127.0.0.1:50021';
const FPS = VIDEO.fps;

// 間の取り方（秒）。値は engine/core/timeline.ts の TIMING（timeline の指紋にも入る）
const LEAD_IN = TIMING.leadIn;
const OPENING_LEAD_IN = TIMING.openingLeadIn; // ジングルの「ドン」の 0.05 秒あとに呼び込む
const GAP = TIMING.gap;
const MIN_GAP = TIMING.minGap;
const TAIL = TIMING.tail;
const ENDING_TAIL = TIMING.endingTail; // 締めのジングル（3.5 秒）を最後まで鳴らす

const dir = (p: string) => {
  mkdirSync(p, { recursive: true });
  return p;
};
const TTS_DIR = dir(path.join(ROOT, '.work/tts'));
const PLAN_DIR = dir(path.join(ROOT, '.work/plan'));
const KANA_DIR = dir(path.join(ROOT, '.work/kana'));
const SPEECH_DIR = dir(path.join(ROOT, '.work/speech'));
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
  // 依存の版は scripts/tts_kokoro.py.lock で固定する（--locked: ロックと頭書きがずれていたら止まる）
  const r = spawnSync('uv', ['run', '--quiet', '--locked', '--script', path.join(ROOT, 'scripts/tts_kokoro.py'), file, TTS_DIR], { cwd: ROOT, stdio: 'inherit' });
  rmSync(file, { force: true });
  if (r.error || r.status !== 0) {
    throw new Error('Kokoro の読み上げに失敗した。uv が要る（docs/guide/quickstart.md の「前提の道具」）。台詞を変えていないなら、先に素材を取り出す（bun scripts/materials.ts pull）', { cause: r.error });
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

// 引数: 動画の名前（L01）・訳（L01.en）・'L01.*'（全部の言語）・'*.en'（その言語の全部）・--course <講座 ID>（その講座の全部の言語）
const wanted: string[] = [];
const courseIds: string[] = [];
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--cached-only' || a === '--prune') continue;
  if (a === '--course' || a.startsWith('--course=')) {
    const id = a === '--course' ? argv[++i] : a.slice('--course='.length);
    if (!id) throw new Error('--course には講座 ID を渡す（例: --course ga4-comedy）');
    if (!VIDEOS.some((v) => v.course.id === id)) throw new Error(`講座が無い: ${id}`);
    courseIds.push(id);
    continue;
  }
  if (a.startsWith('-')) throw new Error(`知らない引数: ${a}（使えるのは --cached-only・--prune・--course <講座 ID>）`);
  wanted.push(a);
}
const PRUNE = argv.includes('--prune');
const pick = (w: string, v: Video) => w === v.key || w === `${v.lecture.id}.*` || w === `*.${v.lang}`;
for (const w of wanted) if (!VIDEOS.some((v) => pick(w, v))) throw new Error(`動画が無い: ${w}（例: L01、P01.en、'P01.*'、'*.zh'）`);
const published = JSON.parse(readFileSync(path.join(ROOT, 'site/config.json'), 'utf8')).publishLangs as string[];
const targets =
  wanted.length || courseIds.length
    ? VIDEOS.filter((v) => wanted.some((w) => pick(w, v)) || courseIds.includes(v.course.id))
    : VIDEOS.filter((v) => published.includes(v.lang));
// 声を作る前に、対象の動画の台本を確かめる（矢印の行き先・at の範囲など。全部の講座は bun scripts/validate.ts）
const invalid = targets.flatMap((v) => validateLecture(v.lecture, v.course)).filter((x) => x.level === 'error');
if (invalid.length) {
  console.error(formatIssues(invalid));
  throw new Error(`台本に誤りが ${invalid.length} 件ある。直してから合成する（全部の講座の一覧は bun scripts/validate.ts）`);
}
if (!CACHE_ONLY) kokoroAll(targets);

/** 一時の名前に書いてから置き換える（途中で止まっても、前の中身か新しい中身のどちらかになる。同時に流しても壊れない） */
const writeAtomic = (file: string, text: string) => {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  writeFileSync(tmp, text);
  renameSync(tmp, file);
};

for (const { key, lang, lecture: lec, course } of targets) {
  const t0 = Date.now();
  const { scenes, duration } = await buildLecture(lec, lang, key);

  // 自分の動画のファイルだけを書く（講座のフォルダの generated/timeline/<key>.json。ほかの動画のファイルには触らない）
  writeAtomic(
    path.join(ROOT, timelineFile(course.id, key)),
    timelineJson({
      schema: TIMELINE_SCHEMA,
      key,
      fps: FPS,
      durationInFrames: sec2f(duration),
      fingerprint: timelineFingerprint(lec, lang),
      scenes: scenes.map((s) => ({
        start: sec2f(s.start),
        duration: sec2f(s.end) - sec2f(s.start),
        lines: s.lines.map((l) => ({ start: sec2f(l.start - s.start), end: sec2f(l.end - s.start) })),
      })),
    }),
  );

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

// 台本に無い動画の timeline（消した動画・名前や講座を変えた動画）。--prune を付けたときだけ消す
const expected = new Set(VIDEOS.map((v) => timelineFile(v.course.id, v.key)));
const stale = timelineFiles().filter((f) => !expected.has(f));
if (stale.length && PRUNE) {
  for (const f of stale) rmSync(path.join(ROOT, f), { force: true });
  console.log(`台本に無い動画の timeline を消した: ${stale.join(' ')}`);
} else if (stale.length) {
  console.warn(`台本に無い動画の timeline が残っている（消すなら --prune）: ${stale.join(' ')}`);
}
