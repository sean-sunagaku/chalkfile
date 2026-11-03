// 静止画の比較（動画の見た目が変わっていないかを見る）。基準の版（--base。既定は origin/main）と今の作業フォルダ（--head で別の ref）で、
// 同じ「場面 × テーマ」の静止画（場面の終わり。要素が出そろった状態）を書き出し、ffmpeg の PSNR で比べる。
// 見た目を変えないはずの整理の PR では必ず流し、結果（report.md）を PR に貼る。依存を上げる PR は --base-install --head <branch> で比べる。
//   bun scripts/stills-compare.ts                    # 実際の講座から場面の種類ごとに 1 つ（20 場面）× 5 つのテーマ
//   bun scripts/stills-compare.ts --base <ref>       # 基準の版（git の ref。先に git fetch origin しておく）
//   bun scripts/stills-compare.ts --base-install     # 基準の版で npm ci --ignore-scripts する（既定は今の node_modules を写すので、依存の違いは比べられない）
//   bun scripts/stills-compare.ts --head <ref>       # 今の側を別の ref にする（一時の worktree で npm ci --ignore-scripts して書き出す。Dependabot の branch など）
//   bun scripts/stills-compare.ts --theme night      # テーマを絞る（カンマで複数。既定は content/themes.ts の全部）
//   bun scripts/stills-compare.ts L04:3 S01.en:5,7   # 場面を指定する（動画:場面の番号。1 始まり。番号を省くと全部の場面）
//   bun scripts/stills-compare.ts --threshold 45     # PSNR（dB）がこれより低い場面を「差あり」にする（既定 45。同じ絵は inf。99 なら inf でないものを全部）
//   bun scripts/stills-compare.ts --captions         # 字幕を焼き込んだ版（render.sh の CAPTIONS=1）で比べる
//   bun scripts/stills-compare.ts --concurrency 4    # 同時に書き出す枚数（既定 4）
//   bun scripts/stills-compare.ts --out .work/stills-compare/pr38   # 出力の置き場所（.work の下。既定 .work/stills-compare）。比較をいくつか残すとき
// 出力（.work の下なのでコミットしない）: <out>/{base,head}/<動画>-s<場面>-<テーマ>.png、
//   diff/（差があった場面だけ。左から基準・今・差を 4 倍に強めた絵）、report.md（PR に貼る表。両側の依存と Chrome の版も書く）、report.json。
//   流すたびに、この 5 つだけを作り直す
// 基準の版（と --head の版）は一時の worktree（git worktree add --detach）に作り、終わったら git worktree remove で片付ける。
//   node_modules は、既定では今の作業フォルダのものを cp -c（APFS の複製）で写す。--base-install の基準と --head の側は、その版で npm ci する
// 書き出しは側ごとに別のプロセス（stills-compare-side.ts）で、その側の @remotion/bundler・@remotion/renderer・Chrome Headless Shell を使う。
// 場面の選び方と種類の名前は、今の作業フォルダの台本で決める（場面の時刻は、それぞれの側の timeline から読む）。
// 差があるか、書き出せなかった場面があれば 1 で終える。書体は Google Fonts から読むので、ネットにつながっている必要がある
import { type ChildProcess, execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { VIDEOS } from '../content';
import { compositionId } from '../content/i18n';
import { THEMES } from '../content/themes';
import type { Scene } from '../content/types';
import { SCENE_KINDS } from '../engine/core/validate';
import type { SideJob, SideResult } from './stills-compare-side';

const ROOT = path.resolve(import.meta.dir, '..');
const SIDE_SCRIPT = path.join(import.meta.dir, 'stills-compare-side.ts');

type Timeline = Record<string, { scenes: { start: number; duration: number }[] }>;
type Target = { key: string; scene: number; kind: Scene['kind'] };
type Side = 'base' | 'head';
type Row = Target & {
  theme: string;
  psnr: number | null;
  status: 'same' | 'diff' | 'new' | 'error';
  note?: string;
  diff?: string;
};
/** 依存の入れ方: 今の作業フォルダから写す・その版で npm ci・今の作業フォルダそのもの */
type Deps = 'copy' | 'ci' | 'root';

/** 頭書き（最初のコメントのかたまり）を、そのまま使い方にする */
const HELP = (() => {
  const lines = readFileSync(import.meta.path, 'utf8').split('\n');
  const end = lines.findIndex((l) => !l.startsWith('//'));
  return lines
    .slice(0, end)
    .map((l) => l.slice(3))
    .join('\n');
})();

const { values: opt, positionals } = parseArgs({
  options: {
    base: { type: 'string', default: 'origin/main' },
    'base-install': { type: 'boolean', default: false },
    head: { type: 'string' },
    theme: { type: 'string' },
    threshold: { type: 'string', default: '45' },
    captions: { type: 'boolean', default: false },
    concurrency: { type: 'string', default: '4' },
    out: { type: 'string', default: '.work/stills-compare' },
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
if (!Number.isFinite(threshold) || !Number.isFinite(concurrency))
  throw new Error('--threshold と --concurrency は数で書く');
const OUT = path.resolve(ROOT, opt.out);
const underWork = path.relative(path.join(ROOT, '.work'), OUT);
if (!underWork || underWork === '..' || underWork.startsWith(`..${path.sep}`) || path.isAbsolute(underWork))
  throw new Error(`--out は .work の下のフォルダにする（静止画をコミットしない）: ${opt.out}`);
const deps: Record<Side, Deps> = { base: opt['base-install'] ? 'ci' : 'copy', head: opt.head ? 'ci' : 'root' };

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

const SIDE_LABEL: Record<Side, string> = { base: '基準', head: '今' };
const git = (...args: string[]) =>
  execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const commitOf = (ref: string, side: Side) => {
  try {
    return git('rev-parse', '--verify', '--quiet', `${ref}^{commit}`);
  } catch {
    throw new Error(`${SIDE_LABEL[side]}の版が見つからない: ${ref}（git fetch origin のあとで流す）`);
  }
};
const lockAt = (sha: string) => {
  try {
    return git('show', `${sha}:package-lock.json`);
  } catch {
    return null;
  }
};
const fileName = (t: Target, theme: string) =>
  `${t.key}-s${String(t.scene).padStart(2, '0')}-${theme}${opt.captions ? '-cc' : ''}.png`;
const readTimeline = (dir: string): Timeline =>
  JSON.parse(readFileSync(path.join(dir, 'src/generated/timeline.json'), 'utf8'));

/** 2 枚の PSNR（dB）。同じ絵は Infinity */
const psnr = (a: string, b: string): number => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', a, '-i', b, '-lavfi', 'psnr', '-f', 'null', '-'], {
    encoding: 'utf8',
  });
  const m = /average:(inf|[\d.]+)/.exec(r.stderr ?? '');
  if (r.status !== 0 || !m)
    throw new Error(`ffmpeg で比べられない: ${(r.stderr ?? '').trim().split('\n').slice(-2).join(' ')}`);
  return m[1] === 'inf' ? Infinity : Number(m[1]);
};

/** 差の画像（左から基準・今・差を 4 倍に強めた絵。半分の大きさ） */
const diffImage = (a: string, b: string, out: string) => {
  const amp = "lutrgb=r='min(255,val*4)':g='min(255,val*4)':b='min(255,val*4)'";
  const graph = `[0:v]format=gbrp,split[a1][a2];[1:v]format=gbrp,split[b1][b2];[a1][b1]blend=all_mode=difference,${amp}[d];[a2][b2][d]hstack=inputs=3,scale=iw/2:-2,format=rgb24`;
  const args = ['-y', '-hide_banner', '-loglevel', 'error', '-i', a, '-i', b, '-filter_complex', graph];
  execFileSync('ffmpeg', [...args, '-frames:v', '1', out]);
};

/** 子のプロセス（npm ci と、片側の書き出し）。止められたときに一緒に止める */
const children = new Set<ChildProcess>();
/** 流して、終わるのを待つ。quiet なら出力をためて返す（npm ci の長い出力は、失敗したときだけ出す） */
const run = (cmd: string, args: string[], cwd: string, quiet: boolean) =>
  new Promise<{ code: number; output: string }>((resolve, reject) => {
    const io = quiet ? 'pipe' : 'inherit';
    const child = spawn(cmd, args, { cwd, stdio: ['ignore', io, io] });
    children.add(child);
    let output = '';
    child.stdout?.on('data', (d) => {
      output += d;
    });
    child.stderr?.on('data', (d) => {
      output += d;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      children.delete(child);
      resolve({ code: code ?? 1, output });
    });
  });

/** node_modules を APFS の複製（cp -c）で写す（中身を写さないので速く、場所も取らない）。できない場所なら、今の node_modules を指す */
const copyModules = (dir: string) => {
  const to = path.join(dir, 'node_modules');
  if (spawnSync('cp', ['-c', '-R', path.join(ROOT, 'node_modules'), to]).status === 0) return;
  rmSync(to, { recursive: true, force: true });
  symlinkSync(path.join(ROOT, 'node_modules'), to);
};

/** その版の package-lock.json で入れ直す（インストール時のスクリプトは流さない） */
const npmCi = async (dir: string, side: Side, ref: string) => {
  console.log(`  ${SIDE_LABEL[side]}: npm ci --ignore-scripts（${ref}）`);
  const r = await run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], dir, true);
  if (r.code === 0) return;
  console.error(r.output.trim());
  throw new Error(`${SIDE_LABEL[side]}（${ref}）で npm ci --ignore-scripts が通らない（上の npm の出力）`);
};

/** Chrome Headless Shell（node_modules/.remotion）を今の作業フォルダから写しておく。版がちがえば、その側の renderer が取り直す */
const seedBrowser = (dir: string) => {
  const from = path.join(ROOT, 'node_modules/.remotion');
  const to = path.join(dir, 'node_modules/.remotion');
  if (dir === ROOT || !existsSync(from) || existsSync(to)) return;
  if (spawnSync('cp', ['-c', '-R', from, to]).status !== 0) rmSync(to, { recursive: true, force: true });
};

/** 絵に効く依存と Chrome の版（書き出したあとに読む）。報告に出して、どの版どうしを比べたかを確かめられるようにする */
const PACKAGES = ['remotion', '@remotion/renderer', '@remotion/google-fonts', 'react', 'react-dom', 'lucide-react'];
const versionsAt = (dir: string) => {
  const read = (file: string) => (existsSync(file) ? readFileSync(file, 'utf8') : null);
  const out: Record<string, string> = {};
  for (const name of PACKAGES)
    out[name] = JSON.parse(read(path.join(dir, 'node_modules', name, 'package.json')) ?? '{}').version ?? '—';
  out.Chrome = read(path.join(dir, 'node_modules/.remotion/chrome-headless-shell/VERSION'))?.trim() ?? '—';
  return out;
};

/* ───────────── 実行 ───────────── */

const started = Date.now();
const baseSha = commitOf(opt.base, 'base');
const headSha = opt.head ? commitOf(opt.head, 'head') : git('rev-parse', 'HEAD');
const dirty = !opt.head && git('status', '--porcelain').length > 0;
// 写すときは、基準の版の依存と、写す node_modules（今の作業フォルダ）の依存が同じかを見る
const lockDiffers =
  deps.base === 'copy' && lockAt(baseSha) !== readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8').trim();

// 前の結果のうち、この道具が書くものだけを消す（--out で下に置いた、ほかの比較は残す）
for (const name of ['base', 'head', 'diff', 'public', 'report.md', 'report.json'])
  rmSync(path.join(OUT, name), { recursive: true, force: true });
for (const d of ['base', 'head', 'diff', 'public']) mkdirSync(path.join(OUT, d), { recursive: true });

const tmp = mkdtempSync(path.join(os.tmpdir(), 'chalkfile-stills-'));
const worktrees: string[] = [];
let cleaned = false;
const cleanup = () => {
  if (cleaned) return;
  cleaned = true;
  // 片側の書き出しは、Remotion が SIGINT で Chrome を止めてから終わる
  for (const child of children) child.kill('SIGINT');
  for (const dir of worktrees) {
    const r = spawnSync('git', ['-C', ROOT, 'worktree', 'remove', '--force', dir], { encoding: 'utf8' });
    if (r.status !== 0)
      console.error(
        `一時の worktree を外せなかった。手で git worktree remove --force ${dir} を流す: ${r.stderr.trim()}`,
      );
  }
  rmSync(tmp, { recursive: true, force: true });
};
for (const sig of ['SIGINT', 'SIGTERM'] as const)
  process.on(sig, () => {
    cleanup();
    process.exit(130);
  });

/** 一時の worktree を作り、依存を入れる */
const prepare = async (side: Side, ref: string, sha: string) => {
  const dir = path.join(tmp, side);
  execFileSync('git', ['-C', ROOT, 'worktree', 'add', '--detach', dir, sha], { stdio: ['ignore', 'ignore', 'pipe'] });
  worktrees.push(dir);
  if (deps[side] === 'ci') await npmCi(dir, side, ref);
  else copyModules(dir);
  return dir;
};

const rows: Row[] = [];
const versions: Record<Side, Record<string, string>> = { base: {}, head: {} };
try {
  const headName = opt.head
    ? `今 ${opt.head}（${headSha.slice(0, 7)}・npm ci）`
    : `今の作業フォルダ（${headSha.slice(0, 7)}${dirty ? '＋まだコミットしていない変更' : ''}）`;
  console.log(
    `基準 ${opt.base}（${baseSha.slice(0, 7)}・${deps.base === 'ci' ? 'npm ci' : '今の node_modules を写す'}）と${headName}を比べる: ${targets.length} 場面 × ${themes.length} テーマ`,
  );
  if (lockDiffers)
    console.warn(
      `注意: 基準（${opt.base}）の package-lock.json が今の作業フォルダとちがう。今の node_modules を写すので、依存の違いは比べない（比べるなら --base-install）`,
    );
  const [baseDir, headDir] = await Promise.all([
    prepare('base', opt.base, baseSha),
    opt.head ? prepare('head', opt.head, headSha) : ROOT,
  ]);

  const failed: Record<Side, Map<string, string>> = { base: new Map(), head: new Map() };
  for (const [side, dir] of [
    ['base', baseDir],
    ['head', headDir],
  ] as const) {
    const timeline = readTimeline(dir);
    const stills: SideJob['stills'] = [];
    for (const t of targets) {
      for (const theme of themes) {
        const name = fileName(t, theme);
        const s = timeline[t.key]?.scenes[t.scene - 1];
        if (!s) failed[side].set(name, 'timeline に、この場面が無い');
        else {
          const inputProps = { id: t.key, audio: false, theme, captions: opt.captions };
          stills.push({ name, composition: compositionId(t.key), frame: s.start + s.duration - 14, inputProps });
        }
      }
    }
    if (stills.length) {
      seedBrowser(dir);
      const job: SideJob = {
        dir,
        label: SIDE_LABEL[side],
        outDir: path.join(OUT, side),
        bundleDir: path.join(tmp, `${side}-bundle`),
        publicDir: path.join(OUT, 'public'),
        concurrency,
        stills,
      };
      const jobPath = path.join(tmp, `${side}.json`);
      writeFileSync(jobPath, JSON.stringify(job));
      // cwd をその側のフォルダにする（renderer は Chrome Headless Shell を cwd の node_modules/.remotion に置く）
      const r = await run(process.execPath, [SIDE_SCRIPT, jobPath], dir, false);
      const resultPath = jobPath.replace(/\.json$/, '.result.json');
      const result: SideResult = existsSync(resultPath)
        ? JSON.parse(readFileSync(resultPath, 'utf8'))
        : { failed: {}, fatal: `終了コード ${r.code}` };
      if (result.fatal) throw new Error(`${SIDE_LABEL[side]}の版を書き出せない: ${result.fatal}`);
      for (const [name, why] of Object.entries(result.failed)) failed[side].set(name, why);
    }
    versions[side] = versionsAt(dir);
  }

  for (const t of targets) {
    for (const theme of themes) {
      const name = fileName(t, theme);
      const [a, b] = [path.join(OUT, 'base', name), path.join(OUT, 'head', name)];
      const fb = failed.base.get(name);
      const fh = failed.head.get(name);
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
  cleanup();
}

/* ───────────── 報告 ───────────── */

const sec = Math.round((Date.now() - started) / 1000);
const count = (s: Row['status']) => rows.filter((r) => r.status === s).length;
const db = (p: number | null) => (p === null ? '—' : p === Infinity ? 'inf' : p.toFixed(1));
const LABEL: Record<Row['status'], string> = { same: '同じ', diff: '差あり', new: '基準に無い', error: '書き出せない' };
const DEPS_LABEL: Record<Deps, string> = {
  copy: '今の作業フォルダの node_modules を写した',
  ci: 'その版の package-lock.json で npm ci した',
  root: '今の作業フォルダのもの',
};
const rel = (p?: string) => (p ? path.relative(ROOT, p) : '');
const bad = rows.filter((r) => r.status !== 'same');
const compared = rows.flatMap((r) => (r.psnr === null ? [] : [r.psnr]));
const minPsnr = compared.length ? Math.min(...compared) : null;
// しきい値より上でも、inf でなければ絵は少し変わっている（アイコンの形の違いなどは 45〜80dB になる）
const nearSame = rows.filter((r) => r.status === 'same' && r.psnr !== Infinity).length;
const summary = `場面 ${targets.length} × テーマ ${themes.length} = ${rows.length} 枚。同じ ${count('same')}（うち inf でない ${nearSame}）・差あり ${count('diff')}・基準に無い ${count('new')}・書き出せない ${count('error')}・最小の PSNR ${db(minPsnr)}（しきい値 ${threshold}dB・${sec} 秒）`;
const headTitle = opt.head ? `${opt.head} ${headSha.slice(0, 7)}` : `${headSha.slice(0, 7)}${dirty ? '＋変更' : ''}`;
// 版（基準 → 今）。同じものは 1 つだけ書く
const versionLine = Object.keys(versions.base)
  .map((k) => `${k} ${versions.base[k]}${versions.base[k] === versions.head[k] ? '' : ` → ${versions.head[k]}`}`)
  .join('・');
const md = [
  `### 静止画の比較（${opt.base} ${baseSha.slice(0, 7)} → ${headTitle}${opt.captions ? '・字幕つき' : ''}）`,
  '',
  `依存（node_modules）: 基準は${DEPS_LABEL[deps.base]}${lockDiffers ? '（基準の package-lock.json とはちがう）' : ''}、今は${DEPS_LABEL[deps.head]}`,
  '',
  `版（基準 → 今）: ${versionLine}`,
  '',
  summary,
  '',
  '| 場面 | 種類 | テーマ | PSNR（dB） | 結果 | 差の画像 |',
  '|---|---|---|---|---|---|',
  ...rows.map(
    (r) =>
      `| ${r.key}:${r.scene} | ${r.kind} | ${r.theme} | ${db(r.psnr)} | ${LABEL[r.status]}${r.note ? `（${r.note}）` : ''} | ${rel(r.diff)} |`,
  ),
  '',
].join('\n');
writeFileSync(path.join(OUT, 'report.md'), md);
const json = {
  base: opt.base,
  baseSha,
  head: opt.head ?? null,
  headSha,
  dirty,
  deps,
  lockDiffers,
  versions,
  threshold,
  captions: opt.captions,
  seconds: sec,
  rows: rows.map((r) => ({ ...r, psnr: r.psnr === Infinity ? 'inf' : r.psnr })),
};
writeFileSync(path.join(OUT, 'report.json'), `${JSON.stringify(json, null, 1)}\n`);
for (const r of bad)
  console.log(
    `${LABEL[r.status]}  ${r.key}:${r.scene}（${r.kind}）${r.theme}  PSNR ${db(r.psnr)}${r.note ? `  ${r.note}` : ''}${r.diff ? `  ${rel(r.diff)}` : ''}`,
  );
console.log(`版（基準 → 今）: ${versionLine}`);
console.log(summary);
console.log(`表: ${rel(path.join(OUT, 'report.md'))}（PR に貼る）`);
process.exit(count('diff') || count('error') ? 1 : 0);
