import { describe, expect, spyOn, test } from 'bun:test';
import {
  RETAIN_DAYS, allMediaEntries, expiredRetained, mediaFilename, mediaPath, releaseUrl, retainDeadline, retainedWarnings, validateMediaManifest,
  type MediaEntry,
} from '../site/media-shared';
import { mediaLimitProblems, readMediaManifest, retainEntries, verifyReleaseAssets, warnExpiredRetained } from '../scripts/media';
import { OFFLINE_COURSE_MAX_BYTES, OFFLINE_COURSE_MAX_FILES, OFFLINE_FILE_MAX_BYTES, RELEASE_MAX_ASSETS } from '../site/limits';
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
describe('動画の一覧が、保存と Releases の上限に収まるか（mediaLimitProblems。push と check が使う）', () => {
  const MiB = 1024 ** 2;
  const video = (lecture: string, o: Partial<MediaEntry> = {}): MediaEntry => {
    const e = { ...entry, lecture, sha256: 'a'.repeat(64), ...o };
    return { ...e, filename: mediaFilename(e) };
  };
  const lectures = (n: number, o: Partial<MediaEntry> = {}) => Array.from({ length: n }, (_, i) => video(`L${String(i + 1).padStart(3, '0')}`, o));
  test('今の一覧は収まる', () => {
    expect(mediaLimitProblems(readMediaManifest())).toEqual([]);
  });
  test('保存の 1 ファイルの上限を超える動画を止める（ちょうどは通す）', () => {
    expect(mediaLimitProblems({ schema: 1, entries: [video('L01', { bytes: OFFLINE_FILE_MAX_BYTES })] })).toEqual([]);
    expect(mediaLimitProblems({ schema: 1, entries: [video('L01', { bytes: OFFLINE_FILE_MAX_BYTES + 1 })] })).toEqual([
      '動画が保存の 1 ファイルの上限（32.0 MiB）を超えています: ja/sample/L01/standard（32.0 MiB）',
    ]);
  });
  test('講座の動画の合計が、保存の 1 講座の上限を超えたら止める', () => {
    const fits = lectures(OFFLINE_COURSE_MAX_BYTES / OFFLINE_FILE_MAX_BYTES, { bytes: OFFLINE_FILE_MAX_BYTES });
    expect(mediaLimitProblems({ schema: 1, entries: fits })).toEqual([]);
    expect(mediaLimitProblems({ schema: 1, entries: [...fits, video('L999', { bytes: MiB })] })).toEqual([
      '講座の動画の合計が、保存の 1 講座の上限（1024.0 MiB）を超えています: ja/sample（1025.0 MiB）',
    ]);
  });
  test('講座の保存のファイルの数（ページとポスターも数える）が上限を超えたら止める', () => {
    const fits = lectures((OFFLINE_COURSE_MAX_FILES - 1) / 2);
    expect(mediaLimitProblems({ schema: 1, entries: fits })).toEqual([]);
    const cc = { ...fits[0], kind: 'captioned' as const };
    expect(mediaLimitProblems({ schema: 1, entries: [...fits, { ...cc, filename: mediaFilename(cc) }] })).toEqual([
      `講座の保存のファイルの数が、上限（${OFFLINE_COURSE_MAX_FILES}）を超えています: ja/sample（ページとポスターを入れて ${OFFLINE_COURSE_MAX_FILES + 1}）`,
    ]);
  });
  test('1 つの Release に置く数（retained も数える）が上限を超えたら止める', () => {
    const old = (n: number) => Array.from({ length: n }, (_, i) => video('L001', { sha256: i.toString(16).padStart(64, '0') }));
    expect(mediaLimitProblems({ schema: 1, entries: [video('L001')], retained: old(RELEASE_MAX_ASSETS - 1) })).toEqual([]);
    expect(mediaLimitProblems({ schema: 1, entries: [video('L001')], retained: old(RELEASE_MAX_ASSETS) })).toEqual([
      `Release の ${RELEASE_MAX_ASSETS} asset 上限を超えます: media-ja-sample（一覧に ${RELEASE_MAX_ASSETS + 1} 本）`,
    ]);
  });
});
