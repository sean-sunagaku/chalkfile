// 講座サイト（site/dist）を手元で見る。動画の途中への移動（Range）にも答える（配り方は scripts/site/serve-files.ts。本番に合わせる）。
//   bun scripts/serve.ts                  # http://127.0.0.1:8765/
//   PORT=9000 bun scripts/serve.ts        # 番号を変える
//   BASE_PATH=/sub/ bun scripts/serve.ts  # サイトを /sub/ の下に置く
// 動画は、講座ごとの動画の一覧（content/<講座>/generated/media.<言語>.json）にあるものを、手元の site/media/ から配る
import path from 'node:path';
import { localMediaPath, readMediaManifest } from './media';
import { mediaFilesOf, mediaResponse, staticResponse } from './site/serve-files';

const DIST = path.resolve(import.meta.dir, '..', 'site', 'dist');
const PORT = Number(process.env.PORT ?? 8765);
const BASE_PATH = process.env.BASE_PATH ?? '/';

const media = mediaFilesOf(readMediaManifest().entries, (e) => localMediaPath(e));
Bun.serve({
  hostname: '127.0.0.1',
  port: PORT,
  fetch: (req) =>
    new URL(req.url).pathname.startsWith('/media/') ? mediaResponse(req, media) : staticResponse(req, DIST, BASE_PATH),
});
console.log(`http://127.0.0.1:${PORT}${BASE_PATH}`);
