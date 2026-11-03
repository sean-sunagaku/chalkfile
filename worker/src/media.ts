import { mediaPath, releaseUrl, type MediaEntry } from '../../site/media-shared';

type FetchMedia = (url: string, init: RequestInit) => Promise<Response>;
// Workers Logs で code ごとに数える 1 件の記録。URL・path・query・署名・例外の本文は入れず、ホスト名だけを残す。
export type MediaLog = {
  code: 'upstream_missing' | 'redirect_host' | 'status' | 'network';
  status: number | null;
  host: string | null;
  course: string;
  lecture: string;
};
type LogFailure = (value: MediaLog) => void;
const FORWARD = ['Content-Length', 'Content-Range', 'ETag', 'Last-Modified'] as const;
const REDIRECT = [301, 302, 303, 307, 308];
const ASSET_HOST = 'release-assets.githubusercontent.com';
// 同じ origin のページだけが読み込める。ほかのサイトに動画を埋め込ませず、Worker の無料枠を使わせない。
const CORP = 'same-origin';
const error = (status: number, message: string) => new Response(message, {
  status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': CORP },
});
const parseUrl = (value: string | null, base: string) => {
  try { return value ? new URL(value, base) : null; } catch { return null; }
};
// オブジェクトのまま出すと、Workers Logs が項目ごとに索引を作る。
const logToConsole: LogFailure = (value) => console.error({ message: 'media_upstream_failed', ...value });

export function createMediaHandler(entries: MediaEntry[], fetchMedia: FetchMedia = fetch, log: LogFailure = logToConsole) {
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
    const record = (code: MediaLog['code'], status: number | null, host: string | null) =>
      log({ code, status, host, course: entry.course, lecture: entry.lecture });
    const unavailable = () => error(502, '動画の配信元に接続できません。再試行してください。');
    // 毎回、元の Releases URL から開始。期限つき Location を保存・キャッシュしない。
    let target = releaseUrl(entry);
    let upstream: Response | undefined;
    try {
      for (let redirects = 0; redirects <= 3; redirects++) {
        upstream = await fetchMedia(target, { method: request.method, headers, redirect: 'manual', signal: request.signal });
        if (!REDIRECT.includes(upstream.status)) break;
        const status = upstream.status;
        const next = parseUrl(upstream.headers.get('Location'), target);
        await upstream.body?.cancel();
        upstream = undefined;
        if (!next || redirects === 3 || next.protocol !== 'https:' || next.username || next.password || next.hostname !== ASSET_HOST) {
          // 拒んだ行き先は、ホスト名だけを残す（path と署名つきの query は出さない）。
          record('redirect_host', status, next?.hostname || null);
          return unavailable();
        }
        target = next.href;
      }
      if (!upstream) throw new Error('redirect');
      if (upstream.status === 404) {
        // Releases から動画が消えた（tag か asset が無い）。利用者には 404 を返し、記録は残す。
        await upstream.body?.cancel();
        record('upstream_missing', 404, new URL(target).hostname);
        return error(404, '動画が見つかりません。');
      }
      if (![200, 206, 416].includes(upstream.status)) {
        record('status', upstream.status, new URL(target).hostname);
        await upstream.body?.cancel();
        return unavailable();
      }
      const responseHeaders = new Headers();
      for (const key of FORWARD) {
        const value = upstream.headers.get(key);
        if (value) responseHeaders.set(key, value);
      }
      responseHeaders.set('Content-Type', 'video/mp4');
      responseHeaders.set('Accept-Ranges', 'bytes');
      responseHeaders.set('X-Content-Type-Options', 'nosniff');
      responseHeaders.set('Cross-Origin-Resource-Policy', CORP);
      responseHeaders.set('Cache-Control', upstream.status === 416 ? 'no-store' : 'public, max-age=31536000, immutable');
      if (url.searchParams.get('download') === '1') {
        responseHeaders.set('Content-Disposition', `attachment; filename="${entry.lecture}${entry.kind === 'captioned' ? '.captioned' : ''}.mp4"`);
      }
      if (request.method === 'HEAD') await upstream.body?.cancel();
      // JS で動画本文を読み出さない。CPU とメモリはファイルサイズに比例させない。
      return new Response(request.method === 'HEAD' ? null : upstream.body, { status: upstream.status, headers: responseHeaders });
    } catch {
      // 例外メッセージには署名付き URL が含まれ得るため、つなごうとした先のホスト名と固定の分類だけを記録する。
      await upstream?.body?.cancel().catch(() => {});
      record('network', null, new URL(target).hostname);
      return unavailable();
    }
  };
}
