// 期限まで凍結する旧 Pages の API を、従来の型設定で確かめる（tsconfig.legacy.json）。
import { expect, test } from 'bun:test';
import { migrationHtml, migrationUrl } from '../../scripts/build_migration';

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
