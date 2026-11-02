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
/** 講座の ID。訳の講座は言語を頭に付ける（en/superagent-comedy）。日本語の講座は付けない */
export const COURSE_ID = /^(?:[a-z]{2}\/)?[A-Za-z0-9][A-Za-z0-9_-]*$/;
const HASH = /^[a-f0-9]{64}$/;
export const MAX_FILE_BYTES = 32 * 1024 * 1024;
/** 動画とポスターの名前。S01・S01.cc（字幕を焼き込んだ版）・S01.en・S01.en.cc（言語の 2 文字は cc にしない） */
const MEDIA_NAME = '([A-Za-z0-9][A-Za-z0-9_-]*(?:\\.(?!cc\\.)[a-z]{2})?)(\\.cc)?\\.(mp4|jpg)';

/** 保存できないものを見つけたときのエラー。code は保存機能の文字（site/sw.ts の MESSAGES）を選ぶ */
export type OfflineErrorCode =
  | 'manifest' | 'format' | 'origin' | 'page' | 'media' | 'incomplete' | 'unpublished' | 'fetchManifest' | 'tooLarge' | 'integrity'
  | 'fetchFile' | 'changed' | 'corrupt' | 'quota' | 'busy' | 'busyDelete' | 'verify' | 'cancelled' | 'noSpace' | 'pick' | 'unknownOp' | 'storage' | 'timeout';
export class OfflineError extends Error {
  constructor(readonly code: OfflineErrorCode) {
    super(code);
  }
}

/**
 * 保存用の教材情報を確かめる。scope はアプリの場所（例: https://…/chalkfile/）。
 * mediaRoots は、訳の言語の動画を置く別のサイトの場所（言語 → URL。同じ origin のときだけ使える）。
 * 動画は、講座の media/ の下か、その言語の mediaRoots の <講座>/ の下だけ。どのレクチャーも動画とポスターがそろっていること（字幕を焼き込んだ版はあってもなくてもよい）
 */
export function validateManifest(value: unknown, id: string, scope: string, mediaRoots: Record<string, string> = {}): CourseManifest {
  const m = value as CourseManifest;
  if (!m || m.schema !== 1 || !COURSE_ID.test(id) || m.id !== id || typeof m.title !== 'string' || m.title.length > 300 ||
      !HASH.test(m.pageVersion) || !HASH.test(m.revision) || !Array.isArray(m.files) || m.files.length < 3 || m.files.length > 201) {
    throw new OfflineError('manifest');
  }
  const origin = new URL(scope).origin;
  const lang = id.includes('/') ? id.split('/')[0] : '';
  const slug = id.split('/').pop()!;
  const mediaRoot = lang && mediaRoots[lang] ? new URL(mediaRoots[lang], scope).href : '';
  const urls = new Set<string>();
  let bytes = 0;
  const media = new Map<string, Set<string>>();
  for (const f of m.files) {
    if (!f || typeof f.url !== 'string' || urls.has(f.url) || !HASH.test(f.sha256) ||
        !Number.isSafeInteger(f.bytes) || f.bytes <= 0 || f.bytes > MAX_FILE_BYTES) throw new OfflineError('format');
    urls.add(f.url);
    const url = new URL(f.url, scope);
    const inScope = url.href.startsWith(scope);
    const inMedia = !!mediaRoot && url.href.startsWith(mediaRoot);
    if (url.origin !== origin || (!inScope && !inMedia) || url.hash || url.username || url.password) throw new OfflineError('origin');
    if (f.url === `${id}/`) {
      if (f.type !== 'text/html' || f.bytes > 4 * 1024 * 1024) throw new OfflineError('page');
    } else {
      // 同じoriginの /media/ を先に判定。通常版・字幕版とも本文のhashとパスのhashを一致させる。
      const hashed = /^\/media\/([a-z]{2})\/([A-Za-z0-9][A-Za-z0-9_-]*)\/([A-Za-z0-9][A-Za-z0-9_-]*)(\.cc)?\.([a-f0-9]{64})\.mp4$/.exec(f.url);
      if (hashed) {
        if (hashed[1] !== (lang || 'ja') || hashed[2] !== slug || hashed[5] !== f.sha256 || f.type !== 'video/mp4') throw new OfflineError('media');
        const key = `${hashed[3]}${lang ? `.${lang}` : ''}`;
        const types = media.get(key) ?? new Set<string>();
        types.add(hashed[4] ? 'cc' : 'mp4');
        media.set(key, types);
        bytes += f.bytes;
        continue;
      }
      const rest = inMedia ? url.href.slice(mediaRoot.length) : url.href.slice(scope.length);
      const match = new RegExp(`^${inMedia ? '' : `${lang ? `${lang}\\/` : ''}`}([A-Za-z0-9][A-Za-z0-9_-]*)\\/${inMedia ? '' : 'media\\/'}${MEDIA_NAME}\\?v=([a-f0-9]{64})$`).exec(rest);
      // 訳の講座の動画は、名前の終わりに講座の言語が付く（S01.en）。日本語の講座は付かない（S01）
      const nameLang = match?.[2].includes('.') ? match[2].split('.')[1] : '';
      if (!match || match[1] !== slug || nameLang !== lang || match[5] !== m.pageVersion || f.type !== (match[4] === 'mp4' ? 'video/mp4' : 'image/jpeg') || (match[3] && match[4] !== 'mp4')) {
        throw new OfflineError('media');
      }
      // 字幕を焼き込んだ版（.cc.mp4）は、同じレクチャーの動画とポスターに足すもの
      const types = media.get(match[2]) ?? new Set<string>();
      types.add(match[3] ? 'cc' : match[4]);
      media.set(match[2], types);
    }
    bytes += f.bytes;
  }
  if (!urls.has(`${id}/`) || media.size === 0 || [...media.values()].some((x) => !x.has('mp4') || !x.has('jpg')) ||
      bytes !== m.bytes || bytes > 1024 * 1024 * 1024) throw new OfflineError('incomplete');
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
