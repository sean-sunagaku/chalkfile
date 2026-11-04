// 素材のブランチの出し入れ（scripts/materials.ts）を、一時の bare リポジトリと clone で確かめる。本物の origin には触れない
import { afterAll, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Video } from '../../content';
import {
  AUDIO,
  check,
  ffmpegConvertWith,
  gc,
  keepAt,
  parseDurations,
  pull,
  pullDurations,
  push,
  type Convert,
  type CourseKeys,
  type Measure,
  type Repo,
} from '../../scripts/materials';
import { outDirs } from '../../scripts/stages/timeline/emit';
import { durationsFind, synthVideos } from '../../scripts/synth';
import { speechIn } from '../../content/voices';
import { ttsKeysIn } from '../../scripts/voices';
import { course as courseOf, lecture } from '../fixtures/content/invalid/_base';

const sandbox = mkdtempSync(path.join(tmpdir(), 'chalkfile-materials-test-'));
afterAll(() => rmSync(sandbox, { recursive: true, force: true }));

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const sha256 = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');

/** ffmpeg の代わりに、中身をそのまま写す（FLAC にしても WAV に戻しても同じバイトになる、という性質だけを借りる） */
const copy: Convert = async (jobs) => {
  for (const [from, to] of jobs) {
    mkdirSync(path.dirname(to), { recursive: true });
    copyFileSync(from, to);
  }
};
/** 長さの測り方の代わり（中身は文字なので、大きさをサンプルの数にする。本物の WAV の長さは、DURATIONS.json のテストで見る） */
const fakeMeasure: Measure = (file) => ({ samples: statSync(file).size, rate: 48000 });
/** 変換と長さの測り方を差し替え、出力を集める（テストの出力を汚さない） */
const logs = () => {
  const lines: string[] = [];
  return {
    text: () => lines.join('\n'),
    opts: { convert: copy, measure: fakeMeasure, log: (line: string) => void lines.push(line) },
  };
};

let count = 0;
const setup = (dir: string) => {
  git(dir, 'config', 'user.name', 'テスト');
  git(dir, 'config', 'user.email', 'test@example.com');
  git(dir, 'config', 'commit.gpgsign', 'false');
  git(dir, 'config', 'core.hooksPath', '/dev/null');
};
/** 一時の remote（bare）。main に最初のコミットだけがある */
const makeRemote = () => {
  const id = ++count;
  const seed = path.join(sandbox, `seed-${id}`);
  git(sandbox, 'init', '--quiet', seed);
  setup(seed);
  git(seed, 'commit', '--quiet', '--allow-empty', '-m', '始まり');
  git(seed, 'branch', '-M', 'main');
  const remote = path.join(sandbox, `remote-${id}.git`);
  git(sandbox, 'clone', '--quiet', '--bare', seed, remote);
  return remote;
};
/** remote の clone（並行する worktree のつもり）。origin は一時の remote を指す */
const cloneOf = (remote: string, name: string): Repo => {
  const root = path.join(sandbox, `${path.basename(remote, '.git')}-${name}`);
  git(sandbox, 'clone', '--quiet', remote, root);
  setup(root);
  return { root, remote: 'origin', branch: 'materials', base: 'main' };
};
/** remote の素材のブランチ */
const branchOf = (remote: string) => ({
  sha: () => git(sandbox, `--git-dir=${remote}`, 'rev-parse', '--verify', 'refs/heads/materials'),
  files: () => git(sandbox, `--git-dir=${remote}`, 'ls-tree', '-r', '--name-only', 'materials').split('\n'),
  show: (p: string) => git(sandbox, `--git-dir=${remote}`, 'show', `materials:${p}`),
});

/** 手元の台詞の音声と読み。中身は文字で十分（変換をそのまま写すものに差し替えるので） */
const voice = (repo: Repo, key: string, body = key) => {
  mkdirSync(path.join(repo.root, '.work/tts'), { recursive: true });
  writeFileSync(path.join(repo.root, '.work/tts', `${key}.wav`), `wav:${body}`);
  writeFileSync(path.join(repo.root, '.work/tts', `${key}.kana`), `kana:${body}`);
};
/** 手元の BGM・効果音（決まった名前の全部） */
const audio = (repo: Repo, make: (name: string) => string | Buffer = (name) => `audio:${name}`) => {
  for (const a of AUDIO) {
    mkdirSync(path.join(repo.root, a.local), { recursive: true });
    for (const name of a.names) writeFileSync(path.join(repo.root, a.local, `${name}.wav`), make(name));
  }
};
/** 講座。台詞ごとの探す鍵は 1 つ（v2 → v1 の探し方は、lines に 2 つの鍵を渡すテストで見る） */
const course = (id: string, keys: string[], lines: string[][] = keys.map((k) => [k])): CourseKeys => ({
  id,
  langs: ['ja'],
  lines,
  about: `講座 ${id}（1 章・ja）`,
});

test('2 つの worktree が別々の講座を順に push しても、両方の講座の素材が残る', async () => {
  const remote = makeRemote();
  const a = cloneOf(remote, 'a');
  const b = cloneOf(remote, 'b');
  for (const r of [a, b]) audio(r);
  voice(a, 'a1');
  voice(a, 'a2');
  voice(b, 'b1');
  const first = await push(a, [course('alpha', ['a1', 'a2'])], logs().opts);
  expect(first.pushed).toBe(true);
  const out = logs();
  expect((await push(b, [course('beta', ['b1'])], out.opts)).pushed).toBe(true);
  expect(out.text()).toContain('alpha: 残す 2（手元の台本に無い講座。消さずに残す）');
  expect(out.text()).toContain('beta: 足す 1');

  const m = branchOf(remote);
  const files = [
    'tts/alpha/a1.flac',
    'tts/alpha/a1.kana',
    'tts/alpha/a2.flac',
    'tts/alpha/a2.kana',
    'tts/beta/b1.flac',
    'tts/beta/b1.kana',
  ];
  expect(m.files()).toEqual(
    expect.arrayContaining([...files, 'audio/music/bed.flac', 'audio/sfx/zuko.flac', 'README.md', 'SHA256SUMS']),
  );
  // 後の push は前の版を親にする（送るのは新しい素材だけ。前の版にも戻せる）
  expect(git(sandbox, `--git-dir=${remote}`, 'rev-parse', 'materials^')).toBe(first.sha!);
  // SHA256SUMS は両方の講座の WAV と読みを持ち、README は両方の講座を載せる
  const sums = m.show('SHA256SUMS');
  for (const line of [
    `${sha256('wav:a1')}  .work/tts/a1.wav`,
    `${sha256('kana:a1')}  .work/tts/a1.kana`,
    `${sha256('wav:b1')}  .work/tts/b1.wav`,
  ])
    expect(sums).toContain(line);
  expect(m.show('README.md')).toContain('| `tts/alpha/` | 講座 alpha（1 章・ja）の台詞の音声');
  expect(m.show('README.md')).toContain('| `tts/beta/` | 講座 beta（1 章・ja）の台詞の音声');
}, 30_000);

test('lease が拒否されたら、取り直してまとめ直し、もう一度 push する', async () => {
  const remote = makeRemote();
  const a = cloneOf(remote, 'a');
  const b = cloneOf(remote, 'b');
  for (const r of [a, b]) audio(r);
  voice(a, 'a1');
  voice(b, 'b1');
  // A が素材のブランチを取ってきてから push するまでの間に、B が別の講座を push する
  const out = logs();
  const result = await push(a, [course('alpha', ['a1'])], {
    ...out.opts,
    beforePush: async (attempt) => {
      if (attempt === 1) await push(b, [course('beta', ['b1'])], logs().opts);
    },
  });
  expect(result).toMatchObject({ pushed: true, attempts: 2 });
  expect(out.text()).toContain('ほかの push が先に入っていた（1 回目）');
  expect(out.text()).toContain('beta: 残す 1');
  expect(branchOf(remote).sha()).toBe(result.sha!);
  expect(branchOf(remote).files()).toEqual(expect.arrayContaining(['tts/alpha/a1.flac', 'tts/beta/b1.flac']));
}, 30_000);

test('3 回続けてぶつかったら止め、先に入った素材は消さない', async () => {
  const remote = makeRemote();
  const a = cloneOf(remote, 'a');
  const b = cloneOf(remote, 'b');
  for (const r of [a, b]) audio(r);
  voice(a, 'a1');
  for (const k of ['b1', 'b2', 'b3']) voice(b, k);
  const pushing = push(a, [course('alpha', ['a1'])], {
    ...logs().opts,
    beforePush: async (attempt) => {
      await push(b, [course(`beta${attempt}`, [`b${attempt}`])], logs().opts);
    },
  });
  await expect(pushing).rejects.toThrow('3 回続けて');
  const files = branchOf(remote).files();
  expect(files).toEqual(expect.arrayContaining(['tts/beta1/b1.flac', 'tts/beta2/b2.flac', 'tts/beta3/b3.flac']));
  expect(files).not.toContain('tts/alpha/a1.flac');
}, 30_000);

test('木が前と同じなら、FLAC にもせず、push もコミットもしない', async () => {
  const remote = makeRemote();
  const a = cloneOf(remote, 'a');
  audio(a);
  voice(a, 'a1');
  const first = await push(a, [course('alpha', ['a1'])], logs().opts);
  const converted: number[] = [];
  const out = logs();
  const again = await push(a, [course('alpha', ['a1'])], {
    ...out.opts,
    convert: async (jobs, to) => {
      converted.push(jobs.length);
      await copy(jobs, to);
    },
  });
  expect(again).toMatchObject({ pushed: false, sha: first.sha });
  expect(converted).toEqual([]);
  expect(out.text()).toContain('素材のブランチと同じなので、push しない');
  expect(branchOf(remote).sha()).toBe(first.sha!);
  // 別の clone から同じ素材を push しても、同じ
  const b = cloneOf(remote, 'b');
  audio(b);
  voice(b, 'a1');
  expect((await push(b, [course('alpha', ['a1'])], logs().opts)).pushed).toBe(false);
  expect(branchOf(remote).sha()).toBe(first.sha!);
}, 30_000);

test('gc は --confirm が無いと何も消さず、付けたときだけ --keep の台本が使わない素材を消す', async () => {
  const remote = makeRemote();
  const a = cloneOf(remote, 'a');
  const b = cloneOf(remote, 'b');
  for (const r of [a, b]) audio(r);
  voice(a, 'a1');
  voice(a, 'a2');
  voice(b, 'b1');
  await push(a, [course('alpha', ['a1', 'a2'])], logs().opts);
  await push(b, [course('beta', ['b1'])], logs().opts);
  const m = branchOf(remote);
  const before = m.sha();
  const keep = { refs: ['テストの台本'], courses: [course('alpha', ['a1'])] };

  const out = logs();
  expect((await gc(a, keep, out.opts)).pushed).toBe(false);
  expect(m.sha()).toBe(before);
  expect(out.text()).toContain('alpha: 残す 1・消す 1（例: a2）');
  expect(out.text()).toContain('beta: 消す 1（--keep の台本に無い講座。フォルダごと消える。例: b1）');
  expect(out.text()).toContain('--confirm を付けると、消した木を親の無いコミットにして push する');

  expect((await gc(a, keep, { ...logs().opts, confirm: true })).pushed).toBe(true);
  // gc は親の無いコミットにして、消した素材を履歴にも残さない
  expect(git(sandbox, `--git-dir=${remote}`, 'rev-list', '--count', 'materials')).toBe('1');
  const files = m.files();
  expect(files).toEqual(
    expect.arrayContaining([
      'tts/alpha/a1.flac',
      'tts/alpha/a1.kana',
      'audio/sfx/zuko.flac',
      'README.md',
      'SHA256SUMS',
    ]),
  );
  for (const gone of ['tts/alpha/a2.flac', 'tts/alpha/a2.kana', 'tts/beta/b1.flac', 'tts/beta/b1.kana'])
    expect(files).not.toContain(gone);
  const sums = m.show('SHA256SUMS');
  for (const gone of ['.work/tts/a2.wav', '.work/tts/a2.kana', '.work/tts/b1.wav']) expect(sums).not.toContain(gone);
  expect(m.show('README.md')).not.toContain('tts/beta/');
  // 消した後は、もう消すものは無い
  const again = logs();
  expect((await gc(a, keep, { ...again.opts, confirm: true })).pushed).toBe(false);
  expect(again.text()).toContain('消すものは無い');
}, 30_000);

test('gc の --keep は、その ref の台本（content/ と scripts/voices.ts）から台詞の音声の名前を作る', async () => {
  const remote = makeRemote();
  const a = cloneOf(remote, 'a');
  const write = (p: string, body: string) => {
    mkdirSync(path.dirname(path.join(a.root, p)), { recursive: true });
    writeFileSync(path.join(a.root, p), body);
  };
  write(
    'content/index.ts',
    [
      "const ALPHA = { id: 'alpha', title: 'アルファ', unitLabel: 'CHAPTER', lectures: [{ scenes: [{ lines: [{ t: 'こんにちは' }, { t: 'またね', v: 'zundamon' }] }] }] };",
      'export const COURSES = [ALPHA];',
      "export const coursesIn = (lang: string) => (lang === 'ja' ? COURSES : []);",
    ].join('\n'),
  );
  write('content/i18n.ts', "export const LANGS = ['ja', 'en'];\n");
  write(
    'scripts/voices.ts',
    'export const speechIn = (line: { t: string }) => line.t;\nexport const ttsKeyIn = (text: string, voice: string, lang: string) => `${lang}-${voice}-${text}`;\n',
  );
  git(a.root, 'add', '-A');
  git(a.root, 'commit', '--quiet', '-m', '台本');
  git(a.root, 'push', '--quiet', 'origin', 'HEAD:main');
  const keep = await keepAt(a, ['origin/main']);
  expect(keep.refs).toEqual([`origin/main（${git(a.root, 'rev-parse', 'HEAD').slice(0, 7)}）`]);
  expect(keep.courses).toEqual([
    {
      id: 'alpha',
      langs: ['ja'],
      lines: [['ja-narrator-こんにちは'], ['ja-zundamon-またね']],
      about: 'アルファ（1 章・ja）',
    },
  ]);
  await expect(keepAt(a, ['origin/nosuch'])).rejects.toThrow('origin に無い');
}, 30_000);

test('gc の --keep は、読み上げる文を content/voices.ts から読む（scripts/voices.ts には鍵の計算だけがある版）', async () => {
  const remote = makeRemote();
  const a = cloneOf(remote, 'a');
  const write = (p: string, body: string) => {
    mkdirSync(path.dirname(path.join(a.root, p)), { recursive: true });
    writeFileSync(path.join(a.root, p), body);
  };
  write(
    'content/index.ts',
    [
      "const ALPHA = { id: 'alpha', title: 'アルファ', lectures: [{ scenes: [{ lines: [{ t: 'こんにちは', s: 'こんにちわ' }] }] }] };",
      'export const COURSES = [ALPHA];',
      "export const coursesIn = (lang: string) => (lang === 'ja' ? COURSES : []);",
    ].join('\n'),
  );
  write('content/i18n.ts', "export const LANGS = ['ja'];\n");
  // 読み上げる文は content/voices.ts にあり、scripts/voices.ts はそれを読んで鍵を作る
  write('content/voices.ts', 'export const speechIn = (line: { t: string; s?: string }) => line.s ?? line.t;\n');
  write(
    'scripts/voices.ts',
    "export const ttsKeyIn = (text: string, voice: string, lang: string) => [lang, voice, text].join('-');\n",
  );
  git(a.root, 'add', '-A');
  git(a.root, 'commit', '--quiet', '-m', '台本');
  git(a.root, 'push', '--quiet', 'origin', 'HEAD:main');
  const keep = await keepAt(a, ['origin/main']);
  expect(keep.courses.map((c) => c.lines)).toEqual([[['ja-narrator-こんにちわ']]]);
}, 30_000);

test('台詞は v2 → v1 の順に探し、手元にある最初の鍵の音声を置く。gc は台詞の v2 と v1 の両方を残す', async () => {
  const remote = makeRemote();
  const a = cloneOf(remote, 'a');
  audio(a);
  voice(a, 'v1a');
  voice(a, 'v2b');
  voice(a, 'v1b');
  // 1 つ目の台詞は前の声（v1）だけがある。2 つ目は両方ある（v2 を置く）
  const lines = [
    ['v2a', 'v1a'],
    ['v2b', 'v1b'],
  ];
  const lines1: string[] = [];
  expect(check(a, [course('alpha', [], lines)], (l) => void lines1.push(l))).toBe(true);
  expect(lines1).toContain('alpha（ja）: 台詞の音声 2/2');
  expect((await push(a, [course('alpha', [], lines)], logs().opts)).pushed).toBe(true);
  const files = branchOf(remote).files();
  expect(files).toEqual(expect.arrayContaining(['tts/alpha/v1a.flac', 'tts/alpha/v1a.kana', 'tts/alpha/v2b.flac']));
  for (const no of ['tts/alpha/v2a.flac', 'tts/alpha/v1b.flac']) expect(files).not.toContain(no);
  // どの鍵の声も無い台詞は、足りない
  expect(check(a, [course('alpha', [], [['v2c', 'v1c']])], () => {})).toBe(false);
  // gc は、台詞の v2 と v1 の両方を残す（どちらの名前の声も使える）
  const out = logs();
  expect((await gc(a, { refs: ['テストの台本'], courses: [course('alpha', [], lines)] }, out.opts)).pushed).toBe(false);
  expect(out.text()).toContain('消すものは無い');
}, 30_000);

test('v2 の声の記録（.meta.json）は、読みと同じに push・pull し、gc は音声と一緒に消す', async () => {
  const remote = makeRemote();
  const a = cloneOf(remote, 'a');
  audio(a);
  voice(a, 'k2');
  voice(a, 'k3');
  writeFileSync(path.join(a.root, '.work/tts/k2.meta.json'), '{"schema":1,"key":"k2"}\n');
  await push(a, [course('alpha', ['k2', 'k3'])], logs().opts);
  const m = branchOf(remote);
  // 記録は v2 の声（記録のあるもの）だけ。SHA256SUMS にも行を足す
  expect(m.files()).toContain('tts/alpha/k2.meta.json');
  expect(m.files()).not.toContain('tts/alpha/k3.meta.json');
  expect(m.show('SHA256SUMS')).toContain(`${sha256('{"schema":1,"key":"k2"}\n')}  .work/tts/k2.meta.json`);
  // 取り出すと、共有のキャッシュの読みの隣に置く
  const cache = mkdtempSync(path.join(sandbox, 'cache-'));
  const b = withCache(cloneOf(remote, 'b'), cache);
  const out = logs();
  await pull(b, ['alpha'], out.opts);
  expect(readFileSync(path.join(cache, 'k2.meta.json'), 'utf8')).toBe('{"schema":1,"key":"k2"}\n');
  expect(out.text()).toContain('読み 2 本・声の記録 1 本');
  // gc で台詞の音声を消すと、記録も消える
  await gc(a, { refs: ['テストの台本'], courses: [course('alpha', ['k3'])] }, { ...logs().opts, confirm: true });
  expect(m.files()).not.toContain('tts/alpha/k2.meta.json');
  expect(m.show('SHA256SUMS')).not.toContain('k2.meta.json');
}, 30_000);

test('gc の --keep は、その ref の scripts/voices.ts に ttsKeysIn があれば、台詞ごとの v2 と v1 の鍵を作る', async () => {
  const remote = makeRemote();
  const a = cloneOf(remote, 'a');
  const write = (p: string, body: string) => {
    mkdirSync(path.dirname(path.join(a.root, p)), { recursive: true });
    writeFileSync(path.join(a.root, p), body);
  };
  write(
    'content/index.ts',
    [
      "const ALPHA = { id: 'alpha', title: 'アルファ', lectures: [{ scenes: [{ lines: [{ t: 'こんにちは' }, { t: 'こんにちは' }] }] }] };",
      'export const COURSES = [ALPHA];',
      "export const coursesIn = (lang: string) => (lang === 'ja' ? COURSES : []);",
    ].join('\n'),
  );
  write('content/i18n.ts', "export const LANGS = ['ja'];\n");
  write('content/voices.ts', 'export const speechIn = (line: { t: string }) => line.t;\n');
  write(
    'scripts/voices.ts',
    'export const ttsKeysIn = (text: string, voice: string, lang: string) => [`v2-${voice}-${text}`, `v1-${voice}-${text}`];\n',
  );
  git(a.root, 'add', '-A');
  git(a.root, 'commit', '--quiet', '-m', '台本');
  git(a.root, 'push', '--quiet', 'origin', 'HEAD:main');
  const keep = await keepAt(a, ['origin/main']);
  // 同じ文と声の台詞は 1 つにまとめる
  expect(keep.courses.map((c) => c.lines)).toEqual([[['v2-narrator-こんにちは', 'v1-narrator-こんにちは']]]);
}, 30_000);

test('HEAD が origin/main を含まなければ push を止め、取り込む手順を出す（dry-run は知らせるだけ）', async () => {
  const remote = makeRemote();
  const a = cloneOf(remote, 'a');
  const b = cloneOf(remote, 'b');
  audio(a);
  voice(a, 'a1');
  // A が clone した後に、main が進む
  git(b.root, 'commit', '--quiet', '--allow-empty', '-m', 'main を進める');
  git(b.root, 'push', '--quiet', 'origin', 'HEAD:main');
  const message = await push(a, [course('alpha', ['a1'])], logs().opts).then(
    () => '',
    (e: Error) => e.message,
  );
  expect(message).toContain('origin/main');
  expect(message).toContain('を含んでいない');
  expect(message).toContain('git merge origin/main');
  expect(() => branchOf(remote).sha()).toThrow();

  const out = logs();
  expect((await push(a, [course('alpha', ['a1'])], { ...out.opts, dryRun: true })).pushed).toBe(false);
  expect(out.text()).toContain('注意（push なら、ここで止まる）');
  expect(out.text()).toContain('alpha: 足す 1');
  expect(out.text()).toContain('dry-run なので、何も書かずに終える');
  expect(() => branchOf(remote).sha()).toThrow();

  git(a.root, 'merge', '--quiet', '--ff-only', 'origin/main');
  expect((await push(a, [course('alpha', ['a1'])], logs().opts)).pushed).toBe(true);
}, 30_000);

test('同じ台詞の音声が変わったら、ほかの講座のフォルダの分もそろえる（SHA256SUMS は手元のパスごとに 1 行）', async () => {
  const remote = makeRemote();
  const a = cloneOf(remote, 'a');
  const b = cloneOf(remote, 'b');
  for (const r of [a, b]) audio(r);
  voice(a, 'k1', 'v1');
  voice(b, 'k1', 'v2');
  await push(a, [course('alpha', ['k1'])], logs().opts);
  const out = logs();
  await push(b, [course('beta', ['k1'])], out.opts);
  expect(out.text()).toContain('alpha: 変える 1（手元の台本に無い講座。消さずに残す）');
  const m = branchOf(remote);
  expect(m.show('tts/alpha/k1.flac')).toBe('wav:v2');
  expect(m.show('tts/alpha/k1.kana')).toBe('kana:v2');
  expect(m.show('SHA256SUMS')).toContain(`${sha256('wav:v2')}  .work/tts/k1.wav`);
  // alpha だけを取り出しても、SHA256SUMS と合う
  const c = cloneOf(remote, 'c');
  await pull(c, ['alpha'], logs().opts);
  expect(readFileSync(path.join(c.root, '.work/tts/k1.wav'), 'utf8')).toBe('wav:v2');
  expect(readFileSync(path.join(c.root, '.work/tts/k1.kana'), 'utf8')).toBe('kana:v2');
}, 30_000);

test('前の形の素材（読みの行が SHA256SUMS に無い）も、今まで通り取り出せる', async () => {
  const remote = makeRemote();
  const old = cloneOf(remote, 'old');
  // 前の materials.ts が作った形を手で組む（SHA256SUMS は WAV の行だけ）
  const files: Record<string, string> = {
    'tts/alpha/a1.flac': 'wav:a1',
    'tts/alpha/a1.kana': 'kana:a1',
    'README.md': '# Chalkfile の動画の素材\n',
  };
  const wavs: [string, string][] = [['.work/tts/a1.wav', 'wav:a1']];
  for (const a of AUDIO) {
    for (const name of a.names) {
      files[`${a.inBranch}/${name}.flac`] = `audio:${name}`;
      wavs.push([`${a.local}/${name}.wav`, `audio:${name}`]);
    }
  }
  files.SHA256SUMS = `${wavs.map(([rel, body]) => `${sha256(body)}  ${rel}`).join('\n')}\n`;
  git(old.root, 'checkout', '--quiet', '--orphan', 'materials');
  for (const [p, body] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(old.root, p)), { recursive: true });
    writeFileSync(path.join(old.root, p), body);
  }
  git(old.root, 'add', '-A');
  git(old.root, 'commit', '--quiet', '-m', '素材（前の形）');
  git(old.root, 'push', '--quiet', 'origin', 'materials');

  const b = cloneOf(remote, 'b');
  const out = logs();
  await pull(b, ['alpha'], out.opts);
  expect(readFileSync(path.join(b.root, '.work/tts/a1.wav'), 'utf8')).toBe('wav:a1');
  expect(readFileSync(path.join(b.root, '.work/tts/a1.kana'), 'utf8')).toBe('kana:a1');
  expect(readFileSync(path.join(b.root, 'public/audio/sfx/zuko.wav'), 'utf8')).toBe('audio:zuko');
  expect(out.text()).toContain('読みは SHA256SUMS に行がある 0/1 本だけを確かめた（前の形の素材）');

  // 前の形の素材にも、push で足せる（読みの行は、手元の分から SHA256SUMS に入る）
  audio(b);
  voice(b, 'b1');
  expect((await push(b, [course('beta', ['b1'])], logs().opts)).pushed).toBe(true);
  const sums = branchOf(remote).show('SHA256SUMS');
  expect(sums).toContain(`${sha256('kana:b1')}  .work/tts/b1.kana`);
  expect(sums).toContain(`${sha256('wav:a1')}  .work/tts/a1.wav`);
  expect(sums).not.toContain('.work/tts/a1.kana');
}, 30_000);

test('読みが SHA256SUMS と合わなければ、写さずに止める', async () => {
  const remote = makeRemote();
  const a = cloneOf(remote, 'a');
  audio(a);
  voice(a, 'a1');
  await push(a, [course('alpha', ['a1'])], logs().opts);
  // 素材のブランチの読みだけを書き換える
  const t = cloneOf(remote, 't');
  git(t.root, 'checkout', '--quiet', 'materials');
  writeFileSync(path.join(t.root, 'tts/alpha/a1.kana'), 'kana:wrong');
  git(t.root, 'commit', '--quiet', '-am', '読みを書き換える');
  git(t.root, 'push', '--quiet', 'origin', 'materials');

  const b = cloneOf(remote, 'b');
  await expect(pull(b, ['alpha'], logs().opts)).rejects.toThrow('読みが SHA256SUMS と合わない: .work/tts/a1.kana');
  expect(existsSync(path.join(b.root, '.work/tts/a1.kana'))).toBe(false);
}, 30_000);

test('check は BGM・効果音を、決まった名前の一覧で確かめる', () => {
  const remote = makeRemote();
  const a = cloneOf(remote, 'a');
  audio(a);
  voice(a, 'a1');
  rmSync(path.join(a.root, 'public/audio/sfx/zuko.wav'));
  // 数がそろっていても、名前が違えば足りない
  writeFileSync(path.join(a.root, 'public/audio/sfx/other.wav'), 'audio:other');
  const lines: string[] = [];
  expect(check(a, [course('alpha', ['a1'])], (line) => void lines.push(line))).toBe(false);
  expect(lines).toContain('alpha（ja）: 台詞の音声 1/1');
  expect(lines).toContain(
    'public/audio/sfx: 11/12 個（足りない: zuko。bun scripts/materials.ts pull か、scripts/build_music.py）',
  );
});

/** 小さな WAV（48kHz・モノラル・16bit・0.05 秒） */
const wav = (seed: number) => {
  const data = Buffer.alloc(2400 * 2);
  for (let i = 0; i < 2400; i++) data.writeInt16LE(Math.round(Math.sin((i * (seed + 1) * Math.PI) / 50) * 8000), i * 2);
  const head = Buffer.alloc(44);
  head.write('RIFF', 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write('WAVEfmt ', 8);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(48000, 24);
  head.writeUInt32LE(96000, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write('data', 36);
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
};

test.skipIf(!Bun.which('ffmpeg'))(
  'ffmpeg で FLAC にして WAV に戻すと、元と同じバイトになる',
  async () => {
    const remote = makeRemote();
    const a = cloneOf(remote, 'a');
    const b = cloneOf(remote, 'b');
    let seed = 0;
    audio(a, () => wav(seed++));
    mkdirSync(path.join(a.root, '.work/tts'), { recursive: true });
    writeFileSync(path.join(a.root, '.work/tts/a1.wav'), wav(99));
    writeFileSync(path.join(a.root, '.work/tts/a1.kana'), 'アイウ');
    await push(a, [course('alpha', ['a1'])], { log: () => {} });
    await pull(b, ['alpha'], { log: () => {} });
    expect(readFileSync(path.join(b.root, '.work/tts/a1.wav')).equals(wav(99))).toBe(true);
    for (const a2 of AUDIO) {
      for (const name of a2.names)
        expect(
          readFileSync(path.join(b.root, a2.local, `${name}.wav`)).equals(
            readFileSync(path.join(a.root, a2.local, `${name}.wav`)),
          ),
        ).toBe(true);
    }
  },
  60_000,
);

test('ffmpeg の変換は、止まったままなら時間で止め、失敗したら ffmpeg のエラーの終わり（伏せてから）を出す', async () => {
  // PATH の頭に、偽の ffmpeg（止まったまま・失敗する）を置く
  const bin = mkdtempSync(path.join(sandbox, 'bin-'));
  const fakeFfmpeg = (body: string) => {
    writeFileSync(path.join(bin, 'ffmpeg'), `#!/bin/sh\n${body}\n`);
    chmodSync(path.join(bin, 'ffmpeg'), 0o755);
  };
  const job: [string, string][] = [[path.join(bin, 'in.wav'), path.join(bin, 'out/x.flac')]];
  const PATH = process.env.PATH;
  process.env.PATH = `${bin}:${PATH}`;
  try {
    fakeFfmpeg('sleep 5');
    const t0 = performance.now();
    await expect(ffmpegConvertWith({ timeoutMs: 200 })(job, 'flac')).rejects.toThrow('（0.2 秒で終わらなかった）');
    expect(performance.now() - t0).toBeLessThan(3000);
    fakeFfmpeg(`echo "in.wav: Invalid data found ghp_${'C'.repeat(36)}" >&2; exit 1`);
    await expect(ffmpegConvertWith()(job, 'flac')).rejects.toThrow(
      `ffmpeg が失敗した: ${job[0][0]}（終了コード 1）: in.wav: Invalid data found ［伏せた token］`,
    );
  } finally {
    process.env.PATH = PATH;
  }
});

/* ───────────── 作業フォルダの間で共有するキャッシュ ───────────── */

/** 共有のキャッシュを使う clone（キャッシュは一時のフォルダ。手元の ~/.cache には触れない） */
const withCache = (repo: Repo, cache: string): Repo => ({ ...repo, cache });
/** 変換の数を数える（変換はそのまま写す） */
const counting = () => {
  let jobs = 0;
  const convert: Convert = async (list, to) => {
    jobs += list.length;
    await copy(list, to);
  };
  return { convert, jobs: () => jobs };
};

test('台詞の声は共有のキャッシュに取り出し、2 つ目の作業フォルダは変換しない（同じ中身はキャッシュから使う）', async () => {
  const remote = makeRemote();
  const a = cloneOf(remote, 'a');
  audio(a);
  voice(a, 'a1');
  voice(a, 'a2');
  await push(a, [course('alpha', ['a1', 'a2'])], logs().opts);

  const cache = mkdtempSync(path.join(sandbox, 'cache-'));
  const b = withCache(cloneOf(remote, 'b'), cache);
  const first = counting();
  await pull(b, ['alpha'], { convert: first.convert, log: () => {} });
  // 台詞の声と読みはキャッシュに、BGM・効果音は作業フォルダに置き、作業フォルダの .work/tts には書かない
  expect(readFileSync(path.join(cache, 'a1.wav'), 'utf8')).toBe('wav:a1');
  expect(readFileSync(path.join(cache, 'a2.kana'), 'utf8')).toBe('kana:a2');
  expect(existsSync(path.join(b.root, '.work/tts'))).toBe(false);
  expect(readFileSync(path.join(b.root, 'public/audio/sfx/zuko.wav'), 'utf8')).toBe('audio:zuko');
  expect(first.jobs()).toBe(2 + AUDIO.reduce((n, x) => n + x.names.length, 0));
  // 書きかけの一時のファイルを残さない
  expect(readdirSync(cache).filter((f) => f.endsWith('.tmp'))).toEqual([]);

  const c = withCache(cloneOf(remote, 'c'), cache);
  const second = counting();
  const out: string[] = [];
  await pull(c, ['alpha'], { convert: second.convert, log: (l) => void out.push(l) });
  // 台詞の声はキャッシュにあるので変換しない（BGM・効果音は作業フォルダごと）
  expect(second.jobs()).toBe(AUDIO.reduce((n, x) => n + x.names.length, 0));
  expect(out.join('\n')).toContain('同じ中身が手元にある 2 本は飛ばす');
  // check と push は、キャッシュの声を読む（作業フォルダに .work/tts が無くても足りている）
  const lines: string[] = [];
  expect(check(c, [course('alpha', ['a1', 'a2'])], (l) => void lines.push(l))).toBe(true);
  expect(lines).toContain('alpha（ja）: 台詞の音声 2/2');
  expect((await push(c, [course('alpha', ['a1', 'a2'])], logs().opts)).pushed).toBe(false);
}, 30_000);

test('キャッシュの声が SHA256SUMS と合わなければ取り出し直し、合わない変換はキャッシュに置かない', async () => {
  const remote = makeRemote();
  const a = cloneOf(remote, 'a');
  audio(a);
  voice(a, 'a1');
  await push(a, [course('alpha', ['a1'])], logs().opts);
  const cache = mkdtempSync(path.join(sandbox, 'cache-'));
  const b = withCache(cloneOf(remote, 'b'), cache);
  await pull(b, ['alpha'], logs().opts);
  // 壊れたキャッシュ（中身が違う）は、SHA256SUMS と照らし合わせて取り出し直す
  writeFileSync(path.join(cache, 'a1.wav'), 'wav:broken');
  await pull(b, ['alpha'], logs().opts);
  expect(readFileSync(path.join(cache, 'a1.wav'), 'utf8')).toBe('wav:a1');
  // 変換した中身が SHA256SUMS と合わなければ止め、キャッシュの前の中身を変えない
  writeFileSync(path.join(cache, 'a1.wav'), 'wav:broken');
  const wrong: Convert = async (jobs) => {
    for (const [, to] of jobs) {
      mkdirSync(path.dirname(to), { recursive: true });
      writeFileSync(to, 'wav:wrong');
    }
  };
  await expect(pull(b, ['alpha'], { convert: wrong, log: () => {} })).rejects.toThrow(
    'SHA256SUMS と合わない: .work/tts/a1.wav',
  );
  expect(readFileSync(path.join(cache, 'a1.wav'), 'utf8')).toBe('wav:broken');
  expect(readdirSync(cache).filter((f) => f.endsWith('.tmp'))).toEqual([]);
}, 30_000);

test('前の置き場所（作業フォルダの .work/tts）の声も読め、同じ中身なら変換せずにキャッシュへ写す', async () => {
  const remote = makeRemote();
  const a = cloneOf(remote, 'a');
  audio(a);
  voice(a, 'a1');
  await push(a, [course('alpha', ['a1'])], logs().opts);
  // 前の materials.ts で取り出した作業フォルダ（.work/tts にある）に、キャッシュを足す
  const cache = mkdtempSync(path.join(sandbox, 'cache-'));
  const old = withCache(a, cache);
  const lines: string[] = [];
  expect(check(old, [course('alpha', ['a1'])], (l) => void lines.push(l))).toBe(true);
  const conv = counting();
  const out: string[] = [];
  await pull(old, ['alpha'], { convert: conv.convert, log: (l) => void out.push(l) });
  expect(readFileSync(path.join(cache, 'a1.wav'), 'utf8')).toBe('wav:a1');
  expect(out.join('\n')).toContain('そのうち 1 本は .work/tts から共有のキャッシュに写した');
  // 台詞の声は変換していない（BGM・効果音は同じ中身が作業フォルダにある）
  expect(conv.jobs()).toBe(0);
}, 30_000);

test('ほかの作業フォルダの fetch と参照のロックを取り合っても、少し待って取り直す', async () => {
  const remote = makeRemote();
  const a = cloneOf(remote, 'a');
  // b は素材のブランチができる前の clone（取り出すとき、追跡のブランチの参照を作る）
  const b = cloneOf(remote, 'b');
  audio(a);
  voice(a, 'a1');
  await push(a, [course('alpha', ['a1'])], logs().opts);
  // ほかの fetch が、追跡のブランチの参照のロックを持っている（0.4 秒後に外れる）
  const lock = path.join(b.root, '.git/refs/remotes/origin/materials.lock');
  mkdirSync(path.dirname(lock), { recursive: true });
  writeFileSync(lock, '');
  const release = Bun.spawn(['sh', '-c', `sleep 0.4; rm -f '${lock}'`]);
  const started = Date.now();
  await pull(b, ['alpha'], logs().opts);
  await release.exited;
  // ロックが外れるまで待って、取り直した
  expect(Date.now() - started).toBeGreaterThanOrEqual(350);
  expect(readFileSync(path.join(b.root, '.work/tts/a1.wav'), 'utf8')).toBe('wav:a1');
}, 30_000);

/* ───────────── 台詞の音声の長さ（DURATIONS.json）と、長さと読みだけの取り出し ───────────── */

/** 長さが seconds 秒の、本物の WAV（48kHz・モノラル・16bit。seed で中身を変える） */
const wavOf = (seconds: number, seed = 1) => {
  const n = Math.round(seconds * 48000);
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) data.writeInt16LE(Math.round(Math.sin((i * seed) / 30) * 4000), i * 2);
  const head = Buffer.alloc(44);
  head.write('RIFF', 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write('WAVEfmt ', 8);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(48000, 24);
  head.writeUInt32LE(96000, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write('data', 36);
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
};
/** 本物の WAV の台詞の声（読みは文字） */
const realVoice = (dir: string, key: string, seconds: number, seed = 1) => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `${key}.wav`), wavOf(seconds, seed));
  writeFileSync(path.join(dir, `${key}.kana`), `カナ:${key}`);
};
/** 本物の長さの測り方で、変換だけを差し替える */
const real = () => {
  const lines: string[] = [];
  return { text: () => lines.join('\n'), opts: { convert: copy, log: (line: string) => void lines.push(line) } };
};

test('push は、台詞の音声の長さ（DURATIONS.json）を WAV から測って書き、ほかの講座の長さは引き継ぐ', async () => {
  const remote = makeRemote();
  const a = cloneOf(remote, 'a');
  audio(a);
  realVoice(path.join(a.root, '.work/tts'), 'a1', 1.5);
  realVoice(path.join(a.root, '.work/tts'), 'a2', 0.25, 2);
  const out = real();
  await push(a, [course('alpha', ['a1', 'a2'])], out.opts);
  expect(out.text()).toContain('DURATIONS.json: 作り直す（長さ 2 本: WAV から測った 2・前の版から引き継いだ 0）');
  const m = branchOf(remote);
  const sums = m.show('SHA256SUMS');
  const shaOf = (rel: string) =>
    sums
      .split('\n')
      .find((l) => l.endsWith(`  ${rel}`))
      ?.slice(0, 64) ?? '';
  const text = `${m.show('DURATIONS.json')}\n`;
  expect(parseDurations(text)).toEqual(
    new Map([
      ['a1', { samples: 72000, rate: 48000, sha256: shaOf('.work/tts/a1.wav') }],
      ['a2', { samples: 12000, rate: 48000, sha256: shaOf('.work/tts/a2.wav') }],
    ]),
  );
  // 鍵の順に 1 行ずつ（同じ長さなら同じバイト列）
  expect(text.split('\n').filter((l) => l.includes('"samples"'))).toEqual([
    `    "a1": { "samples": 72000, "rate": 48000, "sha256": "${shaOf('.work/tts/a1.wav')}" },`,
    `    "a2": { "samples": 12000, "rate": 48000, "sha256": "${shaOf('.work/tts/a2.wav')}" }`,
  ]);
  expect(m.show('README.md')).toContain('| `DURATIONS.json` |');
  // 同じ素材なら push しない
  expect((await push(a, [course('alpha', ['a1', 'a2'])], real().opts)).pushed).toBe(false);
  // ほかの講座だけを持つ作業フォルダの push は、alpha の長さを前の版から引き継ぐ
  const b = cloneOf(remote, 'b');
  audio(b);
  realVoice(path.join(b.root, '.work/tts'), 'b1', 0.5);
  const outB = real();
  await push(b, [course('beta', ['b1'])], outB.opts);
  expect(outB.text()).toContain('長さ 3 本: WAV から測った 1・前の版から引き継いだ 2');
  expect([...parseDurations(m.show('DURATIONS.json')).keys()]).toEqual(['a1', 'a2', 'b1']);
  // 音声を作り直したら（中身が変わったら）測り直す
  realVoice(path.join(a.root, '.work/tts'), 'a1', 2, 3);
  git(a.root, 'pull', '--quiet', '--ff-only', 'origin', 'main');
  await push(a, [course('alpha', ['a1', 'a2'])], real().opts);
  expect(parseDurations(m.show('DURATIONS.json')).get('a1')?.samples).toBe(96000);
  // gc で消した台詞の長さは、一覧からも消す
  await gc(a, { refs: ['テストの台本'], courses: [course('alpha', ['a1'])] }, { ...real().opts, confirm: true });
  expect([...parseDurations(m.show('DURATIONS.json')).keys()]).toEqual(['a1']);
}, 30_000);

test('長さを測れない音声（壊れた WAV）は push しない', async () => {
  const remote = makeRemote();
  const a = cloneOf(remote, 'a');
  audio(a);
  mkdirSync(path.join(a.root, '.work/tts'), { recursive: true });
  writeFileSync(path.join(a.root, '.work/tts/a1.wav'), wavOf(1).subarray(0, 100));
  writeFileSync(path.join(a.root, '.work/tts/a1.kana'), 'カナ');
  await expect(push(a, [course('alpha', ['a1'])], real().opts)).rejects.toThrow('台詞の音声の長さを測れない');
  expect(() => branchOf(remote).sha()).toThrow();
}, 30_000);

test('長さと読みだけの取り出し（音声と ffmpeg は要らない）で作った出力は、音声から作った出力と同じバイト列', async () => {
  // 見本の講座（台詞 3 つ）の声を、本物の WAV で作って素材のブランチに足す
  const lec = lecture([
    { kind: 'opening', title: '見本', lines: [{ t: 'はじめます。', v: 'announcer' }] },
    {
      kind: 'big',
      heading: '大事なこと',
      text: '台本が正本',
      lines: [{ t: '一つ目です。', pause: 0.2 }, { t: 'おわりです。' }],
    },
    { kind: 'ending', closing: 'おわり', lines: [{ t: 'おわりです。' }] },
  ]);
  const c = courseOf([lec]);
  const video: Video = { key: 'X01', lang: 'ja', lecture: lec, course: c };
  // 台詞の探す鍵（同じ文と声の台詞は 1 つ。synth と同じ読み上げる文から）
  const lines = [
    ttsKeysIn(speechIn({ t: 'はじめます。' }, 'ja'), 'announcer', 'ja'),
    ttsKeysIn(speechIn({ t: '一つ目です。' }, 'ja'), 'narrator', 'ja'),
    ttsKeysIn(speechIn({ t: 'おわりです。' }, 'ja'), 'narrator', 'ja'),
  ];
  const remote = makeRemote();
  const cacheA = mkdtempSync(path.join(sandbox, 'cache-'));
  const a = withCache(cloneOf(remote, 'a'), cacheA);
  audio(a);
  // 前の名前（v1）の声。長さはフレームの境目をまたぐもの
  for (const [i, keys] of lines.entries()) realVoice(cacheA, keys[1], [1.234567, 2.000021, 0.987654][i], i + 1);
  await push(a, [{ id: c.id, langs: ['ja'], lines, about: '見本（1 レクチャー・ja）' }], real().opts);

  // 音声から作る（ふつうの --cached-only）
  const base = mkdtempSync(path.join(sandbox, 'synth-'));
  const ctx = (root: string) => ({
    store: { cache: cacheA, local: path.join(root, 'local') },
    out: outDirs(root),
    cacheOnly: true,
    engine: { url: '', version: async () => '', synthesize: async () => Promise.reject(new Error('合成しない')) },
    log: () => {},
  });
  await synthVideos(ctx(path.join(base, 'wav')), [video]);
  // 長さと読みだけで作る（別の作業フォルダ。キャッシュは空）
  const b = withCache(cloneOf(remote, 'b'), mkdtempSync(path.join(sandbox, 'cache-')));
  const found = await durationsFind(
    [video],
    { cache: b.cache!, local: path.join(b.root, '.work/tts') },
    b,
    real().opts,
  );
  expect(found.durationsOnly).toBe(true);
  await synthVideos({ ...ctx(path.join(base, 'dur')), find: found.find }, [video]);
  // 音声を取り出していない（キャッシュは空のまま）
  expect(readdirSync(b.cache!)).toEqual([]);
  const files = (root: string) =>
    [
      '.work/plan/X01.json',
      '.work/kana/X01.txt',
      'site/data/X01.json',
      `content/${c.id}/generated/timeline/X01.json`,
    ].map((f) => readFileSync(path.join(root, f), 'utf8'));
  expect(files(path.join(base, 'dur'))).toEqual(files(path.join(base, 'wav')));
  // 読みは素材のブランチのもの
  expect(readFileSync(path.join(base, 'dur/.work/kana/X01.txt'), 'utf8')).toContain(`カナ:${lines[0][1]}`);
}, 30_000);

test('DURATIONS.json がまだ無い・古いときは、今までどおり音声を取り出してから作る（もどったことを出す）', async () => {
  const remote = makeRemote();
  const a = cloneOf(remote, 'a');
  audio(a);
  realVoice(path.join(a.root, '.work/tts'), 'a1', 1);
  await push(a, [course('alpha', ['a1'])], real().opts);
  // 長さと読みの取り出しは、講座の読みと一覧だけを取り出す
  const index = pullDurations(a, ['alpha', 'nosuch'], () => {});
  expect([...(index?.durations.keys() ?? [])]).toEqual(['a1']);
  expect(index?.kana).toEqual(new Map([['a1', 'カナ:a1']]));
  // 一覧の長さが古い（測った WAV の sha256 が SHA256SUMS と違う）ように、素材のブランチの DURATIONS.json を書き換える
  const t = cloneOf(remote, 't');
  git(t.root, 'checkout', '--quiet', 'materials');
  writeFileSync(
    path.join(t.root, 'DURATIONS.json'),
    readFileSync(path.join(t.root, 'DURATIONS.json'), 'utf8').replace(
      /"sha256": "[0-9a-f]{64}"/,
      `"sha256": "${'0'.repeat(64)}"`,
    ),
  );
  git(t.root, 'commit', '--quiet', '-am', '長さを古くする');
  git(t.root, 'push', '--quiet', 'origin', 'materials');
  const v = (id: string): Video => {
    const lec = lecture([{ kind: 'ending', closing: 'おわり', lines: [{ t: 'おわりです。' }] }]);
    return { key: 'X01', lang: 'ja', lecture: lec, course: courseOf([lec], { id }) };
  };
  // 見本の動画の台詞の鍵は a1 ではないので、素材のブランチに声が無い → 長さだけで探す（足りない台詞は --cached-only と同じに止まる）
  const b = cloneOf(remote, 'b');
  const missing = await durationsFind(
    [v('alpha')],
    { cache: path.join(b.root, 'c'), local: path.join(b.root, 'l') },
    b,
    real().opts,
  );
  expect(missing.durationsOnly).toBe(true);
  // 古い長さの台詞があると、音声を取り出す
  const keys = ttsKeysIn('おわりです。', 'narrator', 'ja');
  const c2 = cloneOf(remote, 'c2');
  audio(c2);
  realVoice(path.join(c2.root, '.work/tts'), keys[1], 1);
  await push(c2, [course('alpha', [], [keys])], real().opts);
  git(t.root, 'pull', '--quiet', 'origin', 'materials');
  writeFileSync(
    path.join(t.root, 'DURATIONS.json'),
    readFileSync(path.join(t.root, 'DURATIONS.json'), 'utf8').replace(
      new RegExp(`("${keys[1]}": \\{[^}]*"sha256": ")[0-9a-f]{64}`),
      `$1${'0'.repeat(64)}`,
    ),
  );
  git(t.root, 'commit', '--quiet', '-am', 'その台詞の長さを古くする');
  git(t.root, 'push', '--quiet', 'origin', 'materials');
  const d = cloneOf(remote, 'd');
  const out = real();
  const store = { cache: path.join(d.root, 'cache'), local: path.join(d.root, '.work/tts') };
  const stale = await durationsFind([v('alpha')], store, { ...d, cache: store.cache }, out.opts);
  expect(stale.durationsOnly).toBe(false);
  expect(out.text()).toContain('長さが無いか古い台詞が 1 本ある');
  expect(readdirSync(store.cache).sort()).toContain(`${keys[1]}.wav`);
  // DURATIONS.json が無い素材のブランチ（前の形）
  git(t.root, 'pull', '--quiet', 'origin', 'materials');
  git(t.root, 'rm', '--quiet', 'DURATIONS.json');
  git(t.root, 'commit', '--quiet', '-m', '長さの一覧を消す');
  git(t.root, 'push', '--quiet', 'origin', 'materials');
  expect(pullDurations(d, ['alpha'], () => {})).toBeNull();
  const old = real();
  const none = await durationsFind([v('alpha')], store, { ...d, cache: store.cache }, old.opts);
  expect(none.durationsOnly).toBe(false);
  expect(old.text()).toContain('DURATIONS.json がまだ無い');
}, 60_000);
