// ブラウザのテストで配る講座サイトを用意する（テストのサーバー tests/browser-server.ts が、初めて頼まれたときに 1 回だけ作る）。
//   ci: 合成の講座（tests/fixtures/content/site-sample）を、buildSite で一時のフォルダに組む。動画は ffmpeg の testsrc で作る（4 秒・小さい）。
//       旧 Pages の P01 の動画も合成の動画にし、旧 Pages の保存の manifest の大きさと sha256 を、その動画に合わせて配る
//   real: 本物の講座（npm run build:site で作った site/dist と、手元の site/media の動画）
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { COURSES } from '../../content';
import type { HeroSnippet } from '../../content/course-module';
import { localMediaPath, readMediaManifest } from '../../scripts/media';
import { buildSite } from '../../scripts/site/build';
import { type MediaFiles, mediaFilesOf } from '../../scripts/site/serve-files';
import { type MediaEntry, mediaFilename } from '../../site/media-shared';
import type { CourseManifest } from '../../site/offline-shared';
import { resolveCourse } from '../../content/lines';
import SAMPLE from '../fixtures/content/site-sample';
import type { SiteMode, SiteSession } from './site';

const ROOT = path.resolve(import.meta.dir, '../..');
/** 前の公開の旧 Pages（tests/fixtures/legacy-pages）の、動画を持つ講座の保存の manifest */
const LEGACY_MANIFEST = path.join(ROOT, 'tests/fixtures/legacy-pages/pstack-comedy/offline-manifest.json');

/** 配る講座サイト（セッションの間で共有する。書き換えない） */
export type PreparedSite = {
  mode: SiteMode;
  dist: string;
  media: MediaFiles;
  course: SiteSession['course'];
  /** 旧 Pages の P01 の動画（通常版と字幕版）。manifest は、ci で大きさと sha256 を合成の動画に合わせたもの（real は fixture のまま） */
  legacy: { video: string; captioned: string; manifest: string | null };
  videoSeconds: number | null;
  shellPng: string;
};

const sha256 = (data: Uint8Array | string) => createHash('sha256').update(data).digest('hex');

/** 本物の講座。site/dist（npm run build:site -- --strict）と、手元の動画（npm run media:pull など）を配る */
export function prepareRealSite(): PreparedSite {
  const dist = path.join(ROOT, 'site/dist');
  const id = 'stripe-billing';
  const file = path.join(dist, id, 'offline-manifest.json');
  if (!existsSync(file))
    throw new Error(`${path.relative(ROOT, file)} がありません。先に npm run build:site -- --strict`);
  const manifest = JSON.parse(readFileSync(file, 'utf8')) as CourseManifest;
  const entries = readMediaManifest().entries;
  // レクチャーの並びは台本のとおり（動画の一覧の並びには頼らない）
  const course = COURSES.find((c) => c.id === id);
  if (!course) throw new Error(`講座がありません: ${id}`);
  const lectures = course.lectures.map((l) => ({
    id: l.id,
    video: localMediaPath({ lang: 'ja', lecture: l.id, kind: 'standard' }),
  }));
  return {
    mode: 'real',
    dist,
    media: mediaFilesOf(entries, (e) => localMediaPath(e)),
    course: { id, route: `/${id}/`, title: manifest.title, searchTerm: 'サブスク', lectures, faultLecture: 'L03' },
    legacy: {
      video: path.join(ROOT, 'site/media/P01.mp4'),
      captioned: path.join(ROOT, 'site/media/P01.cc.mp4'),
      manifest: null,
    },
    videoSeconds: null,
    shellPng: 'icons/icon-192.png',
  };
}

/** 合成の動画の長さ（秒） */
const VIDEO_SECONDS = 4;

/**
 * 合成の講座の一覧のページの画像に足す PNG（1×1）。起動用ファイルに JPEG 以外があっても、SW の install が通ること（型を拡張子の
 * 対応表から付けること）を、全部のテストで確かめる（どのテストも SW が動いてから始まる。中身は tests/browser/offline.spec.ts が見る）
 */
const EXTRA_PNG = 'e2e/mark.png';
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64',
);

/** ffmpeg の testsrc の模様で、短い MP4（H.264）を作る */
const makeVideo = (file: string, source: string) => {
  const args = [
    '-nostdin',
    '-y',
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    `${source}=size=320x180:rate=25:duration=${VIDEO_SECONDS}`,
    '-c:v',
    'libx264',
    '-preset',
    'ultrafast',
    '-pix_fmt',
    'yuv420p',
    '-g',
    '25',
    '-movflags',
    '+faststart',
    '-an',
    file,
  ];
  const r = Bun.spawnSync(['ffmpeg', ...args], { stdout: 'ignore', stderr: 'pipe' });
  if (r.exitCode !== 0) {
    throw new Error(
      `ffmpeg で合成の動画を作れません（ffmpeg と libx264 が要る）: ${r.stderr.toString().trim() || `終了コード ${r.exitCode}`}`,
    );
  }
};

/** 合成の講座を、work の下に組み立てる */
export async function prepareFixtureSite(work: string): Promise<PreparedSite> {
  const course = resolveCourse(SAMPLE.course);
  const fixture = path.join(ROOT, 'tests/fixtures/content/site-sample');
  const mediaDir = path.join(work, 'media');
  mkdirSync(mediaDir, { recursive: true });
  // レクチャーごとに模様を変える（取り違えたら、Range の中身の照らし合わせで分かる）
  const patterns = ['testsrc2', 'smptebars', 'rgbtestsrc'];
  const files = new Map<string, string>();
  const entries = course.lectures.map((l, i): MediaEntry => {
    const file = path.join(mediaDir, `${l.id}.mp4`);
    makeVideo(file, patterns[i % patterns.length]);
    const data = readFileSync(file);
    const e = {
      lang: 'ja',
      course: course.id,
      lecture: l.id,
      kind: 'standard' as const,
      bytes: data.byteLength,
      sha256: sha256(data),
      tag: `media-ja-${course.id}`,
    };
    const entry = { ...e, filename: mediaFilename(e) };
    files.set(entry.filename, file);
    return entry;
  });
  const dist = path.join(work, 'dist');
  // 一覧のページの画像は、本物（site/assets）に PNG を 1 枚足したもの
  const assetsDir = path.join(work, 'assets');
  cpSync(path.join(ROOT, 'site/assets'), assetsDir, { recursive: true });
  mkdirSync(path.dirname(path.join(assetsDir, EXTRA_PNG)), { recursive: true });
  writeFileSync(path.join(assetsDir, EXTRA_PNG), PNG_1X1);
  await buildSite({
    courses: { ja: [course], en: [], zh: [] },
    dataDir: path.join(fixture, 'data'),
    mediaManifest: { schema: 1, entries },
    outDir: dist,
    langs: ['ja'],
    hero: SAMPLE.heroSnippet as HeroSnippet,
    strict: true,
    posterOf: (_, key) => path.join(fixture, 'posters', `${key}.jpg`),
    assetsDir,
    log: () => {},
  });
  // 旧 Pages の P01 の動画（通常版と字幕版）も合成の動画にし、保存の manifest を合わせる（revision と合計も数え直す）
  const legacyDir = path.join(work, 'legacy');
  mkdirSync(legacyDir, { recursive: true });
  const legacy = { video: path.join(legacyDir, 'P01.mp4'), captioned: path.join(legacyDir, 'P01.cc.mp4') };
  makeVideo(legacy.video, 'testsrc');
  makeVideo(legacy.captioned, 'testsrc2');
  const old = JSON.parse(readFileSync(LEGACY_MANIFEST, 'utf8')) as CourseManifest;
  const swap = (url: string) =>
    /\/P01\.mp4\?/.test(url) ? legacy.video : /\/P01\.cc\.mp4\?/.test(url) ? legacy.captioned : null;
  const legacyFiles = old.files.map((f) => {
    const file = swap(f.url);
    if (!file) return f;
    const data = readFileSync(file);
    return { ...f, bytes: data.byteLength, sha256: sha256(data) };
  });
  const manifest: CourseManifest = {
    ...old,
    files: legacyFiles,
    revision: sha256(JSON.stringify(legacyFiles)),
    bytes: legacyFiles.reduce((n, f) => n + f.bytes, 0),
  };
  return {
    mode: 'ci',
    dist,
    media: mediaFilesOf(entries, (e) => files.get(e.filename) ?? ''),
    course: {
      id: course.id,
      route: `/${course.id}/`,
      title: course.title,
      searchTerm: '通信',
      lectures: entries.map((e) => ({ id: e.lecture, video: files.get(e.filename) ?? '' })),
      faultLecture: course.lectures[course.lectures.length - 1].id,
    },
    legacy: { ...legacy, manifest: JSON.stringify(manifest) },
    videoSeconds: VIDEO_SECONDS,
    shellPng: `assets/${EXTRA_PNG}`,
  };
}
