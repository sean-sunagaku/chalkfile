// 動画の素材（台詞の音声と読み・BGM とジングル・効果音）を、素材だけを置くブランチ `materials` と出し入れする。
// 素材があれば、台詞を変えていない章は VOICEVOX なしで、時刻 → 音のミックス → 動画 → 講座サイトまで作り直せる。
//   bun scripts/materials.ts pull [講座 ID …] [--videos]   # 素材を取り出す（--videos で、公開中のサイトの動画とポスターも）
//   bun scripts/materials.ts check [講座 ID …]             # 台本の全部の台詞の音声が手元にあるか
//   bun scripts/materials.ts push [--message 文]           # 手元の素材で `materials` ブランチを作り直して push する
// 素材は main の履歴に入れない。親の無い 1 コミットのブランチに置き、push のたびに置き換える（gh-pages と同じ考え方）。
// 音声は FLAC（可逆圧縮）で置き、取り出すときに WAV に戻す。SHA256SUMS で、戻した WAV が元と同じかを確かめる。
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { COURSES } from '../content';
import type { Course } from '../content/types';
import { speechOf, ttsKey } from './voices';

const ROOT = path.resolve(import.meta.dir, '..');
const BRANCH = 'materials';
const REMOTE = process.env.MATERIALS_REMOTE ?? 'origin';
const TRACKING = `refs/remotes/${REMOTE}/${BRANCH}`;
const PAGES = `refs/remotes/${REMOTE}/gh-pages`;
const TTS = '.work/tts';
/** BGM・ジングル・効果音（scripts/build_music.py の出力）と、ブランチの中の置き場所 */
const AUDIO_DIRS: [local: string, inBranch: string][] = [
  ['public/audio/music', 'audio/music'],
  ['public/audio/sfx', 'audio/sfx'],
];

const git = (args: string[], opts: { env?: Record<string, string>; input?: string; quiet?: boolean } = {}): string =>
  execFileSync('git', args, {
    cwd: ROOT,
    env: { ...process.env, ...opts.env },
    input: opts.input,
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['pipe', 'pipe', opts.quiet ? 'pipe' : 'inherit'],
  })
    .toString()
    .trim();

const sha256 = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const mb = (bytes: number) => `${(bytes / 1e6).toFixed(1)}MB`;
const sizeOf = (files: string[]) => files.reduce((s, f) => s + statSync(f).size, 0);

/** WAV と FLAC の変換を、ffmpeg で 8 本ずつ並べて流す。FLAC は可逆なので、WAV に戻すと元と同じバイトになる */
const convertAll = async (jobs: [from: string, to: string][], to: 'flac' | 'wav') => {
  let next = 0;
  const worker = async () => {
    for (let job = jobs[next++]; job; job = jobs[next++]) {
      const [src, dest] = job;
      mkdirSync(path.dirname(dest), { recursive: true });
      const codec = to === 'flac' ? ['-c:a', 'flac', '-compression_level', '8'] : ['-c:a', 'pcm_s16le', '-f', 'wav'];
      await new Promise<void>((resolve, reject) => {
        const p = spawn('ffmpeg', ['-nostdin', '-y', '-hide_banner', '-loglevel', 'error', '-i', src, '-map_metadata', '-1', '-bitexact', ...codec, dest], {
          stdio: ['ignore', 'ignore', 'inherit'],
        });
        p.on('error', reject);
        p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg が失敗した: ${src}`))));
      });
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
};

const pickCourses = (ids: string[]): Course[] =>
  ids.length
    ? ids.map((id) => {
        const c = COURSES.find((x) => x.id === id);
        if (!c) throw new Error(`講座が無い: ${id}（${COURSES.map((x) => x.id).join(', ')}）`);
        return c;
      })
    : COURSES;

/** 講座の台本の全部の台詞の、音声ファイルの名前（synth.ts と同じ決め方） */
const keysOf = (course: Course): string[] => {
  const keys = new Set<string>();
  for (const lec of course.lectures) for (const scene of lec.scenes) for (const line of scene.lines) keys.add(ttsKey(speechOf(line), line.v ?? 'narrator'));
  return [...keys].sort();
};

const hasVoice = (key: string) => existsSync(path.join(ROOT, TTS, `${key}.wav`)) && existsSync(path.join(ROOT, TTS, `${key}.kana`));

const check = (courses: Course[]): boolean => {
  let ok = true;
  for (const c of courses) {
    const keys = keysOf(c);
    const missing = keys.filter((k) => !hasVoice(k));
    console.log(`${c.id}: 台詞の音声 ${keys.length - missing.length}/${keys.length}${missing.length ? '（足りない。bun scripts/materials.ts pull か、VOICEVOX で bun scripts/synth.ts）' : ''}`);
    if (missing.length) ok = false;
  }
  for (const [local] of AUDIO_DIRS) {
    const dir = path.join(ROOT, local);
    const n = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.wav')).length : 0;
    console.log(`${local}: ${n} 個${n ? '' : '（足りない。bun scripts/materials.ts pull か、scripts/build_music.py）'}`);
    if (!n) ok = false;
  }
  return ok;
};

const readmeOf = (source: string, perCourse: { course: Course; clips: number; bytes: number }[], audioCount: number, audioBytes: number, total: number) => `# Chalkfile の動画の素材

講座の動画を作るための素材だけを置くブランチです。main にはマージしません（\`bun scripts/materials.ts push\` のたびに、親の無い 1 コミットで置き換えます）。

素材があれば、台詞を変えていない章は VOICEVOX なしで、時刻 → 音のミックス → 動画 → 講座サイトまで作り直せます。手順はリポジトリの README の「素材から作り直す」です。

- 元にした台本: \`${source}\`
- 全部で ${mb(total)}（音声は FLAC。取り出すと WAV に戻り、\`SHA256SUMS\` と同じ中身になる）

| パス | 中身 | 数 | 大きさ |
|---|---|---|---|
${perCourse.map((p) => `| \`tts/${p.course.id}/\` | ${p.course.title}（${p.course.lectures.length} ${p.course.unitLabel === 'CHAPTER' ? '章' : 'レクチャー'}）の台詞の音声（VOICEVOX・48kHz・モノラル）と読み（カナ） | ${p.clips} 本 | ${mb(p.bytes)} |`).join('\n')}
| \`audio/music/\`・\`audio/sfx/\` | BGM・ジングル・効果音（\`scripts/build_music.py\` の合成） | ${audioCount} 個 | ${mb(audioBytes)} |
| \`SHA256SUMS\` | 取り出して WAV に戻した後のファイルの sha256（パスはリポジトリの最上位から） | | |

## 使い方

\`\`\`bash
bun scripts/materials.ts pull                    # 全部の講座の素材を .work/tts/ と public/audio/ に取り出す
bun scripts/materials.ts pull nudge-product      # 1 つの講座だけ
bun scripts/materials.ts pull --videos           # 公開中のサイト（gh-pages）の動画とポスターも site/media/ に取り出す
\`\`\`

## クレジットと利用規約

- ナレーション: VOICEVOX:No.7、VOICEVOX:青山龍星。音声を使うときは、VOICEVOX と各キャラクターの利用規約に従い、クレジットを書いてください
- BGM・ジングル・効果音: \`scripts/build_music.py\` が numpy で合成したオリジナル（外の音源は使っていません）
`;

const push = async (extra: string | undefined) => {
  if (git(['status', '--porcelain', '--', 'content'])) throw new Error('content/ にコミットしていない変更がある。素材は台本のコミットに合わせて作るので、先にコミットする');
  if (!check(COURSES)) throw new Error('素材が足りない。bun scripts/synth.ts と scripts/build_music.py を流してから push する');
  const tmp = mkdtempSync(path.join(tmpdir(), 'chalkfile-materials-'));
  try {
    // 置くもの: ブランチの中のパス → 手元のファイル。音声は一時フォルダで FLAC にして置く（同じ WAV からは同じ FLAC になるので、
    // 前の版と同じ台詞は Git の同じオブジェクトになり、push で送り直さない）
    const entries = new Map<string, string>();
    const sums = new Map<string, string>();
    const toFlac: [string, string][] = [];
    const flacOf = (rel: string) => {
      const flac = path.join(tmp, 'flac', rel.replace(/\.wav$/, '.flac'));
      if (!sums.has(rel)) {
        toFlac.push([path.join(ROOT, rel), flac]);
        sums.set(rel, sha256(path.join(ROOT, rel)));
      }
      return flac;
    };
    const perCourse = COURSES.map((course) => {
      const keys = keysOf(course);
      for (const k of keys) {
        entries.set(`tts/${course.id}/${k}.flac`, flacOf(`${TTS}/${k}.wav`));
        entries.set(`tts/${course.id}/${k}.kana`, path.join(ROOT, TTS, `${k}.kana`));
      }
      return { course, clips: keys.length };
    });
    for (const [local, inBranch] of AUDIO_DIRS) {
      for (const name of readdirSync(path.join(ROOT, local)).filter((f) => f.endsWith('.wav')).sort()) {
        entries.set(`${inBranch}/${name.replace(/\.wav$/, '.flac')}`, flacOf(`${local}/${name}`));
      }
    }
    console.log(`FLAC にする: ${toFlac.length} 本`);
    await convertAll(toFlac, 'flac');

    const sizeIn = (prefix: string) => sizeOf([...entries].filter(([p]) => p.startsWith(prefix)).map(([, f]) => f));
    const total = sizeOf([...entries.values()]);
    const source = `${git(['rev-parse', 'HEAD'])}（${git(['rev-parse', '--abbrev-ref', 'HEAD'])}）`;
    const readme = readmeOf(
      source,
      perCourse.map((p) => ({ ...p, bytes: sizeIn(`tts/${p.course.id}/`) })),
      [...entries.keys()].filter((p) => p.startsWith('audio/')).length,
      sizeIn('audio/'),
      total,
    );
    const sumsText = `${[...sums].sort(([a], [b]) => a.localeCompare(b)).map(([rel, h]) => `${h}  ${rel}`).join('\n')}\n`;

    const paths = [...entries.keys()].sort();
    const shas = git(['hash-object', '-w', '--no-filters', '--stdin-paths'], { input: `${paths.map((p) => entries.get(p)).join('\n')}\n` }).split('\n');
    const readmeSha = git(['hash-object', '-w', '--stdin'], { input: readme });
    const sumsSha = git(['hash-object', '-w', '--stdin'], { input: sumsText });
    // 作業中のインデックスに触れないよう、一時のインデックスで木を組む
    const env = { GIT_INDEX_FILE: path.join(tmp, 'index') };
    const info = [`100644 ${readmeSha}\tREADME.md`, `100644 ${sumsSha}\tSHA256SUMS`, ...paths.map((p, i) => `100644 ${shas[i]}\t${p}`)];
    git(['update-index', '--add', '--index-info'], { env, input: `${info.join('\n')}\n` });
    const tree = git(['write-tree'], { env });
    const clips = perCourse.reduce((s, p) => s + p.clips, 0);
    const message = [
      '素材: 台詞の音声・BGM・効果音',
      `台本 ${source} から作った台詞の音声 ${clips} 本（${perCourse.map((p) => `${p.course.id} ${p.clips}`).join('・')}）と、BGM・ジングル・効果音。`,
      ...(extra ? [extra] : []),
    ].join('\n\n');
    const commit = git(['commit-tree', tree, '-F', '-'], { input: `${message}\n` });
    try {
      git(['fetch', '--quiet', REMOTE, `+refs/heads/${BRANCH}:${TRACKING}`], { quiet: true });
    } catch {
      // 初めての push ではブランチがまだ無い
    }
    // 前の版を置き換える。手元で見ていない更新が先にあれば止まる
    git(['push', '--quiet', `--force-with-lease=refs/heads/${BRANCH}`, REMOTE, `${commit}:refs/heads/${BRANCH}`]);
    git(['fetch', '--quiet', REMOTE, `+refs/heads/${BRANCH}:${TRACKING}`]);
    console.log(`${BRANCH} を ${commit.slice(0, 8)} にした（${paths.length + 2} ファイル・${mb(total)}）`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
};

/** ブランチの一部を、一時フォルダに取り出す */
const extract = (ref: string, paths: string[], dest: string) =>
  execFileSync('sh', ['-c', 'ref=$1; dest=$2; shift 2; git archive "$ref" "$@" | tar -x -C "$dest"', 'sh', ref, dest, ...paths], { cwd: ROOT, stdio: 'inherit' });

const listIn = (ref: string, dir: string): string[] => {
  try {
    return git(['ls-tree', '--name-only', `${ref}:${dir}`], { quiet: true }).split('\n').filter(Boolean);
  } catch {
    return [];
  }
};

const pull = async (courses: Course[], videos: boolean) => {
  git(['fetch', '--quiet', REMOTE, `+refs/heads/${BRANCH}:${TRACKING}`]);
  const inBranch = new Set(listIn(TRACKING, 'tts'));
  const absent = courses.filter((c) => !inBranch.has(c.id));
  if (absent.length) console.warn(`素材のブランチに無い講座: ${absent.map((c) => c.id).join(', ')}（VOICEVOX で bun scripts/synth.ts を流す）`);
  const present = courses.filter((c) => inBranch.has(c.id));

  const tmp = mkdtempSync(path.join(tmpdir(), 'chalkfile-materials-'));
  try {
    extract(TRACKING, [...present.map((c) => `tts/${c.id}`), 'audio', 'SHA256SUMS'], tmp);
    const sums = new Map(
      readFileSync(path.join(tmp, 'SHA256SUMS'), 'utf8')
        .trim()
        .split('\n')
        .map((l) => {
          const [h, rel] = l.split(/\s+/, 2);
          return [rel, h] as const;
        }),
    );
    // 取り出す先（WAV）と、もとの FLAC。中身が同じ WAV が手元にあれば、変換を飛ばす
    mkdirSync(path.join(ROOT, TTS), { recursive: true });
    const targets: [flac: string, rel: string][] = [];
    for (const c of present) {
      const dir = path.join(tmp, 'tts', c.id);
      for (const name of readdirSync(dir)) {
        if (name.endsWith('.kana')) copyFileSync(path.join(dir, name), path.join(ROOT, TTS, name));
        if (name.endsWith('.flac')) targets.push([path.join(dir, name), `${TTS}/${name.replace(/\.flac$/, '.wav')}`]);
      }
    }
    for (const [local, branchDir] of AUDIO_DIRS) {
      const dir = path.join(tmp, branchDir);
      for (const name of existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.flac')) : []) {
        targets.push([path.join(dir, name), `${local}/${name.replace(/\.flac$/, '.wav')}`]);
      }
    }
    const same = (rel: string) => existsSync(path.join(ROOT, rel)) && sha256(path.join(ROOT, rel)) === sums.get(rel);
    const jobs = targets.filter(([, rel]) => !same(rel)).map(([flac, rel]): [string, string] => [flac, path.join(ROOT, rel)]);
    console.log(`WAV に戻す: ${jobs.length} 本（同じ中身が手元にある ${targets.length - jobs.length} 本は飛ばす）`);
    await convertAll(jobs, 'wav');
    const bad = targets.filter(([, rel]) => !same(rel)).map(([, rel]) => rel);
    if (bad.length) throw new Error(`SHA256SUMS と合わない: ${bad.slice(0, 5).join(', ')}${bad.length > 5 ? ` ほか ${bad.length - 5} 本` : ''}`);
    console.log(`素材を取り出した（${BRANCH} @ ${git(['rev-parse', '--short', TRACKING])}・${targets.length} 本・SHA256SUMS と一致）`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  if (videos) {
    git(['fetch', '--quiet', REMOTE, `+refs/heads/gh-pages:${PAGES}`]);
    const media = path.join(ROOT, 'site/media');
    mkdirSync(media, { recursive: true });
    const vtmp = mkdtempSync(path.join(tmpdir(), 'chalkfile-videos-'));
    try {
      for (const c of courses) {
        if (!listIn(PAGES, `${c.id}/media`).length) {
          console.warn(`${c.id}: 公開中のサイトに動画が無い（bash scripts/render.sh で書き出す）`);
          continue;
        }
        extract(PAGES, [`${c.id}/media`], vtmp);
        const files = readdirSync(path.join(vtmp, c.id, 'media'));
        for (const name of files) copyFileSync(path.join(vtmp, c.id, 'media', name), path.join(media, name));
        console.log(`${c.id}: 公開中のサイトから動画とポスター ${files.length} 個を site/media/ に取り出した`);
      }
      console.log(`（gh-pages @ ${git(['log', '-1', '--format=%h %s', PAGES])}）`);
    } finally {
      rmSync(vtmp, { recursive: true, force: true });
    }
  }
  console.log(
    videos
      ? '次は bun scripts/synth.ts（VOICEVOX なしで時刻と字幕を作る）→ bun scripts/build_site.ts'
      : '次は bun scripts/synth.ts（VOICEVOX なしで時刻を決める）→ uv run --with numpy --with scipy python scripts/mix.py → bash scripts/render.sh → bun scripts/build_site.ts',
  );
};

const [cmd, ...rest] = process.argv.slice(2);
const msgAt = rest.indexOf('--message');
const message = msgAt >= 0 ? rest[msgAt + 1] : undefined;
const ids = rest.filter((a, i) => !a.startsWith('--') && !(msgAt >= 0 && i === msgAt + 1));
if (cmd === 'pull') await pull(pickCourses(ids), rest.includes('--videos'));
else if (cmd === 'check') process.exit(check(pickCourses(ids)) ? 0 : 1);
else if (cmd === 'push') await push(message);
else {
  console.error('使い方: bun scripts/materials.ts pull [講座 ID …] [--videos] | check [講座 ID …] | push [--message 文]');
  process.exit(1);
}
