// 確認用の静止画を書き出す（1 回だけバンドルして複数フレームを撮る）。Node が型を取り除いて、そのまま動かす。
//   node scripts/stills.ts L01            # 各場面の終わり（要素が出そろった状態）
//   node scripts/stills.ts L01 --mid      # 各場面の中ほども
//   node scripts/stills.ts L01@120 L03@900 --scale=1
//   node scripts/stills.ts L02:3 --theme=chalkfile   # 講座のテーマの代わりに別のテーマで描く（テーマを作るとき）
//   node scripts/stills.ts N01 --captions            # 字幕を焼き込んだ版（render.sh の CAPTIONS=1）で描く
//   node scripts/stills.ts P01.en:3 P01.zh --mid     # 訳の動画（レクチャー ID.言語）
// npm run stills -- L01 --mid でも同じ（package.json に type が無いので Node が出す「ES module として読み直した」という注意を止める）
// Node で動かすので、型だけを読むときは import type にする（型を取り除いたあとに import が残らない）
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TimelineFile } from '../engine/core/timeline';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const mid = args.includes('--mid');
const scaleArg = args.find((a) => a.startsWith('--scale='));
const scale = scaleArg ? Number(scaleArg.split('=')[1]) : 0.5;
const themeArg = args.find((a) => a.startsWith('--theme='));
const theme = themeArg ? themeArg.split('=')[1] : '';
const captions = args.includes('--captions');
const targets = args.filter((a) => !a.startsWith('--'));
// L03:3,6 のように場面番号（1 始まり）で絞れる
const parseTarget = (t: string) => {
  const [head, scenes] = t.split(':');
  return { head, only: scenes ? scenes.split(',').map(Number) : null };
};
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
  if (found.length !== 1) throw new Error(found.length ? `${key} の timeline が 2 つ以上の講座にある: ${found.join(' ')}` : `${key} の timeline が無い（先に npm run synth -- ${key}）`);
  return JSON.parse(readFileSync(found[0], 'utf8')) as TimelineFile;
};
const outDir = path.join(ROOT, 'out/stills');
mkdirSync(outDir, { recursive: true });

// 静止画に音は要らないので、空の public を渡す（public/ の音声を一時フォルダへ複製しない）
const emptyPublic = path.join(ROOT, '.work/render-public');
mkdirSync(emptyPublic, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.join(ROOT, 'src/index.ts'), publicDir: emptyPublic });
for (const t of targets) {
  const { head, only } = parseTarget(t);
  const [id, at] = head.split('@');
  const inputProps = { id, audio: false, theme, captions };
  // 訳の動画 P01.en のコンポジションは P01-en（content/i18n.ts の compositionId）
  const composition = await selectComposition({ serveUrl, id: id.replace(/\./g, '-'), inputProps });
  const tl = timelineOf(id);
  const frames: { f: number; name: string }[] = at
    ? [{ f: Number(at), name: `f${at}` }]
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
