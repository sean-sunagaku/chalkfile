import { mediaPath, releaseUrl, type MediaEntry } from '../../site/media-shared';

type FetchMedia = (url: string, init: RequestInit) => Promise<Response>;
type LogFailure = (value: { code: string; status?: number; course: string; lecture: string }) => void;
const FORWARD = ['Content-Length', 'Content-Range', 'ETag', 'Last-Modified'] as const;
const error = (status: number, message: string) => new Response(message, {
  status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});

export function createMediaHandler(entries: MediaEntry[], fetchMedia: FetchMedia = fetch,
  log: LogFailure = (value) => console.error('media_upstream_failed', value)) {
  const allowed = new Map(entries.map((e) => [mediaPath(e), e]));
  return async (request: Request): Promise<Response> => {
    if (!['GET', 'HEAD'].includes(request.method)) {
      const response = error(405, 'GET または HEAD を使ってください。');
      response.headers.set('Allow', 'GET, HEAD');
      return response;
    }
    const url = new URL(request.url);
    const entry = allowed.get(url.pathname);
    if (!entry) return error(404, '動画が見つかりません。');
    const headers = new Headers();
    // HEAD の Range は HTTP の意味に合わせて無視する。Cookie/Authorization 等は転送しない。
    if (request.method === 'GET') for (const key of ['Range', 'If-Range']) {
      const value = request.headers.get(key);
      if (value) headers.set(key, value);
    }
    let upstream: Response | undefined;
    try {
      // 毎回、元の Releases URL から開始。期限つき Location を保存・キャッシュしない。
      let target = releaseUrl(entry);
      for (let redirects = 0; redirects <= 3; redirects++) {
        upstream = await fetchMedia(target, { method: request.method, headers, redirect: 'manual', signal: request.signal });
        if (![301, 302, 303, 307, 308].includes(upstream.status)) break;
        const location = upstream.headers.get('Location');
        await upstream.body?.cancel();
        const next = location ? new URL(location, target) : null;
        if (!next || redirects === 3 || next.protocol !== 'https:' || next.username || next.password ||
            next.hostname !== 'release-assets.githubusercontent.com') throw new Error('redirect');
        target = next.href;
        upstream = undefined;
      }
      if (!upstream) throw new Error('redirect');
      if (upstream.status === 404) { await upstream.body?.cancel(); return error(404, '動画が見つかりません。'); }
      if (![200, 206, 416].includes(upstream.status)) {
        log({ code: 'status', status: upstream.status, course: entry.course, lecture: entry.lecture });
        await upstream.body?.cancel();
        return error(502, '動画の配信元に接続できません。再試行してください。');
      }
      const responseHeaders = new Headers();
      for (const key of FORWARD) {
        const value = upstream.headers.get(key);
        if (value) responseHeaders.set(key, value);
      }
      responseHeaders.set('Content-Type', 'video/mp4');
      responseHeaders.set('Accept-Ranges', 'bytes');
      responseHeaders.set('X-Content-Type-Options', 'nosniff');
      responseHeaders.set('Cache-Control', upstream.status === 416 ? 'no-store' : 'public, max-age=31536000, immutable');
      if (url.searchParams.get('download') === '1') {
        responseHeaders.set('Content-Disposition', `attachment; filename="${entry.lecture}${entry.kind === 'captioned' ? '.captioned' : ''}.mp4"`);
      }
      if (request.method === 'HEAD') await upstream.body?.cancel();
      // JS で動画本文を読み出さない。CPU とメモリはファイルサイズに比例させない。
      return new Response(request.method === 'HEAD' ? null : upstream.body, { status: upstream.status, headers: responseHeaders });
    } catch {
      // 例外メッセージには署名付き URL が含まれ得るため、固定の分類だけを記録する。
      await upstream?.body?.cancel().catch(() => {});
      log({ code: 'network_or_redirect', course: entry.course, lecture: entry.lecture });
      return error(502, '動画の配信元に接続できません。再試行してください。');
    }
  };
}
