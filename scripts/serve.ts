// 講座サイト（site/dist）を手元で見る。動画の早送りに要る Range（部分取得）にも答える。
//   bun scripts/serve.ts            # http://127.0.0.1:8765/
//   PORT=9000 bun scripts/serve.ts
// python3 -m http.server は Range に答えないので、動画の途中へ飛べない
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { byteRange } from '../site/offline-shared';

const ROOT = path.resolve(import.meta.dir, '..', 'site', 'dist');
const PORT = Number(process.env.PORT ?? 8765);
const BASE_PATH = process.env.BASE_PATH ?? '/';
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.mp4': 'video/mp4',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.vtt': 'text/vtt',
  '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
};

Bun.serve({
  hostname: '127.0.0.1',
  port: PORT,
  fetch(req) {
    const { pathname } = new URL(req.url);
    if (!pathname.startsWith(BASE_PATH)) return new Response('not found', { status: 404 });
    let decoded: string;
    try { decoded = decodeURIComponent(pathname.slice(BASE_PATH.length)); } catch { return new Response('bad request', { status: 400 }); }
    let file = path.join(ROOT, decoded);
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return new Response('forbidden', { status: 403 });
    if (existsSync(file) && statSync(file).isDirectory()) {
      // 末尾の / が無いと、ページの中の相対パス（media/…）がずれる
      if (!pathname.endsWith('/')) return Response.redirect(`${pathname}/`, 301);
      file = path.join(file, 'index.html');
    }
    if (!existsSync(file)) return new Response('not found', { status: 404 });
    const body = Bun.file(file);
    const type = TYPES[path.extname(file)] ?? 'application/octet-stream';
    const size = body.size;
    const range = byteRange(req.method === 'HEAD' ? null : req.headers.get('range'), size);
    if (range.kind === 'unsatisfiable') return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    if (range.kind === 'partial') {
      const { start, end } = range;
      return new Response(body.slice(start, end + 1), {
        status: 206,
        headers: { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) },
      });
    }
    return new Response(req.method === 'HEAD' ? null : body, { headers: { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': String(size) } });
  },
});
console.log(`http://127.0.0.1:${PORT}/`);
