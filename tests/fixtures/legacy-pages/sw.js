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
var shellName = `${prefix}shell:${{ build: "7b0165f71bd2a6d0d1a98b786811dd28e05c1497d779722f68bf32d7b3b86cf3", courses: ["stripe-billing", "nudge-product", "uiux-engineers", "indie-marketing", "nudge-comedy", "rive-comedy", "pstack-comedy", "superagent-comedy"], shell: [{ url: "./", bytes: 59650, sha256: "8568e7af567deec1d23d3149ec5f635227312cd5e66f02be1be8160e1ee7cc25", type: "text/html" }, { url: "assets/hero.jpg", bytes: 55314, sha256: "6de83717c75dee7fde8f03d5b06c6b21d4bb965a26b07d879d5922f8ef240541", type: "image/jpeg" }, { url: "assets/themes/chalkfile.jpg", bytes: 47585, sha256: "1b65c3328bd467f3bc265311c86eb0385dda635b60546093e8f8c8aeb39dabb0", type: "image/jpeg" }, { url: "assets/themes/indigo.jpg", bytes: 55314, sha256: "6de83717c75dee7fde8f03d5b06c6b21d4bb965a26b07d879d5922f8ef240541", type: "image/jpeg" }, { url: "assets/themes/stage.jpg", bytes: 48558, sha256: "ed59b98bbbf287d7653761f1ff4370e744be84f2be878d4dd1150920d3094c6c", type: "image/jpeg" }, { url: "assets/themes/night.jpg", bytes: 52859, sha256: "88c8ec836f17fe4c74a5f396f5ee3ffa53efbe37164a1b56a2ceff156a351f36", type: "image/jpeg" }, { url: "stripe-billing/media/L01.jpg", bytes: 52971, sha256: "54bca6b4d938204ad38098047f2705cddc11adf022fd03d664a410c1e43b6bd8", type: "image/jpeg" }, { url: "nudge-product/media/N01.jpg", bytes: 33277, sha256: "9ea9ea3119b3c5366e71b1ad77b5db66b2c909fb01c4ea2ea5f5eaef1cb09018", type: "image/jpeg" }, { url: "uiux-engineers/media/D01.jpg", bytes: 34406, sha256: "77ed8d233706c0b2fb41966ec5f3250ae5f646300ee236ab08d9e2371cd025c5", type: "image/jpeg" }, { url: "indie-marketing/media/M01.jpg", bytes: 39009, sha256: "3f567ff0fa3dd0f86e7633064c5280a97104a49fde11edc05da8b7e948471bf2", type: "image/jpeg" }, { url: "nudge-comedy/media/W01.jpg", bytes: 45657, sha256: "9fa9dcc17057e14ff42fb1bd91e5c4ed4fbf38ce9a3fdd1a9314c7635a7fb44b", type: "image/jpeg" }, { url: "rive-comedy/media/R01.jpg", bytes: 42648, sha256: "8d999782bb4ffd692cc6c4ebd36e22fc6dd7aea53751eea80571d9af2721c662", type: "image/jpeg" }, { url: "pstack-comedy/media/P01.jpg", bytes: 31217, sha256: "ef8a88245e6481acd2f0830661616e0537a532d239c3802972791c3b1359d87c", type: "image/jpeg" }, { url: "superagent-comedy/media/S01.jpg", bytes: 41057, sha256: "9f59e052c7a90e7b69f3b3cdf6f1855c1bc0474a030a70afe7722d9136c5d3b5", type: "image/jpeg" }, { url: "icons/icon-180.png", bytes: 523, sha256: "d6105a3fcfae6bac6467e488f3f201c741ecdf0af5d513703cc230a0ed393e7e", type: "image/png" }, { url: "icons/icon-192.png", bytes: 601, sha256: "9ccb4b347be39b647476552be86cfbbf9240e3932eb33d43df6517a595c4e471", type: "image/png" }, { url: "icons/icon-512.png", bytes: 3661, sha256: "d4ed7cd03741d9313f72b18e3205ac0b9339c12a86f7dabc9708c8167efdc8af", type: "image/png" }, { url: "manifest.webmanifest", bytes: 586, sha256: "bbd840f9654b92d9d0170d1974905c1569571d5544069fb12d8c79bd315b8a49", type: "application/manifest+json" }, { url: "offline.html", bytes: 1541, sha256: "4cccdcadba2e71c9ab143a165d9e0e355d55f263b8f7e22c0a23b00641d5b874", type: "text/html" }], mediaRoots: {} }.build}`;
var registryName = `${prefix}registry`;
var jobs = new Map;
var deleting = new Set;
var recordUrl = (id) => new URL(`.offline-records/${encodeURIComponent(id)}`, scope).href;
var assetUrl = (f) => new URL(f.url, scope).href;
var mediaRoots = Object.fromEntries(Object.entries({ build: "7b0165f71bd2a6d0d1a98b786811dd28e05c1497d779722f68bf32d7b3b86cf3", courses: ["stripe-billing", "nudge-product", "uiux-engineers", "indie-marketing", "nudge-comedy", "rive-comedy", "pstack-comedy", "superagent-comedy"], shell: [{ url: "./", bytes: 59650, sha256: "8568e7af567deec1d23d3149ec5f635227312cd5e66f02be1be8160e1ee7cc25", type: "text/html" }, { url: "assets/hero.jpg", bytes: 55314, sha256: "6de83717c75dee7fde8f03d5b06c6b21d4bb965a26b07d879d5922f8ef240541", type: "image/jpeg" }, { url: "assets/themes/chalkfile.jpg", bytes: 47585, sha256: "1b65c3328bd467f3bc265311c86eb0385dda635b60546093e8f8c8aeb39dabb0", type: "image/jpeg" }, { url: "assets/themes/indigo.jpg", bytes: 55314, sha256: "6de83717c75dee7fde8f03d5b06c6b21d4bb965a26b07d879d5922f8ef240541", type: "image/jpeg" }, { url: "assets/themes/stage.jpg", bytes: 48558, sha256: "ed59b98bbbf287d7653761f1ff4370e744be84f2be878d4dd1150920d3094c6c", type: "image/jpeg" }, { url: "assets/themes/night.jpg", bytes: 52859, sha256: "88c8ec836f17fe4c74a5f396f5ee3ffa53efbe37164a1b56a2ceff156a351f36", type: "image/jpeg" }, { url: "stripe-billing/media/L01.jpg", bytes: 52971, sha256: "54bca6b4d938204ad38098047f2705cddc11adf022fd03d664a410c1e43b6bd8", type: "image/jpeg" }, { url: "nudge-product/media/N01.jpg", bytes: 33277, sha256: "9ea9ea3119b3c5366e71b1ad77b5db66b2c909fb01c4ea2ea5f5eaef1cb09018", type: "image/jpeg" }, { url: "uiux-engineers/media/D01.jpg", bytes: 34406, sha256: "77ed8d233706c0b2fb41966ec5f3250ae5f646300ee236ab08d9e2371cd025c5", type: "image/jpeg" }, { url: "indie-marketing/media/M01.jpg", bytes: 39009, sha256: "3f567ff0fa3dd0f86e7633064c5280a97104a49fde11edc05da8b7e948471bf2", type: "image/jpeg" }, { url: "nudge-comedy/media/W01.jpg", bytes: 45657, sha256: "9fa9dcc17057e14ff42fb1bd91e5c4ed4fbf38ce9a3fdd1a9314c7635a7fb44b", type: "image/jpeg" }, { url: "rive-comedy/media/R01.jpg", bytes: 42648, sha256: "8d999782bb4ffd692cc6c4ebd36e22fc6dd7aea53751eea80571d9af2721c662", type: "image/jpeg" }, { url: "pstack-comedy/media/P01.jpg", bytes: 31217, sha256: "ef8a88245e6481acd2f0830661616e0537a532d239c3802972791c3b1359d87c", type: "image/jpeg" }, { url: "superagent-comedy/media/S01.jpg", bytes: 41057, sha256: "9f59e052c7a90e7b69f3b3cdf6f1855c1bc0474a030a70afe7722d9136c5d3b5", type: "image/jpeg" }, { url: "icons/icon-180.png", bytes: 523, sha256: "d6105a3fcfae6bac6467e488f3f201c741ecdf0af5d513703cc230a0ed393e7e", type: "image/png" }, { url: "icons/icon-192.png", bytes: 601, sha256: "9ccb4b347be39b647476552be86cfbbf9240e3932eb33d43df6517a595c4e471", type: "image/png" }, { url: "icons/icon-512.png", bytes: 3661, sha256: "d4ed7cd03741d9313f72b18e3205ac0b9339c12a86f7dabc9708c8167efdc8af", type: "image/png" }, { url: "manifest.webmanifest", bytes: 586, sha256: "bbd840f9654b92d9d0170d1974905c1569571d5544069fb12d8c79bd315b8a49", type: "application/manifest+json" }, { url: "offline.html", bytes: 1541, sha256: "4cccdcadba2e71c9ab143a165d9e0e355d55f263b8f7e22c0a23b00641d5b874", type: "text/html" }], mediaRoots: {} }.mediaRoots).map(([lang, root]) => [lang, new URL(root, scope).href]));
var MESSAGES = {
  ja: {
    manifest: "保存用の教材情報を確認できません。オンラインで再読み込みしてください。",
    format: "保存対象の形式が不正です。",
    origin: "このサイトの公開教材だけ保存できます。",
    page: "教材ページの形式が不正です。",
    media: "保存対象は公開 MP4 とポスターに限ります。",
    incomplete: "保存対象がそろっていません。",
    unpublished: "この講座の更新情報は公開されていません。",
    fetchManifest: "教材情報を取得できません。通信を確認して再試行してください。",
    tooLarge: "教材情報が大きすぎます。",
    integrity: "教材情報の整合性を確認できません。",
    fetchFile: "教材を取得できません。一部取得や別形式の応答は保存しません。",
    changed: "教材のサイズが変わりました。更新を確認して再試行してください。",
    corrupt: "教材が不完全か、公開中に更新されました。通信を確認して再試行してください。",
    quota: "保存用の空き容量が不足しています。",
    busy: "別の保存・削除を処理中です。完了してから再試行してください。",
    busyDelete: "保存・削除が処理中です。キャンセルか完了の後に削除してください。",
    verify: "保存した教材を確認できません。再試行してください。",
    cancelled: "保存をキャンセルしました。未完了のデータは保存済みになりません。",
    noSpace: "空き容量が不足しています。不要な保存を削除して再試行してください。",
    pick: "講座を選んでください。",
    unknownOp: "対応していない操作です。",
    storage: "保存場所を利用できません。ブラウザの設定を確認してください。",
    timeout: "通信が時間切れになりました。再試行してください。"
  },
  en: {
    manifest: "Cannot read the course data for saving. Reload while online.",
    format: "The files to save are in an invalid format.",
    origin: "Only course materials published on this site can be saved.",
    page: "The course page is in an invalid format.",
    media: "Only the published MP4 videos and posters can be saved.",
    incomplete: "The files to save are incomplete.",
    unpublished: "Update information for this course is not published.",
    fetchManifest: "Cannot get the course data. Check your connection and retry.",
    tooLarge: "The course data is too large.",
    integrity: "Cannot verify the course data.",
    fetchFile: "Cannot get a course file. Partial or unexpected responses are not saved.",
    changed: "A course file changed size. Check for updates and retry.",
    corrupt: "A course file was incomplete or updated while being published. Check your connection and retry.",
    quota: "Not enough free space to save.",
    busy: "Another save or delete is in progress. Retry after it finishes.",
    busyDelete: "A save or delete is in progress. Delete after it is cancelled or finished.",
    verify: "Cannot verify the saved files. Please retry.",
    cancelled: "Saving was cancelled. Unfinished data is not marked as saved.",
    noSpace: "Not enough free space. Delete saved courses you do not need and retry.",
    pick: "Choose a course.",
    unknownOp: "This operation is not supported.",
    storage: "Storage is not available. Check your browser settings.",
    timeout: "The connection timed out. Please retry."
  },
  zh: {
    manifest: "无法确认用于保存的课程信息。请在联网时重新加载。",
    format: "要保存的文件格式不正确。",
    origin: "只能保存本网站公开的课程材料。",
    page: "课程页面的格式不正确。",
    media: "只能保存公开的 MP4 视频和封面。",
    incomplete: "要保存的文件不完整。",
    unpublished: "本课程的更新信息未公开。",
    fetchManifest: "无法获取课程信息。请检查网络后重试。",
    tooLarge: "课程信息太大。",
    integrity: "无法确认课程信息的完整性。",
    fetchFile: "无法获取课程文件。不会保存部分内容或格式不符的响应。",
    changed: "课程文件的大小变了。请检查更新后重试。",
    corrupt: "课程文件不完整，或在发布过程中被更新。请检查网络后重试。",
    quota: "保存所需的空闲空间不足。",
    busy: "正在处理其他保存或删除。请等完成后重试。",
    busyDelete: "正在保存或删除。请在取消或完成后再删除。",
    verify: "无法确认保存的文件。请重试。",
    cancelled: "已取消保存。未完成的数据不会算作已保存。",
    noSpace: "空闲空间不足。请删除不需要的保存后重试。",
    pick: "请选择课程。",
    unknownOp: "不支持此操作。",
    storage: "无法使用存储空间。请检查浏览器设置。",
    timeout: "网络超时。请重试。"
  }
};
var messageOf = (e, lang) => {
  const m = MESSAGES[lang] ?? MESSAGES.ja;
  if (e instanceof OfflineError)
    return m[e.code];
  if (e instanceof DOMException && e.name === "TimeoutError")
    return m.timeout;
  return m.storage;
};
async function readRecord(id) {
  const res = await (await caches.open(registryName)).match(recordUrl(id));
  if (!res)
    return { versions: [] };
  try {
    const r = await res.json();
    if (!Array.isArray(r.versions) || r.versions.length > 2)
      throw new Error;
    for (const v of r.versions) {
      validateManifest(v.manifest, id, scope, { build: "7b0165f71bd2a6d0d1a98b786811dd28e05c1497d779722f68bf32d7b3b86cf3", courses: ["stripe-billing", "nudge-product", "uiux-engineers", "indie-marketing", "nudge-comedy", "rive-comedy", "pstack-comedy", "superagent-comedy"], shell: [{ url: "./", bytes: 59650, sha256: "8568e7af567deec1d23d3149ec5f635227312cd5e66f02be1be8160e1ee7cc25", type: "text/html" }, { url: "assets/hero.jpg", bytes: 55314, sha256: "6de83717c75dee7fde8f03d5b06c6b21d4bb965a26b07d879d5922f8ef240541", type: "image/jpeg" }, { url: "assets/themes/chalkfile.jpg", bytes: 47585, sha256: "1b65c3328bd467f3bc265311c86eb0385dda635b60546093e8f8c8aeb39dabb0", type: "image/jpeg" }, { url: "assets/themes/indigo.jpg", bytes: 55314, sha256: "6de83717c75dee7fde8f03d5b06c6b21d4bb965a26b07d879d5922f8ef240541", type: "image/jpeg" }, { url: "assets/themes/stage.jpg", bytes: 48558, sha256: "ed59b98bbbf287d7653761f1ff4370e744be84f2be878d4dd1150920d3094c6c", type: "image/jpeg" }, { url: "assets/themes/night.jpg", bytes: 52859, sha256: "88c8ec836f17fe4c74a5f396f5ee3ffa53efbe37164a1b56a2ceff156a351f36", type: "image/jpeg" }, { url: "stripe-billing/media/L01.jpg", bytes: 52971, sha256: "54bca6b4d938204ad38098047f2705cddc11adf022fd03d664a410c1e43b6bd8", type: "image/jpeg" }, { url: "nudge-product/media/N01.jpg", bytes: 33277, sha256: "9ea9ea3119b3c5366e71b1ad77b5db66b2c909fb01c4ea2ea5f5eaef1cb09018", type: "image/jpeg" }, { url: "uiux-engineers/media/D01.jpg", bytes: 34406, sha256: "77ed8d233706c0b2fb41966ec5f3250ae5f646300ee236ab08d9e2371cd025c5", type: "image/jpeg" }, { url: "indie-marketing/media/M01.jpg", bytes: 39009, sha256: "3f567ff0fa3dd0f86e7633064c5280a97104a49fde11edc05da8b7e948471bf2", type: "image/jpeg" }, { url: "nudge-comedy/media/W01.jpg", bytes: 45657, sha256: "9fa9dcc17057e14ff42fb1bd91e5c4ed4fbf38ce9a3fdd1a9314c7635a7fb44b", type: "image/jpeg" }, { url: "rive-comedy/media/R01.jpg", bytes: 42648, sha256: "8d999782bb4ffd692cc6c4ebd36e22fc6dd7aea53751eea80571d9af2721c662", type: "image/jpeg" }, { url: "pstack-comedy/media/P01.jpg", bytes: 31217, sha256: "ef8a88245e6481acd2f0830661616e0537a532d239c3802972791c3b1359d87c", type: "image/jpeg" }, { url: "superagent-comedy/media/S01.jpg", bytes: 41057, sha256: "9f59e052c7a90e7b69f3b3cdf6f1855c1bc0474a030a70afe7722d9136c5d3b5", type: "image/jpeg" }, { url: "icons/icon-180.png", bytes: 523, sha256: "d6105a3fcfae6bac6467e488f3f201c741ecdf0af5d513703cc230a0ed393e7e", type: "image/png" }, { url: "icons/icon-192.png", bytes: 601, sha256: "9ccb4b347be39b647476552be86cfbbf9240e3932eb33d43df6517a595c4e471", type: "image/png" }, { url: "icons/icon-512.png", bytes: 3661, sha256: "d4ed7cd03741d9313f72b18e3205ac0b9339c12a86f7dabc9708c8167efdc8af", type: "image/png" }, { url: "manifest.webmanifest", bytes: 586, sha256: "bbd840f9654b92d9d0170d1974905c1569571d5544069fb12d8c79bd315b8a49", type: "application/manifest+json" }, { url: "offline.html", bytes: 1541, sha256: "4cccdcadba2e71c9ab143a165d9e0e355d55f263b8f7e22c0a23b00641d5b874", type: "text/html" }], mediaRoots: {} }.mediaRoots);
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
  const saved = keys.map((r) => {
    try {
      return decodeURIComponent(new URL(r.url).pathname.split("/").pop());
    } catch {
      return "";
    }
  });
  return [...new Set([...{ build: "7b0165f71bd2a6d0d1a98b786811dd28e05c1497d779722f68bf32d7b3b86cf3", courses: ["stripe-billing", "nudge-product", "uiux-engineers", "indie-marketing", "nudge-comedy", "rive-comedy", "pstack-comedy", "superagent-comedy"], shell: [{ url: "./", bytes: 59650, sha256: "8568e7af567deec1d23d3149ec5f635227312cd5e66f02be1be8160e1ee7cc25", type: "text/html" }, { url: "assets/hero.jpg", bytes: 55314, sha256: "6de83717c75dee7fde8f03d5b06c6b21d4bb965a26b07d879d5922f8ef240541", type: "image/jpeg" }, { url: "assets/themes/chalkfile.jpg", bytes: 47585, sha256: "1b65c3328bd467f3bc265311c86eb0385dda635b60546093e8f8c8aeb39dabb0", type: "image/jpeg" }, { url: "assets/themes/indigo.jpg", bytes: 55314, sha256: "6de83717c75dee7fde8f03d5b06c6b21d4bb965a26b07d879d5922f8ef240541", type: "image/jpeg" }, { url: "assets/themes/stage.jpg", bytes: 48558, sha256: "ed59b98bbbf287d7653761f1ff4370e744be84f2be878d4dd1150920d3094c6c", type: "image/jpeg" }, { url: "assets/themes/night.jpg", bytes: 52859, sha256: "88c8ec836f17fe4c74a5f396f5ee3ffa53efbe37164a1b56a2ceff156a351f36", type: "image/jpeg" }, { url: "stripe-billing/media/L01.jpg", bytes: 52971, sha256: "54bca6b4d938204ad38098047f2705cddc11adf022fd03d664a410c1e43b6bd8", type: "image/jpeg" }, { url: "nudge-product/media/N01.jpg", bytes: 33277, sha256: "9ea9ea3119b3c5366e71b1ad77b5db66b2c909fb01c4ea2ea5f5eaef1cb09018", type: "image/jpeg" }, { url: "uiux-engineers/media/D01.jpg", bytes: 34406, sha256: "77ed8d233706c0b2fb41966ec5f3250ae5f646300ee236ab08d9e2371cd025c5", type: "image/jpeg" }, { url: "indie-marketing/media/M01.jpg", bytes: 39009, sha256: "3f567ff0fa3dd0f86e7633064c5280a97104a49fde11edc05da8b7e948471bf2", type: "image/jpeg" }, { url: "nudge-comedy/media/W01.jpg", bytes: 45657, sha256: "9fa9dcc17057e14ff42fb1bd91e5c4ed4fbf38ce9a3fdd1a9314c7635a7fb44b", type: "image/jpeg" }, { url: "rive-comedy/media/R01.jpg", bytes: 42648, sha256: "8d999782bb4ffd692cc6c4ebd36e22fc6dd7aea53751eea80571d9af2721c662", type: "image/jpeg" }, { url: "pstack-comedy/media/P01.jpg", bytes: 31217, sha256: "ef8a88245e6481acd2f0830661616e0537a532d239c3802972791c3b1359d87c", type: "image/jpeg" }, { url: "superagent-comedy/media/S01.jpg", bytes: 41057, sha256: "9f59e052c7a90e7b69f3b3cdf6f1855c1bc0474a030a70afe7722d9136c5d3b5", type: "image/jpeg" }, { url: "icons/icon-180.png", bytes: 523, sha256: "d6105a3fcfae6bac6467e488f3f201c741ecdf0af5d513703cc230a0ed393e7e", type: "image/png" }, { url: "icons/icon-192.png", bytes: 601, sha256: "9ccb4b347be39b647476552be86cfbbf9240e3932eb33d43df6517a595c4e471", type: "image/png" }, { url: "icons/icon-512.png", bytes: 3661, sha256: "d4ed7cd03741d9313f72b18e3205ac0b9339c12a86f7dabc9708c8167efdc8af", type: "image/png" }, { url: "manifest.webmanifest", bytes: 586, sha256: "bbd840f9654b92d9d0170d1974905c1569571d5544069fb12d8c79bd315b8a49", type: "application/manifest+json" }, { url: "offline.html", bytes: 1541, sha256: "4cccdcadba2e71c9ab143a165d9e0e355d55f263b8f7e22c0a23b00641d5b874", type: "text/html" }], mediaRoots: {} }.courses, ...saved.filter((id) => COURSE_ID.test(id))])];
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
  if (!{ build: "7b0165f71bd2a6d0d1a98b786811dd28e05c1497d779722f68bf32d7b3b86cf3", courses: ["stripe-billing", "nudge-product", "uiux-engineers", "indie-marketing", "nudge-comedy", "rive-comedy", "pstack-comedy", "superagent-comedy"], shell: [{ url: "./", bytes: 59650, sha256: "8568e7af567deec1d23d3149ec5f635227312cd5e66f02be1be8160e1ee7cc25", type: "text/html" }, { url: "assets/hero.jpg", bytes: 55314, sha256: "6de83717c75dee7fde8f03d5b06c6b21d4bb965a26b07d879d5922f8ef240541", type: "image/jpeg" }, { url: "assets/themes/chalkfile.jpg", bytes: 47585, sha256: "1b65c3328bd467f3bc265311c86eb0385dda635b60546093e8f8c8aeb39dabb0", type: "image/jpeg" }, { url: "assets/themes/indigo.jpg", bytes: 55314, sha256: "6de83717c75dee7fde8f03d5b06c6b21d4bb965a26b07d879d5922f8ef240541", type: "image/jpeg" }, { url: "assets/themes/stage.jpg", bytes: 48558, sha256: "ed59b98bbbf287d7653761f1ff4370e744be84f2be878d4dd1150920d3094c6c", type: "image/jpeg" }, { url: "assets/themes/night.jpg", bytes: 52859, sha256: "88c8ec836f17fe4c74a5f396f5ee3ffa53efbe37164a1b56a2ceff156a351f36", type: "image/jpeg" }, { url: "stripe-billing/media/L01.jpg", bytes: 52971, sha256: "54bca6b4d938204ad38098047f2705cddc11adf022fd03d664a410c1e43b6bd8", type: "image/jpeg" }, { url: "nudge-product/media/N01.jpg", bytes: 33277, sha256: "9ea9ea3119b3c5366e71b1ad77b5db66b2c909fb01c4ea2ea5f5eaef1cb09018", type: "image/jpeg" }, { url: "uiux-engineers/media/D01.jpg", bytes: 34406, sha256: "77ed8d233706c0b2fb41966ec5f3250ae5f646300ee236ab08d9e2371cd025c5", type: "image/jpeg" }, { url: "indie-marketing/media/M01.jpg", bytes: 39009, sha256: "3f567ff0fa3dd0f86e7633064c5280a97104a49fde11edc05da8b7e948471bf2", type: "image/jpeg" }, { url: "nudge-comedy/media/W01.jpg", bytes: 45657, sha256: "9fa9dcc17057e14ff42fb1bd91e5c4ed4fbf38ce9a3fdd1a9314c7635a7fb44b", type: "image/jpeg" }, { url: "rive-comedy/media/R01.jpg", bytes: 42648, sha256: "8d999782bb4ffd692cc6c4ebd36e22fc6dd7aea53751eea80571d9af2721c662", type: "image/jpeg" }, { url: "pstack-comedy/media/P01.jpg", bytes: 31217, sha256: "ef8a88245e6481acd2f0830661616e0537a532d239c3802972791c3b1359d87c", type: "image/jpeg" }, { url: "superagent-comedy/media/S01.jpg", bytes: 41057, sha256: "9f59e052c7a90e7b69f3b3cdf6f1855c1bc0474a030a70afe7722d9136c5d3b5", type: "image/jpeg" }, { url: "icons/icon-180.png", bytes: 523, sha256: "d6105a3fcfae6bac6467e488f3f201c741ecdf0af5d513703cc230a0ed393e7e", type: "image/png" }, { url: "icons/icon-192.png", bytes: 601, sha256: "9ccb4b347be39b647476552be86cfbbf9240e3932eb33d43df6517a595c4e471", type: "image/png" }, { url: "icons/icon-512.png", bytes: 3661, sha256: "d4ed7cd03741d9313f72b18e3205ac0b9339c12a86f7dabc9708c8167efdc8af", type: "image/png" }, { url: "manifest.webmanifest", bytes: 586, sha256: "bbd840f9654b92d9d0170d1974905c1569571d5544069fb12d8c79bd315b8a49", type: "application/manifest+json" }, { url: "offline.html", bytes: 1541, sha256: "4cccdcadba2e71c9ab143a165d9e0e355d55f263b8f7e22c0a23b00641d5b874", type: "text/html" }], mediaRoots: {} }.courses.includes(id))
    throw new OfflineError("unpublished");
  let r;
  let text;
  try {
    r = await fetch(new URL(`${id}/offline-manifest.json`, scope), {
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      signal: AbortSignal.timeout(15000)
    });
    if (r.status !== 200 || !r.headers.get("Content-Type")?.includes("application/json"))
      throw new OfflineError("fetchManifest");
    text = await r.text();
  } catch (e) {
    if (e instanceof OfflineError)
      throw e;
    throw new OfflineError(e instanceof DOMException && e.name === "TimeoutError" ? "timeout" : "fetchManifest");
  }
  if (text.length > 1e5)
    throw new OfflineError("tooLarge");
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new OfflineError("manifest");
  }
  const m = validateManifest(parsed, id, scope, { build: "7b0165f71bd2a6d0d1a98b786811dd28e05c1497d779722f68bf32d7b3b86cf3", courses: ["stripe-billing", "nudge-product", "uiux-engineers", "indie-marketing", "nudge-comedy", "rive-comedy", "pstack-comedy", "superagent-comedy"], shell: [{ url: "./", bytes: 59650, sha256: "8568e7af567deec1d23d3149ec5f635227312cd5e66f02be1be8160e1ee7cc25", type: "text/html" }, { url: "assets/hero.jpg", bytes: 55314, sha256: "6de83717c75dee7fde8f03d5b06c6b21d4bb965a26b07d879d5922f8ef240541", type: "image/jpeg" }, { url: "assets/themes/chalkfile.jpg", bytes: 47585, sha256: "1b65c3328bd467f3bc265311c86eb0385dda635b60546093e8f8c8aeb39dabb0", type: "image/jpeg" }, { url: "assets/themes/indigo.jpg", bytes: 55314, sha256: "6de83717c75dee7fde8f03d5b06c6b21d4bb965a26b07d879d5922f8ef240541", type: "image/jpeg" }, { url: "assets/themes/stage.jpg", bytes: 48558, sha256: "ed59b98bbbf287d7653761f1ff4370e744be84f2be878d4dd1150920d3094c6c", type: "image/jpeg" }, { url: "assets/themes/night.jpg", bytes: 52859, sha256: "88c8ec836f17fe4c74a5f396f5ee3ffa53efbe37164a1b56a2ceff156a351f36", type: "image/jpeg" }, { url: "stripe-billing/media/L01.jpg", bytes: 52971, sha256: "54bca6b4d938204ad38098047f2705cddc11adf022fd03d664a410c1e43b6bd8", type: "image/jpeg" }, { url: "nudge-product/media/N01.jpg", bytes: 33277, sha256: "9ea9ea3119b3c5366e71b1ad77b5db66b2c909fb01c4ea2ea5f5eaef1cb09018", type: "image/jpeg" }, { url: "uiux-engineers/media/D01.jpg", bytes: 34406, sha256: "77ed8d233706c0b2fb41966ec5f3250ae5f646300ee236ab08d9e2371cd025c5", type: "image/jpeg" }, { url: "indie-marketing/media/M01.jpg", bytes: 39009, sha256: "3f567ff0fa3dd0f86e7633064c5280a97104a49fde11edc05da8b7e948471bf2", type: "image/jpeg" }, { url: "nudge-comedy/media/W01.jpg", bytes: 45657, sha256: "9fa9dcc17057e14ff42fb1bd91e5c4ed4fbf38ce9a3fdd1a9314c7635a7fb44b", type: "image/jpeg" }, { url: "rive-comedy/media/R01.jpg", bytes: 42648, sha256: "8d999782bb4ffd692cc6c4ebd36e22fc6dd7aea53751eea80571d9af2721c662", type: "image/jpeg" }, { url: "pstack-comedy/media/P01.jpg", bytes: 31217, sha256: "ef8a88245e6481acd2f0830661616e0537a532d239c3802972791c3b1359d87c", type: "image/jpeg" }, { url: "superagent-comedy/media/S01.jpg", bytes: 41057, sha256: "9f59e052c7a90e7b69f3b3cdf6f1855c1bc0474a030a70afe7722d9136c5d3b5", type: "image/jpeg" }, { url: "icons/icon-180.png", bytes: 523, sha256: "d6105a3fcfae6bac6467e488f3f201c741ecdf0af5d513703cc230a0ed393e7e", type: "image/png" }, { url: "icons/icon-192.png", bytes: 601, sha256: "9ccb4b347be39b647476552be86cfbbf9240e3932eb33d43df6517a595c4e471", type: "image/png" }, { url: "icons/icon-512.png", bytes: 3661, sha256: "d4ed7cd03741d9313f72b18e3205ac0b9339c12a86f7dabc9708c8167efdc8af", type: "image/png" }, { url: "manifest.webmanifest", bytes: 586, sha256: "bbd840f9654b92d9d0170d1974905c1569571d5544069fb12d8c79bd315b8a49", type: "application/manifest+json" }, { url: "offline.html", bytes: 1541, sha256: "4cccdcadba2e71c9ab143a165d9e0e355d55f263b8f7e22c0a23b00641d5b874", type: "text/html" }], mediaRoots: {} }.mediaRoots);
  if (await sha256(new TextEncoder().encode(JSON.stringify(m.files)).buffer) !== m.revision)
    throw new OfflineError("integrity");
  return m;
}
async function download(f, signal, onBytes) {
  const failed = (e) => signal.aborted ? signal.reason ?? e : e instanceof OfflineError ? e : new OfflineError("fetchFile");
  let res;
  try {
    res = await fetch(assetUrl(f), { cache: "no-store", credentials: "omit", redirect: "error", signal });
  } catch (e) {
    throw failed(e);
  }
  if (res.status !== 200 || !res.body || res.type === "opaque" || res.headers.get("Content-Type")?.split(";")[0].trim() !== f.type) {
    throw new OfflineError("fetchFile");
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
        throw new OfflineError("changed");
      data.set(value, length - value.byteLength);
      onBytes(value.byteLength);
    }
  } catch (e) {
    await reader.cancel().catch(() => {});
    throw failed(e);
  }
  if (length !== f.bytes || await sha256(data.buffer) !== f.sha256)
    throw new OfflineError("corrupt");
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
    throw new OfflineError("busy");
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
        throw new DOMException("quota", "QuotaExceededError");
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
        const timeout = setTimeout(() => controller.abort(new OfflineError("timeout")), 120000);
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
        throw new OfflineError("verify");
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
        throw new OfflineError("cancelled");
      if (e instanceof DOMException && e.name === "QuotaExceededError")
        throw new OfflineError("noSpace");
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
    throw new OfflineError("busyDelete");
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
    for (const f of { build: "7b0165f71bd2a6d0d1a98b786811dd28e05c1497d779722f68bf32d7b3b86cf3", courses: ["stripe-billing", "nudge-product", "uiux-engineers", "indie-marketing", "nudge-comedy", "rive-comedy", "pstack-comedy", "superagent-comedy"], shell: [{ url: "./", bytes: 59650, sha256: "8568e7af567deec1d23d3149ec5f635227312cd5e66f02be1be8160e1ee7cc25", type: "text/html" }, { url: "assets/hero.jpg", bytes: 55314, sha256: "6de83717c75dee7fde8f03d5b06c6b21d4bb965a26b07d879d5922f8ef240541", type: "image/jpeg" }, { url: "assets/themes/chalkfile.jpg", bytes: 47585, sha256: "1b65c3328bd467f3bc265311c86eb0385dda635b60546093e8f8c8aeb39dabb0", type: "image/jpeg" }, { url: "assets/themes/indigo.jpg", bytes: 55314, sha256: "6de83717c75dee7fde8f03d5b06c6b21d4bb965a26b07d879d5922f8ef240541", type: "image/jpeg" }, { url: "assets/themes/stage.jpg", bytes: 48558, sha256: "ed59b98bbbf287d7653761f1ff4370e744be84f2be878d4dd1150920d3094c6c", type: "image/jpeg" }, { url: "assets/themes/night.jpg", bytes: 52859, sha256: "88c8ec836f17fe4c74a5f396f5ee3ffa53efbe37164a1b56a2ceff156a351f36", type: "image/jpeg" }, { url: "stripe-billing/media/L01.jpg", bytes: 52971, sha256: "54bca6b4d938204ad38098047f2705cddc11adf022fd03d664a410c1e43b6bd8", type: "image/jpeg" }, { url: "nudge-product/media/N01.jpg", bytes: 33277, sha256: "9ea9ea3119b3c5366e71b1ad77b5db66b2c909fb01c4ea2ea5f5eaef1cb09018", type: "image/jpeg" }, { url: "uiux-engineers/media/D01.jpg", bytes: 34406, sha256: "77ed8d233706c0b2fb41966ec5f3250ae5f646300ee236ab08d9e2371cd025c5", type: "image/jpeg" }, { url: "indie-marketing/media/M01.jpg", bytes: 39009, sha256: "3f567ff0fa3dd0f86e7633064c5280a97104a49fde11edc05da8b7e948471bf2", type: "image/jpeg" }, { url: "nudge-comedy/media/W01.jpg", bytes: 45657, sha256: "9fa9dcc17057e14ff42fb1bd91e5c4ed4fbf38ce9a3fdd1a9314c7635a7fb44b", type: "image/jpeg" }, { url: "rive-comedy/media/R01.jpg", bytes: 42648, sha256: "8d999782bb4ffd692cc6c4ebd36e22fc6dd7aea53751eea80571d9af2721c662", type: "image/jpeg" }, { url: "pstack-comedy/media/P01.jpg", bytes: 31217, sha256: "ef8a88245e6481acd2f0830661616e0537a532d239c3802972791c3b1359d87c", type: "image/jpeg" }, { url: "superagent-comedy/media/S01.jpg", bytes: 41057, sha256: "9f59e052c7a90e7b69f3b3cdf6f1855c1bc0474a030a70afe7722d9136c5d3b5", type: "image/jpeg" }, { url: "icons/icon-180.png", bytes: 523, sha256: "d6105a3fcfae6bac6467e488f3f201c741ecdf0af5d513703cc230a0ed393e7e", type: "image/png" }, { url: "icons/icon-192.png", bytes: 601, sha256: "9ccb4b347be39b647476552be86cfbbf9240e3932eb33d43df6517a595c4e471", type: "image/png" }, { url: "icons/icon-512.png", bytes: 3661, sha256: "d4ed7cd03741d9313f72b18e3205ac0b9339c12a86f7dabc9708c8167efdc8af", type: "image/png" }, { url: "manifest.webmanifest", bytes: 586, sha256: "bbd840f9654b92d9d0170d1974905c1569571d5544069fb12d8c79bd315b8a49", type: "application/manifest+json" }, { url: "offline.html", bytes: 1541, sha256: "4cccdcadba2e71c9ab143a165d9e0e355d55f263b8f7e22c0a23b00641d5b874", type: "text/html" }], mediaRoots: {} }.shell)
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
          throw new OfflineError("pick");
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
          throw new OfflineError("unknownOp");
      }
    } catch (e) {
      port.postMessage({ ok: false, error: messageOf(e, typeof data.lang === "string" ? data.lang : "ja") });
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
function courseIdOf(url) {
  for (const [lang, root] of Object.entries(mediaRoots)) {
    if (url.href.startsWith(root)) {
      const relative2 = url.pathname.slice(new URL(root).pathname.length);
      return { id: `${lang}/${relative2.split("/")[0]}`, relative: relative2, media: true };
    }
  }
  const relative = url.pathname.slice(new URL(scope).pathname.length);
  const parts = relative.split("/");
  const id = /^[a-z]{2}$/.test(parts[0]) && parts.length > 1 && parts[1] ? `${parts[0]}/${parts[1]}` : parts[0];
  return { id, relative, media: false };
}
async function route(req) {
  const url = new URL(req.url);
  const { id, relative, media } = courseIdOf(url);
  if (req.mode === "navigate" && !media && relative && COURSE_ID.test(relative))
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
    if (record.versions.length && (media || relative.includes("/media/")) && url.searchParams.has("v")) {
      return new Response("この保存版の動画は利用できません。講座を再読み込みし、オンラインで保存し直してください。 / This saved video is not available. Reload the course and save it again online.", { status: 503 });
    }
  }
  try {
    const response = await fetch(req);
    if (response.ok || req.mode !== "navigate")
      return response;
  } catch {}
  const shell = await caches.open(shellName);
  const key = !media && (!relative || relative === "index.html") ? scope : url.href;
  const cached = await shell.match(key);
  if (cached)
    return cachedResponse(req, cached);
  if (req.mode === "navigate") {
    const fallback = await shell.match(new URL("offline.html", scope).href);
    if (fallback)
      return new Response((await fallback.text()).replaceAll("__ROOT__", new URL(scope).pathname), { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  return new Response("オフラインです。この教材はアプリ内に保存されていません。 / Offline. This file is not saved in the app.", { status: 503 });
}
sw.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const mine = url.href.startsWith(scope) || Object.values(mediaRoots).some((root) => url.href.startsWith(root));
  if (url.origin !== new URL(scope).origin || !mine || !["GET", "HEAD"].includes(event.request.method))
    return;
  event.respondWith(route(event.request));
});
