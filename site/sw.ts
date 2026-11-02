/// <reference lib="webworker" />
import { byteRange, COURSE_ID, OfflineError, sha256, validateManifest, type OfflineErrorCode } from './offline-shared';
import type { Asset, CourseManifest, CourseStatus, DownloadProgress, SavedVersion } from './offline-shared';

/** mediaRoots: 訳の言語の動画を置く、同じ origin の別のサイト（言語 → パス。例 en → /chalkfile-media-en/） */
declare const __BUILD_CONFIG__: { build: string; courses: string[]; shell: Asset[]; mediaRoots: Record<string, string> };
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
// 訳の講座の ID は en/… のように / を含むので、記録の URL では符号にする
const recordUrl = (id: string) => new URL(`.offline-records/${encodeURIComponent(id)}`, scope).href;
const assetUrl = (f: Asset) => new URL(f.url, scope).href;
const mediaRoots = Object.fromEntries(Object.entries(__BUILD_CONFIG__.mediaRoots).map(([lang, root]) => [lang, new URL(root, scope).href]));

/** 保存機能のエラーの文字（ページの言語で返す）。ページの文字は site/i18n.ts */
const MESSAGES: Record<string, Record<OfflineErrorCode, string>> = {
  ja: {
    manifest: '保存用の教材情報を確認できません。オンラインで再読み込みしてください。',
    format: '保存対象の形式が不正です。',
    origin: 'このサイトの公開教材だけ保存できます。',
    page: '教材ページの形式が不正です。',
    media: '保存対象は公開 MP4 とポスターに限ります。',
    incomplete: '保存対象がそろっていません。',
    unpublished: 'この講座の更新情報は公開されていません。',
    fetchManifest: '教材情報を取得できません。通信を確認して再試行してください。',
    tooLarge: '教材情報が大きすぎます。',
    integrity: '教材情報の整合性を確認できません。',
    fetchFile: '教材を取得できません。一部取得や別形式の応答は保存しません。',
    changed: '教材のサイズが変わりました。更新を確認して再試行してください。',
    corrupt: '教材が不完全か、公開中に更新されました。通信を確認して再試行してください。',
    quota: '保存用の空き容量が不足しています。',
    busy: '別の保存・削除を処理中です。完了してから再試行してください。',
    busyDelete: '保存・削除が処理中です。キャンセルか完了の後に削除してください。',
    verify: '保存した教材を確認できません。再試行してください。',
    cancelled: '保存をキャンセルしました。未完了のデータは保存済みになりません。',
    noSpace: '空き容量が不足しています。不要な保存を削除して再試行してください。',
    pick: '講座を選んでください。',
    unknownOp: '対応していない操作です。',
    storage: '保存場所を利用できません。ブラウザの設定を確認してください。',
    timeout: '通信が時間切れになりました。再試行してください。',
  },
  en: {
    manifest: 'Cannot read the course data for saving. Reload while online.',
    format: 'The files to save are in an invalid format.',
    origin: 'Only course materials published on this site can be saved.',
    page: 'The course page is in an invalid format.',
    media: 'Only the published MP4 videos and posters can be saved.',
    incomplete: 'The files to save are incomplete.',
    unpublished: 'Update information for this course is not published.',
    fetchManifest: 'Cannot get the course data. Check your connection and retry.',
    tooLarge: 'The course data is too large.',
    integrity: 'Cannot verify the course data.',
    fetchFile: 'Cannot get a course file. Partial or unexpected responses are not saved.',
    changed: 'A course file changed size. Check for updates and retry.',
    corrupt: 'A course file was incomplete or updated while being published. Check your connection and retry.',
    quota: 'Not enough free space to save.',
    busy: 'Another save or delete is in progress. Retry after it finishes.',
    busyDelete: 'A save or delete is in progress. Delete after it is cancelled or finished.',
    verify: 'Cannot verify the saved files. Please retry.',
    cancelled: 'Saving was cancelled. Unfinished data is not marked as saved.',
    noSpace: 'Not enough free space. Delete saved courses you do not need and retry.',
    pick: 'Choose a course.',
    unknownOp: 'This operation is not supported.',
    storage: 'Storage is not available. Check your browser settings.',
    timeout: 'The connection timed out. Please retry.',
  },
  zh: {
    manifest: '无法确认用于保存的课程信息。请在联网时重新加载。',
    format: '要保存的文件格式不正确。',
    origin: '只能保存本网站公开的课程材料。',
    page: '课程页面的格式不正确。',
    media: '只能保存公开的 MP4 视频和封面。',
    incomplete: '要保存的文件不完整。',
    unpublished: '本课程的更新信息未公开。',
    fetchManifest: '无法获取课程信息。请检查网络后重试。',
    tooLarge: '课程信息太大。',
    integrity: '无法确认课程信息的完整性。',
    fetchFile: '无法获取课程文件。不会保存部分内容或格式不符的响应。',
    changed: '课程文件的大小变了。请检查更新后重试。',
    corrupt: '课程文件不完整，或在发布过程中被更新。请检查网络后重试。',
    quota: '保存所需的空闲空间不足。',
    busy: '正在处理其他保存或删除。请等完成后重试。',
    busyDelete: '正在保存或删除。请在取消或完成后再删除。',
    verify: '无法确认保存的文件。请重试。',
    cancelled: '已取消保存。未完成的数据不会算作已保存。',
    noSpace: '空闲空间不足。请删除不需要的保存后重试。',
    pick: '请选择课程。',
    unknownOp: '不支持此操作。',
    storage: '无法使用存储空间。请检查浏览器设置。',
    timeout: '网络超时。请重试。',
  },
};
const messageOf = (e: unknown, lang: string) => {
  const m = MESSAGES[lang] ?? MESSAGES.ja;
  if (e instanceof OfflineError) return m[e.code];
  // 時間切れを、保存場所の問題と取り違えない（通信の失敗は fetchManifest・download が OfflineError にする）
  if (e instanceof DOMException && e.name === 'TimeoutError') return m.timeout;
  return m.storage;
};

async function readRecord(id: string): Promise<RecordData> {
  const res = await (await caches.open(registryName)).match(recordUrl(id));
  if (!res) return { versions: [] };
  try {
    const r = await res.json() as RecordData;
    if (!Array.isArray(r.versions) || r.versions.length > 2) throw new Error();
    for (const v of r.versions) {
      validateManifest(v.manifest, id, scope, __BUILD_CONFIG__.mediaRoots);
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
  const saved = keys.map((r) => { try { return decodeURIComponent(new URL(r.url).pathname.split('/').pop()!); } catch { return ''; } });
  return [...new Set([...__BUILD_CONFIG__.courses, ...saved.filter((id) => COURSE_ID.test(id))])];
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
  if (!__BUILD_CONFIG__.courses.includes(id)) throw new OfflineError('unpublished');
  let r: Response;
  let text: string;
  try {
    r = await fetch(new URL(`${id}/offline-manifest.json`, scope), {
      cache: 'no-store', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    if (r.status !== 200 || !r.headers.get('Content-Type')?.includes('application/json')) throw new OfflineError('fetchManifest');
    text = await r.text();
  } catch (e) {
    // 通信の失敗（TypeError）と時間切れを、それぞれの文にする
    if (e instanceof OfflineError) throw e;
    throw new OfflineError(e instanceof DOMException && e.name === 'TimeoutError' ? 'timeout' : 'fetchManifest');
  }
  if (text.length > 100000) throw new OfflineError('tooLarge');
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new OfflineError('manifest'); }
  const m = validateManifest(parsed, id, scope, __BUILD_CONFIG__.mediaRoots);
  if (await sha256(new TextEncoder().encode(JSON.stringify(m.files)).buffer) !== m.revision) throw new OfflineError('integrity');
  return m;
}

async function download(f: Asset, signal: AbortSignal, onBytes: (bytes: number) => void): Promise<Response> {
  // 止めた（取り消し・時間切れ）ときはその理由を、通信の失敗（TypeError）は「取得できない」を返す
  const failed = (e: unknown) => (signal.aborted ? signal.reason ?? e : e instanceof OfflineError ? e : new OfflineError('fetchFile'));
  let res: Response;
  try { res = await fetch(assetUrl(f), { cache: 'no-store', credentials: 'omit', redirect: 'error', signal }); } catch (e) { throw failed(e); }
  if (res.status !== 200 || !res.body || res.type === 'opaque' || res.headers.get('Content-Type')?.split(';')[0].trim() !== f.type) {
    throw new OfflineError('fetchFile');
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
      if (length > f.bytes) throw new OfflineError('changed');
      data.set(value, length - value.byteLength);
      onBytes(value.byteLength);
    }
  } catch (e) { await reader.cancel().catch(() => {}); throw failed(e); }
  if (length !== f.bytes || await sha256(data.buffer) !== f.sha256) throw new OfflineError('corrupt');
  return new Response(data, { headers: {
    'Content-Type': f.type, 'Content-Length': String(f.bytes), 'X-Chalkfile-SHA256': f.sha256,
    'Accept-Ranges': 'bytes', ETag: `"${f.sha256}"`,
  } });
}

async function broadcast(): Promise<void> {
  for (const c of await sw.clients.matchAll()) c.postMessage({ protocol: 1, type: 'CHANGED' });
}

async function save(id: string, report: (p: DownloadProgress) => void): Promise<void> {
  if (jobs.size || deleting.size) throw new OfflineError('busy');
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
        throw new DOMException('quota', 'QuotaExceededError');
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
        const timeout = setTimeout(() => controller.abort(new OfflineError('timeout')), 120000);
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
      if (!await complete(version)) throw new OfflineError('verify');
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
      if (job.cancelled) throw new OfflineError('cancelled');
      if (e instanceof DOMException && e.name === 'QuotaExceededError') throw new OfflineError('noSpace');
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
  if (jobs.size || deleting.size) throw new OfflineError('busyDelete');
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
        if (typeof id !== 'string' || !COURSE_ID.test(id)) throw new OfflineError('pick');
        if (data.type === 'CHECK') port.postMessage({ ok: true, manifest: await fetchManifest(id) });
        else if (data.type === 'SAVE') {
          await save(id, (progress) => port.postMessage({ progress }));
          port.postMessage({ ok: true });
        } else if (data.type === 'CANCEL') {
          const job = jobs.get(id);
          if (job) { job.cancelled = true; job.controller.abort(); }
          port.postMessage({ ok: true });
        } else if (data.type === 'DELETE') { await remove(id); port.postMessage({ ok: true }); }
        else throw new OfflineError('unknownOp');
      }
    } catch (e) {
      port.postMessage({ ok: false, error: messageOf(e, typeof data.lang === 'string' ? data.lang : 'ja') });
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

/**
 * URL がどの講座のものか。訳の講座のページは <言語>/<講座>/、訳の動画は別のサイト（動画のサイト）の <講座>/ の下。
 * media は動画のサイトの URL（relative は動画のサイトの中のパス）。2 文字の英小文字の講座 ID は使わない（content/index.ts）
 */
function courseIdOf(url: URL): { id: string; relative: string; media: boolean } {
  for (const [lang, root] of Object.entries(mediaRoots)) {
    if (url.href.startsWith(root)) {
      const relative = url.pathname.slice(new URL(root).pathname.length);
      return { id: `${lang}/${relative.split('/')[0]}`, relative, media: true };
    }
  }
  const relative = url.pathname.slice(new URL(scope).pathname.length);
  const parts = relative.split('/');
  const id = /^[a-z]{2}$/.test(parts[0]) && parts.length > 1 && parts[1] ? `${parts[0]}/${parts[1]}` : parts[0];
  return { id, relative, media: false };
}

async function route(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const { id, relative, media } = courseIdOf(url);
  if (req.mode === 'navigate' && !media && relative && COURSE_ID.test(relative)) return Response.redirect(new URL(`${relative}/`, scope), 301);
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
    if (record.versions.length && (media || relative.includes('/media/')) && url.searchParams.has('v')) {
      return new Response('この保存版の動画は利用できません。講座を再読み込みし、オンラインで保存し直してください。 / This saved video is not available. Reload the course and save it again online.', { status: 503 });
    }
  }
  try {
    const response = await fetch(req);
    if (response.ok || req.mode !== 'navigate') return response;
  } catch { /* オフラインでは選択して保存した教材と起動用ページだけ返す */ }
  const shell = await caches.open(shellName);
  // 動画のサイトの URL に、一覧のページを返さない（保存していない訳の動画とポスターは、下の 503 になる）
  const key = !media && (!relative || relative === 'index.html') ? scope : url.href;
  const cached = await shell.match(key);
  if (cached) return cachedResponse(req, cached);
  if (req.mode === 'navigate') {
    const fallback = await shell.match(new URL('offline/', scope).href);
    if (fallback) return new Response((await fallback.text()).replaceAll('__ROOT__', new URL(scope).pathname), { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  return new Response('オフラインです。この教材はアプリ内に保存されていません。 / Offline. This file is not saved in the app.', { status: 503 });
}

sw.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const mine = url.href.startsWith(scope) || Object.values(mediaRoots).some((root) => url.href.startsWith(root));
  if (url.origin !== new URL(scope).origin || !mine || !['GET', 'HEAD'].includes(event.request.method)) return;
  event.respondWith(route(event.request));
});
