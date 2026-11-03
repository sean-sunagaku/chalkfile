// 講座サイト（site/dist）を手元で見る。動画の途中への移動（Range）にも答える（配り方は scripts/site/serve-files.ts。本番に合わせる）。
//   bun scripts/serve.ts                  # http://127.0.0.1:8765/（8765 を使っていれば、空いている番号にして URL を出す）
//   PORT=9000 bun scripts/serve.ts        # 番号を決める（使っていれば止まる）
//   BASE_PATH=/sub/ bun scripts/serve.ts  # サイトを /sub/ の下に置く
// 動画は、講座ごとの動画の一覧（content/<講座>/generated/media.<言語>.json）にあるものを、手元の site/media/ から配る
import path from 'node:path';
import { localMediaPath, readMediaManifest } from './media';
import { mediaFilesOf, mediaResponse, staticResponse } from './site/serve-files';

const DIST = path.resolve(import.meta.dir, '..', 'site', 'dist');
const BASE_PATH = process.env.BASE_PATH ?? '/';
/** 既定の番号（Claude Code のプレビュー .claude/launch.json の site もこの番号を見る） */
const DEFAULT_PORT = 8765;

const media = mediaFilesOf(readMediaManifest().entries, (e) => localMediaPath(e));
const listen = (port: number) =>
  Bun.serve({
    hostname: '127.0.0.1',
    port,
    fetch: (req) =>
      new URL(req.url).pathname.startsWith('/media/') ? mediaResponse(req, media) : staticResponse(req, DIST, BASE_PATH),
  });

let server: ReturnType<typeof listen>;
if (process.env.PORT) server = listen(Number(process.env.PORT));
else {
  try {
    server = listen(DEFAULT_PORT);
  } catch (e) {
    if ((e as { code?: string }).code !== 'EADDRINUSE') throw e;
    // ほかの作業フォルダの serve などが使っている。空いている番号にする
    server = listen(0);
    console.log(`${DEFAULT_PORT} は使われているので、空いている番号にした`);
  }
}
console.log(`http://127.0.0.1:${server.port}${BASE_PATH}`);
