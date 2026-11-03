// 公式cf CLIの認可後、API tokenをプロセス内だけで扱い、ghの標準入力へ直接渡す。
// planは読取/変更とも行わない。applyは本人が許可した初回登録とmainの公開を実行する。
const ACCOUNT = '1771bd0a5ec29834c0c8714ffe808889';
const REPOSITORY = 'sean-sunagaku/chalkfile';
const PROFILE = 'chalkfile-ci-bootstrap';
// cf は初回の登録で 1 度だけ使うので package.json に入れず、実行のときに npm exec で取ってくる。
// 版はここで完全に固定し、インストール時スクリプトは動かさない（下の cf() の --ignore-scripts）
const CF_VERSION = '1.0.0-beta.26';
const SECRET_NAME = 'CLOUDFLARE_API_TOKEN';
let stage = '引数確認';
type Group = { id: string; name: string; scopes: string[]; is_selectable?: boolean };
type Run = (args: string[], stdin?: string) => Promise<{ code: number; stdout: string }>;
const required = ['Workers Editor', 'Workers Routes Write', 'Zone Read'];

export function tokenPolicies(groups: Group[], zoneId: string) {
  if (!/^[a-f0-9]{32}$/.test(zoneId)) throw new Error('対象zoneのIDが不正です');
  const choose = (name: string, scope: string) => {
    const candidates = groups.filter((g) => g.name === name && g.scopes.includes(scope) && g.is_selectable !== false);
    if (candidates.length !== 1 || !/^[a-f0-9]{32}$/.test(candidates[0].id)) throw new Error('必要な最小権限を一意に選べません');
    return { id: candidates[0].id };
  };
  return [
    { effect: 'allow', permission_groups: [choose(required[0], 'com.cloudflare.api.account')], resources: { [`com.cloudflare.api.account.${ACCOUNT}`]: '*' } },
    { effect: 'allow', permission_groups: required.slice(1).map((name) => choose(name, 'com.cloudflare.api.account.zone')), resources: { [`com.cloudflare.api.account.zone.${zoneId}`]: '*' } },
  ];
}
const ghArgs = ['--repo', REPOSITORY, '--env', 'production'];
export async function registerGeneratedToken(token: { id: string; value: string }, run: Run, revoke: (id: string) => Promise<void>) {
  if (!/^[a-f0-9]{32}$/.test(token.id)) throw new Error('発行IDを確認できません。値は表示しません');
  let registered = false;
  try {
    if (!token.value || token.value.length < 30 || /\s/.test(token.value)) throw new Error('発行結果が不正です');
    const result = await run(['gh', 'secret', 'set', SECRET_NAME, ...ghArgs], token.value);
    if (result.code !== 0) throw new Error('GitHubへの登録に失敗しました。値は表示しません');
    registered = true;
  } catch { throw new Error('GitHubへの登録を完了できません。値は表示しません');
  } finally {
    if (!registered) {
      // biome-ignore lint/correctness/noUnsafeFinally: 失効できなかったときは、登録の失敗より先にそれを知らせる（token が残っているかもしれないため）
      try { await revoke(token.id); } catch { throw new Error('未登録tokenの失効を確認できません。providerで確認してください。値は表示しません'); }
    }
  }
}
async function run(args: string[], stdin?: string) {
  // 標準入力はいつも pipe にし、渡す値が無いときはすぐに閉じる（stdin が条件で変わると、型の上で child.stdin が undefined になりうる）
  const child = Bun.spawn(args, { stdin: 'pipe', stdout: 'pipe', stderr: 'ignore', env: { ...process.env, CI: '1', CLOUDFLARE_ACCOUNT_ID: ACCOUNT } });
  if (stdin !== undefined) child.stdin.write(stdin);
  child.stdin.end();
  const [stdout, code] = await Promise.all([new Response(child.stdout).text(), child.exited]);
  return { code, stdout };
}
async function json(args: string[]) {
  const result = await run(args);
  if (result.code !== 0) throw new Error('CLI認証かAPI操作に失敗しました。生の出力は表示しません');
  try { return JSON.parse(result.stdout); } catch { throw new Error('CLIの応答形式を確認できません。生の出力は表示しません'); }
}
const cf = (args: string[]) => ['npm', 'exec', '--yes', '--ignore-scripts', `--package=cf@${CF_VERSION}`, '--', 'cf', ...args, '--profile', PROFILE];
async function main() {
  const mode = process.argv[2] ?? 'plan';
  if (!['plan', 'apply'].includes(mode)) throw new Error('plan または apply を指定してください');
  const plan = { repository: REPOSITORY, environment: 'production', account: ACCOUNT, zone: 'chalkfile.com', permissions: required,
    secretName: SECRET_NAME, cfVersion: CF_VERSION, oauthProfile: PROFILE,
    credentialTransport: 'supported cf grant: stdout in memory -> gh secret set stdin; otherwise provider UI -> GitHub production secret; no credential in logs, files or argv',
    initialSetup: 'cf beta.26 cannot request workers-scripts.edit (Workers Editor); use the account-token dashboard with these exact permissions, never broaden to Workers Admin',
    deploy: 'main only; successful setup dispatches ci.yml (all checks, then the deploy job)' };
  if (mode === 'plan') { console.log(JSON.stringify(plan, null, 2)); return; }
  if (process.env.CLOUDFLARE_API_TOKEN) throw new Error('既存tokenを流用せず、専用の認可profileから実行してください');
  stage = 'GitHubのmain限定とaccount確認';
  const policies = await json(['gh', 'api', `repos/${REPOSITORY}/environments/production/deployment-branch-policies`]);
  if (policies.branch_policies?.length !== 1 || policies.branch_policies[0].name !== 'main' || policies.branch_policies[0].type !== 'branch') throw new Error('productionのmain限定policyが不正です');
  const accountVar = await json(['gh', 'api', `repos/${REPOSITORY}/environments/production/variables/CLOUDFLARE_ACCOUNT_ID`]);
  if (accountVar.value !== ACCOUNT) throw new Error('productionのaccount IDが対象と一致しません');
  const secrets = await json(['gh', 'api', `repos/${REPOSITORY}/environments/production/secrets`]);
  if (!secrets.secrets?.some((s: any) => s.name === SECRET_NAME)) {
    stage = 'CloudflareのCLI認可と対象zone確認';
    const zones = await json(cf(['zones', 'list', '--name', 'chalkfile.com', '--account-id', ACCOUNT]));
    if (!Array.isArray(zones) || zones.length !== 1 || zones[0].name !== 'chalkfile.com' || zones[0].account?.id !== ACCOUNT || zones[0].status !== 'active') throw new Error('対象zoneを一意に確認できません');
    stage = '最小権限の確認。cf beta.26がWorkers Editorを発行できない場合はdocs/operations/setup.mdの管理画面手順を使います';
    const groups = await json(cf(['accounts', 'tokens', 'permission-groups', 'list']));
    if (!Array.isArray(groups)) throw new Error('権限一覧の形式が不正です');
    const payload = { name: 'chalkfile-github-production', policies: tokenPolicies(groups, zones[0].id) };
    // 作成APIだけが返す秘密値を、これ以外のコマンド引数・ファイルへ渡さない。
    stage = 'token作成とGitHub登録';
    const generated = await json(cf(['accounts', 'tokens', 'create', '--body', JSON.stringify(payload)]));
    await registerGeneratedToken(generated, run, async (id) => {
      const result = await run(cf(['accounts', 'tokens', 'delete', id, '--force']));
      if (result.code !== 0) throw new Error('未登録tokenの失効に失敗しました。本人の失効確認が必要です。値は表示しません');
    });
  }
  stage = 'secretの存在の読み戻しとActions開始';
  const installed = await json(['gh', 'api', `repos/${REPOSITORY}/environments/production/secrets`]);
  if (!installed.secrets?.some((s: any) => s.name === SECRET_NAME)) throw new Error('GitHub secretの登録を読み戻せません');
  if ((await run(['gh', 'workflow', 'run', 'ci.yml', '--repo', REPOSITORY, '--ref', 'main'])).code !== 0) throw new Error('secretは登録済みですがActionsの開始に失敗しました');
  console.log('production secretの存在を確認し、mainのdeployを開始しました。秘密値は表示/ファイル保存していません。');
}
if (import.meta.main) {
  try { await main(); } catch { console.error(`CLI設定を完了できません（${stage}）。生出力や秘密値は表示しません。`); process.exitCode = 1; }
}
