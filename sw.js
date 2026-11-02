// site/offline-shared.ts
var COURSE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
var HASH = /^[a-f0-9]{64}$/;
var MAX_FILE_BYTES = 32 * 1024 * 1024;
function validateManifest(value, id, scope) {
  const m = value;
  if (!m || m.schema !== 1 || !COURSE_ID.test(id) || m.id !== id || typeof m.title !== "string" || m.title.length > 300 || !HASH.test(m.pageVersion) || !HASH.test(m.revision) || !Array.isArray(m.files) || m.files.length < 3 || m.files.length > 201) {
    throw new Error("保存用の教材情報を確認できません。オンラインで再読み込みしてください。");
  }
  const urls = new Set;
  let bytes = 0;
  const media = new Map;
  for (const f of m.files) {
    if (!f || typeof f.url !== "string" || urls.has(f.url) || !HASH.test(f.sha256) || !Number.isSafeInteger(f.bytes) || f.bytes <= 0 || f.bytes > MAX_FILE_BYTES)
      throw new Error("保存対象の形式が不正です。");
    urls.add(f.url);
    const url = new URL(f.url, scope);
    if (url.origin !== new URL(scope).origin || !url.href.startsWith(scope) || url.hash || url.username || url.password) {
      throw new Error("このサイトの公開教材だけ保存できます。");
    }
    if (f.url === `${id}/`) {
      if (f.type !== "text/html" || f.bytes > 4 * 1024 * 1024)
        throw new Error("教材ページの形式が不正です。");
    } else {
      const match = /^([A-Za-z0-9][A-Za-z0-9_-]*)\/media\/([A-Za-z0-9][A-Za-z0-9_-]*)\.(mp4|jpg)\?v=([a-f0-9]{64})$/.exec(f.url);
      if (!match || match[1] !== id || match[4] !== m.pageVersion || f.type !== (match[3] === "mp4" ? "video/mp4" : "image/jpeg")) {
        throw new Error("保存対象は公開 MP4 とポスターに限ります。");
      }
      const types = media.get(match[2]) ?? new Set;
      types.add(match[3]);
      media.set(match[2], types);
    }
    bytes += f.bytes;
  }
  if (!urls.has(`${id}/`) || media.size === 0 || [...media.values()].some((x) => x.size !== 2) || bytes !== m.bytes || bytes > 1024 * 1024 * 1024)
    throw new Error("保存対象がそろっていません。");
  return m;
}
async function sha256(data) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", data)), (x) => x.toString(16).padStart(2, "0")).join("");
}
function byteRange(header, size) {
  if (!header || !header.startsWith("bytes=") || header.includes(","))
    return { kind: "full" };
  const m = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!m || !m[1] && !m[2])
    return { kind: "full" };
  const a = m[1] ? Number(m[1]) : null;
  const b = m[2] ? Number(m[2]) : null;
  if (a !== null && !Number.isSafeInteger(a) || b !== null && !Number.isSafeInteger(b) || size === 0)
    return { kind: "unsatisfiable" };
  const start = a ?? Math.max(0, size - b);
  const end = a === null || b === null ? size - 1 : Math.min(b, size - 1);
  if (start >= size || start > end || a === null && b === 0)
    return { kind: "unsatisfiable" };
  return { kind: "partial", start, end };
}

// site/sw.ts
var sw = globalThis;
var scope = sw.registration.scope;
var prefix = `chalkfile:${new URL(scope).pathname}:offline-v1:`;
var shellName = `${prefix}shell:${{ build: "e0837cb38479071b4e91e8a33d231b5cdf7a54fae5ed7d5860cf1efeee49b1c7", courses: ["stripe-billing", "nudge-product", "uiux-engineers", "indie-marketing", "nudge-comedy", "rive-comedy", "pstack-comedy", "superagent-comedy"], shell: [{ url: "./", bytes: 45837, sha256: "dc17fc827a957ff21040ccc98914b4824e17d4df592c41a283ea29b50e17f94f", type: "text/html" }, { url: "assets/hero.jpg", bytes: 55314, sha256: "6de83717c75dee7fde8f03d5b06c6b21d4bb965a26b07d879d5922f8ef240541", type: "image/jpeg" }, { url: "assets/themes/chalkfile.jpg", bytes: 47585, sha256: "1b65c3328bd467f3bc265311c86eb0385dda635b60546093e8f8c8aeb39dabb0", type: "image/jpeg" }, { url: "assets/themes/indigo.jpg", bytes: 55314, sha256: "6de83717c75dee7fde8f03d5b06c6b21d4bb965a26b07d879d5922f8ef240541", type: "image/jpeg" }, { url: "assets/themes/stage.jpg", bytes: 48558, sha256: "ed59b98bbbf287d7653761f1ff4370e744be84f2be878d4dd1150920d3094c6c", type: "image/jpeg" }, { url: "assets/themes/night.jpg", bytes: 52859, sha256: "88c8ec836f17fe4c74a5f396f5ee3ffa53efbe37164a1b56a2ceff156a351f36", type: "image/jpeg" }, { url: "stripe-billing/media/L01.jpg", bytes: 52971, sha256: "54bca6b4d938204ad38098047f2705cddc11adf022fd03d664a410c1e43b6bd8", type: "image/jpeg" }, { url: "nudge-product/media/N01.jpg", bytes: 33277, sha256: "9ea9ea3119b3c5366e71b1ad77b5db66b2c909fb01c4ea2ea5f5eaef1cb09018", type: "image/jpeg" }, { url: "uiux-engineers/media/D01.jpg", bytes: 34406, sha256: "77ed8d233706c0b2fb41966ec5f3250ae5f646300ee236ab08d9e2371cd025c5", type: "image/jpeg" }, { url: "indie-marketing/media/M01.jpg", bytes: 39009, sha256: "3f567ff0fa3dd0f86e7633064c5280a97104a49fde11edc05da8b7e948471bf2", type: "image/jpeg" }, { url: "nudge-comedy/media/W01.jpg", bytes: 45657, sha256: "9fa9dcc17057e14ff42fb1bd91e5c4ed4fbf38ce9a3fdd1a9314c7635a7fb44b", type: "image/jpeg" }, { url: "rive-comedy/media/R01.jpg", bytes: 42648, sha256: "8d999782bb4ffd692cc6c4ebd36e22fc6dd7aea53751eea80571d9af2721c662", type: "image/jpeg" }, { url: "pstack-comedy/media/P01.jpg", bytes: 31217, sha256: "ef8a88245e6481acd2f0830661616e0537a532d239c3802972791c3b1359d87c", type: "image/jpeg" }, { url: "superagent-comedy/media/S01.jpg", bytes: 41057, sha256: "9f59e052c7a90e7b69f3b3cdf6f1855c1bc0474a030a70afe7722d9136c5d3b5", type: "image/jpeg" }, { url: "icons/icon-180.png", bytes: 523, sha256: "d6105a3fcfae6bac6467e488f3f201c741ecdf0af5d513703cc230a0ed393e7e", type: "image/png" }, { url: "icons/icon-192.png", bytes: 601, sha256: "9ccb4b347be39b647476552be86cfbbf9240e3932eb33d43df6517a595c4e471", type: "image/png" }, { url: "icons/icon-512.png", bytes: 3661, sha256: "d4ed7cd03741d9313f72b18e3205ac0b9339c12a86f7dabc9708c8167efdc8af", type: "image/png" }, { url: "manifest.webmanifest", bytes: 586, sha256: "bbd840f9654b92d9d0170d1974905c1569571d5544069fb12d8c79bd315b8a49", type: "application/manifest+json" }, { url: "offline.html", bytes: 823, sha256: "09adcb18d23e10ec6afc0381a57a4610a9e63658abe3c5dbfba56683ad91cf60", type: "text/html" }] }.build}`;
var registryName = `${prefix}registry`;
var jobs = new Map;
var deleting = new Set;
var recordUrl = (id) => new URL(`.offline-records/${id}`, scope).href;
var assetUrl = (f) => new URL(f.url, scope).href;
async function readRecord(id) {
  const res = await (await caches.open(registryName)).match(recordUrl(id));
  if (!res)
    return { versions: [] };
  try {
    const r = await res.json();
    if (!Array.isArray(r.versions) || r.versions.length > 2)
      throw new Error;
    for (const v of r.versions) {
      validateManifest(v.manifest, id, scope);
      if (!v.cache.startsWith(`${prefix}course:${id}:`))
        throw new Error;
    }
    return r;
  } catch {
    return { versions: [] };
  }
}
async function complete(v) {
  if (!await caches.has(v.cache))
    return false;
  const cache = await caches.open(v.cache);
  for (const f of v.manifest.files) {
    const response = await cache.match(assetUrl(f));
    if (!response || response.status !== 200 || response.headers.get("X-Chalkfile-SHA256") !== f.sha256 || Number(response.headers.get("Content-Length")) !== f.bytes)
      return false;
  }
  return true;
}
async function ids() {
  const keys = await (await caches.open(registryName)).keys();
  return [...new Set([...{ build: "e0837cb38479071b4e91e8a33d231b5cdf7a54fae5ed7d5860cf1efeee49b1c7", courses: ["stripe-billing", "nudge-product", "uiux-engineers", "indie-marketing", "nudge-comedy", "rive-comedy", "pstack-comedy", "superagent-comedy"], shell: [{ url: "./", bytes: 45837, sha256: "dc17fc827a957ff21040ccc98914b4824e17d4df592c41a283ea29b50e17f94f", type: "text/html" }, { url: "assets/hero.jpg", bytes: 55314, sha256: "6de83717c75dee7fde8f03d5b06c6b21d4bb965a26b07d879d5922f8ef240541", type: "image/jpeg" }, { url: "assets/themes/chalkfile.jpg", bytes: 47585, sha256: "1b65c3328bd467f3bc265311c86eb0385dda635b60546093e8f8c8aeb39dabb0", type: "image/jpeg" }, { url: "assets/themes/indigo.jpg", bytes: 55314, sha256: "6de83717c75dee7fde8f03d5b06c6b21d4bb965a26b07d879d5922f8ef240541", type: "image/jpeg" }, { url: "assets/themes/stage.jpg", bytes: 48558, sha256: "ed59b98bbbf287d7653761f1ff4370e744be84f2be878d4dd1150920d3094c6c", type: "image/jpeg" }, { url: "assets/themes/night.jpg", bytes: 52859, sha256: "88c8ec836f17fe4c74a5f396f5ee3ffa53efbe37164a1b56a2ceff156a351f36", type: "image/jpeg" }, { url: "stripe-billing/media/L01.jpg", bytes: 52971, sha256: "54bca6b4d938204ad38098047f2705cddc11adf022fd03d664a410c1e43b6bd8", type: "image/jpeg" }, { url: "nudge-product/media/N01.jpg", bytes: 33277, sha256: "9ea9ea3119b3c5366e71b1ad77b5db66b2c909fb01c4ea2ea5f5eaef1cb09018", type: "image/jpeg" }, { url: "uiux-engineers/media/D01.jpg", bytes: 34406, sha256: "77ed8d233706c0b2fb41966ec5f3250ae5f646300ee236ab08d9e2371cd025c5", type: "image/jpeg" }, { url: "indie-marketing/media/M01.jpg", bytes: 39009, sha256: "3f567ff0fa3dd0f86e7633064c5280a97104a49fde11edc05da8b7e948471bf2", type: "image/jpeg" }, { url: "nudge-comedy/media/W01.jpg", bytes: 45657, sha256: "9fa9dcc17057e14ff42fb1bd91e5c4ed4fbf38ce9a3fdd1a9314c7635a7fb44b", type: "image/jpeg" }, { url: "rive-comedy/media/R01.jpg", bytes: 42648, sha256: "8d999782bb4ffd692cc6c4ebd36e22fc6dd7aea53751eea80571d9af2721c662", type: "image/jpeg" }, { url: "pstack-comedy/media/P01.jpg", bytes: 31217, sha256: "ef8a88245e6481acd2f0830661616e0537a532d239c3802972791c3b1359d87c", type: "image/jpeg" }, { url: "superagent-comedy/media/S01.jpg", bytes: 41057, sha256: "9f59e052c7a90e7b69f3b3cdf6f1855c1bc0474a030a70afe7722d9136c5d3b5", type: "image/jpeg" }, { url: "icons/icon-180.png", bytes: 523, sha256: "d6105a3fcfae6bac6467e488f3f201c741ecdf0af5d513703cc230a0ed393e7e", type: "image/png" }, { url: "icons/icon-192.png", bytes: 601, sha256: "9ccb4b347be39b647476552be86cfbbf9240e3932eb33d43df6517a595c4e471", type: "image/png" }, { url: "icons/icon-512.png", bytes: 3661, sha256: "d4ed7cd03741d9313f72b18e3205ac0b9339c12a86f7dabc9708c8167efdc8af", type: "image/png" }, { url: "manifest.webmanifest", bytes: 586, sha256: "bbd840f9654b92d9d0170d1974905c1569571d5544069fb12d8c79bd315b8a49", type: "application/manifest+json" }, { url: "offline.html", bytes: 823, sha256: "09adcb18d23e10ec6afc0381a57a4610a9e63658abe3c5dbfba56683ad91cf60", type: "text/html" }] }.courses, ...keys.map((r) => new URL(r.url).pathname.split("/").pop()).filter((id) => COURSE_ID.test(id))])];
}
async function statuses() {
  return Promise.all((await ids()).map(async (id) => {
    const r = await readRecord(id);
    const valid = await Promise.all(r.versions.map(complete));
    return {
      id,
      saved: r.versions.find((_, i) => valid[i]) ?? null,
      incomplete: r.versions.some((_, i) => !valid[i]),
      progress: jobs.get(id)?.progress ?? null
    };
  }));
}
async function cleanup(oldShell = false) {
  if (jobs.size || deleting.size)
    return;
  const keep = new Set([registryName, shellName]);
  for (const id of await ids())
    for (const v of (await readRecord(id)).versions)
      keep.add(v.cache);
  for (const name of await caches.keys()) {
    if (jobs.size || deleting.size)
      return;
    if ((name.startsWith(`${prefix}course:`) || oldShell && name.startsWith(`${prefix}shell:`)) && !keep.has(name))
      await caches.delete(name);
  }
}
async function fetchManifest(id) {
  if (!{ build: "e0837cb38479071b4e91e8a33d231b5cdf7a54fae5ed7d5860cf1efeee49b1c7", courses: ["stripe-billing", "nudge-product", "uiux-engineers", "indie-marketing", "nudge-comedy", "rive-comedy", "pstack-comedy", "superagent-comedy"], shell: [{ url: "./", bytes: 45837, sha256: "dc17fc827a957ff21040ccc98914b4824e17d4df592c41a283ea29b50e17f94f", type: "text/html" }, { url: "assets/hero.jpg", bytes: 55314, sha256: "6de83717c75dee7fde8f03d5b06c6b21d4bb965a26b07d879d5922f8ef240541", type: "image/jpeg" }, { url: "assets/themes/chalkfile.jpg", bytes: 47585, sha256: "1b65c3328bd467f3bc265311c86eb0385dda635b60546093e8f8c8aeb39dabb0", type: "image/jpeg" }, { url: "assets/themes/indigo.jpg", bytes: 55314, sha256: "6de83717c75dee7fde8f03d5b06c6b21d4bb965a26b07d879d5922f8ef240541", type: "image/jpeg" }, { url: "assets/themes/stage.jpg", bytes: 48558, sha256: "ed59b98bbbf287d7653761f1ff4370e744be84f2be878d4dd1150920d3094c6c", type: "image/jpeg" }, { url: "assets/themes/night.jpg", bytes: 52859, sha256: "88c8ec836f17fe4c74a5f396f5ee3ffa53efbe37164a1b56a2ceff156a351f36", type: "image/jpeg" }, { url: "stripe-billing/media/L01.jpg", bytes: 52971, sha256: "54bca6b4d938204ad38098047f2705cddc11adf022fd03d664a410c1e43b6bd8", type: "image/jpeg" }, { url: "nudge-product/media/N01.jpg", bytes: 33277, sha256: "9ea9ea3119b3c5366e71b1ad77b5db66b2c909fb01c4ea2ea5f5eaef1cb09018", type: "image/jpeg" }, { url: "uiux-engineers/media/D01.jpg", bytes: 34406, sha256: "77ed8d233706c0b2fb41966ec5f3250ae5f646300ee236ab08d9e2371cd025c5", type: "image/jpeg" }, { url: "indie-marketing/media/M01.jpg", bytes: 39009, sha256: "3f567ff0fa3dd0f86e7633064c5280a97104a49fde11edc05da8b7e948471bf2", type: "image/jpeg" }, { url: "nudge-comedy/media/W01.jpg", bytes: 45657, sha256: "9fa9dcc17057e14ff42fb1bd91e5c4ed4fbf38ce9a3fdd1a9314c7635a7fb44b", type: "image/jpeg" }, { url: "rive-comedy/media/R01.jpg", bytes: 42648, sha256: "8d999782bb4ffd692cc6c4ebd36e22fc6dd7aea53751eea80571d9af2721c662", type: "image/jpeg" }, { url: "pstack-comedy/media/P01.jpg", bytes: 31217, sha256: "ef8a88245e6481acd2f0830661616e0537a532d239c3802972791c3b1359d87c", type: "image/jpeg" }, { url: "superagent-comedy/media/S01.jpg", bytes: 41057, sha256: "9f59e052c7a90e7b69f3b3cdf6f1855c1bc0474a030a70afe7722d9136c5d3b5", type: "image/jpeg" }, { url: "icons/icon-180.png", bytes: 523, sha256: "d6105a3fcfae6bac6467e488f3f201c741ecdf0af5d513703cc230a0ed393e7e", type: "image/png" }, { url: "icons/icon-192.png", bytes: 601, sha256: "9ccb4b347be39b647476552be86cfbbf9240e3932eb33d43df6517a595c4e471", type: "image/png" }, { url: "icons/icon-512.png", bytes: 3661, sha256: "d4ed7cd03741d9313f72b18e3205ac0b9339c12a86f7dabc9708c8167efdc8af", type: "image/png" }, { url: "manifest.webmanifest", bytes: 586, sha256: "bbd840f9654b92d9d0170d1974905c1569571d5544069fb12d8c79bd315b8a49", type: "application/manifest+json" }, { url: "offline.html", bytes: 823, sha256: "09adcb18d23e10ec6afc0381a57a4610a9e63658abe3c5dbfba56683ad91cf60", type: "text/html" }] }.courses.includes(id))
    throw new Error("この講座の更新情報は公開されていません。");
  const r = await fetch(new URL(`${id}/offline-manifest.json`, scope), {
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    signal: AbortSignal.timeout(15000)
  });
  if (r.status !== 200 || !r.headers.get("Content-Type")?.includes("application/json"))
    throw new Error("教材情報を取得できません。通信を確認して再試行してください。");
  const text = await r.text();
  if (text.length > 1e5)
    throw new Error("教材情報が大きすぎます。");
  const m = validateManifest(JSON.parse(text), id, scope);
  if (await sha256(new TextEncoder().encode(JSON.stringify(m.files)).buffer) !== m.revision)
    throw new Error("教材情報の整合性を確認できません。");
  return m;
}
async function download(f, signal, onBytes) {
  const res = await fetch(assetUrl(f), { cache: "no-store", credentials: "omit", redirect: "error", signal });
  if (res.status !== 200 || !res.body || res.type === "opaque" || res.headers.get("Content-Type")?.split(";")[0].trim() !== f.type) {
    throw new Error("教材を取得できません。一部取得や別形式の応答は保存しません。");
  }
  const reader = res.body.getReader();
  const data = new Uint8Array(f.bytes);
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done)
        break;
      length += value.byteLength;
      if (length > f.bytes)
        throw new Error("教材のサイズが変わりました。更新を確認して再試行してください。");
      data.set(value, length - value.byteLength);
      onBytes(value.byteLength);
    }
  } catch (e) {
    await reader.cancel().catch(() => {});
    throw e;
  }
  if (length !== f.bytes || await sha256(data.buffer) !== f.sha256)
    throw new Error("教材が不完全か、公開中に更新されました。通信を確認して再試行してください。");
  return new Response(data, { headers: {
    "Content-Type": f.type,
    "Content-Length": String(f.bytes),
    "X-Chalkfile-SHA256": f.sha256,
    "Accept-Ranges": "bytes",
    ETag: `"${f.sha256}"`
  } });
}
async function broadcast() {
  for (const c of await sw.clients.matchAll())
    c.postMessage({ protocol: 1, type: "CHANGED" });
}
async function save(id, report) {
  if (jobs.size || deleting.size)
    throw new Error("別の保存・削除を処理中です。完了してから再試行してください。");
  const controller = new AbortController;
  const job = { controller, cancelled: false, progress: { id, loaded: 0, total: 0, file: 0, count: 0 }, done: Promise.resolve() };
  jobs.set(id, job);
  job.done = (async () => {
    let staging = "";
    let committed = false;
    try {
      const manifest = await fetchManifest(id);
      controller.signal.throwIfAborted();
      const before = await readRecord(id);
      if (before.versions[0]?.manifest.revision === manifest.revision && await complete(before.versions[0]))
        return;
      const estimate = await sw.navigator.storage?.estimate?.().catch(() => null);
      if (estimate?.quota && estimate.quota - (estimate.usage ?? 0) < manifest.bytes * 1.1) {
        throw new DOMException("保存用の空き容量が不足しています。", "QuotaExceededError");
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
        const timeout = setTimeout(() => controller.abort(new Error("通信が時間切れになりました。再試行してください。")), 120000);
        try {
          const response = await download(f, controller.signal, (bytes) => {
            job.progress.loaded += bytes;
            if (Date.now() - lastReport > 250) {
              report({ ...job.progress });
              lastReport = Date.now();
            }
          });
          controller.signal.throwIfAborted();
          await cache.put(assetUrl(f), response);
        } finally {
          clearTimeout(timeout);
        }
      }
      controller.signal.throwIfAborted();
      const version = { cache: staging, manifest, savedAt: new Date().toISOString() };
      if (!await complete(version))
        throw new Error("保存した教材を確認できません。再試行してください。");
      controller.signal.throwIfAborted();
      const previous = [];
      for (const v of before.versions)
        if (await complete(v)) {
          previous.push(v);
          break;
        }
      controller.signal.throwIfAborted();
      await (await caches.open(registryName)).put(recordUrl(id), Response.json({ versions: [version, ...previous] }));
      committed = true;
      for (const v of before.versions)
        if (!previous.includes(v))
          await caches.delete(v.cache).catch(() => false);
      report({ ...job.progress });
    } catch (e) {
      if (job.cancelled)
        throw new Error("保存をキャンセルしました。未完了のデータは保存済みになりません。");
      if (e instanceof DOMException && e.name === "QuotaExceededError")
        throw new Error("空き容量が不足しています。不要な保存を削除して再試行してください。");
      throw e;
    } finally {
      if (staging && !committed)
        await caches.delete(staging).catch(() => false);
      jobs.delete(id);
      await broadcast();
    }
  })();
  await job.done;
}
async function remove(id) {
  if (jobs.size || deleting.size)
    throw new Error("保存・削除が処理中です。キャンセルか完了の後に削除してください。");
  deleting.add(id);
  try {
    await (await caches.open(registryName)).delete(recordUrl(id));
    for (const name of await caches.keys())
      if (name.startsWith(`${prefix}course:${id}:`))
        await caches.delete(name);
  } finally {
    deleting.delete(id);
    await broadcast();
  }
}
sw.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(shellName);
    for (const f of { build: "e0837cb38479071b4e91e8a33d231b5cdf7a54fae5ed7d5860cf1efeee49b1c7", courses: ["stripe-billing", "nudge-product", "uiux-engineers", "indie-marketing", "nudge-comedy", "rive-comedy", "pstack-comedy", "superagent-comedy"], shell: [{ url: "./", bytes: 45837, sha256: "dc17fc827a957ff21040ccc98914b4824e17d4df592c41a283ea29b50e17f94f", type: "text/html" }, { url: "assets/hero.jpg", bytes: 55314, sha256: "6de83717c75dee7fde8f03d5b06c6b21d4bb965a26b07d879d5922f8ef240541", type: "image/jpeg" }, { url: "assets/themes/chalkfile.jpg", bytes: 47585, sha256: "1b65c3328bd467f3bc265311c86eb0385dda635b60546093e8f8c8aeb39dabb0", type: "image/jpeg" }, { url: "assets/themes/indigo.jpg", bytes: 55314, sha256: "6de83717c75dee7fde8f03d5b06c6b21d4bb965a26b07d879d5922f8ef240541", type: "image/jpeg" }, { url: "assets/themes/stage.jpg", bytes: 48558, sha256: "ed59b98bbbf287d7653761f1ff4370e744be84f2be878d4dd1150920d3094c6c", type: "image/jpeg" }, { url: "assets/themes/night.jpg", bytes: 52859, sha256: "88c8ec836f17fe4c74a5f396f5ee3ffa53efbe37164a1b56a2ceff156a351f36", type: "image/jpeg" }, { url: "stripe-billing/media/L01.jpg", bytes: 52971, sha256: "54bca6b4d938204ad38098047f2705cddc11adf022fd03d664a410c1e43b6bd8", type: "image/jpeg" }, { url: "nudge-product/media/N01.jpg", bytes: 33277, sha256: "9ea9ea3119b3c5366e71b1ad77b5db66b2c909fb01c4ea2ea5f5eaef1cb09018", type: "image/jpeg" }, { url: "uiux-engineers/media/D01.jpg", bytes: 34406, sha256: "77ed8d233706c0b2fb41966ec5f3250ae5f646300ee236ab08d9e2371cd025c5", type: "image/jpeg" }, { url: "indie-marketing/media/M01.jpg", bytes: 39009, sha256: "3f567ff0fa3dd0f86e7633064c5280a97104a49fde11edc05da8b7e948471bf2", type: "image/jpeg" }, { url: "nudge-comedy/media/W01.jpg", bytes: 45657, sha256: "9fa9dcc17057e14ff42fb1bd91e5c4ed4fbf38ce9a3fdd1a9314c7635a7fb44b", type: "image/jpeg" }, { url: "rive-comedy/media/R01.jpg", bytes: 42648, sha256: "8d999782bb4ffd692cc6c4ebd36e22fc6dd7aea53751eea80571d9af2721c662", type: "image/jpeg" }, { url: "pstack-comedy/media/P01.jpg", bytes: 31217, sha256: "ef8a88245e6481acd2f0830661616e0537a532d239c3802972791c3b1359d87c", type: "image/jpeg" }, { url: "superagent-comedy/media/S01.jpg", bytes: 41057, sha256: "9f59e052c7a90e7b69f3b3cdf6f1855c1bc0474a030a70afe7722d9136c5d3b5", type: "image/jpeg" }, { url: "icons/icon-180.png", bytes: 523, sha256: "d6105a3fcfae6bac6467e488f3f201c741ecdf0af5d513703cc230a0ed393e7e", type: "image/png" }, { url: "icons/icon-192.png", bytes: 601, sha256: "9ccb4b347be39b647476552be86cfbbf9240e3932eb33d43df6517a595c4e471", type: "image/png" }, { url: "icons/icon-512.png", bytes: 3661, sha256: "d4ed7cd03741d9313f72b18e3205ac0b9339c12a86f7dabc9708c8167efdc8af", type: "image/png" }, { url: "manifest.webmanifest", bytes: 586, sha256: "bbd840f9654b92d9d0170d1974905c1569571d5544069fb12d8c79bd315b8a49", type: "application/manifest+json" }, { url: "offline.html", bytes: 823, sha256: "09adcb18d23e10ec6afc0381a57a4610a9e63658abe3c5dbfba56683ad91cf60", type: "text/html" }] }.shell)
      await cache.put(assetUrl(f), await download(f, AbortSignal.timeout(60000), () => {}));
  })());
});
sw.addEventListener("activate", (event) => event.waitUntil((async () => {
  await cleanup(true);
  await sw.clients.claim();
})()));
sw.addEventListener("message", (event) => {
  const port = event.ports[0];
  const data = event.data;
  const source = event.source;
  if (!port || !source?.url.startsWith(scope) || data?.protocol !== 1)
    return;
  event.waitUntil((async () => {
    try {
      if (data.type === "STATUS") {
        const courses = await statuses();
        await cleanup();
        port.postMessage({ ok: true, courses });
      } else {
        const id = data.id;
        if (typeof id !== "string" || !COURSE_ID.test(id))
          throw new Error("講座を選んでください。");
        if (data.type === "CHECK")
          port.postMessage({ ok: true, manifest: await fetchManifest(id) });
        else if (data.type === "SAVE") {
          await save(id, (progress) => port.postMessage({ progress }));
          port.postMessage({ ok: true });
        } else if (data.type === "CANCEL") {
          const job = jobs.get(id);
          if (job) {
            job.cancelled = true;
            job.controller.abort();
          }
          port.postMessage({ ok: true });
        } else if (data.type === "DELETE") {
          await remove(id);
          port.postMessage({ ok: true });
        } else
          throw new Error("対応していない操作です。");
      }
    } catch (e) {
      port.postMessage({ ok: false, error: e instanceof Error ? e.message : "保存場所を利用できません。ブラウザの設定を確認してください。" });
    }
  })());
});
async function cachedResponse(req, response) {
  const headers = new Headers(response.headers);
  headers.delete("X-Chalkfile-SHA256");
  const size = Number(headers.get("Content-Length"));
  if (req.method === "HEAD")
    return new Response(null, { headers });
  const ifRange = req.headers.get("If-Range");
  const range = byteRange(ifRange && ifRange !== headers.get("ETag") ? null : req.headers.get("Range"), size);
  if (range.kind === "unsatisfiable")
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}`, "Accept-Ranges": "bytes" } });
  if (range.kind === "full")
    return new Response(response.body, { headers });
  const blob = await response.blob();
  headers.set("Content-Range", `bytes ${range.start}-${range.end}/${size}`);
  headers.set("Content-Length", String(range.end - range.start + 1));
  return new Response(blob.slice(range.start, range.end + 1), { status: 206, headers });
}
async function route(req) {
  const url = new URL(req.url);
  const relative = url.pathname.slice(new URL(scope).pathname.length);
  const id = relative.split("/")[0];
  if (req.mode === "navigate" && COURSE_ID.test(relative))
    return Response.redirect(new URL(`${relative}/`, scope), 301);
  if (COURSE_ID.test(id)) {
    const record = await readRecord(id);
    const navigation = req.mode === "navigate" && (relative === id || relative === `${id}/` || relative === `${id}/index.html`);
    for (const v of record.versions) {
      const file = v.manifest.files.find((f) => navigation ? f.url === `${id}/` : assetUrl(f) === url.href);
      if (file && await complete(v)) {
        const response = await (await caches.open(v.cache)).match(assetUrl(file));
        if (response)
          return cachedResponse(req, response);
      }
    }
    if (record.versions.length && relative.includes("/media/") && url.searchParams.has("v")) {
      return new Response("この保存版の動画は利用できません。講座を再読み込みし、オンラインで保存し直してください。", { status: 503 });
    }
  }
  try {
    const response = await fetch(req);
    if (response.ok || req.mode !== "navigate")
      return response;
  } catch {}
  const shell = await caches.open(shellName);
  const key = !relative || relative === "index.html" ? scope : url.href;
  const cached = await shell.match(key);
  if (cached)
    return cachedResponse(req, cached);
  if (req.mode === "navigate") {
    const fallback = await shell.match(new URL("offline.html", scope).href);
    if (fallback)
      return new Response((await fallback.text()).replace("__ROOT__", new URL(scope).pathname), { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  return new Response("オフラインです。この教材はアプリ内に保存されていません。", { status: 503 });
}
sw.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== new URL(scope).origin || !url.href.startsWith(scope) || !["GET", "HEAD"].includes(event.request.method))
    return;
  event.respondWith(route(event.request));
});
