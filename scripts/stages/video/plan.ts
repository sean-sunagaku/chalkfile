// 動画の書き出し（scripts/stages/video/render.ts）のうち、ファイルを読み書きしない部分。テストは tests/unit/render.test.ts。
//   動画の名前の形・出力と一時のファイルの名前・分けて書き出すフレームの範囲・サイト用の動画の crf の選び方・ffmpeg の引数・
//   ffprobe で確かめること・引数と環境変数（CAPTIONS・CHUNK・CONCURRENCY）の読み方
// 値（crf・品質・秒など）は scripts/stages/video/render.config.ts
import { posterFile } from '../../../engine/core/generated';
import { UsageError } from '../../lib/args';
import { defaultConcurrency, RENDER } from './render.config';

/* ───────────── 名前 ───────────── */

/**
 * 動画の名前（レクチャー ID か、レクチャー ID.言語）。出力のファイルの名前と ffmpeg の部品の一覧に入るので、形を決めておく
 * （scripts/audio/common.py の VIDEO_KEY と同じ形）
 */
export const VIDEO_KEY = /^[A-Za-z0-9][A-Za-z0-9_-]*(?:\.[a-z]{2})?$/;

/** 動画の名前の形を確かめる（違えば使い方の誤り） */
export const checkKey = (key: string): string => {
  if (!VIDEO_KEY.test(key)) throw new UsageError(`動画の名前の形が違う: ${JSON.stringify(key)}（例: L01・S03.en）`);
  return key;
};

/** 動画 1 本の入力と出力（リポジトリの直下から） */
export type VideoFiles = {
  key: string;
  /** ミックスの音（scripts/mix.py が書く） */
  mix: string;
  /** 音なしの高画質の映像 */
  master: string;
  /** 字幕を焼き込んだ、音なしの高画質の映像 */
  masterCc: string;
  /** サイト用の動画 */
  site: string;
  /** サイト用の、字幕を焼き込んだ動画（字幕をオンにしたときに流す） */
  siteCc: string;
  /** 配る用の、字幕を焼き込んだ動画 */
  captioned: string;
  /** Git に入れるポスター（講座のフォルダ）。公開する言語（publishLangs）の動画だけで、ほかの言語は null */
  poster: string | null;
  /** ポスターの写し（サイトの組み立てと手元で見るとき。ポスターが講座のフォルダに無い動画は、これだけ） */
  sitePoster: string;
};

export const videoFiles = (
  v: { key: string; lang: string; course: { id: string } },
  publishLangs: readonly string[],
): VideoFiles => {
  const { key } = v;
  checkKey(key);
  return {
    key,
    mix: `public/audio/mix/${key}.wav`,
    master: `out/master/${key}.mp4`,
    masterCc: `out/master/${key}.cc.mp4`,
    site: `site/media/${key}.mp4`,
    siteCc: `site/media/${key}.cc.mp4`,
    captioned: `out/captioned/${key}.mp4`,
    poster: publishLangs.includes(v.lang) ? posterFile(v.course.id, key) : null,
    sitePoster: `site/media/${key}.jpg`,
  };
};

/** 一時の名前（同じフォルダに置き、できてから名前を替える。ffmpeg は形を拡張子で決めるので、拡張子は残す）: a/L01.mp4 → a/L01.tmp.mp4 */
export const tmpOf = (file: string): string => {
  const m = /^(.*)(\.[A-Za-z0-9]+)$/.exec(file);
  if (!m) throw new Error(`拡張子の無いファイルに一時の名前は付けない: ${file}`);
  return `${m[1]}.tmp${m[2]}`;
};

/** 分けて書き出す k 番目の部品（音なしの映像と同じフォルダ。字幕版は <key>.cc.part<k>.mp4） */
export const partOf = (f: VideoFiles, k: number, captions = false): string =>
  `out/master/${f.key}${captions ? '.cc' : ''}.part${k}.mp4`;

/** 部品の一覧（ffmpeg の concat に渡す） */
export const partsListOf = (f: VideoFiles, captions = false): string =>
  `out/master/${f.key}${captions ? '.cc' : ''}.parts.txt`;

/** フォルダ（out/master）の中の名前が、その動画の部品か（通常版と字幕版。前の書き出しの残りを探すとき） */
export const isPartName = (key: string, name: string): boolean =>
  [`${key}.part`, `${key}.cc.part`].some((head) => name.startsWith(head) && /^\d+\.mp4$/.test(name.slice(head.length)));

/** 前の書き出しの残り（一時の名前と部品の一覧）。部品そのものは isPartName でフォルダを読んで探す */
export const leftoversOf = (f: VideoFiles): string[] => [
  tmpOf(f.master),
  tmpOf(f.masterCc),
  tmpOf(f.site),
  tmpOf(f.siteCc),
  tmpOf(f.captioned),
  tmpOf(f.sitePoster),
  ...(f.poster ? [tmpOf(f.poster)] : []),
  partsListOf(f),
  partsListOf(f, true),
];

/* ───────────── フレームの範囲と crf ───────────── */

/**
 * 分けて書き出すフレームの範囲（両端を含む・頭から順に）。chunk が 0 か、全体より大きければ、全体を 1 つにする。
 * Remotion は書き出し中のフレームを一時フォルダに置く（5 分で 1〜2GB）ので、ディスクの空きが少ないときに分ける
 */
export const chunkRanges = (total: number, chunk: number): [number, number][] => {
  if (!Number.isSafeInteger(total) || total < 1) throw new Error(`フレームの数が 1 以上の整数でない: ${total}`);
  if (!Number.isSafeInteger(chunk) || chunk < 0) throw new Error(`分ける枚数が 0 以上の整数でない: ${chunk}`);
  if (chunk === 0 || chunk >= total) return [[0, total - 1]];
  const out: [number, number][] = [];
  for (let s = 0; s < total; s += chunk) out.push([s, Math.min(s + chunk, total) - 1]);
  return out;
};

/**
 * サイト用の動画で、順に試す crf。長さ（秒。timeline の durationInFrames を fps で割って切り捨てる）が longSec より長い動画は
 * long から試す。目安に収まった crf か、最後の crf の動画を使う
 */
export const crfSteps = ({ durationInFrames, fps }: { durationInFrames: number; fps: number }): number[] => {
  const { first, long, step, max } = RENDER.site.crf;
  const start = Math.floor(durationInFrames / fps) > RENDER.site.longSec ? long : first;
  const out: number[] = [];
  for (let crf = start; crf <= max; crf += step) out.push(crf);
  if (!out.length) throw new Error(`試す crf が無い（render.config.ts の site.crf を見直す: ${start}〜${max}）`);
  return out;
};

/* ───────────── ffmpeg の引数 ───────────── */

const QUIET = ['-y', '-hide_banner', '-loglevel', 'error'];

/** サイト用の動画（音なしの映像とミックスの音を合わせる。crf を変えて試す） */
export const siteArgs = ({ video, audio, out, crf }: { video: string; audio: string; out: string; crf: number }) => {
  const s = RENDER.site;
  return [
    ...QUIET,
    ...['-i', video, '-i', audio, '-map', '0:v:0', '-map', '1:a:0'],
    ...['-c:v', 'libx264', '-preset', s.preset, '-crf', String(crf), '-maxrate', s.maxrate, '-bufsize', s.bufsize],
    ...['-pix_fmt', 'yuv420p', '-profile:v', 'high', '-g', String(s.gop)],
    ...['-c:a', RENDER.audio.codec, '-b:a', s.audioBitrate, '-ar', String(RENDER.audio.sampleRate)],
    ...['-shortest', '-movflags', '+faststart', out],
  ];
};

/** 配る用の、字幕を焼き込んだ動画（大きさの目安は無い） */
export const captionedArgs = ({ video, audio, out }: { video: string; audio: string; out: string }) => {
  const c = RENDER.captioned;
  return [
    ...QUIET,
    ...['-i', video, '-i', audio, '-map', '0:v:0', '-map', '1:a:0'],
    ...['-c:v', 'libx264', '-preset', c.preset, '-crf', String(c.crf), '-pix_fmt', 'yuv420p', '-profile:v', 'high'],
    ...[
      '-g',
      String(c.gop),
      '-c:a',
      RENDER.audio.codec,
      '-b:a',
      c.audioBitrate,
      '-ar',
      String(RENDER.audio.sampleRate),
    ],
    ...['-shortest', '-movflags', '+faststart', out],
  ];
};

/** ポスター（音なしの映像の RENDER.poster.atSec 秒のフレームを、幅をそろえた JPEG にする） */
export const posterArgs = ({ video, out }: { video: string; out: string }) => {
  const p = RENDER.poster;
  return [
    ...QUIET,
    ...[
      '-ss',
      String(p.atSec),
      '-i',
      video,
      '-frames:v',
      '1',
      '-vf',
      `scale=${p.width}:-2`,
      '-q:v',
      String(p.quality),
      out,
    ],
  ];
};

/** 分けて書き出した部品をつなぐ（中身は作り直さない）。list は部品の一覧のファイル */
export const concatArgs = ({ list, out }: { list: string; out: string }) => [
  ...QUIET,
  ...['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', out],
];

/** 部品の一覧の中身（ffmpeg の concat の形。名前は一覧のファイルと同じフォルダからの名前。動画の名前は形を確かめてある） */
export const concatList = (parts: string[]): string =>
  parts.map((p) => `file '${p.slice(p.lastIndexOf('/') + 1)}'\n`).join('');

/* ───────────── ffprobe で確かめる ───────────── */

/** ffprobe -print_format json -show_format -show_streams の、使うところ */
export type Probe = {
  streams?: {
    codec_type?: string;
    codec_name?: string;
    width?: number;
    height?: number;
    r_frame_rate?: string;
    nb_frames?: string;
    duration?: string;
    sample_rate?: string;
  }[];
  format?: { duration?: string };
};

/** 書き出した動画に求めること。frames は timeline のフレームの数、slack はずれてよいフレームの数（音と合わせた動画は -shortest で 1 だけ短くなりうる） */
export type VideoExpect = {
  width: number;
  height: number;
  fps: number;
  frames: number;
  audio: boolean;
  slack?: number;
};

/** 30/1 のような分数を数にする */
const rate = (r: string | undefined): number => {
  const [a, b = '1'] = (r ?? '').split('/');
  const n = Number(a) / Number(b);
  return Number.isFinite(n) ? n : Number.NaN;
};

/** 書き出した動画が、求めるとおりか。違うところを並べる（空なら合う） */
export const videoProblems = (p: Probe, want: VideoExpect): string[] => {
  const out: string[] = [];
  const streams = p.streams ?? [];
  const video = streams.filter((s) => s.codec_type === 'video');
  const audio = streams.filter((s) => s.codec_type === 'audio');
  const slack = want.slack ?? 0;
  const seconds = want.frames / want.fps;
  if (video.length !== 1) out.push(`映像が ${video.length} 本（1 本のはず）`);
  else {
    const v = video[0];
    if (v.codec_name !== 'h264') out.push(`映像の形式が ${v.codec_name ?? '分からない'}（h264 のはず）`);
    if (v.width !== want.width || v.height !== want.height)
      out.push(`大きさが ${v.width}x${v.height}（${want.width}x${want.height} のはず）`);
    const fps = rate(v.r_frame_rate);
    if (!(Math.abs(fps - want.fps) < 1e-6)) out.push(`フレームの速さが ${v.r_frame_rate}（${want.fps} のはず）`);
    const frames = Number(v.nb_frames);
    if (!Number.isFinite(frames) || frames > want.frames || frames < want.frames - slack)
      out.push(`フレームが ${v.nb_frames ?? '分からない'} 枚（${want.frames} 枚のはず）`);
  }
  const duration = Number(p.format?.duration);
  if (!(Math.abs(duration - seconds) <= (slack + 1) / want.fps + 0.05))
    out.push(`長さが ${p.format?.duration ?? '分からない'} 秒（${seconds.toFixed(3)} 秒のはず）`);
  if (want.audio) {
    if (audio.length !== 1) out.push(`音が ${audio.length} 本（1 本のはず）`);
    else {
      const a = audio[0];
      if (a.codec_name !== RENDER.audio.codec)
        out.push(`音の形式が ${a.codec_name ?? '分からない'}（${RENDER.audio.codec} のはず）`);
      if (Number(a.sample_rate) !== RENDER.audio.sampleRate)
        out.push(`音の速さが ${a.sample_rate ?? '分からない'} Hz（${RENDER.audio.sampleRate} Hz のはず）`);
      const d = Number(a.duration);
      if (!(Math.abs(d - seconds) <= (slack + 1) / want.fps + 0.1))
        out.push(`音の長さが ${a.duration ?? '分からない'} 秒（${seconds.toFixed(3)} 秒のはず）`);
    }
  } else if (audio.length) out.push(`音が ${audio.length} 本入っている（音なしのはず）`);
  return out;
};

/** ポスターが、求めるとおりか（JPEG の静止画 1 枚で、幅が RENDER.poster.width） */
export const posterProblems = (p: Probe): string[] => {
  const s = p.streams ?? [];
  if (s.length !== 1) return [`画像が ${s.length} 枚（1 枚のはず）`];
  const out: string[] = [];
  if (s[0].codec_name !== 'mjpeg') out.push(`画像の形式が ${s[0].codec_name ?? '分からない'}（JPEG のはず）`);
  if (s[0].width !== RENDER.poster.width) out.push(`幅が ${s[0].width}（${RENDER.poster.width} のはず）`);
  return out;
};

/* ───────────── 引数と環境変数 ───────────── */

/** 書き出しの選び方。captions: auto は掛け合いの講座（cast のある講座）だけ、all は全部、none は作らない */
export type RenderOptions = { jobs: number; chunk: number; captions: 'auto' | 'all' | 'none' };

/** 0 以上の整数の文字（空は無いものとする） */
const intOf = (name: string, raw: string | undefined, min: number): number | undefined => {
  if (raw === undefined || raw === '') return undefined;
  if (!/^\d+$/.test(raw) || Number(raw) < min) throw new UsageError(`${name} は ${min} 以上の整数: ${raw}`);
  return Number(raw);
};

/**
 * 引数（--jobs・--chunk・--captions）と、前の呼び方の環境変数（CONCURRENCY・CHUNK・CAPTIONS=1 か 0）を読む。引数が先。
 * 並列の数は CPU の数まで（Remotion はそれより多い数で止まるので、書き出す前に止める）
 */
export const readOptions = (
  values: { jobs?: string; chunk?: string; captions?: boolean },
  env: Record<string, string | undefined>,
  cpus: number,
): RenderOptions => {
  const jobs = intOf('--jobs（CONCURRENCY）', values.jobs ?? env.CONCURRENCY, 1) ?? defaultConcurrency(cpus);
  if (jobs > cpus) throw new UsageError(`--jobs（CONCURRENCY）は 1〜${cpus}（この機械の CPU の数まで）: ${jobs}`);
  const chunk = intOf('--chunk（CHUNK）', values.chunk ?? env.CHUNK, 0) ?? 0;
  const cc = env.CAPTIONS ?? '';
  if (!['', '0', '1'].includes(cc))
    throw new UsageError(`CAPTIONS は 1（全部の動画で字幕版も作る）か 0（作らない）: ${cc}`);
  const captions = values.captions || cc === '1' ? 'all' : cc === '0' ? 'none' : 'auto';
  return { jobs, chunk, captions };
};

/** その動画で、字幕を焼き込んだ版も作るか */
export const wantsCaptions = (o: Pick<RenderOptions, 'captions'>, cast: boolean): boolean =>
  o.captions === 'all' || (o.captions === 'auto' && cast);
