// 動画（書き出し）の入力の指紋。書き出しの段（scripts/stages/pipeline/stages.ts の render）・動画の一覧に書く inputs
// （scripts/media.ts push）・CI の確かめ（scripts/validate.ts）が、同じ作り方を使う。
//   script  台本の側。動画が描く台本の項目（レクチャーの LECTURE_FIELDS、講座の COURSE_FIELDS。講座のレクチャーと章は数だけ）・
//           講座のテーマの値・終わりの場面に出す声のクレジット・timeline（Git に入れたファイルの中身）
//   src     描き方の側。RENDER_CODE のファイル（src/・engine/・訳の重ね方とテーマの部品・Remotion の設定・書き出しの道具と設定・
//           サイト用の動画の大きさの目安）と、RENDER_DEPS の依存の版
// script に入れないもの: サイトと教材だけが使う項目（要点・クイズ・公式ドキュメント・教材・講座の前置き・リンク・出典・サイトの言葉）。
//   直しても動画は変わらないので、入れると CI が書き出し直しを求めてしまう。動画が読む項目を src/ で増やしたら、ここの一覧にも足す
//   （tests/pipeline-inputs.test.ts が src/ を読んで、一覧の外の項目を読んでいないかを確かめる）
// 声とミックスの音は timeline（声の長さで決まる時刻）を通してだけ入る。音そのものの指紋は、書き出しの段の記録（audio）が持つ
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Video } from '../../../content';
import { themeOf } from '../../../content/themes';
import { lectureCredits } from '../../../content/voices';
import { timelineFile } from '../../../engine/core/generated';
import { type MediaInputs, readCourseMediaFile } from '../../media-lists';
import { digest, type FileHasher, filesDigest, listFiles, lockVersions } from '../pipeline/digest';

/** 動画が読むレクチャーの項目（src/ の lecture.〜） */
export const LECTURE_FIELDS = ['id', 'no', 'title', 'caution', 'scenes'] as const;
/** 動画が読む講座の項目（src/ の course.〜）。lectures と syllabus は数だけを入れる（右上の 01 / 08 と終わりの進み具合） */
export const COURSE_FIELDS = [
  'id',
  'title',
  'disclaimer',
  'standalone',
  'unitLabel',
  'cast',
  'theme',
  'lectures',
  'syllabus',
] as const;

/** 描き方の側のファイルとフォルダ（リポジトリの直下から） */
export const RENDER_CODE = [
  'src',
  'engine',
  'content/i18n.ts',
  'content/themes.ts',
  'remotion.config.ts',
  'scripts/stages/video/render.ts',
  'scripts/stages/video/plan.ts',
  'scripts/stages/video/render.config.ts',
  'site/limits.ts',
] as const;
/** 描き方の側の依存（package-lock.json の版） */
export const RENDER_DEPS = [
  'remotion',
  '@remotion/bundler',
  '@remotion/cli',
  '@remotion/google-fonts',
  '@remotion/renderer',
  'lucide-react',
  'react',
  'react-dom',
] as const;

/**
 * 台本の側の入力（指紋にする前の値）。timeline は Git に入れた timeline のファイルを読んだもの。
 * 台詞の id は入れない（画面の要素の at を台詞に結ぶ名前で、読み込むときに番号に直す。番号が同じなら、名前を変えても動画は同じ）
 */
export const scriptInputs = ({ key, lang, lecture, course }: Video, timeline: unknown) => ({
  key,
  lang,
  lecture: {
    ...Object.fromEntries(LECTURE_FIELDS.map((k) => [k, lecture[k]])),
    scenes: lecture.scenes.map((s) => ({ ...s, lines: s.lines.map(({ id: _id, ...line }) => line) })),
  },
  course: {
    id: course.id,
    title: course.title,
    disclaimer: course.disclaimer,
    standalone: course.standalone,
    unitLabel: course.unitLabel,
    cast: course.cast,
    theme: course.theme,
    lectures: course.lectures.length,
    syllabus: course.syllabus?.chapters.length,
  } satisfies Record<(typeof COURSE_FIELDS)[number], unknown>,
  theme: themeOf(course.theme),
  credits: lectureCredits(lecture, lang),
  timeline,
});

/** 台本の側の指紋 */
export const scriptDigest = (video: Video, timeline: unknown): string => digest(scriptInputs(video, timeline));

/** Git に入れた timeline（content/<講座>/generated/timeline/<key>.json）を読む。無い・読めないときは null */
export const readTimelineJson = (root: string, { course, key }: Video): unknown => {
  const file = path.join(root, timelineFile(course.id, key));
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};

/** 描き方の側のファイル（リポジトリの直下から・名前の順） */
export const renderCodeFiles = (root: string): string[] => listFiles(root, RENDER_CODE);

/** 描き方の側の指紋（ファイルの名前と中身・依存の版） */
export const srcDigest = (root: string, hasher: FileHasher): string =>
  digest({ files: filesDigest(renderCodeFiles(root), hasher), deps: lockVersions(root, RENDER_DEPS) });

/** 今の台本と描き方から作った inputs（timeline が無ければ script は null）。動画の一覧の inputs（MediaInputs）と比べる */
export const currentInputs = (root: string, video: Video, src: string): { script: string | null; src: string } => {
  const timeline = readTimelineJson(root, video);
  return { script: timeline === null ? null : scriptDigest(video, timeline), src };
};

/** 記録した inputs と今の inputs を比べる。script が違えば台本の側が古い、src だけが違えば描き方だけが変わった */
export const compareInputs = (
  recorded: MediaInputs,
  now: { script: string | null; src: string },
): 'same' | 'script' | 'src' | 'unknown' =>
  now.script === null
    ? 'unknown'
    : recorded.script !== now.script
      ? 'script'
      : recorded.src !== now.src
        ? 'src'
        : 'same';

/**
 * 公開した動画（講座ごとの動画の一覧の entries）の 1 本と、今の台本・描き方との比べ。
 * result: same 合う・script 台本の側が変わった（動画が古い）・src 描き方の側だけが変わった・none 記録（inputs）が無い・
 * unknown timeline が無くて比べられない
 */
export type PublishedCheck = {
  video: Video;
  /** 動画の一覧のファイル（リポジトリの直下から） */
  file: string;
  kind: 'standard' | 'captioned';
  result: 'same' | 'script' | 'src' | 'none' | 'unknown';
};

/** videos のうち、動画の一覧に載っている動画の比べ（一覧の entries の順。retained は比べない） */
export const publishedChecks = (root: string, videos: readonly Video[], src: string): PublishedCheck[] => {
  const out: PublishedCheck[] = [];
  const lists = new Map<string, ReturnType<typeof readCourseMediaFile>>();
  for (const v of videos) {
    const id = `${v.course.id}/${v.lang}`;
    if (!lists.has(id)) lists.set(id, readCourseMediaFile(v.course.id, v.lang, root));
    const list = lists.get(id);
    if (!list) continue;
    const entries = list.manifest.entries.filter((e) => e.lecture === v.lecture.id);
    if (!entries.length) continue;
    const now = currentInputs(root, v, src);
    for (const e of entries) {
      const rec = list.inputs.get(e.filename);
      out.push({ video: v, file: list.file, kind: e.kind, result: rec ? compareInputs(rec, now) : 'none' });
    }
  }
  return out;
};
