// URL の許可リストを、サイトの組み立てと Worker の両方で共有する（外部 URL は持たない）。
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
export type MediaManifest = { schema: 1; entries: MediaEntry[] };
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const LANG = /^[a-z]{2,3}(?:-[A-Z]{2})?$/;
const HASH = /^[a-f0-9]{64}$/;
export const mediaFilename = (entry: Pick<MediaEntry, 'lecture' | 'kind' | 'sha256'>) =>
  `${entry.lecture}${entry.kind === 'captioned' ? '.cc' : ''}.${entry.sha256}.mp4`;
export const mediaPath = (entry: MediaEntry) => `/media/${entry.lang}/${entry.course}/${entry.filename}`;
export const mediaKey = (entry: Pick<MediaEntry, 'lang' | 'course' | 'lecture' | 'kind'>) =>
  `${entry.lang}/${entry.course}/${entry.lecture}/${entry.kind}`;
export const releaseUrl = (entry: MediaEntry) =>
  `https://github.com/${MEDIA_REPOSITORY}/releases/download/${entry.tag}/${entry.filename}`;

export function validateMediaManifest(value: unknown): MediaManifest {
  const m = value as MediaManifest;
  if (!m || m.schema !== 1 || !Array.isArray(m.entries) || !m.entries.length || m.entries.length > 20000) throw new Error('動画マニフェストの形式が不正です。');
  const keys = new Set<string>();
  for (const e of m.entries) {
    if (!e || !LANG.test(e.lang) || !ID.test(e.course) || !ID.test(e.lecture) ||
        !['standard', 'captioned'].includes(e.kind) || !HASH.test(e.sha256) ||
        !Number.isSafeInteger(e.bytes) || e.bytes <= 0 || e.bytes >= 2 * 1024 ** 3 ||
        e.tag !== `media-${e.lang}-${e.course}` || e.filename !== mediaFilename(e) || keys.has(mediaKey(e))) {
      throw new Error('動画の名前・サイズ・ハッシュ・タグが不正か重複しています。');
    }
    keys.add(mediaKey(e));
  }
  for (const e of m.entries) if (e.kind === 'captioned' && !keys.has(mediaKey({ ...e, kind: 'standard' }))) {
    throw new Error('字幕焼き込み版の通常動画がありません。');
  }
  return m;
}
