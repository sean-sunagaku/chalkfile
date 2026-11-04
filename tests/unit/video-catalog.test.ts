// 教材を読む入口と、動画だけの入口の違いを、実データと実際の bundle で確かめる。
import { describe, expect, test } from 'bun:test';
import path from 'node:path';
import * as full from '../../content';
import { MATERIALS } from '../../content/materials';
import * as video from '../../content/videos';
import { materialDecorator } from '../../engine/core/materials';
import { ROOT } from '../../scripts/lib/paths';

const withoutMaterials = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(withoutMaterials);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'material')
      .map(([key, child]) => [key, withoutMaterials(child)]),
  );
};

describe('講座の入口', () => {
  test('全言語の動画の値は、教材を除いて同じ。どちらにも同じ辞書を付ける', () => {
    expect(withoutMaterials(video.VIDEOS)).toEqual(withoutMaterials(full.VIDEOS));
    expect(video.VIDEOS.every(({ lecture }) => lecture.material === undefined)).toBe(true);
    expect(full.LECTURES.filter((lecture) => lecture.material).length).toBe(Object.keys(MATERIALS).length);
    expect(full.SHARED_LINES).toEqual([]);
    expect(video.SHARED_LINES).toEqual([]);
  });
  test('どの講座にも無い教材のファイルを、黙って読み飛ばさない', () => {
    const material = full.LECTURES.find((lecture) => lecture.material)?.material;
    if (!material) throw new Error('試験に使う教材が無い');
    expect(() => materialDecorator(full.AUTHORED_COURSES, { 'no-such-lecture': material })).toThrow(
      '教材のレクチャーが無い',
    );
  });
  test('動画専用の実 bundle の依存関係に、教材のファイルが入らない', async () => {
    const result = await Bun.build({
      entrypoints: [path.join(ROOT, 'content/videos.ts')],
      target: 'browser',
      format: 'esm',
      minify: true,
      metafile: true,
    });
    expect(result.success).toBe(true);
    const inputs = Object.keys(result.metafile?.inputs ?? {});
    expect(inputs.some((file) => file.endsWith('content/videos.ts'))).toBe(true);
    expect(
      inputs.filter((file) => /\.material\.ts$|(?:^|\/)content\/materials\.ts$|(?:^|\/)content\/index\.ts$/.test(file)),
    ).toEqual([]);
  });
});
