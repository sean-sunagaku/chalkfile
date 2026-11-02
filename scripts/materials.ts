// 動画の素材（台詞の音声と読み・BGM とジングル・効果音）を、素材だけを置くブランチ `materials` と出し入れする。
// 素材があれば、台詞を変えていない章は VOICEVOX・Kokoro なしで、時刻 → 音のミックス → 動画 → 講座サイトまで作り直せる。
// 台詞の音声は、日本語（VOICEVOX）と訳の言語（Kokoro）のものを、講座ごとのフォルダにまとめて置く（名前は文と声から決まるので重ならない）。
//   bun scripts/materials.ts pull [講座 ID …] [--videos]       # 素材を取り出す（--videos で Releases の動画も）
//   bun scripts/materials.ts check [講座 ID …]                 # 台本の全部の台詞の音声と、BGM・効果音が手元にあるか
//   bun scripts/materials.ts push [--dry-run] [--message 文]    # 手元の素材を `materials` ブランチに足す（消さない）
//   bun scripts/materials.ts gc [--keep ref …] [--confirm]     # --keep（既定 origin/main）の台本が使わない台詞の音声を消す
// 素材は main の履歴に入れず、素材だけを置くブランチに置く。
// push は、リモートの木に手元の素材を足すか上書きするだけにする。並行する worktree が順に push しても、ほかの講座の素材は消えない。
// push のコミットは前の版を親にする（送るのは新しい素材だけで済み、前の版にも戻せる。親の無いコミットだと、全部の素材を送り直す）。
// 消すのは gc だけで、--confirm を付けたときだけ消す。gc は親の無い 1 コミットで置き換え、それまでの履歴を切る（消した素材を履歴にも残さない）。
// 音声は FLAC（可逆圧縮）で置き、取り出すときに WAV に戻す。SHA256SUMS で、戻した WAV と読みが元と同じかを確かめる。
// remote・素材のブランチ・main の名前は、環境変数 MATERIALS_REMOTE・MATERIALS_BRANCH・MATERIALS_BASE で差し替えられる。
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseArgs, type ParseArgsConfig } from 'node:util';
import { COURSES, coursesIn } from '../content';
import { LANGS, type Lang } from '../content/i18n';
import type { Course, Line, SfxId, VoiceId } from '../content/types';
import { pullMedia } from './media';
import { KOKORO, speechIn, ttsKeyIn, VOICES } from './voices';

const TTS = '.work/tts';
const README = 'README.md';
const SUMS = 'SHA256SUMS';
/** 効果音の名前（台本の SfxId と同じ。scripts/build_music.py が作り、scripts/mix.py が読む） */
const SFX_NAMES = Object.keys({
  pop: 0, whoosh: 0, chime: 0, tick: 0, reveal: 0, correct: 0, type: 0, harisen: 0, chin: 0, drumroll: 0, deden: 0, zuko: 0,
} satisfies Record<SfxId, 0>);
/** BGM・ジングル・効果音（scripts/build_music.py の出力）と、ブランチの中の置き場所。check と push は、この名前の一覧で確かめる */
export const AUDIO: { local: string; inBranch: string; names: string[] }[] = [
  { local: 'public/audio/music', inBranch: 'audio/music', names: ['bed', 'sting_intro', 'sting_outro'] },
  { local: 'public/audio/sfx', inBranch: 'audio/sfx', names: SFX_NAMES },
];

/** 素材を出し入れするリポジトリ（テストでは、一時の clone と bare リポジトリに差し替える） */
export type Repo = {
  /** 作業フォルダ（リポジトリの最上位） */
  root: string;
  /** 素材のブランチを置く remote */
  remote: string;
  /** 素材のブランチ */
  branch: string;
  /** push の前に、HEAD が含んでいるべき remote のブランチ */
  base: string;
};

export const defaultRepo = (): Repo => ({
  root: path.resolve(import.meta.dir, '..'),
  remote: process.env.MATERIALS_REMOTE ?? 'origin',
  branch: process.env.MATERIALS_BRANCH ?? 'materials',
  base: process.env.MATERIALS_BASE ?? 'main',
});

/** 講座ごとの、台詞の音声の名前（.work/tts/<key>.wav）と、素材の README に出す説明 */
export type CourseKeys = { id: string; langs: string[]; keys: string[]; about: string };

/** WAV と FLAC の変換（テストでは、ffmpeg を使わないものに差し替える） */
export type Convert = (jobs: [from: string, to: string][], to: 'flac' | 'wav') => Promise<void>;

export type Options = {
  log?: (line: string) => void;
  convert?: Convert;
  /** push の直前に呼ぶ（テストで、ほかの push を先に入れて lease の拒否を起こす） */
  beforePush?: (attempt: number) => Promise<void> | void;
};

/** push と gc の結果（sha は、終えたときの素材のブランチ） */
export type Result = { pushed: boolean; sha: string | null; attempts: number };

/* ───────────── git と小さな道具 ───────────── */

type GitOpts = { env?: Record<string, string>; input?: string };
/** git を流して、終了コードと出力を返す */
const run = (root: string, args: string[], opts: GitOpts = {}) => {
  const r = spawnSync('git', args, { cwd: root, env: { ...process.env, ...opts.env }, input: opts.input, maxBuffer: 256 * 1024 * 1024 });
  if (r.error) throw r.error;
  return { code: r.status ?? 1, out: r.stdout.toString(), err: r.stderr.toString() };
};
/** git を流して、標準出力を返す。失敗したら、git のエラーを付けて止める */
const git = (root: string, args: string[], opts: GitOpts = {}): string => {
  const r = run(root, args, opts);
  if (r.code !== 0) throw new Error(`git ${args[0]} が失敗した: ${r.err.trim() || `終了コード ${r.code}`}`);
  return r.out.trim();
};
/** ファイルの blob の ID（write なら、オブジェクトとして書く） */
const hashFiles = (root: string, files: string[], write: boolean): string[] =>
  files.length ? git(root, ['hash-object', ...(write ? ['-w'] : []), '--no-filters', '--stdin-paths'], { input: `${files.join('\n')}\n` }).split('\n') : [];
const hashText = (root: string, text: string, write: boolean): string => git(root, ['hash-object', ...(write ? ['-w'] : []), '--stdin'], { input: text });

const sha256Of = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const mb = (bytes: number) => `${(bytes / 1e6).toFixed(1)}MB`;
/** パスの並び（ロケールに左右されないよう、文字コードの順にする） */
const byPath = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** WAV と FLAC の変換を、ffmpeg で 8 本ずつ並べて流す。FLAC は可逆なので、WAV に戻すと元と同じバイトになる */
export const ffmpegConvert: Convert = async (jobs, to) => {
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

/** ブランチの一部を、一時フォルダに取り出す（git archive を tar に流す。pipefail で、どちらが失敗しても止める） */
const extract = (root: string, ref: string, paths: string[], dest: string) => {
  const r = spawnSync('bash', ['-c', 'set -eo pipefail; ref=$1; dest=$2; shift 2; git archive "$ref" -- "$@" | tar -x -C "$dest"', 'bash', ref, dest, ...paths], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`素材を取り出せない（git archive か tar が失敗した）: ${r.stderr.toString().trim()}`);
};

/* ───────────── 台本から、台詞の音声の名前を作る ───────────── */

/** 鍵を作るもの（台本と声の設定）。gc は --keep の ref から取り出したものを使う */
type Scripts = {
  COURSES: Course[];
  coursesIn: (lang: Lang) => Course[];
  LANGS: Lang[];
  speechIn: (line: Line, lang: Lang) => string;
  ttsKeyIn: (text: string, voice: VoiceId, lang: Lang) => string;
};
const HERE: Scripts = { COURSES, coursesIn, LANGS, speechIn, ttsKeyIn };

/** 講座の台本（全部の言語）の全部の台詞の、音声ファイルの名前（synth.ts と同じ決め方）。only を渡すと、その講座だけ */
const courseKeys = (s: Scripts, only?: string[]): CourseKeys[] =>
  (only ? only.map((id) => s.COURSES.find((c) => c.id === id)!) : s.COURSES).map((course) => {
    const keys = new Set<string>();
    const langs: Lang[] = [];
    for (const lang of s.LANGS) {
      const c = s.coursesIn(lang).find((x) => x.id === course.id);
      if (!c) continue;
      langs.push(lang);
      for (const lec of c.lectures) for (const scene of lec.scenes) for (const line of scene.lines) keys.add(s.ttsKeyIn(s.speechIn(line, lang), line.v ?? 'narrator', lang));
    }
    const unit = course.unitLabel === 'CHAPTER' ? '章' : 'レクチャー';
    return { id: course.id, langs, keys: [...keys].sort(), about: `${course.title}（${course.lectures.length} ${unit}・${langs.join('・')}）` };
  });

/** 取り出した台本のフォルダから、鍵を作るもの（台本と声の設定）を読む */
const scriptsIn = async (dir: string): Promise<Scripts> => {
  const index = (await import(path.join(dir, 'content/index.ts'))) as typeof import('../content');
  const i18n = (await import(path.join(dir, 'content/i18n.ts'))) as typeof import('../content/i18n');
  const voices = (await import(path.join(dir, 'scripts/voices.ts'))) as typeof import('./voices');
  return { COURSES: index.COURSES, coursesIn: index.coursesIn, LANGS: i18n.LANGS, speechIn: voices.speechIn, ttsKeyIn: voices.ttsKeyIn };
};

/** gc で残すもの（--keep の ref と、その台本の講座ごとの鍵） */
export type Keep = { refs: string[]; courses: CourseKeys[] };

/** --keep の ref の台本（content/ と scripts/voices.ts）を一時フォルダに取り出して読み、講座ごとの鍵を作る */
export const keepAt = async (repo: Repo, refs: string[]): Promise<Keep> => {
  const keep: Keep = { refs: [], courses: [] };
  for (const ref of refs) {
    // origin/main のような remote のブランチは、最新を取ってくる
    const name = ref.slice(repo.remote.length + 1);
    if (ref.startsWith(`${repo.remote}/`) && /^[\w./-]+$/.test(name) && !fetchBranch(repo, name)) throw new Error(`${ref} が ${repo.remote} に無い`);
    const found = run(repo.root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
    if (found.code !== 0) throw new Error(`--keep の ref が無い: ${ref}`);
    const commit = found.out.trim();
    const dir = mkdtempSync(path.join(tmpdir(), 'chalkfile-materials-keep-'));
    try {
      extract(repo.root, commit, ['content', 'scripts/voices.ts'], dir);
      keep.courses.push(...courseKeys(await scriptsIn(dir)));
    } catch (e) {
      throw new Error(`${ref} の台本から、台詞の音声の名前を作れない: ${e instanceof Error ? e.message : e}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    keep.refs.push(`${ref}（${commit.slice(0, 7)}）`);
  }
  return keep;
};

/* ───────────── 素材のブランチの中身 ───────────── */

/** ブランチの中の台詞の音声と読み（tts/<講座>/<key>.flac・.kana） */
const TTS_PATH = /^tts\/([^/]+)\/([^/]+)\.(flac|kana)$/;

/** ブランチの中のパス → 取り出した後の手元のパス（SHA256SUMS に書くパス）。素材でないもの（README など）は undefined */
const localOf = (p: string): string | undefined => {
  const m = TTS_PATH.exec(p);
  if (m) return `${TTS}/${m[2]}.${m[3] === 'flac' ? 'wav' : 'kana'}`;
  const a = AUDIO.find((x) => p.startsWith(`${x.inBranch}/`));
  return a && p.endsWith('.flac') ? `${a.local}/${p.slice(a.inBranch.length + 1, -'.flac'.length)}.wav` : undefined;
};

/** 数えるときのまとまり（台詞は .flac と .kana で 1 本）と、その講座（BGM・効果音は audio） */
const clipOf = (p: string): { clip: string; group: string } | undefined => {
  const m = TTS_PATH.exec(p);
  if (m) return { clip: `tts/${m[1]}/${m[2]}`, group: m[1] };
  return localOf(p) ? { clip: p, group: 'audio' } : undefined;
};

type Entry = { blob: string; size: number };
type Remote = {
  /** 素材のブランチのコミット（まだ無ければ null） */
  sha: string | null;
  /** ブランチの中のファイル → blob と大きさ */
  entries: Map<string, Entry>;
  /** SHA256SUMS（手元のパス → sha256） */
  sums: Map<string, string>;
  /** README の表の、講座ごとの説明（並びも前の README のまま） */
  about: Map<string, string>;
};

/** remote のブランチを取ってきて、そのコミットを返す（remote に無ければ null） */
const fetchBranch = (repo: Repo, branch: string): string | null => {
  const ref = `refs/heads/${branch}`;
  const found = run(repo.root, ['ls-remote', '--exit-code', repo.remote, ref]);
  if (found.code === 2) return null;
  if (found.code !== 0) throw new Error(`${repo.remote} を読めない: ${found.err.trim()}`);
  const tracking = `refs/remotes/${repo.remote}/${branch}`;
  git(repo.root, ['fetch', '--quiet', '--no-tags', repo.remote, `+${ref}:${tracking}`]);
  return git(repo.root, ['rev-parse', '--verify', `${tracking}^{commit}`]);
};

/** SHA256SUMS（「sha256  パス」の行）を読む */
const parseSums = (text: string): Map<string, string> => {
  const sums = new Map<string, string>();
  for (const line of text.split('\n').filter(Boolean)) {
    const m = /^([0-9a-f]{64}) [ *](.+)$/.exec(line);
    if (!m) throw new Error(`SHA256SUMS が読めない: ${line.slice(0, 80)}`);
    sums.set(m[2], m[1]);
  }
  return sums;
};
const sumsText = (sums: Map<string, string>) => `${[...sums].sort(([a], [b]) => byPath(a, b)).map(([rel, h]) => `${h}  ${rel}`).join('\n')}\n`;

/** 素材の README の表から、講座ごとの説明を読む（手元の台本に無い講座の行を、そのまま引き継ぐ） */
const parseAbout = (readme: string) => new Map([...readme.matchAll(/^\| `tts\/([^/`]+)\/` \| (.+) \| [\d,]+ 本 \| [\d.]+MB \|$/gm)].map((m) => [m[1], m[2]]));

/** 素材のブランチを取ってきて、木の中身・SHA256SUMS・README の説明を読む */
const readRemote = (repo: Repo): Remote => {
  const sha = fetchBranch(repo, repo.branch);
  const entries = new Map<string, Entry>();
  if (!sha) return { sha, entries, sums: new Map(), about: new Map() };
  for (const row of git(repo.root, ['ls-tree', '-r', '-l', '-z', sha]).split('\0')) {
    const tab = row.indexOf('\t');
    if (tab < 0) continue;
    const [, type, blob, size] = row.slice(0, tab).split(/ +/);
    if (type === 'blob') entries.set(row.slice(tab + 1), { blob, size: Number(size) });
  }
  const text = (p: string) => {
    const e = entries.get(p);
    return e ? git(repo.root, ['cat-file', 'blob', e.blob]) : '';
  };
  return { sha, entries, sums: parseSums(text(SUMS)), about: parseAbout(text(README)) };
};

/** 講座の説明から、README の表の「中身」の欄を作る */
const describe = (about: string) => `${about}の台詞の音声（日本語は VOICEVOX、英語・中国語は Kokoro。48kHz・モノラル）と読み（日本語はカナ、ほかは音素）`;

/** 素材の README。木の中身から作り、push した台本のコミットには左右されない（同じ素材なら同じ README になり、push しない） */
const readmeOf = (entries: Map<string, Entry>, abouts: Map<string, string>, previous: Map<string, string>) => {
  const perCourse = new Map<string, { clips: number; bytes: number }>();
  const audio = { count: 0, bytes: 0 };
  let total = 0;
  for (const [p, e] of entries) {
    if (p === README || p === SUMS) continue;
    total += e.size;
    const m = TTS_PATH.exec(p);
    if (m) {
      const c = perCourse.get(m[1]) ?? { clips: 0, bytes: 0 };
      perCourse.set(m[1], { clips: c.clips + (m[3] === 'flac' ? 1 : 0), bytes: c.bytes + e.size });
    } else if (localOf(p)) {
      audio.count++;
      audio.bytes += e.size;
    }
  }
  // 並びは前の README のまま。新しい講座は、手元の台本の順で後ろに足す
  const order = [...new Set([...previous.keys(), ...abouts.keys(), ...[...perCourse.keys()].sort(byPath)])].filter((id) => perCourse.has(id));
  const rows = order.map((id) => {
    const c = perCourse.get(id)!;
    const what = abouts.has(id) ? describe(abouts.get(id)!) : (previous.get(id) ?? '台詞の音声と読み（手元の台本に無い講座）');
    return `| \`tts/${id}/\` | ${what} | ${c.clips} 本 | ${mb(c.bytes)} |`;
  });
  return `# Chalkfile の動画の素材

講座の動画を作るための素材だけを置くブランチです。main にはマージしません。

- \`bun scripts/materials.ts push\` は足すだけです。手元の素材を足すか上書きし、手元の台本に無い講座や台詞の素材は消さずに残します。コミットは前の版を親にするので、送るのは新しい素材だけで、前の版にも戻せます
- 消すのは \`bun scripts/materials.ts gc\` だけです。\`--keep\` の ref（既定 origin/main）の台本が使わない素材を一覧にし、\`--confirm\` を付けたときだけ消します。gc は親の無い 1 コミットで置き換え、それまでの履歴を切ります

素材があれば、台詞を変えていない章は VOICEVOX なしで、時刻 → 音のミックス → 動画 → 講座サイトまで作り直せます。手順はリポジトリの README の「素材から作り直す」です。

全部で ${mb(total)}（音声は FLAC。取り出すと WAV に戻り、\`SHA256SUMS\` と同じ中身になる）。どの台本から足したかは、このブランチのコミットのメッセージ（\`git log\`）にあります。

| パス | 中身 | 数 | 大きさ |
|---|---|---|---|
${rows.join('\n')}
| \`audio/music/\`・\`audio/sfx/\` | BGM・ジングル・効果音（\`scripts/build_music.py\` の合成） | ${audio.count} 個 | ${mb(audio.bytes)} |
| \`SHA256SUMS\` | 取り出した後のファイル（WAV と読み）の sha256（パスはリポジトリの最上位から） | | |

## 使い方

\`\`\`bash
bun scripts/materials.ts pull                    # 全部の講座の素材を .work/tts/ と public/audio/ に取り出す
bun scripts/materials.ts pull nudge-product      # 1 つの講座だけ
bun scripts/materials.ts pull --videos           # Releases の動画も site/media/ に取り出す（ポスターは site/posters/）
bun scripts/materials.ts push --dry-run          # 足す・変える・同じ・残すの本数だけを見る（何も書かない）
\`\`\`

## クレジットと利用規約

- 声（日本語）: ${[...new Set(Object.values(VOICES).map((v) => v.credit))].join('、')}。音声を使うときは、VOICEVOX と各キャラクターの利用規約に従い、クレジットを書いてください
- 声（英語・中国語）: Kokoro-82M（hexgrad、Apache-2.0）の ${[...new Set(Object.values(KOKORO).flatMap((t) => Object.values(t).map((v) => v.voice)))].join('・')}（英語は Kokoro-82M、中国語は Kokoro-82M-v1.1-zh）
- BGM・ジングル・効果音: \`scripts/build_music.py\` が numpy で合成したオリジナル（外の音源は使っていません）
`;
};

/** リモートの木を一時のインデックスに読み、パスを足す・置き換える（blob）か消す（null）して、新しい木を作る */
const buildTree = (repo: Repo, from: string | null, updates: Map<string, string | null>, tmp: string): string => {
  // 作業中のインデックスに触れないよう、一時のインデックスで組む
  const env = { GIT_INDEX_FILE: path.join(tmp, 'index') };
  git(repo.root, from ? ['read-tree', from] : ['read-tree', '--empty'], { env });
  const zero = '0'.repeat(from?.length ?? 40);
  const info = [...updates].map(([p, blob]) => (blob ? `100644 ${blob}\t${p}` : `0 ${zero}\t${p}`));
  if (info.length) git(repo.root, ['update-index', '--add', '--index-info'], { env, input: `${info.join('\n')}\n` });
  return git(repo.root, ['write-tree'], { env });
};

/**
 * 木からコミットを作り、取ってきたときのコミット（from）を lease にして push する。
 * push は from を親にする（送るのは新しい素材だけで、前の版にも戻せる）。gc は親を付けず、それまでの履歴を切る。
 * ほかの push が先に入っていたら（lease の拒否）null。前の版の SHA と戻し方を、push の前に出しておく
 */
const commitAndPush = async (repo: Repo, from: string | null, tree: string, message: string, opts: Options & { parent: boolean }, attempt: number): Promise<string | null> => {
  const log = opts.log ?? console.log;
  const commit = git(repo.root, ['commit-tree', tree, ...(opts.parent && from ? ['-p', from] : []), '-F', '-'], { input: `${message}\n` });
  const ref = `refs/heads/${repo.branch}`;
  log(from ? `前の版: ${from}（戻すとき: git push --force-with-lease=${ref}:${commit} ${repo.remote} ${from}:${ref}）` : `${repo.remote}/${repo.branch} はまだ無いので、新しく作る`);
  await opts.beforePush?.(attempt);
  const r = run(repo.root, ['push', '--porcelain', `--force-with-lease=${ref}:${from ?? ''}`, repo.remote, `${commit}:${ref}`], { env: { LC_ALL: 'C' } });
  if (r.code !== 0) {
    if (/^!\t.*\(stale info\)/m.test(r.out)) return null;
    throw new Error(`push が失敗した: ${`${r.err}\n${r.out}`.trim()}`);
  }
  // 追跡のブランチも、push した版にしておく（ネットにはつながない）
  run(repo.root, ['update-ref', `refs/remotes/${repo.remote}/${repo.branch}`, commit]);
  return commit;
};

/* ───────────── check ───────────── */

const hasVoice = (root: string, key: string) => existsSync(path.join(root, TTS, `${key}.wav`)) && existsSync(path.join(root, TTS, `${key}.kana`));

/** 台本の全部の台詞の音声と、BGM・効果音（決まった名前の一覧）が手元にあるか */
export const check = (repo: Repo, courses: CourseKeys[], log: (line: string) => void = console.log): boolean => {
  let ok = true;
  for (const c of courses) {
    const missing = c.keys.filter((k) => !hasVoice(repo.root, k));
    log(`${c.id}（${c.langs.join('・')}）: 台詞の音声 ${c.keys.length - missing.length}/${c.keys.length}${missing.length ? '（足りない。bun scripts/materials.ts pull か、VOICEVOX・Kokoro で bun scripts/synth.ts）' : ''}`);
    if (missing.length) ok = false;
  }
  for (const a of AUDIO) {
    const missing = a.names.filter((n) => !existsSync(path.join(repo.root, a.local, `${n}.wav`)));
    log(`${a.local}: ${a.names.length - missing.length}/${a.names.length} 個${missing.length ? `（足りない: ${missing.join(', ')}。bun scripts/materials.ts pull か、scripts/build_music.py）` : ''}`);
    if (missing.length) ok = false;
  }
  return ok;
};

/* ───────────── push（足すだけ） ───────────── */

type Local = {
  /** 手元のファイル（WAV と読み）の sha256 */
  sha256: Map<string, string>;
  /** 読みの blob と大きさ（git hash-object で、書かずに求める） */
  kana: Map<string, Entry>;
};

/** 手元の素材の sha256 と、読みの blob を 1 回だけ求める（無いファイルは飛ばす） */
const readLocal = (repo: Repo, courses: CourseKeys[]): Local => {
  const rels = new Set<string>();
  for (const c of courses) for (const k of c.keys) rels.add(`${TTS}/${k}.wav`).add(`${TTS}/${k}.kana`);
  for (const a of AUDIO) for (const n of a.names) rels.add(`${a.local}/${n}.wav`);
  const present = [...rels].filter((rel) => existsSync(path.join(repo.root, rel)));
  const sha256 = new Map(present.map((rel) => [rel, sha256Of(path.join(repo.root, rel))]));
  const kanaRels = present.filter((rel) => rel.endsWith('.kana'));
  const blobs = hashFiles(repo.root, kanaRels.map((rel) => path.join(repo.root, rel)), false);
  const kana = new Map(kanaRels.map((rel, i): [string, Entry] => [rel, { blob: blobs[i], size: statSync(path.join(repo.root, rel)).size }]));
  return { sha256, kana };
};

type Change = { action: 'add' | 'change'; rel: string; blob?: string; size?: number };
type Plan = {
  /** 足す・変えるパス（blob が無いものは、FLAC にしてから決まる） */
  changes: Map<string, Change>;
  /** 手元と同じパス */
  same: Set<string>;
  /** 手元に無くて置けなかった台詞（dry-run のときだけ。push は先に止める）。講座 → 本数 */
  missing: Map<string, number>;
  /** 新しい SHA256SUMS（リモートの一覧に、手元の分を重ねる） */
  sums: Map<string, string>;
};

/** リモートの木に、手元の素材を足すか上書きする計画（消すものは無い） */
const planPush = (remote: Remote, local: Local, courses: CourseKeys[]): Plan => {
  const plan: Plan = { changes: new Map(), same: new Set(), missing: new Map(), sums: new Map(remote.sums) };
  // 同じ手元のファイルを指すパス（同じ台詞が 2 つの講座にあると、2 つのフォルダに入っている）
  const pathsOf = new Map<string, string[]>();
  for (const p of remote.entries.keys()) {
    const rel = localOf(p);
    if (rel) pathsOf.set(rel, [...(pathsOf.get(rel) ?? []), p]);
  }
  const place = (p: string, rel: string) => {
    const hash = local.sha256.get(rel)!;
    plan.sums.set(rel, hash);
    const others = (pathsOf.get(rel) ?? []).filter((q) => q !== p);
    const kana = local.kana.get(rel);
    if (kana) {
      // 読みは blob をくらべる。SHA256SUMS は手元のパスごとに 1 行なので、同じ読みはどのフォルダでも同じ中身にそろえる
      for (const q of others) if (remote.entries.get(q)!.blob !== kana.blob) plan.changes.set(q, { action: 'change', rel, ...kana });
      const now = remote.entries.get(p);
      if (now?.blob === kana.blob) plan.same.add(p);
      else plan.changes.set(p, { action: now ? 'change' : 'add', rel, ...kana });
      return;
    }
    if (remote.sums.get(rel) === hash) {
      // 前の版と同じ音声。置いてある FLAC をそのまま使う（FLAC にし直さない。ffmpeg の版が違っても、木は変わらない）
      if (remote.entries.has(p)) plan.same.add(p);
      else plan.changes.set(p, { action: 'add', rel, ...(others.length ? remote.entries.get(others[0]) : {}) });
      return;
    }
    // 音声が違うか、前の一覧に無い。FLAC にし直し、同じファイルを指すほかのパスもそろえる
    for (const q of others) plan.changes.set(q, { action: 'change', rel });
    plan.changes.set(p, { action: remote.entries.has(p) ? 'change' : 'add', rel });
  };
  const lack = (group: string) => plan.missing.set(group, (plan.missing.get(group) ?? 0) + 1);
  for (const c of courses) {
    for (const k of c.keys) {
      const wav = `${TTS}/${k}.wav`;
      const kana = `${TTS}/${k}.kana`;
      if (!local.sha256.has(wav) || !local.sha256.has(kana)) {
        lack(c.id);
        continue;
      }
      place(`tts/${c.id}/${k}.flac`, wav);
      place(`tts/${c.id}/${k}.kana`, kana);
    }
  }
  for (const a of AUDIO) {
    for (const n of a.names) {
      const rel = `${a.local}/${n}.wav`;
      if (local.sha256.has(rel)) place(`${a.inBranch}/${n}.flac`, rel);
      else lack('audio');
    }
  }
  return plan;
};

/** リモートの木に、足す・変えるパスを重ねる（大きさがまだ分からないものがあれば null） */
const overlay = (entries: Map<string, Entry>, changes: Map<string, Change>): Map<string, Entry> | null => {
  const out = new Map(entries);
  for (const [p, c] of changes) {
    if (!c.blob || c.size === undefined) return null;
    out.set(p, { blob: c.blob, size: c.size });
  }
  return out;
};

type Counts = Record<'add' | 'change' | 'same' | 'keep' | 'missing', number>;
const LABELS: [keyof Counts, string][] = [['add', '足す'], ['change', '変える'], ['same', '同じ'], ['keep', '残す'], ['missing', '手元に無い']];
const fmt = (c: Counts | undefined) => LABELS.filter(([k]) => c?.[k]).map(([k, label]) => `${label} ${c![k]}`).join('・') || 'なし';
const RANK = ['keep', 'same', 'change', 'add'] as const;

/** 台詞（.flac と .kana で 1 本）と BGM・効果音を、講座ごとに「足す・変える・同じ・残す」で数える */
const tally = (remote: Remote, plan: Plan): Map<string, Counts> => {
  const status = new Map<string, { group: string; rank: number }>();
  for (const p of new Set([...remote.entries.keys(), ...plan.changes.keys()])) {
    const at = clipOf(p);
    if (!at) continue;
    const rank = RANK.indexOf(plan.changes.get(p)?.action ?? (plan.same.has(p) ? 'same' : 'keep'));
    if ((status.get(at.clip)?.rank ?? -1) < rank) status.set(at.clip, { group: at.group, rank });
  }
  const groups = new Map<string, Counts>();
  const counts = (g: string) => groups.get(g) ?? groups.set(g, { add: 0, change: 0, same: 0, keep: 0, missing: 0 }).get(g)!;
  for (const { group, rank } of status.values()) counts(group)[RANK[rank]]++;
  for (const [g, n] of plan.missing) counts(g).missing += n;
  return groups;
};

/**
 * 手元の素材を、素材のブランチに足す（消さない）。リモートの木に足すか上書きした木を、取ってきたコミットを親にして push する。
 * lease は取ってきたコミットの SHA。拒否されたら、取り直してまとめ直し、3 回まで push し直す。木が前と同じなら push しない
 */
export const push = async (repo: Repo, courses: CourseKeys[], opts: Options & { dryRun?: boolean; message?: string } = {}): Promise<Result> => {
  const log = opts.log ?? console.log;
  const convert = opts.convert ?? ffmpegConvert;
  const dry = opts.dryRun === true;
  const stops = guard(repo);
  if (!check(repo, courses, () => {})) stops.push('素材が足りない。bun scripts/materials.ts check で足りないものを見て、bun scripts/synth.ts と scripts/build_music.py を流してから push する');
  for (const s of stops) log(`${dry ? '注意（push なら、ここで止まる）' : '止める'}: ${s}`);
  if (stops.length && !dry) throw new Error(stops.join('\n'));

  const local = readLocal(repo, courses);
  const source = `${git(repo.root, ['rev-parse', 'HEAD'])}（${git(repo.root, ['rev-parse', '--abbrev-ref', 'HEAD'])}）`;
  const abouts = new Map(courses.map((c) => [c.id, c.about]));
  const here = new Set(courses.map((c) => c.id));
  let tmp: string | undefined;
  const tmpDir = () => (tmp ??= mkdtempSync(path.join(tmpdir(), 'chalkfile-materials-')));
  /** FLAC にした音声（手元のパス → blob）。lease で拒否されて、まとめ直すときに使い回す */
  const flacs = new Map<string, Entry>();
  /** オブジェクトとして書いた読み */
  const written = new Set<string>();
  try {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const remote = readRemote(repo);
      const plan = planPush(remote, local, courses);
      const sums = sumsText(plan.sums);
      const sumsSame = hashText(repo.root, sums, false) === remote.entries.get(SUMS)?.blob;
      const known = overlay(remote.entries, plan.changes);
      const readmeSame = known !== null && hashText(repo.root, readmeOf(known, abouts, remote.about), false) === remote.entries.get(README)?.blob;

      // 一覧: 講座ごとの本数。手元に無い講座のフォルダは「残す」
      const groups = tally(remote, plan);
      log(`素材のブランチ ${repo.remote}/${repo.branch}: ${remote.sha ? remote.sha.slice(0, 7) : 'まだ無い（新しく作る）'}`);
      for (const c of courses) log(`  ${c.id}: ${fmt(groups.get(c.id))}`);
      for (const [id, n] of groups) if (id !== 'audio' && !here.has(id)) log(`  ${id}: ${fmt(n)}（手元の台本に無い講座。消さずに残す）`);
      log(`  audio/（BGM・効果音）: ${fmt(groups.get('audio'))}`);
      const addedLines = [...plan.sums].filter(([rel]) => !remote.sums.has(rel)).length;
      const changedLines = [...plan.sums].filter(([rel, h]) => remote.sums.has(rel) && remote.sums.get(rel) !== h).length;
      const sumsNote = sumsSame ? '同じ' : `作り直す（行を足す ${addedLines}・変える ${changedLines}）`;
      log(`  README.md: ${readmeSame ? '同じ' : '作り直す'}・SHA256SUMS: ${sumsNote}`);
      const all: Counts = { add: 0, change: 0, same: 0, keep: 0, missing: 0 };
      for (const n of groups.values()) for (const [k] of LABELS) all[k] += n[k];
      log(`合計: ${fmt(all)}（台詞は .flac と .kana を 1 本に数える。消すものは無い）`);

      if (!plan.changes.size && readmeSame && sumsSame) {
        log('素材のブランチと同じなので、push しない');
        return { pushed: false, sha: remote.sha, attempts: attempt };
      }
      if (dry) {
        log('dry-run なので、何も書かずに終える');
        return { pushed: false, sha: remote.sha, attempts: attempt };
      }

      // FLAC にする（同じ WAV からは同じ FLAC になるので、送るのは新しい台詞だけ。前の回で作ったものは使い回す）
      const todo = [...new Set([...plan.changes.values()].filter((c) => !c.blob && !flacs.has(c.rel)).map((c) => c.rel))];
      if (todo.length) {
        log(`FLAC にする: ${todo.length} 本`);
        const files = todo.map((rel) => path.join(tmpDir(), 'flac', rel.replace(/\.wav$/, '.flac')));
        await convert(todo.map((rel, i): [string, string] => [path.join(repo.root, rel), files[i]]), 'flac');
        const blobs = hashFiles(repo.root, files, true);
        todo.forEach((rel, i) => flacs.set(rel, { blob: blobs[i], size: statSync(files[i]).size }));
      }
      for (const c of plan.changes.values()) if (!c.blob) Object.assign(c, flacs.get(c.rel));
      // 読みをオブジェクトとして書く（ID は、前に書かずに求めたものと同じになる）
      const kanaRels = [...new Set([...plan.changes.values()].map((c) => c.rel).filter((rel) => rel.endsWith('.kana') && !written.has(rel)))];
      hashFiles(repo.root, kanaRels.map((rel) => path.join(repo.root, rel)), true).forEach((blob, i) => {
        if (blob !== local.kana.get(kanaRels[i])?.blob) throw new Error(`読みのファイルが途中で変わった: ${kanaRels[i]}`);
        written.add(kanaRels[i]);
      });

      const entries = overlay(remote.entries, plan.changes)!;
      const updates = new Map<string, string | null>([...plan.changes].map(([p, c]) => [p, c.blob!]));
      updates.set(README, hashText(repo.root, readmeOf(entries, abouts, remote.about), true));
      updates.set(SUMS, hashText(repo.root, sums, true));
      const tree = buildTree(repo, remote.sha, updates, tmpDir());
      if (remote.sha && tree === git(repo.root, ['rev-parse', `${remote.sha}^{tree}`])) {
        log('素材のブランチと同じなので、push しない');
        return { pushed: false, sha: remote.sha, attempts: attempt };
      }
      const clips = [...entries.keys()].filter((p) => p.endsWith('.flac') && p.startsWith('tts/')).length;
      const folders = new Set([...entries.keys()].map((p) => TTS_PATH.exec(p)?.[1]).filter(Boolean)).size;
      const touched = courses.map((c) => [c.id, groups.get(c.id)] as const).filter(([, n]) => n && (n.add || n.change));
      const what = all.add || all.change
        ? `の素材を足した（足す ${all.add}・変える ${all.change}${touched.length ? `。${touched.map(([id, n]) => `${id} ${fmt({ ...n!, same: 0, keep: 0, missing: 0 })}`).join('、')}` : ''}）`
        : 'の素材は前の版と同じ。README.md と SHA256SUMS だけを作り直した';
      const message = [
        '素材: 台詞の音声・BGM・効果音を足す',
        `台本 ${source} ${what}。手元の台本に無い講座と台詞の素材は、消さずに残した（全部で台詞の音声 ${clips} 本・${folders} 講座と、BGM・ジングル・効果音）。`,
        ...(opts.message ? [opts.message] : []),
      ].join('\n\n');
      const commit = await commitAndPush(repo, remote.sha, tree, message, { ...opts, parent: true }, attempt);
      if (commit) {
        const materials = [...entries].filter(([p]) => p !== README && p !== SUMS);
        const total = materials.reduce((s, [, e]) => s + e.size, 0);
        log(`${repo.branch} を ${commit.slice(0, 8)} にした（足す ${all.add}・変える ${all.change}。全部で ${materials.length + 2} ファイル・${mb(total)}）`);
        return { pushed: true, sha: commit, attempts: attempt };
      }
      log(`ほかの push が先に入っていた（${attempt} 回目）。取り直して、まとめ直す`);
    }
    throw new Error('3 回続けて、ほかの push とぶつかった。少し待ってから、もう一度 push する');
  } finally {
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  }
};

/** push の前の守り。止める理由の一覧を返す（dry-run では知らせるだけ） */
const guard = (repo: Repo): string[] => {
  const stops: string[] = [];
  if (git(repo.root, ['status', '--porcelain', '--', 'content'])) stops.push('content/ にコミットしていない変更がある。素材は台本のコミットに合わせて作るので、先にコミットする');
  const base = fetchBranch(repo, repo.base);
  if (!base) return stops;
  const r = run(repo.root, ['merge-base', '--is-ancestor', base, 'HEAD']);
  if (r.code === 1) {
    const at = git(repo.root, ['rev-parse', '--abbrev-ref', 'HEAD']);
    const main = `${repo.remote}/${repo.base}`;
    stops.push(
      [
        `HEAD（${at}）が ${main}（${base.slice(0, 7)}）を含んでいない。${repo.base} より古い台本の素材を足すと、${repo.base} の台本が使わない素材が増え、素材の README の講座の説明も古くなる。${repo.base} を取り込んでから push する:`,
        `  git fetch ${repo.remote} ${repo.base}`,
        `  git merge ${main}    # または git rebase ${main}`,
      ].join('\n'),
    );
  } else if (r.code !== 0) throw new Error(`HEAD と ${repo.remote}/${repo.base} をくらべられない: ${r.err.trim()}`);
  return stops;
};

/* ───────────── gc（消すのはここだけ） ───────────── */

/**
 * --keep の ref の台本が使わない台詞の音声（講座ごとのフォルダの .flac と .kana）を一覧にする。BGM・効果音は消さない。
 * confirm のときだけ、消した木を親の無いコミットにして push する（それまでの履歴を切り、消した素材を履歴にも残さない）
 */
export const gc = async (repo: Repo, keep: Keep, opts: Options & { confirm?: boolean; message?: string } = {}): Promise<Result> => {
  const log = opts.log ?? console.log;
  const want = new Map<string, Set<string>>();
  const abouts = new Map<string, string>();
  for (const c of keep.courses) {
    want.set(c.id, new Set([...(want.get(c.id) ?? []), ...c.keys]));
    if (!abouts.has(c.id)) abouts.set(c.id, c.about);
  }
  let tmp: string | undefined;
  try {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const remote = readRemote(repo);
      if (!remote.sha) {
        log(`${repo.remote}/${repo.branch} が無いので、消すものは無い`);
        return { pushed: false, sha: null, attempts: attempt };
      }
      // 一覧: 講座ごとに、残す台詞と消す台詞
      const clips = new Map<string, { keep: Set<string>; drop: Set<string> }>();
      const drop: string[] = [];
      for (const p of remote.entries.keys()) {
        const m = TTS_PATH.exec(p);
        if (!m) continue;
        const c = clips.get(m[1]) ?? clips.set(m[1], { keep: new Set(), drop: new Set() }).get(m[1])!;
        if (want.get(m[1])?.has(m[2])) c.keep.add(m[2]);
        else {
          c.drop.add(m[2]);
          drop.push(p);
        }
      }
      log(`gc: ${keep.refs.join('・')}の台本が使わない台詞の音声を一覧にする（素材のブランチ ${remote.sha.slice(0, 7)}）`);
      let dropped = 0;
      let kept = 0;
      for (const [id, c] of clips) {
        const sample = [...c.drop].sort().slice(0, 3);
        const more = c.drop.size > sample.length ? ` ほか ${c.drop.size - sample.length} 本` : '';
        const parts = [...(c.keep.size ? [`残す ${c.keep.size}`] : []), ...(c.drop.size ? [`消す ${c.drop.size}`] : [])];
        const notes = [...(want.has(id) ? [] : ['--keep の台本に無い講座。フォルダごと消える']), ...(sample.length ? [`例: ${sample.join(', ')}${more}`] : [])];
        log(`  ${id}: ${parts.join('・')}${notes.length ? `（${notes.join('。')}）` : ''}`);
        dropped += c.drop.size;
        kept += c.keep.size;
      }
      const audio = [...remote.entries.keys()].filter((p) => clipOf(p)?.group === 'audio').length;
      log(`  audio/（BGM・効果音）: 残す ${audio}（gc は消さない）`);
      log(`合計: 消す ${dropped}・残す ${kept}（台詞は .flac と .kana を 1 本に数える）`);

      if (!drop.length) {
        log('消すものは無い');
        return { pushed: false, sha: remote.sha, attempts: attempt };
      }
      const entries = new Map(remote.entries);
      for (const p of drop) entries.delete(p);
      if (!opts.confirm) {
        const bytes = [...entries.values()].reduce((s, e) => s + e.size, 0);
        log(`--confirm を付けると、消した木を親の無いコミットにして push する（残す素材も全部送り直す: 約 ${mb(bytes)}。いまは何も書いていない）`);
        return { pushed: false, sha: remote.sha, attempts: attempt };
      }
      // SHA256SUMS は、木に残るファイルの行だけにする
      const left = new Set([...entries.keys()].map(localOf));
      const sums = sumsText(new Map([...remote.sums].filter(([rel]) => left.has(rel))));
      const updates = new Map<string, string | null>(drop.map((p) => [p, null]));
      updates.set(README, hashText(repo.root, readmeOf(entries, abouts, remote.about), true));
      updates.set(SUMS, hashText(repo.root, sums, true));
      tmp ??= mkdtempSync(path.join(tmpdir(), 'chalkfile-materials-'));
      const tree = buildTree(repo, remote.sha, updates, tmp);
      const perCourse = [...clips].filter(([, c]) => c.drop.size).map(([id, c]) => `${id} ${c.drop.size}`);
      const message = [
        '素材: 使わない台詞の音声を消す（gc）',
        `${keep.refs.join('・')}の台本が使わない台詞の音声 ${dropped} 本を消した（${perCourse.join('・')}）。残した台詞の音声は ${kept} 本。親の無いコミットにして、それまでの履歴を切った。`,
        ...(opts.message ? [opts.message] : []),
      ].join('\n\n');
      const commit = await commitAndPush(repo, remote.sha, tree, message, { ...opts, parent: false }, attempt);
      if (commit) {
        log(`${repo.branch} を ${commit.slice(0, 8)} にした（消す ${dropped}・残す ${kept}。親の無いコミットにして、それまでの履歴を切った）`);
        return { pushed: true, sha: commit, attempts: attempt };
      }
      log(`ほかの push が先に入っていた（${attempt} 回目）。取り直して、一覧を作り直す`);
    }
    throw new Error('3 回続けて、ほかの push とぶつかった。少し待ってから、もう一度 gc する');
  } finally {
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  }
};

/* ───────────── pull ───────────── */

const listIn = (repo: Repo, ref: string, dir: string): string[] => {
  const r = run(repo.root, ['ls-tree', '--name-only', `${ref}:${dir}`]);
  return r.code === 0 ? r.out.split('\n').filter(Boolean) : [];
};

/**
 * 素材のブランチから、講座の台詞の音声と読み・BGM・効果音を取り出す。FLAC は WAV に戻し、SHA256SUMS で確かめる。
 * 読みは、SHA256SUMS に行があれば確かめてから写す（前の形の素材は読みの行が無いので、今まで通り確かめずに写す）
 */
export const pull = async (repo: Repo, ids: string[], opts: Options = {}) => {
  const log = opts.log ?? console.log;
  const convert = opts.convert ?? ffmpegConvert;
  const sha = fetchBranch(repo, repo.branch);
  if (!sha) throw new Error(`素材のブランチ ${repo.remote}/${repo.branch} が無い`);
  const inBranch = new Set(listIn(repo, sha, 'tts'));
  const absent = ids.filter((id) => !inBranch.has(id));
  if (absent.length) log(`素材のブランチに無い講座: ${absent.join(', ')}（VOICEVOX で bun scripts/synth.ts を流す）`);
  const present = ids.filter((id) => inBranch.has(id));

  const tmp = mkdtempSync(path.join(tmpdir(), 'chalkfile-materials-'));
  try {
    extract(repo.root, sha, [...present.map((id) => `tts/${id}`), 'audio', SUMS], tmp);
    const sums = parseSums(readFileSync(path.join(tmp, SUMS), 'utf8'));
    mkdirSync(path.join(repo.root, TTS), { recursive: true });
    // 取り出す先（WAV）と、もとの FLAC。同じ台詞が 2 つの講座にあっても、1 回だけ戻す
    const targets = new Map<string, string>();
    const kana = new Map<string, string>();
    for (const id of present) {
      const dir = path.join(tmp, 'tts', id);
      for (const name of readdirSync(dir)) {
        if (name.endsWith('.kana')) kana.set(`${TTS}/${name}`, path.join(dir, name));
        const wav = `${TTS}/${name.replace(/\.flac$/, '.wav')}`;
        if (name.endsWith('.flac') && !targets.has(wav)) targets.set(wav, path.join(dir, name));
      }
    }
    for (const a of AUDIO) {
      const dir = path.join(tmp, a.inBranch);
      for (const name of existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.flac')) : []) targets.set(`${a.local}/${name.replace(/\.flac$/, '.wav')}`, path.join(dir, name));
    }
    const badKana = [...kana].filter(([rel, file]) => sums.has(rel) && sha256Of(file) !== sums.get(rel)).map(([rel]) => rel);
    if (badKana.length) throw new Error(`読みが SHA256SUMS と合わない: ${badKana.slice(0, 5).join(', ')}${badKana.length > 5 ? ` ほか ${badKana.length - 5} 本` : ''}`);
    for (const [rel, file] of kana) copyFileSync(file, path.join(repo.root, rel));
    const checkedKana = [...kana.keys()].filter((rel) => sums.has(rel)).length;

    // 中身が同じ WAV が手元にあれば、変換を飛ばす（sha256 は 1 本につき 1 回だけ求める）
    const jobs = [...targets].filter(([rel]) => {
      const file = path.join(repo.root, rel);
      return !(existsSync(file) && sha256Of(file) === sums.get(rel));
    });
    log(`WAV に戻す: ${jobs.length} 本（同じ中身が手元にある ${targets.size - jobs.length} 本は飛ばす）`);
    await convert(jobs.map(([rel, flac]): [string, string] => [flac, path.join(repo.root, rel)]), 'wav');
    const bad = jobs.map(([rel]) => rel).filter((rel) => sha256Of(path.join(repo.root, rel)) !== sums.get(rel));
    if (bad.length) throw new Error(`SHA256SUMS と合わない: ${bad.slice(0, 5).join(', ')}${bad.length > 5 ? ` ほか ${bad.length - 5} 本` : ''}`);
    const kanaNote = checkedKana === kana.size ? '' : `。読みは SHA256SUMS に行がある ${checkedKana}/${kana.size} 本だけを確かめた（前の形の素材）`;
    log(`素材を取り出した（${repo.branch} @ ${sha.slice(0, 7)}・音声 ${targets.size} 本・読み ${kana.size} 本。SHA256SUMS と一致${kanaNote}）`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
};

/* ───────────── コマンド ───────────── */

const USAGE = `使い方:
  bun scripts/materials.ts pull [講座 ID …] [--videos]      素材を .work/tts/ と public/audio/ に取り出す（--videos で Releases の動画も）
  bun scripts/materials.ts check [講座 ID …]                台本の全部の台詞の音声と、BGM・効果音が手元にあるか
  bun scripts/materials.ts push [--dry-run] [--message 文]   手元の素材を素材のブランチに足す（消さない。--dry-run は本数だけを出す）
  bun scripts/materials.ts gc [--keep ref …] [--confirm]    --keep（既定 origin/main）の台本が使わない台詞の音声を一覧にする（--confirm で消す）`;

const HELP = { type: 'boolean', short: 'h' } as const;
/** 引数を読む（strict。知らない引数があれば、使い方を付けて止める） */
const parse = <T extends ParseArgsConfig>(config: T) => {
  try {
    return parseArgs({ ...config, strict: true });
  } catch (e) {
    throw new Error(`引数が読めない: ${e instanceof Error ? e.message : e}\n${USAGE}`);
  }
};

/** 講座 ID を、手元の台本の講座から選ぶ（無ければ全部） */
const pick = (ids: string[]): string[] => {
  for (const id of ids) if (!COURSES.some((c) => c.id === id)) throw new Error(`講座が無い: ${id}（${COURSES.map((c) => c.id).join(', ')}）`);
  return ids.length ? ids : COURSES.map((c) => c.id);
};

const main = async (argv: string[]) => {
  const [cmd, ...rest] = argv;
  const repo = defaultRepo();
  if (cmd === 'pull') {
    const { values, positionals } = parse({ args: rest, options: { videos: { type: 'boolean' }, help: HELP }, allowPositionals: true });
    if (values.help) return console.log(USAGE);
    const ids = pick(positionals);
    await pull(repo, ids);
    if (values.videos) await pullMedia(ids);
    console.log(
      values.videos
        ? '次は bun scripts/synth.ts（VOICEVOX なしで時刻と字幕を作る）→ bun scripts/build_site.ts'
        : '次は bun scripts/synth.ts（VOICEVOX なしで時刻を決める）→ uv run --with numpy --with scipy python scripts/mix.py → bash scripts/render.sh → bun scripts/build_site.ts',
    );
  } else if (cmd === 'check') {
    const { values, positionals } = parse({ args: rest, options: { help: HELP }, allowPositionals: true });
    if (values.help) return console.log(USAGE);
    if (!check(repo, courseKeys(HERE, pick(positionals)))) process.exitCode = 1;
  } else if (cmd === 'push') {
    const { values } = parse({ args: rest, options: { message: { type: 'string' }, 'dry-run': { type: 'boolean' }, help: HELP } });
    if (values.help) return console.log(USAGE);
    await push(repo, courseKeys(HERE), { dryRun: values['dry-run'] === true, message: values.message });
  } else if (cmd === 'gc') {
    const { values } = parse({
      args: rest,
      options: { keep: { type: 'string', multiple: true }, confirm: { type: 'boolean' }, 'dry-run': { type: 'boolean' }, message: { type: 'string' }, help: HELP },
    });
    if (values.help) return console.log(USAGE);
    if (values.confirm && values['dry-run']) throw new Error('--confirm と --dry-run は一緒に使えない');
    const refs = values.keep ?? [`${repo.remote}/${repo.base}`];
    await gc(repo, await keepAt(repo, refs), { confirm: values.confirm === true, message: values.message });
  } else if (cmd === undefined || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    console.log(USAGE);
    if (cmd === undefined) process.exitCode = 1;
  } else {
    throw new Error(`知らないコマンド: ${cmd}\n${USAGE}`);
  }
};

if (import.meta.main) {
  try {
    await main(process.argv.slice(2));
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}
