import { describe, expect, test } from 'bun:test';
import { readTimelineEntries } from '../../scripts/timelines';
import { lastStartedIndex } from '../../src/active-timing';
import { LEAD } from '../../src/video.config';
import { required } from '../support/required';

const previousIndex = (cues: readonly { start: number }[], frame: number, lead: number) => {
  let index = -1;
  for (let k = 0; k < cues.length; k++) if (frame >= required(cues[k]).start - lead) index = k;
  return index;
};

describe('台詞と字幕の開始時刻の検索', () => {
  test('空・開始前・開始ちょうど・同時刻・最後のあとを扱う', () => {
    const cues = [10, 20, 20, 40].map((start) => ({ start }));
    expect(lastStartedIndex([], 0)).toBe(-1);
    expect(lastStartedIndex(cues, 9)).toBe(-1);
    expect(lastStartedIndex(cues, 10)).toBe(0);
    expect(lastStartedIndex(cues, 20)).toBe(2);
    expect(lastStartedIndex(cues, 17, 3)).toBe(2);
    expect(lastStartedIndex(cues, 100)).toBe(3);
  });

  test('全動画の開始時刻は昇順で、全台詞の前後フレームが旧検索と同じ', () => {
    const entries = readTimelineEntries();
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      const timeline = required(entry.timeline);
      const cues = timeline.scenes.flatMap((scene) => scene.lines.map((line) => ({ start: scene.start + line.start })));
      expect(cues.map((cue) => cue.start)).toEqual(cues.map((cue) => cue.start).sort((a, b) => a - b));
      for (const lead of [0, LEAD.caption, LEAD.appear]) {
        for (const cue of cues) {
          for (const delta of [-1, 0, 1]) {
            const frame = cue.start - lead + delta;
            expect(lastStartedIndex(cues, frame, lead)).toBe(previousIndex(cues, frame, lead));
          }
        }
      }
    }
  });

  test('長い動画でも開始時刻を全件読まない', () => {
    let reads = 0;
    const cues = Array.from({ length: 4096 }, (_, i) => ({
      get start() {
        reads++;
        return i * 10;
      },
    }));
    expect(lastStartedIndex(cues, 30000)).toBe(3000);
    expect(reads).toBeLessThanOrEqual(13);
  });
});
