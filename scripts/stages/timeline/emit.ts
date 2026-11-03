// 1 本の動画の出力を書く。中身は scripts/stages/timeline/compute.ts の純粋な関数が作り、ここは書くだけ。
// どのファイルも一時の名前に書いてから置き換える（別々の動画の synth を同時に流しても、書きかけのファイルが見えない）。
// 自分の動画のファイルだけを書く（ほかの動画のファイルには触らない）:
//   content/<講座>/generated/timeline/<key>.json   Remotion が読む場面・台詞の開始フレーム（指紋つき。Git に入れる）
//   .work/plan/<key>.json                          mix.py が読むミックスの設計図
//   .work/kana/<key>.txt                           台詞ごとの読み（カナ。訳は Kokoro に渡した音素）
//   .work/speech/<key>.json                        訳の動画の、台詞と音声の対応（聞き取りの点検用）
//   site/data/<key>.json・<key>.vtt                 講座サイトの台本と字幕
import path from 'node:path';
import type { Video } from '../../../content';
import { timelineFile } from '../../../engine/core/generated';
import { timelineJson } from '../../../engine/core/timeline';
import { writeAtomic } from '../../lib/fsx';
import { ROOT } from '../../lib/paths';
import {
  kanaLogOf,
  type LineVoice,
  layout,
  planOf,
  siteDataOf,
  speechFileOf,
  type Timed,
  timelineOf,
  vttOf,
} from './compute';

/** 書く場所。root はリポジトリの最上位（timeline は root からの content/<講座>/generated/timeline/） */
export type OutDirs = { root: string; plan: string; kana: string; speech: string; siteData: string };

export const outDirs = (root = ROOT): OutDirs => ({
  root,
  plan: path.join(root, '.work/plan'),
  kana: path.join(root, '.work/kana'),
  speech: path.join(root, '.work/speech'),
  siteData: path.join(root, 'site/data'),
});

/** 1 本の動画の時刻を決めて、出力を全部書く。voices[場面][台詞] はその台詞の声 */
export const emitVideo = (
  out: OutDirs,
  { key, lang, lecture, course }: Video,
  voices: LineVoice[][],
  fps: number,
): Timed => {
  const timed = layout(lecture, voices, fps);
  writeAtomic(path.join(out.kana, `${key}.txt`), kanaLogOf(key, lecture, lang, voices));
  const speech = speechFileOf(key, lecture, lang, voices);
  if (speech) writeAtomic(path.join(out.speech, `${key}.json`), JSON.stringify(speech, null, 1));
  writeAtomic(
    path.join(out.root, timelineFile(course.id, key)),
    timelineJson(timelineOf(key, lecture, lang, timed, fps)),
  );
  writeAtomic(path.join(out.plan, `${key}.json`), JSON.stringify(planOf(key, timed), null, 1));
  const site = siteDataOf(key, lecture, course, timed);
  writeAtomic(path.join(out.siteData, `${key}.json`), JSON.stringify(site));
  writeAtomic(path.join(out.siteData, `${key}.vtt`), vttOf(site.cues));
  return timed;
};
