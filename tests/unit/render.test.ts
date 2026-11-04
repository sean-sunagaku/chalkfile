// 動画の書き出し（scripts/stages/video/render.ts・plan.ts）。ファイルを読み書きしない部分（フレームの範囲・crf・名前・ffmpeg の引数・
// ffprobe の確かめ・引数と環境変数）と、偽の Remotion・ffmpeg・ffprobe で流す書き出しの順番（一時の名前から置き換える・失敗と
// Ctrl-C で前の出力を残し、一時のファイルを残さない・記録の前後）を確かめる。本物の書き出しはしない（ファイルは一時のフォルダにだけ書く）
import { afterAll, describe, expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { VIDEOS, type Video } from '../../content';
import { UsageError } from '../../scripts/lib/args';
import { readTimelinesByKey } from '../../scripts/timelines';
import {
  captionedArgs,
  checkKey,
  chunkRanges,
  concatArgs,
  concatList,
  crfSteps,
  isPartName,
  type Probe,
  partOf,
  posterArgs,
  posterProblems,
  readOptions,
  siteArgs,
  tmpOf,
  videoFiles,
  videoProblems,
  wantsCaptions,
} from '../../scripts/stages/video/plan';
import { defaultConcurrency, RENDER } from '../../scripts/stages/video/render.config';
import { type Job, type Limits, planJobs, type RenderDeps, renderAll } from '../../scripts/stages/video/render';

const ROOT = path.resolve(import.meta.dir, '../..');
const sandbox = mkdtempSync(path.join(os.tmpdir(), 'chalkfile-render-'));
afterAll(() => rmSync(sandbox, { recursive: true, force: true }));
let n = 0;
const tmp = () => mkdtempSync(path.join(sandbox, `t${++n}-`));

describe('フレームの範囲と crf（純粋な関数）', () => {
  test('分ける枚数が 0 か全体より大きければ全体を 1 つ、ほかはその枚数ずつ（両端を含む）', () => {
    expect(chunkRanges(300, 0)).toEqual([[0, 299]]);
    expect(chunkRanges(300, 300)).toEqual([[0, 299]]);
    expect(chunkRanges(300, 1000)).toEqual([[0, 299]]);
    expect(chunkRanges(300, 150)).toEqual([
      [0, 149],
      [150, 299],
    ]);
    expect(chunkRanges(301, 150)).toEqual([
      [0, 149],
      [150, 299],
      [300, 300],
    ]);
    expect(chunkRanges(1, 1)).toEqual([[0, 0]]);
    for (const [total, chunk] of [
      [0, 0],
      [10.5, 0],
      [10, -1],
      [10, 1.5],
    ])
      expect(() => chunkRanges(total, chunk)).toThrow();
  });
  test('crf は 21 から 2 ずつ 29 まで。6 分（360 秒・切り捨て）より長い動画は 27 から', () => {
    expect(crfSteps({ durationInFrames: 300, fps: 30 })).toEqual([21, 23, 25, 27, 29]);
    expect(crfSteps({ durationInFrames: 360 * 30, fps: 30 })).toEqual([21, 23, 25, 27, 29]);
    // 360.9 秒は切り捨てて 360 秒（前の render.sh の整数の割り算と同じ）
    expect(crfSteps({ durationInFrames: 360 * 30 + 27, fps: 30 })).toEqual([21, 23, 25, 27, 29]);
    expect(crfSteps({ durationInFrames: 361 * 30, fps: 30 })).toEqual([27, 29]);
  });
  test('並列の数の既定は 8 と CPU の数の小さいほう', () => {
    expect(defaultConcurrency(14)).toBe(8);
    expect(defaultConcurrency(4)).toBe(4);
    expect(defaultConcurrency(0)).toBe(1);
  });
});

describe('名前', () => {
  test('動画の名前は、レクチャー ID か、レクチャー ID.言語（パスと ffmpeg の一覧に入るので、ほかは使い方の誤り）', () => {
    for (const k of ['L01', 'P01.en', 'S03.zh', 'X_1-a']) expect(checkKey(k)).toBe(k);
    for (const k of ['', '../L01', 'L01/..', 'L01.EN', 'L01.en.zh', "L01'x", '-L01', 'L01 ', '.en'])
      expect(() => checkKey(k)).toThrow(UsageError);
  });
  test('出力の名前。ポスターは公開する言語の動画だけ講座のフォルダに置き、ほかの言語は site/media の写しだけ', () => {
    const ja = videoFiles({ key: 'G01', lang: 'ja', course: { id: 'ga4-comedy' } }, ['ja']);
    expect(ja).toEqual({
      key: 'G01',
      mix: 'public/audio/mix/G01.wav',
      master: 'out/master/G01.mp4',
      masterCc: 'out/master/G01.cc.mp4',
      site: 'site/media/G01.mp4',
      siteCc: 'site/media/G01.cc.mp4',
      captioned: 'out/captioned/G01.mp4',
      poster: 'content/ga4-comedy/generated/posters/G01.jpg',
      sitePoster: 'site/media/G01.jpg',
    });
    expect(videoFiles({ key: 'P01.en', lang: 'en', course: { id: 'pstack-comedy' } }, ['ja']).poster).toBeNull();
    expect(videoFiles({ key: 'P01.en', lang: 'en', course: { id: 'pstack-comedy' } }, ['ja', 'en']).poster).toBe(
      'content/pstack-comedy/generated/posters/P01.en.jpg',
    );
    expect(() => videoFiles({ key: '../x', lang: 'ja', course: { id: 'c' } }, ['ja'])).toThrow(UsageError);
  });
  test('一時の名前は同じフォルダで拡張子を残す。部品の名前', () => {
    expect(tmpOf('site/media/G01.cc.mp4')).toBe('site/media/G01.cc.tmp.mp4');
    expect(tmpOf('content/c/generated/posters/P01.en.jpg')).toBe('content/c/generated/posters/P01.en.tmp.jpg');
    const f = videoFiles({ key: 'L01', lang: 'ja', course: { id: 'c' } }, ['ja']);
    expect(partOf(f, 3)).toBe('out/master/L01.part3.mp4');
    expect(partOf(f, 0, true)).toBe('out/master/L01.cc.part0.mp4');
    for (const name of ['L01.part0.mp4', 'L01.part12.mp4', 'L01.cc.part1.mp4'])
      expect(isPartName('L01', name)).toBe(true);
    for (const name of [
      'L01.part.mp4',
      'L010.part0.mp4',
      'L01.parts.txt',
      'L01.mp4',
      'L01.part0.mp4.tmp',
      'L01.en.part0.mp4',
    ])
      expect(isPartName('L01', name)).toBe(false);
    expect(concatList(['out/master/L01.part0.mp4', 'out/master/L01.part1.mp4'])).toBe(
      "file 'L01.part0.mp4'\nfile 'L01.part1.mp4'\n",
    );
  });
});

describe('ffmpeg の引数（前の render.sh と同じ値）', () => {
  test('サイト用・配る用の字幕版・ポスター・部品をつなぐ', () => {
    expect(siteArgs({ video: 'v.mp4', audio: 'a.wav', out: 'o.mp4', crf: 23 }).join(' ')).toBe(
      '-y -hide_banner -loglevel error -i v.mp4 -i a.wav -map 0:v:0 -map 1:a:0 -c:v libx264 -preset slow -crf 23 -maxrate 2000k -bufsize 4000k -pix_fmt yuv420p -profile:v high -g 150 -c:a aac -b:a 128k -ar 48000 -shortest -movflags +faststart o.mp4',
    );
    expect(captionedArgs({ video: 'v.mp4', audio: 'a.wav', out: 'o.mp4' }).join(' ')).toBe(
      '-y -hide_banner -loglevel error -i v.mp4 -i a.wav -map 0:v:0 -map 1:a:0 -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -profile:v high -g 150 -c:a aac -b:a 160k -ar 48000 -shortest -movflags +faststart o.mp4',
    );
    expect(posterArgs({ video: 'v.mp4', out: 'p.jpg' }).join(' ')).toBe(
      '-y -hide_banner -loglevel error -ss 4.2 -i v.mp4 -frames:v 1 -vf scale=1280:-2 -q:v 3 p.jpg',
    );
    expect(concatArgs({ list: 'l.txt', out: 'o.mp4' }).join(' ')).toBe(
      '-y -hide_banner -loglevel error -f concat -safe 0 -i l.txt -c copy o.mp4',
    );
  });
  test('Remotion の映像は h264・crf 16・JPEG 92（前の remotion.config.ts と render.sh の値）', () => {
    expect(RENDER.master).toEqual({ codec: 'h264', crf: 16, imageFormat: 'jpeg', jpegQuality: 92 });
    expect(RENDER.concurrency).toBe(8);
  });
});

/** ffprobe の結果の見本（1920x1080・30fps・300 フレーム。audio を付けると AAC 48 kHz） */
const probeOf = ({ frames = 300, audio = true, codec = 'h264', width = 1920, rate = 48000 } = {}): Probe => ({
  streams: [
    {
      codec_type: 'video',
      codec_name: codec,
      width,
      height: 1080,
      r_frame_rate: '30/1',
      nb_frames: String(frames),
      duration: String(frames / 30),
    },
    ...(audio
      ? [{ codec_type: 'audio', codec_name: 'aac', sample_rate: String(rate), duration: String(frames / 30) }]
      : []),
  ],
  format: { duration: String(frames / 30) },
});
const want = { width: 1920, height: 1080, fps: 30, frames: 300 };

describe('ffprobe で確かめる', () => {
  test('合う動画は問題なし。形式・大きさ・フレームの数・音のあるなし・音の速さが違えば、それを出す', () => {
    expect(videoProblems(probeOf(), { ...want, audio: true })).toEqual([]);
    expect(videoProblems(probeOf({ audio: false }), { ...want, audio: false })).toEqual([]);
    expect(videoProblems(probeOf({ codec: 'hevc' }), { ...want, audio: true })[0]).toContain('h264 のはず');
    expect(videoProblems(probeOf({ width: 1280 }), { ...want, audio: true })[0]).toContain('1920x1080 のはず');
    expect(videoProblems(probeOf({ frames: 299 }), { ...want, audio: false }).join()).toContain('300 枚のはず');
    expect(videoProblems(probeOf({ audio: false }), { ...want, audio: true }).join()).toContain('音が 0 本');
    expect(videoProblems(probeOf(), { ...want, audio: false }).join()).toContain('音なしのはず');
    expect(videoProblems(probeOf({ rate: 44100 }), { ...want, audio: true }).join()).toContain('48000 Hz のはず');
    expect(videoProblems({}, { ...want, audio: false }).join()).toContain('映像が 0 本');
  });
  test('音と合わせた動画は、1 フレームまで短くてよい（-shortest）。それより短いか、長いのは違う', () => {
    expect(videoProblems(probeOf({ frames: 299 }), { ...want, audio: true, slack: 1 })).toEqual([]);
    expect(videoProblems(probeOf({ frames: 298 }), { ...want, audio: true, slack: 1 }).join()).toContain(
      '300 枚のはず',
    );
    expect(videoProblems(probeOf({ frames: 301 }), { ...want, audio: true, slack: 1 }).join()).toContain(
      '300 枚のはず',
    );
  });
  test('ポスターは JPEG 1 枚で、幅 1280', () => {
    expect(posterProblems({ streams: [{ codec_name: 'mjpeg', width: 1280, height: 720 }] })).toEqual([]);
    expect(posterProblems({ streams: [{ codec_name: 'png', width: 640 }] }).join()).toContain('JPEG のはず');
    expect(posterProblems({ streams: [] }).join()).toContain('画像が 0 枚');
  });
});

describe('引数と環境変数（--jobs・--chunk・--captions と CONCURRENCY・CHUNK・CAPTIONS）', () => {
  test('既定は並列 min(8, CPU)・分けない・字幕版は掛け合いの講座だけ', () => {
    expect(readOptions({}, {}, 14)).toEqual({ jobs: 8, chunk: 0, captions: 'auto' });
    expect(readOptions({}, {}, 4)).toEqual({ jobs: 4, chunk: 0, captions: 'auto' });
    expect(readOptions({}, { CAPTIONS: '', CHUNK: '', CONCURRENCY: '' }, 4)).toEqual({
      jobs: 4,
      chunk: 0,
      captions: 'auto',
    });
  });
  test('環境変数（前の呼び方）も読み、引数が先', () => {
    expect(readOptions({}, { CONCURRENCY: '3', CHUNK: '1200', CAPTIONS: '1' }, 14)).toEqual({
      jobs: 3,
      chunk: 1200,
      captions: 'all',
    });
    expect(readOptions({ jobs: '6', chunk: '900' }, { CONCURRENCY: '3', CHUNK: '1200' }, 14)).toMatchObject({
      jobs: 6,
      chunk: 900,
    });
    expect(readOptions({ captions: true }, {}, 14).captions).toBe('all');
    expect(readOptions({}, { CAPTIONS: '0' }, 14).captions).toBe('none');
  });
  test('数でない・範囲の外（並列は CPU の数まで）・知らない CAPTIONS は、使い方の誤り', () => {
    for (const [values, env] of [
      [{ jobs: 'x' }, {}],
      [{ jobs: '0' }, {}],
      [{ jobs: '15' }, {}],
      [{}, { CONCURRENCY: '-1' }],
      [{ chunk: '1.5' }, {}],
      [{}, { CHUNK: 'abc' }],
      [{}, { CAPTIONS: 'yes' }],
    ] as const)
      expect(() => readOptions(values, env, 14)).toThrow(UsageError);
  });
  test('字幕版を作るか', () => {
    expect(wantsCaptions({ captions: 'auto' }, true)).toBe(true);
    expect(wantsCaptions({ captions: 'auto' }, false)).toBe(false);
    expect(wantsCaptions({ captions: 'all' }, false)).toBe(true);
    expect(wantsCaptions({ captions: 'none' }, true)).toBe(false);
  });
});

describe('書き出す前に確かめる（本物の台本と、Git に入れた timeline）', () => {
  const g01 = VIDEOS.find((v) => v.key === 'G01') as Video;
  const l12 = VIDEOS.find((v) => v.key === 'L12') as Video;
  const timelines = readTimelinesByKey(ROOT);
  test('掛け合いの講座は字幕版も作る。CAPTIONS=0 なら作らず、そのことを覚えておく。--captions なら全部', () => {
    const root = tmp();
    const plan = (captions: 'auto' | 'all' | 'none') =>
      planJobs([g01, l12], { jobs: 1, chunk: 0, captions }, { root, publishLangs: ['ja'], timelines }).jobs.map(
        (j) => `${j.key} ${j.captions} ${j.captionsSkipped}`,
      );
    expect(plan('auto')).toEqual(['G01 true false', 'L12 false false']);
    expect(plan('none')).toEqual(['G01 false true', 'L12 false false']);
    expect(plan('all')).toEqual(['G01 true false', 'L12 true false']);
  });
  test('timeline が無い・ミックスの音が無い動画を、書き出す前にまとめて出す', () => {
    const root = tmp();
    const none = planJobs(
      [g01, l12],
      { jobs: 1, chunk: 0, captions: 'auto' },
      { root, publishLangs: ['ja'], timelines: new Map() },
    );
    expect(none.missing).toEqual([
      'G01: timeline が無い（先に npm run synth -- G01）',
      'G01: ミックスの音が無い（先に npm run mix -- G01）',
      'L12: timeline が無い（先に npm run synth -- L12）',
      'L12: ミックスの音が無い（先に npm run mix -- L12）',
    ]);
    mkdirSync(path.join(root, 'public/audio/mix'), { recursive: true });
    writeFileSync(path.join(root, 'public/audio/mix/G01.wav'), 'wav');
    const ok = planJobs([g01], { jobs: 1, chunk: 0, captions: 'auto' }, { root, publishLangs: ['ja'], timelines });
    expect(ok).toMatchObject({ missing: [], broken: [] });
    const t = timelines.get('G01')?.[0]?.timeline;
    expect(ok.jobs[0]).toMatchObject({ key: 'G01', composition: 'G01', frames: t?.durationInFrames, fps: t?.fps });
  });
  test('台本と合わない（古い）timeline は、書き出す前に止める（先に synth）', () => {
    const root = tmp();
    const entry = timelines.get('G01')?.[0];
    if (!entry?.timeline) throw new Error('G01 の timeline が無い');
    const stale = new Map([['G01', [{ ...entry, timeline: { ...entry.timeline, fingerprint: 'ffffffffffffffff' } }]]]);
    const r = planJobs(
      [g01],
      { jobs: 1, chunk: 0, captions: 'auto' },
      { root, publishLangs: ['ja'], timelines: stale },
    );
    expect(r.missing[0]).toContain('G01: timeline が台本と合わない（先に npm run synth -- G01）');
  });
});

/* ───────────── 偽の道具で流す書き出し ───────────── */

const PREVIOUS = [
  'out/master/T01.mp4',
  'out/master/T01.cc.mp4',
  'out/master/T01.part0.mp4',
  'out/master/T01.part1.mp4',
  'out/master/T01.parts.txt',
  'out/master/T01.cc.part0.mp4',
  'site/media/T01.mp4',
  'site/media/T01.cc.mp4',
  'site/media/T01.jpg',
  'content/t-course/generated/posters/T01.jpg',
  'out/captioned/T01.mp4',
];
/** 前の書き出しのうち、失敗しても変わらないもの（サイト用の動画・ポスター・配る用の字幕版） */
const UNCHANGED = {
  'content/t-course/generated/posters/T01.jpg': 'old',
  'out/captioned/T01.mp4': 'old',
  'site/media/T01.cc.mp4': 'old',
  'site/media/T01.jpg': 'old',
  'site/media/T01.mp4': 'old',
};

type Fake = {
  /** Remotion の動き（ok: 書く・fail: 書かずに失敗・partial: 途中まで書いて失敗・hang: 止められるまで待つ）。字幕版は remotionCc */
  remotion?: 'ok' | 'fail' | 'partial' | 'hang';
  remotionCc?: 'ok' | 'fail' | 'partial' | 'hang';
  /** ffmpeg が書く動画の大きさ（バイト）。無ければ 'encoded' */
  bytes?: number;
  /** ffprobe がサイト用の動画の音を出さない（確かめで止まる） */
  noAudio?: boolean;
  frames?: number;
  captions?: boolean;
  captionsSkipped?: boolean;
  chunk?: number;
  limits?: Limits;
  poster?: boolean;
};

/** 300 フレーム（10 秒）の T01 を、偽の道具で書き出す。終わったあとの出力・道具の呼ばれ方・記録・知らせを返す */
const render = async (fake: Fake = {}) => {
  const root = tmp();
  const put = (file: string, text: string) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), text);
  };
  for (const f of PREVIOUS) put(f, 'old');
  put('public/audio/mix/T01.wav', 'wav');
  const frames = fake.frames ?? 300;
  const files = videoFiles({ key: 'T01', lang: 'ja', course: { id: 't-course' } }, fake.poster === false ? [] : ['ja']);
  const job: Job = {
    key: 'T01',
    composition: 'T01',
    files,
    frames,
    fps: 30,
    captions: fake.captions ?? false,
    captionsSkipped: fake.captionsSkipped ?? false,
  };
  const calls: string[] = [];
  const ac = new AbortController();
  const rel = (p: string) => path.relative(root, p);
  const deps: RenderDeps = {
    root,
    open: async () => ({
      render: async ({ captions, out, frameRange }) => {
        calls.push(`remotion ${captions ? 'cc ' : ''}${frameRange ? frameRange.join('-') : 'all'} ${out}`);
        const mode = (captions ? fake.remotionCc : fake.remotion) ?? 'ok';
        if (mode === 'hang') {
          put(out, 'half');
          // 止められるまで待つ（Ctrl-C を受けた道具が、書き出しを取り消すところ）
          await new Promise((_, reject) => {
            ac.signal.addEventListener('abort', () => reject(new Error('renderMedia() got cancelled')), { once: true });
            setTimeout(() => ac.abort(), 5);
          });
        }
        if (mode === 'fail') throw new Error('書き出しに失敗');
        if (mode === 'partial') {
          put(out, 'half');
          throw new Error('途中で失敗');
        }
        put(out, captions ? 'new-cc' : 'new');
        return { width: 1920, height: 1080, fps: 30, durationInFrames: frames };
      },
      close: async () => {
        calls.push('close');
      },
    }),
    ffmpeg: async (args) => {
      const out = args[args.length - 1];
      calls.push(
        `ffmpeg ${args.includes('concat') ? 'concat' : args.includes('-ss') ? 'poster' : `crf ${args[args.indexOf('-crf') + 1]}`} ${rel(out)}`,
      );
      if (fake.bytes !== undefined && !out.endsWith('.jpg')) {
        mkdirSync(path.dirname(out), { recursive: true });
        writeFileSync(out, Buffer.alloc(fake.bytes));
      } else put(rel(out), out.endsWith('.jpg') ? 'poster' : 'encoded');
    },
    probe: async (file) => {
      if (file.endsWith('.jpg')) return { streams: [{ codec_name: 'mjpeg', width: 1280, height: 720 }] };
      return probeOf({ frames, audio: !file.startsWith('out/master/') && !fake.noAudio });
    },
    record: {
      begin: (key) => {
        calls.push(`record begin ${key}`);
        return undefined;
      },
      commit: (key) => {
        // 記録する時点で、全部の出力が置き換わっている
        calls.push(`record commit ${key} ${readFileSync(path.join(root, 'site/media/T01.mp4'), 'utf8').slice(0, 7)}`);
      },
      abort: (key) => calls.push(`record abort ${key}`),
    },
    signal: ac.signal,
    log: () => undefined,
    warn: (line) => calls.push(`warn ${line}`),
    now: () => 0,
  };
  let error: Error | null = null;
  try {
    await renderAll(
      [job],
      { jobs: 1, chunk: fake.chunk ?? 0, captions: 'auto' },
      fake.limits ?? { target: 14500 * 1024, max: 32 * 1024 * 1024 },
      deps,
    );
  } catch (e) {
    error = e as Error;
  }
  const out: Record<string, string> = {};
  for (const f of readdirSync(root, { recursive: true }).map(String).sort()) {
    if (!/^(out|site|content)\//.test(f)) continue;
    const s = statSync(path.join(root, f));
    if (s.isFile()) out[f] = s.size > 64 ? `${s.size} bytes` : readFileSync(path.join(root, f), 'utf8');
  }
  return {
    error,
    files: out,
    calls,
    warns: calls.filter((c) => c.startsWith('warn ')).map((c) => c.slice(5)),
    aborted: ac.signal.aborted,
  };
};

describe('書き出しの失敗を見逃さず、前の出力を壊さない', () => {
  test('Remotion が失敗したら（途中まで書いてから失敗しても）止まり、サイト用の出力を変えず、前の映像・部品・一時のファイルも残さない', async () => {
    for (const remotion of ['fail', 'partial'] as const) {
      const r = await render({ remotion });
      expect(r.error?.message).toContain('T01: 書き出しに失敗しました');
      expect(r.files).toEqual(UNCHANGED);
      expect(r.calls.filter((c) => c.startsWith('record'))).toEqual(['record begin T01', 'record abort T01']);
      expect(r.calls).toContain('close');
    }
  });
  test('字幕版だけ失敗しても、通常版のサイト用の出力を変えない（音なしの通常版の映像は新しいまま）', async () => {
    const r = await render({ captions: true, remotionCc: 'fail' });
    expect(r.error?.message).toContain('T01: 書き出しに失敗しました');
    expect(r.files).toEqual({ ...UNCHANGED, 'out/master/T01.mp4': 'new' });
  });
  test('分けて書き出すとき、前の部品が残っていても使わない', async () => {
    const r = await render({ chunk: 150, remotion: 'fail' });
    expect(r.error).not.toBeNull();
    expect(r.files).toEqual(UNCHANGED);
    expect(r.calls[1]).toMatch(/^remotion 0-149 /);
  });
  test('ffprobe の確かめで違えば（サイト用の動画に音が無い）、置き換えずに止め、一時のファイルを消す', async () => {
    const r = await render({ noAudio: true });
    expect(r.error?.message).toContain('site/media/T01.tmp.mp4 が求める形と違う: 音が 0 本');
    expect(r.files).toEqual({ ...UNCHANGED, 'out/master/T01.mp4': 'new' });
  });
  test('止められたら（Ctrl-C）、書き出しを取り消して止まり、前の出力を残し、一時のファイルを残さない', async () => {
    const r = await render({ remotion: 'hang' });
    expect(r.aborted).toBe(true);
    expect(r.error?.message).toContain('got cancelled');
    expect(r.files).toEqual(UNCHANGED);
    expect(r.calls.filter((c) => c.startsWith('record'))).toEqual(['record begin T01', 'record abort T01']);
  });
});

describe('うまくいったとき', () => {
  test('全部の出力を一時の名前に書いてから置き換え、一時のファイルと部品を残さない。記録は全部を置き換えたあと', async () => {
    const r = await render({ captions: true, chunk: 150 });
    expect(r.error).toBeNull();
    expect(r.files).toEqual({
      'content/t-course/generated/posters/T01.jpg': 'poster',
      'out/captioned/T01.mp4': 'encoded',
      'out/master/T01.cc.mp4': 'encoded',
      'out/master/T01.mp4': 'encoded',
      'site/media/T01.cc.mp4': 'encoded',
      'site/media/T01.jpg': 'poster',
      'site/media/T01.mp4': 'encoded',
    });
    expect(r.calls.filter((c) => c.startsWith('remotion')).map((c) => c.split(' ').slice(0, -1).join(' '))).toEqual([
      'remotion 0-149',
      'remotion 150-299',
      'remotion cc 0-149',
      'remotion cc 150-299',
    ]);
    expect(r.calls[0]).toBe('record begin T01');
    expect(r.calls[r.calls.length - 1]).toBe('record commit T01 encoded');
    // サイト用の動画は、一時の名前に書く
    expect(r.calls).toContain('ffmpeg crf 21 site/media/T01.tmp.mp4');
    expect(r.calls).toContain('ffmpeg crf 21 site/media/T01.cc.tmp.mp4');
    expect(r.calls).toContain('ffmpeg poster content/t-course/generated/posters/T01.tmp.jpg');
  });
  test('公開しない言語の動画は、ポスターを講座のフォルダに書かない（site/media の写しだけ）', async () => {
    const r = await render({ poster: false });
    expect(r.error).toBeNull();
    expect(r.files['content/t-course/generated/posters/T01.jpg']).toBe('old');
    expect(r.files['site/media/T01.jpg']).toBe('poster');
    expect(r.calls).toContain('ffmpeg poster site/media/T01.tmp.jpg');
  });
  test('掛け合いの講座で字幕版を作らない（CAPTIONS=0）ときは、前の字幕版が残ることを知らせ、記録しない', async () => {
    const r = await render({ captionsSkipped: true });
    expect(r.error).toBeNull();
    expect(r.warns.join('\n')).toContain('字幕を焼き込んだ版（site/media/T01.cc.mp4）は作り直さず、前のままです');
    expect(r.files['site/media/T01.cc.mp4']).toBe('old');
    expect(r.calls.filter((c) => c.startsWith('record'))).toEqual(['record begin T01', 'record abort T01']);
  });
});

describe('サイト用の動画の大きさ（目安と保存の上限は site/limits.ts）', () => {
  test('いちばん上の crf でも目安を超えたら、警告して使う', async () => {
    const r = await render({ bytes: 15 * 1000 * 1000 });
    expect(r.error).toBeNull();
    expect(r.calls.flatMap((c) => /^ffmpeg crf (\d+) site\/media\/T01\.tmp\.mp4$/.exec(c)?.[1] ?? [])).toEqual([
      '21',
      '23',
      '25',
      '27',
      '29',
    ]);
    expect(r.warns.join('\n')).toContain(
      '警告: site/media/T01.mp4 は crf 29 でも 14648 KiB で、目安（14500 KiB）を超えています',
    );
    expect(r.warns.join('\n')).not.toContain('保存の 1 ファイルの上限');
    expect(r.files['site/media/T01.mp4']).toBe(`${15 * 1000 * 1000} bytes`);
  });
  test('6 分より長い動画は crf 27 から試す', async () => {
    const r = await render({ bytes: 20 * 1000 * 1000, frames: 361 * 30 });
    expect(r.calls.flatMap((c) => /^ffmpeg crf (\d+) site\/media\/T01\.tmp\.mp4$/.exec(c)?.[1] ?? [])).toEqual([
      '27',
      '29',
    ]);
  });
  test('目安に収まれば、そこで止める。保存の上限も超えたら、別に警告して、書き出した動画は残す', async () => {
    const fits = await render({ bytes: 20 * 1024, limits: { target: 30 * 1024, max: 1024 * 1024 } });
    expect(fits.calls.filter((c) => /^ffmpeg crf/.test(c) && c.endsWith('T01.tmp.mp4'))).toEqual([
      'ffmpeg crf 21 site/media/T01.tmp.mp4',
    ]);
    expect(fits.warns).toEqual([]);
    const big = await render({ bytes: 2 * 1024 * 1024, limits: { target: 10 * 1024, max: 1024 * 1024 } });
    expect(big.error).toBeNull();
    expect(big.warns.join('\n')).toContain('警告: site/media/T01.mp4 は保存の 1 ファイルの上限（1 MiB）も超えています');
    expect(big.warns.join('\n')).toContain('保存の 1 ファイルの上限（1 MiB）を超えた動画があります');
    expect(big.files['site/media/T01.mp4']).toBe(`${2 * 1024 * 1024} bytes`);
  });
});

test('書き出しの道具は、一時のフォルダの外のファイルに触れない（このテストが作業フォルダに何も残さない）', () => {
  expect(existsSync(path.join(ROOT, 'site/media/T01.mp4'))).toBe(false);
  expect(existsSync(path.join(ROOT, 'content/t-course'))).toBe(false);
});
