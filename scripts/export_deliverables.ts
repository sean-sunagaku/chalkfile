// 章ごとの「完成動画と編集用データ」を 1 つのフォルダにまとめる（講座サイトの外で使うとき）。
//   bun scripts/export_deliverables.ts N01 D01 M01
// 出力: out/deliverables/<講座 ID>/<レクチャー ID>/
//   <id>.captioned.mp4   日本語字幕を焼き込んだ動画（CAPTIONS=1 bash scripts/render.sh の出力）
//   <id>.mp4             字幕なしの動画（講座サイト用。字幕は .vtt を重ねる）
//   <id>.ja.vtt / .srt   字幕（台詞の時刻は合成の実測）
//   <id>.mix.wav         ナレーション・BGM・効果音をまとめた音
//   <章 ID>.md           教材一式（build_materials.ts の出力。台本・絵コンテ・課題を含む）
//   README.md            中身と、作り直し方（編集の正本は content/ の台本）
// 動画は Git に入れない（out/ は .gitignore）。
import { constants, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { courseOf, LECTURES } from '../content';

const ROOT = path.resolve(import.meta.dir, '..');
const ids = process.argv.slice(2);
if (!ids.length) {
  console.error('レクチャー ID を渡す（例: bun scripts/export_deliverables.ts N01 D01 M01）');
  process.exit(1);
}

type Cue = { start: number; end: number; text: string };
const stamp = (x: number, sep: string) => {
  const h = Math.floor(x / 3600);
  const m = Math.floor((x % 3600) / 60);
  const s = Math.floor(x % 60);
  const ms = Math.round((x - Math.floor(x)) * 1000);
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(h)}:${p(m)}:${p(s)}${sep}${p(ms === 1000 ? 999 : ms, 3)}`;
};

for (const id of ids) {
  const lec = LECTURES.find((l) => l.id === id);
  if (!lec) throw new Error(`レクチャーが無い: ${id}`);
  const course = courseOf(id);
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
    writeFileSync(path.join(dir, `${id}.ja.vtt`), `WEBVTT\n\n${cues.map((c, i) => `${i + 1}\n${stamp(c.start, '.')} --> ${stamp(c.end, '.')}\n${c.text}\n`).join('\n')}`);
    writeFileSync(path.join(dir, `${id}.ja.srt`), cues.map((c, i) => `${i + 1}\n${stamp(c.start, ',')} --> ${stamp(c.end, ',')}\n${c.text}\n`).join('\n'));
    got.push(`${id}.ja.vtt`, `${id}.ja.srt`);
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
      `- 正本は台本 \`content/${course.id}/${id}.ts\`（台詞・画面・教材・課題）と、出典 \`content/${course.id}/sources.ts\``,
      `- 台詞を直したら: \`bun scripts/synth.ts ${id}\` → \`uv run --with numpy --with scipy python scripts/mix.py ${id}\` → \`CAPTIONS=1 bash scripts/render.sh ${id}\` → \`bun scripts/build_materials.ts\` → \`bun scripts/export_deliverables.ts ${id}\``,
      '- 台詞を変えずに作り直すだけなら、VOICEVOX の代わりに素材を取り出す: `bun scripts/materials.ts pull`（README の「素材から作り直す」）',
      '- 場面だけ見る: `npx remotion studio`（props の captions を true にすると字幕つき）',
      '- ナレーション: VOICEVOX:No.7（講師）、VOICEVOX:青山龍星（呼び込み）。BGM・効果音はプログラムで合成したオリジナル',
      '',
    ].join('\n'),
  );
  console.log(`out/deliverables/${course.id}/${id}/  ${got.length} ファイル`);
}
