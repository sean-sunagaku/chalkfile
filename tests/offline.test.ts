import { describe, expect, test } from 'bun:test';
import { byteRange, validateManifest } from '../site/offline-shared';

describe('bytes Range の境界', () => {
  for (const [header, expected] of [
    ['bytes=0-0', { kind: 'partial', start: 0, end: 0 }],
    ['bytes=20-39', { kind: 'partial', start: 20, end: 39 }],
    ['bytes=90-', { kind: 'partial', start: 90, end: 99 }],
    ['bytes=-10', { kind: 'partial', start: 90, end: 99 }],
    ['bytes=-200', { kind: 'partial', start: 0, end: 99 }],
    ['bytes=90-200', { kind: 'partial', start: 90, end: 99 }],
    ['bytes=100-', { kind: 'unsatisfiable' }],
    ['bytes=50-20', { kind: 'unsatisfiable' }],
    ['bytes=-0', { kind: 'unsatisfiable' }],
    ['bytes=999999999999999999999-', { kind: 'unsatisfiable' }],
    [null, { kind: 'full' }],
    ['bytes=0-1,20-21', { kind: 'full' }],
    ['items=0-1', { kind: 'full' }],
    ['bytes=bad', { kind: 'full' }],
  ] as const) test(String(header), () => expect(byteRange(header, 100)).toEqual(expected));
  test('空のデータは部分取得できない', () => expect(byteRange('bytes=0-', 0)).toEqual({ kind: 'unsatisfiable' }));
});

const hash = 'a'.repeat(64);
const manifest = () => ({ schema: 1, id: 'sample', title: 'サンプル教材', pageVersion: hash, revision: hash, bytes: 60,
  files: [
    { url: 'sample/', bytes: 10, sha256: hash, type: 'text/html' },
    { url: `sample/media/S01.mp4?v=${hash}`, bytes: 30, sha256: hash, type: 'video/mp4' },
    { url: `sample/media/S01.jpg?v=${hash}`, bytes: 20, sha256: hash, type: 'image/jpeg' },
  ] });
const scope = 'https://example.com/chalkfile/';
test('公開用の生成ページ・動画・ポスターがそろった講座だけ保存対象にできる', () => {
  expect(validateManifest(manifest(), 'sample', scope).bytes).toBe(60);
});
for (const url of ['https://other.example.com/video.mp4', '../private/video.mp4', '/another-app/video.mp4', 'sample/media/S01.m3u8',
  `sample/media/S01.mp4?v=${'b'.repeat(64)}`, `sample/media/S01.mp4?v=${hash}&extra=1`, 'https://user:pass@example.com/chalkfile/sample/']) {
  test(`保存対象外の URL: ${url}`, () => {
    const m = manifest(); m.files[1].url = url;
    expect(() => validateManifest(m, 'sample', scope)).toThrow();
  });
}
test('サイズの不足・大きすぎるファイル・重複・違う講座・片方だけのメディアを拒否する', () => {
  const cases = [
    { ...manifest(), bytes: 59 },
    { ...manifest(), id: 'other' },
    { ...manifest(), files: manifest().files.slice(0, 2) },
  ];
  for (const value of cases) expect(() => validateManifest(value, 'sample', scope)).toThrow();
  const tooLarge = manifest(); tooLarge.files[1].bytes = 40 * 1024 * 1024;
  expect(() => validateManifest(tooLarge, 'sample', scope)).toThrow();
  const duplicate = manifest(); duplicate.files.push(duplicate.files[1]);
  expect(() => validateManifest(duplicate, 'sample', scope)).toThrow();
  const partial = manifest(); partial.files[1].type = 'application/vnd.apple.mpegurl';
  expect(() => validateManifest(partial, 'sample', scope)).toThrow();
});
