import manifest from '../site/media-manifest.json';
import { mediaPath, validateMediaManifest } from '../site/media-shared';

export async function verifyPublic(origin = 'https://chalkfile.com/') {
  const base = new URL(origin);
  if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password) throw new Error('公開先のURLが不正です。');
  const home = await fetch(base, { redirect: 'error', signal: AbortSignal.timeout(20000) });
  if (home.status !== 200 || !home.headers.get('Content-Type')?.includes('text/html')) throw new Error('公開トップの200を確認できません。');
  await home.body?.cancel();
  const entries = validateMediaManifest(manifest).entries;
  let next = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let e = entries[next++]; e; e = entries[next++]) {
      let passed = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        const r = await fetch(new URL(mediaPath(e), base), { headers: { Range: 'bytes=0-1' }, redirect: 'error', signal: AbortSignal.timeout(20000) });
        if (r.status === 206 && r.headers.get('Content-Type')?.split(';')[0] === 'video/mp4' &&
            r.headers.get('Content-Range') === `bytes 0-1/${e.bytes}` && r.headers.get('Content-Length') === '2' &&
            r.headers.get('Accept-Ranges') === 'bytes' && !r.headers.has('Content-Disposition')) {
          if ((await r.arrayBuffer()).byteLength === 2) { passed = true; break; }
        } else await r.body?.cancel();
        if (attempt < 2) await Bun.sleep(1000);
      }
      if (!passed) throw new Error(`公開動画のRangeを確認できません: ${e.lang}/${e.course}/${e.lecture}/${e.kind}`);
    }
  }));
  console.log(`公開トップ200・全${entries.length}動画の206/Content-Range/video/mp4/attachmentなしを確認。`);
}
if (import.meta.main) await verifyPublic(process.argv[2]);
