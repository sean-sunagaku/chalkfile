// npm run gen（scripts/gen.ts）が作る全体の生成物: Worker の許可リスト・README の講座の表・new-course.md の頭文字の表・Python が読む JSON
import { describe, expect, test } from 'bun:test';
import { COURSES } from '../content';
import { freePrefixes } from '../engine/core/validate';
import { checkGenerated, type Finding } from '../scripts/check_docs';
import {
  courseTable,
  docOutputs,
  generated,
  prefixTable,
  replaceBlock,
  staleOutputs,
  WORKER_MEDIA,
} from '../scripts/gen';
import { readMediaManifest } from '../scripts/media';
import { mediaManifestJson } from '../scripts/media-lists';

describe('生成した表を置く場所（<!-- name:start --> と <!-- name:end --> の間）', () => {
  test('印の間だけを置き換え、ほかの行はそのまま残す', () => {
    const md = '# 見出し\n\n<!-- t:start -->\n古い表\n<!-- t:end -->\n\n後ろの文\n';
    expect(replaceBlock(md, 't', '新しい表')).toBe(
      '# 見出し\n\n<!-- t:start -->\n新しい表\n<!-- t:end -->\n\n後ろの文\n',
    );
    expect(replaceBlock(replaceBlock(md, 't', '新しい表'), 't', '新しい表')).toBe(replaceBlock(md, 't', '新しい表'));
  });
  test('印が無ければ止める（どこに置くか分からない）', () => {
    expect(() => replaceBlock('# 印なし\n', 't', '表', 'README.md')).toThrow('README.md: 生成した表を置く印');
  });
});

describe('README の講座の表と、new-course.md の頭文字の表', () => {
  test('講座の登録の順に、全部の講座が 1 行ずつ並ぶ', () => {
    const rows = courseTable()
      .split('\n')
      .filter((l) => l.startsWith('| ['));
    expect(rows.map((r) => /chalkfile\.com\/([\w-]+)\//.exec(r)?.[1])).toEqual(COURSES.map((c) => c.id));
    const prefixes = prefixTable()
      .split('\n')
      .filter((l) => /^\| `[A-Z]`/.test(l));
    expect(prefixes).toEqual(COURSES.map((c) => `| \`${c.prefix}\` | \`${c.id}\` | ${c.order} |`));
    expect(prefixTable()).toContain(`空いている文字: ${freePrefixes(COURSES).join(' ')}`);
  });
  test('長さは timeline から、訳は公開していない言語に「未公開」を付ける', () => {
    const stripe = courseTable()
      .split('\n')
      .find((l) => l.includes('/stripe-billing/'));
    expect(stripe).toContain('| 13 本 | 約 56 分 | — |');
    expect(
      courseTable()
        .split('\n')
        .find((l) => l.includes('/pstack-comedy/')),
    ).toContain('| 英語・中国語（未公開） |');
  });
  test('今の README と new-course.md は、作り直したものと同じ（手で直していない）', () => {
    expect(staleOutputs(docOutputs())).toEqual([]);
  });
  test('check_docs は、作り直したものと違う表を止める', () => {
    const expected = docOutputs();
    const changed = new Map(
      [...expected].map(([f, t]) => [f, f === 'README.md' ? t.replace('約 56 分', '約 99 分') : t]),
    );
    const out: Finding[] = [];
    checkGenerated((f) => changed.get(f) ?? null, out);
    expect(out.map((f) => `${f.level} ${f.check} ${f.where}`)).toEqual(['error 生成の表 README.md']);
    const ok: Finding[] = [];
    checkGenerated((f) => expected.get(f) ?? null, ok);
    expect(ok).toEqual([]);
  });
});

describe('Worker の許可リスト', () => {
  test('講座ごとの動画の一覧をつないだもの（--media だけでも作る）', () => {
    expect(generated('media')).toEqual(new Map([[WORKER_MEDIA, mediaManifestJson(readMediaManifest())]]));
    expect([...generated().keys()]).toEqual([
      WORKER_MEDIA,
      'README.md',
      'docs/guide/new-course.md',
      'docs/guide/commands.md',
      'scripts/audio/sfx.json',
      'scripts/audio/video_config.json',
    ]);
  });
});
