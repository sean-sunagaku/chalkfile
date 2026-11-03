// 素材のブランチの出し入れ（scripts/materials.ts）を、一時の bare リポジトリと clone で確かめる。本物の origin には触れない
import { afterAll, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { AUDIO, check, gc, keepAt, pull, push, type Convert, type CourseKeys, type Repo } from '../scripts/materials';

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
/** 変換を差し替え、出力を集める（テストの出力を汚さない） */
const logs = () => {
  const lines: string[] = [];
  return { text: () => lines.join('\n'), opts: { convert: copy, log: (line: string) => void lines.push(line) } };
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
const course = (id: string, keys: string[]): CourseKeys => ({
  id,
  langs: ['ja'],
  keys,
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
      keys: ['ja-narrator-こんにちは', 'ja-zundamon-またね'],
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
  write('scripts/voices.ts', 'export const ttsKeyIn = (text: string, voice: string, lang: string) => `${lang}-${voice}-${text}`;\n');
  git(a.root, 'add', '-A');
  git(a.root, 'commit', '--quiet', '-m', '台本');
  git(a.root, 'push', '--quiet', 'origin', 'HEAD:main');
  const keep = await keepAt(a, ['origin/main']);
  expect(keep.courses.map((c) => c.keys)).toEqual([['ja-narrator-こんにちわ']]);
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
