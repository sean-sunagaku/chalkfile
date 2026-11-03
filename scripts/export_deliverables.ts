// 章ごとの「完成動画と編集用データ」を 1 つのフォルダにまとめる（講座サイトの外で使うとき）。
//   bun scripts/export_deliverables.ts N01 D01 M01
//   bun scripts/export_deliverables.ts S01.en S01.zh    # 訳の動画（出力は out/deliverables/<講座 ID>/S01.en/ など）
// 出力: out/deliverables/<講座 ID>/<レクチャー ID>/
//   <id>.captioned.mp4   日本語字幕を焼き込んだ動画（CAPTIONS=1 bash scripts/render.sh の出力）
//   <id>.mp4             字幕なしの動画（講座サイト用。字幕は .vtt を重ねる）
//   <id>.ja.vtt / .srt   字幕（台詞の時刻は合成の実測。訳の動画は <id>.vtt。例 S01.en.vtt）
//   <id>.mix.wav         ナレーション・BGM・効果音をまとめた音
//   <章 ID>.md           教材一式（build_materials.ts の出力。台本・絵コンテ・課題を含む）
//   README.md            中身と、作り直し方（編集の正本は content/ の台本）
// 動画は Git に入れない（out/ は .gitignore）。終了コード: 0 できた・1 失敗・2 使い方の誤り（ID が無い・知らない ID）
import { constants, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { VIDEOS, videoOf } from '../content';
import { readArgs, runMain, showHelp, UsageError } from './lib/args';
import { ROOT } from './lib/paths';

type Cue = { start: number; end: number; text: string };
const stamp = (x: number, sep: string) => {
  const h = Math.floor(x / 3600);
  const m = Math.floor((x % 3600) / 60);
  const s = Math.floor(x % 60);
  const ms = Math.round((x - Math.floor(x)) * 1000);
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(h)}:${p(m)}:${p(s)}${sep}${p(ms === 1000 ? 999 : ms, 3)}`;
};

const main = (argv: string[]) => {
  const { values, positionals: ids } = readArgs(argv, {}, { positionals: true });
  if (values.help) return showHelp(import.meta.filename);
  if (!ids.length) throw new UsageError('レクチャー ID を渡す（例: bun scripts/export_deliverables.ts N01 D01 M01）');
  for (const id of ids) if (!VIDEOS.some((v) => v.key === id)) throw new UsageError(`動画が無い: ${id}（例: N01、S01.en）`);
  for (const id of ids) {
    const { lecture: lec, course, lang } = videoOf(id);
    // 字幕のファイル名: 日本語は <id>.ja.vtt（今までどおり）、訳は <id>.vtt（名前に言語が入っている）
    const sub = lang === 'ja' ? `${id}.ja` : id;
    const dir = path.join(ROOT, 'out/deliverables', course.id, id);
    mkdirSync(dir, { recursive: true });
    const got: string[] = [];
    const copy = (from: string, to: string) => {
      const f = path.join(ROOT, from);
      if (!existsSync(f)) return console.warn(`  まだ無い: ${from}`);
      // APFS などでは複製せずに同じ中身を指す（ディスクを食わない）。できないファイルシステムでは普通にコピーする
      copyFileSync(f, path.join(dir, to), constants.COPYFILE_FICLONE);
      got.push(to);
    };
    copy(`out/captioned/${id}.mp4`, `${id}.captioned.mp4`);
    copy(`site/media/${id}.mp4`, `${id}.mp4`);
    copy(`site/media/${id}.jpg`, `${id}.poster.jpg`);
    copy(`public/audio/mix/${id}.wav`, `${id}.mix.wav`);
    const dataFile = path.join(ROOT, 'site/data', `${id}.json`);
    if (existsSync(dataFile)) {
      const cues = (JSON.parse(readFileSync(dataFile, 'utf8')) as { cues: Cue[] }).cues;
      writeFileSync(path.join(dir, `${sub}.vtt`), `WEBVTT\n\n${cues.map((c, i) => `${i + 1}\n${stamp(c.start, '.')} --> ${stamp(c.end, '.')}\n${c.text}\n`).join('\n')}`);
      writeFileSync(path.join(dir, `${sub}.srt`), cues.map((c, i) => `${i + 1}\n${stamp(c.start, ',')} --> ${stamp(c.end, ',')}\n${c.text}\n`).join('\n'));
      got.push(`${sub}.vtt`, `${sub}.srt`);
    }
    if (lec.material) copy(`docs/courses/${course.id}/${lec.material.id}.md`, `${lec.material.id}.md`);
    writeFileSync(
      path.join(dir, 'README.md'),
      [
        `# ${course.title}　${course.unitLabel === 'CHAPTER' ? `第 ${lec.no} 章` : `レクチャー ${lec.no}`} ${lec.title}`,
        '',
        lec.summary,
        '',
        '## 中身',
        '',
        ...got.map((g) => `- ${g}`),
        '',
        '## 編集と作り直し',
        '',
        lang === 'ja'
          ? `- 正本は台本 \`content/${course.id}/${id}.ts\`（台詞・画面・教材・課題）と、出典 \`content/${course.id}/sources.ts\``
          : `- 正本は日本語の台本 \`content/${course.id}/${lec.id}.ts\` と、それに重ねる訳 \`content/${course.id}/${lang}/${lec.id}.ts\`（台詞と画面の文字）`,
        `- 台詞を直したら: \`bun scripts/synth.ts ${id}\` → \`uv run --locked --group audio python scripts/mix.py ${id}\` → \`CAPTIONS=1 bash scripts/render.sh ${id}\` → \`bun scripts/build_materials.ts\` → \`bun scripts/export_deliverables.ts ${id}\``,
        '- 台詞を変えずに作り直すだけなら、VOICEVOX の代わりに素材を取り出す: `bun scripts/materials.ts pull`（docs/guide/quickstart.md の「B. 素材から作る」）',
        '- 場面だけ見る: `npm run studio`（props の captions を true にすると字幕つき）',
        lang === 'ja'
          ? '- ナレーション: VOICEVOX:No.7（講師）、VOICEVOX:青山龍星（呼び込み）。BGM・効果音はプログラムで合成したオリジナル'
          : '- ナレーション: Kokoro-82M（Apache-2.0。声は content/voices.ts の KOKORO）。BGM・効果音はプログラムで合成したオリジナル',
        '',
      ].join('\n'),
    );
    console.log(`out/deliverables/${course.id}/${id}/  ${got.length} ファイル`);
  }
};

if (import.meta.main) await runMain(main);
