// 講座サイト（site/dist）を手元で見る。動画の早送りに要る Range（部分取得）にも答える。
//   bun scripts/serve.ts            # http://127.0.0.1:8765/
//   PORT=9000 bun scripts/serve.ts
// 訳の言語の動画のサイト（site/config.json の media）は、公開と同じパス（/chalkfile-media-en/ など）で site/dist-media/<言語>/ を配る
// python3 -m http.server は Range に答えないので、動画の途中へ飛べない
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { byteRange } from '../site/offline-shared';
import manifest from '../site/media-manifest.json';
import { mediaPath, validateMediaManifest } from '../site/media-shared';
import { localMediaPath } from './media';

const SITE = path.resolve(import.meta.dir, '..', 'site');
const PORT = Number(process.env.PORT ?? 8765);
const BASE_PATH = process.env.BASE_PATH ?? '/';
const media = new Map(validateMediaManifest(manifest).entries.map((e) => [mediaPath(e), e]));
const config = JSON.parse(readFileSync(path.join(SITE, 'config.json'), 'utf8')) as { media?: Record<string, { url: string }> };
/** 配るもの: [URL のパスの頭, フォルダ]。動画のサイトを先に見る */
const MOUNTS: [string, string][] = [
  ...Object.entries(config.media ?? {}).map(([lang, m]): [string, string] => [new URL(m.url).pathname, path.join(SITE, 'dist-media', lang)]),
  [BASE_PATH, path.join(SITE, 'dist')],
];
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
    if (pathname.startsWith('/media/')) {
      const entry = media.get(pathname);
      if (!entry || !existsSync(localMediaPath(entry))) return new Response('not found', { status: 404 });
      if (!['GET', 'HEAD'].includes(req.method)) return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
      const body = Bun.file(localMediaPath(entry));
      const headers: Record<string, string> = { 'Content-Type': 'video/mp4', 'Content-Length': String(body.size), 'Accept-Ranges': 'bytes',
        ETag: `"${entry.sha256}"`, 'X-Content-Type-Options': 'nosniff' };
      if (new URL(req.url).searchParams.get('download') === '1') headers['Content-Disposition'] = `attachment; filename="${entry.lecture}${entry.kind === 'captioned' ? '.captioned' : ''}.mp4"`;
      if (req.method === 'HEAD') return new Response(null, { headers });
      const ifRange = req.headers.get('If-Range');
      const range = byteRange(ifRange && ifRange !== headers.ETag ? null : req.headers.get('Range'), body.size);
      if (range.kind === 'unsatisfiable') return new Response(null, { status: 416, headers: { ...headers, 'Content-Length': '0', 'Content-Range': `bytes */${body.size}` } });
      if (range.kind === 'partial') return new Response(body.slice(range.start, range.end + 1), { status: 206, headers: { ...headers,
        'Content-Length': String(range.end - range.start + 1), 'Content-Range': `bytes ${range.start}-${range.end}/${body.size}` } });
      return new Response(body, { headers });
    }
    const mount = MOUNTS.find(([p]) => pathname.startsWith(p));
    if (!mount) return new Response('not found', { status: 404 });
    const [prefix, ROOT] = mount;
    let decoded: string;
    try { decoded = decodeURIComponent(pathname.slice(prefix.length)); } catch { return new Response('bad request', { status: 400 }); }
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
