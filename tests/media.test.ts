import { describe, expect, spyOn, test } from 'bun:test';
import {
  RETAIN_DAYS, allMediaEntries, expiredRetained, mediaFilename, mediaPath, releaseUrl, retainDeadline, retainedWarnings, validateMediaManifest,
  type MediaEntry,
} from '../site/media-shared';
import { retainEntries, verifyReleaseAssets, warnExpiredRetained } from '../scripts/media';
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
describe('retained の期限', () => {
  const hashed = (c: string): MediaEntry => { const e = { ...entry, sha256: c.repeat(64) }; return { ...e, filename: mediaFilename(e) }; };
  test('期限は retained に入れた日から 90 日（UTC の日付。その日までは期限内）', () => {
    expect(RETAIN_DAYS).toBe(90);
    expect(retainDeadline(new Date('2026-11-02T23:30:00Z'))).toBe('2027-01-31');
    const m = validateMediaManifest({ schema: 1, entries: [entry], retained: [{ ...hashed('b'), retainedUntil: '2027-01-31' }] });
    expect(expiredRetained(m, new Date('2027-01-31T23:59:59Z'))).toHaveLength(0);
    expect(expiredRetained(m, new Date('2027-02-01T00:00:00Z'))).toHaveLength(1);
  });
  test('期限の無い古い retained も読め、期限切れとは数えない', () => {
    const m = validateMediaManifest({ schema: 1, entries: [entry], retained: [hashed('b')] });
    expect(expiredRetained(m, new Date('2100-01-01T00:00:00Z'))).toHaveLength(0);
  });
  test('retainedUntil は retained の項目にだけ、正しい日付で付ける', () => {
    for (const retainedUntil of ['2027-02-30', '2027-1-31', '2027-01-31T00:00:00Z', '', 20270131, null]) {
      expect(() => validateMediaManifest({ schema: 1, entries: [entry], retained: [{ ...hashed('b'), retainedUntil }] })).toThrow();
    }
    expect(() => validateMediaManifest({ schema: 1, entries: [{ ...entry, retainedUntil: '2027-01-31' }] })).toThrow();
  });
  test('push は一覧から外れた現行版に 90 日の期限を付け、retained の期限は変えない（無いものには付ける）', () => {
    const today = new Date('2026-11-02T12:00:00Z');
    const previous = validateMediaManifest({ schema: 1, entries: [hashed('b')], retained: [{ ...hashed('c'), retainedUntil: '2026-12-01' }, hashed('d')] });
    const retained = retainEntries(previous, [hashed('f')], today);
    expect(retained.map((e) => [e.sha256[0], e.retainedUntil])).toEqual([['b', '2027-01-31'], ['c', '2026-12-01'], ['d', '2027-01-31']]);
    expect(() => validateMediaManifest({ schema: 1, entries: [hashed('f')], retained })).not.toThrow();
    // 元のハッシュに戻したら、retained から外す
    expect(retainEntries(previous, [hashed('c')], today).map((e) => e.sha256[0])).toEqual(['b', 'd']);
    expect(retainEntries(null, [hashed('f')], today)).toEqual([]);
  });
  test('期限切れは警告するだけで、失敗にしない', () => {
    const later = new Date('2027-01-01T00:00:00Z');
    const m = validateMediaManifest({ schema: 1, entries: [entry],
      retained: [{ ...hashed('b'), retainedUntil: '2026-12-01' }, { ...hashed('c'), retainedUntil: '2027-12-01' }] });
    expect(retainedWarnings(m, later)).toEqual([expect.stringContaining(mediaPath(hashed('b')))]);
    const spy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(warnExpiredRetained(m, later)).toBe(1);
      expect(String(spy.mock.calls[0]?.[0])).toContain('2026-12-01');
      expect(warnExpiredRetained(validateMediaManifest({ schema: 1, entries: [entry] }), later)).toBe(0);
      expect(spy).toHaveBeenCalledTimes(1);
    } finally { spy.mockRestore(); }
  });
});
