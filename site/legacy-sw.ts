/// <reference lib="webworker" />
// GitHub Pages の旧保存専用。install/activateで既存cacheを変更・削除しない。
import { byteRange, COURSE_ID, validateManifest, type CourseStatus, type SavedVersion } from './offline-shared';
const sw = globalThis as unknown as ServiceWorkerGlobalScope;
const scope = sw.registration.scope;
const prefix = `chalkfile:${new URL(scope).pathname}:offline-v1:`;
const registry = `${prefix}registry`;
const target = 'https://chalkfile.com/';
const legacyMedia = { en: '/chalkfile-media-en/', zh: '/chalkfile-media-zh/' };
const recordUrl = (id: string) => new URL(`.offline-records/${encodeURIComponent(id)}`, scope).href;
const fileUrl = (url: string) => new URL(url, scope).href;
function movedUrl(url: URL) {
  const relative = url.pathname.startsWith(new URL(scope).pathname) ? url.pathname.slice(new URL(scope).pathname.length) : '';
  const next = new URL(target); next.pathname = `/${relative.replace(/^\/+/, '')}`;
  next.search = url.search; next.hash = url.hash;
  return next.href;
}
function idOf(url: URL) {
  for (const [lang, root] of Object.entries(legacyMedia)) if (url.pathname.startsWith(root)) return `${lang}/${url.pathname.slice(root.length).split('/')[0]}`;
  const parts = url.pathname.slice(new URL(scope).pathname.length).split('/');
  return /^[a-z]{2}$/.test(parts[0]) && parts[1] ? `${parts[0]}/${parts[1]}` : parts[0];
}
async function versions(id: string): Promise<SavedVersion[]> {
  if (!COURSE_ID.test(id)) return [];
  const response = await (await caches.open(registry)).match(recordUrl(id));
  if (!response) return [];
  try {
    const value = await response.json() as { versions: SavedVersion[] };
    if (!Array.isArray(value.versions) || value.versions.length > 2) return [];
    return value.versions.filter((v) => {
      try { validateManifest(v.manifest, id, scope, legacyMedia); return v.cache.startsWith(`${prefix}course:${id}:`); }
      catch { return false; }
    });
  } catch { return []; }
}
async function complete(v: SavedVersion) {
  if (!await caches.has(v.cache)) return false;
  const cache = await caches.open(v.cache);
  for (const f of v.manifest.files) {
    const r = await cache.match(fileUrl(f.url));
    if (!r || r.status !== 200 || r.headers.get('X-Chalkfile-SHA256') !== f.sha256 || Number(r.headers.get('Content-Length')) !== f.bytes) return false;
  }
  return true;
}
async function statuses(): Promise<CourseStatus[]> {
  const requests = await (await caches.open(registry)).keys();
  const ids = requests.map((r) => decodeURIComponent(new URL(r.url).pathname.split('/').pop()!)).filter((id) => COURSE_ID.test(id));
  return Promise.all(ids.map(async (id) => {
    const all = await versions(id); const validity = await Promise.all(all.map(complete));
    return { id, saved: all.find((_, i) => validity[i]) ?? null, incomplete: validity.includes(false), progress: null };
  }));
}
async function online() {
  try {
    const r = await fetch(new URL('migration-health.json', scope), { cache: 'no-store', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(3000) });
    return r.status === 200 && (await r.json() as { target?: string }).target === target;
  } catch { return false; }
}
function notice(destination: string) {
  const safe = destination.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  return `<aside id="chalkfileMoved" role="status" style="position:sticky;top:0;z-index:99999;padding:12px;background:#fff8d9;color:#222;border-bottom:1px solid #9b7d25">保存済みの講座はこのまま利用できます。オンラインになったら、<a href="${safe}">chalkfile.com</a> の新しい場所で保存し直してください。保存と学習記録は自動で移りません。</aside>`;
}
async function cached(req: Request, response: Response, navigation: boolean) {
  const headers = new Headers(response.headers); headers.delete('X-Chalkfile-SHA256');
  if (navigation) {
    const html = (await response.text()).replace(/<body([^>]*)>/i, (body) => `${body}${notice(movedUrl(new URL(req.url)))}`);
    headers.delete('Content-Length'); headers.delete('ETag'); headers.set('Cache-Control', 'no-store');
    return new Response(html, { headers });
  }
  if (req.method === 'HEAD') return new Response(null, { headers });
  const size = Number(headers.get('Content-Length'));
  const ifRange = req.headers.get('If-Range');
  const range = byteRange(ifRange && ifRange !== headers.get('ETag') ? null : req.headers.get('Range'), size);
  if (range.kind === 'unsatisfiable') return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}`, 'Accept-Ranges': 'bytes' } });
  if (range.kind === 'full') return new Response(response.body, { headers });
  const blob = await response.blob();
  headers.set('Content-Length', String(range.end - range.start + 1)); headers.set('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
  return new Response(blob.slice(range.start, range.end + 1), { status: 206, headers });
}
async function route(req: Request): Promise<Response> {
  const url = new URL(req.url); const navigation = req.mode === 'navigate';
  if (navigation && await online()) return Response.redirect(movedUrl(url), 302);
  const id = idOf(url);
  for (const v of await versions(id)) {
    const f = v.manifest.files.find((f) => navigation ? f.url === `${id}/` : fileUrl(f.url) === url.href);
    if (f && await complete(v)) {
      const response = await (await caches.open(v.cache)).match(fileUrl(f.url));
      if (response) return cached(req, response, navigation);
    }
  }
  // 起動用の小さな保存も残す。削除や新しい版への書き換えは行わない。
  for (const name of (await caches.keys()).filter((name) => name.startsWith(`${prefix}shell:`)).reverse()) {
    const cache = await caches.open(name);
    const key = url.pathname === new URL(scope).pathname || url.pathname === `${new URL(scope).pathname}index.html` ? scope : url.href;
    const response = await cache.match(key);
    if (response) return cached(req, response, navigation);
  }
  if (navigation) return new Response(`<!doctype html><html lang="ja"><meta charset="utf-8"><title>保存されていない教材｜Chalkfile</title><h1>この教材は保存されていません</h1>${notice(movedUrl(url))}</html>`, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
  return new Response('旧サイトのこのファイルは保存されていません。新しい場所で保存し直してください。', { status: 503 });
}
sw.addEventListener('install', (event) => event.waitUntil(sw.skipWaiting()));
sw.addEventListener('activate', (event) => event.waitUntil(sw.clients.claim()));
sw.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== new URL(scope).origin || !['GET', 'HEAD'].includes(event.request.method) ||
      !(url.href.startsWith(scope) || Object.values(legacyMedia).some((p) => url.pathname.startsWith(p)))) return;
  event.respondWith(route(event.request));
});
sw.addEventListener('message', (event) => {
  const port = event.ports[0]; const source = event.source as Client | null; const data = event.data;
  if (!port || !source?.url.startsWith(scope) || data?.protocol !== 1) return;
  event.waitUntil((async () => {
    if (data.type === 'STATUS') { port.postMessage({ ok: true, migrated: true, courses: await statuses() }); return; }
    if (data.type === 'DELETE' && typeof data.id === 'string' && COURSE_ID.test(data.id)) {
      // 利用者が明示した削除だけを受け付ける。学習メモや他のアプリは消さない。
      await (await caches.open(registry)).delete(recordUrl(data.id));
      for (const name of await caches.keys()) if (name.startsWith(`${prefix}course:${data.id}:`)) await caches.delete(name);
      port.postMessage({ ok: true }); return;
    }
    port.postMessage({ ok: false, error: 'このサイトの更新保存は終了しました。chalkfile.com の新しい場所で保存し直してください。' });
  })());
});
