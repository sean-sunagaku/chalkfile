// 講座ごとの動画の一覧（content/<講座>/generated/media.<言語>.json）を読む・つなぐ部品。台本（content/index.ts）を読まないので、
// 台本の読み込みで止まるときも使える（scripts/validate.ts）。講座の順を渡す。台本から順を決めるのは scripts/media.ts の readMediaManifest
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { LANGS } from '../content/i18n';
import { mediaListFile, parseMediaListFile } from '../engine/core/generated';
import { allMediaEntries, mediaKey, validateMediaManifest, type MediaManifest } from '../site/media-shared';

const ROOT = path.resolve(import.meta.dir, '..');

/** 講座の、ある言語の動画の一覧（無ければ null）。形と、項目の講座・言語がファイルの置き場所と合うかを確かめる */
export function readCourseMedia(courseId: string, lang: string, root = ROOT): MediaManifest | null {
  const file = mediaListFile(courseId, lang);
  if (!existsSync(path.join(root, file))) return null;
  let m: MediaManifest;
  try {
    m = validateMediaManifest(JSON.parse(readFileSync(path.join(root, file), 'utf8')));
  } catch (e) {
    throw new Error(`${file}: ${e instanceof Error ? e.message : String(e)}`);
  }
  const other = allMediaEntries(m).find((e) => e.course !== courseId || e.lang !== lang);
  if (other) throw new Error(`${file}: ほかの講座か言語の動画が入っている（${mediaKey(other)}）`);
  return m;
}

/** 置いてある講座ごとの一覧のファイル（リポジトリの直下からのパス・名前の順） */
export function mediaListFiles(root = ROOT): string[] {
  const content = path.join(root, 'content');
  if (!existsSync(content)) return [];
  return readdirSync(content, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) => {
      const dir = path.join(content, d.name, 'generated');
      return existsSync(dir)
        ? readdirSync(dir)
            .map((f) => `content/${d.name}/generated/${f}`)
            .filter((f) => parseMediaListFile(f))
        : [];
    })
    .sort();
}

/**
 * 全講座の動画の一覧。courseIds（講座の登録の順）と言語の順に、講座ごとの一覧をつなぐ（Worker の許可リストと同じもの）。
 * 渡した講座に無い講座・知らない言語の一覧があれば止める（消した講座の動画が、黙って配られ続けないように）
 */
export function readMediaLists(courseIds: readonly string[], root = ROOT): MediaManifest {
  const lists: MediaManifest[] = [];
  const known = new Set<string>();
  for (const id of courseIds)
    for (const lang of LANGS) {
      known.add(mediaListFile(id, lang));
      const m = readCourseMedia(id, lang, root);
      if (m) lists.push(m);
    }
  const unknown = mediaListFiles(root).filter((f) => !known.has(f));
  if (unknown.length)
    throw new Error(
      `登録に無い講座か、知らない言語の動画の一覧がある: ${unknown.join(' ')}（講座を消したなら、その一覧も消す）`,
    );
  const retained = lists.flatMap((m) => m.retained ?? []);
  return validateMediaManifest({
    schema: 1,
    entries: lists.flatMap((m) => m.entries),
    ...(retained.length ? { retained } : {}),
  });
}

/** 一覧をファイルに書く中身（2 スペースで字下げし、最後に改行） */
export const mediaManifestJson = (m: MediaManifest) => `${JSON.stringify(m, null, 2)}\n`;
