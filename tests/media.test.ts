import { describe, expect, test } from 'bun:test';
import { allMediaEntries, mediaFilename, mediaPath, releaseUrl, validateMediaManifest, type MediaEntry } from '../site/media-shared';
import { verifyReleaseAssets } from '../scripts/media';
const entry: MediaEntry = { lang: 'ja', course: 'sample', lecture: 'L01', kind: 'standard', sha256: 'a'.repeat(64), bytes: 100,
  filename: `L01.${'a'.repeat(64)}.mp4`, tag: 'media-ja-sample' };
describe('動画の許可リスト', () => {
  test('hash付きの固定リポジトリとパス', () => {
    expect(validateMediaManifest({ schema: 1, entries: [entry] }).entries).toHaveLength(1);
    expect(mediaPath(entry)).toBe(`/media/ja/sample/${entry.filename}`);
    expect(releaseUrl(entry)).toBe(`https://github.com/sean-sunagaku/chalkfile/releases/download/media-ja-sample/${entry.filename}`);
  });
  for (const patch of [{ lang: '../en' }, { course: '../other' }, { lecture: 'L01?q=1' }, { kind: 'other' }, { sha256: 'bad' },
    { bytes: 0 }, { bytes: 2 * 1024 ** 3 }, { filename: 'https://example.com/video.mp4' }, { tag: 'other' }]) {
    test(`形式の拒否 ${JSON.stringify(patch)}`, () => expect(() => validateMediaManifest({ schema: 1, entries: [{ ...entry, ...patch }] })).toThrow());
  }
  test('重複と通常版のない字幕版を拒否', () => {
    expect(() => validateMediaManifest({ schema: 1, entries: [entry, entry] })).toThrow();
    const cc = { ...entry, kind: 'captioned' as const };
    expect(() => validateMediaManifest({ schema: 1, entries: [{ ...cc, filename: mediaFilename(cc) }] })).toThrow();
  });
  test('更新前のhashはretainedで許可リストに残し、公開する現行版と区別する', () => {
    const old = { ...entry, sha256: 'b'.repeat(64) }; old.filename = mediaFilename(old);
    const m = validateMediaManifest({ schema: 1, entries: [entry], retained: [old] });
    expect(m.entries).toHaveLength(1); expect(allMediaEntries(m)).toHaveLength(2);
    expect(() => validateMediaManifest({ ...m, retained: [entry] })).toThrow();
  });
  test('Releases の欠落・サイズ違い・ハッシュ違いを公開前に拒否', () => {
    const asset = { name: entry.filename, size: entry.bytes, state: 'uploaded', digest: `sha256:${entry.sha256}` };
    expect(() => verifyReleaseAssets([entry], [asset])).not.toThrow();
    for (const assets of [[], [{ ...asset, size: 99 }], [{ ...asset, digest: 'sha256:bad' }], [{ ...asset, state: 'new' }]]) {
      expect(() => verifyReleaseAssets([entry], assets)).toThrow();
    }
  });
});
