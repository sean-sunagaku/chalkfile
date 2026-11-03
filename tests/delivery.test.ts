import { describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { migrationHtml, migrationUrl } from '../scripts/build_migration';
import {
  actionLoader,
  checkArtifact,
  conjuncts,
  installProblems,
  type LoadAction,
  parseJsoncText,
  pinNoteFindings,
  readWranglerConfig,
  validateWorkerConfig,
  validateWorkflow,
  validateWorkflows,
  WORKFLOW_RULES,
  type WorkflowRule,
  workflowFindings,
} from '../scripts/check_delivery';

type WranglerConfig = { assets: Record<string, unknown>; observability?: unknown; [key: string]: unknown };
test('Workerを先に通すのは/media/だけで、静的404もassetsに任せる', () => {
  const value = readWranglerConfig() as WranglerConfig;
  expect(() => validateWorkerConfig(value)).not.toThrow();
  for (const first of [true, ['/*'], ['/media/*', '/api/*']]) {
    expect(() => validateWorkerConfig({ ...value, assets: { ...value.assets, run_worker_first: first } })).toThrow();
  }
});
test('Workers Logs を切らない', () => {
  const value = readWranglerConfig() as WranglerConfig;
  expect(value.observability).toEqual({ enabled: true });
  for (const observability of [undefined, { enabled: false }, { enabled: true, logs: { enabled: false } }]) {
    expect(() => validateWorkerConfig({ ...value, observability })).toThrow();
  }
  expect(() => validateWorkerConfig({ ...value, observability: { logs: { enabled: true } } })).not.toThrow();
});
test('wrangler.jsonc は JSONC として読む（コメントと末尾のカンマを許し、壊れていれば止まる）', () => {
  const text = readFileSync('wrangler.jsonc', 'utf8');
  const commented = text.replace('{', '{\n  // コメントを書いてもよい\n').replace(/\n}\s*$/, ',\n}\n');
  expect(commented).not.toBe(text);
  expect(parseJsoncText(commented)).toEqual(readWranglerConfig());
  expect(() => validateWorkerConfig(parseJsoncText(commented))).not.toThrow();
  expect(() => parseJsoncText('{ "name": "chalkfile", "assets": ')).toThrow(/JSONC/);
});

/* ───────────── 公開の手順（GitHub Actions）の性質 ───────────── */

type Step = {
  name?: string;
  uses?: string;
  run?: string;
  shell?: string;
  if?: string;
  with?: Record<string, unknown>;
  env?: Record<string, unknown>;
};
type Job = {
  needs?: string | string[];
  if?: string;
  environment?: string | { name?: string; url?: string };
  permissions?: unknown;
  concurrency?: unknown;
  steps: Step[];
  [key: string]: unknown;
};
type Workflow = { on: unknown; permissions?: unknown; concurrency?: unknown; env?: unknown; jobs: Record<string, Job> };

const DIR = '.github/workflows';
const FILES = readdirSync(DIR)
  .filter((f) => /\.ya?ml$/.test(f))
  .sort();
const read = (file: string) => Bun.YAML.parse(readFileSync(path.join(DIR, file), 'utf8')) as Workflow;
const repoActions = actionLoader(path.resolve('.'));
const rulesOf = (value: unknown, file: string, loadAction: LoadAction = repoActions) =>
  workflowFindings(value, { file, loadAction }).map((f) => f.rule);

const SHA = 'a'.repeat(40);
// 文書の点検（scripts/check_docs.ts）の古い言葉に当たらないよう、分けて書く
const NPM_INSTALL = ['npm', 'install'].join(' ');
const SECRET = '${{ secrets.CLOUDFLARE_API_TOKEN }}';
const isProd = (job: Job) =>
  (typeof job.environment === 'string' ? job.environment : job.environment?.name) === 'production';
const prodId = (v: Workflow) => Object.keys(v.jobs).find((id) => isProd(v.jobs[id])) as string;
const prod = (v: Workflow) => v.jobs[prodId(v)];
const deployStep = (v: Workflow) => prod(v).steps.find((s) => s.name === 'Deploy') as Step;
const needsOf = (job: Job | undefined) => [job?.needs ?? []].flat();
const stepRunning = (steps: Step[], rx: RegExp) => steps.find((s) => rx.test(s.run ?? '')) as Step;
const indexRunning = (steps: Step[], rx: RegExp) => steps.findIndex((s) => rx.test(s.run ?? ''));
const stepUsing = (steps: Step[], action: string) => steps.find((s) => s.uses?.startsWith(`${action}@`)) as Step;
const upstream = (v: Workflow, id: string, seen = new Set<string>()): Set<string> => {
  for (const n of needsOf(v.jobs[id]))
    if (!seen.has(n)) {
      seen.add(n);
      upstream(v, n, seen);
    }
  return seen;
};
/** 公開が直に待つジョブのうち、ほかに待つジョブがたどらないもの（外すと、待たないジョブになる） */
const leaves = (v: Workflow) =>
  needsOf(prod(v)).filter((n) => !needsOf(prod(v)).some((m) => m !== n && upstream(v, m).has(n)));
const hasNeeds = (v: Workflow) => needsOf(prod(v)).length > 0;
const hasDownload = (v: Workflow) => prod(v).steps.some((s) => s.uses?.startsWith('actions/download-artifact@'));
const PRODUCTION_FILES = FILES.filter((f) => Object.values(read(f).jobs).some(isProd));

test('リポジトリの workflow は全部、公開の性質を守っている', () => {
  expect(FILES.length).toBeGreaterThan(0);
  expect(PRODUCTION_FILES.length).toBeGreaterThan(0);
  for (const file of FILES) expect(workflowFindings(read(file), { file, loadAction: repoActions })).toEqual([]);
  expect(() => validateWorkflows()).not.toThrow();
  for (const file of FILES) expect(() => validateWorkflow(read(file), { file })).not.toThrow();
});

type Case = { rule: WorkflowRule; name: string; applies?: (v: Workflow) => boolean; mutate: (v: Workflow) => void };
/** 性質を破る直し。公開の手順のある workflow の全部に当てて、その性質の名前で止まるかを見る */
const BREAKS: Case[] = [
  // secret は Deploy の手順だけ
  {
    rule: 'secrets',
    name: 'workflow の env で secret を読む',
    mutate: (v) => {
      v.env = { TOKEN: SECRET };
    },
  },
  {
    rule: 'secrets',
    name: 'ジョブの env で secret を読む',
    mutate: (v) => {
      prod(v).env = { TOKEN: SECRET };
    },
  },
  {
    rule: 'secrets',
    name: '依存を入れる手順に secret を渡す',
    mutate: (v) => {
      stepRunning(prod(v).steps, /npm ci/).env = { TOKEN: SECRET };
    },
  },
  {
    rule: 'secrets',
    name: 'checkout の with に secret を渡す',
    mutate: (v) => {
      Object.assign(stepUsing(prod(v).steps, 'actions/checkout').with ?? {}, { token: SECRET });
    },
  },
  {
    rule: 'secrets',
    name: '手順の if で secret を読む',
    mutate: (v) => {
      stepRunning(prod(v).steps, /npm ci/).if = "secrets.CLOUDFLARE_API_TOKEN != ''";
    },
  },
  {
    rule: 'secrets',
    name: 'Deploy の run に secret を埋め込む',
    mutate: (v) => {
      deployStep(v).run += `\necho ${SECRET}`;
    },
  },
  {
    rule: 'secrets',
    name: 'Deploy の名前を変える',
    mutate: (v) => {
      deployStep(v).name = 'Publish';
    },
  },
  {
    rule: 'secrets',
    name: 'production の environment を外す',
    mutate: (v) => {
      delete prod(v).environment;
    },
  },
  {
    rule: 'secrets',
    name: 'Deploy を action にして secret を渡す',
    mutate: (v) => {
      Object.assign(deployStep(v), { uses: `cloudflare/wrangler-action@${SHA}`, with: { apiToken: SECRET } });
    },
  },
  {
    rule: 'secrets',
    name: 'token が空でも止まらない',
    mutate: (v) => {
      deployStep(v).run = String(deployStep(v).run).replaceAll('exit 1', 'true');
    },
  },
  {
    rule: 'secrets',
    name: 'account ID を vars から受けない',
    mutate: (v) => {
      Object.assign(deployStep(v).env ?? {}, { CLOUDFLARE_ACCOUNT_ID: 'x' });
    },
  },
  {
    rule: 'secrets',
    name: '呼ぶ workflow に secret を渡す',
    mutate: (v) => {
      prod(v).secrets = 'inherit';
    },
  },
  {
    rule: 'secrets',
    name: 'production でないジョブに Deploy を写す',
    mutate: (v) => {
      v.jobs.copy = { 'runs-on': 'ubuntu-latest', steps: [structuredClone(deployStep(v))] };
    },
  },
  // production は main だけ
  {
    rule: 'main',
    name: 'main の条件を外す',
    mutate: (v) => {
      prod(v).if = String(prod(v).if).replace("github.ref == 'refs/heads/main'", "github.ref != ''");
    },
  },
  {
    rule: 'main',
    name: 'リポジトリの条件を外す',
    mutate: (v) => {
      prod(v).if = String(prod(v).if).replace("github.repository == 'sean-sunagaku/chalkfile'", 'true');
    },
  },
  {
    rule: 'main',
    name: '|| で、ほかの条件でも通す',
    mutate: (v) => {
      prod(v).if += " || github.event_name == 'push'";
    },
  },
  {
    rule: 'main',
    name: 'if を外す',
    mutate: (v) => {
      delete prod(v).if;
    },
  },
  {
    rule: 'main',
    name: 'pull_request_target で動かす',
    mutate: (v) => {
      v.on = { ...(v.on as object), pull_request_target: null };
    },
  },
  {
    rule: 'main',
    name: 'schedule で動かす',
    mutate: (v) => {
      v.on = { ...(v.on as object), schedule: [{ cron: '17 3 * * *' }] };
    },
  },
  {
    rule: 'main',
    name: 'environment を式で決める',
    mutate: (v) => {
      prod(v).environment = { name: '${{ inputs.target }}' };
    },
  },
  // uses は SHA で固定
  {
    rule: 'pinned',
    name: 'checkout を版の名前で指す',
    mutate: (v) => {
      stepUsing(prod(v).steps, 'actions/checkout').uses = 'actions/checkout@v7';
    },
  },
  {
    rule: 'pinned',
    name: 'checkout を branch で指す',
    mutate: (v) => {
      stepUsing(prod(v).steps, 'actions/checkout').uses = 'actions/checkout@main';
    },
  },
  {
    rule: 'pinned',
    name: 'docker の image を使う',
    mutate: (v) => {
      prod(v).steps.splice(1, 0, { uses: 'docker://alpine:3' });
    },
  },
  {
    rule: 'pinned',
    name: '無い composite action を呼ぶ',
    mutate: (v) => {
      prod(v).steps.splice(1, 0, { uses: './.github/actions/missing' });
    },
  },
  {
    rule: 'pinned',
    name: 'リポジトリの外を指す',
    mutate: (v) => {
      prod(v).steps.splice(1, 0, { uses: './../outside' });
    },
  },
  {
    rule: 'pinned',
    name: 'ほかのリポジトリの workflow を呼ぶ',
    mutate: (v) => {
      v.jobs.call = { uses: 'someone/else/.github/workflows/x.yml@v1', steps: [] };
    },
  },
  // 権限は読み取りだけ
  {
    rule: 'permissions',
    name: 'contents: write',
    mutate: (v) => {
      v.permissions = { contents: 'write' };
    },
  },
  {
    rule: 'permissions',
    name: 'workflow の permissions を外す',
    mutate: (v) => {
      delete v.permissions;
    },
  },
  {
    rule: 'permissions',
    name: 'write-all',
    mutate: (v) => {
      v.permissions = 'write-all';
    },
  },
  {
    rule: 'permissions',
    name: 'PR に書ける',
    mutate: (v) => {
      prod(v).permissions = { 'pull-requests': 'write' };
    },
  },
  {
    rule: 'permissions',
    name: 'OIDC の token を出せる',
    mutate: (v) => {
      prod(v).permissions = { 'id-token': 'write' };
    },
  },
  {
    rule: 'permissions',
    name: '公開のジョブで Issue に書ける',
    mutate: (v) => {
      prod(v).permissions = { issues: 'write' };
    },
  },
  // checkout は認証を残さない
  {
    rule: 'credentials',
    name: 'persist-credentials: true',
    mutate: (v) => {
      Object.assign(stepUsing(prod(v).steps, 'actions/checkout').with ?? {}, { 'persist-credentials': true });
    },
  },
  {
    rule: 'credentials',
    name: 'persist-credentials を書かない',
    mutate: (v) => {
      delete stepUsing(prod(v).steps, 'actions/checkout').with;
    },
  },
  // インストール時スクリプトを動かさない
  {
    rule: 'install',
    name: '--ignore-scripts を外す',
    mutate: (v) => {
      const step = stepRunning(prod(v).steps, /npm ci --ignore-scripts/);
      step.run = String(step.run).replace(' --ignore-scripts', '');
    },
  },
  {
    rule: 'install',
    name: NPM_INSTALL,
    mutate: (v) => {
      prod(v).steps.splice(1, 0, { run: NPM_INSTALL });
    },
  },
  {
    rule: 'install',
    name: 'npx に --no-install を付けない',
    mutate: (v) => {
      prod(v).steps.splice(1, 0, { run: 'npx wrangler --version' });
    },
  },
  {
    rule: 'install',
    name: 'bunx',
    mutate: (v) => {
      prod(v).steps.splice(1, 0, { run: 'bunx wrangler --version' });
    },
  },
  // run に外から来る文字を埋め込まない
  {
    rule: 'injection',
    name: 'commit の文を run に埋め込む',
    mutate: (v) => {
      prod(v).steps.splice(1, 0, { run: 'echo "${{ github.event.head_commit.message }}"' });
    },
  },
  {
    rule: 'injection',
    name: 'branch の名前を run に埋め込む',
    mutate: (v) => {
      prod(v).steps.splice(1, 0, { run: 'echo ${{ github.head_ref }}' });
    },
  },
  // 公開は前のジョブを待つ
  {
    rule: 'needs',
    name: '待たないジョブを足す',
    mutate: (v) => {
      v.jobs.lint = { 'runs-on': 'ubuntu-latest', steps: [{ run: 'echo lint' }] };
    },
  },
  {
    rule: 'needs',
    name: 'always() で失敗を越える',
    mutate: (v) => {
      prod(v).if = `always() && ${prod(v).if}`;
    },
  },
  {
    rule: 'needs',
    name: '!cancelled() で失敗を越える',
    mutate: (v) => {
      prod(v).if = `\${{ !cancelled() && ${prod(v).if} }}`;
    },
  },
  {
    rule: 'needs',
    name: '無いジョブを待つ',
    mutate: (v) => {
      prod(v).needs = [...needsOf(prod(v)), 'ghost'];
    },
  },
  {
    rule: 'needs',
    name: '待つジョブを 1 つ外す',
    applies: hasNeeds,
    mutate: (v) => {
      prod(v).needs = needsOf(prod(v)).filter((n) => n !== leaves(v)[0]);
    },
  },
  {
    rule: 'needs',
    name: '待つジョブの失敗を見逃す',
    applies: hasNeeds,
    mutate: (v) => {
      v.jobs[leaves(v)[0]]['continue-on-error'] = true;
    },
  },
  // 公開の前に点検する
  {
    rule: 'checked',
    name: 'Worker の許可リストを作らない',
    mutate: (v) => {
      prod(v).steps = prod(v).steps.filter((s) => !/bun scripts\/gen\.ts/.test(s.run ?? ''));
    },
  },
  {
    rule: 'checked',
    name: 'Worker の許可リストを Deploy のあとで作る',
    mutate: (v) => {
      const steps = prod(v).steps;
      steps.push(...steps.splice(indexRunning(steps, /bun scripts\/gen\.ts/), 1));
    },
  },
  {
    rule: 'checked',
    name: '公開物を点検しない',
    mutate: (v) => {
      for (const s of prod(v).steps) if (s.run) s.run = s.run.replace(/^.*bun scripts\/check_delivery\.ts.*$/m, 'true');
    },
  },
  {
    rule: 'checked',
    name: '依存を入れない',
    mutate: (v) => {
      prod(v).steps = prod(v).steps.filter((s) => !/npm ci/.test(s.run ?? ''));
    },
  },
  {
    rule: 'checked',
    name: '手順を逆に並べる',
    mutate: (v) => {
      prod(v).steps.reverse();
    },
  },
  {
    rule: 'checked',
    name: '取った artifact を照らさない',
    applies: hasDownload,
    mutate: (v) => {
      prod(v).steps = prod(v).steps.filter((s) => !/dist_digest\.ts verify/.test(s.run ?? ''));
    },
  },
  {
    rule: 'checked',
    name: 'artifact を取る前に照らす',
    applies: hasDownload,
    mutate: (v) => {
      const steps = prod(v).steps;
      steps.splice(1, 0, ...steps.splice(indexRunning(steps, /dist_digest\.ts verify/), 1));
    },
  },
  // 公開は 1 つずつ
  {
    rule: 'serial',
    name: '公開を途中で取り消せる',
    mutate: (v) => {
      const job = prod(v);
      const target = (job.concurrency ?? v.concurrency) as Record<string, unknown>;
      target['cancel-in-progress'] = true;
    },
  },
  {
    rule: 'serial',
    name: '並びを外す',
    mutate: (v) => {
      delete prod(v).concurrency;
      delete v.concurrency;
    },
  },
  {
    rule: 'serial',
    name: 'ほかの group で並べる',
    mutate: (v) => {
      prod(v).concurrency = { group: 'elsewhere', 'cancel-in-progress': false };
    },
  },
  {
    rule: 'serial',
    name: 'workflow の実行をいつも取り消す',
    mutate: (v) => {
      v.concurrency = { group: 'any', ...(v.concurrency as object), 'cancel-in-progress': true };
    },
  },
  // 公開のジョブはキャッシュを使わない
  {
    rule: 'noCache',
    name: 'actions/cache を戻す',
    mutate: (v) => {
      prod(v).steps.splice(1, 0, { uses: `actions/cache@${SHA}`, with: { path: 'x', key: 'y' } });
    },
  },
  {
    rule: 'noCache',
    name: 'actions/cache/restore を戻す',
    mutate: (v) => {
      prod(v).steps.splice(1, 0, { uses: `actions/cache/restore@${SHA}`, with: { path: 'x', key: 'y' } });
    },
  },
  {
    rule: 'noCache',
    name: 'bun の実行ファイルをキャッシュから戻す',
    mutate: (v) => {
      delete stepUsing(prod(v).steps, 'oven-sh/setup-bun').with?.['no-cache'];
    },
  },
  {
    rule: 'noCache',
    name: 'npm のキャッシュを使う',
    mutate: (v) => {
      Object.assign(stepUsing(prod(v).steps, 'actions/setup-node').with ?? {}, { cache: 'npm' });
    },
  },
  {
    rule: 'noCache',
    name: 'package-manager-cache を書かない',
    mutate: (v) => {
      delete stepUsing(prod(v).steps, 'actions/setup-node').with?.['package-manager-cache'];
    },
  },
  {
    rule: 'noCache',
    name: 'キャッシュを使う composite action で依存を入れる',
    applies: () => existsSync('.github/actions/setup/action.yml'),
    mutate: (v) => {
      const job = prod(v);
      const own = (s: Step) =>
        s.uses?.startsWith('actions/setup-node@') ||
        s.uses?.startsWith('oven-sh/setup-bun@') ||
        /^npm ci/.test(s.run ?? '');
      job.steps = job.steps.filter((s) => !own(s));
      job.steps.splice(1, 0, { uses: './.github/actions/setup' });
    },
  },
];

/** 形だけを変える直し（性質は守る）。どれも止まらない */
const KEEPS: Omit<Case, 'rule'>[] = [
  {
    name: 'ジョブの並びを逆にする',
    mutate: (v) => {
      v.jobs = Object.fromEntries(Object.entries(v.jobs).reverse());
    },
  },
  {
    name: 'Deploy でない手順の名前を変える',
    mutate: (v) => {
      for (const job of Object.values(v.jobs))
        for (const s of job.steps ?? []) if (s.name && s.name !== 'Deploy') s.name += '（改名）';
    },
  },
  {
    name: '公開の前に手順を足す',
    mutate: (v) => {
      prod(v).steps.splice(1, 0, { name: 'メモ', run: 'echo hello' });
    },
  },
  {
    name: '公開のあとに流すジョブを足す',
    mutate: (v) => {
      v.jobs.after = { needs: prodId(v), 'runs-on': 'ubuntu-latest', steps: [{ run: 'echo done' }] };
    },
  },
  {
    name: '公開が待つジョブを足す',
    mutate: (v) => {
      v.jobs.extra = { 'runs-on': 'ubuntu-latest', steps: [{ run: 'echo extra' }] };
      prod(v).needs = [...needsOf(prod(v)), 'extra'];
    },
  },
  {
    name: '待つジョブを、needs をたどって待つ形にする',
    applies: hasNeeds,
    mutate: (v) => {
      prod(v).needs = leaves(v);
    },
  },
  {
    name: 'if を ${{ }} と括弧で囲む',
    mutate: (v) => {
      prod(v).if = `\${{ ( ${prod(v).if} ) }}`;
    },
  },
];

describe('公開の性質を 1 つ破ると、その性質の名前で止まる', () => {
  for (const file of PRODUCTION_FILES)
    for (const c of BREAKS) {
      if (c.applies && !c.applies(read(file))) continue;
      test(`${file}: ${c.name} → 「${WORKFLOW_RULES[c.rule]}」`, () => {
        const value = read(file);
        c.mutate(value);
        expect(rulesOf(value, file)).toContain(WORKFLOW_RULES[c.rule]);
        expect(() => validateWorkflow(value, { file })).toThrow(WORKFLOW_RULES[c.rule]);
      });
    }
});
describe('形だけを変えても、性質を守っていれば通る', () => {
  for (const file of PRODUCTION_FILES)
    for (const c of KEEPS) {
      if (c.applies && !c.applies(read(file))) continue;
      test(`${file}: ${c.name}`, () => {
        const value = read(file);
        c.mutate(value);
        expect(workflowFindings(value, { file, loadAction: repoActions })).toEqual([]);
      });
    }
});

describe('書く権限は、毎日の確かめで Issue を開くジョブだけ', () => {
  const daily = (): Workflow => ({
    on: { schedule: [{ cron: '17 3 * * *' }], workflow_dispatch: null },
    permissions: { contents: 'read' },
    jobs: {
      check: {
        'runs-on': 'ubuntu-latest',
        steps: [{ uses: `actions/checkout@${SHA}`, with: { 'persist-credentials': false } }, { run: 'echo check' }],
      },
      report: {
        needs: 'check',
        if: 'failure()',
        'runs-on': 'ubuntu-latest',
        permissions: { issues: 'write' },
        steps: [{ run: 'gh issue list --state open' }],
      },
    },
  });
  test('schedule と workflow_dispatch で動き、コードを取らないジョブの issues: write は通る', () => {
    expect(rulesOf(daily(), 'daily.yml')).toEqual([]);
  });
  const broken: [string, (v: Workflow) => void][] = [
    [
      'push でも動く',
      (v) => {
        v.on = { ...(v.on as object), push: { branches: ['main'] } };
      },
    ],
    [
      'PR でも動く',
      (v) => {
        v.on = { ...(v.on as object), pull_request: null };
      },
    ],
    [
      'Issue を開くジョブがコードを取る',
      (v) => {
        v.jobs.report.steps.unshift({ uses: `actions/checkout@${SHA}`, with: { 'persist-credentials': false } });
      },
    ],
    [
      'contents: write',
      (v) => {
        v.jobs.report.permissions = { issues: 'write', contents: 'write' };
      },
    ],
    [
      'actions: write',
      (v) => {
        v.jobs.report.permissions = { actions: 'write' };
      },
    ],
  ];
  for (const [name, mutate] of broken)
    test(name, () => {
      const value = daily();
      mutate(value);
      expect(rulesOf(value, 'daily.yml')).toContain(WORKFLOW_RULES.permissions);
    });
});

describe('リポジトリの中の composite action は、中の手順まで同じ性質で見る', () => {
  const workflow = (): Workflow => ({
    on: { pull_request: null },
    permissions: { contents: 'read' },
    jobs: {
      check: {
        'runs-on': 'ubuntu-latest',
        steps: [
          { uses: `actions/checkout@${SHA}`, with: { 'persist-credentials': false } },
          { uses: './.github/actions/x' },
        ],
      },
    },
  });
  const composite =
    (...steps: Step[]): LoadAction =>
    () => ({ runs: { using: 'composite', steps } });
  test('中の手順が性質を守っていれば通る', () => {
    const good = composite({ uses: `actions/setup-node@${SHA}` }, { run: 'npm ci --ignore-scripts', shell: 'bash' });
    expect(rulesOf(workflow(), 'x.yml', good)).toEqual([]);
  });
  const broken: [WorkflowRule, string, LoadAction][] = [
    ['pinned', '中で版の名前を使う', composite({ uses: 'actions/setup-node@v7' })],
    ['install', '中で --ignore-scripts を付けない', composite({ run: 'npm ci', shell: 'bash' })],
    ['credentials', '中で認証を残す', composite({ uses: `actions/checkout@${SHA}` })],
    ['secrets', '中で secret を読む', composite({ run: `echo ${SECRET}`, shell: 'bash' })],
    [
      'injection',
      '中で外から来る文字を埋め込む',
      composite({ run: 'echo ${{ github.event.pull_request.title }}', shell: 'bash' }),
    ],
    ['pinned', 'composite でない action', () => ({ runs: { using: 'node24', main: 'index.js' } })],
    ['pinned', '無い action', () => null],
    ['pinned', '自分を呼ぶ', composite({ uses: './.github/actions/x' })],
  ];
  for (const [rule, name, loadAction] of broken)
    test(`${name} → 「${WORKFLOW_RULES[rule]}」`, () =>
      expect(rulesOf(workflow(), 'x.yml', loadAction)).toContain(WORKFLOW_RULES[rule]));
});

test('SHA で固定した uses の横には、版の注を書く', () => {
  for (const file of FILES) expect(pinNoteFindings(readFileSync(path.join(DIR, file), 'utf8'), file)).toEqual([]);
  const text = `      - uses: actions/checkout@${SHA} # v7.0.1\n      - uses: actions/setup-node@${SHA}\n      - uses: ./.github/actions/setup\n`;
  expect(pinNoteFindings(text, 'x.yml').map((f) => f.where)).toEqual(['x.yml:2']);
});

test('式は、いちばん外の && で分け、いちばん外の || は通さない', () => {
  expect(conjuncts("github.repository == 'o/r' && github.ref == 'refs/heads/main'")).toEqual([
    "github.repository == 'o/r'",
    "github.ref == 'refs/heads/main'",
  ]);
  expect(conjuncts("${{ (a == 'x && y') && (b || c) }}")).toEqual(["a == 'x && y'", 'b || c']);
  expect(conjuncts("((a)) && ( b  ==  'it''s' )")).toEqual(['a', "b == 'it''s'"]);
  expect(conjuncts('a && b || c')).toBeNull();
  expect(conjuncts('(a && b) || c')).toBeNull();
  expect(conjuncts(undefined)).toBeNull();
});

test('依存のインストール時スクリプトを動かしうる書き方を見つける', () => {
  for (const ok of [
    'npm ci --ignore-scripts',
    'npm ci --ignore-scripts && npm run lint',
    'npx --no-install wrangler deploy',
    'npm run test:e2e:ci --if-present',
    'bun scripts/gen.ts --media',
    'npm test',
  ])
    expect(installProblems(ok)).toEqual([]);
  for (const bad of [
    'npm ci',
    'npm ci && echo --ignore-scripts',
    NPM_INSTALL,
    'npm i -D x',
    'npm exec wrangler',
    'npx wrangler',
    'npx -y wrangler',
    'bunx wrangler',
    'bun install',
    'bun add x',
  ])
    expect(installProblems(bad).length).toBeGreaterThan(0);
});

test('公開物から機密情報・認証ファイル・MP4を拒否し、値をエラーに出さない', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'chalkfile-delivery-'));
  try {
    writeFileSync(path.join(dir, 'index.html'), '<h1>Chalkfile</h1>');
    expect(checkArtifact(dir)).toBe(1);
    const synthetic = ['ghp', 'X'.repeat(36)].join('_');
    for (const content of [synthetic, `CLOUDFLARE_API_TOKEN: '${'X'.repeat(40)}'`]) {
      writeFileSync(path.join(dir, 'private.txt'), content);
      expect(() => checkArtifact(dir)).toThrow();
      try {
        checkArtifact(dir);
      } catch (error) {
        expect(String(error)).not.toContain(content);
      }
    }
    rmSync(path.join(dir, 'private.txt'));
    for (const name of ['.env', '.dev.vars', 'video.mp4']) {
      writeFileSync(path.join(dir, name), 'test');
      expect(() => checkArtifact(dir)).toThrow();
      rmSync(path.join(dir, name));
    }
    mkdirSync(path.join(dir, 'nested'));
    writeFileSync(path.join(dir, 'nested/private.key'), 'test');
    expect(() => checkArtifact(dir)).toThrow();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('旧URLのパス・query・hashを保持し、移行先originは固定する', () => {
  expect(migrationUrl('/chalkfile/nudge-product/?from=old#N01')).toBe(
    'https://chalkfile.com/nudge-product/?from=old#N01',
  );
  expect(migrationUrl('/chalkfile///evil.example/path?url=https://elsewhere.example/#section')).toBe(
    'https://chalkfile.com/evil.example/path?url=https://elsewhere.example/#section',
  );
  const html = migrationHtml('nudge-product/');
  expect(html).toContain('<link rel="canonical" href="https://chalkfile.com/nudge-product/">');
  expect(html).toContain('http-equiv="refresh"');
  const script = /<script>([\s\S]+)<\/script>/.exec(html)![1];
  expect(() => new Function(script)).not.toThrow();
  expect(script).toContain('next.search=location.search;next.hash=location.hash;');
});
