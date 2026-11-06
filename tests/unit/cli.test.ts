// 1 つの入口（scripts/cli.ts。npm run chalk -- <コマンド>）。コマンドの選び方・対象の選び方・流すコマンド（--dry-run）を、何も流さずに確かめる
import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { VIDEOS } from '../../content';
import { COMMANDS, commandTable, findCommand, helpRows, pickVideos } from '../../scripts/cli';
import { readSiteConfig } from '../../scripts/lib/config';

const ROOT = path.resolve(import.meta.dir, '../..');
const chalk = (...args: string[]) => {
  const r = Bun.spawnSync([process.execPath, 'scripts/cli.ts', ...args], { cwd: ROOT, stdin: 'ignore' });
  return { code: r.exitCode, stdout: r.stdout.toString(), stderr: r.stderr.toString() };
};
const published = readSiteConfig().publishLangs as string[];

describe('コマンドの一覧', () => {
  test('計画のとおりのコマンドがあり、名前は重ならず、どのコマンドも中の道具がある（空の入口が無い）', () => {
    const names = COMMANDS.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of [
      'new video',
      'doctor',
      'validate',
      'status',
      'build',
      'voice synth',
      'voice speech-check',
      'i18n status',
      'i18n stamp',
      'i18n scaffold',
      'i18n restamp',
      'i18n try',
      'music build',
      'mix',
      'render',
      'stills',
      'export',
      'docs build',
      'materials pull',
      'materials check',
      'materials push',
      'materials gc',
      'media pull',
      'media check',
      'media push',
      'site build',
      'site serve',
      'site check',
      'publish verify',
      'check overlap',
      'legacy pages-migrate',
      'ci cloudflare-setup',
    ])
      expect(names).toContain(name);
    for (const c of COMMANDS) expect(existsSync(path.join(ROOT, c.file))).toBe(true);
  });
  test('2 語の名前を先に選び、残りを引数にする', () => {
    expect(findCommand(['voice', 'synth', 'L01'])).toMatchObject({ command: { name: 'voice synth' }, rest: ['L01'] });
    expect(findCommand(['mix', 'L01'])).toMatchObject({ command: { name: 'mix' }, rest: ['L01'] });
    expect(findCommand(['voice'])).toBeNull();
  });
  test('commands.md の表は、help と同じ一覧から作る（行の数と名前が同じ）', () => {
    const rows = commandTable()
      .split('\n')
      .filter((l) => l.startsWith('| `'));
    expect(rows).toHaveLength(helpRows().length);
    expect(readFileSync(path.join(ROOT, 'docs/guide/commands.md'), 'utf8')).toContain(commandTable());
  });
});

describe('対象の選び方（--course・--video・--lang）', () => {
  test('選ばなければ、公開する言語の全部の動画', () => {
    expect(pickVideos({}, [])).toEqual(VIDEOS.filter((v) => published.includes(v.lang)).map((v) => v.key));
  });
  test('--course は講座で、--lang は言語で絞る（all で全部の言語）', () => {
    const s = VIDEOS.filter((v) => v.course.id === 'superagent-comedy');
    expect(pickVideos({ course: ['superagent-comedy'] }, [])).toEqual(
      s.filter((v) => published.includes(v.lang)).map((v) => v.key),
    );
    expect(pickVideos({ course: ['superagent-comedy'], lang: ['en'] }, [])).toEqual(
      s.filter((v) => v.lang === 'en').map((v) => v.key),
    );
    expect(pickVideos({ course: ['superagent-comedy'], lang: ['all'] }, [])).toEqual(s.map((v) => v.key));
  });
  test("形（* と ?）で選ぶ。'S03.*' は日本語も含む全部の言語、'*.en' は英語の全部", () => {
    expect(pickVideos({ video: ['S03.*'] }, [])).toEqual(['S03', 'S03.en', 'S03.zh']);
    expect(pickVideos({}, ['*.en'])).toEqual(VIDEOS.filter((v) => v.lang === 'en').map((v) => v.key));
    expect(pickVideos({}, ['G0?'])).toEqual(['G01', 'G02', 'G03']);
  });
  test('無い講座・無い動画・知らない言語・何も残らない選び方は、使い方の誤り', () => {
    expect(() => pickVideos({ course: ['nope'] }, [])).toThrow('講座が無い: nope');
    expect(() => pickVideos({}, ['ZZ99'])).toThrow('動画が無い: ZZ99');
    expect(() => pickVideos({ lang: ['fr'] }, [])).toThrow('--lang は');
    expect(() => pickVideos({ course: ['ga4-comedy'], lang: ['en'] }, [])).toThrow('動画が無い');
  });
});

describe('省略できる点検対象', () => {
  for (const [name, file, target] of [
    ['site check', 'scripts/check_delivery.ts', 'site/確認用の出力'],
    ['publish verify', 'scripts/verify_public.ts', 'https://example.com'],
  ] as const) {
    test(`${name} は省略と 1 つの対象をそのまま道具に渡す`, () => {
      const command = COMMANDS.find((item) => item.name === name);
      expect(command?.steps({ values: {}, positionals: [] })[0]?.argv.slice(1)).toEqual([file]);
      expect(command?.steps({ values: {}, positionals: [target] })[0]?.argv.slice(1)).toEqual([file, target]);
      expect(() => command?.steps({ values: {}, positionals: [target, 'extra'] })).toThrow('1 つだけ');
    });
    test(`${name} は余分な対象を渡すと道具を起動する前に終了コード 2 で止める`, () => {
      const result = chalk(...name.split(' '), 'not-a-target', 'extra');
      expect(result.code).toBe(2);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain(`${name}:`);
      expect(result.stderr).toContain('1 つだけ');
    });
  }
});

describe('流すコマンド（--dry-run は出すだけ）', () => {
  test('new video は空白を含む題名を保ち、変更予定だけを出す', () => {
    const registry = path.join(ROOT, 'content/courses.ts');
    const before = readFileSync(registry, 'utf8');
    const result = chalk('new', 'video', 'sample-topic', '--title', 'サンプルアプリの 使い方', '--dry-run');
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('sample-topic');
    expect(readFileSync(registry, 'utf8')).toBe(before);
    expect(existsSync(path.join(ROOT, 'content/sample-topic'))).toBe(false);
    expect(
      COMMANDS.find((c) => c.name === 'new video')
        ?.steps({
          values: { title: 'サンプルアプリの 使い方', 'dry-run': true },
          positionals: ['sample-topic'],
        })[0]
        ?.argv.slice(-3),
    ).toEqual(['--title', 'サンプルアプリの 使い方', '--dry-run']);
  });
  test('new video は題名の省略・余分な引数・不正な ID を作成前に止める', () => {
    for (const args of [
      ['sample-topic'],
      ['sample-topic', 'extra', '--title', '見本'],
      ['../sample-topic', '--title', '見本'],
      ['ja', '--title', '見本'],
    ]) {
      expect(chalk('new', 'video', ...args, '--dry-run').code).toBe(2);
    }
  });
  test('i18n scaffold と restamp は共通の入口を使い、dry-run はファイルを書かない', () => {
    const scaffold = chalk('i18n', 'scaffold', 'P01.en', '--stdout', '--dry-run');
    expect(scaffold.code).toBe(0);
    expect(scaffold.stdout).toContain('bun scripts/i18n.ts scaffold P01.en --stdout');
    const restamp = chalk('i18n', 'restamp', '--dry-run');
    expect(restamp.code).toBe(0);
    expect(restamp.stdout).toContain('bun scripts/i18n.ts restamp');
    expect(chalk('i18n', 'scaffold', '../P01.en', '--dry-run').code).toBe(2);
    expect(chalk('i18n', 'restamp', 'extra', '--dry-run').code).toBe(2);
    expect(chalk('i18n', 'stamp', '../P01.en', '--dry-run').code).toBe(2);
  });
  test('i18n scaffold の stdout はひな形だけを返し、既存の訳も上書きしない', () => {
    const file = path.join(ROOT, 'content/pstack-comedy/en/P01.ts');
    const before = readFileSync(file, 'utf8');
    const result = chalk('i18n', 'scaffold', 'P01.en', '--stdout');
    expect(result.code).toBe(0);
    expect(result.stdout).toStartWith('import type { LectureL10n }');
    expect(result.stdout).toContain('export const P01: LectureL10n = {');
    expect(readFileSync(file, 'utf8')).toBe(before);
  });
  test('voice synth は、選んだ動画を synth.ts に渡す', () => {
    const r = chalk('voice', 'synth', '--course', 'ga4-comedy', '--cached-only', '--dry-run');
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('bun scripts/synth.ts --cached-only G01 G02 G03');
  });
  test('render は、選んだ動画を書き出しの道具に 1 回で渡す（バンドルは 1 回）。字幕版は掛け合いの講座（cast あり）だけ。--captions で全部、--jobs は並列の数', () => {
    const steps = (values: Record<string, unknown>) =>
      COMMANDS.find((c) => c.name === 'render')
        ?.steps({ values: values as never, positionals: [] })
        .map((s) => s.show);
    expect(steps({ course: ['nudge-product', 'ga4-comedy'], jobs: '2', chunk: '1200' })).toEqual([
      `bun scripts/stages/video/render.ts --jobs 2 --chunk 1200 ${VIDEOS.filter(
        (v) => ['nudge-product', 'ga4-comedy'].includes(v.course.id) && published.includes(v.lang),
      )
        .map((v) => v.key)
        .join(' ')}`,
    ]);
    // --dry-run は書き出しの道具に渡し、道具が、字幕版を作るか・出力・足りない入力を出す（何も書き出さない）
    const nudge = chalk('render', '--course', 'nudge-product', '--course', 'ga4-comedy', '--dry-run');
    expect(nudge.code).toBe(0);
    expect(nudge.stdout).toMatch(/^ {2}N01 {2}通常版 {2}/m);
    expect(nudge.stdout).toMatch(/^ {2}G01 {2}通常版と字幕版 {2}.*site\/media\/G01\.cc\.mp4/m);
    const all = chalk('render', '--course', 'nudge-product', '--captions', '--jobs', '1', '--dry-run');
    expect(all.stdout).toMatch(/^ {2}N01 {2}通常版と字幕版 {2}/m);
    expect(all.stdout).toContain('並列の数 1');
    expect(chalk('render', '--jobs', 'x', '--dry-run').code).toBe(2);
    expect(chalk('render', '--chunk', '-1', '--dry-run').code).toBe(2);
  });
  test('-v は流すコマンドも出し、voice synth・materials・media の道具には --verbose も渡す', () => {
    const r = chalk('voice', 'synth', 'G01', '--cached-only', '-v', '--dry-run');
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('bun scripts/synth.ts --cached-only --verbose G01');
    const shows = (name: string, values: Record<string, unknown>) =>
      COMMANDS.find((c) => c.name === name)
        ?.steps({ values: values as never, positionals: [] })
        .map((s) => s.show);
    expect(shows('materials pull', { verbose: true })).toEqual(['bun scripts/materials.ts pull --verbose']);
    expect(shows('materials push', { verbose: true, 'dry-run': true })).toEqual([
      'bun scripts/materials.ts push --dry-run --verbose',
    ]);
    expect(shows('media check', { verbose: true })).toEqual(['bun scripts/media.ts check --verbose']);
    expect(shows('media check', {})).toEqual(['bun scripts/media.ts check']);
  });
  test('stills は、場面とフレームを付けた名前の動画と、--theme のテーマが台本にあるかを確かめてから渡す', () => {
    expect(chalk('stills', 'ZZ99:3', '--dry-run').code).toBe(2);
    expect(chalk('stills', 'G01:2', '--theme', 'nope', '--dry-run').code).toBe(2);
    expect(chalk('stills', 'G01:2', 'G01@90', '--theme', 'paper', '--dry-run').stdout).toContain(
      'node scripts/stills.ts G01:2 G01@90 --theme paper',
    );
  });
  test('mix は、選んだ動画を mix.py に渡す（npm run mix も同じ入口。選ばなければ公開する言語の全部）', () => {
    expect(chalk('mix', '--course', 'ga4-comedy', '--dry-run').stdout).toContain(
      'uv run --locked --group audio python scripts/mix.py G01 G02 G03',
    );
    // ミックスの前後に、段の記録を書く（記録できなくても 0 で終わる道具）
    expect(
      COMMANDS.find((c) => c.name === 'mix')
        ?.steps({ values: { course: ['ga4-comedy'] }, positionals: [] })
        .map((s) => s.show),
    ).toEqual([
      'bun scripts/pipeline.ts record mix --begin G01 G02 G03',
      'uv run --locked --group audio python scripts/mix.py G01 G02 G03',
      'bun scripts/pipeline.ts record mix G01 G02 G03',
    ]);
    const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.mix).toBe('bun scripts/cli.ts mix');
  });
  test('status と build は、対象の選び方をそのまま scripts/pipeline.ts に渡す（build の --dry-run も道具に渡す）', () => {
    const status = COMMANDS.find((c) => c.name === 'status');
    expect(
      status?.steps({ values: { course: ['ga4-comedy'], json: true }, positionals: [] }).map((s) => s.show),
    ).toEqual(['bun scripts/pipeline.ts status --course ga4-comedy --json']);
    const b = COMMANDS.find((c) => c.name === 'build');
    expect(b?.dry).toBe('pass');
    expect(
      b
        ?.steps({ values: { to: 'site', video: ['G0?'], 'cached-only': true, 'dry-run': true }, positionals: [] })
        .map((s) => s.show),
    ).toEqual(['bun scripts/pipeline.ts build --to site --video G0? --cached-only --dry-run']);
    // 使い方の誤りは、道具が 2 で止める（段が無い・--to が無い）
    expect(chalk('build', '--to', 'nope', '--dry-run').code).toBe(2);
    expect(chalk('build', '--dry-run').code).toBe(2);
    const dry = chalk('build', '--to', 'docs', '--course', 'ga4-comedy', '--dry-run');
    expect(dry.code).toBe(0);
    expect(dry.stdout).toContain('流すもの（--dry-run なので、何もしない）');
    expect(dry.stdout).toContain('voice:');
    expect(dry.stdout).toContain('docs:');
  });
  test('道具に --dry-run があるもの（materials push）は、道具に渡す', () => {
    const push = COMMANDS.find((c) => c.name === 'materials push');
    expect(push?.dry).toBe('pass');
    expect(push?.steps({ values: { 'dry-run': true }, positionals: [] }).map((s) => s.show)).toEqual([
      'bun scripts/materials.ts push --dry-run',
    ]);
  });
  test('validate は、台本の検証と点検を続けて流す。--json は台本の検証だけ', () => {
    const v = COMMANDS.find((c) => c.name === 'validate');
    expect(v?.steps({ values: {}, positionals: [] }).map((s) => s.show)).toEqual([
      'bun scripts/validate.ts',
      'bun scripts/check_content.ts',
    ]);
    expect(v?.steps({ values: { json: true }, positionals: [] }).map((s) => s.show)).toEqual([
      'bun scripts/validate.ts --json',
    ]);
  });
  test('意味の無い共通の引数（読むだけのコマンドの --dry-run など）と、知らないコマンドは、使い方の誤り（2）', () => {
    expect(chalk('doctor', '--dry-run').code).toBe(2);
    expect(chalk('media', 'check', '--course', 'x').code).toBe(2);
    expect(chalk('nope').code).toBe(2);
    expect(chalk().code).toBe(2);
  });
  test('help と <コマンド> --help は、何も流さずに出す（中の道具の頭書きも）', () => {
    const all = chalk('help');
    expect(all.code).toBe(0);
    for (const c of COMMANDS) expect(all.stdout).toContain(c.name);
    const one = chalk('site', 'build', '--help');
    expect(one.code).toBe(0);
    expect(one.stdout).toContain('npm run chalk -- site build');
    expect(one.stdout).toContain('scripts/build_site.ts');
    expect(chalk('help', 'mix').stdout).toContain('scripts/mix.py');
  });
});

describe('doctor（手元の前提を確かめる。何も書かない）', () => {
  test('--json で、項目ごとの OK・注意・足りないを出す。gh は認証の有無だけを出し、token を出さない', () => {
    const r = Bun.spawnSync([process.execPath, 'scripts/doctor.ts', '--json'], { cwd: ROOT, stdin: 'ignore' });
    const out = JSON.parse(r.stdout.toString()) as {
      ok: boolean;
      items: { name: string; state: string; detail: string }[];
    };
    expect(r.exitCode).toBe(out.ok ? 0 : 3);
    const names = out.items.map((x) => x.name);
    for (const name of [
      'git',
      'bun',
      'node',
      'node_modules',
      'ffmpeg',
      'gh の認証',
      'VOICEVOX',
      '声のキャッシュ',
      'ポート 8765',
    ])
      expect(names).toContain(name);
    for (const x of out.items) expect(['ok', 'warn', 'missing']).toContain(x.state);
    expect(r.stdout.toString()).not.toMatch(/gh[pousr]_[A-Za-z0-9]{8,}|github_pat_/);
  }, 60_000);
});
