import { describe, expect, test } from 'bun:test';
import { byteRange, COURSE_ID, validateManifest } from '../site/offline-shared';

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
test('/media/ の通常版と字幕版を、言語・講座・本文hashが一致するときだけ保存する', () => {
  const m = manifest();
  m.files[1].url = `/media/ja/sample/S01.${hash}.mp4`;
  m.files.push({ ...m.files[1], url: `/media/ja/sample/S01.cc.${hash}.mp4`, bytes: 15 });
  m.bytes += 15;
  expect(validateManifest(m, 'sample', 'https://example.com/').files).toHaveLength(4);
  for (const url of [`/media/en/sample/S01.${hash}.mp4`, `/media/ja/other/S01.${hash}.mp4`, `/media/ja/sample/S01.${'b'.repeat(64)}.mp4`,
    `/media/ja/sample/S01.${hash}.mp4?url=elsewhere`, `https://example.com/media/ja/sample/S01.${hash}.mp4`]) {
    const bad = structuredClone(m); bad.files[1].url = url;
    expect(() => validateManifest(bad, 'sample', 'https://example.com/')).toThrow();
  }
});
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

describe('字幕を焼き込んだ版と、訳の講座の動画', () => {
  const file = (url: string, type = 'video/mp4') => ({ url, bytes: 10, sha256: hash, type });
  const course = (id: string, files: ReturnType<typeof file>[]) => ({ schema: 1, id, title: 't', pageVersion: hash, revision: hash, bytes: files.length * 10, files });
  const roots = { en: '/chalkfile-media-en/' };
  test('字幕を焼き込んだ版（.cc.mp4）も保存対象にできる', () => {
    const m = course('sample', [file('sample/'), file(`sample/media/S01.mp4?v=${hash}`), file(`sample/media/S01.jpg?v=${hash}`, 'image/jpeg'), file(`sample/media/S01.cc.mp4?v=${hash}`)]);
    m.files[0].type = 'text/html';
    expect(validateManifest(m, 'sample', scope).files.length).toBe(4);
  });
  test('訳の講座は、言語の動画のサイトにある自分の言語の動画だけ保存対象にできる', () => {
    const m = course('en/sample', [file('en/sample/'), file(`/chalkfile-media-en/sample/S01.en.mp4?v=${hash}`), file(`/chalkfile-media-en/sample/S01.en.jpg?v=${hash}`, 'image/jpeg'), file(`/chalkfile-media-en/sample/S01.en.cc.mp4?v=${hash}`)]);
    m.files[0].type = 'text/html';
    expect(validateManifest(m, 'en/sample', scope, roots).files.length).toBe(4);
  });
  for (const [name, files] of [
    ['字幕の版だけで、字幕なしの動画が無い', ['sample/media/S01.cc.mp4', 'sample/media/S01.jpg']],
    ['字幕の版のポスター', ['sample/media/S01.mp4', 'sample/media/S01.jpg', 'sample/media/S01.cc.jpg']],
    ['日本語の講座に、言語の付いた動画', ['sample/media/S01.en.mp4', 'sample/media/S01.en.jpg']],
  ] as const) test(`日本語の講座で拒否: ${name}`, () => {
    const m = course('sample', [file('sample/'), ...files.map((f) => file(`${f}?v=${hash}`, f.endsWith('.jpg') ? 'image/jpeg' : 'video/mp4'))]);
    m.files[0].type = 'text/html';
    expect(() => validateManifest(m, 'sample', scope)).toThrow();
  });
  for (const [name, files] of [
    ['別の言語の動画', ['/chalkfile-media-en/sample/S01.zh.mp4', '/chalkfile-media-en/sample/S01.zh.jpg']],
    ['別の言語の動画のサイト', ['/chalkfile-media-zh/sample/S01.en.mp4', '/chalkfile-media-zh/sample/S01.en.jpg']],
    ['別の講座のフォルダ', ['/chalkfile-media-en/other/S01.en.mp4', '/chalkfile-media-en/other/S01.en.jpg']],
    ['別の origin', ['https://other.example.com/chalkfile-media-en/sample/S01.en.mp4', 'https://other.example.com/chalkfile-media-en/sample/S01.en.jpg']],
  ] as const) test(`訳の講座で拒否: ${name}`, () => {
    const m = course('en/sample', [file('en/sample/'), ...files.map((f) => file(`${f}?v=${hash}`, f.endsWith('.jpg') ? 'image/jpeg' : 'video/mp4'))]);
    m.files[0].type = 'text/html';
    expect(() => validateManifest(m, 'en/sample', scope, roots)).toThrow();
  });
  test('講座の ID は、言語の頭を 1 つだけ付けられる', () => {
    for (const ok of ['sample', 'en/sample', 'zh/superagent-comedy']) expect(COURSE_ID.test(ok)).toBe(true);
    for (const ng of ['en/sample/x', '../sample', 'EN/sample', 'eng/sample', '/sample']) expect(COURSE_ID.test(ng)).toBe(false);
  });
});
