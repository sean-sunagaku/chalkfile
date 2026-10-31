// 保存対象は、このサイトが生成した公開教材と MP4・ポスターだけ。
export type Asset = { url: string; bytes: number; sha256: string; type: string };
export type CourseManifest = {
  schema: 1;
  id: string;
  title: string;
  pageVersion: string;
  revision: string;
  bytes: number;
  files: Asset[];
};
export type SavedVersion = { cache: string; manifest: CourseManifest; savedAt: string };
export type DownloadProgress = { id: string; loaded: number; total: number; file: number; count: number };
export type CourseStatus = {
  id: string;
  saved: SavedVersion | null;
  incomplete: boolean;
  progress: DownloadProgress | null;
};
export const COURSE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const HASH = /^[a-f0-9]{64}$/;
export const MAX_FILE_BYTES = 32 * 1024 * 1024;

export function validateManifest(value: unknown, id: string, scope: string): CourseManifest {
  const m = value as CourseManifest;
  if (!m || m.schema !== 1 || !COURSE_ID.test(id) || m.id !== id || typeof m.title !== 'string' || m.title.length > 300 ||
      !HASH.test(m.pageVersion) || !HASH.test(m.revision) || !Array.isArray(m.files) || m.files.length < 3 || m.files.length > 201) {
    throw new Error('保存用の教材情報を確認できません。オンラインで再読み込みしてください。');
  }
  const urls = new Set<string>();
  let bytes = 0;
  const media = new Map<string, Set<string>>();
  for (const f of m.files) {
    if (!f || typeof f.url !== 'string' || urls.has(f.url) || !HASH.test(f.sha256) ||
        !Number.isSafeInteger(f.bytes) || f.bytes <= 0 || f.bytes > MAX_FILE_BYTES) throw new Error('保存対象の形式が不正です。');
    urls.add(f.url);
    const url = new URL(f.url, scope);
    if (url.origin !== new URL(scope).origin || !url.href.startsWith(scope) || url.hash || url.username || url.password) {
      throw new Error('このサイトの公開教材だけ保存できます。');
    }
    if (f.url === `${id}/`) {
      if (f.type !== 'text/html' || f.bytes > 4 * 1024 * 1024) throw new Error('教材ページの形式が不正です。');
    } else {
      const match = /^([A-Za-z0-9][A-Za-z0-9_-]*)\/media\/([A-Za-z0-9][A-Za-z0-9_-]*)\.(mp4|jpg)\?v=([a-f0-9]{64})$/.exec(f.url);
      if (!match || match[1] !== id || match[4] !== m.pageVersion || f.type !== (match[3] === 'mp4' ? 'video/mp4' : 'image/jpeg')) {
        throw new Error('保存対象は公開 MP4 とポスターに限ります。');
      }
      const types = media.get(match[2]) ?? new Set<string>();
      types.add(match[3]);
      media.set(match[2], types);
    }
    bytes += f.bytes;
  }
  if (!urls.has(`${id}/`) || media.size === 0 || [...media.values()].some((x) => x.size !== 2) ||
      bytes !== m.bytes || bytes > 1024 * 1024 * 1024) throw new Error('保存対象がそろっていません。');
  return m;
}

export async function sha256(data: ArrayBuffer): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), (x) => x.toString(16).padStart(2, '0')).join('');
}

export type ByteRange = { kind: 'full' } | { kind: 'partial'; start: number; end: number } | { kind: 'unsatisfiable' };
// 複数 Range と未知の単位は無視して 200。対応する単一 bytes Range は 206 / 416。
export function byteRange(header: string | null, size: number): ByteRange {
  if (!header || !header.startsWith('bytes=') || header.includes(',')) return { kind: 'full' };
  const m = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!m || (!m[1] && !m[2])) return { kind: 'full' };
  const a = m[1] ? Number(m[1]) : null;
  const b = m[2] ? Number(m[2]) : null;
  if ((a !== null && !Number.isSafeInteger(a)) || (b !== null && !Number.isSafeInteger(b)) || size === 0) return { kind: 'unsatisfiable' };
  const start = a ?? Math.max(0, size - b!);
  const end = a === null || b === null ? size - 1 : Math.min(b, size - 1);
  if (start >= size || start > end || (a === null && b === 0)) return { kind: 'unsatisfiable' };
  return { kind: 'partial', start, end };
}
