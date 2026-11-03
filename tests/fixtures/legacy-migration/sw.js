// site/offline-shared.ts
var COURSE_ID = /^(?:[a-z]{2}\/)?[A-Za-z0-9][A-Za-z0-9_-]*$/;
var HASH = /^[a-f0-9]{64}$/;
var MAX_FILE_BYTES = 32 * 1024 * 1024;
var MEDIA_NAME = "([A-Za-z0-9][A-Za-z0-9_-]*(?:\\.(?!cc\\.)[a-z]{2})?)(\\.cc)?\\.(mp4|jpg)";

class OfflineError extends Error {
  code;
  constructor(code) {
    super(code);
    this.code = code;
  }
}
function validateManifest(value, id, scope, mediaRoots = {}) {
  const m = value;
  if (!m || m.schema !== 1 || !COURSE_ID.test(id) || m.id !== id || typeof m.title !== "string" || m.title.length > 300 || !HASH.test(m.pageVersion) || !HASH.test(m.revision) || !Array.isArray(m.files) || m.files.length < 3 || m.files.length > 201) {
    throw new OfflineError("manifest");
  }
  const origin = new URL(scope).origin;
  const lang = id.includes("/") ? id.split("/")[0] : "";
  const slug = id.split("/").pop();
  const mediaRoot = lang && mediaRoots[lang] ? new URL(mediaRoots[lang], scope).href : "";
  const urls = new Set;
  let bytes = 0;
  const media = new Map;
  for (const f of m.files) {
    if (!f || typeof f.url !== "string" || urls.has(f.url) || !HASH.test(f.sha256) || !Number.isSafeInteger(f.bytes) || f.bytes <= 0 || f.bytes > MAX_FILE_BYTES)
      throw new OfflineError("format");
    urls.add(f.url);
    const url = new URL(f.url, scope);
    const inScope = url.href.startsWith(scope);
    const inMedia = !!mediaRoot && url.href.startsWith(mediaRoot);
    if (url.origin !== origin || !inScope && !inMedia || url.hash || url.username || url.password)
      throw new OfflineError("origin");
    if (f.url === `${id}/`) {
      if (f.type !== "text/html" || f.bytes > 4 * 1024 * 1024)
        throw new OfflineError("page");
    } else {
      const hashed = /^\/media\/([a-z]{2})\/([A-Za-z0-9][A-Za-z0-9_-]*)\/([A-Za-z0-9][A-Za-z0-9_-]*)(\.cc)?\.([a-f0-9]{64})\.mp4$/.exec(f.url);
      if (hashed) {
        if (hashed[1] !== (lang || "ja") || hashed[2] !== slug || hashed[5] !== f.sha256 || f.type !== "video/mp4")
          throw new OfflineError("media");
        const key = `${hashed[3]}${lang ? `.${lang}` : ""}`;
        const types2 = media.get(key) ?? new Set;
        types2.add(hashed[4] ? "cc" : "mp4");
        media.set(key, types2);
        bytes += f.bytes;
        continue;
      }
      const rest = inMedia ? url.href.slice(mediaRoot.length) : url.href.slice(scope.length);
      const match = new RegExp(`^${inMedia ? "" : `${lang ? `${lang}\\/` : ""}`}([A-Za-z0-9][A-Za-z0-9_-]*)\\/${inMedia ? "" : "media\\/"}${MEDIA_NAME}\\?v=([a-f0-9]{64})$`).exec(rest);
      const nameLang = match?.[2].includes(".") ? match[2].split(".")[1] : "";
      if (!match || match[1] !== slug || nameLang !== lang || match[5] !== m.pageVersion || f.type !== (match[4] === "mp4" ? "video/mp4" : "image/jpeg") || match[3] && match[4] !== "mp4") {
        throw new OfflineError("media");
      }
      const types = media.get(match[2]) ?? new Set;
      types.add(match[3] ? "cc" : match[4]);
      media.set(match[2], types);
    }
    bytes += f.bytes;
  }
  if (!urls.has(`${id}/`) || media.size === 0 || [...media.values()].some((x) => !x.has("mp4") || !x.has("jpg")) || bytes !== m.bytes || bytes > 1024 * 1024 * 1024)
    throw new OfflineError("incomplete");
  return m;
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

// site/legacy-sw.ts
var sw = globalThis;
var scope = sw.registration.scope;
var prefix = `chalkfile:${new URL(scope).pathname}:offline-v1:`;
var registry = `${prefix}registry`;
var target = "https://chalkfile.com/";
var legacyMedia = { en: "/chalkfile-media-en/", zh: "/chalkfile-media-zh/" };
var recordUrl = (id) => new URL(`.offline-records/${encodeURIComponent(id)}`, scope).href;
var fileUrl = (url) => new URL(url, scope).href;
function movedUrl(url) {
  const relative = url.pathname.startsWith(new URL(scope).pathname) ? url.pathname.slice(new URL(scope).pathname.length) : "";
  const next = new URL(target);
  next.pathname = `/${relative.replace(/^\/+/, "")}`;
  next.search = url.search;
  next.hash = url.hash;
  return next.href;
}
function idOf(url) {
  for (const [lang, root] of Object.entries(legacyMedia))
    if (url.pathname.startsWith(root))
      return `${lang}/${url.pathname.slice(root.length).split("/")[0]}`;
  const parts = url.pathname.slice(new URL(scope).pathname.length).split("/");
  return /^[a-z]{2}$/.test(parts[0]) && parts[1] ? `${parts[0]}/${parts[1]}` : parts[0];
}
async function versions(id) {
  if (!COURSE_ID.test(id))
    return [];
  const response = await (await caches.open(registry)).match(recordUrl(id));
  if (!response)
    return [];
  try {
    const value = await response.json();
    if (!Array.isArray(value.versions) || value.versions.length > 2)
      return [];
    return value.versions.filter((v) => {
      try {
        validateManifest(v.manifest, id, scope, legacyMedia);
        return v.cache.startsWith(`${prefix}course:${id}:`);
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}
async function complete(v) {
  if (!await caches.has(v.cache))
    return false;
  const cache = await caches.open(v.cache);
  for (const f of v.manifest.files) {
    const r = await cache.match(fileUrl(f.url));
    if (!r || r.status !== 200 || r.headers.get("X-Chalkfile-SHA256") !== f.sha256 || Number(r.headers.get("Content-Length")) !== f.bytes)
      return false;
  }
  return true;
}
async function statuses() {
  const requests = await (await caches.open(registry)).keys();
  const ids = requests.map((r) => decodeURIComponent(new URL(r.url).pathname.split("/").pop())).filter((id) => COURSE_ID.test(id));
  return Promise.all(ids.map(async (id) => {
    const all = await versions(id);
    const validity = await Promise.all(all.map(complete));
    return { id, saved: all.find((_, i) => validity[i]) ?? null, incomplete: validity.includes(false), progress: null };
  }));
}
async function online() {
  try {
    const r = await fetch(new URL("migration-health.json", scope), { cache: "no-store", credentials: "omit", redirect: "error", signal: AbortSignal.timeout(3000) });
    return r.status === 200 && (await r.json()).target === target;
  } catch {
    return false;
  }
}
function notice(destination) {
  const safe = destination.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  return `<aside id="chalkfileMoved" role="status" style="position:sticky;top:0;z-index:99999;padding:12px;background:#fff8d9;color:#222;border-bottom:1px solid #9b7d25">保存済みの講座はこのまま利用できます。オンラインになったら、<a href="${safe}">chalkfile.com</a> の新しい場所で保存し直してください。保存と学習記録は自動で移りません。</aside>`;
}
async function cached(req, response, navigation) {
  const headers = new Headers(response.headers);
  headers.delete("X-Chalkfile-SHA256");
  if (navigation) {
    const html = (await response.text()).replace(/<body([^>]*)>/i, (body) => `${body}${notice(movedUrl(new URL(req.url)))}`);
    headers.delete("Content-Length");
    headers.delete("ETag");
    headers.set("Cache-Control", "no-store");
    return new Response(html, { headers });
  }
  if (req.method === "HEAD")
    return new Response(null, { headers });
  const size = Number(headers.get("Content-Length"));
  const ifRange = req.headers.get("If-Range");
  const range = byteRange(ifRange && ifRange !== headers.get("ETag") ? null : req.headers.get("Range"), size);
  if (range.kind === "unsatisfiable")
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}`, "Accept-Ranges": "bytes" } });
  if (range.kind === "full")
    return new Response(response.body, { headers });
  const blob = await response.blob();
  headers.set("Content-Length", String(range.end - range.start + 1));
  headers.set("Content-Range", `bytes ${range.start}-${range.end}/${size}`);
  return new Response(blob.slice(range.start, range.end + 1), { status: 206, headers });
}
async function route(req) {
  const url = new URL(req.url);
  const navigation = req.mode === "navigate";
  if (navigation && await online())
    return Response.redirect(movedUrl(url), 302);
  const id = idOf(url);
  for (const v of await versions(id)) {
    const f = v.manifest.files.find((f2) => navigation ? f2.url === `${id}/` : fileUrl(f2.url) === url.href);
    if (f && await complete(v)) {
      const response = await (await caches.open(v.cache)).match(fileUrl(f.url));
      if (response)
        return cached(req, response, navigation);
    }
  }
  for (const name of (await caches.keys()).filter((name2) => name2.startsWith(`${prefix}shell:`)).reverse()) {
    const cache = await caches.open(name);
    const key = url.pathname === new URL(scope).pathname || url.pathname === `${new URL(scope).pathname}index.html` ? scope : url.href;
    const response = await cache.match(key);
    if (response)
      return cached(req, response, navigation);
  }
  if (navigation)
    return new Response(`<!doctype html><html lang="ja"><meta charset="utf-8"><title>保存されていない教材｜Chalkfile</title><h1>この教材は保存されていません</h1>${notice(movedUrl(url))}</html>`, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  return new Response("旧サイトのこのファイルは保存されていません。新しい場所で保存し直してください。", { status: 503 });
}
sw.addEventListener("install", (event) => event.waitUntil(sw.skipWaiting()));
sw.addEventListener("activate", (event) => event.waitUntil(sw.clients.claim()));
sw.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== new URL(scope).origin || !["GET", "HEAD"].includes(event.request.method) || !(url.href.startsWith(scope) || Object.values(legacyMedia).some((p) => url.pathname.startsWith(p))))
    return;
  event.respondWith(route(event.request));
});
sw.addEventListener("message", (event) => {
  const port = event.ports[0];
  const source = event.source;
  const data = event.data;
  if (!port || !source?.url.startsWith(scope) || data?.protocol !== 1)
    return;
  event.waitUntil((async () => {
    if (data.type === "STATUS") {
      port.postMessage({ ok: true, migrated: true, courses: await statuses() });
      return;
    }
    if (data.type === "DELETE" && typeof data.id === "string" && COURSE_ID.test(data.id)) {
      await (await caches.open(registry)).delete(recordUrl(data.id));
      for (const name of await caches.keys())
        if (name.startsWith(`${prefix}course:${data.id}:`))
          await caches.delete(name);
      port.postMessage({ ok: true });
      return;
    }
    port.postMessage({ ok: false, error: "このサイトの更新保存は終了しました。chalkfile.com の新しい場所で保存し直してください。" });
  })());
});
