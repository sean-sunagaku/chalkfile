// 動画（src/）と中身（content/）をつなぐ、ただ 1 つの場所。src/ の中で content/ を読むのは、このファイルだけ
// （ほかのファイルが content/ を import すると、Biome の noRestrictedImports が止める）。src/index.ts が、ここの PROJECT を Root に渡す。
// 動画の一覧（content/index.ts の VIDEOS。日本語の全講座と訳）・講座のテーマ（content/themes.ts）と、次の timeline を集める。
// 動画ごとの timeline（content/<講座>/generated/timeline/<key>.json。scripts/synth.ts が書く）を、Remotion のバンドラ（webpack）の
// require.context で集める。講座や動画を足しても、ここは触らない（ファイルを置けば入る）。形と指紋は engine/core/timeline.ts。
// require.context は webpack にしか無いので、bun（scripts・tests）からは読まない（bun の道具は scripts/timelines.ts で読む）
import { VIDEOS, videoOf } from '../content';
import { themeOf } from '../content/themes';
import { entriesByKey, type TimelineEntry, timelineEntry } from '../engine/core/timeline';
import type { VideoProject } from './video-project';

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

/** 動画のエンジン（src/Root.tsx の Root）に渡す、描くものの一式 */
export const PROJECT: VideoProject = { videos: VIDEOS, videoOf, themeOf, timelines: TIMELINES };
