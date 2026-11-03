import { describe, expect, test } from 'bun:test';
import { LECTURES } from '../content';
import { SCENE_KINDS, validateCourse, validateTimeline } from '../engine/core/validate';
import { ALL_SCENES, ALL_SCENES_TIMELINE } from './fixtures/content/all-scenes/course';

describe('全部の場面の見本（tests/fixtures/content/all-scenes）', () => {
  const lec = ALL_SCENES.lectures[0];
  test('20 種類の場面を 1 つずつ使う', () => {
    expect(SCENE_KINDS).toHaveLength(20);
    expect(lec.scenes.map((s) => s.kind).sort()).toEqual([...SCENE_KINDS].sort());
  });
  test('台本の検証で、誤りも注意も 0 件', () => expect(validateCourse(ALL_SCENES)).toEqual([]));
  test('固定の timeline が台本の形と合い、時刻が前から順に並ぶ', () => {
    const tl = ALL_SCENES_TIMELINE[lec.id];
    expect(tl.fps).toBe(30);
    expect(validateTimeline(lec, ALL_SCENES, tl)).toEqual([]);
    let t = 0;
    for (const s of tl.scenes) {
      expect(s.start).toBe(t);
      let prev = 0;
      for (const l of s.lines) {
        expect(l.start >= prev && l.start < l.end && l.end <= s.duration).toBe(true);
        prev = l.end;
      }
      t += s.duration;
    }
    expect(tl.durationInFrames).toBe(t);
  });
  test('動画の ID が、今の講座の動画と重ならない', () => expect(LECTURES.some((l) => l.id === lec.id)).toBe(false));
});
