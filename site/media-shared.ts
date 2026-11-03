// URL の許可リストを、サイトの組み立てと Worker の両方で共有する（外部 URL は持たない）。
import { MEDIA_LIST_MAX_ENTRIES, RELEASE_ASSET_MAX_BYTES } from './limits';
export const MEDIA_REPOSITORY = 'sean-sunagaku/chalkfile';
export type MediaEntry = {
  lang: string;
  course: string;
  lecture: string;
  kind: 'standard' | 'captioned';
  filename: string;
  bytes: number;
  sha256: string;
  tag: string;
};
// retained は、更新前のハッシュの動画を許可リストに残す項目。retainedUntil（UTC の日付。その日まで）を過ぎたら外す目安。
// 期限の無い古い一覧も読める。
export type RetainedMediaEntry = MediaEntry & { retainedUntil?: string };
export type MediaManifest = { schema: 1; entries: MediaEntry[]; retained?: RetainedMediaEntry[] };
export const allMediaEntries = (manifest: MediaManifest) => [...manifest.entries, ...(manifest.retained ?? [])];
// 講座・レクチャーの ID、言語、SHA-256 の形。一覧の検査（validateMediaManifest）と、配るパスの読み方（parseMediaPath）が同じものを使う
const ID_PART = '[A-Za-z0-9][A-Za-z0-9_-]*';
const LANG_PART = '[a-z]{2,3}(?:-[A-Z]{2})?';
const HASH_PART = '[a-f0-9]{64}';
const ID = new RegExp(`^${ID_PART}$`);
const LANG = new RegExp(`^${LANG_PART}$`);
const HASH = new RegExp(`^${HASH_PART}$`);
const MEDIA_PATH = new RegExp(`^/media/(${LANG_PART})/(${ID_PART})/(${ID_PART})(\\.cc)?\\.(${HASH_PART})\\.mp4$`);
export const mediaFilename = (entry: Pick<MediaEntry, 'lecture' | 'kind' | 'sha256'>) =>
  `${entry.lecture}${entry.kind === 'captioned' ? '.cc' : ''}.${entry.sha256}.mp4`;
export const mediaPath = (entry: MediaEntry) => `/media/${entry.lang}/${entry.course}/${entry.filename}`;
/** 配るパス（/media/<言語>/<講座>/<レクチャー>[.cc].<SHA-256>.mp4。mediaPath の形）を読む。形が違えば null（query の付いたものも null） */
export const parseMediaPath = (pathname: string): Pick<MediaEntry, 'lang' | 'course' | 'lecture' | 'kind' | 'sha256'> | null => {
  const m = MEDIA_PATH.exec(pathname);
  return m ? { lang: m[1], course: m[2], lecture: m[3], kind: m[4] ? 'captioned' : 'standard', sha256: m[5] } : null;
};
/** 単体で保存するときのファイルの名前（字幕を焼き込んだ版は .captioned）。Worker・SW・手元の配信が同じ名前を付ける */
export const downloadName = (entry: Pick<MediaEntry, 'lecture' | 'kind'>) =>
  `${entry.lecture}${entry.kind === 'captioned' ? '.captioned' : ''}.mp4`;
export const mediaKey = (entry: Pick<MediaEntry, 'lang' | 'course' | 'lecture' | 'kind'>) =>
  `${entry.lang}/${entry.course}/${entry.lecture}/${entry.kind}`;
export const releaseUrl = (entry: MediaEntry) =>
  `https://github.com/${MEDIA_REPOSITORY}/releases/download/${entry.tag}/${entry.filename}`;

export const RETAIN_DAYS = 90;
const utcDay = (date: Date) => date.toISOString().slice(0, 10);
const isDay = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && utcDay(new Date(time)) === value;
};
// retained に入れる日から数えた期限（YYYY-MM-DD・UTC）。
export const retainDeadline = (today: Date, days = RETAIN_DAYS) => utcDay(new Date(today.getTime() + days * 24 * 60 * 60 * 1000));
export const expiredRetained = (manifest: MediaManifest, today = new Date()) =>
  (manifest.retained ?? []).filter((e) => e.retainedUntil !== undefined && e.retainedUntil < utcDay(today));
// media check と check_delivery が同じ文で知らせる（失敗にはしない）。
export const retainedWarnings = (manifest: MediaManifest, today = new Date()) => expiredRetained(manifest, today).map((e) =>
  `retained の期限 ${e.retainedUntil} を過ぎた動画が許可リストに残っています: ${mediaPath(e)}。講座の動画の一覧（content/<講座>/generated/media.<言語>.json）の retained から外すか、期限を延ばしてください（Release の asset は消さない）。`);

export function validateMediaManifest(value: unknown): MediaManifest {
  const m = value as MediaManifest;
  if (!m || m.schema !== 1 || !Array.isArray(m.entries) || !m.entries.length ||
      (m.retained !== undefined && !Array.isArray(m.retained)) || allMediaEntries(m).length > MEDIA_LIST_MAX_ENTRIES) throw new Error('動画マニフェストの形式が不正です。');
  const keys = new Set<string>();
  const paths = new Set<string>();
  for (const e of allMediaEntries(m)) {
    if (!e || !LANG.test(e.lang) || !ID.test(e.course) || !ID.test(e.lecture) ||
        !['standard', 'captioned'].includes(e.kind) || !HASH.test(e.sha256) ||
        !Number.isSafeInteger(e.bytes) || e.bytes <= 0 || e.bytes > RELEASE_ASSET_MAX_BYTES ||
        e.tag !== `media-${e.lang}-${e.course}` || e.filename !== mediaFilename(e) || paths.has(mediaPath(e)) || (m.entries.includes(e) && keys.has(mediaKey(e)))) {
      throw new Error('動画の名前・サイズ・ハッシュ・タグが不正か重複しています。');
    }
    keys.add(mediaKey(e));
    paths.add(mediaPath(e));
  }
  for (const e of allMediaEntries(m)) if (e.kind === 'captioned' && !keys.has(mediaKey({ ...e, kind: 'standard' }))) {
    throw new Error('字幕焼き込み版の通常動画がありません。');
  }
  if (m.entries.some((e) => 'retainedUntil' in e) || (m.retained ?? []).some((e) => e.retainedUntil !== undefined && !isDay(e.retainedUntil))) {
    throw new Error('retainedUntil は retained の項目にだけ、YYYY-MM-DD の日付で付けてください。');
  }
  return m;
}
