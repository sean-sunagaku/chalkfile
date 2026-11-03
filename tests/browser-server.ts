// 本物の build 出力を /chalkfile/ に配り、通信・更新の障害だけをテスト用に注入する。
// 公開サイト・生成元の動画・元 checkout は変更しない。127.0.0.1 だけで待ち受ける。
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { byteRange } from '../site/offline-shared';
import type { CourseManifest } from '../site/offline-shared';
import { mediaPath } from '../site/media-shared';
import { mimeTypeOf } from '../site/mime';
import { localMediaPath, readMediaManifest } from '../scripts/media';
import { buildMigration } from '../scripts/build_migration';

// 移行SWの古い生成物で結果が変わらないよう、テスト起動時に必ず現在のソースから作る。
await buildMigration();
const root = path.resolve(import.meta.dir, '../site/dist');
const mediaEntries = new Map(readMediaManifest().entries.map((e) => [mediaPath(e), e]));
// mediaDown: 訳の動画のサイトがまだ無い（公開の前・Pages の反映待ち）ときを作る
let control = { mode: 'normal', update: false, workerUpdate: false, manifestMode: 'normal', mediaDown: false, legacyPhase: 'old' };
let fullVideoDownloads = 0;
let manifestRequests = 0;
let manifestFailures = 0;
const hash = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
const baseManifest = JSON.parse(readFileSync(path.join(root, 'stripe-billing/offline-manifest.json'), 'utf8')) as CourseManifest;
/** 応答の型（拡張子の対応表 site/mime.ts の本体だけ。charset は付けない） */
const typeOf = (file: string) => mimeTypeOf(file) ?? 'application/octet-stream';
function variant() {
  const m = structuredClone(baseManifest);
  let page = readFileSync(path.join(root, 'stripe-billing/index.html'), 'utf8');
  if (control.update) {
    const version = hash(`${m.pageVersion}:更新テスト`);
    page = page.replaceAll(m.pageVersion, version).replace('</title>', '（更新テスト）</title>');
    m.pageVersion = version;
    for (const f of m.files) if (f.url.includes('?v=')) f.url = f.url.replace(/\?v=.*/, `?v=${version}`);
    m.files[0].sha256 = hash(page);
    m.files[0].bytes = Buffer.byteLength(page);
    m.bytes = m.files.reduce((n, f) => n + f.bytes, 0);
    m.revision = hash(JSON.stringify(m.files));
  }
  if (control.mode === 'external') {
    m.files[1].url = 'https://example.com/restricted.mp4';
    m.revision = hash(JSON.stringify(m.files));
  }
  return { m, page };
}

function legacyResponse(req: Request, relative: string): Response {
  const folder = path.resolve(import.meta.dir, control.legacyPhase === 'old' ? 'fixtures/legacy-pages' : '../site/migration-dist');
  let file = path.resolve(folder, relative || 'index.html');
  if (!file.startsWith(folder + path.sep) && file !== folder) return new Response(null, { status: 403 });
  const oldVideo = /^pstack-comedy\/media\/(P01(?:\.cc)?)\.mp4$/.exec(relative);
  if (control.legacyPhase === 'old' && oldVideo) file = path.resolve(import.meta.dir, `../site/media/${oldVideo[1]}.mp4`);
  if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!existsSync(file)) return new Response(null, { status: 404 });
  const body = Bun.file(file);
  const headers = { 'Content-Type': typeOf(file), 'Content-Length': String(body.size), 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes' };
  if (req.method === 'HEAD') return new Response(null, { headers });
  const range = byteRange(req.headers.get('Range'), body.size);
  if (range.kind === 'unsatisfiable') return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${body.size}` } });
  if (range.kind === 'partial') return new Response(body.slice(range.start, range.end + 1), { status: 206, headers: { ...headers, 'Content-Length': String(range.end - range.start + 1), 'Content-Range': `bytes ${range.start}-${range.end}/${body.size}` } });
  return new Response(body, { headers });
}

Bun.serve({ hostname: '127.0.0.1', port: 8877, async fetch(req) {
  const u = new URL(req.url);
  if (u.pathname === '/__test/health') return new Response('ok');
  if (u.pathname === '/__test/control' && req.method === 'POST') {
    control = { mode: 'normal', update: false, workerUpdate: false, manifestMode: 'normal', mediaDown: false, legacyPhase: 'old', ...await req.json() };
    fullVideoDownloads = 0;
    manifestRequests = 0;
    manifestFailures = 0;
    return Response.json(control);
  }
  if (u.pathname === '/__test/stats') return Response.json({ fullVideoDownloads, manifestRequests, manifestFailures });
  if (u.pathname.startsWith('/chalkfile/')) {
    try { return legacyResponse(req, decodeURIComponent(u.pathname.slice('/chalkfile/'.length))); }
    catch { return new Response(null, { status: 400 }); }
  }
  // 訳の言語の動画のサイト（site/config.json の media）は、公開と同じパス（/chalkfile-media-en/ など）で site/dist-media/<言語>/ を配る
  const media = mediaEntries.get(u.pathname);
  if (u.pathname.startsWith('/media/') && !media) return new Response('not found', { status: 404 });
  if (media && control.mediaDown) return new Response('not found', { status: 404 });
  const prefix = '/';
  const dir = root;
  let relative: string;
  try { relative = decodeURIComponent(u.pathname.slice(prefix.length)); } catch { return new Response('bad request', { status: 400 }); }
  let file = media ? localMediaPath(media) : path.join(dir, relative);
  if (!media && !file.startsWith(dir + path.sep) && file !== dir) return new Response('forbidden', { status: 403 });
  // 本番（wrangler.jsonc の not_found_handling: 404-page）と同じく、無いページには 404.html を 404 で返す。動画は Worker と同じ素の 404
  if (!existsSync(file)) {
    return media ? new Response('not found', { status: 404 }) : new Response(readFileSync(path.join(dir, '404.html')), { status: 404, headers: { 'Content-Type': 'text/html' } });
  }
  if (statSync(file).isDirectory()) {
    if (!u.pathname.endsWith('/')) return Response.redirect(`${u.pathname}/`, 301);
    relative += 'index.html'; file = path.join(file, 'index.html');
  }
  let data = readFileSync(file);
  if (relative === 'stripe-billing/index.html') data = Buffer.from(variant().page);
  if (relative === 'stripe-billing/offline-manifest.json') {
    manifestRequests++;
    if (control.manifestMode === 'fail' || (control.manifestMode === 'delay-first-fail' && manifestRequests === 1)) {
      if (control.manifestMode === 'delay-first-fail') await new Promise((resolve) => setTimeout(resolve, 3000));
      manifestFailures++;
      return new Response('教材情報の通信失敗テスト', { status: 503 });
    }
    data = Buffer.from(JSON.stringify(variant().m));
  }
  if (relative === 'sw.js' && control.workerUpdate) data = Buffer.concat([data, Buffer.from('\n// worker更新テスト\n')]);
  const type = typeOf(file);
  if (req.method === 'GET' && relative.endsWith('.mp4') && !req.headers.has('Range')) {
    fullVideoDownloads++;
    if (media?.lecture === 'L03') {
      if (control.mode === 'fail') return new Response('通信失敗テスト', { status: 500 });
      if (control.mode === 'redirect') return Response.redirect('https://example.com/restricted.mp4', 302);
      if (control.mode === 'partial') return new Response(data.subarray(0, 100), { status: 206, headers: { 'Content-Type': type, 'Content-Range': `bytes 0-99/${data.length}` } });
      if (control.mode === 'corrupt') { data = Buffer.from(data); data[100] ^= 255; }
      if (control.mode === 'truncated') data = data.subarray(0, Math.floor(data.length / 2));
      if (control.mode === 'delay') await new Promise((resolve) => setTimeout(resolve, 8000));
    }
  }
  const size = data.byteLength;
  const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': String(size), 'Cache-Control': 'no-store' };
  if (media && u.searchParams.get('download') === '1') Object.assign(headers, { 'Content-Disposition': `attachment; filename="${media.lecture}${media.kind === 'captioned' ? '.captioned' : ''}.mp4"` });
  if (req.method === 'HEAD') return new Response(null, { headers });
  const range = byteRange(req.headers.get('Range'), size);
  if (range.kind === 'unsatisfiable') return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  if (range.kind === 'partial') return new Response(data.subarray(range.start, range.end + 1), { status: 206,
    headers: { ...headers, 'Content-Length': String(range.end - range.start + 1), 'Content-Range': `bytes ${range.start}-${range.end}/${size}` } });
  return new Response(data, { headers });
} });
