// 講座の動画を書き出す。Remotion で映像（音なし）を書き出し、ミックスの音（public/audio/mix/<key>.wav）と合わせて、サイト用の MP4 とポスターを作る。
//   bun scripts/stages/video/render.ts L03 L05              # 一部だけ（npm run render -- L03 L05 も同じ）
//   bun scripts/stages/video/render.ts --course ga4-comedy  # 講座の、公開する言語の全部
//   bun scripts/stages/video/render.ts P01.en 'S03.*'       # 訳の動画（レクチャー ID.言語）。* と ? で選べる
//   bun scripts/stages/video/render.ts L03 --dry-run        # 書き出すもの（字幕版を作るか・出力・足りない入力）を出すだけ
//   npm run chalk -- render …                                # 1 つの入口からも流せる（docs/guide/commands.md の「chalk」）
// 対象は --course・--video（* と ? を使える）・--lang と名前の無い引数で選び、選ばなければ公開する言語（site/config.json の publishLangs）の全部。
// バンドル（webpack）は 1 回だけ作り、全部の動画で使う。Remotion の書き出しは @remotion/renderer を、この道具の中から呼ぶ。
// 字幕を焼き込んだ版は、掛け合いの講座（cast のある講座）で作る。--captions（か CAPTIONS=1）で全部の動画、CAPTIONS=0 で作らない（そのときは記録しない）
// 出力: out/master/<key>.mp4（音なしの高画質の映像）・site/media/<key>.mp4（サイト用）・ポスター（公開する言語の動画は
//   content/<講座>/generated/posters/<key>.jpg。Git に入れる。どの動画も写しを site/media/<key>.jpg に置く）。字幕版は
//   out/master/<key>.cc.mp4・site/media/<key>.cc.mp4（講座サイトで字幕をオンにしたときに流す）・out/captioned/<key>.mp4（配る用）
// サイト用の動画は、site/limits.ts の VIDEO_TARGET_BYTES（目安）に収まるまで crf を上げる。いちばん上の crf でも超えたら警告して使う。
//   保存の 1 ファイルの上限（OFFLINE_FILE_MAX_BYTES）も超えたら、別に警告する（止めるのは media.ts push と build_site）
// 設定（並列の数・crf・ポスターの秒など）は scripts/stages/video/render.config.ts。--jobs <数>（CONCURRENCY=<数>）で並列の数、
//   --chunk <枚数>（CHUNK=<枚数>）でその枚数ずつ分けて書き出して最後につなぐ（書き出し中のフレームでディスクが埋まるとき）
// 安全: 動画の名前の形を確かめる。全部の出力を一時の名前（<key>.tmp.mp4 など）に書き、ffprobe で確かめてから置き換える。失敗したとき・
//   Ctrl-C（SIGINT・SIGTERM・SIGHUP）で止めたときは、一時のファイルを消して止まり、前の出力（サイト用の動画・ポスター）は残す。
//   同じ作業フォルダで、2 つの書き出しを同時に流さない（.work/state/render.lock）。Remotion の一時フォルダ（バンドル・書き出し中の
//   フレーム）は作業フォルダの .work/render-tmp/ に置き、終わったとき・止めたときに消す
// 記録: 動画ごとに、書き出す前の入力の指紋を置き、全部を置き換えたあとで比べて .work/state/render/<key>.json に書く
//   （npm run chalk -- status と build が読み、media push が動画の一覧の inputs に写す）。記録できなくても、書き出しは止めない
// 前提: timeline（先に synth）・ミックスの音（先に mix）・ffmpeg と ffprobe。書き出しの Chrome は Remotion が自分で取ってくる
// 終了コード: 0 できた・1 失敗・2 使い方の誤り・3 前提が足りない（timeline・ミックスの音・ffmpeg・ffprobe）・130／143／129 止められた（SIGINT／SIGTERM／SIGHUP）
import type { HeadlessBrowser } from '@remotion/renderer';
import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { VIDEOS, type Video } from '../../../content';
import { compositionId } from '../../../content/i18n';
import type { TimelineEntry } from '../../../engine/core/timeline';
import { validateLecture, validateTimelineFiles } from '../../../engine/core/validate';
import { OFFLINE_FILE_MAX_BYTES, VIDEO_TARGET_BYTES } from '../../../site/limits';
import { pickVideos } from '../../cli';
import { MissingError, readArgs, runMain, showHelp } from '../../lib/args';
import { readSiteConfig } from '../../lib/config';
import { withLock } from '../../lib/fsx';
import { ROOT, ttsDirs } from '../../lib/paths';
import { run, runAsync, tailOf } from '../../lib/proc';
import { readTimelinesByKey } from '../../timelines';
import { fileHasher } from '../pipeline/digest';
import { begin, commit, type Inputs } from '../pipeline/runner';
import { makeStages } from '../pipeline/stages';
import { clearPending, STATE_DIR } from '../pipeline/state';
import {
  captionedArgs,
  checkKey,
  chunkRanges,
  concatArgs,
  concatList,
  crfSteps,
  isPartName,
  leftoversOf,
  type Probe,
  partOf,
  partsListOf,
  posterArgs,
  posterProblems,
  type RenderOptions,
  readOptions,
  siteArgs,
  tmpOf,
  type VideoFiles,
  videoFiles,
  videoProblems,
  wantsCaptions,
} from './plan';
import { RENDER } from './render.config';

/** 書き出す動画 1 本 */
export type Job = {
  key: string;
  /** Remotion のコンポジション（P01.en → P01-en） */
  composition: string;
  files: VideoFiles;
  /** timeline のフレームの数と速さ */
  frames: number;
  fps: number;
  /** 字幕を焼き込んだ版も作る */
  captions: boolean;
  /** 掛け合いの講座なのに字幕版を作らない（CAPTIONS=0）。前の字幕版が残るので、記録しない */
  captionsSkipped: boolean;
};

/** Remotion の映像のコンポジションの大きさなど（ffprobe で確かめるのに使う） */
export type Meta = { width: number; height: number; fps: number; durationInFrames: number };

/** 動画 1 本の Remotion の書き出し（ブラウザを 1 つ開いて、通常版・字幕版・部品を書き出し、閉じる） */
export type RemotionSession = {
  render: (r: { captions: boolean; out: string; frameRange: [number, number] | null }) => Promise<Meta>;
  close: () => Promise<void>;
};

/** 書き出しが外に頼むもの（テストは偽物に替える）。パスは root からの相対 */
export type RenderDeps = {
  root: string;
  open: (job: Job) => Promise<RemotionSession>;
  /** ffmpeg を流す。失敗したら投げる */
  ffmpeg: (args: string[]) => Promise<void>;
  /** ffprobe の結果（-show_format -show_streams） */
  probe: (file: string) => Promise<Probe>;
  /** 段の記録（無ければ記録しない） */
  record?: {
    begin: (key: string) => Inputs | undefined;
    commit: (key: string, before: Inputs | undefined) => void;
    abort: (key: string) => void;
  };
  /** 止められたか（Ctrl-C） */
  signal: AbortSignal;
  log: (line: string) => void;
  warn: (line: string) => void;
  now: () => number;
};

/** サイト用の動画の大きさの目安と、保存の 1 ファイルの上限（バイト） */
export type Limits = { target: number; max: number };

/** Remotion の一時フォルダの置き場所（リポジトリの直下から。書き出しのあいだだけ置き、終わったら消す。npm run clean も消す） */
export const RENDER_TMP = '.work/render-tmp';

/** site/limits.ts の値（正本はそこだけ。写さない） */
export const siteLimits = (): Limits => {
  for (const [name, n] of [
    ['VIDEO_TARGET_BYTES', VIDEO_TARGET_BYTES],
    ['OFFLINE_FILE_MAX_BYTES', OFFLINE_FILE_MAX_BYTES],
  ] as const)
    if (!Number.isSafeInteger(n) || n <= 0) throw new Error(`site/limits.ts の ${name} が 1 以上の整数でない: ${n}`);
  return { target: VIDEO_TARGET_BYTES, max: OFFLINE_FILE_MAX_BYTES };
};

const KiB = 1024;
const MiB = 1024 * 1024;
const mb = (bytes: number) => `${(bytes / MiB).toFixed(1)} MB`;

/* ───────────── 書き出す前に確かめる ───────────── */

/** 書き出す動画を決め、入力（台本と timeline・ミックスの音）を確かめる。足りないものは problems に入れる（書き出す前に、全部をまとめて出す） */
export const planJobs = (
  videos: readonly Video[],
  o: RenderOptions,
  {
    root,
    publishLangs,
    timelines,
  }: { root: string; publishLangs: readonly string[]; timelines: Map<string, TimelineEntry[]> },
): { jobs: Job[]; missing: string[]; broken: string[] } => {
  const jobs: Job[] = [];
  const missing: string[] = [];
  const broken: string[] = [];
  for (const v of videos) {
    checkKey(v.key);
    const files = videoFiles(v, publishLangs);
    const entries = timelines.get(v.key) ?? [];
    const timeline = entries.length === 1 ? entries[0].timeline : undefined;
    if (!entries.length) missing.push(`${v.key}: timeline が無い（先に npm run synth -- ${v.key}）`);
    else {
      const errors = [
        ...validateLecture(v.lecture, v.course),
        ...validateTimelineFiles(v.lecture, v.course, entries),
      ].filter((x) => x.level === 'error');
      const stale = errors.filter((x) => x.rule === 'timeline');
      if (stale.length)
        missing.push(`${v.key}: timeline が台本と合わない（先に npm run synth -- ${v.key}）: ${stale[0].message}`);
      else if (errors.length)
        broken.push(
          `${v.key}: 台本に誤りが ${errors.length} 件ある（npm run validate）: ${errors[0].where}  ${errors[0].message}`,
        );
    }
    if (!existsSync(path.join(root, files.mix)))
      missing.push(`${v.key}: ミックスの音が無い（先に npm run mix -- ${v.key}）`);
    const cast = Boolean(v.course.cast);
    jobs.push({
      key: v.key,
      composition: compositionId(v.key),
      files,
      frames: timeline?.durationInFrames ?? 0,
      fps: timeline?.fps ?? 0,
      captions: wantsCaptions(o, cast),
      captionsSkipped: cast && !wantsCaptions(o, cast),
    });
  }
  return { jobs, missing, broken };
};

/** --dry-run の文（書き出すもの・出力・足りない入力。何もしない） */
export const planText = (jobs: Job[], o: RenderOptions, problems: string[]): string => {
  const lines = ['書き出すもの（--dry-run なので、何もしない）:'];
  for (const j of jobs) {
    const kind = j.captions ? '通常版と字幕版' : j.captionsSkipped ? '通常版だけ（字幕版は作らない）' : '通常版';
    const length = j.frames ? `${(j.frames / j.fps / 60).toFixed(1)} 分` : '長さ不明';
    const outs = [j.files.site, ...(j.captions ? [j.files.siteCc] : []), j.files.poster ?? j.files.sitePoster];
    lines.push(`  ${j.key}  ${kind}  ${length}  → ${outs.join('・')}`);
  }
  lines.push(`並列の数 ${o.jobs}・${o.chunk ? `${o.chunk} フレームずつ分けて書き出す` : '分けずに書き出す'}`);
  if (problems.length) lines.push('書き出す前に止まる理由:', ...problems.map((p) => `  ${p}`));
  return lines.join('\n');
};

/* ───────────── 書き出し ───────────── */

/** ファイルを消す（無くてもよい） */
const remove = (root: string, file: string) => rmSync(path.join(root, file), { force: true });

/** 前の書き出しの残り（一時の名前・部品と部品の一覧）を消す */
const removeLeftovers = (root: string, f: VideoFiles) => {
  for (const file of leftoversOf(f)) remove(root, file);
  const dir = path.join(root, 'out/master');
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) if (isPartName(f.key, name)) rmSync(path.join(dir, name), { force: true });
};

/** 書き出したファイルを確かめる（違えば投げる） */
const assertProbe = async (deps: RenderDeps, file: string, problems: (p: Probe) => string[]) => {
  const found = problems(await deps.probe(file));
  if (found.length) throw new Error(`${file} が求める形と違う: ${found.join('。')}`);
};

/** 大きさ（バイト。macOS でなくても同じに取れる fs.stat） */
const sizeOf = (root: string, file: string) => statSync(path.join(root, file)).size;

/**
 * 音なしの映像を書き出す（分けるときは部品を書き出してつなぐ）。out の一時の名前に書き、確かめてから out に置き換える。
 * 前の書き出しの部品は使わない（書き出す前に消してある）
 */
const renderMaster = async (
  deps: RenderDeps,
  session: RemotionSession,
  job: Job,
  o: RenderOptions,
  captions: boolean,
): Promise<Meta> => {
  const { root } = deps;
  const out = captions ? job.files.masterCc : job.files.master;
  const tmp = tmpOf(out);
  const ranges = chunkRanges(job.frames, o.chunk);
  let meta: Meta | null = null;
  if (ranges.length === 1) meta = await session.render({ captions, out: tmp, frameRange: null });
  else {
    const parts = ranges.map((_, k) => partOf(job.files, k, captions));
    const list = partsListOf(job.files, captions);
    for (const [k, range] of ranges.entries()) {
      meta = await session.render({ captions, out: parts[k], frameRange: range });
      if (!existsSync(path.join(root, parts[k])) || sizeOf(root, parts[k]) === 0)
        throw new Error(`部品が空（${range[0]}-${range[1]}）`);
    }
    writeFileSync(path.join(root, list), concatList(parts));
    await deps.ffmpeg(concatArgs({ list: path.join(root, list), out: path.join(root, tmp) }));
    for (const p of [...parts, list]) remove(root, p);
  }
  if (!meta) throw new Error('Remotion が何も書き出さなかった');
  const { width, height, fps, durationInFrames } = meta;
  if (durationInFrames !== job.frames)
    throw new Error(`コンポジションのフレームの数（${durationInFrames}）が timeline（${job.frames}）と違う`);
  if (!existsSync(path.join(root, tmp)) || sizeOf(root, tmp) === 0) throw new Error('Remotion の出力が空');
  await assertProbe(deps, tmp, (p) => videoProblems(p, { width, height, fps, frames: job.frames, audio: false }));
  renameSync(path.join(root, tmp), path.join(root, out));
  return meta;
};

/** サイト用の動画を一時の名前に書く（目安に収まるまで crf を上げる）。使った crf と大きさを返す */
const encodeSite = async (deps: RenderDeps, job: Job, video: string, out: string, limits: Limits) => {
  const { root } = deps;
  let crf = 0;
  let size = 0;
  for (const c of crfSteps({ durationInFrames: job.frames, fps: job.fps })) {
    crf = c;
    await deps.ffmpeg(
      siteArgs({
        video: path.join(root, video),
        audio: path.join(root, job.files.mix),
        out: path.join(root, out),
        crf,
      }),
    );
    size = sizeOf(root, out);
    if (size <= limits.target) break;
  }
  return { crf, size };
};

type Summary = { over: string[]; big: string[] };

/** サイト用の動画の大きさの警告（目安を超えた・保存の上限も超えた） */
const sizeWarnings = (deps: RenderDeps, file: string, crf: number, size: number, limits: Limits, s: Summary) => {
  if (size > limits.target) {
    deps.warn(
      `警告: ${file} は crf ${crf} でも ${Math.floor(size / KiB)} KiB で、目安（${Math.floor(limits.target / KiB)} KiB）を超えています`,
    );
    s.over.push(file);
  }
  if (size > limits.max) {
    deps.warn(
      `警告: ${file} は保存の 1 ファイルの上限（${Math.floor(limits.max / MiB)} MiB）も超えています。このままでは講座を保存できないので、bun scripts/media.ts push が止めます`,
    );
    s.big.push(file);
  }
};

/** 動画 1 本を書き出す。全部の出力を一時の名前に書いて確かめてから置き換え、記録する。失敗したら一時のファイルを消して投げる */
export const renderOne = async (job: Job, o: RenderOptions, limits: Limits, deps: RenderDeps, summary: Summary) => {
  const { root } = deps;
  const f = job.files;
  const at = (file: string) => path.join(root, file);
  for (const dir of ['out/master', 'site/media', ...(job.captions ? ['out/captioned'] : [])])
    mkdirSync(at(dir), { recursive: true });
  if (f.poster) mkdirSync(path.dirname(at(f.poster)), { recursive: true });
  // 前の書き出しの残り（一時の名前・部品）と、前の音なしの映像を先に消す（残っていると、失敗したときに前の映像で先へ進みうる）
  removeLeftovers(root, f);
  remove(root, f.master);
  remove(root, f.masterCc);
  if (job.captionsSkipped && existsSync(at(f.siteCc)))
    deps.warn(
      `注意: ${job.key}: 字幕を焼き込んだ版（${f.siteCc}）は作り直さず、前のままです（記録もしない）。作るなら CAPTIONS=0 を外す`,
    );
  const start = deps.now();
  const before = deps.record?.begin(job.key);
  try {
    // 1. Remotion で、音なしの映像（字幕版も）を書き出す。全部できるまで、サイト用の出力は変えない
    const session = await deps.open(job);
    const meta = await (async () => {
      try {
        deps.log(
          `${job.key}: 映像を書き出す（${job.frames} フレーム・並列 ${o.jobs}${job.captions ? '・字幕版も' : ''}）`,
        );
        const m = await renderMaster(deps, session, job, o, false);
        if (job.captions) {
          deps.log(`${job.key}: 字幕を焼き込んだ映像を書き出す`);
          await renderMaster(deps, session, job, o, true);
        }
        return m;
      } finally {
        await session.close();
      }
    })();
    // 音と合わせた動画は -shortest で、ミックスの音が少し短いと 1 フレームだけ短くなりうる
    const want = { width: meta.width, height: meta.height, fps: meta.fps, frames: job.frames, audio: true, slack: 1 };
    // 2. サイト用の動画・ポスター・字幕版を、一時の名前に書いて確かめる
    const site = await encodeSite(deps, job, f.master, tmpOf(f.site), limits);
    await assertProbe(deps, tmpOf(f.site), (p) => videoProblems(p, want));
    const posterTmp = tmpOf(f.poster ?? f.sitePoster);
    await deps.ffmpeg(posterArgs({ video: at(f.master), out: at(posterTmp) }));
    await assertProbe(deps, posterTmp, posterProblems);
    let cc: { crf: number; size: number } | null = null;
    if (job.captions) {
      await deps.ffmpeg(captionedArgs({ video: at(f.masterCc), audio: at(f.mix), out: at(tmpOf(f.captioned)) }));
      await assertProbe(deps, tmpOf(f.captioned), (p) => videoProblems(p, want));
      cc = await encodeSite(deps, job, f.masterCc, tmpOf(f.siteCc), limits);
      await assertProbe(deps, tmpOf(f.siteCc), (p) => videoProblems(p, want));
    }
    // 3. 全部できてから置き換える（同じフォルダの中の名前の替え）
    renameSync(at(tmpOf(f.site)), at(f.site));
    if (cc) {
      renameSync(at(tmpOf(f.siteCc)), at(f.siteCc));
      renameSync(at(tmpOf(f.captioned)), at(f.captioned));
    }
    if (f.poster) {
      renameSync(at(posterTmp), at(f.poster));
      copyFileSync(at(f.poster), at(tmpOf(f.sitePoster)));
    }
    renameSync(at(tmpOf(f.sitePoster)), at(f.sitePoster));
    deps.log(`${job.key}: ${Math.round((deps.now() - start) / 1000)} 秒  crf=${site.crf}  ${mb(site.size)}`);
    sizeWarnings(deps, f.site, site.crf, site.size, limits, summary);
    if (cc) {
      deps.log(`${job.key}: 字幕つき ${mb(sizeOf(root, f.captioned))}`);
      deps.log(`${job.key}: サイト用の字幕つき crf=${cc.crf}  ${mb(cc.size)}`);
      sizeWarnings(deps, f.siteCc, cc.crf, cc.size, limits, summary);
    }
  } catch (e) {
    removeLeftovers(root, f);
    deps.record?.abort(job.key);
    throw e;
  }
  // 4. 記録する（字幕版を作るはずの動画で作らなかったときは、前の字幕版が残るので記録しない）
  if (job.captionsSkipped) {
    deps.record?.abort(job.key);
    deps.warn(`注意: ${job.key}: 字幕を焼き込んだ版を作っていないので、書き出しの記録を書かない`);
  } else deps.record?.commit(job.key, before);
};

/** 選んだ動画を順に書き出す（1 本でも失敗したら、そこで止める）。最後に大きさの警告をまとめて出す */
export const renderAll = async (jobs: Job[], o: RenderOptions, limits: Limits, deps: RenderDeps): Promise<void> => {
  const summary: Summary = { over: [], big: [] };
  try {
    for (const job of jobs) {
      if (deps.signal.aborted) throw new Error('止められた');
      try {
        await renderOne(job, o, limits, deps, summary);
      } catch (e) {
        if (deps.signal.aborted) throw e;
        const why = e instanceof Error ? e.message : String(e);
        throw new Error(`${job.key}: 書き出しに失敗しました（${why}）`, { cause: e });
      }
    }
  } finally {
    if (summary.over.length)
      deps.warn(
        `警告: いちばん上の crf でもサイト用の目安（${Math.floor(limits.target / KiB)} KiB）を超えた動画があります: ${summary.over.join(' ')}`,
      );
    if (summary.big.length)
      deps.warn(
        `警告: 保存の 1 ファイルの上限（${Math.floor(limits.max / MiB)} MiB）を超えた動画があります（動画を短く分ける）: ${summary.big.join(' ')}`,
      );
  }
};

/* ───────────── 本物の道具（Remotion・ffmpeg・ffprobe・記録） ───────────── */

/** ffmpeg を流す（止められたら止める）。失敗したら、stderr の終わりを付けて投げる */
const ffmpegOf =
  (root: string, signal: AbortSignal) =>
  async (args: string[]): Promise<void> => {
    const r = await runAsync('ffmpeg', args, { cwd: root, signal, timeoutMs: 60 * 60_000 });
    if (signal.aborted) throw new Error('止められた');
    if (r.code !== 0 || r.timedOut)
      throw new Error(
        `ffmpeg が${r.timedOut ? '時間内に終わらなかった' : `終了コード ${r.code} で止まった`}: ${tailOf(r.stderr) || '（出力なし）'}`,
      );
  };

/** ffprobe で、ファイルの形式・流れ・長さを読む */
const probeOf =
  (root: string) =>
  async (file: string): Promise<Probe> => {
    const r = run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file], {
      cwd: root,
      timeoutMs: 120_000,
    });
    if (r.code !== 0 || r.timedOut)
      throw new Error(`ffprobe が ${file} を読めない: ${tailOf(r.stderr) || `終了コード ${r.code}`}`);
    return JSON.parse(r.stdout) as Probe;
  };

/** 段の記録（scripts/stages/pipeline の render の段と同じ指紋と出力）。記録できなくても止めない */
const recorderOf = (root: string, warn: (line: string) => void): NonNullable<RenderDeps['record']> => {
  const ctx = { root, hasher: fileHasher(root), store: ttsDirs(root) };
  const stage = makeStages(ctx).find((s) => s.name === 'render');
  if (!stage) throw new Error('render の段が無い');
  const quietly = <T>(key: string, fn: () => T): T | undefined => {
    try {
      return fn();
    } catch (e) {
      warn(`注意: ${key}: 書き出しの記録を書けなかった（${e instanceof Error ? e.message : String(e)}）`);
      return undefined;
    } finally {
      ctx.hasher.save();
    }
  };
  return {
    begin: (key) => quietly(key, () => begin(ctx, stage, key)),
    commit: (key, before) =>
      quietly(key, () => {
        const why = commit(ctx, stage, key, before);
        if (why) warn(`注意: ${key} を記録しなかった: ${why}`);
      }),
    abort: (key) => quietly(key, () => clearPending(root, stage.name, key)),
  };
};

/** 止めるシグナルと、その終了コード（128 ＋ シグナルの番号） */
const SIGNAL_EXIT = { SIGHUP: 129, SIGINT: 130, SIGTERM: 143 } as const;
type Sig = keyof typeof SIGNAL_EXIT;
const SIGNALS = Object.keys(SIGNAL_EXIT) as Sig[];

/**
 * Ctrl-C（SIGINT）・SIGTERM・SIGHUP を受けたら、書き出しを取り消す（signal を止める）。2 回目は、すぐに終える。
 * Remotion のブラウザは、開くときに自分の受け手を足し（SIGINT ではすぐに process.exit する）、閉じるときに外す。bun は、受け手を
 * 1 つ外すと、残した受け手も効かなくなることがある（macOS の 1.3.6 で起きた。Linux の 1.4.4 では起きなかった）ので、Remotion が
 * 触ったあとに settle で外し直し、この道具の受け手を付け直す
 */
const stopper = () => {
  const ac = new AbortController();
  let by: Sig | null = null;
  const handlers = new Map(
    SIGNALS.map((sig) => [
      sig,
      () => {
        if (by) {
          console.error(`${sig} をもう一度受けたので、すぐに止める（一時のファイルが残りうる）`);
          process.exit(SIGNAL_EXIT[sig]);
        }
        by = sig;
        console.error(`${sig} を受けたので、書き出しを取り消して止める（一時のファイルを消し、前の出力は残す）`);
        ac.abort();
      },
    ]),
  );
  const ours = new Set<unknown>(handlers.values());
  const arm = () => {
    for (const [sig, fn] of handlers) {
      process.off(sig, fn);
      process.on(sig, fn);
    }
  };
  return {
    signal: ac.signal,
    stoppedBy: () => by,
    exitCode: () => (by ? SIGNAL_EXIT[by] : 0),
    arm,
    disarm: () => {
      for (const [sig, fn] of handlers) process.off(sig, fn);
    },
    /** ほかの道具（Remotion）が足した受け手を外し、この道具の受け手を付け直す */
    settle: () => {
      for (const sig of SIGNALS) for (const l of process.listeners(sig)) if (!ours.has(l)) process.off(sig, l);
      arm();
    },
  };
};
type Stopper = ReturnType<typeof stopper>;

/** Remotion（バンドルを 1 回だけ作り、動画ごとにブラウザを 1 つ開く）。止められたら、書き出しを取り消す */
const remotionOf = async (root: string, o: RenderOptions, stop: Stopper, log: (line: string) => void) => {
  const { signal } = stop;
  const { bundle } = await import('@remotion/bundler');
  const { makeCancelSignal, openBrowser, renderMedia, selectComposition } = await import('@remotion/renderer');
  // 映像は音なしで書き出すので public/（声で 1GB 近い）は要らない。空のフォルダを渡して、一時フォルダへの複製を避ける
  const publicDir = path.join(root, '.work/render-public');
  mkdirSync(publicDir, { recursive: true });
  const started = Date.now();
  const serveUrl = await bundle({ entryPoint: path.join(root, 'src/index.ts'), publicDir, rootDir: root });
  log(`バンドルを作った（${Math.round((Date.now() - started) / 1000)} 秒。全部の動画で使う）`);
  const open = async (job: Job): Promise<RemotionSession> => {
    // 書き出しと同じく、画面の倍率を 1 にしたブラウザ（Remotion の CLI と同じ開き方）
    const browser: HeadlessBrowser = await openBrowser('chrome', { logLevel: 'error', forceDeviceScaleFactor: 1 });
    // Remotion は SIGINT を受けると、ブラウザを止めてすぐに道具を終える（process.exit）。それでは一時のファイル・Remotion の
    // 一時フォルダ・ロックを消せないので、その受け手を外す（この道具が書き出しを取り消し、片付けてから、ブラウザを閉じる）
    stop.settle();
    const { cancelSignal, cancel } = makeCancelSignal();
    signal.addEventListener('abort', cancel, { once: true });
    return {
      render: async ({ captions, out, frameRange }) => {
        // 通常版は props を渡さない（コンポジションの既定）。字幕版は captions だけを渡す
        const inputProps = captions ? { captions: true } : {};
        const composition = await selectComposition({
          serveUrl,
          id: job.composition,
          inputProps,
          puppeteerInstance: browser,
          logLevel: 'error',
        });
        let shown = 0;
        await renderMedia({
          composition,
          serveUrl,
          codec: RENDER.master.codec,
          outputLocation: path.join(root, out),
          inputProps,
          crf: RENDER.master.crf,
          imageFormat: RENDER.master.imageFormat,
          jpegQuality: RENDER.master.jpegQuality,
          muted: true,
          concurrency: o.jobs,
          frameRange,
          overwrite: true,
          puppeteerInstance: browser,
          cancelSignal,
          logLevel: 'error',
          onProgress: ({ progress }) => {
            // 4 分の 1 ごとに出す（ログを埋めない）
            const step = Math.floor(progress * 4);
            if (step > shown && step < 4) {
              shown = step;
              log(`${job.key}: ${captions ? '字幕版の' : ''}映像 ${step * 25}%`);
            }
          },
        });
        return {
          width: composition.width,
          height: composition.height,
          fps: composition.fps,
          durationInFrames: composition.durationInFrames,
        };
      },
      close: async () => {
        signal.removeEventListener('abort', cancel);
        await browser.close({ silent: true }).catch(() => undefined);
        stop.settle();
      },
    };
  };
  return { open, cleanup: () => rmSync(serveUrl, { recursive: true, force: true }) };
};

/** 外の道具があるか（無ければ、書き出す前に止める） */
const requireTools = (root: string) => {
  for (const tool of ['ffmpeg', 'ffprobe']) {
    const r = run(tool, ['-hide_banner', '-version'], { cwd: root, timeoutMs: 30_000 });
    if (r.code !== 0)
      throw new MissingError(`${tool} が動かない（入れてから流す。docs/guide/quickstart.md の「前提の道具」）`);
  }
};

const main = async (argv: string[]) => {
  const { values, positionals } = readArgs(
    argv,
    {
      course: { type: 'string', multiple: true },
      video: { type: 'string', multiple: true },
      lang: { type: 'string', multiple: true },
      captions: { type: 'boolean' },
      jobs: { type: 'string' },
      chunk: { type: 'string' },
      'dry-run': { type: 'boolean' },
    },
    { positionals: true },
  );
  if (values.help) return showHelp(import.meta.filename);
  const o = readOptions(values, process.env, os.availableParallelism());
  const keys = pickVideos(values, positionals);
  const videos = keys.map((k) => VIDEOS.find((v) => v.key === checkKey(k)) as Video);
  const { jobs, missing, broken } = planJobs(videos, o, {
    root: ROOT,
    publishLangs: readSiteConfig(ROOT).publishLangs,
    timelines: readTimelinesByKey(ROOT),
  });
  if (values['dry-run']) {
    console.log(planText(jobs, o, [...missing, ...broken]));
    return 0;
  }
  // 書き出す前に、全部の動画の入力をそろえる（足りなければ、何も消さず・何も書き出さずに止まる）
  if (missing.length) throw new MissingError(missing.join('\n'));
  if (broken.length) throw new Error(broken.join('\n'));
  requireTools(ROOT);
  const limits = siteLimits();
  const stop = stopper();
  stop.arm();
  try {
    await withLock(
      path.join(ROOT, STATE_DIR, 'render.lock'),
      async () => {
        // Remotion の一時フォルダ（バンドル・書き出し中のフレーム・ブラウザのプロフィール）を作業フォルダの中に置き、終わったら・止めたら
        // まとめて消す。前に止まった書き出しの残りも消す（ロックを持っているので、ほかの書き出しのものではない）
        const tmp = path.join(ROOT, RENDER_TMP);
        rmSync(tmp, { recursive: true, force: true });
        mkdirSync(tmp, { recursive: true });
        const tmpdir = process.env.TMPDIR;
        process.env.TMPDIR = tmp;
        try {
          const remotion = await remotionOf(ROOT, o, stop, (l) => console.log(l));
          try {
            await renderAll(jobs, o, limits, {
              root: ROOT,
              open: remotion.open,
              ffmpeg: ffmpegOf(ROOT, stop.signal),
              probe: probeOf(ROOT),
              record: recorderOf(ROOT, (l) => console.error(l)),
              signal: stop.signal,
              log: (l) => console.log(l),
              warn: (l) => console.error(l),
              now: Date.now,
            });
          } finally {
            remotion.cleanup();
          }
        } finally {
          if (tmpdir === undefined) delete process.env.TMPDIR;
          else process.env.TMPDIR = tmpdir;
          rmSync(tmp, { recursive: true, force: true });
        }
      },
      { what: '書き出し', timeoutMs: 1000 },
    );
  } catch (e) {
    const by = stop.stoppedBy();
    if (by) {
      console.error(`止めた（${by}）。一時のファイルは消し、前の出力は残した`);
      return stop.exitCode();
    }
    throw e;
  } finally {
    stop.disarm();
  }
  return 0;
};

if (import.meta.main) {
  await runMain(main);
  // Remotion を bun で使うと、書き出しが終わっても道具が終わらないことがある（Remotion の Bun の文書）。終了コードを付けて終える
  process.exit();
}
