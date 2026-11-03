// 置いてある timeline（content/<講座>/generated/timeline/<key>.json）を、手元のファイルから読む部品（bun で動く道具が使う）。
// 形と指紋は engine/core/timeline.ts、置き場所は engine/core/generated.ts。Remotion は src/timelines.ts が同じものを集める
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { entriesByKey, timelineEntry, type TimelineEntry } from '../engine/core/timeline';
import { ROOT } from './lib/paths';

/** 置いてある timeline のファイル（リポジトリの直下からのパス・名前の順）。root を渡すと、ほかの checkout を読む */
export const timelineFiles = (root = ROOT): string[] => {
  const content = path.join(root, 'content');
  if (!existsSync(content)) return [];
  return readdirSync(content, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) => {
      const dir = path.join(content, d.name, 'generated', 'timeline');
      return existsSync(dir)
        ? readdirSync(dir)
            .filter((f) => f.endsWith('.json'))
            .map((f) => `content/${d.name}/generated/timeline/${f}`)
        : [];
    })
    .sort();
};

/** 置いてある timeline を全部読む（読めないファイルも、error を入れて返す） */
export const readTimelineEntries = (root = ROOT): TimelineEntry[] =>
  timelineFiles(root).map((file) => {
    let value: unknown;
    try {
      value = JSON.parse(readFileSync(path.join(root, file), 'utf8'));
    } catch (e) {
      value = e instanceof Error ? e : new Error(String(e));
    }
    return timelineEntry(file, value);
  });

/** 動画の名前 → 置いてあるファイル */
export const readTimelinesByKey = (root = ROOT): Map<string, TimelineEntry[]> =>
  entriesByKey(readTimelineEntries(root));
