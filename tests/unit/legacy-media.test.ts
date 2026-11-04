import { afterAll, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { legacyMediaFile } from '../e2e/legacy-media';

const root = mkdtempSync(path.join(tmpdir(), 'chalkfile-legacy-media-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));
const bytes = Buffer.from('old video');
const expected = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
const options = (name: string) => ({
  expected,
  current: path.join(root, `${name}-current`),
  cache: path.join(root, `${name}-cached`),
  url: 'https://example.com/old.mp4',
});

test('現在の動画が更新されていても、凍結したハッシュの動画を別に保存し、現在の動画を上書きしない', async () => {
  const o = options('changed');
  writeFileSync(o.current, 'new video');
  const file = await legacyMediaFile({ ...o, getBytes: async () => bytes });
  expect(file).toBe(o.cache);
  expect(readFileSync(file)).toEqual(bytes);
  expect(readFileSync(o.current, 'utf8')).toBe('new video');
});

test('大きさとSHAが一致する現在の動画やキャッシュは、通信なしで使える', async () => {
  for (const place of ['current', 'cache'] as const) {
    const o = options(place);
    writeFileSync(o[place], bytes);
    expect(
      await legacyMediaFile({
        ...o,
        getBytes: async () => {
          throw new Error('通信しない');
        },
      }),
    ).toBe(o[place]);
  }
});

test('壊れたキャッシュは使わず、取得した動画も大きさとSHAの両方が合うまで成功にしない', async () => {
  for (const bad of [Buffer.from('short'), Buffer.from('bad video')]) {
    const o = options(`bad-${bad.length}`);
    writeFileSync(o.cache, 'broken');
    await expect(legacyMediaFile({ ...o, getBytes: async () => bad })).rejects.toThrow('凍結した一覧と違う');
    expect(readFileSync(o.cache, 'utf8')).toBe('broken');
    expect(existsSync(o.current)).toBe(false);
    expect(await legacyMediaFile({ ...o, getBytes: async () => bytes })).toBe(o.cache);
    expect(readFileSync(o.cache)).toEqual(bytes);
  }
});
