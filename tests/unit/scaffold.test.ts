// ひな形の入力・書き込み・生成した台本の読み込みを確かめる。
import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { CourseModule } from '../../engine/core/course-module';
import { THEME_IDS } from '../../engine/core/project-settings';
import { validateCourse, validateCourses } from '../../engine/core/validate';
import { ROOT } from '../../scripts/lib/paths';
import { planScaffold, writeScaffold } from '../../scripts/scaffold';

const roots: string[] = [];
const setup = () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'chalkfile-scaffold-'));
  roots.push(root);
  mkdirSync(path.join(root, 'content'));
  writeFileSync(path.join(root, 'content/courses.ts'), '// 講座の登録\n');
  return root;
};
const options = { id: 'sample-video', title: 'サンプルの動画' };

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('動画のひな形', () => {
  test('計画だけではファイルやロックを作らず、空いている頭文字と並びを選ぶ', () => {
    const root = setup();
    const first = planScaffold(root, options, []);
    const next = planScaffold(root, { ...options, id: 'next-video' }, [first.course]);
    expect(first.course.prefix).toBe('A');
    expect(next.course.prefix).toBe('B');
    expect(next.course.order).toBe(first.course.order + 10);
    expect(existsSync(path.join(root, 'content/sample-video'))).toBe(false);
    expect(existsSync(path.join(root, '.work'))).toBe(false);
    expect(readFileSync(path.join(root, 'content/courses.ts'), 'utf8')).toBe('// 講座の登録\n');
    expect(Object.keys(first.files)).toHaveLength(4);
    expect(validateCourse(first.course, { themes: THEME_IDS })).toEqual([]);
    expect(validateCourses([first.course, next.course])).toEqual([]);
  });

  test('生成した講座を読み込めて、引用符やコードに似た題も文字として保つ', async () => {
    const root = setup();
    // biome-ignore lint/suspicious/noTemplateCurlyInString: 変数展開のような題を文字のまま保つ試験
    const title = '引用符 \' " と `文字` と ${123}';
    const plan = planScaffold(root, { ...options, title, prefix: 'Q', theme: 'paper' }, []);
    symlinkSync(path.join(ROOT, 'content/course-module.ts'), path.join(root, 'content/course-module.ts'));
    symlinkSync(path.join(ROOT, 'content/_shared'), path.join(root, 'content/_shared'));
    writeScaffold(plan);
    const module = (await import(pathToFileURL(path.join(root, 'content/sample-video/index.ts')).href)) as {
      default: CourseModule;
    };
    expect(module.default.course).toEqual(plan.course);
    expect(module.default.course.title).toBe(title);
    expect(module.default.course.standalone).toBe(true);
    expect(module.default.course.docsNote).toContain('未確認');
    expect(module.default.reading).toEqual({});
    expect(readFileSync(path.join(root, 'content/courses.ts'), 'utf8')).toBe(plan.registryAfter);
    expect(validateCourse(plan.course, { themes: THEME_IDS })).toEqual([]);
  });

  test.each(['../escape', 'sample/escape', '/escape', 'Sample', 'en', 'ja', '', 'sample--video'])(
    '不正な ID を書き込む前に止める: %s',
    (id) => {
      const root = setup();
      expect(() => planScaffold(root, { ...options, id }, [])).toThrow('講座 ID');
      expect(readFileSync(path.join(root, 'content/courses.ts'), 'utf8')).toBe('// 講座の登録\n');
    },
  );

  test.each([
    '',
    '   ',
    '改行\nを含む',
    String.fromCharCode(0),
    String.fromCharCode(27),
    String.fromCharCode(0x85),
    String.fromCharCode(0x200b),
    String.fromCharCode(0x202e),
    'a'.repeat(161),
  ])('不正な題を止める', (title) => {
    expect(() => planScaffold(setup(), { ...options, title }, [])).toThrow('題は');
  });

  test('使われた頭文字・予約文字・未知のテーマを止める', () => {
    const root = setup();
    const first = planScaffold(root, options, []);
    expect(() => planScaffold(root, { ...options, prefix: 'A' }, [first.course])).toThrow('頭文字');
    expect(() => planScaffold(root, { ...options, prefix: 'X' }, [])).toThrow('頭文字');
    expect(() => planScaffold(root, { ...options, prefix: 'AA' }, [])).toThrow('頭文字');
    expect(() => planScaffold(root, { ...options, theme: 'unknown' }, [])).toThrow('テーマ');
  });

  test('既存のフォルダと登録を上書きしない', () => {
    const root = setup();
    const plan = planScaffold(root, options, []);
    writeScaffold(plan);
    const before = readFileSync(path.join(root, 'content/sample-video/A01.ts'), 'utf8');
    expect(() => planScaffold(root, options, [])).toThrow('既にある');
    expect(() => writeScaffold(plan)).toThrow('登録が変わった');
    expect(readFileSync(path.join(root, 'content/sample-video/A01.ts'), 'utf8')).toBe(before);
  });

  test('計画後の登録変更を残して止める', () => {
    const root = setup();
    const plan = planScaffold(root, options, []);
    writeFileSync(path.join(root, 'content/courses.ts'), '// ほかの作業で変更した\n');
    expect(() => writeScaffold(plan)).toThrow('登録が変わった');
    expect(readFileSync(path.join(root, 'content/courses.ts'), 'utf8')).toBe('// ほかの作業で変更した\n');
    expect(existsSync(path.join(root, 'content/sample-video'))).toBe(false);
  });

  test('途中の書き込みに失敗したら作ったフォルダだけを片付ける', () => {
    const root = setup();
    const plan = planScaffold(root, options, []);
    plan.files['content/sample-video/missing/fail.ts'] = '// 失敗する場所';
    expect(() => writeScaffold(plan)).toThrow();
    expect(existsSync(path.join(root, 'content/sample-video'))).toBe(false);
    expect(readFileSync(path.join(root, 'content/courses.ts'), 'utf8')).toBe(plan.registryBefore);
  });

  test.each(['assets', 'media', 'fonts', 'icons', 'offline'])(
    'サイトの配信用フォルダと重なる ID を止める: %s',
    (id) => {
      expect(() => planScaffold(setup(), { ...options, id }, [])).toThrow('配信用フォルダ');
    },
  );

  test('同じ export 名の登録を止める', () => {
    const root = setup();
    writeFileSync(
      path.join(root, 'content/courses.ts'),
      "export { default as course_sample_video } from './different';\n",
    );
    expect(() => planScaffold(root, options, [])).toThrow('登録が既にある');
  });

  test('外を指す登録ファイルと壊れたリンクを上書きしない', () => {
    const root = setup();
    symlinkSync(path.join(root, 'missing'), path.join(root, 'content/sample-video'));
    expect(() => planScaffold(root, options, [])).toThrow('既にある');
    rmSync(path.join(root, 'content/sample-video'));
    rmSync(path.join(root, 'content/courses.ts'));
    const outside = path.join(root, 'outside.ts');
    writeFileSync(outside, '// 保持する\n');
    symlinkSync(outside, path.join(root, 'content/courses.ts'));
    expect(() => planScaffold(root, options, [])).toThrow('通常のファイル');
    expect(readFileSync(outside, 'utf8')).toBe('// 保持する\n');
  });
});
