// 組み立てたサイトを手元で配る部品（Bun.serve の fetch の中で使う）。手元で見る scripts/serve.ts と、ブラウザのテストのサーバー
// （tests/e2e/browser-server.ts）が同じものを使う。本番の配り方に合わせる:
//   静的なファイル: Workers の静的 assets と同じく、ディレクトリは index.html・/ の無いディレクトリは 301・無いページは、そのパスから
//                  いちばん近いフォルダの 404.html を 404（wrangler.jsonc の not_found_handling: 404-page。/en/ の下は en/404.html）。
//                  型は拡張子の対応表（site/mime.ts の contentTypeOf）
//   /media/: Worker と同じく、動画の一覧にあるものだけ・GET と HEAD だけ・Range と If-Range・?download=1 は attachment
// python3 -m http.server は Range に答えないので、動画の途中へ飛べない（このファイルの bodyResponse が答える。Range の答え方は
// SW と同じ site/lib/http-range.ts の rangeResponse）
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { rangeResponse } from '../../site/lib/http-range';
import { downloadName, type MediaEntry, mediaPath } from '../../site/media-shared';
import { contentTypeOf } from '../../site/mime';

/** 応答のヘッダー */
export type ServeHeaders = Record<string, string>;

/** 中身（ファイルかバイト列）を、HEAD と Range（206・416）に答えて返す。etag を渡すと付け、If-Range が違えば全体を返す */
export function bodyResponse(
  req: Request,
  content: Blob | Uint8Array,
  headers: ServeHeaders,
  etag?: string,
): Promise<Response> {
  // バイト列は Blob にする（Range のときに slice で切り出す）
  const body = content instanceof Uint8Array ? new Blob([content.slice()]) : content;
  return rangeResponse(req, body, etag ? { ...headers, ETag: etag } : headers);
}

/** 動画の一覧の、配るパス（/media/<言語>/<講座>/<ファイル>）から、項目と手元のファイル */
export type MediaFiles = ReadonlyMap<string, { entry: MediaEntry; file: string }>;
export const mediaFilesOf = (entries: readonly MediaEntry[], fileOf: (e: MediaEntry) => string): MediaFiles =>
  new Map(entries.map((entry) => [mediaPath(entry), { entry, file: fileOf(entry) }]));

/** 動画の応答のヘッダー（Worker と同じ。?download=1 は attachment） */
export const mediaHeaders = (req: Request, entry: MediaEntry, extra: ServeHeaders = {}): ServeHeaders => {
  const headers: ServeHeaders = { 'Content-Type': 'video/mp4', 'X-Content-Type-Options': 'nosniff', ...extra };
  if (new URL(req.url).searchParams.get('download') === '1') {
    headers['Content-Disposition'] = `attachment; filename="${downloadName(entry)}"`;
  }
  return headers;
};

/** /media/ の動画。一覧に無い・手元に無い動画は 404。GET と HEAD だけ */
export async function mediaResponse(req: Request, media: MediaFiles, extra: ServeHeaders = {}): Promise<Response> {
  const found = media.get(new URL(req.url).pathname);
  if (!found || !existsSync(found.file)) return new Response('not found', { status: 404 });
  if (!['GET', 'HEAD'].includes(req.method))
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  return bodyResponse(req, Bun.file(found.file), mediaHeaders(req, found.entry, extra), `"${found.entry.sha256}"`);
}

/** 静的なファイルの、URL のパスからの見つけ方 */
export type StaticTarget =
  | { kind: 'file'; file: string; rel: string }
  | { kind: 'redirect'; location: string }
  | { kind: 'missing'; rel?: string }
  | { kind: 'forbidden' }
  | { kind: 'bad' };

/** root の下の、URL のパス（prefix を外した残り）のファイル。ディレクトリは index.html（/ が無ければ付けて移る） */
export function findStatic(root: string, pathname: string, prefix = '/'): StaticTarget {
  if (!pathname.startsWith(prefix)) return { kind: 'missing' };
  let rel: string;
  try {
    rel = decodeURIComponent(pathname.slice(prefix.length));
  } catch {
    return { kind: 'bad' };
  }
  let file = path.join(root, rel);
  if (file !== root && !file.startsWith(root + path.sep)) return { kind: 'forbidden' };
  if (existsSync(file) && statSync(file).isDirectory()) {
    // 末尾の / が無いと、ページの中の相対パス（media/…）がずれる
    if (!pathname.endsWith('/')) return { kind: 'redirect', location: `${pathname}/` };
    file = path.join(file, 'index.html');
    rel = path.posix.join(rel, 'index.html');
  }
  if (!existsSync(file) || !statSync(file).isFile()) return { kind: 'missing', rel: rel.split(path.sep).join('/') };
  return { kind: 'file', file, rel: rel.split(path.sep).join('/') };
}

/** ファイルを、型（site/mime.ts）を付けて返す */
export const fileResponse = (
  req: Request,
  file: string,
  body: Blob | Uint8Array = Bun.file(file),
  extra: ServeHeaders = {},
) => bodyResponse(req, body, { 'Content-Type': contentTypeOf(file) ?? 'application/octet-stream', ...extra });

/** 静的なファイルを返す。無いものは、いちばん近いフォルダの 404.html を 404 で返す（無ければ素の 404） */
export async function staticResponse(
  req: Request,
  root: string,
  prefix = '/',
  extra: ServeHeaders = {},
): Promise<Response> {
  const target = findStatic(root, new URL(req.url).pathname, prefix);
  if (target.kind === 'file') return fileResponse(req, target.file, undefined, extra);
  return notFoundResponse(target, root, extra);
}

/**
 * 無いパス（root からの場所）に返す 404.html。そのパスのフォルダ（/ で終わるならそのフォルダ）から上へたどり、最初にあるもの
 * （Workers の静的 assets の not_found_handling: 404-page と同じ選び方）。無ければ null
 */
export function nearestNotFound(root: string, rel: string): string | null {
  const parts = rel.split('/').filter(Boolean);
  if (!rel.endsWith('/')) parts.pop();
  for (let n = parts.length; n >= 0; n--) {
    const page = path.join(root, ...parts.slice(0, n), '404.html');
    if (existsSync(page) && statSync(page).isFile()) return page;
  }
  return null;
}

/** ファイルではなかったときの応答（301・400・403・404） */
export function notFoundResponse(
  target: Exclude<StaticTarget, { kind: 'file' }>,
  root: string,
  extra: ServeHeaders = {},
): Response {
  if (target.kind === 'redirect') return Response.redirect(target.location, 301);
  if (target.kind === 'bad') return new Response('bad request', { status: 400 });
  if (target.kind === 'forbidden') return new Response('forbidden', { status: 403 });
  const page = nearestNotFound(root, target.rel ?? '');
  if (!page) return new Response('not found', { status: 404 });
  return new Response(Bun.file(page), {
    status: 404,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...extra },
  });
}
