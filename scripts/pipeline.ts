// 段（声と時刻 voice・ミックス mix・動画 render・読む教材 docs・講座サイト site）の状態を見て、古くなった段だけを流す。
//   bun scripts/pipeline.ts status [動画…] [--course <ID>] [--video <形>] [--lang <言語>] [--json]
//       段ごとに、記録（.work/state/<段>/<単位>.json）と今の入力の指紋を比べ、古い単位と次に流す段を出す（何も作らない）。
//       公開した動画（講座ごとの動画の一覧の inputs）が今の台本と合うかも出す
//   bun scripts/pipeline.ts build --to <voice|mix|render|docs|site> [対象…] [--force] [--src] [--cached-only] [--jobs <数>] [--dry-run]
//       その段まで、前の段から順に、古い単位だけを流して記録する。何も変えていなければ、何も流さない。
//       --force は新しい単位も流す。--src は、描き方のコード（src など）だけが変わった動画も書き出す（既定は書き出さない）。
//       記録の無い動画は書き出し直さない（今の動画を残す。書き出すなら --force）。--cached-only は voice を素材の声だけで作る。
//       --jobs は書き出しの並列の数。--dry-run は流すものを出すだけ
//   bun scripts/pipeline.ts record <段> [--begin] <単位…>
//       道具が自分で記録する。--begin は流す前の指紋を置き、付けなければ流したあとで比べてから記録する（npm run mix がミックスの前後に
//       流す）。記録できなくても 0 で終える（道具を止めない。理由は標準エラーに出す）。書き出し（render）は、書き出しの道具
//       （scripts/stages/video/render.ts）が動画ごとに自分で記録するので、ここでは受けない
//   npm run chalk -- status|build …   # 1 つの入口からも流せる（docs/guide/commands.md の「chalk」）
// 対象を選ばなければ、公開する言語（site/config.json の publishLangs）の全部の動画。教材とサイトは、いつも全部を 1 つの単位で見る。
// 段と指紋に入れるものは scripts/stages/pipeline/stages.ts、状態の見方は runner.ts、記録の形は state.ts
// 終了コード: 0 成功（status は古い単位があっても 0）・1 失敗（流した道具が失敗した）・2 使い方の誤り・3 前提が足りない
import { VIDEOS } from '../content';
import { pickVideos } from './cli';
import { readArgs, runMain, showHelp, UsageError } from './lib/args';
import { ROOT, ttsDirs } from './lib/paths';
import { setVerbose } from './lib/proc';
import { fileHasher } from './stages/pipeline/digest';
import {
  begin,
  build,
  commit,
  nextRuns,
  type Stage,
  type StatusReport,
  statusOf,
  type UnitStatus,
} from './stages/pipeline/runner';
import { makeStages, STAGE_NAMES, type StagesCtx } from './stages/pipeline/stages';
import { type PublishedCheck, publishedChecks, srcDigest } from './stages/video/inputs';

const TARGET = {
  course: { type: 'string', multiple: true },
  video: { type: 'string', multiple: true },
  lang: { type: 'string', multiple: true },
} as const;
const VERBOSE = { verbose: { type: 'boolean', short: 'v' } } as const;

/** 段の状態の見せ方 */
const STATE_LABEL: Record<UnitStatus['state'], string> = {
  fresh: '新しい',
  stale: '古い',
  pending: '前の段を待つ',
  unrecorded: '記録が無い',
};
const RESULT_LABEL: Record<PublishedCheck['result'], string> = {
  same: '台本と合う',
  script: '台本が変わった（動画が古い）',
  src: '描き方だけ違う',
  none: '記録が無い',
  unknown: 'timeline が無い',
};

const ctxOf = (root = ROOT): StagesCtx => ({ root, hasher: fileHasher(root), store: ttsDirs(root) });

/** 段ごとの数（新しい 43・古い 2 など）。記録が無い単位は、出力のあるなしも */
const counts = (units: UnitStatus[]): string => {
  const parts: string[] = [];
  for (const state of ['fresh', 'stale', 'pending', 'unrecorded'] as const) {
    const list = units.filter((s) => s.state === state);
    if (!list.length) continue;
    if (state === 'unrecorded') {
      const missing = list.filter((s) => s.outputs === 'missing').length;
      parts.push(`${STATE_LABEL[state]} ${list.length}（出力はある ${list.length - missing}・無い ${missing}）`);
    } else if (state === 'stale') {
      const advisory = list.filter((s) => s.advisoryOnly).length;
      parts.push(`${STATE_LABEL[state]} ${list.length}${advisory ? `（描き方のコードだけ ${advisory}）` : ''}`);
    } else parts.push(`${STATE_LABEL[state]} ${list.length}`);
  }
  return parts.join('・') || '単位が無い';
};

type StatusJson = {
  schema: 1;
  videos: string[];
  stages: {
    name: string;
    label: string;
    units: {
      unit: string;
      state: UnitStatus['state'];
      reasons: string[];
      changed: string[];
      advisoryOnly: boolean;
      outputs: UnitStatus['outputs'];
      upstream: string[];
      from: UnitStatus['from'];
    }[];
  }[];
  next: { stage: string; units: string[] }[];
  published: { video: string; kind: string; file: string; result: PublishedCheck['result'] }[];
};

export const statusJson = (keys: string[], r: StatusReport, published: PublishedCheck[]): StatusJson => ({
  schema: 1,
  videos: keys,
  stages: r.stages.map(({ stage, units }) => ({
    name: stage.name,
    label: stage.label,
    units: units.map((s) => ({
      unit: s.unit,
      state: s.state,
      reasons: s.reasons,
      changed: s.changed,
      advisoryOnly: s.advisoryOnly,
      outputs: s.outputs,
      upstream: s.upstream,
      from: s.from,
    })),
  })),
  next: nextRuns(r),
  published: published.map((p) => ({ video: p.video.key, kind: p.kind, file: p.file, result: p.result })),
});

/** status の文（段ごとの数・古い単位と理由・公開した動画の記録・次に流す段） */
export const statusText = (keys: string[], r: StatusReport, published: PublishedCheck[], verbose = false): string => {
  const width = Math.max(...r.stages.map(({ stage }) => stage.name.length));
  const lines = [`段の状態（動画 ${keys.length} 本。教材とサイトは全部で 1 つ）:`];
  for (const { stage, units } of r.stages)
    lines.push(`  ${stage.name.padEnd(width)}  ${stage.label}: ${counts(units)}`);
  const shown = r.stages.flatMap(({ units }) =>
    units.filter((s) => s.state === 'stale' || s.state === 'pending' || (verbose && s.state === 'unrecorded')),
  );
  if (shown.length) {
    lines.push('古い単位（理由）:');
    const limit = verbose ? shown.length : 20;
    for (const s of shown.slice(0, limit))
      lines.push(`  ${s.stage} ${s.unit}: ${STATE_LABEL[s.state]}。${s.reasons.join('。')}`);
    if (shown.length > limit) lines.push(`  …ほか ${shown.length - limit}（全部は -v）`);
  }
  if (published.length) {
    const n = (k: PublishedCheck['result']) => published.filter((p) => p.result === k).length;
    lines.push(
      `公開した動画の記録（動画の一覧の inputs）: ${(['same', 'script', 'src', 'none', 'unknown'] as const)
        .filter((k) => n(k))
        .map((k) => `${RESULT_LABEL[k]} ${n(k)}`)
        .join('・')}`,
    );
    for (const p of published.filter((x) => x.result === 'script'))
      lines.push(
        `  ${p.video.key}（${p.kind === 'captioned' ? '字幕版' : '通常版'}）: 書き出したあとで台本が変わった。書き出し直して media push`,
      );
  }
  const next = nextRuns(r);
  if (next.length) {
    lines.push(`次に流す段: ${next.map((x) => `${x.stage}（${x.units.length}）`).join(' → ')}`);
    for (const to of sinks(r, next))
      lines.push(`  npm run chalk -- build --to ${to}（流すものだけを見るなら --dry-run）`);
  } else lines.push('次に流す段は無い（全部新しいか、記録が無いまま残す単位だけ）');
  return lines.join('\n');
};

/** 次に流す段のうち、ほかの次に流す段の前の段でないもの（build --to に渡すと、全部が流れる段。後ろの段から） */
const sinks = (r: StatusReport, next: { stage: string }[]): string[] => {
  const needs = new Map(r.stages.map(({ stage }) => [stage.name, stage.needs]));
  const before = (name: string, seen = new Set<string>()): Set<string> => {
    for (const n of needs.get(name) ?? []) if (!seen.has(n)) before(n, seen.add(n));
    return seen;
  };
  const names = next.map((x) => x.stage);
  return names.filter((s) => !names.some((t) => t !== s && before(t).has(s))).reverse();
};

/** --dry-run の文（段ごとに、流す単位・残す単位・前の段のあとで確かめる単位） */
const planText = (plan: Awaited<ReturnType<typeof build>>['plan']): string => {
  const lines = ['流すもの（--dry-run なので、何もしない）:'];
  for (const p of plan) {
    const parts = [
      p.run.length
        ? `流す ${p.run.length}（${p.run
            .map((s) => s.unit)
            .slice(0, 10)
            .join(' ')}${p.run.length > 10 ? ' …' : ''}）`
        : '',
      p.later.length ? `前の段のあとで確かめる ${p.later.length}` : '',
      p.kept.length ? `記録が無いので残す ${p.kept.length}` : '',
      p.advisory.length ? `描き方のコードだけが変わったので流さない ${p.advisory.length}（--src）` : '',
    ].filter(Boolean);
    lines.push(`  ${p.stage}: ${parts.join('・') || '流すものは無い'}`);
    // 流す理由ごとに、本数と例
    const why = new Map<string, string[]>();
    for (const s of p.run) {
      const k = s.reasons.join('。') || '新しいが --force';
      why.set(k, [...(why.get(k) ?? []), s.unit]);
    }
    for (const [k, units] of why)
      lines.push(`    ${k}: ${units.length} 本（${units.slice(0, 5).join(' ')}${units.length > 5 ? ' …' : ''}）`);
  }
  return lines.join('\n');
};

/** 対象の動画（--course・--video・--lang と名前の無い引数。選ばなければ公開する言語の全部） */
const targetOf = (values: Record<string, unknown>, positionals: string[]) =>
  pickVideos(values as Parameters<typeof pickVideos>[0], positionals);

const stageOf = (stages: Stage[], name: string | undefined): Stage => {
  const s = stages.find((x) => x.name === name);
  if (!s) throw new UsageError(`段は ${STAGE_NAMES.join('・')} のどれか: ${name ?? '（無い）'}`);
  return s;
};

const main = async (argv: string[]) => {
  const [command, ...rest] = argv;
  if (command === '-h' || command === '--help') return showHelp(import.meta.filename);
  if (command === 'status') {
    const { values, positionals } = readArgs(
      rest,
      { ...TARGET, json: { type: 'boolean' }, ...VERBOSE },
      { positionals: true },
    );
    if (values.help) return showHelp(import.meta.filename);
    setVerbose(values.verbose === true);
    const keys = targetOf(values, positionals);
    const ctx = ctxOf();
    const report = statusOf(ctx, makeStages(ctx), { keys });
    const videos = VIDEOS.filter((v) => keys.includes(v.key));
    const published = publishedChecks(ctx.root, videos, srcDigest(ctx.root, ctx.hasher));
    ctx.hasher.save();
    console.log(
      values.json
        ? JSON.stringify(statusJson(keys, report, published), null, 1)
        : statusText(keys, report, published, values.verbose === true),
    );
    return 0;
  }
  if (command === 'build') {
    const { values, positionals } = readArgs(
      rest,
      {
        ...TARGET,
        to: { type: 'string' },
        force: { type: 'boolean' },
        src: { type: 'boolean' },
        'cached-only': { type: 'boolean' },
        jobs: { type: 'string' },
        'dry-run': { type: 'boolean' },
        ...VERBOSE,
      },
      { positionals: true },
    );
    if (values.help) return showHelp(import.meta.filename);
    setVerbose(values.verbose === true);
    if (!values.to) throw new UsageError(`--to <段> を渡す（${STAGE_NAMES.join('・')}。前の段も流す）`);
    if (values.to === 'video') values.to = 'render';
    if (values.jobs !== undefined && !/^[1-9]\d*$/.test(values.jobs))
      throw new UsageError(`--jobs は 1 以上の整数: ${values.jobs}`);
    const keys = targetOf(values, positionals);
    const ctx = ctxOf();
    const stages = makeStages(ctx);
    stageOf(stages, values.to);
    const r = await build(
      ctx,
      stages,
      values.to,
      { keys },
      {
        force: values.force === true,
        advisory: values.src === true,
        cachedOnly: values['cached-only'] === true,
        jobs: values.jobs ? Number(values.jobs) : undefined,
        dryRun: values['dry-run'] === true,
      },
    );
    if (values['dry-run']) console.log(planText(r.plan));
    else if (r.code === 0)
      console.log(
        `build --to ${values.to}: 記録した単位 ${r.recorded}${r.notRecorded.length ? `・記録しなかった ${r.notRecorded.length}` : ''}`,
      );
    return r.code;
  }
  if (command === 'record') {
    const { values, positionals } = readArgs(rest, { begin: { type: 'boolean' }, ...VERBOSE }, { positionals: true });
    if (values.help) return showHelp(import.meta.filename);
    const [name, ...units] = positionals;
    const ctx = ctxOf();
    const stages = makeStages(ctx);
    const stage = stageOf(stages, name);
    if (stage.selfRecord)
      throw new UsageError(
        `${stage.name} は、流した道具が自分で記録する（書き出しは scripts/stages/video/render.ts が、動画ごとに書き出しの前後で記録する）`,
      );
    if (!units.length) throw new UsageError('記録する単位（動画の名前など）を渡す');
    const known = new Set(stage.units({ keys: VIDEOS.map((v) => v.key) }));
    for (const u of units) if (!known.has(u)) throw new UsageError(`${stage.name} に無い単位: ${u}`);
    for (const u of units) {
      try {
        if (values.begin) begin(ctx, stage, u);
        else {
          const why = commit(ctx, stage, u);
          if (why) console.error(`注意: ${stage.name} ${u} を記録しなかった: ${why}`);
        }
      } catch (e) {
        console.error(`注意: ${stage.name} ${u} を記録できなかった: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    ctx.hasher.save();
    return 0;
  }
  throw new UsageError(
    command === undefined
      ? 'コマンドを選ぶ: status・build・record（使い方は --help）'
      : `知らないコマンド: ${command}（status・build・record。使い方は --help）`,
  );
};

if (import.meta.main) await runMain(main);
