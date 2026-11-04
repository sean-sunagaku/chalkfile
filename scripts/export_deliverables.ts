// 章ごとの「完成動画と編集用データ」を 1 つのフォルダにまとめる（講座サイトの外で使うとき）。
//   bun scripts/export_deliverables.ts N01 D01 M01
//   bun scripts/export_deliverables.ts S01.en S01.zh    # 訳の動画（出力は out/deliverables/<講座 ID>/S01.en/ など）
//   npm run chalk -- export --course <講座 ID>          # 1 つの入口からも流せる（docs/guide/commands.md の「chalk」）
// 出力: out/deliverables/<講座 ID>/<レクチャー ID>/
//   <id>.captioned.mp4   字幕を焼き込んだ動画（CAPTIONS=1 で書き出したもの。掛け合いの講座＝cast のある講座では要る。ほかは、あれば入れる）
//   <id>.mp4             字幕なしの動画（講座サイト用。字幕は .vtt を重ねる）
//   <id>.poster.jpg      ポスター（講座のフォルダの generated/posters/。無ければ、書き出したばかりの site/media/）
//   <id>.ja.vtt / .srt   字幕（台詞の時刻は合成の実測。訳の動画は <id>.vtt。例 S01.en.vtt）
//   <id>.mix.wav         ナレーション・BGM・効果音をまとめた音
//   <章 ID>.md           教材一式（build_materials.ts の出力。台本・絵コンテ・課題を含む。教材のある章だけ）
//   README.md            中身と、作り直し方（編集の正本は content/ の台本）と、その動画で使った全部の声のクレジット（content/voices.ts の creditsIn）
// 要るファイルが 1 つでも無ければ、何も書かずに、無いものと作り方を出して 3 で終える（足りない納品物を作らない）。
// 動画は Git に入れない（out/ は .gitignore）。
// 終了コード: 0 できた・1 失敗・2 使い方の誤り（ID が無い・知らない ID）・3 前提が足りない（要るファイルが無い）
import { constants, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { VIDEOS, type Video, videoOf } from '../content';
import { lectureCredits } from '../content/voices';
import { posterFile } from '../engine/core/generated';
import { MissingError, readArgs, runMain, showHelp, UsageError } from './lib/args';
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

/** 納品物に入れるファイル（from はリポジトリの直下からのパス、to は納品物のフォルダの中の名前、how は無いときの作り方） */
type Part = { from: string; to: string; how: string };

/** 動画の納品物に入れるファイル。need は要るもの（1 つでも無ければ止める）、extra はあれば入れるもの */
export const partsOf = ({ key: id, course, lecture: lec }: Video, root = ROOT): { need: Part[]; extra: Part[] } => {
  const captioned: Part = {
    from: `out/captioned/${id}.mp4`,
    to: `${id}.captioned.mp4`,
    how: `CAPTIONS=1 npm run render -- ${id}`,
  };
  const poster = existsSync(path.join(root, posterFile(course.id, id)))
    ? posterFile(course.id, id)
    : `site/media/${id}.jpg`;
  const need: Part[] = [
    {
      from: `site/media/${id}.mp4`,
      to: `${id}.mp4`,
      how: `npm run render -- ${id}。Releases に置いた動画なら bun scripts/media.ts pull ${course.id}`,
    },
    { from: poster, to: `${id}.poster.jpg`, how: `npm run render -- ${id}` },
    { from: `public/audio/mix/${id}.wav`, to: `${id}.mix.wav`, how: `npm run mix -- ${id}` },
    // 字幕（.vtt・.srt）は、サイトの台本と字幕の時刻から作る
    { from: `site/data/${id}.json`, to: '', how: `npm run synth -- ${id}。台詞を変えていなければ --cached-only` },
    ...(lec.material
      ? [
          {
            from: `docs/courses/${course.id}/${lec.material.id}.md`,
            to: `${lec.material.id}.md`,
            how: 'npm run build:materials',
          },
        ]
      : []),
  ];
  // 掛け合いの講座は、誰が言ったかが分からないと笑えないので、字幕を焼き込んだ版も要る（comedy.md の「字幕」）
  return course.cast ? { need: [captioned, ...need], extra: [] } : { need, extra: [captioned] };
};

/** 要るのに無いファイル（「<動画>: <パス>（<作り方>）」の一覧） */
export const lackingParts = (videos: Video[], root = ROOT): string[] =>
  videos.flatMap((v) =>
    partsOf(v, root)
      .need.filter((p) => !existsSync(path.join(root, p.from)))
      .map((p) => `${v.key}: ${p.from}（${p.how}）`),
  );

/** その動画で使った全部の声のクレジット（台詞の声から作る。訳の動画は Kokoro のモデルと話者） */
export const creditLine = ({ lecture: lec, lang }: Video): string => {
  const voices = lectureCredits(lec, lang).join('、');
  const music = 'BGM・効果音はプログラムで合成したオリジナル';
  return lang === 'ja'
    ? `- ナレーション: ${voices}。${music}`
    : `- ナレーション: ${voices}（モデルの重みは Apache-2.0。声は content/voices.ts の KOKORO）。${music}`;
};

const main = (argv: string[]) => {
  const { values, positionals: ids } = readArgs(argv, {}, { positionals: true });
  if (values.help) return showHelp(import.meta.filename);
  if (!ids.length) throw new UsageError('レクチャー ID を渡す（例: bun scripts/export_deliverables.ts N01 D01 M01）');
  for (const id of ids)
    if (!VIDEOS.some((v) => v.key === id)) throw new UsageError(`動画が無い: ${id}（例: N01、S01.en）`);
  const videos = [...new Set(ids)].map(videoOf);
  // 書く前に、全部の動画の要るファイルを確かめる（1 つでも無ければ、何も書かない）
  const lacking = lackingParts(videos);
  if (lacking.length)
    throw new MissingError(
      `納品物に要るファイルが ${lacking.length} 個無い（何も書いていない）:\n  ${lacking.join('\n  ')}`,
    );
  for (const video of videos) {
    const { key: id, lecture: lec, course, lang } = video;
    // 字幕のファイル名: 日本語は <id>.ja.vtt（今までどおり）、訳は <id>.vtt（名前に言語が入っている）
    const sub = lang === 'ja' ? `${id}.ja` : id;
    const dir = path.join(ROOT, 'out/deliverables', course.id, id);
    mkdirSync(dir, { recursive: true });
    const got: string[] = [];
    const { need, extra } = partsOf(video);
    for (const p of [...need, ...extra]) {
      const f = path.join(ROOT, p.from);
      if (!p.to || !existsSync(f)) continue;
      // APFS などでは複製せずに同じ中身を指す（ディスクを食わない）。できないファイルシステムでは普通にコピーする
      copyFileSync(f, path.join(dir, p.to), constants.COPYFILE_FICLONE);
      got.push(p.to);
    }
    const cues = (JSON.parse(readFileSync(path.join(ROOT, 'site/data', `${id}.json`), 'utf8')) as { cues: Cue[] }).cues;
    writeFileSync(
      path.join(dir, `${sub}.vtt`),
      `WEBVTT\n\n${cues.map((c, i) => `${i + 1}\n${stamp(c.start, '.')} --> ${stamp(c.end, '.')}\n${c.text}\n`).join('\n')}`,
    );
    writeFileSync(
      path.join(dir, `${sub}.srt`),
      cues.map((c, i) => `${i + 1}\n${stamp(c.start, ',')} --> ${stamp(c.end, ',')}\n${c.text}\n`).join('\n'),
    );
    got.push(`${sub}.vtt`, `${sub}.srt`);
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
        '## クレジット',
        '',
        creditLine(video),
        '',
        '## 編集と作り直し',
        '',
        lang === 'ja'
          ? `- 正本は台本 \`content/${course.id}/${id}.ts\`（台詞・画面・教材・課題）と、出典 \`content/${course.id}/sources.ts\``
          : `- 正本は日本語の台本 \`content/${course.id}/${lec.id}.ts\` と、それに重ねる訳 \`content/${course.id}/${lang}/${lec.id}.ts\`（台詞と画面の文字）`,
        `- 台詞を直したら: \`npm run synth -- ${id}\` → \`npm run mix -- ${id}\` → \`CAPTIONS=1 npm run render -- ${id}\` → \`npm run build:materials\` → \`bun scripts/export_deliverables.ts ${id}\``,
        '- 台詞を変えずに作り直すだけなら、VOICEVOX の代わりに素材を取り出す: `npm run materials:pull`（docs/guide/quickstart.md の「B. 素材から作る」）',
        '- 場面だけ見る: `npm run studio`（props の captions を true にすると字幕つき）',
        '',
      ].join('\n'),
    );
    console.log(`out/deliverables/${course.id}/${id}/  ${got.length} ファイル`);
  }
};

if (import.meta.main) await runMain(main);
