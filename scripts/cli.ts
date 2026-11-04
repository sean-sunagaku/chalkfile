#!/usr/bin/env bun
// Chalkfile の道具の入口を 1 つにする。コマンドを選ぶと、中の道具（scripts/ の TS・Python・シェル）を子のプロセスで流す。
//   npm run chalk -- help                               # コマンドの一覧（docs/guide/commands.md の表も、ここから npm run gen で作る）
//   npm run chalk -- <コマンド> --help                  # そのコマンドの使い方と、中で流す道具の頭書き（何も流さない）
//   npm run chalk -- voice synth --course ga4-comedy    # 例: その講座の、公開する言語の動画の声と時刻
//   npm run chalk -- render --course ga4-comedy --dry-run   # 流すコマンドを出すだけ（何もしない）
//   bun scripts/cli.ts <コマンド> …                    # npm run chalk と同じ（package.json の bin の chalkfile も、このファイル）
// 入力: コマンドと引数。対象は --course <講座 ID>・--video <動画。* と ? を使える>・--lang <言語。all で全部>で選び、
//   選ばなければ公開する言語（chalkfile.config.ts の publishLangs）の全部の動画。--dry-run（流すコマンドを出すだけ）・--json は、
//   意味のあるコマンドだけが受け取る（どれを受け取るかは、そのコマンドの --help）。-v は流すコマンドも出し、voice synth・materials・media では、
//   中の道具にも --verbose を渡す（外の道具への問い合わせと、失敗したときの stderr の全部も出す）
// 出力: 中の道具の出力と終了コード（0 成功・1 失敗・2 使い方の誤り・3 前提が足りない）。古い呼び方（bun scripts/synth.ts など）も、そのまま使える
// 前提: 中で流す道具と同じ（npm run chalk -- doctor で確かめる）
import path from 'node:path';
import type { ParseArgsConfig } from 'node:util';
import { VIDEOS, type Video } from '../content';
import { isLang, LANGS } from '../content/i18n';
import { THEMES } from '../content/themes';
import { EXIT, headerOf, readArgs, runMain, UsageError } from './lib/args';
import { readSiteConfig } from './lib/config';
import { ROOT } from './lib/paths';
import { runInherit } from './lib/proc';

type Options = NonNullable<ParseArgsConfig['options']>;
type Values = Record<string, string | boolean | string[] | undefined>;
/** 子のプロセスで流す 1 つ（show は --dry-run と -v で出す形） */
type Step = { argv: string[]; show: string; env?: Record<string, string> };
type Ctx = { values: Values; positionals: string[] };
/** 1 つのコマンド */
export type Command = {
  /** 名前（voice synth など） */
  name: string;
  /** 引数の形（一覧と --help に出す） */
  usage: string;
  /** すること（1 行） */
  summary: string;
  /** 前の呼び方（これからも、そのまま使える。新しいコマンドは空） */
  old: string[];
  /** 中で流す道具（--help に、その頭書きを出す） */
  file: string;
  /** 受け取る引数（共通の約束のうち、意味のあるものだけ） */
  options: Options;
  /** 名前の無い引数（動画の名前など）を受け取る */
  positionals?: boolean;
  /** --dry-run を受け取り、流すコマンドを出すだけにする（道具に --dry-run があるものは、道具に渡す） */
  dry?: 'plan' | 'pass';
  steps: (ctx: Ctx) => Step[];
};

/* ───────────── 流し方 ───────────── */

const bun = (file: string, ...args: string[]): Step => ({
  argv: [process.execPath, file, ...args],
  show: ['bun', file, ...args].join(' '),
});
const uvScript = (file: string, ...args: string[]): Step => {
  const argv = ['uv', 'run', '--locked', '--script', file, ...args];
  return { argv, show: argv.join(' ') };
};
const uvAudio = (file: string, ...args: string[]): Step => {
  const argv = ['uv', 'run', '--locked', '--group', 'audio', 'python', file, ...args];
  return { argv, show: argv.join(' ') };
};
const sh = (file: string, args: string[], env: Record<string, string> = {}): Step => ({
  argv: ['bash', file, ...args],
  show: [...Object.entries(env).map(([k, v]) => `${k}=${v}`), 'bash', file, ...args].join(' '),
  env,
});
const node = (file: string, ...args: string[]): Step => {
  const argv = ['node', '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', file, ...args];
  return { argv, show: ['node', file, ...args].join(' ') };
};
/** 段の記録（scripts/pipeline.ts record）。記録できなくても 0 で終わるので、道具を止めない */
const record = (stage: string, args: string[]): Step => bun('scripts/pipeline.ts', 'record', stage, ...args);
/** 真偽の引数を、道具の引数に写す */
const flag = (values: Values, name: string, as = `--${name}`) => (values[name] ? [as] : []);
/** 値の引数を、道具の引数に写す（くり返しも） */
const opt = (values: Values, name: string, as = `--${name}`) => {
  const v = values[name];
  return v === undefined || typeof v === 'boolean' ? [] : (Array.isArray(v) ? v : [v]).flatMap((x) => [as, x]);
};
const strings = (v: Values[string]): string[] =>
  v === undefined || typeof v === 'boolean' ? [] : Array.isArray(v) ? v : [v];
/** 対象の選び方（--course・--video・--lang と名前の無い引数）を、そのまま道具に渡す（道具が pickVideos で選ぶ） */
const targetArgs = (values: Values, positionals: string[]) => [
  ...opt(values, 'course'),
  ...opt(values, 'video'),
  ...opt(values, 'lang'),
  ...positionals,
];

/* ───────────── 対象（--course・--video・--lang） ───────────── */

const TARGET = {
  course: { type: 'string', multiple: true },
  video: { type: 'string', multiple: true },
  lang: { type: 'string', multiple: true },
} as const;
const DRY = { 'dry-run': { type: 'boolean' } } as const;

/** * と ? の形（動画の名前に合わせる） */
const globRx = (g: string) =>
  new RegExp(
    `^${g
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')}$`,
  );
/** 動画が形に合うか。日本語の動画は L01 と L01.ja のどちらでも指せる（L01.* は全部の言語） */
const matches = (g: string, v: Video) => {
  const rx = globRx(g);
  return rx.test(v.key) || rx.test(`${v.lecture.id}.${v.lang}`);
};

/**
 * 選んだ動画の名前。--video と名前の無い引数は形で選び、--course は講座で、--lang は言語で絞る。
 * 言語を選ばず、形も渡さなければ、公開する言語（publishLangs）だけ
 */
export const pickVideos = (values: Values, positionals: string[], { translatedOnly = false } = {}): string[] => {
  const courses = strings(values.course);
  const globs = [...strings(values.video), ...positionals];
  const langs = strings(values.lang).flatMap((l) => (l === 'all' ? LANGS : [l]));
  for (const id of courses) if (!VIDEOS.some((v) => v.course.id === id)) throw new UsageError(`講座が無い: ${id}`);
  for (const l of langs) if (!isLang(l)) throw new UsageError(`--lang は ${LANGS.join('・')}・all のどれか: ${l}`);
  for (const g of globs)
    if (!VIDEOS.some((v) => matches(g, v)))
      throw new UsageError(`動画が無い: ${g}（例: L01・S03.en・'S03.*'・'*.zh'）`);
  const published: string[] = readSiteConfig().publishLangs;
  const picked = VIDEOS.filter(
    (v) =>
      (!courses.length || courses.includes(v.course.id)) &&
      (langs.length ? langs.includes(v.lang) : globs.length || published.includes(v.lang)) &&
      (!globs.length || globs.some((g) => matches(g, v))) &&
      (!translatedOnly || v.lang !== 'ja'),
  );
  if (!picked.length) throw new UsageError('選んだ対象に、動画が無い（--course・--video・--lang を見直す）');
  return picked.map((v) => v.key);
};
/** --course（くり返し）の講座 ID。無ければ空（道具の既定。全部の講座） */
const pickCourses = (values: Values): string[] => {
  const ids = strings(values.course);
  for (const id of ids) if (!VIDEOS.some((v) => v.course.id === id)) throw new UsageError(`講座が無い: ${id}`);
  return ids;
};
/** --course をちょうど 1 つ */
const oneCourse = (values: Values): string => {
  const ids = pickCourses(values);
  if (ids.length !== 1) throw new UsageError('--course <講座 ID> を 1 つ渡す');
  return ids[0];
};

/**
 * 書き出し。全部の動画を 1 回で書き出しの道具に渡す（バンドルを 1 回で済ませる）。字幕版を作るかは、道具が講座で決める
 * （cast のある講座は作る。--captions か CAPTIONS=1 なら全部、CAPTIONS=0 なら作らない）。CHUNK・CONCURRENCY も、そのまま道具が読む
 */
const renderSteps = ({ values, positionals }: Ctx): Step[] => {
  for (const name of ['jobs', 'chunk'] as const)
    if (values[name] !== undefined && !/^\d+$/.test(String(values[name])))
      throw new UsageError(`--${name} は整数: ${values[name]}`);
  if (values.jobs !== undefined && Number(values.jobs) < 1) throw new UsageError(`--jobs は 1 以上の整数: ${values.jobs}`);
  return [
    bun(
      'scripts/stages/video/render.ts',
      ...flag(values, 'captions'),
      ...opt(values, 'jobs'),
      ...opt(values, 'chunk'),
      ...flag(values, 'dry-run'),
      ...pickVideos(values, positionals),
    ),
  ];
};

/* ───────────── コマンドの一覧 ───────────── */

export const COMMANDS: Command[] = [
  {
    name: 'content migrate',
    usage: '[--write]',
    summary: '教材を分け、出典と共通の書き方をまとめる（既定は差分の一覧だけ）',
    old: ['npm run codemod:content'],
    file: 'scripts/codemod_content.ts',
    options: { write: { type: 'boolean' } },
    steps: ({ values }) => [bun('scripts/codemod_content.ts', ...flag(values, 'write'))],
  },
  {
    name: 'doctor',
    usage: '[--json]',
    summary: '道具の版・VOICEVOX・gh の認証の有無・空き容量・ポート・声のキャッシュを確かめる',
    old: [],
    file: 'scripts/doctor.ts',
    options: { json: { type: 'boolean' } },
    steps: ({ values }) => [bun('scripts/doctor.ts', ...flag(values, 'json'))],
  },
  {
    name: 'validate',
    usage: '[--warnings] [--json]',
    summary: '台本の検証と、台本・Git に入れるファイルの点検（訳し残しも）。--json は台本の検証だけを JSON で',
    old: ['bun scripts/validate.ts', 'bun scripts/check_content.ts'],
    file: 'scripts/validate.ts',
    options: { warnings: { type: 'boolean' }, json: { type: 'boolean' } },
    steps: ({ values }) =>
      values.json
        ? [bun('scripts/validate.ts', '--json')]
        : [bun('scripts/validate.ts', ...flag(values, 'warnings')), bun('scripts/check_content.ts')],
  },
  {
    name: 'status',
    usage: '[動画…] [--course <ID>] [--video <形>] [--lang <言語>] [--json]',
    summary:
      '段（voice・mix・render・docs・site）ごとに、記録（.work/state/）と今の入力の指紋を比べ、古くなった単位と次に流す段を出す（何も作らない）。公開した動画が今の台本と合うかも出す',
    old: [],
    file: 'scripts/pipeline.ts',
    options: { ...TARGET, json: { type: 'boolean' } },
    positionals: true,
    steps: ({ values, positionals }) => [
      bun(
        'scripts/pipeline.ts',
        'status',
        ...targetArgs(values, positionals),
        ...flag(values, 'json'),
        ...flag(values, 'verbose'),
      ),
    ],
  },
  {
    name: 'build',
    usage:
      '--to <voice|mix|render|docs|site> [動画…] [--course <ID>] [--video <形>] [--lang <言語>] [--force] [--src] [--cached-only] [--jobs <数>]',
    summary:
      'その段まで、前の段から順に、古くなった単位だけを流して記録する（何も変えていなければ、何も流さない）。--force は全部、--src は描き方のコードだけが変わった動画も書き出す。--dry-run は流すものを出すだけ',
    old: [],
    file: 'scripts/pipeline.ts',
    options: {
      ...TARGET,
      to: { type: 'string' },
      force: { type: 'boolean' },
      src: { type: 'boolean' },
      'cached-only': { type: 'boolean' },
      jobs: { type: 'string' },
      ...DRY,
    },
    positionals: true,
    dry: 'pass',
    steps: ({ values, positionals }) => [
      bun(
        'scripts/pipeline.ts',
        'build',
        ...opt(values, 'to'),
        ...targetArgs(values, positionals),
        ...flag(values, 'force'),
        ...flag(values, 'src'),
        ...flag(values, 'cached-only'),
        ...opt(values, 'jobs'),
        ...flag(values, 'dry-run'),
        ...flag(values, 'verbose'),
      ),
    ],
  },
  {
    name: 'voice synth',
    usage: '[動画…] [--course <ID>] [--video <形>] [--lang <言語>] [--cached-only [--durations-only]] [--prune]',
    summary:
      '台詞の声と時刻（timeline・ミックスの設計図・サイトの台本）。--cached-only は素材の声だけを使う。--durations-only は素材の長さと読みだけで作る（音声を取り出さない。CI 用）',
    old: ['bun scripts/synth.ts', 'npm run synth'],
    file: 'scripts/synth.ts',
    options: {
      ...TARGET,
      'cached-only': { type: 'boolean' },
      'durations-only': { type: 'boolean' },
      prune: { type: 'boolean' },
      ...DRY,
    },
    positionals: true,
    dry: 'plan',
    steps: ({ values, positionals }) => [
      bun(
        'scripts/synth.ts',
        ...flag(values, 'cached-only'),
        ...flag(values, 'durations-only'),
        ...flag(values, 'prune'),
        ...flag(values, 'verbose'),
        ...pickVideos(values, positionals),
      ),
    ],
  },
  {
    name: 'voice speech-check',
    usage: '[動画…] [--course <ID>] [--video <形>] [--lang <言語>]',
    summary: '訳の声を Whisper で聞き取り直し、読み上げの間違いを探す（選ばなければ、合成した訳の全部）',
    old: ['uv run --locked --script scripts/check_speech.py'],
    file: 'scripts/check_speech.py',
    options: { ...TARGET, ...DRY },
    positionals: true,
    dry: 'plan',
    steps: ({ values, positionals }) => {
      const chosen =
        positionals.length ||
        strings(values.course).length ||
        strings(values.video).length ||
        strings(values.lang).length;
      return [
        uvScript(
          'scripts/check_speech.py',
          ...(chosen ? pickVideos(values, positionals, { translatedOnly: true }) : ['--all']),
        ),
      ];
    },
  },
  {
    name: 'i18n status',
    usage: '',
    summary: '訳の表（訳あり・日本語の台本が訳のあとで変わった・未訳）と訳し残し',
    old: ['bun scripts/i18n.ts status'],
    file: 'scripts/i18n.ts',
    options: {},
    steps: () => [bun('scripts/i18n.ts', 'status')],
  },
  {
    name: 'i18n stamp',
    usage: "<動画…>（例: P01.en・'*.zh'）",
    summary: '訳を台本に合わせ直したあと、今の日本語の台本の指紋を訳のファイルに書く',
    old: ['bun scripts/i18n.ts stamp'],
    file: 'scripts/i18n.ts',
    options: { ...DRY },
    positionals: true,
    dry: 'plan',
    steps: ({ positionals }) => {
      if (!positionals.length || positionals.some((arg) => !/^(?:[A-Z]\d{2}\.(?:en|zh|\*)|\*\.(?:en|zh))$/.test(arg))) throw new UsageError("指紋を書く訳の動画を渡す（例: P01.en・'*.zh'）");
      return [bun('scripts/i18n.ts', 'stamp', ...positionals)];
    },
  },
  {
    name: 'i18n scaffold',
    usage: '<動画> [--stdout]（例: S07.en）',
    summary: '日本語の注釈を入れた訳のひな形を作る（--stdout は表示だけ）',
    old: ['bun scripts/i18n.ts scaffold'],
    file: 'scripts/i18n.ts',
    options: { ...DRY, stdout: { type: 'boolean' } },
    positionals: true,
    dry: 'plan',
    steps: ({ values, positionals }) => {
      if (positionals.length !== 1 || !/^[A-Z]\d{2}\.(en|zh)$/.test(positionals[0] ?? '')) throw new UsageError('ひな形の動画を 1 つ渡す（例: S07.en）');
      return [bun('scripts/i18n.ts', 'scaffold', ...positionals, ...(values.stdout ? ['--stdout'] : []))];
    },
  },
  {
    name: 'i18n restamp',
    usage: '',
    summary: '日本語が変わっていない訳の、前の作り方の指紋だけを付け直す',
    old: ['bun scripts/i18n.ts restamp'],
    file: 'scripts/i18n.ts',
    options: { ...DRY },
    dry: 'plan',
    steps: () => [bun('scripts/i18n.ts', 'restamp')],
  },
  {
    name: 'i18n try',
    usage: '<講座 ID> <言語> <レクチャー ID>',
    summary: '講座に並べる前の訳のファイルを 1 本だけ確かめる（重ね方・訳し残し・点検・長さ）',
    old: ['bun scripts/i18n.ts try'],
    file: 'scripts/i18n.ts',
    options: {},
    positionals: true,
    steps: ({ positionals }) => {
      if (positionals.length !== 3)
        throw new UsageError('<講座 ID> <言語> <レクチャー ID> を渡す（例: superagent-comedy en S03）');
      return [bun('scripts/i18n.ts', 'try', ...positionals)];
    },
  },
  {
    name: 'music build',
    usage: '[--only <名前>…] [--skip-verify] [--check]',
    summary: 'BGM・ジングル・効果音（public/audio/）。--check は素材と同じ音ができるかだけを見る',
    old: ['npm run build:music', 'npm run music:verify'],
    file: 'scripts/build_music.py',
    options: {
      only: { type: 'string', multiple: true },
      'skip-verify': { type: 'boolean' },
      check: { type: 'boolean' },
      ...DRY,
    },
    dry: 'plan',
    steps: ({ values }) => {
      const only = strings(values.only);
      return [
        uvAudio(
          'scripts/build_music.py',
          ...(only.length ? ['--only', ...only] : []),
          ...flag(values, 'skip-verify'),
          ...flag(values, 'check'),
        ),
      ];
    },
  },
  {
    name: 'mix',
    usage: '[動画…] [--course <ID>] [--video <形>] [--lang <言語>]',
    summary: '音のミックス（public/audio/mix/）。先に voice synth。ミックスの前後に、段の記録（.work/state/mix/）も書く',
    old: ['npm run mix'],
    file: 'scripts/mix.py',
    options: { ...TARGET, ...DRY },
    positionals: true,
    dry: 'plan',
    steps: ({ values, positionals }) => {
      const keys = pickVideos(values, positionals);
      return [record('mix', ['--begin', ...keys]), uvAudio('scripts/mix.py', ...keys), record('mix', keys)];
    },
  },
  {
    name: 'render',
    usage: '[動画…] [--course <ID>] [--video <形>] [--lang <言語>] [--captions] [--jobs <数>] [--chunk <枚数>]',
    summary:
      '動画とポスター（バンドルは 1 回だけ作る）。掛け合いの講座（cast のある講座）は、字幕を焼き込んだ版も作る（--captions で全部の動画）。書き出しの前後に、段の記録（.work/state/render/）も書く。--dry-run は書き出すものを出すだけ',
    old: ['npm run render', 'bun scripts/stages/video/render.ts'],
    file: 'scripts/stages/video/render.ts',
    options: {
      ...TARGET,
      captions: { type: 'boolean' },
      jobs: { type: 'string' },
      chunk: { type: 'string' },
      ...DRY,
    },
    positionals: true,
    dry: 'pass',
    steps: renderSteps,
  },
  {
    name: 'stills',
    usage:
      '[動画[:場面,…]・動画@フレーム…] [--course <ID>] [--video <形>] [--lang <言語>] [--mid] [--theme <ID>] [--captions] [--scale <倍>]',
    summary: '確かめるための静止画（out/stills/）',
    old: ['npm run stills'],
    file: 'scripts/stills.ts',
    options: {
      ...TARGET,
      mid: { type: 'boolean' },
      theme: { type: 'string' },
      captions: { type: 'boolean' },
      scale: { type: 'string' },
      ...DRY,
    },
    positionals: true,
    dry: 'plan',
    steps: ({ values, positionals }) => {
      // 場面（:3,6）とフレーム（@120）を付けた名前は、そのまま渡す（動画が台本にあるかは、ここで確かめる。場面とフレームの範囲は
      // stills.ts が timeline で確かめる）。ほかは --course・--video・--lang と一緒に選ぶ
      const exact = positionals.filter((p) => /[:@]/.test(p));
      for (const p of exact) {
        const id = p.split(/[:@]/)[0];
        if (!VIDEOS.some((v) => v.key === id)) throw new UsageError(`動画が無い: ${id}（例: L01:3・S03.en@120）`);
      }
      const theme = strings(values.theme)[0];
      if (theme && !Object.hasOwn(THEMES, theme))
        throw new UsageError(`テーマが無い: ${theme}（${Object.keys(THEMES).join('・')}）`);
      const rest = positionals.filter((p) => !/[:@]/.test(p));
      const picked =
        rest.length || !exact.length || strings(values.course).length || strings(values.video).length
          ? pickVideos(values, rest)
          : [];
      return [
        node(
          'scripts/stills.ts',
          ...exact,
          ...picked,
          ...flag(values, 'mid'),
          ...opt(values, 'theme'),
          ...flag(values, 'captions'),
          ...opt(values, 'scale'),
        ),
      ];
    },
  },
  {
    name: 'export',
    usage: '[動画…] [--course <ID>] [--video <形>] [--lang <言語>]',
    summary:
      '章ごとの完成動画・字幕・音・教材と声のクレジットを out/deliverables/ にまとめる（要るファイルが欠けていたら、何も書かずに止める）',
    old: ['bun scripts/export_deliverables.ts'],
    file: 'scripts/export_deliverables.ts',
    options: { ...TARGET, ...DRY },
    positionals: true,
    dry: 'plan',
    steps: ({ values, positionals }) => [bun('scripts/export_deliverables.ts', ...pickVideos(values, positionals))],
  },
  {
    name: 'docs build',
    usage: '[--course <ID>] [--check]',
    summary: '読む教材（docs/courses/）を台本と timeline から作る。--check は書かずに、ずれだけを見る',
    old: ['npm run build:materials', 'npm run check:materials'],
    file: 'scripts/build_materials.ts',
    options: { course: TARGET.course, check: { type: 'boolean' }, ...DRY },
    dry: 'plan',
    steps: ({ values }) => [bun('scripts/build_materials.ts', ...flag(values, 'check'), ...pickCourses(values))],
  },
  {
    name: 'materials pull',
    usage: '[--course <ID>] [--videos]',
    summary: '素材（台詞の声は共有のキャッシュへ。BGM・効果音）を取り出す。--videos は Releases の動画も',
    old: ['npm run materials:pull'],
    file: 'scripts/materials.ts',
    options: { course: TARGET.course, videos: { type: 'boolean' }, ...DRY },
    dry: 'plan',
    steps: ({ values }) => [
      bun('scripts/materials.ts', 'pull', ...pickCourses(values), ...flag(values, 'videos'), ...flag(values, 'verbose')),
    ],
  },
  {
    name: 'materials check',
    usage: '[--course <ID>]',
    summary: '台本の全部の台詞の声と、BGM・効果音が手元にあるか',
    old: ['npm run materials:check'],
    file: 'scripts/materials.ts',
    options: { course: TARGET.course },
    steps: ({ values }) => [bun('scripts/materials.ts', 'check', ...pickCourses(values), ...flag(values, 'verbose'))],
  },
  {
    name: 'materials push',
    usage: '[--dry-run] [--message <文>]',
    summary: '手元の素材を素材のブランチに足す（消さない）。--dry-run は本数だけを出す',
    old: ['npm run materials:push'],
    file: 'scripts/materials.ts',
    options: { message: { type: 'string' }, ...DRY },
    dry: 'pass',
    steps: ({ values }) => [
      bun('scripts/materials.ts', 'push', ...flag(values, 'dry-run'), ...opt(values, 'message'), ...flag(values, 'verbose')),
    ],
  },
  {
    name: 'materials gc',
    usage: '[--keep <ref>…] [--confirm]',
    summary: '台本が使わない台詞の声を一覧にする（--confirm のときだけ消す。持ち主だけ）',
    old: ['bun scripts/materials.ts gc'],
    file: 'scripts/materials.ts',
    options: {
      keep: { type: 'string', multiple: true },
      confirm: { type: 'boolean' },
      message: { type: 'string' },
      ...DRY,
    },
    dry: 'pass',
    steps: ({ values }) => [
      bun(
        'scripts/materials.ts',
        'gc',
        ...opt(values, 'keep'),
        ...flag(values, 'confirm'),
        ...flag(values, 'dry-run'),
        ...opt(values, 'message'),
        ...flag(values, 'verbose'),
      ),
    ],
  },
  {
    name: 'media pull',
    usage: '[--course <ID>]',
    summary: 'Releases の日本語の動画を site/media/ に取り出す（手元の動画は上書きしない）',
    old: ['bun scripts/media.ts pull'],
    file: 'scripts/media.ts',
    options: { course: TARGET.course, ...DRY },
    dry: 'plan',
    steps: ({ values }) => [bun('scripts/media.ts', 'pull', ...pickCourses(values), ...flag(values, 'verbose'))],
  },
  {
    name: 'media check',
    usage: '',
    summary: '動画の一覧・Releases・手元の動画を照らし合わせる',
    old: ['npm run media:check'],
    file: 'scripts/media.ts',
    options: {},
    steps: ({ values }) => [bun('scripts/media.ts', 'check', ...flag(values, 'verbose'))],
  },
  {
    name: 'media push',
    usage: '--course <ID> [--lang <言語>]',
    summary: 'その講座の動画を Releases に置き、その講座の動画の一覧だけを書き換える',
    old: ['npm run media:push'],
    file: 'scripts/media.ts',
    options: { course: TARGET.course, lang: { type: 'string' }, ...DRY },
    dry: 'plan',
    steps: ({ values }) => {
      const ids = pickCourses(values);
      if (!ids.length) throw new UsageError('--course <講座 ID> を渡す');
      return [
        bun(
          'scripts/media.ts',
          'push',
          ...ids.flatMap((id) => ['--course', id]),
          ...opt(values, 'lang'),
          ...flag(values, 'verbose'),
        ),
      ];
    },
  },
  {
    name: 'site build',
    usage: '[--course <ID>] [--strict]',
    summary: '講座サイト（site/dist）を組み立てる。--strict は公開と同じ確かめ方（gh の認証が要る）',
    old: ['npm run build:site'],
    file: 'scripts/build_site.ts',
    options: { course: TARGET.course, strict: { type: 'boolean' }, ...DRY },
    dry: 'plan',
    steps: ({ values }) => [bun('scripts/build_site.ts', ...flag(values, 'strict'), ...pickCourses(values))],
  },
  {
    name: 'site serve',
    usage: '[--port <番号>]',
    summary: '手元で講座サイトを見る（既定 http://127.0.0.1:8765/。Range にも答える）',
    old: ['npm run serve'],
    file: 'scripts/serve.ts',
    options: { port: { type: 'string' } },
    steps: ({ values }) => {
      if (values.port !== undefined && !/^\d{1,5}$/.test(String(values.port)))
        throw new UsageError(`--port は番号: ${values.port}`);
      const step = bun('scripts/serve.ts');
      return [
        values.port ? { ...step, env: { PORT: String(values.port) }, show: `PORT=${values.port} ${step.show}` } : step,
      ];
    },
  },
  {
    name: 'site check',
    usage: '[フォルダ]',
    summary: '組み立てた公開物（既定 site/dist）・公開の手順・Worker の設定を確かめる',
    old: ['bun scripts/check_delivery.ts'],
    file: 'scripts/check_delivery.ts',
    options: {},
    positionals: true,
    steps: ({ positionals }) => [bun('scripts/check_delivery.ts', ...positionals.slice(0, 1))],
  },
  {
    name: 'publish verify',
    usage: '[origin]',
    summary: `公開したサイト（既定 ${readSiteConfig().baseUrl}）のトップと、全部の動画の Range を確かめる`,
    old: ['bun scripts/verify_public.ts'],
    file: 'scripts/verify_public.ts',
    options: {},
    positionals: true,
    steps: ({ positionals }) => [bun('scripts/verify_public.ts', ...positionals.slice(0, 1))],
  },
  {
    name: 'check overlap',
    usage: '--course <ID> [--lang <言語>] [--query <q>] [--min <字>] [--min-words <語>] [--refresh]',
    summary: '台本と出典の公式ページで、言い回しが続けて同じところを探す（ネットにつなぐ）',
    old: ['bun scripts/check_overlap.ts'],
    file: 'scripts/check_overlap.ts',
    options: {
      course: TARGET.course,
      lang: { type: 'string' },
      query: { type: 'string' },
      min: { type: 'string' },
      'min-words': { type: 'string' },
      refresh: { type: 'boolean' },
    },
    steps: ({ values }) => [
      bun(
        'scripts/check_overlap.ts',
        oneCourse(values),
        ...opt(values, 'lang'),
        ...opt(values, 'query'),
        ...opt(values, 'min'),
        ...opt(values, 'min-words'),
        ...flag(values, 'refresh'),
      ),
    ],
  },
  {
    name: 'legacy pages-migrate',
    usage: '[--confirm <SHA>]',
    summary: '旧 Pages を移行の案内に置き換える（持ち主だけ。既定は下見だけ）',
    old: ['bash scripts/legacy/deploy_pages.sh'],
    file: 'scripts/legacy/deploy_pages.sh',
    options: { confirm: { type: 'string' }, ...DRY },
    dry: 'plan',
    steps: ({ values }) => [sh('scripts/legacy/deploy_pages.sh', opt(values, 'confirm'))],
  },
  {
    name: 'ci cloudflare-setup',
    usage: 'plan|apply',
    summary: '本番の公開の初回の設定（持ち主だけ。plan は何をするかを出すだけ）',
    old: ['bun scripts/setup_cloudflare_ci.ts'],
    file: 'scripts/setup_cloudflare_ci.ts',
    options: {},
    positionals: true,
    steps: ({ positionals }) => {
      if (positionals.length !== 1 || !['plan', 'apply'].includes(positionals[0]))
        throw new UsageError('plan か apply を 1 つ渡す');
      return [bun('scripts/setup_cloudflare_ci.ts', positionals[0])];
    },
  },
];

/* ───────────── 使い方 ───────────── */

const CLI = 'npm run chalk --';
/** 一覧の行（名前と引数の形・すること・前の呼び方）。help と docs/guide/commands.md の表の、両方の元 */
export const helpRows = (): [string, string, string[]][] =>
  COMMANDS.map((c) => [`${c.name}${c.usage ? ` ${c.usage}` : ''}`, c.summary, c.old]);

/** chalk help の出力（頭書きと、コマンドの一覧） */
export const overview = (): string =>
  [
    headerOf(import.meta.filename),
    '',
    'コマンド:',
    ...helpRows().map(([name, summary]) => `  ${name}\n      ${summary}`),
  ].join('\n');

/** docs/guide/commands.md の表（npm run gen が、印の間に入れる） */
export const commandTable = (): string =>
  [
    '<!-- npm run gen が、scripts/cli.ts のコマンドの一覧（npm run chalk -- help の元）から作る。手で直さない -->',
    '',
    '| コマンド（`npm run chalk -- …`） | すること | 前の呼び方（そのまま使える） |',
    '|---|---|---|',
    ...helpRows().map(
      ([name, summary, old]) =>
        `| \`${name.replace(/\|/g, '\\|')}\` | ${summary.replace(/\|/g, '｜')} | ${old.length ? old.map((x) => `\`${x}\``).join('・') : '（新しい）'} |`,
    ),
    '',
  ].join('\n');

/** そのコマンドの --help（何も流さない。中の道具の頭書きは、ファイルを読んで出す） */
const commandHelp = (c: Command): string => {
  const accepts = Object.keys(c.options).map((k) => `--${k}`);
  return [
    `使い方: ${CLI} ${c.name}${c.usage ? ` ${c.usage}` : ''}`,
    `  ${c.summary}`,
    `  受け取る引数: ${[...accepts, '-v', '-h'].join('・')}`,
    `  前の呼び方: ${c.old.length ? c.old.join('・') : '（新しい）'}`,
    '',
    `── 中で流す道具（${c.file}）の頭書き ──`,
    headerOf(path.join(ROOT, c.file)),
  ].join('\n');
};

/** 引数の頭からコマンドを選ぶ（2 語の名前を先に見る） */
export const findCommand = (argv: string[]): { command: Command; rest: string[] } | null => {
  for (const words of [2, 1]) {
    const name = argv.slice(0, words).join(' ');
    const command = COMMANDS.find((c) => c.name === name);
    if (command) return { command, rest: argv.slice(words) };
  }
  return null;
};

const main = (argv: string[]) => {
  if (!argv.length) {
    console.error(overview());
    return EXIT.usage;
  }
  if (argv[0] === 'help' || argv[0] === '--help' || argv[0] === '-h') {
    const found = argv.length > 1 ? findCommand(argv.slice(1)) : null;
    if (argv.length > 1 && !found)
      throw new UsageError(`知らないコマンド: ${argv.slice(1).join(' ')}（一覧は ${CLI} help）`);
    console.log(found ? commandHelp(found.command) : overview());
    return EXIT.ok;
  }
  const found = findCommand(argv);
  if (!found) throw new UsageError(`知らないコマンド: ${argv.slice(0, 2).join(' ')}（一覧は ${CLI} help）`);
  const { command, rest } = found;
  const options: Options = { ...command.options, verbose: { type: 'boolean', short: 'v' } };
  const parsed = readArgs(rest, options, { positionals: command.positionals });
  const values = parsed.values as Values;
  const { positionals } = parsed;
  if (values.help) {
    console.log(commandHelp(command));
    return EXIT.ok;
  }
  const steps = command.steps({ values, positionals });
  if (values['dry-run'] && command.dry === 'plan') {
    console.log(['流すコマンド（--dry-run なので、何もしない）:', ...steps.map((s) => `  ${s.show}`)].join('\n'));
    return EXIT.ok;
  }
  for (const step of steps) {
    if (values.verbose) console.error(`> ${step.show}`);
    const code = runInherit(step.argv[0], step.argv.slice(1), { cwd: ROOT, env: { ...process.env, ...step.env } });
    if (code !== 0) return code;
  }
  return EXIT.ok;
};

if (import.meta.main) await runMain(main);
