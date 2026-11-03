// 段の形と、状態の見方（status）・古い単位だけを流す組み立て（build）・記録（record）。段の中身（何を入力にし、何を流すか）は
// scripts/stages/pipeline/stages.ts、記録のファイルは state.ts、指紋の部品は digest.ts。
// 段は単位（動画・講座・サイト全体）ごとに、次を持つ:
//   fingerprint(単位)  入力の部分ごとの指紋（ファイルを読むだけ。同じ入力なら同じ値）。入力がそろわないときは、その理由
//   outputs(単位)      出力のパス。記録には、その sha256 を書く（出力を手で変えた・消したら、古いとみなす）
//   run(単位…)         今ある道具（synth・mix.py・render.sh・build_materials・build_site）を流す
// 単位の状態:
//   新しい（fresh）       記録の指紋が今の指紋と同じで、出力も記録のとおり
//   古い（stale）         指紋が違う・出力が無いか記録と違う・入力がそろわない
//   前の段を待つ（pending）自分の記録は新しいが、前の段の単位が古い（前の段を流すと、この段の入力が変わるかもしれない）
//   記録が無い（unrecorded）まだ記録していない（この仕組みより前に作った出力など）
// 前の段の出力は、その段の記録の指紋ではなく、出力そのものの sha256 で次の段の指紋に入る。前の段を流し直しても出力が同じなら、
// 次の段は流さない
import { statSync } from 'node:fs';
import path from 'node:path';
import { withLock } from '../../lib/fsx';
import { digest, type FileHasher } from './digest';
import {
  clearPending,
  type OutputRecord,
  readPending,
  readState,
  STATE_DIR,
  STATE_SCHEMA,
  type UnitState,
  writePending,
  writeState,
} from './state';

/** 入力の部分ごとの指紋か、入力がそろわない理由 */
export type Inputs = { parts: Record<string, string> } | { missing: string };

/** 記録（.work/state の記録か、ほかの記録から作った代わり）。partial なら、parts に無い部分は比べない */
export type Recorded = Pick<UnitState, 'parts' | 'outputs'> & { partial?: boolean; from: 'state' | 'fallback' };

/** 対象（動画の名前。段ごとの単位は、ここから決める） */
export type Target = { keys: readonly string[] };

export type RunOptions = { cachedOnly?: boolean; jobs?: number };

/** 段 1 つ */
export type Stage = {
  name: string;
  /** 見せる名前 */
  label: string;
  /** 前の段（この段の入力を作る段） */
  needs: readonly string[];
  /**
   * 記録が無く、出力がそろっているときに流すか。run は流す（安い段。流し直しても同じ出力になる）、
   * keep は流さない（書き出しのように高い段。今の出力を残し、--force のときだけ流す）
   */
  unrecorded: 'run' | 'keep';
  /** それだけが変わっても、既定では流さない部分（描き方のコードなど。build の --src で流す） */
  advisory?: readonly string[];
  /** 流した道具が、自分で記録する（render.sh が書き出しのたびに記録する） */
  selfRecord?: boolean;
  units: (t: Target) => string[];
  /** 単位の入力を作る、前の段の単位 */
  deps: (unit: string) => { stage: string; unit: string }[];
  fingerprint: (unit: string) => Inputs;
  outputs: (unit: string) => string[];
  /** 記録してよいか（だめなら理由）。書き出しの字幕版を作っていないときなど */
  recordable?: (unit: string) => string | null;
  /** 記録が無いときの代わり（公開した動画の一覧の inputs など） */
  fallback?: (unit: string) => Recorded | null;
  /** 記録も出力も無い単位を、流さずに残す理由（公開した動画を取り出していないだけ、など）。null なら流す */
  keepMissing?: (unit: string) => string | null;
  run: (units: string[], opts: RunOptions) => number | Promise<number>;
  /** 流した道具の版（記録に書く） */
  tools?: () => Record<string, string>;
};

export type UnitStatus = {
  stage: string;
  unit: string;
  state: 'fresh' | 'stale' | 'pending' | 'unrecorded';
  /** 古い・記録が無い・待つ理由（見せる文） */
  reasons: string[];
  /** 記録と違う入力の部分 */
  changed: string[];
  /** 違うのが、既定では流さない部分（advisory）だけ */
  advisoryOnly: boolean;
  /** 出力: そろっている・無いものがある・記録と違う */
  outputs: 'present' | 'missing' | 'changed';
  /** 古い前の段の単位（<段> <単位>） */
  upstream: string[];
  /** 記録の出どころ */
  from: 'state' | 'fallback' | null;
  /** 記録も出力も無いが、流さずに残す理由（keepMissing） */
  keep?: string;
  inputs: Inputs;
};

/** 部分の名前の見せ方（段が付けた名前のほかは、そのまま出す） */
export const PART_LABELS: Record<string, string> = {
  script: '台本',
  voices: '声',
  timing: '時刻の決め方',
  tool: '道具のコード',
  plan: 'ミックスの設計図',
  music: 'BGM・効果音',
  src: '描き方のコード（src・engine・依存の版）',
  audio: 'ミックスの音',
  course: '講座の台本',
  timelines: 'timeline',
  content: '台本',
  data: 'サイトの台本（site/data）',
  posters: 'ポスター',
  media: '動画の一覧',
  config: 'サイトの設定',
};
const partLabel = (p: string) => PART_LABELS[p] ?? p;

/* ───────────── 状態 ───────────── */

export type Ctx = { root: string; hasher: FileHasher };

/** 記録（.work/state）か、その代わり */
const recordOf = (ctx: Ctx, stage: Stage, unit: string): Recorded | null => {
  const s = readState(ctx.root, stage.name, unit);
  if (s) return { parts: s.parts, outputs: s.outputs, from: 'state' };
  return stage.fallback?.(unit) ?? null;
};

/** 単位 1 つの状態（前の段は見ない。前の段を待つかは statusOf が決める） */
export const unitStatus = (ctx: Ctx, stage: Stage, unit: string): UnitStatus => {
  const inputs = stage.fingerprint(unit);
  const expected = stage.outputs(unit);
  const present = expected.every((f) => ctx.hasher.sha256(f) !== null);
  const base = {
    stage: stage.name,
    unit,
    changed: [] as string[],
    advisoryOnly: false,
    upstream: [] as string[],
    inputs,
  };
  const rec = recordOf(ctx, stage, unit);
  if ('missing' in inputs)
    return {
      ...base,
      state: 'stale',
      reasons: [inputs.missing],
      outputs: present ? 'present' : 'missing',
      from: rec?.from ?? null,
    };
  if (!rec) {
    const keep = !present && stage.unrecorded === 'keep' ? (stage.keepMissing?.(unit) ?? undefined) : undefined;
    return {
      ...base,
      state: 'unrecorded',
      reasons: [present ? '記録が無い（出力はある）' : `記録が無い（出力が無い${keep ? `。${keep}` : ''}）`],
      outputs: present ? 'present' : 'missing',
      from: null,
      ...(keep ? { keep } : {}),
    };
  }
  const keys = [...new Set([...Object.keys(inputs.parts), ...Object.keys(rec.parts)])].sort();
  const changed = keys.filter((k) => !(rec.partial && !(k in rec.parts)) && rec.parts[k] !== inputs.parts[k]);
  const missing: string[] = [];
  const differ: string[] = [];
  for (const [file, o] of Object.entries(rec.outputs)) {
    const sha = ctx.hasher.sha256(file);
    if (sha === null) missing.push(file);
    else if (sha !== o.sha256) differ.push(file);
  }
  if (!rec.partial) for (const f of expected) if (!(f in rec.outputs) && !missing.includes(f)) missing.push(f);
  // 今の値が空の部分は、入力が無い（ミックスの音が無い など）
  const shown = changed.map((k) => (inputs.parts[k] === '' ? `${partLabel(k)}（無い）` : partLabel(k)));
  const reasons = [
    ...(changed.length ? [`入力が変わった: ${shown.join('・')}`] : []),
    ...(missing.length ? [`出力が無い: ${missing.join(' ')}`] : []),
    ...(differ.length ? [`出力が記録と違う: ${differ.join(' ')}`] : []),
  ];
  const outputs = missing.length ? 'missing' : differ.length ? 'changed' : 'present';
  if (!reasons.length) return { ...base, state: 'fresh', reasons: [], outputs, from: rec.from };
  const advisoryOnly =
    !missing.length && !differ.length && changed.length > 0 && changed.every((k) => stage.advisory?.includes(k));
  return { ...base, state: 'stale', reasons, changed, advisoryOnly, outputs, from: rec.from };
};

export type BuildOptions = {
  /** 新しい単位も流す */
  force?: boolean;
  /** advisory の部分（描き方のコード）だけが変わった単位も流す */
  advisory?: boolean;
};

/** その単位を流すか（build の既定の決め方） */
export const willRun = (stage: Stage, s: UnitStatus, opts: BuildOptions = {}): boolean =>
  !!opts.force ||
  (s.state === 'stale' && (!s.advisoryOnly || !!opts.advisory)) ||
  (s.state === 'unrecorded' && (stage.unrecorded === 'run' || (s.outputs === 'missing' && !s.keep)));

/** 段の名前 → 段 */
const byName = (stages: readonly Stage[]) => new Map(stages.map((s) => [s.name, s]));

/** to まで流す段（前の段を先に。stages の並びは、前の段が先に来るように書く） */
export const stagesTo = (stages: readonly Stage[], to: string): Stage[] => {
  const map = byName(stages);
  if (!map.has(to)) throw new Error(`段が無い: ${to}（${stages.map((s) => s.name).join('・')}）`);
  const want = new Set<string>();
  const visit = (name: string) => {
    if (want.has(name)) return;
    want.add(name);
    for (const n of map.get(name)?.needs ?? []) visit(n);
  };
  visit(to);
  return stages.filter((s) => want.has(s.name));
};

export type StatusReport = { stages: { stage: Stage; units: UnitStatus[] }[] };

/** 全部の段の状態。前の段の単位が流れるもの（古いか、記録が無くて流すもの）なら、新しい単位も「前の段を待つ」にする */
export const statusOf = (ctx: Ctx, stages: readonly Stage[], target: Target): StatusReport => {
  const out: StatusReport = { stages: [] };
  const runs = new Map<string, Set<string>>();
  for (const stage of stages) {
    const units = stage.units(target).map((u) => unitStatus(ctx, stage, u));
    for (const s of units) {
      s.upstream = stage
        .deps(s.unit)
        .filter((d) => runs.get(d.stage)?.has(d.unit))
        .map((d) => `${d.stage} ${d.unit}`);
      if (s.state === 'fresh' && s.upstream.length) {
        s.state = 'pending';
        s.reasons = [
          `前の段が古い: ${s.upstream.slice(0, 3).join('・')}${s.upstream.length > 3 ? ` ほか ${s.upstream.length - 3}` : ''}`,
        ];
      }
    }
    runs.set(stage.name, new Set(units.filter((s) => willRun(stage, s) || s.state === 'pending').map((s) => s.unit)));
    out.stages.push({ stage, units });
  }
  ctx.hasher.save();
  return out;
};

/** 次に流す段（status の結び）。段ごとに、build が流す単位（前の段を待つ単位も） */
export const nextRuns = (r: StatusReport): { stage: string; units: string[] }[] =>
  r.stages
    .map(({ stage, units }) => ({
      stage: stage.name,
      units: units.filter((s) => willRun(stage, s) || s.state === 'pending').map((s) => s.unit),
    }))
    .filter((x) => x.units.length);

/* ───────────── 記録 ───────────── */

const now = () => new Date().toISOString();

/** 流す前の指紋を置く（長く流す段。流し終えたら commit が比べる）。入力がそろわないときは、何も置かない */
export const begin = (ctx: Ctx, stage: Stage, unit: string): Inputs => {
  const inputs = stage.fingerprint(unit);
  if ('parts' in inputs)
    writePending(ctx.root, stage.name, unit, {
      schema: STATE_SCHEMA,
      fingerprint: digest(inputs.parts),
      parts: inputs.parts,
      at: now(),
    });
  else clearPending(ctx.root, stage.name, unit);
  return inputs;
};

/**
 * 流したあとの記録。今の指紋を出し、流す前の指紋（before か、begin が置いたもの）と違えば記録しない（流している間に入力が変わった）。
 * 出力が 1 つでも無ければ、記録しない。記録したら null、しなかったら理由を返す
 */
export const commit = (ctx: Ctx, stage: Stage, unit: string, before?: Inputs): string | null => {
  const pending = readPending(ctx.root, stage.name, unit);
  clearPending(ctx.root, stage.name, unit);
  const why = stage.recordable?.(unit);
  if (why) return why;
  const inputs = stage.fingerprint(unit);
  if ('missing' in inputs) return `入力がそろわない（${inputs.missing}）`;
  const empty = Object.keys(inputs.parts).filter((k) => inputs.parts[k] === '');
  if (empty.length) return `入力が無い: ${empty.map(partLabel).join('・')}`;
  const fp = digest(inputs.parts);
  const was = before && 'parts' in before ? digest(before.parts) : pending?.fingerprint;
  if (was !== undefined && was !== fp) return '流している間に入力が変わった（もう一度流す）';
  const outputs: Record<string, OutputRecord> = {};
  for (const f of stage.outputs(unit)) {
    const sha256 = ctx.hasher.sha256(f);
    if (sha256 === null) return `出力が無い: ${f}`;
    outputs[f] = { sha256, bytes: statSync(path.join(ctx.root, f)).size };
  }
  writeState(ctx.root, {
    schema: STATE_SCHEMA,
    stage: stage.name,
    unit,
    fingerprint: fp,
    parts: inputs.parts,
    outputs,
    tools: stage.tools?.() ?? {},
    at: now(),
  });
  return null;
};

/* ───────────── 組み立て ───────────── */

export type BuildPlanItem = {
  stage: string;
  run: UnitStatus[];
  /** 記録が無く、出力を残す単位（高い段） */
  kept: UnitStatus[];
  /** advisory の部分だけが変わった単位 */
  advisory: UnitStatus[];
  /** --dry-run で、前の段を流したあとで確かめる単位 */
  later: string[];
};

export type BuildResult = { code: number; plan: BuildPlanItem[]; recorded: number; notRecorded: string[] };

/**
 * to の段まで、古い単位だけを流す（前の段から順に。段を流したら、次の段の指紋を出し直す）。dryRun なら何も流さず、流すものを返す。
 * 同じ作業フォルダで 2 つの build を同時に流さない（ロックを取る。取れなければ止める）
 */
export const build = async (
  ctx: Ctx,
  stages: readonly Stage[],
  to: string,
  target: Target,
  opts: BuildOptions & RunOptions & { dryRun?: boolean; log?: (line: string) => void } = {},
): Promise<BuildResult> => {
  const log = opts.log ?? console.log;
  const order = stagesTo(stages, to);
  const go = async (): Promise<BuildResult> => {
    const plan: BuildPlanItem[] = [];
    const planned = new Set<string>();
    let recorded = 0;
    const notRecorded: string[] = [];
    for (const stage of order) {
      const statuses = stage.units(target).map((u) => unitStatus(ctx, stage, u));
      const item: BuildPlanItem = {
        stage: stage.name,
        run: statuses.filter((s) => willRun(stage, s, opts)),
        kept: statuses.filter((s) => !willRun(stage, s, opts) && s.state === 'unrecorded'),
        advisory: statuses.filter((s) => !willRun(stage, s, opts) && s.state === 'stale' && s.advisoryOnly),
        later: [],
      };
      if (opts.dryRun) {
        item.later = statuses
          .filter(
            (s) => !willRun(stage, s, opts) && stage.deps(s.unit).some((d) => planned.has(`${d.stage} ${d.unit}`)),
          )
          .map((s) => s.unit);
        for (const s of item.run) planned.add(`${stage.name} ${s.unit}`);
        for (const u of item.later) planned.add(`${stage.name} ${u}`);
        plan.push(item);
        continue;
      }
      plan.push(item);
      if (item.kept.length)
        log(`${stage.name}: 記録の無い ${item.kept.length} 本は、今の出力を残す（流すなら --force）`);
      if (item.advisory.length)
        log(`${stage.name}: ${partLabel('src')}だけが変わった ${item.advisory.length} 本は流さない（流すなら --src）`);
      if (!item.run.length) {
        log(`${stage.name}: 流すものは無い`);
        continue;
      }
      const units = item.run.map((s) => s.unit);
      log(`${stage.name}: ${units.length} 本を流す（${units.slice(0, 8).join(' ')}${units.length > 8 ? ' …' : ''}）`);
      // 流す前の指紋（道具が自分で記録する段は、道具が流す前に置く）
      const before = new Map(stage.selfRecord ? [] : units.map((u) => [u, begin(ctx, stage, u)]));
      const code = await stage.run(units, opts);
      if (code !== 0) {
        for (const u of units) clearPending(ctx.root, stage.name, u);
        ctx.hasher.save();
        return { code, plan, recorded, notRecorded };
      }
      for (const u of units) {
        if (stage.selfRecord) {
          // 道具が記録した。記録が無いか古ければ、知らせる（流したあとの状態をもう一度見る）
          const s = unitStatus(ctx, stage, u);
          if (s.state === 'fresh') recorded++;
          else notRecorded.push(`${stage.name} ${u}: ${s.reasons.join('。')}`);
          continue;
        }
        const why = commit(ctx, stage, u, before.get(u));
        if (why) notRecorded.push(`${stage.name} ${u}: ${why}`);
        else recorded++;
      }
    }
    ctx.hasher.save();
    for (const n of notRecorded) log(`注意: 記録しなかった: ${n}`);
    return { code: 0, plan, recorded, notRecorded };
  };
  if (opts.dryRun) return go();
  return withLock(path.join(ctx.root, STATE_DIR, 'build.lock'), go, {
    what: 'build',
    timeoutMs: 1000,
  });
};
