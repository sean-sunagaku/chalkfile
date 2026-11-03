// 公開の手順（.github/workflows/ の workflow と、そこから使うリポジトリの中の composite action）・Worker の設定（wrangler.jsonc）・
// 組み立てた静的公開物（site/dist）を確かめる。CI の build と deploy が流す。単体テスト（tests/delivery.test.ts）が、わざと壊して止まるかを見る。
//   bun scripts/check_delivery.ts [site/dist]
// workflow は「形」（ジョブの数・名前・手順の順番・on の種類）では縛らず、「性質」（下の WORKFLOW_RULES）で確かめる。
// CI を組み直しても、性質を守っていれば通り、1 つでも破れば止まる。性質の一覧と理由は docs/operations/ci.md の「点検する性質」。
// Worker の許可リスト（npm run gen が作る worker/src/generated/media-manifest.json）があれば、講座ごとの動画の一覧と同じかも見る
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { type ParseError, parse as parseJsonc, printParseErrorCode } from 'jsonc-parser';
import { WORKERS_ASSET_MAX_BYTES, WORKERS_MAX_ASSETS } from '../site/limits';
import { retainedWarnings } from '../site/media-shared';
import { checkSecrets } from './check_content';
import { readMediaManifest } from './media';
import { mediaManifestJson } from './media-lists';

const ROOT = path.resolve(import.meta.dir, '..');

/* ───────────── Worker の設定 ───────────── */

export function validateWorkerConfig(value: any) {
  if (value.name !== 'chalkfile' || value.assets?.directory !== './site/dist' ||
      JSON.stringify(value.assets?.run_worker_first) !== JSON.stringify(['/media/*']) || value.assets?.not_found_handling !== '404-page') {
    throw new Error('静的サイトをWorkerへ通さない配信設定が不正です。');
  }
  // /media/* の失敗を Workers Logs で見えるようにしておく（W-13）。logs.enabled があれば、そちらが優先する。
  if ((value.observability?.logs?.enabled ?? value.observability?.enabled) !== true) throw new Error('Workers Logs（observability）が有効ではありません。');
}

/** JSONC（コメントと末尾のカンマを許す JSON。wrangler.jsonc の書き方）を読む。読めなければ、どこで読めないかを出して止める */
export function parseJsoncText(text: string, name = 'wrangler.jsonc'): unknown {
  const errors: ParseError[] = [];
  const value = parseJsonc(text, errors, { allowTrailingComma: true, disallowComments: false });
  if (errors.length) {
    const where = errors.map((e) => `${printParseErrorCode(e.error)}（${e.offset} 文字目）`).join('・');
    throw new Error(`${name} を JSONC として読めません: ${where}`);
  }
  return value;
}
export const readWranglerConfig = (file = path.join(ROOT, 'wrangler.jsonc')) =>
  parseJsoncText(readFileSync(file, 'utf8'), path.basename(file));

/* ───────────── 公開の手順（GitHub Actions）の性質 ───────────── */

/** 公開の手順が守る性質。点検の結果とテストに、この名前で出す（理由は docs/operations/ci.md の「点検する性質」） */
export const WORKFLOW_RULES = {
  secrets: 'secret は Deploy の手順だけ',
  main: 'production は main だけ',
  pinned: 'uses は SHA で固定',
  permissions: '権限は読み取りだけ',
  credentials: 'checkout は認証を残さない',
  install: 'インストール時スクリプトを動かさない',
  injection: 'run に外から来る文字を埋め込まない',
  needs: '公開は前のジョブを待つ',
  checked: '公開の前に点検する',
  serial: '公開は 1 つずつ',
  noCache: '公開のジョブはキャッシュを使わない',
} as const;
export type WorkflowRule = keyof typeof WORKFLOW_RULES;
export type WorkflowFinding = { rule: string; where: string; what: string };

/** 公開に使う GitHub の environment・secret を渡す手順の名前・公開を 1 つずつにする concurrency の group */
export const PRODUCTION = 'production';
export const DEPLOY_STEP = 'Deploy';
export const PRODUCTION_GROUP = 'chalkfile-production';
/** production のジョブの if に、いちばん外の && で入れる条件（fork と、main 以外の ref では公開しない） */
export const MAIN_ONLY = ["github.repository == 'sean-sunagaku/chalkfile'", "github.ref == 'refs/heads/main'"];
/** 外からの PR の内容を、main の権限とキャッシュで動かしうるきっかけ。どの workflow でも使わない */
const UNTRUSTED_EVENTS = ['pull_request_target', 'workflow_run'];
/** production のジョブを置く workflow を動かしてよいきっかけ */
const PRODUCTION_EVENTS = ['push', 'pull_request', 'workflow_dispatch'];
/** 書く権限を持つジョブ（Issue を開く）を置いてよい workflow のきっかけ（毎日の確かめと、手で流すとき） */
const WRITE_EVENTS = ['schedule', 'workflow_dispatch'];
/** workflow の concurrency で取り消してよいのは、PR の実行だけ（main の公開を途中で止めない） */
const CANCEL_ONLY_PR = "${{ github.event_name == 'pull_request' }}";
/** uses の書き方: owner/repo（/path）@40 桁の commit の SHA */
const PINNED = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_./-]+@[0-9a-f]{40}$/;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isFalse = (v: unknown) => v === false || v === 'false';
const isTrue = (v: unknown) => v === true || v === 'true';
const squash = (s: string) => s.trim().replace(/\s+/g, ' ');

/** リポジトリの中の action（uses: ./...）を読む。リポジトリの外を指すか、action.yml が無ければ null */
export type LoadAction = (uses: string) => unknown;
export const actionLoader =
  (root: string): LoadAction =>
  (uses) => {
    const dir = path.resolve(root, uses);
    if (!dir.startsWith(`${root}${path.sep}`)) return null;
    for (const name of ['action.yml', 'action.yaml']) {
      const file = path.join(dir, name);
      if (existsSync(file)) return Bun.YAML.parse(readFileSync(file, 'utf8'));
    }
    return null;
  };

/** 手順が、その action を使うか（actions/cache なら actions/cache/restore・actions/cache/save も） */
const usesAction = (step: Obj, action: string) => {
  if (typeof step.uses !== 'string') return false;
  const name = step.uses.split('@')[0];
  return name === action || name.startsWith(`${action}/`);
};

/** 文字が secrets を読むか。ふつうの値は ${{ }} の中を、if: は式そのものなので全体を見る */
const readsSecrets = (text: string, expression: boolean) =>
  expression
    ? /\bsecrets\b/.test(text)
    : [...text.matchAll(/\$\{\{([\s\S]*?)\}\}/g)].some((m) => /\bsecrets\b/.test(m[1]));

/** 式の各文字の、括弧の深さ（その文字を読む前の深さ）。文字列（'...'。中の '' は ' 1 文字）の中の文字は -1 */
const depths = (s: string): number[] => {
  const out: number[] = [];
  let depth = 0;
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      out.push(-1);
      if (c === "'" && s[i + 1] === "'") {
        out.push(-1);
        i++;
      } else if (c === "'") quoted = false;
      continue;
    }
    out.push(depth);
    if (c === "'") quoted = true;
    else if (c === '(') depth++;
    else if (c === ')') depth--;
  }
  return out;
};

/** 全体を囲む括弧を外す（「((a))」の a。「(a) && (b)」はそのまま） */
const unwrap = (s: string): string => {
  if (!s.startsWith('(') || !s.endsWith(')')) return s;
  const d = depths(s);
  for (let i = 1; i < s.length; i++) if (d[i] === 0) return s;
  return unwrap(squash(s.slice(1, -1)));
};

/**
 * GitHub Actions の式を、いちばん外の && で分ける（${{ }} を外し、全体と各部分を囲む括弧と、空白をそろえる）。
 * 式でないか、いちばん外に || があれば null（どちらか一方で通ってしまうので、条件を足しても効かない）
 */
export const conjuncts = (expression: unknown): string[] | null => {
  if (typeof expression !== 'string') return null;
  const s = unwrap(squash(expression.trim().replace(/^\$\{\{([\s\S]*)\}\}$/, '$1')));
  const d = depths(s);
  const parts: string[] = [];
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (d[i] !== 0) continue;
    if (s.startsWith('||', i)) return null;
    if (s.startsWith('&&', i)) {
      parts.push(s.slice(start, i));
      start = i + 2;
      i++;
    }
  }
  parts.push(s.slice(start));
  return parts.map((p) => unwrap(squash(p)));
};

const eventsOf = (on: unknown): string[] => {
  if (typeof on === 'string') return [on];
  if (Array.isArray(on)) return on.filter((e): e is string => typeof e === 'string');
  return isObj(on) ? Object.keys(on) : [];
};
const environmentOf = (job: Obj): string | undefined => {
  const env = job.environment;
  if (typeof env === 'string') return env;
  return isObj(env) && typeof env.name === 'string' ? env.name : undefined;
};
/** production のジョブか（environment を式で決めるジョブも、production かもしれないので同じに見る） */
const isProductionJob = (job: Obj) => {
  const name = environmentOf(job);
  return name === PRODUCTION || (name?.includes('${{') ?? false);
};
const needsOf = (job: Obj | undefined): string[] => {
  const needs = job?.needs;
  if (typeof needs === 'string') return [needs];
  return Array.isArray(needs) ? needs.filter((n): n is string => typeof n === 'string') : [];
};

/** npm ci の書き方（--ignore-scripts を付ければ使ってよい）と、CI で使わない npm のコマンド（依存を入れる・取ってきて動かす） */
const NPM_CI = new Set(['ci', 'clean-install', 'ic', 'install-clean', 'isntall-clean']);
const NPM_FORBIDDEN = new Set([
  'install', 'i', 'in', 'ins', 'inst', 'insta', 'instal', 'isnt', 'isnta', 'isntal', 'isntall', 'add',
  'update', 'up', 'upgrade', 'udpate', 'install-test', 'it', 'install-ci-test', 'cit', 'exec', 'x', 'rebuild', 'rb',
]);
/** run の中の、依存のインストール時スクリプトを動かしうる書き方の一覧 */
export const installProblems = (run: string): string[] => {
  const out: string[] = [];
  for (const m of run.matchAll(/\bnpm\s+([a-z-]+)([^\n;&|]*)/g)) {
    if (NPM_CI.has(m[1])) {
      if (!/(^|\s)--ignore-scripts(?=\s|$)/.test(m[2])) out.push(`npm ${m[1]} に --ignore-scripts を付ける`);
    } else if (NPM_FORBIDDEN.has(m[1])) out.push(`npm ${m[1]} を使わない（依存は npm ci --ignore-scripts で入れる）`);
  }
  if (/\bnpx\b(?!\s+--no-install\b)/.test(run)) out.push('npx には --no-install を付ける（入れていない版を取ってきて動かさない）');
  if (/\bbunx\b|\bbun\s+(x|install|i|add|update|link)\b/.test(run)) out.push('bun で依存を入れない・取ってきて動かさない');
  return out;
};

/** 並べた手順。composite action（uses: ./...）の中の手順は、呼んだ手順のすぐあとに入れる（nested は composite の中か） */
type Flat = { step: Obj; where: string; nested: boolean };

/**
 * workflow（YAML を読んだもの）が、公開の性質（WORKFLOW_RULES）を破っているところの一覧。空なら守っている。
 * 形（ジョブの数・名前・手順の順番）は見ない。リポジトリの中の composite action は、中の手順まで同じ性質で見る
 */
export function workflowFindings(
  value: unknown,
  opts: { file?: string; loadAction?: LoadAction } = {},
): WorkflowFinding[] {
  const file = opts.file ?? 'workflow';
  const load = opts.loadAction ?? actionLoader(ROOT);
  const out: WorkflowFinding[] = [];
  const add = (rule: WorkflowRule, where: string, what: string) => {
    out.push({ rule: WORKFLOW_RULES[rule], where: `${file} ${where}`, what });
  };
  const wf = isObj(value) ? value : {};
  const jobs: Record<string, Obj> = isObj(wf.jobs)
    ? Object.fromEntries(Object.entries(wf.jobs).map(([id, job]) => [id, isObj(job) ? job : {}]))
    : {};
  const ids = Object.keys(jobs);
  const events = eventsOf(wf.on);
  const production = ids.filter((id) => isProductionJob(jobs[id]));
  const stepsOf = (id: string): Obj[] => (Array.isArray(jobs[id].steps) ? jobs[id].steps : []).map((s) => (isObj(s) ? s : {}));
  const isDeploy = (id: string, step: Obj) => production.includes(id) && step.name === DEPLOY_STEP && step.uses === undefined;

  // ── secret は Deploy の手順だけ: production のジョブの Deploy の手順の env のほかで、secrets を読まない
  const walkSecrets = (node: unknown, where: string, expression: boolean) => {
    if (typeof node === 'string') {
      if (readsSecrets(node, expression))
        add('secrets', where, 'secrets を読んでいる（secret を渡すのは、production のジョブの Deploy の手順の env だけ）');
    } else if (Array.isArray(node)) {
      for (const [i, n] of node.entries()) walkSecrets(n, `${where}[${i}]`, false);
    } else if (isObj(node)) for (const [k, v] of Object.entries(node)) walkSecrets(v, `${where}.${k}`, k === 'if');
  };
  for (const [k, v] of Object.entries(wf)) if (k !== 'jobs') walkSecrets(v, k, false);
  for (const id of ids) {
    if (jobs[id].secrets !== undefined)
      add('secrets', `jobs.${id}.secrets`, '呼び出す workflow に secret を渡さない（secrets: inherit も）');
    for (const [k, v] of Object.entries(jobs[id]))
      if (k !== 'steps' && k !== 'secrets') walkSecrets(v, `jobs.${id}.${k}`, k === 'if');
    stepsOf(id).forEach((step, i) => {
      for (const [k, v] of Object.entries(step))
        if (!(k === 'env' && isDeploy(id, step))) walkSecrets(v, `jobs.${id}.steps[${i}].${k}`, k === 'if');
    });
  }

  // composite action を開いて、手順を並べる。中の secret と uses も同じに見る（何度呼ばれても、中身の secret は 1 回だけ見る）
  const opened = new Set<string>();
  const flatten = (steps: unknown, where: string, chain: string[]): Flat[] => {
    if (!Array.isArray(steps)) return [];
    return steps.flatMap((raw, i) => {
      const step = isObj(raw) ? raw : {};
      const at = `${where}.steps[${i}]${typeof step.name === 'string' ? `（${step.name}）` : ''}`;
      const list: Flat[] = [{ step, where: at, nested: chain.length > 0 }];
      const uses = typeof step.uses === 'string' ? step.uses : '';
      if (!uses.startsWith('./')) return list;
      if (chain.includes(uses)) {
        add('pinned', at, `${uses} が自分を呼んでいる`);
        return list;
      }
      const action = load(uses);
      const runs = isObj(action) && isObj(action.runs) ? action.runs : null;
      if (runs?.using !== 'composite') {
        add('pinned', at, `${uses} を、リポジトリの中の composite action（action.yml の runs.using: composite）として読めない`);
        return list;
      }
      if (!opened.has(uses)) {
        opened.add(uses);
        walkSecrets(action, uses, false);
      }
      return [...list, ...flatten(runs.steps, `${at} → ${uses}`, [...chain, uses])];
    });
  };
  const flat: Record<string, Flat[]> = Object.fromEntries(ids.map((id) => [id, flatten(jobs[id].steps, `jobs.${id}`, [])]));

  // Deploy の手順: production のジョブにだけ置き、固定の版の Wrangler を run で流す。token は env で受け、空なら止まる
  for (const id of ids)
    stepsOf(id).forEach((step, i) => {
      if (step.name !== DEPLOY_STEP) return;
      const where = `jobs.${id}.steps[${i}]（${DEPLOY_STEP}）`;
      if (!production.includes(id)) add('secrets', where, `${DEPLOY_STEP} の手順は、environment が production のジョブにだけ置く`);
      if (step.uses !== undefined)
        add('secrets', where, `${DEPLOY_STEP} の手順で、action（uses）に secret を渡さない（固定の版の Wrangler を run で流す）`);
      const env = isObj(step.env) ? step.env : {};
      if (
        env.CLOUDFLARE_API_TOKEN !== '${{ secrets.CLOUDFLARE_API_TOKEN }}' ||
        env.CLOUDFLARE_ACCOUNT_ID !== '${{ vars.CLOUDFLARE_ACCOUNT_ID }}'
      )
        add('secrets', where, 'token は env で受ける（CLOUDFLARE_API_TOKEN は secrets、CLOUDFLARE_ACCOUNT_ID は vars から）');
      const run = typeof step.run === 'string' ? step.run : '';
      if (!run.includes('-z "$CLOUDFLARE_API_TOKEN"') || !/\bexit 1\b/.test(run))
        add('secrets', where, 'token が空なら、何も出さずに止める（[ -z "$CLOUDFLARE_API_TOKEN" ] … exit 1）');
    });

  // ── production は main だけ
  for (const e of events)
    if (UNTRUSTED_EVENTS.includes(e))
      add('main', `on.${e}`, `${e} で動かさない（外からの PR の内容が、main の権限とキャッシュで動きうる）`);
  if (production.length)
    for (const e of events)
      if (!PRODUCTION_EVENTS.includes(e))
        add('main', `on.${e}`, `production のジョブがある workflow は、${PRODUCTION_EVENTS.join('・')} だけで動かす`);
  for (const id of production) {
    if (environmentOf(jobs[id]) !== PRODUCTION)
      add('main', `jobs.${id}.environment`, 'environment を式で決めない（production かどうかを確かめられない）');
    const parts = conjuncts(jobs[id].if);
    if (!parts) add('main', `jobs.${id}.if`, 'if が無いか、いちばん外に || がある（main 以外でも公開が動きうる）');
    else
      for (const need of MAIN_ONLY)
        if (!parts.includes(need)) add('main', `jobs.${id}.if`, `「${need}」を、いちばん外の && で入れる`);
  }

  // ── uses は SHA で固定（リポジトリの中の composite action と workflow は許す。composite の中も見る）
  for (const id of ids) {
    const uses = jobs[id].uses;
    if (typeof uses === 'string' && !uses.startsWith('./.github/workflows/'))
      add('pinned', `jobs.${id}.uses`, `${uses}: ほかのリポジトリの workflow を呼ばない`);
    for (const { step, where } of flat[id]) {
      if (step.uses === undefined) continue;
      const u = String(step.uses);
      if (!u.startsWith('./') && !PINNED.test(u)) add('pinned', where, `${u} を、40 桁の commit の SHA で固定する（版は注に書く）`);
    }
  }

  // ── 権限は読み取りだけ（書けるのは、毎日の確かめで Issue を開くジョブの issues: write だけ）
  if (JSON.stringify(wf.permissions) !== JSON.stringify({ contents: 'read' }))
    add('permissions', 'permissions', 'workflow の permissions は contents: read だけにする');
  for (const id of ids) {
    const p = jobs[id].permissions;
    if (p === undefined) continue;
    if (!isObj(p)) {
      add('permissions', `jobs.${id}.permissions`, 'read-all・write-all にしない（使う範囲だけを書く）');
      continue;
    }
    for (const [scope, level] of Object.entries(p)) {
      if (level === 'read' || level === 'none') continue;
      const opensIssues =
        scope === 'issues' &&
        level === 'write' &&
        events.length > 0 &&
        events.every((e) => WRITE_EVENTS.includes(e)) &&
        !production.includes(id) &&
        !flat[id].some(({ step }) => usesAction(step, 'actions/checkout'));
      if (!opensIssues)
        add(
          'permissions',
          `jobs.${id}.permissions.${scope}`,
          `${scope}: ${String(level)} にしない（書けるのは、schedule と workflow_dispatch で動く workflow の、リポジトリのコードを取らないジョブの issues: write だけ）`,
        );
    }
  }

  // ── checkout は認証を残さない
  for (const id of ids)
    for (const { step, where } of flat[id])
      if (usesAction(step, 'actions/checkout') && !(isObj(step.with) && isFalse(step.with['persist-credentials'])))
        add('credentials', where, 'actions/checkout には persist-credentials: false を付ける（あとの手順に GITHUB_TOKEN を残さない）');

  // ── インストール時スクリプトを動かさない
  for (const id of ids)
    for (const { step, where } of flat[id])
      if (typeof step.run === 'string') for (const problem of installProblems(step.run)) add('install', where, problem);

  // ── run に外から来る文字を埋め込まない（PR の題・branch の名前・commit の文などは env で受け、"$名前" で使う）
  for (const id of ids)
    for (const { step, where } of flat[id])
      if (typeof step.run === 'string')
        for (const m of step.run.matchAll(/\$\{\{([\s\S]*?)\}\}/g))
          if (/\bgithub\.(event|head_ref)\b/.test(m[1]))
            add('injection', where, `run に ${squash(m[0])} を埋め込まない（env で受けて "$名前" で使う）`);

  // ── 公開は前のジョブを待つ: 公開のあとに流すジョブのほかは、全部 needs で待つ。失敗を越えて動かない
  const upstream = (id: string, seen = new Set<string>()): Set<string> => {
    for (const n of needsOf(jobs[id]))
      if (!seen.has(n)) {
        seen.add(n);
        if (jobs[n]) upstream(n, seen);
      }
    return seen;
  };
  for (const id of production) {
    const up = upstream(id);
    const missing = ids.filter((j) => j !== id && !up.has(j) && !upstream(j).has(id));
    if (missing.length) add('needs', `jobs.${id}.needs`, `${missing.join('・')} を待っていない（needs に入れる）`);
    for (const n of up) {
      if (!jobs[n]) add('needs', `jobs.${id}.needs`, `${n} というジョブが無い`);
      else if (jobs[n]['continue-on-error'] !== undefined && !isFalse(jobs[n]['continue-on-error']))
        add('needs', `jobs.${n}.continue-on-error`, '公開が待つジョブに continue-on-error を付けない（失敗しても公開が動く）');
    }
    const condition = jobs[id].if;
    if (typeof condition === 'string' && /\b(always|failure|cancelled)\s*\(/.test(condition))
      add('needs', `jobs.${id}.if`, 'always()・failure()・cancelled() を使わない（前のジョブが失敗しても公開が動く）');
  }

  // ── 公開の前に点検する: Deploy の前に、secret の無い手順で、依存 → Worker の許可リスト → 公開物の点検（artifact なら一覧と照らす）
  for (const id of production) {
    const steps = flat[id];
    const where = `jobs.${id}`;
    const deploy = steps.findIndex(({ step, nested }) => !nested && step.name === DEPLOY_STEP);
    if (deploy < 0) {
      add('checked', where, `production のジョブに ${DEPLOY_STEP} の手順が無い`);
      continue;
    }
    const before = steps.slice(0, deploy);
    const runAt = (rx: RegExp) => before.findIndex(({ step }) => typeof step.run === 'string' && rx.test(step.run));
    const install = runAt(/\bnpm\s+ci\b[^\n]*--ignore-scripts/);
    const gen = runAt(/\bbun\s+scripts\/gen\.ts\b/);
    const delivery = runAt(/\bbun\s+scripts\/check_delivery\.ts\b/);
    if (install < 0) add('checked', where, `${DEPLOY_STEP} の前に、依存を npm ci --ignore-scripts で入れる`);
    if (gen < 0) add('checked', where, `${DEPLOY_STEP} の前に、secret の無い手順で Worker の許可リストを作る（bun scripts/gen.ts）`);
    else if (gen < install) add('checked', where, 'Worker の許可リストは、依存を入れたあとに作る');
    if (delivery < 0) add('checked', where, `${DEPLOY_STEP} の前に、公開物を点検する（bun scripts/check_delivery.ts）`);
    else if (delivery < gen) add('checked', where, '公開物の点検は、Worker の許可リストを作ったあとに流す');
    const download = before.findIndex(({ step }) => usesAction(step, 'actions/download-artifact'));
    if (download >= 0) {
      const verify = runAt(/\bbun\s+scripts\/dist_digest\.ts\s+verify\b/);
      if (verify < download)
        add('checked', where, '取った artifact は、build が出した一覧の sha256 と照らしてから出す（bun scripts/dist_digest.ts verify）');
      else if (verify < gen) add('checked', where, '一覧と照らすのは、Worker の許可リストを作ったあと（一覧に許可リストも入っている）');
    }
  }

  // ── 公開は 1 つずつ: 同じ group で並べ、途中で取り消さない（workflow の取り消しは PR の実行だけ）
  if (production.length) {
    const wc = wf.concurrency;
    const cancel = isObj(wc) ? wc['cancel-in-progress'] : undefined;
    if (cancel !== undefined && !isFalse(cancel) && !(typeof cancel === 'string' && squash(cancel) === CANCEL_ONLY_PR))
      add('serial', 'concurrency.cancel-in-progress', `取り消してよいのは PR の実行だけ（${CANCEL_ONLY_PR}）。main の公開を途中で止めない`);
    const group = (c: unknown) => (typeof c === 'string' ? c : isObj(c) ? c.group : undefined);
    const keeps = (c: unknown) =>
      typeof c === 'string' || (isObj(c) && (c['cancel-in-progress'] === undefined || isFalse(c['cancel-in-progress'])));
    for (const id of production) {
      const jc = jobs[id].concurrency;
      const serial =
        jc === undefined ? group(wc) === PRODUCTION_GROUP && keeps(wc) : group(jc) === PRODUCTION_GROUP && keeps(jc);
      if (!serial)
        add('serial', `jobs.${id}.concurrency`, `公開は concurrency の group「${PRODUCTION_GROUP}」で 1 つずつ流し、取り消さない`);
    }
  }

  // ── 公開のジョブはキャッシュを使わない: ほかの実行が書いたもの（実行ファイル）を、secret のあるジョブで動かさない
  for (const id of production)
    for (const { step, where } of flat[id]) {
      const w = isObj(step.with) ? step.with : {};
      if (usesAction(step, 'actions/cache')) add('noCache', where, 'actions/cache を使わない');
      if (usesAction(step, 'actions/setup-node') && (!isFalse(w['package-manager-cache']) || w.cache !== undefined))
        add('noCache', where, 'setup-node は package-manager-cache: false にし、cache を書かない');
      if (usesAction(step, 'oven-sh/setup-bun') && !isTrue(w['no-cache'])) add('noCache', where, 'setup-bun は no-cache: true にする');
      if (usesAction(step, 'astral-sh/setup-uv') && !isFalse(w['enable-cache']))
        add('noCache', where, 'setup-uv は enable-cache: false にする');
    }

  return out;
}

const formatFindings = (findings: WorkflowFinding[]) =>
  `公開の手順（GitHub Actions）が、守る性質を破っている（docs/operations/ci.md の「点検する性質」）:\n${findings
    .map((f) => `  [${f.rule}] ${f.where}: ${f.what}`)
    .join('\n')}`;

/** workflow が性質を 1 つでも破っていれば、破ったところを全部並べて止める */
export function validateWorkflow(value: unknown, opts: { file?: string; loadAction?: LoadAction } = {}) {
  const findings = workflowFindings(value, opts);
  if (findings.length) throw new Error(formatFindings(findings));
}

/** SHA で固定した uses の行に、版の注（# v1.2.3）があるか（人が版を読むため。Dependabot も注を書き換える） */
export const pinNoteFindings = (text: string, file: string): WorkflowFinding[] =>
  text.split('\n').flatMap((line, i) => {
    const m = /^\s*(?:-\s+)?uses:\s*['"]?([^\s'"#]+)['"]?\s*(#.*)?$/.exec(line);
    if (!m || !/@[0-9a-f]{40}$/.test(m[1]) || (m[2] && /#\s*v?\d+(\.\d+)*\b/.test(m[2]))) return [];
    return [
      { rule: WORKFLOW_RULES.pinned, where: `${file}:${i + 1}`, what: `${m[1].split('@')[0]} の SHA の横に、版の注（# v1.2.3）を書く` },
    ];
  });

/** .github/workflows/ の全部の workflow の性質と、workflow と .github/actions/ の版の注を確かめる。確かめた workflow の数を返す */
export function validateWorkflows(root = ROOT): number {
  const dir = path.join(root, '.github/workflows');
  const files = readdirSync(dir)
    .filter((f) => /\.ya?ml$/.test(f))
    .sort();
  const load = actionLoader(root);
  const findings = files.flatMap((f) => {
    const text = readFileSync(path.join(dir, f), 'utf8');
    return [...workflowFindings(Bun.YAML.parse(text), { file: f, loadAction: load }), ...pinNoteFindings(text, f)];
  });
  const actions = path.join(root, '.github/actions');
  for (const name of existsSync(actions) ? readdirSync(actions).sort() : [])
    for (const base of ['action.yml', 'action.yaml']) {
      const file = path.join(actions, name, base);
      if (existsSync(file)) findings.push(...pinNoteFindings(readFileSync(file, 'utf8'), `.github/actions/${name}/${base}`));
    }
  if (findings.length) throw new Error(formatFindings(findings));
  return files.length;
}

/* ───────────── 組み立てた静的公開物 ───────────── */

export function checkArtifact(dir: string) {
  let count = 0;
  const findings: Parameters<typeof checkSecrets>[2] = [];
  const inspect = (folder: string) => {
    for (const f of readdirSync(folder, { withFileTypes: true })) {
      const file = path.join(folder, f.name);
      if (f.isSymbolicLink() || /^(\.env(?:\..*)?|\.dev\.vars(?:\..*)?|.*\.(pem|key|local))$/.test(f.name)) throw new Error('公開物にローカル設定か認証ファイルがあります。');
      if (f.isDirectory()) { inspect(file); continue; }
      if (f.name.endsWith('.mp4') || statSync(file).size > WORKERS_ASSET_MAX_BYTES) throw new Error('静的公開物に動画か大きすぎるファイルがあります。');
      count++;
      if (!/\.(png|jpg|jpeg|webp|ico)$/.test(f.name)) checkSecrets(readFileSync(file, 'utf8'), file, findings);
    }
  };
  inspect(dir);
  if (count > WORKERS_MAX_ASSETS || findings.length) throw new Error('公開物の件数か機密情報の点検に失敗しました。値は表示しません。');
  return count;
}

if (import.meta.main) {
  const workflows = validateWorkflows(ROOT);
  validateWorkerConfig(readWranglerConfig());
  // 期限を過ぎた retained は、公開を止めずに知らせる（media.ts check と同じ文）。
  const manifest = readMediaManifest();
  for (const message of retainedWarnings(manifest)) {
    console.warn(process.env.GITHUB_ACTIONS === 'true' ? `::warning::${message}` : `警告: ${message}`);
  }
  // Worker の許可リストは、講座ごとの動画の一覧をつないだものと同じでなければ公開しない（古いまま配らない）
  const worker = path.join(ROOT, 'worker/src/generated/media-manifest.json');
  if (existsSync(worker) && readFileSync(worker, 'utf8') !== mediaManifestJson(manifest)) throw new Error('Worker の許可リスト（worker/src/generated/media-manifest.json）が、講座ごとの動画の一覧と違います。npm run gen で作り直してください。');
  if (!existsSync(worker)) console.log('Worker の許可リストはまだ無い（wrangler の前に npm run gen が作る）。');
  const dir = path.resolve(process.argv[2] ?? path.join(ROOT, 'site/dist'));
  console.log(`公開の手順（workflow ${workflows} 本）の性質と、静的公開物 ${checkArtifact(dir)} files を確認。機密情報・MP4の混入なし。`);
}
