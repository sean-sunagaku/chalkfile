// 確認用の静止画を書き出す（1 回だけバンドルして複数フレームを撮る）。Node が型を取り除いて、そのまま動かす。
//   node scripts/stills.ts L01            # 各場面の終わり（要素が出そろった状態）
//   node scripts/stills.ts L01 --mid      # 各場面の中ほども
//   node scripts/stills.ts L01@120 L03@900 --scale=1
//   node scripts/stills.ts L02:3 --theme=chalkfile   # 講座のテーマの代わりに別のテーマで描く（テーマを作るとき）
//   node scripts/stills.ts N01 --captions            # 字幕を焼き込んだ版（書き出しの字幕版と同じ）で描く
//   node scripts/stills.ts P01.en:3 P01.zh --mid     # 訳の動画（レクチャー ID.言語）
//   npm run chalk -- stills L01 --mid                # 1 つの入口からも流せる（docs/guide/commands.md の「chalk」）
// npm run stills -- L01 --mid でも同じ（package.json に type が無いので Node が出す「ES module として読み直した」という注意を止める）
// 受け取った動画・場面・フレーム・--theme・--scale は、バンドルを作る前に確かめる（形の違う名前・範囲の外の場面とフレームは 2、
// timeline の無い動画は 3）。動画の名前は出力のファイルの名前になるので、形を決めておく
// 出力: out/stills/<動画>-<場面>.jpg。
// 終了コード: 0 できた・1 失敗・2 使い方の誤り（動画を渡していない・知らない引数・形の違う名前・範囲の外の場面とフレーム）・
//   3 前提が足りない（timeline が無い＝台本に無い動画か、まだ synth していない）
// Node で動かすので、型だけを読むときは import type にする（型を取り除いたあとに import が残らない）。
// scripts/lib/ の部品は、拡張子まで書いて読む（Node は拡張子を補わない）
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import type { TimelineFile } from '../engine/core/timeline';
import { MissingError, readArgs, runMain, showHelp, UsageError } from './lib/args.ts';
import { ROOT } from './lib/paths.ts';

/**
 * 動画の timeline（content/<講座>/generated/timeline/<key>.json。scripts/synth.ts が書く）。Node は TS の値を読めないので、
 * 置き場所の決まり（engine/core/generated.ts）と同じ形で、講座のフォルダを探す
 */
const timelineOf = (key: string): TimelineFile => {
  const content = path.join(ROOT, 'content');
  const found = readdirSync(content, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(content, d.name, 'generated', 'timeline', `${key}.json`))
    .filter((f) => existsSync(f));
  if (!found.length) throw new MissingError(`${key} の timeline が無い（台本に無い動画か、まだ synth していない。先に npm run synth -- ${key}）`);
  if (found.length > 1) throw new Error(`${key} の timeline が 2 つ以上の講座にある: ${found.join(' ')}`);
  return JSON.parse(readFileSync(found[0], 'utf8')) as TimelineFile;
};

/** 受け取る動画の形: 動画（L01・P01.en）・場面で絞る（L03:3,6。場面は 1 始まり）・フレームを決める（L01@120）。場面とフレームは、どちらか 1 つ */
const TARGET = /^(?<id>[A-Za-z0-9][A-Za-z0-9_-]*(?:\.[a-z]{2})?)(?:@(?<frame>\d+)|:(?<scenes>[1-9]\d*(?:,[1-9]\d*)*))?$/;
/** --theme の形（content/themes.ts のテーマの ID。空なら講座のテーマ） */
const THEME_ID = /^[a-z0-9-]*$/;

export type Target = { id: string; frame: number | null; scenes: number[] | null; timeline: TimelineFile };

/**
 * 受け取った動画を確かめて、timeline と一緒に返す（バンドルを作る前に呼ぶ）。形の違う名前と、範囲の外の場面・フレームは
 * 使い方の誤り（UsageError）、timeline の無い動画は前提が足りない（MissingError）
 */
export const parseTargets = (targets: string[], find: (key: string) => TimelineFile = timelineOf): Target[] =>
  targets.map((t) => {
    const g = TARGET.exec(t)?.groups;
    if (!g) throw new UsageError(`動画の形が違う: ${t}（例: L01・L03:3,6・L01@120・P01.en:3。場面とフレームは、どちらか 1 つ）`);
    const timeline = find(g.id);
    const scenes = g.scenes ? g.scenes.split(',').map(Number) : null;
    if (scenes?.some((n) => n > timeline.scenes.length)) throw new UsageError(`${g.id} の場面は 1〜${timeline.scenes.length}: ${t}`);
    const frame = g.frame === undefined ? null : Number(g.frame);
    if (frame !== null && frame >= timeline.durationInFrames) {
      throw new UsageError(`${g.id} のフレームは 0〜${timeline.durationInFrames - 1}: ${t}`);
    }
    return { id: g.id, frame, scenes, timeline };
  });

const main = async (argv: string[]) => {
  const { values, positionals: targets } = readArgs(
    argv,
    { mid: { type: 'boolean' }, scale: { type: 'string', default: '0.5' }, theme: { type: 'string', default: '' }, captions: { type: 'boolean' } },
    { positionals: true },
  );
  if (values.help) return showHelp(import.meta.filename);
  if (!targets.length) throw new UsageError('動画を 1 つ以上渡す（例: node scripts/stills.ts L01 --mid）');
  const { mid = false, theme, captions = false } = values;
  const scale = Number(values.scale);
  if (!(Number.isFinite(scale) && scale > 0)) throw new UsageError(`--scale は 0 より大きい数: ${values.scale}`);
  if (!THEME_ID.test(theme)) throw new UsageError(`--theme は content/themes.ts のテーマの ID（英小文字・数字・-）: ${theme}`);
  // 重い前処理（バンドル）の前に、全部の動画を確かめる
  const wanted = parseTargets(targets);
  const outDir = path.join(ROOT, 'out/stills');
  mkdirSync(outDir, { recursive: true });

  // 静止画に音は要らないので、空の public を渡す（public/ の音声を一時フォルダへ複製しない）
  const emptyPublic = path.join(ROOT, '.work/render-public');
  mkdirSync(emptyPublic, { recursive: true });
  const serveUrl = await bundle({ entryPoint: path.join(ROOT, 'src/index.ts'), publicDir: emptyPublic });
  for (const { id, frame, scenes: only, timeline: tl } of wanted) {
    const inputProps = { id, audio: false, theme, captions };
    // 訳の動画 P01.en のコンポジションは P01-en（content/i18n.ts の compositionId）
    const composition = await selectComposition({ serveUrl, id: id.replace(/\./g, '-'), inputProps });
    const frames: { f: number; name: string }[] = frame !== null
      ? [{ f: frame, name: `f${frame}` }]
      : tl.scenes.flatMap((s, i) => {
          if (only && !only.includes(i + 1)) return [];
          const list = [{ f: s.start + s.duration - 14, name: `s${String(i + 1).padStart(2, '0')}-end` }];
          if (mid) list.unshift({ f: s.start + Math.round(s.duration * 0.45), name: `s${String(i + 1).padStart(2, '0')}-mid` });
          return list;
        });
    for (const { f, name } of frames) {
      const output = path.join(outDir, `${id}-${name}${theme ? `-${theme}` : ''}${captions ? '-cc' : ''}.jpg`);
      await renderStill({ composition, serveUrl, output, frame: f, inputProps, imageFormat: 'jpeg', jpegQuality: 82, scale });
      console.log(output);
    }
  }
  // 一時フォルダに作ったバンドルを消す
  rmSync(serveUrl, { recursive: true, force: true });
};

if (import.meta.main) await runMain(main);
