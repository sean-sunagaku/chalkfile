import type { Course } from '../../../../content/types';
import timelineJson from './timeline.json';
import { X01 } from './X01';

/**
 * 全部の場面の見本の講座（content/<講座>/course.ts と同じ形。講座の一覧には並べない）。
 * timeline.json は X01 の場面と台詞の時刻を固定したもの。synth.ts と同じ間（台詞の前 0.45 秒・オープニングは 2.05 秒・台詞の間 0.3 秒＋pause・
 * 場面の終わり 0.75 秒・エンディングの後 4 秒・hold）で、どの台詞も 2 秒として作った。台詞を足したら、同じ決まりで作り直す
 */
export const ALL_SCENES: Course = {
  id: 'all-scenes',
  title: '全部の場面の見本',
  subtitle: 'エンジンの単体テストと静止画の比較のための講座',
  headline: '20 種類の場面を 1 つずつ',
  sections: [{ no: 1, title: 'はじめに' }],
  lectures: [X01],
  cast: {
    narrator: { name: '先生', tone: 'coral' },
    zundamon: { name: 'ずんだもん', tone: 'mint' },
  },
  docsNote: '見本のための講座です。',
  sourceNote: '架空のサンプルアプリで作った見本。',
};

export type FixtureTimeline = { fps: number; durationInFrames: number; scenes: { start: number; duration: number; lines: { start: number; end: number }[] }[] };
/** 動画の名前（X01）ごとの timeline（content/<講座>/generated/timeline/<key>.json の時刻の部分と同じ形） */
export const ALL_SCENES_TIMELINE = timelineJson as Record<string, FixtureTimeline>;
