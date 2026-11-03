// 動画ごとの timeline（content/<講座>/generated/timeline/<key>.json。scripts/synth.ts が書く）を、Remotion のバンドラ（webpack）の
// require.context で集める。講座や動画を足しても、ここは触らない（ファイルを置けば入る）。形と指紋は engine/core/timeline.ts。
// require.context は webpack にしか無いので、bun（scripts・tests）からは読まない（bun の道具は scripts/timelines.ts で読む）
import { entriesByKey, type TimelineEntry, type TimelineFile, timelineEntry } from '../engine/core/timeline';

/** webpack の require.context（バンドラが、書いた場所でフォルダの中身に置き換える） */
declare const require: {
  context: (
    directory: string,
    useSubdirectories: boolean,
    regExp: RegExp,
  ) => { keys: () => string[]; (id: string): unknown };
};

const files = require.context('../content', true, /^\.\/[^/]+\/generated\/timeline\/[^/]+\.json$/);

/** 動画の名前（S01・S01.en）→ 置いてある timeline のファイル（読めなかったものも error を入れて持つ。src/Root.tsx がその動画だけを止める） */
export const TIMELINES: ReadonlyMap<string, TimelineEntry[]> = entriesByKey(
  // webpack は同じファイルを別の書き方の名前でも返すことがあるので、./ で始まる名前だけを使う
  files
    .keys()
    .filter((k) => k.startsWith('./'))
    .map((k) => {
      let value: unknown;
      try {
        value = files(k);
      } catch (e) {
        value = e instanceof Error ? e : new Error(String(e));
      }
      return timelineEntry(`content/${k.slice(2)}`, value);
    }),
);

/** 動画の名前 → 読めた timeline（描くときに使う。描く前に src/Root.tsx の calculateMetadata が、台本と合うかを確かめる） */
export const TIMELINE: Readonly<Record<string, TimelineFile>> = Object.fromEntries(
  [...TIMELINES].flatMap(([key, list]) => (list.length === 1 && list[0].timeline ? [[key, list[0].timeline]] : [])),
);
