// 本物の build 出力を /chalkfile/ に配り、通信・更新の障害だけをテスト用に注入する。
// 公開サイト・生成元の動画・元 checkout は変更しない。127.0.0.1 だけで待ち受ける。
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { byteRange } from '../site/offline-shared';
import type { CourseManifest } from '../site/offline-shared';

const root = path.resolve(import.meta.dir, '../site/dist');
let control = { mode: 'normal', update: false, workerUpdate: false, manifestMode: 'normal' };
let fullVideoDownloads = 0;
let manifestRequests = 0;
let manifestFailures = 0;
const hash = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
const baseManifest = JSON.parse(readFileSync(path.join(root, 'stripe-billing/offline-manifest.json'), 'utf8')) as CourseManifest;
const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png',
  '.mp4': 'video/mp4', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
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

Bun.serve({ hostname: '127.0.0.1', port: 8877, async fetch(req) {
  const u = new URL(req.url);
  if (u.pathname === '/__test/health') return new Response('ok');
  if (u.pathname === '/__test/control' && req.method === 'POST') {
    control = { mode: 'normal', update: false, workerUpdate: false, manifestMode: 'normal', ...await req.json() };
    fullVideoDownloads = 0;
    manifestRequests = 0;
    manifestFailures = 0;
    return Response.json(control);
  }
  if (u.pathname === '/__test/stats') return Response.json({ fullVideoDownloads, manifestRequests, manifestFailures });
  if (!u.pathname.startsWith('/chalkfile/')) return new Response('not found', { status: 404 });
  let relative: string;
  try { relative = decodeURIComponent(u.pathname.slice('/chalkfile/'.length)); } catch { return new Response('bad request', { status: 400 }); }
  let file = path.join(root, relative);
  if (!file.startsWith(root + path.sep) && file !== root) return new Response('forbidden', { status: 403 });
  if (!existsSync(file)) return new Response('not found', { status: 404 });
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
  const type = types[path.extname(file)] ?? 'application/octet-stream';
  if (relative.endsWith('.mp4') && !req.headers.has('Range')) {
    fullVideoDownloads++;
    if (relative.endsWith('L03.mp4')) {
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
  if (req.method === 'HEAD') return new Response(null, { headers });
  const range = byteRange(req.headers.get('Range'), size);
  if (range.kind === 'unsatisfiable') return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  if (range.kind === 'partial') return new Response(data.subarray(range.start, range.end + 1), { status: 206,
    headers: { ...headers, 'Content-Length': String(range.end - range.start + 1), 'Content-Range': `bytes ${range.start}-${range.end}/${size}` } });
  return new Response(data, { headers });
} });
