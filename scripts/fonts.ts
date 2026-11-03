// 動画と講座サイトの書体（engine/fonts/ の woff2）を作り直す・確かめる。書体は、台本の全部の文字（全講座・全言語）だけを入れたサブセット。
//   bun scripts/fonts.ts            # 作り直す（npm run fonts）。台本に新しい文字が増えたときに流し、engine/fonts/ を commit する
//   bun scripts/fonts.ts --check    # 確かめるだけ（npm run validate も同じものを見る）
// 作り直す: 元の書体（Google Fonts の配布元 google/fonts の、固定した commit の TTF）を取って sha256 を確かめ、
//   台本の文字でサブセットにする（fonttools を uvx で、版を固定して流す）。書体の一覧・太さ・文字を集める言語は engine/core/fonts.ts の FONTS、
//   出どころ（URL・sha256・版）と作ったファイルの sha256 は engine/fonts/fonts.json、ライセンスの文は engine/fonts/OFL-<書体>.txt
//   元の書体は共有のキャッシュ（CHALKFILE_CACHE_DIR。既定 ~/.cache/chalkfile/fonts/）に置く。要るもの: uv と、初回だけネット
// 確かめる（誤り）: 動画が描く文字（場面・題・クレジットなど。engine/core/fonts.ts の videoText）に、その動画の書体（テーマと言語の書体と
//   等幅の書体）に無い文字があるか（書体に無い文字は手元の書体で描くので、書き出す機械で字形が変わる）・書体のファイルが fonts.json と合うか
// 確かめる（注意）: 台本の文字（読む教材も。講座サイトも同じ書体を使う）が、サブセットに入っていないか（作り直しを忘れたとき）
// 終了コード: 0 できた（誤りなし）・1 失敗（誤りがある）・2 使い方の誤り・3 前提が足りない（uv・ネット）
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LANGS, type Lang } from '../content/i18n';
import type { Course, Theme, Video } from '../content/types';
import { charSet, courseText, FONT_DIR, FONTS, type FontId, fontsFor, inRanges, videoText } from '../engine/core/fonts';
import { MissingError, readArgs, runMain, showHelp } from './lib/args';
import { writeAtomic } from './lib/fsx';
import { sha256File } from './lib/hash';
import { cacheDir, ROOT } from './lib/paths';
import { run } from './lib/proc';
import { woff2CodePoints } from './lib/woff2';
import type { PublishIssue } from './validate';

/* ───────────── 元の書体（出どころ） ───────────── */

/** 元の書体の配布元（Google Fonts の書体の正本のリポジトリ）と、固定した commit（2026-11-02 の main） */
export const UPSTREAM = {
  repo: 'https://github.com/google/fonts',
  commit: '2fe1e8c6b137fb13041a7cfca6fdcd8a910ea4dc',
} as const;

/** 書体を作る道具の版（uvx で取る。版を変えると、ファイルの中身が変わることがある） */
export const TOOLS = { fonttools: '4.68.0', brotli: '1.2.1' } as const;

type Upstream = {
  /** google/fonts の中の場所 */
  path: string;
  sha256: string;
  bytes: number;
  /** 元の書体の版（name の 5 番。作るときに確かめる） */
  version: string;
  /** 太さのほかの軸を、この値に固める（Google Fonts も、頼まない軸は既定の値に固めて配る） */
  pin?: Record<string, number>;
};

/** 作るファイル → 元の書体 */
export const SOURCES: Record<string, Upstream> = {
  'zen-maru-gothic-500.woff2': {
    path: 'ofl/zenmarugothic/ZenMaruGothic-Medium.ttf',
    sha256: '3cfdb98a13571ede17fcc769f5093a97c38b80a7b9b2ab754a26b4d822092b3b',
    bytes: 3810988,
    version: 'Version 1.001',
  },
  'zen-maru-gothic-700.woff2': {
    path: 'ofl/zenmarugothic/ZenMaruGothic-Bold.ttf',
    sha256: 'fe24426b9c8b5523a0146a8235c8674eccf0493af354a53ec895c3596d9eb745',
    bytes: 3779008,
    version: 'Version 1.001',
  },
  'zen-maru-gothic-900.woff2': {
    path: 'ofl/zenmarugothic/ZenMaruGothic-Black.ttf',
    sha256: '6bd74fe76cd39ee0ec18775c3661d845343fb3f6f8fa09a3076638417baf741f',
    bytes: 3710324,
    version: 'Version 1.001',
  },
  'noto-sans-jp.woff2': {
    path: 'ofl/notosansjp/NotoSansJP[wght].ttf',
    sha256: 'c2f3b4d463500a2ddcd3849cded1fceeb9fd6d1c32e6cbecd568453ba50fc68f',
    bytes: 9589900,
    version: 'Version 2.004-H2;hotconv 1.0.118;makeotfexe 2.5.65603',
  },
  'noto-sans-sc.woff2': {
    path: 'ofl/notosanssc/NotoSansSC[wght].ttf',
    sha256: 'a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da',
    bytes: 17772300,
    version: 'Version 2.004-H2;hotconv 1.0.118;makeotfexe 2.5.65603',
  },
  'inter.woff2': {
    path: 'ofl/inter/Inter[opsz,wght].ttf',
    sha256: '29160a80ff49ddcab2c97711247e08b1fab27a484a329ce8b813d820dc559031',
    bytes: 876576,
    version: 'Version 4.001;git-66647c0bb',
    pin: { opsz: 14 },
  },
  'jetbrains-mono.woff2': {
    path: 'ofl/jetbrainsmono/JetBrainsMono[wght].ttf',
    sha256: '48715a42ec242c21e9f02692891e147d022299a52e48d5e413e1a942193ffeda',
    bytes: 187208,
    version: 'Version 2.211',
  },
};

/** 書体ごとのライセンスの文（OFL 1.1。著作権の表示を含む）。書体のファイルの隣に OFL-<名前>.txt として置く */
export const LICENSES: Record<FontId, { path: string; sha256: string; file: string }> = {
  'zen-maru': {
    path: 'ofl/zenmarugothic/OFL.txt',
    sha256: '2a20cf7ce1909d8ee1e949095d340f7d7656705f7c810a2d6faf56800ad0cb3d',
    file: 'OFL-zen-maru-gothic.txt',
  },
  noto: {
    path: 'ofl/notosansjp/OFL.txt',
    sha256: '1c05c68c34f9708415aada51f17e1b0092d2cea709bf4a94cd38114f9e73d7d9',
    file: 'OFL-noto-sans-jp.txt',
  },
  'noto-sc': {
    path: 'ofl/notosanssc/OFL.txt',
    sha256: '1c05c68c34f9708415aada51f17e1b0092d2cea709bf4a94cd38114f9e73d7d9',
    file: 'OFL-noto-sans-sc.txt',
  },
  inter: {
    path: 'ofl/inter/OFL.txt',
    sha256: '5b9321a4298cfeb6b34354164a1c3afc3db114569984c502b9b35d988fd58c57',
    file: 'OFL-inter.txt',
  },
  mono: {
    path: 'ofl/jetbrainsmono/OFL.txt',
    sha256: 'b2fe5e8987594e9ffd1d2ca52a2f5d73eb8335243893c5d6254b5ad69269591d',
    file: 'OFL-jetbrains-mono.txt',
  },
};

/** google/fonts の固定した commit の、そのファイルの URL（[ ] は %5B %5D にする） */
export const upstreamUrl = (p: string) =>
  `https://raw.githubusercontent.com/google/fonts/${UPSTREAM.commit}/${p.split('/').map(encodeURIComponent).join('/')}`;

/* ───────────── fonts.json（作ったものの記録） ───────────── */

export const MANIFEST = path.join(FONT_DIR, 'fonts.json');

type FileRecord = {
  file: string;
  weights: readonly number[];
  sha256: string;
  bytes: number;
  /** 入っている文字の数 */
  chars: number;
  /** 入れようとしたのに、元の書体に無かった文字（これらは、ほかの書体か手元の書体で描かれる） */
  missing: string;
  source: Upstream & { url: string };
};
export type FontManifest = {
  schema: 1;
  upstream: typeof UPSTREAM;
  tools: typeof TOOLS;
  fonts: Record<FontId, { family: string; license: 'OFL-1.1'; licenseFile: string; files: FileRecord[] }>;
};

export const readManifest = (root = ROOT): FontManifest => JSON.parse(readFileSync(path.join(root, MANIFEST), 'utf8'));

/* ───────────── 入れる文字 ───────────── */

type TextSource = { videos: readonly Video[]; coursesIn: (lang: Lang) => Course[] };

/** その書体に入れる文字（書体の言語の、全部の動画が描く文字と、全部の講座の台本の文字。英字の書体は範囲の中だけ） */
export const requestedChars = (id: FontId, { videos, coursesIn }: TextSource): number[] => {
  const font = FONTS[id];
  const texts = [
    ...videos.filter((v) => font.langs.includes(v.lang)).map(videoText),
    ...font.langs.flatMap((lang) => coursesIn(lang).map(courseText)),
  ];
  return charSet(texts).filter((cp) => inRanges(cp, font.ranges));
};

const label = (cp: number) => `${String.fromCodePoint(cp)}（U+${cp.toString(16).toUpperCase().padStart(4, '0')}）`;

/* ───────────── 確かめる ───────────── */

/** 書体のファイルに入っている文字（太さごとにファイルがある書体は、全部のファイルにある文字） */
const coverageOf = (id: FontId, root: string): Set<number> => {
  const sets = FONTS[id].files.map((f) => woff2CodePoints(readFileSync(path.join(root, FONT_DIR, f.file))));
  return new Set([...sets[0]].filter((cp) => sets.every((s) => s.has(cp))));
};

/**
 * 書体の誤りと注意（npm run validate と --check）。誤り: 動画が描く文字が、その動画の書体に無い・書体のファイルが fonts.json と合わない。
 * 注意: 台本の文字がサブセットに入っていない（作り直しを忘れた。講座サイトも同じ書体を使う）
 */
export const fontIssues = (src: TextSource & { themeOf: (id?: string) => Theme }, root = ROOT): PublishIssue[] => {
  const out: PublishIssue[] = [];
  const fail = (where: string, message: string) => out.push({ level: 'error', rule: 'font', where, message });
  let manifest: FontManifest;
  try {
    manifest = readManifest(root);
  } catch (e) {
    fail(MANIFEST, `読めない（npm run fonts で作り直す）: ${e instanceof Error ? e.message : String(e)}`);
    return out;
  }
  const ids = Object.keys(FONTS) as FontId[];
  for (const id of ids) {
    const rec = manifest.fonts?.[id];
    for (const f of FONTS[id].files) {
      const file = path.join(root, FONT_DIR, f.file);
      const r = rec?.files.find((x) => x.file === f.file);
      if (!existsSync(file)) fail(`${FONT_DIR}/${f.file}`, '書体のファイルが無い（npm run fonts で作る）');
      else if (!r) fail(MANIFEST, `${f.file} の記録が無い（npm run fonts で作り直す）`);
      else if (sha256File(file) !== r.sha256)
        fail(`${FONT_DIR}/${f.file}`, `fonts.json の sha256 と合わない（手で直さない。npm run fonts で作り直す）`);
    }
  }
  if (out.length) return out;
  const coverage = new Map(ids.map((id) => [id, coverageOf(id, root)] as const));
  const missingIn = new Map(
    ids.map((id) => [id, new Set(charSet(manifest.fonts[id].files.map((f) => f.missing)))] as const),
  );
  for (const v of src.videos) {
    const stack: FontId[] = [...fontsFor(src.themeOf(v.course.theme), v.lang), 'mono'];
    const lacking = charSet([videoText(v)]).filter(
      (cp) => cp !== 0x20 && !stack.some((id) => coverage.get(id)?.has(cp)),
    );
    if (!lacking.length) continue;
    const absent = lacking.filter((cp) => stack.some((id) => missingIn.get(id)?.has(cp)));
    fail(
      `${v.course.id}/${v.key}`,
      `動画の文字に、書体（${stack.map((id) => FONTS[id].family).join('・')}）に無い文字がある: ${lacking.map(label).join(' ')}` +
        (absent.length === lacking.length
          ? '。元の書体にも無いので、台本の文字を変える'
          : '。npm run fonts で作り直す（元の書体にも無い文字なら、台本の文字を変える）'),
    );
  }
  for (const id of ids) {
    const stale = requestedChars(id, src).filter((cp) => !coverage.get(id)?.has(cp) && !missingIn.get(id)?.has(cp));
    if (stale.length)
      out.push({
        level: 'warning',
        rule: 'font',
        where: `${FONT_DIR}（${FONTS[id].family}）`,
        message: `台本の文字が書体のサブセットに入っていない（npm run fonts で作り直す）: ${stale.slice(0, 20).map(label).join(' ')}${stale.length > 20 ? ` ほか ${stale.length - 20} 字` : ''}`,
      });
  }
  return out;
};

/* ───────────── 作り直す ───────────── */

/** 元の書体を取る（キャッシュにあって sha256 が合えば、それを使う）。取ったものは sha256 を確かめてから置く */
const fetchUpstream = async (p: string, sha256: string): Promise<string> => {
  const dir = path.join(cacheDir(), 'fonts');
  const file = path.join(dir, `${sha256}${path.extname(p)}`);
  if (existsSync(file) && sha256File(file) === sha256) return file;
  const url = upstreamUrl(p);
  let res: Response;
  try {
    res = await fetch(url);
  } catch (e) {
    throw new MissingError(
      `元の書体を取れない（ネットにつながっているか確かめる）: ${url}（${e instanceof Error ? e.message : String(e)}）`,
    );
  }
  if (!res.ok) throw new Error(`元の書体を取れない（HTTP ${res.status}）: ${url}`);
  const tmp = `${file}.${process.pid}.tmp`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(tmp, new Uint8Array(await res.arrayBuffer()));
  const got = sha256File(tmp);
  if (got !== sha256) {
    rmSync(tmp, { force: true });
    throw new Error(
      `元の書体の sha256 が違う（${url}。期待 ${sha256}・取れたもの ${got}）。固定した commit の中身が変わったか、途中で壊れた`,
    );
  }
  renameSync(tmp, file);
  return file;
};

/** fonttools を、固定した版で流す（uvx） */
const fonttools = (args: string[], what: string) => {
  const r = run(
    'uvx',
    ['--quiet', '--from', `fonttools==${TOOLS.fonttools}`, '--with', `brotli==${TOOLS.brotli}`, ...args],
    { timeoutMs: 10 * 60_000 },
  );
  if (r.code !== 0 || r.timedOut)
    throw new Error(`${what} が失敗した: ${(r.stderr || r.stdout).trim().split('\n').slice(-5).join(' / ')}`);
  return r.stdout;
};

/** 書体の名前の表の 5 番（版） */
const versionOf = (ttf: string): string =>
  fonttools(
    [
      'python',
      '-I',
      '-c',
      'import sys\nfrom fontTools.ttLib import TTFont\nprint(TTFont(sys.argv[1], lazy=True)["name"].getDebugName(5))',
      ttf,
    ],
    '版の読み取り',
  ).trim();

const build = async (src: TextSource) => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'chalkfile-fonts-'));
  try {
    const manifest: FontManifest = { schema: 1, upstream: UPSTREAM, tools: TOOLS, fonts: {} as FontManifest['fonts'] };
    for (const id of Object.keys(FONTS) as FontId[]) {
      const font = FONTS[id];
      const chars = requestedChars(id, src);
      const textFile = path.join(tmp, `${id}.txt`);
      writeFileSync(textFile, String.fromCodePoint(...chars));
      const files: FileRecord[] = [];
      for (const f of font.files) {
        const up = SOURCES[f.file];
        if (!up) throw new Error(`${f.file} の元の書体が scripts/fonts.ts の SOURCES に無い`);
        let ttf = await fetchUpstream(up.path, up.sha256);
        const version = versionOf(ttf);
        if (version !== up.version) throw new Error(`${up.path} の版が ${version}（SOURCES には ${up.version}）`);
        if (up.pin) {
          const pinned = path.join(tmp, `${f.file}.pinned.ttf`);
          const axes = Object.entries(up.pin).map(([k, v]) => `${k}=${v}`);
          // 時刻を書き換えない（作り直しても同じファイルになるように）
          fonttools(
            ['fonttools', 'varLib.instancer', ttf, ...axes, '-o', pinned, '-q', '--no-recalc-timestamp'],
            `${f.file} の軸を固める`,
          );
          ttf = pinned;
        }
        const out = path.join(tmp, f.file);
        // 字形の置き換えと位置の調整（OpenType の機能）は全部残す（数の幅をそろえる tnum など）。名前の表も全部残す（著作権とライセンスの表示）
        fonttools(
          [
            'pyftsubset',
            ttf,
            `--text-file=${textFile}`,
            `--output-file=${out}`,
            '--flavor=woff2',
            '--layout-features=*',
            '--name-IDs=*',
          ],
          `${f.file} のサブセット`,
        );
        const data = readFileSync(out);
        const got = woff2CodePoints(data);
        const missing = chars.filter((cp) => !got.has(cp) && cp !== 0x20);
        writeAtomic(path.join(ROOT, FONT_DIR, f.file), data);
        files.push({
          file: f.file,
          weights: f.weights,
          sha256: sha256File(out),
          bytes: data.length,
          chars: got.size,
          missing: String.fromCodePoint(...missing),
          source: { ...up, url: upstreamUrl(up.path) },
        });
        console.log(
          `${FONT_DIR}/${f.file}  ${(data.length / 1024).toFixed(0)} KiB・${got.size} 字${missing.length ? `（元の書体に無い ${missing.length} 字: ${missing.map(label).join(' ')}）` : ''}`,
        );
      }
      const lic = LICENSES[id];
      const licFile = await fetchUpstream(lic.path, lic.sha256);
      writeAtomic(path.join(ROOT, FONT_DIR, lic.file), readFileSync(licFile));
      manifest.fonts[id] = { family: font.family, license: 'OFL-1.1', licenseFile: lic.file, files };
    }
    writeAtomic(path.join(ROOT, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(
      `${MANIFEST} を書いた（fonttools ${TOOLS.fonttools}・元の書体 ${UPSTREAM.repo} @ ${UPSTREAM.commit.slice(0, 7)}）`,
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
};

const main = async (argv: string[]) => {
  const { values } = readArgs(argv, { check: { type: 'boolean' } });
  if (values.help) return showHelp(import.meta.filename);
  const { VIDEOS, coursesIn } = await import('../content');
  const { themeOf } = await import('../content/themes');
  const src = { videos: VIDEOS, coursesIn, themeOf };
  if (!values.check) {
    if (run('uvx', ['--version']).code !== 0)
      throw new MissingError('uvx が動かない（uv を入れる。docs/guide/quickstart.md の「前提の道具」）');
    await build(src);
  }
  const issues = fontIssues(src);
  for (const x of issues) console.log(`${x.level === 'error' ? '誤り' : '注意'}  ${x.where}  ${x.message}`);
  const errors = issues.filter((x) => x.level === 'error').length;
  console.log(
    `書体の点検: 誤り ${errors} 件・注意 ${issues.length - errors} 件（${Object.keys(FONTS).length} 書体・${VIDEOS.length} 本の動画・${LANGS.length} 言語）`,
  );
  return errors ? 1 : 0;
};

if (import.meta.main) await runMain(main);
