// 確認用の静止画を書き出す（1 回だけバンドルして複数フレームを撮る）。
//   node scripts/stills.mjs L01            # 各場面の終わり（要素が出そろった状態）
//   node scripts/stills.mjs L01 --mid      # 各場面の中ほども
//   node scripts/stills.mjs L01@120 L03@900 --scale=1
//   node scripts/stills.mjs L02:3 --theme=chalkfile   # 講座のテーマの代わりに別のテーマで描く（テーマを作るとき）
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const mid = args.includes('--mid');
const scaleArg = args.find((a) => a.startsWith('--scale='));
const scale = scaleArg ? Number(scaleArg.split('=')[1]) : 0.5;
const themeArg = args.find((a) => a.startsWith('--theme='));
const theme = themeArg ? themeArg.split('=')[1] : '';
const targets = args.filter((a) => !a.startsWith('--'));
// L03:3,6 のように場面番号（1 始まり）で絞れる
const parseTarget = (t) => {
  const [head, scenes] = t.split(':');
  return { head, only: scenes ? scenes.split(',').map(Number) : null };
};
const timeline = JSON.parse(readFileSync(path.join(ROOT, 'src/generated/timeline.json'), 'utf8'));
const outDir = path.join(ROOT, 'out/stills');
mkdirSync(outDir, { recursive: true });

// 静止画に音は要らないので、空の public を渡す（public/ の音声を一時フォルダへ複製しない）
const emptyPublic = path.join(ROOT, '.work/render-public');
mkdirSync(emptyPublic, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.join(ROOT, 'src/index.ts'), publicDir: emptyPublic });
for (const t of targets) {
  const { head, only } = parseTarget(t);
  const [id, at] = head.split('@');
  const inputProps = { id, audio: false, theme };
  const composition = await selectComposition({ serveUrl, id, inputProps });
  const tl = timeline[id];
  const frames = at
    ? [{ f: Number(at), name: `f${at}` }]
    : tl.scenes.flatMap((s, i) => {
        if (only && !only.includes(i + 1)) return [];
        const list = [{ f: s.start + s.duration - 14, name: `s${String(i + 1).padStart(2, '0')}-end` }];
        if (mid) list.unshift({ f: s.start + Math.round(s.duration * 0.45), name: `s${String(i + 1).padStart(2, '0')}-mid` });
        return list;
      });
  for (const { f, name } of frames) {
    const output = path.join(outDir, `${id}-${name}${theme ? `-${theme}` : ''}.jpg`);
    await renderStill({ composition, serveUrl, output, frame: f, inputProps, imageFormat: 'jpeg', jpegQuality: 82, scale });
    console.log(output);
  }
}
// 一時フォルダに作ったバンドルを消す
rmSync(serveUrl, { recursive: true, force: true });
