/// <reference lib="webworker" />
import { byteRange, COURSE_ID, sha256, validateManifest } from './offline-shared';
import type { Asset, CourseManifest, CourseStatus, DownloadProgress, SavedVersion } from './offline-shared';

declare const __BUILD_CONFIG__: { build: string; courses: string[]; shell: Asset[] };
const sw = globalThis as unknown as ServiceWorkerGlobalScope;
const scope = sw.registration.scope;
// GitHub Pages の同一 origin にある、ほかのサイトの保存には触れない。
const prefix = `chalkfile:${new URL(scope).pathname}:offline-v1:`;
const shellName = `${prefix}shell:${__BUILD_CONFIG__.build}`;
const registryName = `${prefix}registry`;
type RecordData = { versions: SavedVersion[] };
type Job = { controller: AbortController; cancelled: boolean; progress: DownloadProgress; done: Promise<void> };
const jobs = new Map<string, Job>();
const deleting = new Set<string>();
const recordUrl = (id: string) => new URL(`.offline-records/${id}`, scope).href;
const assetUrl = (f: Asset) => new URL(f.url, scope).href;

async function readRecord(id: string): Promise<RecordData> {
  const res = await (await caches.open(registryName)).match(recordUrl(id));
  if (!res) return { versions: [] };
  try {
    const r = await res.json() as RecordData;
    if (!Array.isArray(r.versions) || r.versions.length > 2) throw new Error();
    for (const v of r.versions) {
      validateManifest(v.manifest, id, scope);
      if (!v.cache.startsWith(`${prefix}course:${id}:`)) throw new Error();
    }
    return r;
  } catch { return { versions: [] }; }
}

async function complete(v: SavedVersion): Promise<boolean> {
  if (!(await caches.has(v.cache))) return false;
  const cache = await caches.open(v.cache);
  for (const f of v.manifest.files) {
    const response = await cache.match(assetUrl(f));
    if (!response || response.status !== 200 || response.headers.get('X-Chalkfile-SHA256') !== f.sha256 ||
        Number(response.headers.get('Content-Length')) !== f.bytes) return false;
  }
  return true;
}

async function ids(): Promise<string[]> {
  const keys = await (await caches.open(registryName)).keys();
  return [...new Set([...__BUILD_CONFIG__.courses, ...keys.map((r) => new URL(r.url).pathname.split('/').pop()!).filter((id) => COURSE_ID.test(id))])];
}

async function statuses(): Promise<CourseStatus[]> {
  return Promise.all((await ids()).map(async (id) => {
    const r = await readRecord(id);
    const valid = await Promise.all(r.versions.map(complete));
    return { id, saved: r.versions.find((_, i) => valid[i]) ?? null,
      incomplete: r.versions.some((_, i) => !valid[i]), progress: jobs.get(id)?.progress ?? null };
  }));
}

// worker / ブラウザ終了で残った未完了領域だけを片付ける。保存済みの版は期限で消さない。
async function cleanup(oldShell = false): Promise<void> {
  if (jobs.size || deleting.size) return;
  const keep = new Set([registryName, shellName]);
  for (const id of await ids()) for (const v of (await readRecord(id)).versions) keep.add(v.cache);
  for (const name of await caches.keys()) {
    if (jobs.size || deleting.size) return;
    if ((name.startsWith(`${prefix}course:`) || (oldShell && name.startsWith(`${prefix}shell:`))) && !keep.has(name)) await caches.delete(name);
  }
}

async function fetchManifest(id: string): Promise<CourseManifest> {
  if (!__BUILD_CONFIG__.courses.includes(id)) throw new Error('この講座の更新情報は公開されていません。');
  const r = await fetch(new URL(`${id}/offline-manifest.json`, scope), {
    cache: 'no-store', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(15000),
  });
  if (r.status !== 200 || !r.headers.get('Content-Type')?.includes('application/json')) throw new Error('教材情報を取得できません。通信を確認して再試行してください。');
  const text = await r.text();
  if (text.length > 100000) throw new Error('教材情報が大きすぎます。');
  const m = validateManifest(JSON.parse(text), id, scope);
  if (await sha256(new TextEncoder().encode(JSON.stringify(m.files)).buffer) !== m.revision) throw new Error('教材情報の整合性を確認できません。');
  return m;
}

async function download(f: Asset, signal: AbortSignal, onBytes: (bytes: number) => void): Promise<Response> {
  const res = await fetch(assetUrl(f), { cache: 'no-store', credentials: 'omit', redirect: 'error', signal });
  if (res.status !== 200 || !res.body || res.type === 'opaque' || res.headers.get('Content-Type')?.split(';')[0].trim() !== f.type) {
    throw new Error('教材を取得できません。一部取得や別形式の応答は保存しません。');
  }
  const reader = res.body.getReader();
  const data = new Uint8Array(f.bytes);
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      length += value.byteLength;
      if (length > f.bytes) throw new Error('教材のサイズが変わりました。更新を確認して再試行してください。');
      data.set(value, length - value.byteLength);
      onBytes(value.byteLength);
    }
  } catch (e) { await reader.cancel().catch(() => {}); throw e; }
  if (length !== f.bytes || await sha256(data.buffer) !== f.sha256) throw new Error('教材が不完全か、公開中に更新されました。通信を確認して再試行してください。');
  return new Response(data, { headers: {
    'Content-Type': f.type, 'Content-Length': String(f.bytes), 'X-Chalkfile-SHA256': f.sha256,
    'Accept-Ranges': 'bytes', ETag: `"${f.sha256}"`,
  } });
}

async function broadcast(): Promise<void> {
  for (const c of await sw.clients.matchAll()) c.postMessage({ protocol: 1, type: 'CHANGED' });
}

async function save(id: string, report: (p: DownloadProgress) => void): Promise<void> {
  if (jobs.size || deleting.size) throw new Error('別の保存・削除を処理中です。完了してから再試行してください。');
  const controller = new AbortController();
  const job: Job = { controller, cancelled: false, progress: { id, loaded: 0, total: 0, file: 0, count: 0 }, done: Promise.resolve() };
  jobs.set(id, job);
  job.done = (async () => {
    let staging = '';
    let committed = false;
    try {
      const manifest = await fetchManifest(id);
      controller.signal.throwIfAborted();
      const before = await readRecord(id);
      if (before.versions[0]?.manifest.revision === manifest.revision && await complete(before.versions[0])) return;
      const estimate = await sw.navigator.storage?.estimate?.().catch(() => null);
      if (estimate?.quota && estimate.quota - (estimate.usage ?? 0) < manifest.bytes * 1.1) {
        throw new DOMException('保存用の空き容量が不足しています。', 'QuotaExceededError');
      }
      staging = `${prefix}course:${id}:${crypto.randomUUID()}`;
      const cache = await caches.open(staging);
      job.progress.total = manifest.bytes;
      job.progress.count = manifest.files.length;
      let lastReport = 0;
      for (const [i, f] of manifest.files.entries()) {
        controller.signal.throwIfAborted();
        job.progress.file = i + 1;
        report({ ...job.progress });
        // 1 ファイル最大 32 MiB。MP4 全体を検証し、206 や途中のデータは Cache に入れない。
        const timeout = setTimeout(() => controller.abort(new Error('通信が時間切れになりました。再試行してください。')), 120000);
        try {
          const response = await download(f, controller.signal, (bytes) => {
            job.progress.loaded += bytes;
            if (Date.now() - lastReport > 250) { report({ ...job.progress }); lastReport = Date.now(); }
          });
          controller.signal.throwIfAborted();
          await cache.put(assetUrl(f), response);
        } finally { clearTimeout(timeout); }
      }
      controller.signal.throwIfAborted();
      const version: SavedVersion = { cache: staging, manifest, savedAt: new Date().toISOString() };
      if (!await complete(version)) throw new Error('保存した教材を確認できません。再試行してください。');
      controller.signal.throwIfAborted();
      const previous: SavedVersion[] = [];
      for (const v of before.versions) if (await complete(v)) { previous.push(v); break; }
      controller.signal.throwIfAborted();
      // この 1 件の書込みが完了するまで、前の保存版だけが再生対象。途中の保存は公開しない。
      await (await caches.open(registryName)).put(recordUrl(id), Response.json({ versions: [version, ...previous] }));
      committed = true;
      for (const v of before.versions) if (!previous.includes(v)) await caches.delete(v.cache).catch(() => false);
      report({ ...job.progress });
    } catch (e) {
      if (job.cancelled) throw new Error('保存をキャンセルしました。未完了のデータは保存済みになりません。');
      if (e instanceof DOMException && e.name === 'QuotaExceededError') throw new Error('空き容量が不足しています。不要な保存を削除して再試行してください。');
      throw e;
    } finally {
      if (staging && !committed) await caches.delete(staging).catch(() => false);
      jobs.delete(id);
      await broadcast();
    }
  })();
  await job.done;
}

async function remove(id: string): Promise<void> {
  if (jobs.size || deleting.size) throw new Error('保存・削除が処理中です。キャンセルか完了の後に削除してください。');
  deleting.add(id);
  try {
    await (await caches.open(registryName)).delete(recordUrl(id));
    // 同じ講座の以前の版・未完了領域も削除。学習メモと進捗は別の localStorage に残る。
    for (const name of await caches.keys()) if (name.startsWith(`${prefix}course:${id}:`)) await caches.delete(name);
  } finally { deleting.delete(id); await broadcast(); }
}

sw.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(shellName);
    for (const f of __BUILD_CONFIG__.shell) await cache.put(assetUrl(f), await download(f, AbortSignal.timeout(60000), () => {}));
    // 更新中のタブや保存を強制終了しない。新版は全タブを閉じた後に有効になる。
  })());
});
sw.addEventListener('activate', (event) => event.waitUntil((async () => { await cleanup(true); await sw.clients.claim(); })()));

sw.addEventListener('message', (event) => {
  const port = event.ports[0];
  const data = event.data;
  const source = event.source as Client | null;
  if (!port || !source?.url.startsWith(scope) || data?.protocol !== 1) return;
  event.waitUntil((async () => {
    try {
      if (data.type === 'STATUS') {
        const courses = await statuses();
        await cleanup();
        port.postMessage({ ok: true, courses });
      } else {
        const id = data.id;
        if (typeof id !== 'string' || !COURSE_ID.test(id)) throw new Error('講座を選んでください。');
        if (data.type === 'CHECK') port.postMessage({ ok: true, manifest: await fetchManifest(id) });
        else if (data.type === 'SAVE') {
          await save(id, (progress) => port.postMessage({ progress }));
          port.postMessage({ ok: true });
        } else if (data.type === 'CANCEL') {
          const job = jobs.get(id);
          if (job) { job.cancelled = true; job.controller.abort(); }
          port.postMessage({ ok: true });
        } else if (data.type === 'DELETE') { await remove(id); port.postMessage({ ok: true }); }
        else throw new Error('対応していない操作です。');
      }
    } catch (e) {
      port.postMessage({ ok: false, error: e instanceof Error ? e.message : '保存場所を利用できません。ブラウザの設定を確認してください。' });
    }
  })());
});

async function cachedResponse(req: Request, response: Response): Promise<Response> {
  const headers = new Headers(response.headers);
  headers.delete('X-Chalkfile-SHA256');
  const size = Number(headers.get('Content-Length'));
  if (req.method === 'HEAD') return new Response(null, { headers });
  const ifRange = req.headers.get('If-Range');
  const range = byteRange(ifRange && ifRange !== headers.get('ETag') ? null : req.headers.get('Range'), size);
  if (range.kind === 'unsatisfiable') return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}`, 'Accept-Ranges': 'bytes' } });
  if (range.kind === 'full') return new Response(response.body, { headers });
  const blob = await response.blob();
  headers.set('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
  headers.set('Content-Length', String(range.end - range.start + 1));
  return new Response(blob.slice(range.start, range.end + 1), { status: 206, headers });
}

async function route(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const relative = url.pathname.slice(new URL(scope).pathname.length);
  const id = relative.split('/')[0];
  if (req.mode === 'navigate' && COURSE_ID.test(relative)) return Response.redirect(new URL(`${relative}/`, scope), 301);
  if (COURSE_ID.test(id)) {
    const record = await readRecord(id);
    const navigation = req.mode === 'navigate' && (relative === id || relative === `${id}/` || relative === `${id}/index.html`);
    for (const v of record.versions) {
      const file = v.manifest.files.find((f) => navigation ? f.url === `${id}/` : assetUrl(f) === url.href);
      if (file && await complete(v)) {
        const response = await (await caches.open(v.cache)).match(assetUrl(file));
        if (response) return cachedResponse(req, response);
      }
    }
    if (record.versions.length && relative.includes('/media/') && url.searchParams.has('v')) {
      return new Response('この保存版の動画は利用できません。講座を再読み込みし、オンラインで保存し直してください。', { status: 503 });
    }
  }
  try {
    const response = await fetch(req);
    if (response.ok || req.mode !== 'navigate') return response;
  } catch { /* オフラインでは選択して保存した教材と起動用ページだけ返す */ }
  const shell = await caches.open(shellName);
  const key = !relative || relative === 'index.html' ? scope : url.href;
  const cached = await shell.match(key);
  if (cached) return cachedResponse(req, cached);
  if (req.mode === 'navigate') {
    const fallback = await shell.match(new URL('offline.html', scope).href);
    if (fallback) return new Response((await fallback.text()).replace('__ROOT__', new URL(scope).pathname), { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  return new Response('オフラインです。この教材はアプリ内に保存されていません。', { status: 503 });
}

sw.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== new URL(scope).origin || !url.href.startsWith(scope) || !['GET', 'HEAD'].includes(event.request.method)) return;
  event.respondWith(route(event.request));
});
