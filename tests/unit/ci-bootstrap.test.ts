import { expect, test } from 'bun:test';
import { checkSecrets } from '../../scripts/check_content';
import { registerGeneratedToken, tokenPolicies } from '../../scripts/setup_cloudflare_ci';
import { required } from '../support/required';

const groups = [
  { id: 'a'.repeat(32), name: 'Workers Editor', scopes: ['com.cloudflare.api.account'], is_selectable: true },
  {
    id: 'b'.repeat(32),
    name: 'Workers Routes Write',
    scopes: ['com.cloudflare.api.account.zone'],
    is_selectable: true,
  },
  { id: 'c'.repeat(32), name: 'Zone Read', scopes: ['com.cloudflare.api.account.zone'], is_selectable: true },
  { id: 'd'.repeat(32), name: 'Account API Tokens Write', scopes: ['com.cloudflare.api.account'], is_selectable: true },
  { id: 'f'.repeat(32), name: 'Workers Scripts Write', scopes: ['com.cloudflare.api.account'], is_selectable: true },
];
test('CIは対象account/zoneの3権限だけとし、token発行権限や全zoneを渡さない', () => {
  const policies = tokenPolicies(groups, 'e'.repeat(32));
  expect(policies.flatMap((p) => p.permission_groups.map((g) => g.id))).toEqual(groups.slice(0, 3).map((g) => g.id));
  expect(required(policies[1]).resources).toEqual({ [`com.cloudflare.api.account.zone.${'e'.repeat(32)}`]: '*' });
  for (const source of [
    groups.slice(1),
    [...groups, required(groups[0])],
    groups.map((g) => ({ ...g, is_selectable: false })),
  ])
    expect(() => tokenPolicies(source, 'e'.repeat(32))).toThrow();
  expect(() => tokenPolicies(groups, '*')).toThrow();
});
test('Editorが発行不可ならlegacyのScripts Writeへ広げず、tokenを作らない', () => {
  expect(() =>
    tokenPolicies(
      groups.map((g) => (g.name === 'Workers Editor' ? { ...g, is_selectable: false } : g)),
      'e'.repeat(32),
    ),
  ).toThrow();
});
test('発行した秘密値はghの標準入力だけへ渡し、成功時は失効しない', async () => {
  const value = ['cfat', 'X'.repeat(44)].join('_');
  let revoked = false;
  await registerGeneratedToken(
    { id: 'a'.repeat(32), value },
    async (args, input) => {
      expect(args.join(' ')).not.toContain(value);
      expect(args).toContain('production');
      expect(input).toBe(value);
      return { code: 0, stdout: '' };
    },
    async () => {
      revoked = true;
    },
  );
  expect(revoked).toBe(false);
});
test('登録失敗・例外・不正応答では自分が発行したtokenだけを失効し、秘密を例外に含めない', async () => {
  const value = ['cfat', 'X'.repeat(44)].join('_');
  for (const fault of ['exit', 'throw', 'malformed']) {
    const revoked: string[] = [];
    try {
      await registerGeneratedToken(
        { id: 'a'.repeat(32), value: fault === 'malformed' ? '' : value },
        async () => {
          if (fault === 'throw') throw new Error(value);
          return { code: 1, stdout: value };
        },
        async (id) => {
          revoked.push(id);
        },
      );
      throw new Error('登録失敗を検出しませんでした');
    } catch (error) {
      expect(String(error)).not.toContain(value);
    }
    expect(revoked).toEqual(['a'.repeat(32)]);
  }
});
test('Cloudflareの現行prefix付き認証値を、変数名のない文章からも検出・伏字にする', () => {
  for (const prefix of ['cfk', 'cfut', 'cfat', 'cfoat']) {
    const value = [prefix, 'X'.repeat(44)].join('_');
    const findings: any[] = [];
    checkSecrets(value, 'sample.txt', findings);
    expect(findings).toHaveLength(1);
    expect(JSON.stringify(findings)).not.toContain(value);
  }
});
