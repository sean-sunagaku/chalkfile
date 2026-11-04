// 静止画（scripts/stills.ts）が受け取る動画・場面・フレームを、バンドルを作る前に確かめる
import { describe, expect, test } from 'bun:test';
import path from 'node:path';
import type { TimelineFile } from '../../engine/core/timeline';
import { MissingError, UsageError } from '../../scripts/lib/args';

// stills.ts は Node で動かす道具で、scripts/lib を拡張子まで書いて読む（tests の型の設定では、その書き方を読めない）。
// 型を書いてから、動かすときに読む
type ParseTargets = (
  targets: string[],
  find: (key: string) => TimelineFile,
) => { id: string; frame: number | null; scenes: number[] | null }[];
const { parseTargets } = (await import(path.join(import.meta.dir, '../../scripts/stills.ts'))) as {
  parseTargets: ParseTargets;
};

/** 場面 3 つ・300 フレームの timeline（X01 だけがある） */
const TIMELINE = {
  fps: 30,
  durationInFrames: 300,
  scenes: [0, 100, 200].map((start) => ({ start, duration: 100, lines: [] })),
} as unknown as TimelineFile;
const find = (key: string): TimelineFile => {
  if (key !== 'X01' && key !== 'X01.en') throw new MissingError(`${key} の timeline が無い`);
  return TIMELINE;
};
const parse = (...targets: string[]) =>
  parseTargets(targets, find).map(({ id, frame, scenes }) => ({ id, frame, scenes }));

describe('受け取る動画の形', () => {
  test('動画・場面で絞る（:）・フレームを決める（@）。訳の動画も', () => {
    expect(parse('X01', 'X01:1,3', 'X01@299', 'X01.en:2')).toEqual([
      { id: 'X01', frame: null, scenes: null },
      { id: 'X01', frame: null, scenes: [1, 3] },
      { id: 'X01', frame: 299, scenes: null },
      { id: 'X01.en', frame: null, scenes: [2] },
    ]);
  });
  test('形の違う名前・範囲の外の場面とフレームは、使い方の誤り', () => {
    for (const t of ['../X01', 'X01@abc', 'X01:0', 'X01:1@5', 'X01:', 'X01.EN', ''])
      expect(() => parse(t)).toThrow(UsageError);
    expect(() => parse('X01:4')).toThrow('X01 の場面は 1〜3: X01:4');
    expect(() => parse('X01@300')).toThrow('X01 のフレームは 0〜299: X01@300');
  });
  test('timeline の無い動画は、前提が足りない', () => {
    expect(() => parse('X02')).toThrow(MissingError);
  });
});
