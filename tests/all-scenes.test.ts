import { describe, expect, test } from 'bun:test';
import { LECTURES } from '../content';
import { THEMES } from '../content/themes';
import { describeScene, SCENE_INFO, SCENE_KINDS } from '../engine/core/scenes';
import { validateCourse, validateTimeline } from '../engine/core/validate';
import { SCENES } from '../src/scenes';
import { VIDEO } from '../src/video.config';
import { ALL_SCENES, ALL_SCENES_TIMELINE } from './fixtures/content/all-scenes/course';

describe('全部の場面の見本（tests/fixtures/content/all-scenes）', () => {
  const lec = ALL_SCENES.lectures[0];
  test('20 種類の場面を 1 つずつ使う', () => {
    expect(SCENE_KINDS).toHaveLength(20);
    expect(lec.scenes.map((s) => s.kind).sort()).toEqual([...SCENE_KINDS].sort());
  });
  test('台本の検証で、誤りも注意も 0 件', () => expect(validateCourse(ALL_SCENES, { themes: Object.keys(THEMES) })).toEqual([]));
  test('固定の timeline が台本の形と合い、時刻が前から順に並ぶ', () => {
    const tl = ALL_SCENES_TIMELINE[lec.id];
    expect(tl.fps).toBe(VIDEO.fps);
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
  test('描く側の登録表（src/scenes）と描かない側の一覧（engine/core/scenes.ts）が、同じ 20 種類を同じ kind で持つ', () => {
    expect(Object.keys(SCENES).sort()).toEqual([...SCENE_KINDS].sort());
    for (const k of SCENE_KINDS) {
      expect(SCENES[k].kind).toBe(k);
      expect(typeof SCENES[k].Component).toBe('function');
      expect(SCENE_INFO[k].label.length).toBeGreaterThan(0);
    }
  });
  test('全部の種類で、教材の絵コンテの表示内容が作れる', () => {
    for (const s of lec.scenes) expect(`${s.kind} ${describeScene(s).length > 0}`).toBe(`${s.kind} true`);
  });
});
