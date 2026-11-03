// 静止画の比較（動画の見た目が変わっていないかを見る）。基準の版（--base。既定は origin/main）と今の作業フォルダで、
// 同じ「場面 × テーマ」の静止画（場面の終わり。要素が出そろった状態）を書き出し、ffmpeg の PSNR で比べる。
// 見た目を変えないはずの整理の PR では必ず流し、結果（report.md）を PR に貼る。
//   bun scripts/stills-compare.ts                    # 実際の講座から場面の種類ごとに 1 つ（20 場面）× 5 つのテーマ
//   bun scripts/stills-compare.ts --base <ref>       # 基準の版（git の ref。先に git fetch origin しておく）
//   bun scripts/stills-compare.ts --theme night      # テーマを絞る（カンマで複数。既定は content/themes.ts の全部）
//   bun scripts/stills-compare.ts L04:3 S01.en:5,7   # 場面を指定する（動画:場面の番号。1 始まり。番号を省くと全部の場面）
//   bun scripts/stills-compare.ts --threshold 45     # PSNR（dB）がこれより低い場面を「差あり」にする（既定 45。同じ絵は inf）
//   bun scripts/stills-compare.ts --captions         # 字幕を焼き込んだ版（render.sh の CAPTIONS=1）で比べる
//   bun scripts/stills-compare.ts --concurrency 4    # 同時に書き出す枚数（既定 4）
// 出力（.work の下なのでコミットしない）: .work/stills-compare/{base,head}/<動画>-s<場面>-<テーマ>.png、
//   diff/（差があった場面だけ。左から基準・今・差を 4 倍に強めた絵）、report.md（PR に貼る表）、report.json
// 基準の版は一時の worktree（git worktree add --detach）に作り、node_modules は cp -c（APFS の複製）で写す。終わったら git worktree remove で片付ける。
// 差があるか、書き出せなかった場面があれば 1 で終える。書体は Google Fonts から読むので、ネットにつながっている必要がある
import { bundle } from '@remotion/bundler';
import { openBrowser, renderStill, selectComposition } from '@remotion/renderer';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { VIDEOS } from '../content';
import { compositionId } from '../content/i18n';
import { THEMES } from '../content/themes';
import type { Scene } from '../content/types';
import { SCENE_KINDS } from '../engine/core/scenes';
import { readTimelineEntries } from './timelines';

const ROOT = path.resolve(import.meta.dir, '..');
const OUT = path.join(ROOT, '.work/stills-compare');

type Timeline = Record<string, { scenes: { start: number; duration: number }[] }>;
type Target = { key: string; scene: number; kind: Scene['kind'] };
type Side = 'base' | 'head';
type Row = Target & { theme: string; psnr: number | null; status: 'same' | 'diff' | 'new' | 'error'; note?: string; diff?: string };

const HELP = readFileSync(import.meta.path, 'utf8')
  .split('\n')
  .filter((l) => l.startsWith('//'))
  .map((l) => l.slice(3))
  .join('\n');

const { values: opt, positionals } = parseArgs({
  options: {
    base: { type: 'string', default: 'origin/main' },
    theme: { type: 'string' },
    threshold: { type: 'string', default: '45' },
    captions: { type: 'boolean', default: false },
    concurrency: { type: 'string', default: '4' },
    help: { type: 'boolean', short: 'h', default: false },
  },
  allowPositionals: true,
  strict: true,
});
if (opt.help) {
  console.log(HELP);
  process.exit(0);
}
const threshold = Number(opt.threshold);
const concurrency = Math.max(1, Math.floor(Number(opt.concurrency)));
if (!Number.isFinite(threshold) || !Number.isFinite(concurrency)) throw new Error('--threshold と --concurrency は数で書く');

/* ───────────── 比べる場面とテーマ ───────────── */

/** 指定が無ければ、日本語の講座から場面の種類ごとに最初の 1 つ（講座と動画の並び順） */
const defaultTargets = (): Target[] =>
  SCENE_KINDS.flatMap((kind) => {
    for (const v of VIDEOS.filter((x) => x.lang === 'ja')) {
      const i = v.lecture.scenes.findIndex((s) => s.kind === kind);
      if (i >= 0) return [{ key: v.key, scene: i + 1, kind }];
    }
    return [];
  });

/** L04:3,6 → L04 の場面 3 と 6。番号を省くと、その動画の全部の場面 */
const parseTarget = (arg: string): Target[] => {
  const [key, list] = arg.split(':');
  const v = VIDEOS.find((x) => x.key === key);
  if (!v) throw new Error(`動画が無い: ${key}（例: L04、S01.en）`);
  const scenes = list ? list.split(',').map(Number) : v.lecture.scenes.map((_, i) => i + 1);
  return scenes.map((n) => {
    const s = v.lecture.scenes[n - 1];
    if (!Number.isInteger(n) || !s) throw new Error(`${key} に場面 ${n} が無い（1〜${v.lecture.scenes.length}）`);
    return { key, scene: n, kind: s.kind };
  });
};

const targets = positionals.length ? positionals.flatMap(parseTarget) : defaultTargets();
const themes = opt.theme ? opt.theme.split(',') : Object.keys(THEMES);
for (const t of themes) if (!THEMES[t]) throw new Error(`テーマが無い: ${t}（${Object.keys(THEMES).join('・')}）`);

/* ───────────── 道具 ───────────── */

const git = (...args: string[]) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const fileName = (t: Target, theme: string) => `${t.key}-s${String(t.scene).padStart(2, '0')}-${theme}${opt.captions ? '-cc' : ''}.png`;
/**
 * その版の timeline（動画の名前 → 場面の時刻）。今の形は動画ごとのファイル（content/<講座>/generated/timeline/<key>.json）。
 * 基準の版が前の形（2026-11-03 までの main。1 つのファイル src/generated/timeline.json）でも比べられるように、そちらも読む
 */
const readTimeline = (dir: string): Timeline => {
  const old = path.join(dir, 'src/generated/timeline.json');
  if (existsSync(old)) return JSON.parse(readFileSync(old, 'utf8'));
  return Object.fromEntries(readTimelineEntries(dir).flatMap((e) => (e.timeline ? [[e.key, e.timeline]] : [])));
};

/** 2 枚の PSNR（dB）。同じ絵は Infinity */
const psnr = (a: string, b: string): number => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', a, '-i', b, '-lavfi', 'psnr', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = /average:(inf|[\d.]+)/.exec(r.stderr ?? '');
  if (r.status !== 0 || !m) throw new Error(`ffmpeg で比べられない: ${(r.stderr ?? '').trim().split('\n').slice(-2).join(' ')}`);
  return m[1] === 'inf' ? Infinity : Number(m[1]);
};

/** 差の画像（左から基準・今・差を 4 倍に強めた絵。半分の大きさ） */
const diffImage = (a: string, b: string, out: string) => {
  const amp = "lutrgb=r='min(255,val*4)':g='min(255,val*4)':b='min(255,val*4)'";
  const graph = `[0:v]format=gbrp,split[a1][a2];[1:v]format=gbrp,split[b1][b2];[a1][b1]blend=all_mode=difference,${amp}[d];[a2][b2][d]hstack=inputs=3,scale=iw/2:-2,format=rgb24`;
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', a, '-i', b, '-filter_complex', graph, '-frames:v', '1', out]);
};

/** 決まった数ずつ並べて流す */
const pool = async <T>(items: T[], n: number, run: (x: T) => Promise<void>) => {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) await run(items[next++]);
  }));
};

/* ───────────── 実行 ───────────── */

// 書体を読む要求が多いという警告（@remotion/google-fonts。直すのは計画の T3A-14）は、静止画 1 枚ごとに出て一覧が読めなくなるので、ここでは出さない
for (const k of ['log', 'warn'] as const) {
  const print = console[k].bind(console);
  console[k] = (...args: unknown[]) => {
    if (!args.some((a) => typeof a === 'string' && a.includes('network requests to load fonts'))) print(...args);
  };
}

const started = Date.now();
const sha = (() => {
  try {
    return git('rev-parse', '--verify', '--quiet', `${opt.base}^{commit}`);
  } catch {
    throw new Error(`基準の版が見つからない: ${opt.base}（git fetch origin のあとで流す）`);
  }
})();
const head = git('rev-parse', '--short', 'HEAD');
const dirty = git('status', '--porcelain').length > 0;

rmSync(OUT, { recursive: true, force: true });
for (const d of ['base', 'head', 'diff', 'public']) mkdirSync(path.join(OUT, d), { recursive: true });

const tmp = mkdtempSync(path.join(os.tmpdir(), 'chalkfile-stills-'));
const baseDir = path.join(tmp, 'base');
const bundles: string[] = [];
let browser: Awaited<ReturnType<typeof openBrowser>> | null = null;
let cleaned = false;
const cleanup = async () => {
  if (cleaned) return;
  cleaned = true;
  await browser?.close({ silent: true }).catch(() => {});
  for (const b of bundles) rmSync(b, { recursive: true, force: true });
  if (existsSync(baseDir)) {
    const r = spawnSync('git', ['-C', ROOT, 'worktree', 'remove', '--force', baseDir], { encoding: 'utf8' });
    if (r.status !== 0) console.error(`一時の worktree を外せなかった。手で git worktree remove --force ${baseDir} を流す: ${r.stderr.trim()}`);
  }
  rmSync(tmp, { recursive: true, force: true });
};
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => void cleanup().finally(() => process.exit(130)));

const rows: Row[] = [];
try {
  console.log(`基準 ${opt.base}（${sha.slice(0, 7)}）と今の作業フォルダ（${head}${dirty ? '＋まだコミットしていない変更' : ''}）を比べる: ${targets.length} 場面 × ${themes.length} テーマ`);
  execFileSync('git', ['-C', ROOT, 'worktree', 'add', '--detach', baseDir, sha], { stdio: ['ignore', 'ignore', 'pipe'] });
  // node_modules は APFS の複製（cp -c）で写す（中身を写さないので速く、場所も取らない）。できない場所なら、今の node_modules を指す
  const copy = spawnSync('cp', ['-c', '-R', path.join(ROOT, 'node_modules'), path.join(baseDir, 'node_modules')]);
  if (copy.status !== 0) symlinkSync(path.join(ROOT, 'node_modules'), path.join(baseDir, 'node_modules'));

  const timelines: Record<Side, Timeline> = { base: readTimeline(baseDir), head: readTimeline(ROOT) };
  const publicDir = path.join(OUT, 'public');
  const serve: Record<Side, string> = { base: '', head: '' };
  for (const [side, dir] of [['base', baseDir], ['head', ROOT]] as const) {
    serve[side] = await bundle({ entryPoint: path.join(dir, 'src/index.ts'), rootDir: dir, publicDir, onProgress: () => {} });
    bundles.push(serve[side]);
  }
  browser = await openBrowser('chrome', { logLevel: 'error' });
  const instance = browser;

  const jobs = targets.flatMap((t) => themes.flatMap((theme) => (['base', 'head'] as const).map((side) => ({ t, theme, side }))));
  const failed = new Map<string, string>();
  let done = 0;
  await pool(jobs, concurrency, async ({ t, theme, side }) => {
    const s = timelines[side][t.key]?.scenes[t.scene - 1];
    const id = `${side}:${t.key}:${t.scene}:${theme}`;
    const inputProps = { id: t.key, audio: false, theme, captions: opt.captions };
    try {
      if (!s) throw new Error(`${side === 'base' ? '基準' : '今'}の timeline に、この場面が無い`);
      const composition = await selectComposition({ serveUrl: serve[side], id: compositionId(t.key), inputProps, puppeteerInstance: instance, logLevel: 'error', onBrowserLog: () => {} });
      const output = path.join(OUT, side, fileName(t, theme));
      await renderStill({ composition, serveUrl: serve[side], output, frame: s.start + s.duration - 14, inputProps, imageFormat: 'png', puppeteerInstance: instance, logLevel: 'error', overwrite: true, onBrowserLog: () => {} });
    } catch (e) {
      failed.set(id, (e instanceof Error ? e.message : String(e)).split('\n')[0]);
    }
    if (++done % 20 === 0 || done === jobs.length) console.log(`  書き出し ${done} / ${jobs.length}`);
  });

  for (const t of targets) {
    for (const theme of themes) {
      const name = fileName(t, theme);
      const [a, b] = [path.join(OUT, 'base', name), path.join(OUT, 'head', name)];
      const fb = failed.get(`base:${t.key}:${t.scene}:${theme}`);
      const fh = failed.get(`head:${t.key}:${t.scene}:${theme}`);
      if (fh) rows.push({ ...t, theme, psnr: null, status: 'error', note: `今の版: ${fh}` });
      else if (fb) rows.push({ ...t, theme, psnr: null, status: 'new', note: `基準の版: ${fb}` });
      else {
        const p = psnr(a, b);
        const row: Row = { ...t, theme, psnr: p, status: p < threshold ? 'diff' : 'same' };
        if (row.status === 'diff') {
          row.diff = path.join(OUT, 'diff', name);
          diffImage(a, b, row.diff);
        }
        rows.push(row);
      }
    }
  }
} finally {
  await cleanup();
}

/* ───────────── 報告 ───────────── */

const sec = Math.round((Date.now() - started) / 1000);
const count = (s: Row['status']) => rows.filter((r) => r.status === s).length;
const db = (p: number | null) => (p === null ? '—' : p === Infinity ? 'inf' : p.toFixed(1));
const LABEL: Record<Row['status'], string> = { same: '同じ', diff: '差あり', new: '基準に無い', error: '書き出せない' };
const rel = (p?: string) => (p ? path.relative(ROOT, p) : '');
const bad = rows.filter((r) => r.status !== 'same');
const summary = `場面 ${targets.length} × テーマ ${themes.length} = ${rows.length} 枚。同じ ${count('same')}・差あり ${count('diff')}・基準に無い ${count('new')}・書き出せない ${count('error')}（しきい値 ${threshold}dB・${sec} 秒）`;
const md = [
  `### 静止画の比較（${opt.base} ${sha.slice(0, 7)} → ${head}${dirty ? '＋変更' : ''}${opt.captions ? '・字幕つき' : ''}）`,
  '',
  summary,
  '',
  '| 場面 | 種類 | テーマ | PSNR（dB） | 結果 | 差の画像 |',
  '|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.key}:${r.scene} | ${r.kind} | ${r.theme} | ${db(r.psnr)} | ${LABEL[r.status]}${r.note ? `（${r.note}）` : ''} | ${rel(r.diff)} |`),
  '',
].join('\n');
writeFileSync(path.join(OUT, 'report.md'), md);
writeFileSync(path.join(OUT, 'report.json'), `${JSON.stringify({ base: opt.base, baseSha: sha, head, dirty, threshold, captions: opt.captions, seconds: sec, rows: rows.map((r) => ({ ...r, psnr: r.psnr === Infinity ? 'inf' : r.psnr })) }, null, 1)}\n`);
for (const r of bad) console.log(`${LABEL[r.status]}  ${r.key}:${r.scene}（${r.kind}）${r.theme}  PSNR ${db(r.psnr)}${r.note ? `  ${r.note}` : ''}${r.diff ? `  ${rel(r.diff)}` : ''}`);
console.log(summary);
console.log(`表: ${rel(path.join(OUT, 'report.md'))}（PR に貼る）`);
process.exit(count('diff') || count('error') ? 1 : 0);
