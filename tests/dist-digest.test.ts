import { afterEach, beforeEach, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DIST, digestFiles, LIST, verifyDigest, WORKER_MEDIA, writeDigest } from '../scripts/dist_digest';

let root = '';
const put = (rel: string, text: string) => {
  mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  writeFileSync(path.join(root, rel), text);
};
beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'chalkfile-digest-'));
  put(`${DIST}/index.html`, '<h1>top</h1>');
  put(`${DIST}/.assetsignore`, '**/*.mp4\n.*\n');
  put(`${DIST}/course/index.html`, '<h1>course</h1>');
  put(WORKER_MEDIA, '{"entries":[]}\n');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

test('一覧には . で始まるファイルと Worker の許可リストも入り、sha256sum と同じ形で書く', () => {
  expect(digestFiles(root)).toEqual([
    `${DIST}/.assetsignore`,
    `${DIST}/course/index.html`,
    `${DIST}/index.html`,
    WORKER_MEDIA,
  ]);
  const digest = writeDigest(root);
  expect(digest).toMatch(/^[0-9a-f]{64}$/);
  const lines = readFileSync(path.join(root, LIST), 'utf8').trimEnd().split('\n');
  expect(lines).toHaveLength(4);
  for (const line of lines) expect(line).toMatch(/^[0-9a-f]{64} {2}\S+$/);
  expect(verifyDigest(digest, root)).toBe(4);
});
test('中身が違う・多い・足りないファイルがあれば、パスを並べて止まる（中身は出さない）', () => {
  const digest = writeDigest(root);
  put(`${DIST}/index.html`, '<h1>changed secret-ish</h1>');
  expect(() => verifyDigest(digest, root)).toThrow(`中身が違う 1 個: ${DIST}/index.html`);
  try {
    verifyDigest(digest, root);
  } catch (error) {
    expect(String(error)).not.toContain('secret-ish');
  }
  put(`${DIST}/index.html`, '<h1>top</h1>');
  put(`${DIST}/extra.js`, 'x');
  expect(() => verifyDigest(digest, root)).toThrow(`多い 1 個: ${DIST}/extra.js`);
  rmSync(path.join(root, `${DIST}/extra.js`));
  rmSync(path.join(root, `${DIST}/.assetsignore`));
  expect(() => verifyDigest(digest, root)).toThrow(`足りない 1 個: ${DIST}/.assetsignore`);
});
test('Worker の許可リストが build と違えば止まる', () => {
  const digest = writeDigest(root);
  put(WORKER_MEDIA, '{"entries":[{"x":1}]}\n');
  expect(() => verifyDigest(digest, root)).toThrow(WORKER_MEDIA);
});
test('一覧そのものが build の出した sha256 と違えば、ファイルを見る前に止まる', () => {
  const digest = writeDigest(root);
  writeFileSync(path.join(root, LIST), `${'0'.repeat(64)}  ${DIST}/index.html\n`);
  expect(() => verifyDigest(digest, root)).toThrow('build が出したものと違う');
  expect(() => verifyDigest('not-a-digest', root)).toThrow('64 桁');
});
test('シンボリックリンクと、許可リストの無い公開物は一覧にしない', () => {
  symlinkSync('/etc/hosts', path.join(root, `${DIST}/link`));
  expect(() => digestFiles(root)).toThrow('シンボリックリンク');
  rmSync(path.join(root, `${DIST}/link`));
  rmSync(path.join(root, WORKER_MEDIA));
  expect(() => digestFiles(root)).toThrow('gen.ts --media');
});
