// 講座ごとの動画の一覧（content/<講座>/generated/media.<言語>.json）を読む・つなぐ部品。台本（content/index.ts）を読まないので、
// 台本の読み込みで止まるときも使える（scripts/validate.ts）。講座の順を渡す。台本から順を決めるのは scripts/media.ts の readMediaManifest
// 一覧の形の版（schema）:
//   1  項目は、言語・講座・レクチャー・種類・大きさ・SHA-256・ファイル名・タグ（site/media-shared.ts の MediaEntry）
//   2  1 の項目に、inputs（書き出したときの入力の指紋 { script, src }。scripts/stages/video/inputs.ts）を足せる。inputs の無い項目もある
//      （書き出しの記録の無い動画）。media push が、書き出しの記録のある動画を置いたときに書く（記録が 1 本も無ければ、1 のまま書く）
// 読むときは、どちらの版も、inputs を外した 1 の形にそろえる（Worker の許可リスト・サイトの組み立て・読みの差分は、今までどおり読む）。
// inputs は readCourseMediaFile だけが返す（CI の確かめ・media push・status が使う）
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { LANGS } from '../content/i18n';
import { mediaListFile, parseMediaListFile } from '../engine/core/generated';
import { allMediaEntries, mediaKey, validateMediaManifest, type MediaEntry, type MediaManifest } from '../site/media-shared';
import { ROOT } from './lib/paths';

/** 書き出したときの入力の指紋（16 字の 16 進）。script は台本の側、src は描き方の側 */
export type MediaInputs = { script: string; src: string };
const INPUT = /^[0-9a-f]{16}$/;
export const isMediaInputs = (x: unknown): x is MediaInputs =>
  !!x &&
  typeof x === 'object' &&
  !Array.isArray(x) &&
  Object.keys(x).sort().join() === 'script,src' &&
  INPUT.test(String((x as MediaInputs).script)) &&
  INPUT.test(String((x as MediaInputs).src));

/** 講座の一覧を読んだもの。manifest は inputs を外した 1 の形、inputs はファイル名 → 書き出したときの入力の指紋 */
export type CourseMediaFile = {
  file: string;
  schema: 1 | 2;
  manifest: MediaManifest;
  inputs: Map<string, MediaInputs>;
};

/** 一覧の JSON を読む（1 か 2 の版）。inputs を外して、1 の形の確かめ（validateMediaManifest）に通す */
export const parseCourseMedia = (value: unknown): Omit<CourseMediaFile, 'file'> => {
  const v = (value ?? {}) as { schema?: unknown; entries?: unknown; retained?: unknown };
  if (v.schema !== 1 && v.schema !== 2) throw new Error(`動画の一覧の形の版が違う（${JSON.stringify(v.schema)}。1 か 2）`);
  const inputs = new Map<string, MediaInputs>();
  const strip = (list: unknown): unknown =>
    Array.isArray(list)
      ? list.map((e) => {
          if (!e || typeof e !== 'object' || !('inputs' in e)) return e;
          const { inputs: x, ...rest } = e as MediaEntry & { inputs: unknown };
          if (v.schema === 1) throw new Error(`版 1 の一覧に inputs がある（inputs を書くのは版 2）: ${rest.filename}`);
          if (!isMediaInputs(x)) throw new Error(`inputs の形が違う（{ script, src } の 16 字の 16 進）: ${rest.filename}`);
          inputs.set(rest.filename, x);
          return rest;
        })
      : list;
  const manifest = validateMediaManifest({
    schema: 1,
    entries: strip(v.entries),
    ...(v.retained !== undefined ? { retained: strip(v.retained) } : {}),
  });
  return { schema: v.schema, manifest, inputs };
};

/** 講座の、ある言語の動画の一覧（無ければ null）。形と、項目の講座・言語がファイルの置き場所と合うかを確かめる。inputs も返す */
export function readCourseMediaFile(courseId: string, lang: string, root = ROOT): CourseMediaFile | null {
  const file = mediaListFile(courseId, lang);
  if (!existsSync(path.join(root, file))) return null;
  let parsed: Omit<CourseMediaFile, 'file'>;
  try {
    parsed = parseCourseMedia(JSON.parse(readFileSync(path.join(root, file), 'utf8')));
  } catch (e) {
    throw new Error(`${file}: ${e instanceof Error ? e.message : String(e)}`);
  }
  const other = allMediaEntries(parsed.manifest).find((e) => e.course !== courseId || e.lang !== lang);
  if (other) throw new Error(`${file}: ほかの講座か言語の動画が入っている（${mediaKey(other)}）`);
  return { file, ...parsed };
}

/** 講座の、ある言語の動画の一覧（無ければ null）。inputs を外した 1 の形 */
export function readCourseMedia(courseId: string, lang: string, root = ROOT): MediaManifest | null {
  return readCourseMediaFile(courseId, lang, root)?.manifest ?? null;
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

/** 一覧をファイルに書く中身（2 スペースで字下げし、最後に改行）。Worker の許可リストも、これで書く（inputs は入れない） */
export const mediaManifestJson = (m: MediaManifest) => `${JSON.stringify(m, null, 2)}\n`;

/**
 * 講座の一覧をファイルに書く中身。inputs（ファイル名 → 指紋）のある項目には inputs を足し、2 の版で書く。
 * どの項目にも inputs が無ければ、今までどおり 1 の版で書く（同じバイト列）
 */
export const courseMediaJson = (m: MediaManifest, inputs: ReadonlyMap<string, MediaInputs>): string => {
  const all = allMediaEntries(m);
  if (!all.some((e) => inputs.has(e.filename))) return mediaManifestJson(m);
  const put = <E extends MediaEntry>(e: E): E | (E & { inputs: MediaInputs }) => {
    const x = inputs.get(e.filename);
    return x ? { ...e, inputs: { script: x.script, src: x.src } } : e;
  };
  return `${JSON.stringify({ schema: 2, entries: m.entries.map(put), ...(m.retained ? { retained: m.retained.map(put) } : {}) }, null, 2)}\n`;
};
