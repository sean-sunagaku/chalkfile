// 台本から台詞ごとの音声を作り、場面と台詞の時刻（タイムライン）を決める。日本語は VOICEVOX、英語と中国語は Kokoro（scripts/tts_kokoro.py）。
//   bun scripts/synth.ts                 # 公開する言語（chalkfile.config.ts の publishLangs）の全部の動画
//   bun scripts/synth.ts L03 L05         # 日本語の一部だけ
//   bun scripts/synth.ts P01.en P01.zh   # 訳の動画（レクチャー ID.言語）
//   bun scripts/synth.ts 'P01.*' '*.en'  # P01 の全部の言語・英語の全部
//   bun scripts/synth.ts --course ga4-comedy   # その講座の全部の動画（全部の言語）
//   --cached-only                        # 声を作らない（素材の声だけを使う。CI と、timeline を作り直すとき）
//   --cached-only --durations-only       # 音声を取り出さず、素材のブランチの長さの一覧（DURATIONS.json）と読みだけで時刻を決める（CI 用。
//                                        # ffmpeg も要らない）。timeline と site/data は、音声から作ったときと同じバイト列になる。音声は手元に
//                                        # 来ないので、このあと mix と render はできない（materials pull が要る）。DURATIONS.json がまだ無い・
//                                        # 足りない・古いときは、今までどおり音声を取り出してから作る
//   --prune                              # 台本に無い動画の timeline のファイルを消す（付けなければ、残っていることを知らせるだけ）
//   --verbose（-v）                       # 台詞ごとの声の見つけ方（キャッシュ・合成）と、VOICEVOX・uv への問い合わせも出す
//   npm run chalk -- voice synth …        # 1 つの入口からも流せる（対象の選び方は --course・--video・--lang。docs/guide/commands.md の「chalk」）
// 中身は段の部品に分けている: 声の置き場所と探し方 scripts/stages/voice/store.ts・VOICEVOX scripts/stages/voice/voicevox.ts・
//   Kokoro scripts/stages/voice/kokoro.ts・時刻の計算 scripts/stages/timeline/compute.ts（純粋な関数）・出力 scripts/stages/timeline/emit.ts
// VOICEVOX（VOICEVOX_URL。既定 http://127.0.0.1:50021）の呼び出しは、1 回 60 秒（VOICEVOX_TIMEOUT＝秒で変える）で時間切れにし、
//   つながらない・時間切れ・5xx は 3 回まで試す。エンジンが止まったままでも、決まった時間で終了コード 3 で止まる。Kokoro も台詞の数から決めた時間で止める
// 出力（<key> は動画の名前。日本語は L01、訳は L01.en）。どのファイルも一時の名前に書いてから置き換える（別々の動画を同時に流しても壊れない）:
//   <キャッシュ>/tts/<鍵>.wav・.kana     台詞の音声と読み（同じ文・同じ合成のレシピなら再利用）。作業フォルダの間で共有する
//                                        （CHALKFILE_CACHE_DIR。既定 ~/.cache/chalkfile）。読むときは、無ければ前の置き場所の .work/tts/ も探す。
//                                        鍵は v2 → v1 の順に探し、新しく作る声には v2 の鍵を付ける（scripts/voices.ts の ttsKeysIn）
//   content/<講座>/generated/timeline/<key>.json   Remotion が読む場面・台詞の開始フレーム（指紋つき。Git に入れる。自分の動画のファイルだけを書く）
//   .work/plan/<key>.json                mix.py が読むミックスの設計図（音声は場所に縛られない名前 .work/tts/<hash>.wav で書く）
//   .work/kana/<key>.txt                 台詞ごとの読み（カナ。訳は Kokoro に渡した音素）。.work/speech/<key>.json は訳の聞き取りの点検用
//   site/data/<key>.json                 講座サイトの台本（章と字幕の時刻。字幕の VTT はブラウザがこの台本から作る）
// 終了コード: 0 できた・1 失敗（台本の誤り・合成の失敗）・2 使い方の誤り・3 前提が足りない（素材の声・VOICEVOX・uv）
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { VIDEOS, type Video } from '../content';
import { speechIn } from '../content/voices';
import { timelineFile } from '../engine/core/generated';
import { formatIssues, validateLecture } from '../engine/core/validate';
import { VIDEO } from '../engine/core/video-config';
import { MissingError, readArgs, runMain, showHelp, UsageError } from './lib/args';
import { readSiteConfig } from './lib/config';
import { ROOT, TTS_REL, ttsDirs } from './lib/paths';
import { setVerbose, trace } from './lib/proc';
import { emitVideo, type OutDirs, outDirs } from './stages/timeline/emit';
import { runKokoro } from './stages/voice/kokoro';
import {
  cacheSource,
  durationSource,
  type Voice,
  type VoiceSource,
  type VoiceStore,
  versionsOf,
  writeVoice,
} from './stages/voice/store';
import { timeoutFromEnv, type Voicevox, voicevox } from './stages/voice/voicevox';
import { timelineFiles } from './timelines';
import { defaultRepo, type Options as PullOptions, pull, pullDurations, type Repo } from './materials';
import { recipeIn, ttsKeysIn, type VoicevoxRecipe } from './voices';

/** 書く場所と、合成のしかた（main が引数を確かめてから作る。テストは一時のフォルダと偽の VOICEVOX で作る） */
export type Ctx = {
  store: VoiceStore;
  out: OutDirs;
  /** 声を作らない（素材の声だけを使う） */
  cacheOnly: boolean;
  /** 声の探し方（既定は声のキャッシュ。--durations-only は、素材のブランチの長さと読み） */
  find?: VoiceSource;
  /** VOICEVOX のエンジン */
  engine: Voicevox;
  /** 動画ごとの 1 行（既定は標準出力） */
  log?: (line: string) => void;
  /** 注意（既定は標準エラー） */
  warn?: (line: string) => void;
};

const lacking = (keys: string[]) =>
  new MissingError(`音声のキャッシュが足りません: ${keys.join(' か ')}。先に materials.ts pull で確認してください。`);

/** --verbose に出す、台詞の番号（s<場面>-<台詞>。.work/kana と同じ数え方） */
const at = (lines: unknown[], scenes: unknown[]) => `s${scenes.length + 1}-${lines.length + 1}`;

/** 1 本の動画の全部の台詞の声（無ければ、日本語は VOICEVOX で作る。訳は Kokoro が先にまとめて作ってある） */
const voicesOf = async (ctx: Ctx, { lecture, lang }: Video): Promise<Voice[][]> => {
  const out: Voice[][] = [];
  for (const scene of lecture.scenes) {
    const lines: Voice[] = [];
    for (const line of scene.lines) {
      const voice = line.v ?? 'narrator';
      const text = speechIn(line, lang);
      const recipe = recipeIn(voice, lang);
      const keys = ttsKeysIn(text, voice, lang, recipe);
      const found = (ctx.find ?? cacheSource(ctx.store))(keys);
      if (found) {
        trace(`  ${at(lines, out)} [${voice}] キャッシュ ${found.key}（${found.key === keys[0] ? 'v2' : 'v1'}）`);
        lines.push(found);
      } else if (ctx.cacheOnly) throw lacking(keys);
      else if (lang !== 'ja') throw new Error(`音声が無い（Kokoro で作れなかった）: ${text}`);
      else {
        // 新しく作る声は、v2 の鍵（合成のレシピから作る）の名前で置き、読みの隣に声の記録（レシピとエンジンの版）を置く
        trace(`  ${at(lines, out)} [${voice}] 合成 ${keys[0]}（v2）`);
        const { wav, kana, engineVersion } = await ctx.engine.synthesize(text, recipe as VoicevoxRecipe);
        lines.push(writeVoice(ctx.store, keys[0], wav, kana, { schema: 1, key: keys[0], text, recipe, engineVersion }));
      }
    }
    out.push(lines);
  }
  return out;
};

/** 1 本の動画の声をそろえ、時刻を決めて出力を書く。声のエンジンの版が混ざっていれば知らせる */
const synthVideo = async (ctx: Ctx, video: Video) => {
  const t0 = Date.now();
  const voices = await voicesOf(ctx, video);
  const versions = versionsOf(voices);
  if (versions.size > 1) {
    const list = [...versions].map(([v, n]) => `${v} が ${n} 台詞`).join('・');
    (ctx.warn ?? console.warn)(
      `注意: ${video.key} の声は、エンジンの版が混ざっている（${list}）。そろえるなら、古い版の声をキャッシュから消して、もう一度 synth する`,
    );
  }
  const { scenes, duration } = emitVideo(ctx.out, video, voices, VIDEO.fps);
  const lines = scenes.reduce((n, s) => n + s.lines.length, 0);
  (ctx.log ?? console.log)(
    `${video.key} ${(duration / 60).toFixed(2)} 分  ${scenes.length} 場面  ${lines} 台詞  (${((Date.now() - t0) / 1000).toFixed(0)} 秒)`,
  );
};

/** 動画の声をそろえ、時刻を決めて出力を書く（訳の足りない台詞は、先に Kokoro でまとめて作る） */
export const synthVideos = async (ctx: Ctx, videos: Video[]): Promise<void> => {
  if (!ctx.cacheOnly) await runKokoro(ctx.store, videos);
  for (const video of videos) await synthVideo(ctx, video);
};

/** 動画の全部の台詞の、探す鍵（v2 → v1） */
const keysOfVideos = (videos: Video[]): string[][] =>
  videos.flatMap(({ lecture, lang }) =>
    lecture.scenes.flatMap((scene) => scene.lines.map((line) => ttsKeysIn(speechIn(line, lang), line.v ?? 'narrator', lang))),
  );

/**
 * --durations-only の声の探し方。素材のブランチの長さの一覧（DURATIONS.json）と読みで探す（音声は取り出さない）。
 * 長さの一覧がまだ無いか、素材のブランチにある声の長さが一覧に無い・古い（WAV の sha256 が違う）ときは、
 * 今までどおり音声を取り出し（pull。ffmpeg が要る）、声のキャッシュで探す
 */
export const durationsFind = async (
  videos: Video[],
  store: VoiceStore,
  repo: Repo = defaultRepo(),
  { log = console.log, ...pullOpts }: PullOptions = {},
): Promise<{ find: VoiceSource; durationsOnly: boolean }> => {
  const ids = [...new Set(videos.map((v) => v.course.id))];
  const index = pullDurations(repo, ids, log);
  if (index) {
    const find = durationSource(index);
    // 声は素材のブランチにあるのに、長さが一覧に無い・古い台詞（素材のブランチに声が無い台詞は、--cached-only と同じに止める）
    const stale = keysOfVideos(videos).filter(
      (keys) => !find(keys) && keys.some((k) => index.sums.has(`${TTS_REL}/${k}.wav`)),
    );
    if (!stale.length) return { find, durationsOnly: true };
    log(
      `素材のブランチの DURATIONS.json に、長さが無いか古い台詞が ${stale.length} 本ある（例: ${stale[0]!.join(' か ')}）。今までどおり音声を取り出してから作る`,
    );
  } else log('素材のブランチに DURATIONS.json がまだ無い。今までどおり音声を取り出してから作る（ffmpeg が要る）');
  await pull(repo, ids, { ...pullOpts, log });
  return { find: cacheSource(store), durationsOnly: false };
};

/** 動画の名前（L01）・訳（L01.en）・'L01.*'（全部の言語）・'*.en'（その言語の全部） */
const pick = (w: string, v: Video) => w === v.key || w === `${v.lecture.id}.*` || w === `*.${v.lang}`;

const main = async (argv: string[]) => {
  const { values, positionals: wanted } = readArgs(
    argv,
    {
      'cached-only': { type: 'boolean' },
      'durations-only': { type: 'boolean' },
      prune: { type: 'boolean' },
      course: { type: 'string', multiple: true },
      verbose: { type: 'boolean', short: 'v' },
    },
    { positionals: true },
  );
  if (values.help) return showHelp(import.meta.filename);
  setVerbose(values.verbose === true);
  if (values['durations-only'] && !values['cached-only'])
    throw new UsageError('--durations-only は --cached-only と一緒に使う（声を作らず、素材のブランチの長さと読みだけで時刻を決める）');
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
    engine: voicevox({ url: process.env.VOICEVOX_URL ?? 'http://127.0.0.1:50021', timeoutMs: timeoutFromEnv() }),
  };
  // 共有のキャッシュのフォルダは、声を書くときに作る（--cached-only では作らない）
  for (const dir of [ctx.out.plan, ctx.out.kana, ctx.out.speech, ctx.out.siteData]) mkdirSync(dir, { recursive: true });
  const durations = values['durations-only'] ? await durationsFind(targets, ctx.store) : null;
  await synthVideos({ ...ctx, ...(durations ? { find: durations.find } : {}) }, targets);
  if (durations?.durationsOnly)
    console.log('長さと読みだけで作った（音声は取り出していない）。mix と render の前に、bun scripts/materials.ts pull で音声を取り出す');

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
