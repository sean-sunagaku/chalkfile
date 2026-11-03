// 台本から台詞ごとの音声を作り、場面と台詞の時刻（タイムライン）を決める。日本語は VOICEVOX、英語と中国語は Kokoro（scripts/tts_kokoro.py）。
//   bun scripts/synth.ts                 # 公開する言語（site/config.json の publishLangs）の全部の動画
//   bun scripts/synth.ts L03 L05         # 日本語の一部だけ
//   bun scripts/synth.ts P01.en P01.zh   # 訳の動画（レクチャー ID.言語）
//   bun scripts/synth.ts 'P01.*' '*.en'  # P01 の全部の言語・英語の全部
//   bun scripts/synth.ts --course ga4-comedy   # その講座の全部の動画（全部の言語）
//   --cached-only                        # 声を作らない（素材の声だけを使う。CI と、timeline を作り直すとき）
//   --prune                              # 台本に無い動画の timeline のファイルを消す（付けなければ、残っていることを知らせるだけ）
//   npm run chalk -- voice synth …        # 1 つの入口からも流せる（対象の選び方は --course・--video・--lang。docs/guide/commands.md の「chalk」）
// 中身は 4 つに分けている: 声の置き場所と探し方 scripts/stages/voice/store.ts・VOICEVOX scripts/stages/voice/voicevox.ts・
//   Kokoro scripts/stages/voice/kokoro.ts・時刻の計算 scripts/stages/timeline/compute.ts（純粋な関数）・出力 scripts/stages/timeline/emit.ts
// 出力（<key> は動画の名前。日本語は L01、訳は L01.en）。どのファイルも一時の名前に書いてから置き換える（別々の動画を同時に流しても壊れない）:
//   <キャッシュ>/tts/<hash>.wav・.kana   台詞の音声と読み（同じ文・同じ声なら再利用）。作業フォルダの間で共有する
//                                        （CHALKFILE_CACHE_DIR。既定 ~/.cache/chalkfile）。読むときは、無ければ前の置き場所の .work/tts/ も探す
//   content/<講座>/generated/timeline/<key>.json   Remotion が読む場面・台詞の開始フレーム（指紋つき。Git に入れる。自分の動画のファイルだけを書く）
//   .work/plan/<key>.json                mix.py が読むミックスの設計図（音声は場所に縛られない名前 .work/tts/<hash>.wav で書く）
//   .work/kana/<key>.txt                 台詞ごとの読み（カナ。訳は Kokoro に渡した音素）。.work/speech/<key>.json は訳の聞き取りの点検用
//   site/data/<key>.json                 講座サイトの台本（章と字幕の時刻。字幕の VTT はブラウザがこの台本から作る）
// 終了コード: 0 できた・1 失敗（台本の誤り・合成の失敗）・2 使い方の誤り・3 前提が足りない（素材の声・VOICEVOX・uv）
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { VIDEOS, type Video } from '../content';
import { speechIn, VOICES } from '../content/voices';
import { timelineFile } from '../engine/core/generated';
import { formatIssues, validateLecture } from '../engine/core/validate';
import { VIDEO } from '../src/video.config';
import { MissingError, readArgs, runMain, showHelp, UsageError } from './lib/args';
import { readSiteConfig } from './lib/config';
import { ROOT, ttsDirs } from './lib/paths';
import { emitVideo, type OutDirs, outDirs } from './stages/timeline/emit';
import { runKokoro } from './stages/voice/kokoro';
import { readVoice, type Voice, type VoiceStore, writeVoice } from './stages/voice/store';
import { synthesize, type Voicevox } from './stages/voice/voicevox';
import { timelineFiles } from './timelines';
import { ttsKeyIn } from './voices';

/** 書く場所と、合成のしかた（main が引数を確かめてから作る） */
type Ctx = {
  store: VoiceStore;
  out: OutDirs;
  /** 声を作らない（素材の声だけを使う） */
  cacheOnly: boolean;
  /** VOICEVOX のエンジン */
  engine: Voicevox;
};

const lacking = (key: string) =>
  new MissingError(`音声のキャッシュが足りません: ${key}。先に materials.ts pull で確認してください。`);

/** 1 本の動画の全部の台詞の声（無ければ、日本語は VOICEVOX で作る。訳は Kokoro が先にまとめて作ってある） */
const voicesOf = async (ctx: Ctx, { lecture, lang }: Video): Promise<Voice[][]> => {
  const out: Voice[][] = [];
  for (const scene of lecture.scenes) {
    const lines: Voice[] = [];
    for (const line of scene.lines) {
      const voice = line.v ?? 'narrator';
      const text = speechIn(line, lang);
      const key = ttsKeyIn(text, voice, lang);
      const found = readVoice(ctx.store, [key]);
      if (found) lines.push(found);
      else if (ctx.cacheOnly) throw lacking(key);
      else if (lang !== 'ja') throw new Error(`音声が無い（Kokoro で作れなかった）: ${text}`);
      else {
        const { wav, kana } = await synthesize(ctx.engine, text, VOICES[voice]);
        lines.push(writeVoice(ctx.store, key, wav, kana));
      }
    }
    out.push(lines);
  }
  return out;
};

/** 1 本の動画の声をそろえ、時刻を決めて出力を書く */
const synthVideo = async (ctx: Ctx, video: Video) => {
  const t0 = Date.now();
  const voices = await voicesOf(ctx, video);
  const { scenes, duration } = emitVideo(ctx.out, video, voices, VIDEO.fps);
  const lines = scenes.reduce((n, s) => n + s.lines.length, 0);
  console.log(
    `${video.key} ${(duration / 60).toFixed(2)} 分  ${scenes.length} 場面  ${lines} 台詞  (${((Date.now() - t0) / 1000).toFixed(0)} 秒)`,
  );
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
  for (const w of wanted)
    if (!VIDEOS.some((v) => pick(w, v))) throw new UsageError(`動画が無い: ${w}（例: L01、P01.en、'P01.*'、'*.zh'）`);
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
    store: ttsDirs(ROOT),
    out: outDirs(ROOT),
    cacheOnly: values['cached-only'] === true,
    engine: { url: process.env.VOICEVOX_URL ?? 'http://127.0.0.1:50021' },
  };
  // 共有のキャッシュのフォルダは、声を書くときに作る（--cached-only では作らない）
  for (const dir of [ctx.out.plan, ctx.out.kana, ctx.out.speech, ctx.out.siteData]) mkdirSync(dir, { recursive: true });
  if (!ctx.cacheOnly) await runKokoro(ctx.store, targets);
  for (const video of targets) await synthVideo(ctx, video);

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
