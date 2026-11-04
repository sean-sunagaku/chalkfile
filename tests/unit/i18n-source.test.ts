import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { translationRows } from '../../scripts/i18n';
import { stampSource } from '../../scripts/lib/i18n-source';

const HASH = 'abcdef012345';

describe('訳の指紋の書き換え先', () => {
  test('コメント・台詞・入れ子・別の export にある source を触らない（日本語と補助文字の位置も保つ）', () => {
    const source = `// 日本語と𠮷 source: '000000000000'
export const W01 = { source: '111111111111' };
export const P01: LectureL10n = {
  title: "source: '222222222222'",
  nested: { source: '333333333333' },
  source: /* 訳したとき */ '444444444444',
};\n`;
    expect(stampSource(source, 'P01', HASH)).toBe(source.replace("'444444444444'", `'${HASH}'`));
  });

  test('複数の変数宣言でも名前で選び、二重引用符と CRLF を保つ', () => {
    const source = 'export const W01 = { source: "111111111111" }, P01 = { "source": "222222222222" };\r\n';
    expect(stampSource(source, 'P01', HASH)).toBe(source.replace('"222222222222"', `"${HASH}"`));
  });

  test.each(['as LectureL10n', 'satisfies LectureL10n', 'as const'])('型の印（%s）の内側を選ぶ', (annotation) => {
    expect(stampSource(`export const P01 = ({ source: '' } ${annotation});`, 'P01', HASH)).toBe(
      `export const P01 = ({ source: '${HASH}' } ${annotation});`,
    );
  });

  test.each([
    "const P01 = { source: '' };",
    "export const W01 = { source: '' };",
    'export const P01 = translated;',
    "export const P01 = { nested: { source: '' } };",
    "export const P01 = { source: '', source: '' };",
    'export const P01 = { source: hash };',
    'export const P01 = { source() { return hash; } };',
    "export const P01 = { ['source']: '' };",
    "export const P01 = { source: '', ...other };",
    "export const P01 = { source: '', [key]: value };",
  ])('一意に決められない場所は止める: %s', (source) => {
    expect(() => stampSource(source, 'P01', HASH)).toThrow();
  });

  test('ID と指紋は形式を確かめ、同じ値の書き換えは同じ文字列になる', () => {
    const source = `export const P01 = { source: '${HASH}' };`;
    expect(stampSource(source, 'P01', HASH)).toBe(source);
    expect(() => stampSource(source, '../P01', HASH)).toThrow();
    expect(() => stampSource(source, 'P01', 'not-a-hash')).toThrow();
  });

  test('実際の訳をすべて読み、指紋の値以外は 1 文字も変えない', () => {
    const rows = translationRows().filter((row) => row.state !== 'none');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const source = readFileSync(row.file, 'utf8');
      const next = stampSource(source, row.id, HASH);
      expect(next.replace(`source: '${HASH}'`, "source: ''")).toBe(source.replace(/source: '[0-9a-f]*'/, "source: ''"));
      expect(stampSource(next, row.id, HASH)).toBe(next);
    }
  });
});
