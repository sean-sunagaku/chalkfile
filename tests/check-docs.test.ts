import { describe, expect, test } from 'bun:test';
import {
  ALLOW_OLD,
  allowOf,
  anchorsOf,
  checkLinks,
  checkOldWords,
  checkSkill,
  compareSets,
  descriptionOf,
  DESCRIPTION_MAX,
  type Finding,
  hasGeneratedMark,
  hasUsage,
  isRunnable,
  linksOf,
  type OldAllow,
  slug,
  tableUnder,
  unusedAllows,
} from '../scripts/check_docs';

const files: Record<string, string> = {
  'docs/a.md': '# 文書の地図\n\n## 安全・並行作業（AI）\n\n## 安全・並行作業（AI）\n\n<a id="extra"></a>\n',
  'docs/b.md': '# B\n',
};
const read = (file: string) => (file === 'docs' ? '' : (files[file] ?? null));

describe('リンクとアンカー', () => {
  test('見出しのアンカーは GitHub と同じ形（記号を外す・同じ見出しは -1）', () => {
    expect(slug('講座ごとのテーマ（トンマナ）')).toBe('講座ごとのテーマトンマナ');
    expect(slug('Step 1: `npm ci` を流す')).toBe('step-1-npm-ci-を流す');
    expect([...anchorsOf(files['docs/a.md'])]).toEqual(['文書の地図', '安全並行作業ai', '安全並行作業ai-1', 'extra']);
  });

  test('コードの中の [文字](先) はリンクにしない', () => {
    const md = '[a](b.md)\n\n```md\n[x](missing.md)\n```\n\n`[y](missing.md)` と [c](<c d.md> "題")\n\n[ref]: e.md\n';
    expect(linksOf(md).map((l) => l.target)).toEqual(['b.md', 'c d.md', 'e.md']);
  });

  test('無いファイル・無い見出し・リポジトリの外を止め、外のサイトは見ない', () => {
    const out: Finding[] = [];
    const md = [
      '[ok](b.md) [ok](a.md#安全並行作業ai-1) [ok](#文書の地図) [ok](/docs/b.md) [ok](../docs/)',
      '[ng](c.md) [ng](b.md#無い見出し) [ng](../../x.md)',
      '[外](https://chalkfile.com/#x) [メール](mailto:a@example.com)',
    ].join('\n');
    checkLinks('docs/a.md', `${files['docs/a.md']}\n${md}`, read, out);
    expect(out.map((f) => [f.level, f.check, f.what])).toEqual([
      ['error', 'リンク', 'リンク先が無い: c.md'],
      ['error', 'アンカー', '見出しが無い: b.md#無い見出し'],
      ['error', 'リンク', 'リポジトリの外を指している: ../../x.md'],
    ]);
  });
});

describe('古い言葉', () => {
  test('スキルに「deploy_pages.sh で公開」と書くと止める', () => {
    const out: Finding[] = [];
    checkOldWords('.claude/skills/x/SKILL.md', '公開は deploy_pages.sh で公開する\n', out);
    expect(out).toEqual([
      {
        level: 'error',
        check: '古い言葉',
        where: '.claude/skills/x/SKILL.md:1',
        what: expect.stringContaining('deploy_pages.sh で公開'),
      },
    ]);
  });

  test('旧 Pages の URL とパスを見つけ、リポジトリの URL・ほかの github.io は見ない', () => {
    const out: Finding[] = [];
    const text = [
      'https://sean-sunagaku.github.io/chalkfile/',
      "scope: '/chalkfile/'",
      'https://github.com/sean-sunagaku/chalkfile/releases',
      'https://w3c.github.io/ServiceWorker/',
    ].join('\n');
    checkOldWords('README.md', text, out);
    // 1 行目は github.io で見つける（URL の中の /chalkfile/ は、別には数えない）
    expect(out.map((f) => f.where)).toEqual(['README.md:1', 'README.md:2']);
  });

  test('許す場所（過去の記録・旧 Pages の道具・テストの記録）では見ない', () => {
    const out: Finding[] = [];
    for (const f of [
      'docs/history/2026-11.md',
      'docs/adr/x.md',
      'scripts/legacy/deploy_pages.sh',
      'site/legacy-sw.ts',
      'tests/fixtures/a.html',
    ]) {
      checkOldWords(f, 'https://sean-sunagaku.github.io/chalkfile/ npm install dist-media', out);
    }
    expect(out).toEqual([]);
  });

  test('動かした生成物の前の場所と、前の公開の言い方を見つける', () => {
    const out: Finding[] = [];
    const text = [
      'src/generated/timeline.json を直す',
      'bash scripts/deploy_pages.sh',
      'bash scripts/legacy/deploy_pages.sh',
      'site/media-manifest.json',
      '講座サイトを GitHub Pages に出す',
      '動画は gh-pages ブランチにだけ置く',
      '旧 Pages（gh-pages ブランチ）には、案内だけを置く',
    ].join('\n');
    checkOldWords('docs/guide/x.md', text, out);
    expect(out.map((f) => [f.where, f.what.match(/「(.+?)」/)?.[1]])).toEqual([
      ['docs/guide/x.md:1', 'src/generated/*.json'],
      ['docs/guide/x.md:2', 'scripts/deploy_pages.sh'],
      ['docs/guide/x.md:4', 'site/media-manifest.json'],
      ['docs/guide/x.md:5', 'GitHub Pages に出す'],
      ['docs/guide/x.md:6', 'gh-pages に置く'],
    ]);
  });

  test('ファイルごとの例外は、書いた言葉だけを許し、使った数を数える', () => {
    const out: Finding[] = [];
    const used = new Map<OldAllow, number>();
    checkOldWords('tests/delivery.test.ts', "migrationUrl('/chalkfile/a/')\nnpm install\n", out, used);
    expect(out.map((f) => [f.where, f.level])).toEqual([['tests/delivery.test.ts:2', 'error']]);
    const allow = allowOf('tests/delivery.test.ts', '/chalkfile/');
    expect(allow?.words).toEqual(['/chalkfile/']);
    expect(used.get(allow as OldAllow)).toBe(1);
    expect(allowOf('tests/delivery.test.ts', 'npm install')).toBeUndefined();
  });

  test('もう古い言葉が無いファイルごとの例外を出す（場所ごとの例外は出さない）', () => {
    const file: OldAllow = { rx: /^a\.ts$/, words: ['dist-media'], why: 'テスト' };
    const dir: OldAllow = { rx: /^docs\/history\//, why: 'テスト' };
    expect(unusedAllows(new Map(), [file, dir])).toEqual([file]);
    expect(unusedAllows(new Map([[file, 1]]), [file, dir])).toEqual([]);
  });

  test('例外には、どれも理由がある', () => {
    for (const a of ALLOW_OLD) expect(a.why.length).toBeGreaterThan(0);
  });
});

describe('表と実装', () => {
  const md =
    '# x\n\n## テーマ\n\n| id | 中身 |\n|---|---|\n| `chalkfile`（既定） | a |\n| `night` | b |\n\n本文\n\n## 次\n';

  test('見出しの下の表の行を読む（行の中のコードも残す）', () => {
    expect(tableUnder(md, 'テーマ')).toEqual([
      ['`chalkfile`（既定）', 'a'],
      ['`night`', 'b'],
    ]);
    expect(tableUnder(md, '無い見出し')).toBeNull();
  });

  test('表に無いもの・表にだけあるものを出す', () => {
    const out: Finding[] = [];
    compareSets('README.md', 'テーマの表', ['chalkfile', 'night', 'old'], ['chalkfile', 'night', 'paper'], out);
    expect(out.map((f) => f.what)).toEqual(['テーマの表に無い: paper', 'テーマの表にあるが実装に無い: old']);
  });
});

describe('スキル・生成物・道具', () => {
  test('description を 1 行・引用符・複数行から取り出し、長すぎると止める', () => {
    expect(descriptionOf('---\nname: a\ndescription: 講座を作る\n---\n')).toBe('講座を作る');
    expect(descriptionOf('---\ndescription: "引用: あり"\n---\n')).toBe('引用: あり');
    expect(descriptionOf('---\ndescription: >-\n  1 行目\n  2 行目\nname: a\n---\n')).toBe('1 行目 2 行目');
    const out: Finding[] = [];
    checkSkill('SKILL.md', `---\ndescription: ${'あ'.repeat(DESCRIPTION_MAX + 1)}\n---\n`, out);
    checkSkill('SKILL.md', `---\ndescription: ${'あ'.repeat(DESCRIPTION_MAX)}\n---\n`, out);
    checkSkill('SKILL.md', '---\nname: a\n---\n', out);
    expect(out.map((f) => f.what)).toEqual([
      `description が ${DESCRIPTION_MAX + 1} 字（${DESCRIPTION_MAX} 字まで）`,
      '頭の YAML に description が無い',
    ]);
  });

  test('生成物の印は頭の 3 行のコメント', () => {
    expect(hasGeneratedMark('<!-- 生成物: bun scripts/build_materials.ts が作る。手で直さない -->\n# 教材\n')).toBe(
      true,
    );
    expect(hasGeneratedMark('# 教材\n\n本文\n')).toBe(false);
  });

  test('直接流す道具の頭書きに、流し方の行があるか（TS・Python・シェル）', () => {
    expect(hasUsage('scripts/a.ts', '// 説明\n//   bun scripts/a.ts --check\nimport x from "y";\n')).toBe(true);
    expect(hasUsage('scripts/a.ts', '/**\n * 説明\n *   bun scripts/a.ts <講座 ID>\n */\nimport x from "y";\n')).toBe(
      true,
    );
    expect(hasUsage('scripts/a.ts', 'import x from "y";\n// bun scripts/a.ts\n')).toBe(false);
    const py =
      '# /// script\n# dependencies = []\n# ///\n"""説明。\n\n  uv run --locked --script scripts/b.py --all\n"""\nimport os\n';
    expect(hasUsage('scripts/b.py', py)).toBe(true);
    expect(hasUsage('scripts/c.sh', '#!/usr/bin/env bash\n# 説明だけ\nset -e\n')).toBe(false);
    expect(isRunnable('scripts/a.ts', 'export const x = 1;\n')).toBe(false);
    expect(isRunnable('scripts/a.ts', 'if (import.meta.main) main();\n')).toBe(true);
    expect(isRunnable('scripts/b.py', 'if __name__ == "__main__":\n    main()\n')).toBe(true);
  });
});
