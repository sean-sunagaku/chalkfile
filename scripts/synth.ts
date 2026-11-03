// 台本から台詞ごとの音声を作り、場面と台詞の時刻（タイムライン）を決める。日本語は VOICEVOX、英語と中国語は Kokoro（scripts/tts_kokoro.py）。
//   bun scripts/synth.ts                 # 公開する言語（site/config.json の publishLangs）の全部の動画
//   bun scripts/synth.ts L03 L05         # 日本語の一部だけ
//   bun scripts/synth.ts P01.en P01.zh   # 訳の動画（レクチャー ID.言語）
//   bun scripts/synth.ts 'P01.*' '*.en'  # P01 の全部の言語・英語の全部
//   bun scripts/synth.ts --course ga4-comedy   # その講座の全部の動画（全部の言語）
//   --cached-only                        # 声を作らない（素材の声だけを使う。CI と、timeline を作り直すとき）
//   --prune                              # 台本に無い動画の timeline のファイルを消す（付けなければ、残っていることを知らせるだけ）
//   npm run chalk -- voice synth …        # 1 つの入口からも流せる（対象の選び方は --course・--video・--lang。docs/guide/commands.md の「chalk」）
// 出力（<key> は動画の名前。日本語は L01、訳は L01.en）。どのファイルも一時の名前に書いてから置き換える（別々の動画を同時に流しても壊れない）:
//   <キャッシュ>/tts/<hash>.wav・.kana   台詞の音声と読み（同じ文・同じ声なら再利用）。作業フォルダの間で共有する
//                                        （CHALKFILE_CACHE_DIR。既定 ~/.cache/chalkfile）。読むときは、無ければ前の置き場所の .work/tts/ も探す
//   content/<講座>/generated/timeline/<key>.json   Remotion が読む場面・台詞の開始フレーム（指紋つき。Git に入れる。自分の動画のファイルだけを書く）
//   .work/plan/<key>.json                mix.py が読むミックスの設計図（音声は場所に縛られない名前 .work/tts/<hash>.wav で書く）
//   .work/kana/<key>.txt                 台詞ごとの読み（カナ。訳は Kokoro に渡した音素）。.work/speech/<key>.json は訳の聞き取りの点検用
//   site/data/<key>.json, <key>.vtt      講座サイトの台本と字幕
// 終了コード: 0 できた・1 失敗（台本の誤り・合成の失敗）・2 使い方の誤り・3 前提が足りない（素材の声・VOICEVOX・uv）
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { VIDEOS, type Video } from '../content';
import type { Lang } from '../content/i18n';
import type { Lecture, Scene, VoiceId } from '../content/types';
import { KOKORO, speechIn, VOICES } from '../content/voices';
import { timelineFile } from '../engine/core/generated';
import { TIMELINE_SCHEMA, TIMING, timelineFingerprint, timelineJson } from '../engine/core/timeline';
import { formatIssues, validateLecture } from '../engine/core/validate';
import { VIDEO } from '../engine/core/video-config';
import { MissingError, readArgs, runMain, showHelp, UsageError } from './lib/args';
import { readSiteConfig } from './lib/config';
import { withLock, writeAtomic } from './lib/fsx';
import { ROOT, TTS_REL, ttsDirs } from './lib/paths';
import { runInherit } from './lib/proc';
import { wavSeconds } from './lib/wav';
import { timelineFiles } from './timelines';
import { ttsKeyIn } from './voices';

const FPS = VIDEO.fps;

// 間の取り方（秒）。値は engine/core/timeline.ts の TIMING（timeline の指紋にも入る）
const LEAD_IN = TIMING.leadIn;
const OPENING_LEAD_IN = TIMING.openingLeadIn; // ジングルの「ドン」の 0.05 秒あとに呼び込む
const GAP = TIMING.gap;
const MIN_GAP = TIMING.minGap;
const TAIL = TIMING.tail;
const ENDING_TAIL = TIMING.endingTail; // 締めのジングル（3.5 秒）を最後まで鳴らす

/** 書く場所と、合成のしかた（main が引数を確かめてから作る） */
type Ctx = {
  /** 台詞の音声と読み。書くのは共有のキャッシュ（cache）。読むときは、無ければ作業フォルダの .work/tts（local）も探す */
  tts: { cache: string; local: string };
  plan: string;
  kana: string;
  speech: string;
  siteData: string;
  /** 声を作らない（素材の声だけを使う） */
  cacheOnly: boolean;
  /** VOICEVOX のエンジン */
  engine: string;
};
/** 台詞の音声（file は場所に縛られない名前 .work/tts/<鍵>.wav）・長さ（秒）・読み */
type Voice = { file: string; sec: number; kana: string };

/** 作ってある台詞の音声と読みのフォルダ（同じフォルダに両方そろっているもの。先に共有のキャッシュ） */
const voiceDir = (ctx: Ctx, key: string): string | null =>
  [ctx.tts.cache, ctx.tts.local].find((dir) => existsSync(path.join(dir, `${key}.wav`)) && existsSync(path.join(dir, `${key}.kana`))) ?? null;

/** 作ってある台詞の音声と読み。音声は、途中で切れていないかを確かめてから使う */
const readVoice = (ctx: Ctx, key: string): Voice | null => {
  const dir = voiceDir(ctx, key);
  if (!dir) return null;
  const wav = path.join(dir, `${key}.wav`);
  let sec: number;
  try {
    sec = wavSeconds(readFileSync(wav));
  } catch (e) {
    throw new Error(`音声が壊れている: ${wav}（${e instanceof Error ? e.message : e}）。消してから、もう一度取り出すか作る（bun scripts/materials.ts pull）`);
  }
  return { file: `${TTS_REL}/${key}.wav`, sec, kana: readFileSync(path.join(dir, `${key}.kana`), 'utf8') };
};
const lacking = (key: string) =>
  new MissingError(`音声のキャッシュが足りません: ${key}。先に materials.ts pull で確認してください。`);

const synth = async (ctx: Ctx, text: string, voice: VoiceId): Promise<Voice> => {
  const v = VOICES[voice];
  const key = ttsKeyIn(text, voice, 'ja');
  const found = readVoice(ctx, key);
  if (found) return found;
  if (ctx.cacheOnly) throw lacking(key);
  const q = await fetch(`${ctx.engine}/audio_query?speaker=${v.speaker}&text=${encodeURIComponent(text)}`, { method: 'POST' }).catch((e) => {
    throw new MissingError(`VOICEVOX（${ctx.engine}）に届かない。台詞を変えていないなら、先に素材を取り出す（bun scripts/materials.ts pull）: ${text}`, { cause: e });
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
  const s = await fetch(`${ctx.engine}/synthesis?speaker=${v.speaker}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query),
  });
  if (!s.ok) throw new Error(`synthesis ${s.status}: ${text}`);
  const buf = Buffer.from(await s.arrayBuffer());
  const sec = wavSeconds(buf);
  // 共有のキャッシュに、音声を先に、読みを後に置き換える（読みがあれば、音声も書き終えている。
  // 同じ台詞をほかの synth が同時に作っても、ほかの作業フォルダが読んでいても壊れない）
  writeAtomic(path.join(ctx.tts.cache, `${key}.wav`), buf);
  writeAtomic(path.join(ctx.tts.cache, `${key}.kana`), kana);
  return { file: `${TTS_REL}/${key}.wav`, sec, kana };
};

/** 英語と中国語の台詞。Kokoro はまとめて先に作る（kokoroAll）ので、ここは作った音声を読むだけ */
const cached = (ctx: Ctx, text: string, voice: VoiceId, lang: Lang): Voice => {
  const key = ttsKeyIn(text, voice, lang);
  const found = readVoice(ctx, key);
  if (found) return found;
  if (ctx.cacheOnly) throw lacking(key);
  throw new Error(`音声が無い（Kokoro で作れなかった）: ${text}`);
};

/** 訳の動画で、まだ音声の無い台詞（Kokoro に渡す仕事） */
const kokoroJobs = (ctx: Ctx, videos: Video[]) => {
  const jobs = new Map<string, { key: string; text: string } & (typeof KOKORO)['en'][VoiceId]>();
  for (const vid of videos) {
    if (vid.lang === 'ja') continue;
    for (const scene of vid.lecture.scenes)
      for (const line of scene.lines) {
        const voice = line.v ?? 'narrator';
        const text = speechIn(line, vid.lang);
        const key = ttsKeyIn(text, voice, vid.lang);
        if (!voiceDir(ctx, key)) jobs.set(key, { key, text, ...KOKORO[vid.lang][voice] });
      }
  }
  return [...jobs.values()];
};

/**
 * 訳の動画で、まだ音声の無い台詞を Kokoro でまとめて作り、共有のキャッシュに書く（モデルの読み込みを 1 回にする）。
 * ほかの synth（ほかの作業フォルダのものも）が Kokoro を流している間は待ち（キャッシュのロック）、
 * 終わってから足りない台詞を数え直す（同じ台詞を 2 回作らない）
 */
const kokoroAll = async (ctx: Ctx, videos: Video[]) => {
  if (!kokoroJobs(ctx, videos).length) return;
  await withLock(
    path.join(ctx.tts.cache, '.kokoro.lock'),
    () => {
      const jobs = kokoroJobs(ctx, videos);
      if (!jobs.length) return;
      // ジョブのファイルは、流すたびに別の一時フォルダに置く（同時に流した synth のジョブと混ざらない）
      const tmp = mkdtempSync(path.join(tmpdir(), 'chalkfile-kokoro-'));
      try {
        const file = path.join(tmp, 'jobs.json');
        writeFileSync(file, JSON.stringify(jobs));
        console.log(`Kokoro で ${jobs.length} 本の台詞を読み上げる（初回はモデルのダウンロードがある）`);
        // 依存の版は scripts/tts_kokoro.py.lock で固定する（--locked: ロックと頭書きがずれていたら止まる）
        const code = runInherit('uv', ['run', '--quiet', '--locked', '--script', path.join(ROOT, 'scripts/tts_kokoro.py'), file, ctx.tts.cache], { cwd: ROOT });
        if (code !== 0) {
          throw new Error('Kokoro の読み上げに失敗した。uv が要る（docs/guide/quickstart.md の「前提の道具」）。台詞を変えていないなら、先に素材を取り出す（bun scripts/materials.ts pull）');
        }
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
    },
    { what: 'Kokoro の読み上げ', timeoutMs: 60 * 60_000, log: console.log },
  );
};

type TimedLine = { start: number; end: number; file: string; text: string; voice: VoiceId; sfx?: string; sfxAfter?: string; bgm?: string; pauseAfter: number };
type TimedScene = { kind: Scene['kind']; heading: string; start: number; end: number; lines: TimedLine[] };

const sec2f = (s: number) => Math.round(s * FPS);

const buildLecture = async (ctx: Ctx, lec: Lecture, lang: Lang, key: string) => {
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
      const { file, sec, kana } = lang === 'ja' ? await synth(ctx, text, voice) : cached(ctx, text, voice, lang);
      kanaLog.push(`${key} s${si + 1}-${li + 1} [${voice}] ${line.t}${text !== line.t && lang !== 'ja' ? `\n    読み: ${text}` : ''}\n    ${kana}`);
      if (lang !== 'ja') speech.push({ at: `s${si + 1}-${li + 1}`, voice, t: line.t, speech: text, file });
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
  writeAtomic(path.join(ctx.kana, `${key}.txt`), kanaLog.join('\n'));
  if (lang !== 'ja') writeAtomic(path.join(ctx.speech, `${key}.json`), JSON.stringify({ key, lang, lines: speech }, null, 1));
  return { scenes, duration: t };
};

/** 1 本の動画の出力（timeline・設計図・サイトの台本と字幕）を書く */
const emit = async (ctx: Ctx, { key, lang, lecture: lec, course }: Video) => {
  const t0 = Date.now();
  const { scenes, duration } = await buildLecture(ctx, lec, lang, key);

  // 自分の動画のファイルだけを書く（講座のフォルダの generated/timeline/<key>.json。ほかの動画のファイルには触らない）。
  // どのファイルも一時の名前に書いてから置き換える（別々の動画の synth を同時に流しても、書きかけのファイルが見えない）
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

  writeAtomic(
    path.join(ctx.plan, `${key}.json`),
    JSON.stringify(
      {
        id: key,
        duration,
        scenes: scenes.map((s) => ({
          kind: s.kind,
          start: s.start,
          end: s.end,
          // 手元の場所に縛られない名前（.work/tts/<鍵>.wav）で書く。mix.py が、共有のキャッシュか .work/tts から探す
          lines: s.lines.map((l) => ({ file: l.file, start: l.start, end: l.end, sfx: l.sfx, sfxAfter: l.sfxAfter, bgm: l.bgm, pauseAfter: l.pauseAfter })),
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
  writeAtomic(
    path.join(ctx.siteData, `${key}.json`),
    JSON.stringify({ id: key, duration: +duration.toFixed(2), chapters: scenes.map((s, si) => ({ scene: si, start: +s.start.toFixed(2), heading: s.heading || lec.title, kind: s.kind })), cues }),
  );
  const ts = (x: number) => {
    const h = Math.floor(x / 3600);
    const m = Math.floor((x % 3600) / 60);
    const s = x % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`;
  };
  writeAtomic(path.join(ctx.siteData, `${key}.vtt`), `WEBVTT\n\n${cues.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text}\n`).join('\n')}`);

  console.log(`${key} ${(duration / 60).toFixed(2)} 分  ${scenes.length} 場面  ${cues.length} 台詞  (${((Date.now() - t0) / 1000).toFixed(0)} 秒)`);
};

/** 動画の名前（L01）・訳（L01.en）・'L01.*'（全部の言語）・'*.en'（その言語の全部） */
const pick = (w: string, v: Video) => w === v.key || w === `${v.lecture.id}.*` || w === `*.${v.lang}`;

const main = async (argv: string[]) => {
  const { values, positionals: wanted } = readArgs(
    argv,
    { 'cached-only': { type: 'boolean' }, prune: { type: 'boolean' }, course: { type: 'string', multiple: true } },
    { positionals: true },
  );
  if (values.help) return showHelp(import.meta.filename);
  const courseIds = values.course ?? [];
  for (const id of courseIds) if (!VIDEOS.some((v) => v.course.id === id)) throw new UsageError(`講座が無い: ${id}`);
  for (const w of wanted) if (!VIDEOS.some((v) => pick(w, v))) throw new UsageError(`動画が無い: ${w}（例: L01、P01.en、'P01.*'、'*.zh'）`);
  const published: string[] = readSiteConfig().publishLangs;
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

  const ctx: Ctx = {
    tts: ttsDirs(ROOT),
    plan: path.join(ROOT, '.work/plan'),
    kana: path.join(ROOT, '.work/kana'),
    speech: path.join(ROOT, '.work/speech'),
    siteData: path.join(ROOT, 'site/data'),
    cacheOnly: values['cached-only'] === true,
    engine: process.env.VOICEVOX_URL ?? 'http://127.0.0.1:50021',
  };
  // 共有のキャッシュのフォルダは、声を書くときに作る（--cached-only では作らない）
  for (const dir of [ctx.plan, ctx.kana, ctx.speech, ctx.siteData]) mkdirSync(dir, { recursive: true });
  if (!ctx.cacheOnly) await kokoroAll(ctx, targets);
  for (const video of targets) await emit(ctx, video);

  // 台本に無い動画の timeline（消した動画・名前や講座を変えた動画）。--prune を付けたときだけ消す
  const expected = new Set(VIDEOS.map((v) => timelineFile(v.course.id, v.key)));
  const stale = timelineFiles().filter((f) => !expected.has(f));
  if (stale.length && values.prune) {
    for (const f of stale) rmSync(path.join(ROOT, f), { force: true });
    console.log(`台本に無い動画の timeline を消した: ${stale.join(' ')}`);
  } else if (stale.length) {
    console.warn(`台本に無い動画の timeline が残っている（消すなら --prune）: ${stale.join(' ')}`);
  }
};

if (import.meta.main) await runMain(main);
