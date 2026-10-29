// 講座サイト（site/dist）を手元で見る。動画の早送りに要る Range（部分取得）にも答える。
//   bun scripts/serve.ts            # http://127.0.0.1:8765/
//   PORT=9000 bun scripts/serve.ts
// python3 -m http.server は Range に答えないので、動画の途中へ飛べない
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dir, '..', 'site', 'dist');
const PORT = Number(process.env.PORT ?? 8765);
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.mp4': 'video/mp4',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.vtt': 'text/vtt',
};

Bun.serve({
  hostname: '127.0.0.1',
  port: PORT,
  fetch(req) {
    const { pathname } = new URL(req.url);
    let file = path.join(ROOT, decodeURIComponent(pathname));
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return new Response('forbidden', { status: 403 });
    if (existsSync(file) && statSync(file).isDirectory()) {
      // 末尾の / が無いと、ページの中の相対パス（media/…）がずれる
      if (!pathname.endsWith('/')) return Response.redirect(`${pathname}/`, 301);
      file = path.join(file, 'index.html');
    }
    if (!existsSync(file)) return new Response('not found', { status: 404 });
    const body = Bun.file(file);
    const type = TYPES[path.extname(file)] ?? 'application/octet-stream';
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') ?? '');
    if (m && (m[1] || m[2])) {
      const size = body.size;
      const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
      const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
      if (start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
      return new Response(body.slice(start, end + 1), {
        status: 206,
        headers: { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) },
      });
    }
    return new Response(body, { headers: { 'Content-Type': type, 'Accept-Ranges': 'bytes' } });
  },
});
console.log(`http://127.0.0.1:${PORT}/`);
