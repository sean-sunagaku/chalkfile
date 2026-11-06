// 1 本だけの動画の台本・講座・読みの辞書を作り、講座の登録表に足す。
// 使い方（講座 ID と題を渡す。頭文字とテーマは省略できる）:
//   npm run chalk -- new video <講座 ID> --title <題> [--prefix <英大文字>] [--theme <テーマ>] [--dry-run]
// --dry-run は作るファイルと次の手順を出すだけ。既存のフォルダや登録は上書きしない。
// 台本は執筆用のひな形。公開する前に、本文・出典・確認日・版を書き、読みと静止画を確かめる。
import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { comedyCast } from '../content/_shared/comedy';
import { THEME_IDS } from '../engine/core/project-settings';
import type { Course, Lecture, ThemeId } from '../engine/core/schema';
import { freePrefixes } from '../engine/core/validate';
import { readArgs, runMain, showHelp, UsageError } from './lib/args';
import { withLock, writeAtomic } from './lib/fsx';
import { ROOT } from './lib/paths';

export type ScaffoldOptions = { id: string; title: string; prefix?: string; theme?: string };
export type ScaffoldPlan = {
  root: string;
  course: Course;
  files: Record<string, string>;
  registryBefore: string;
  registryAfter: string;
};

const present = (file: string): boolean => {
  try {
    lstatSync(file);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
};

const assertLocalContent = (root: string): void => {
  const content = path.join(root, 'content');
  const registry = path.join(content, 'courses.ts');
  if (!existsSync(content) || lstatSync(content).isSymbolicLink() || !lstatSync(content).isDirectory())
    throw new UsageError('content は作業フォルダ内の通常のフォルダにする');
  if (!present(registry) || lstatSync(registry).isSymbolicLink() || !lstatSync(registry).isFile())
    throw new UsageError('content/courses.ts は通常のファイルにする');
};

/** 書き込み前にすべての入力と重なりを確かめ、執筆用のひな形を作る。 */
export const planScaffold = (root: string, options: ScaffoldOptions, courses: readonly Course[]): ScaffoldPlan => {
  const { id, title } = options;
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id) || id.length > 80 || /^[a-z]{2}$/.test(id))
    throw new UsageError('講座 ID は英小文字・数字・ハイフンで書く（英小文字 2 字だけは言語用）');
  if (['assets', 'media', 'fonts', 'icons', 'offline'].includes(id))
    throw new UsageError('講座 ID がサイトの配信用フォルダと重なる');
  if (!title.trim() || title.length > 160 || /[\p{Cc}\p{Cf}]/u.test(title))
    throw new UsageError('題は空白だけでない 160 字以内の 1 行で書く');
  const free = freePrefixes(courses);
  const prefix = options.prefix ?? free[0];
  if (!prefix || !free.includes(prefix))
    throw new UsageError(`頭文字が使えない: ${prefix ?? '未指定'}。空いている文字: ${free.join(' ') || 'なし'}`);
  const theme = options.theme ?? 'stage';
  if (!(THEME_IDS as readonly string[]).includes(theme))
    throw new UsageError(`テーマが無い: ${theme}（${THEME_IDS.join('・')}）`);
  assertLocalContent(root);
  if (courses.some((course) => course.id === id) || present(path.join(root, 'content', id)))
    throw new UsageError(`講座のフォルダか登録が既にある: ${id}`);
  const registryBefore = readFileSync(path.join(root, 'content/courses.ts'), 'utf8');
  const alias = `course_${id.replaceAll('-', '_')}`;
  if (
    new RegExp(`\\b${alias}\\b`).test(registryBefore) ||
    registryBefore.includes(`'./${id}'`) ||
    registryBefore.includes(`"./${id}"`)
  )
    throw new UsageError(`講座の登録が既にある: ${id}`);
  const lectureId = `${prefix}01`;
  const section = { no: 1, title: '入門' };
  const lecture: Lecture = {
    id: lectureId,
    no: 1,
    section,
    title: title.trim(),
    summary: '執筆用のひな形。学ぶことと、見終わったらできることを書く。',
    docs: [],
    quiz: [],
    takeaways: ['執筆用のひな形。確認した要点に書き換える。'],
    scenes: [
      {
        kind: 'opening',
        title: title.trim(),
        lines: [
          { t: '今日は、新しいことを一緒に学びます。' },
          { t: 'もう全部わかったのだ！', v: 'zundamon' },
          { t: 'まだ題しか言っていません。', v: 'tsukkomi', sfx: 'harisen' },
          { t: '理解の速さだけ、世界記録である。', v: 'tennokoe' },
        ],
      },
      {
        kind: 'goals',
        items: [{ text: '学習目標を書き換える', at: 1 }],
        lines: [{ t: 'ここに、この動画の学習目標を書きます。' }],
      },
      {
        kind: 'points',
        heading: '本文を書き換える',
        evidence: 'example',
        items: [{ title: '架空のサンプルアプリ', body: '確認した事実と、自分で作った例を分けて書く', at: 1 }],
        lines: [{ t: 'ここに、確認した事実と、架空のサンプルアプリの例を書きます。' }],
      },
      { kind: 'recap', items: [{ text: '要点を書き換える', at: 1 }], lines: [{ t: 'ここに、今日の要点を書きます。' }] },
      { kind: 'ending', closing: 'おつかれさまでした', lines: [{ t: 'ここに、学んだことを試す一歩を書きます。' }] },
    ],
  };
  const course: Course = {
    id,
    prefix,
    order: Math.max(0, ...courses.map((item) => item.order)) + 10,
    title: title.trim(),
    subtitle: '',
    headline: '執筆用のひな形。学ぶ価値を一文で書く。',
    theme: theme as ThemeId,
    standalone: true,
    disclaimer: 'ボケの台詞は、わざと間違えています。',
    sections: [section],
    lectures: [lecture],
    cast: comedyCast(),
    docsNote: '未確認。公開前に公式の出典 URL・確認日・版を記す。',
    sourceNote: '未確認。公開前に台本の根拠と権利の説明を書き換える。',
  };
  const { lectures: _lectures, cast: _cast, ...metadata } = course;
  const files = {
    [`content/${id}/index.ts`]: `import { defineCourseModule } from '../course-module';\nimport { COURSE } from './course';\nimport { READING } from './reading';\n\nexport default defineCourseModule({ course: COURSE, reading: READING });\n`,
    [`content/${id}/course.ts`]: `import { comedyCast } from '../_shared/comedy';\nimport type { Course } from '../types';\nimport { ${lectureId} } from './${lectureId}';\n\n// 公開前に本文・出典・確認日・版を記し、読みと静止画を確かめる。\nexport const COURSE: Course = {\n${JSON.stringify(metadata, null, 2).slice(2, -2)},\n  lectures: [${lectureId}],\n  cast: comedyCast(),\n};\n`,
    [`content/${id}/${lectureId}.ts`]: `import type { Lecture } from '../types';\n\n// 執筆用のひな形。本文・図・クイズ・出典を調べた内容に書き換える。\nexport const ${lectureId}: Lecture = ${JSON.stringify(lecture, null, 2)};\n`,
    [`content/${id}/reading.ts`]: `import type { Reading } from '../reading';\n\n// この講座だけで使う語の読みを足す。\nexport const READING: Reading = {};\n`,
  };
  return {
    root,
    course,
    files,
    registryBefore,
    registryAfter: `${registryBefore.trimEnd()}\nexport { default as ${alias} } from './${id}';\n`,
  };
};

/** 計画後の変更も検出する。途中で失敗したら、この呼び出しが作ったフォルダだけを片付ける。 */
export const writeScaffold = (plan: ScaffoldPlan): void => {
  assertLocalContent(plan.root);
  const registry = path.join(plan.root, 'content/courses.ts');
  if (readFileSync(registry, 'utf8') !== plan.registryBefore)
    throw new UsageError('講座の登録が変わったので、もう一度コマンドを流す');
  const directory = path.join(plan.root, 'content', plan.course.id);
  mkdirSync(directory);
  try {
    for (const [file, source] of Object.entries(plan.files))
      writeFileSync(path.join(plan.root, file), source, { flag: 'wx' });
    if (readFileSync(registry, 'utf8') !== plan.registryBefore)
      throw new UsageError('講座の登録が変わったので、もう一度コマンドを流す');
    writeAtomic(registry, plan.registryAfter);
  } catch (error) {
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
};

const main = async (argv: string[]) => {
  const { values, positionals } = readArgs(
    argv,
    {
      title: { type: 'string' },
      prefix: { type: 'string' },
      theme: { type: 'string' },
      'dry-run': { type: 'boolean' },
      verbose: { type: 'boolean', short: 'v' },
    },
    { positionals: true },
  );
  if (values.help) return showHelp(import.meta.filename);
  const id = positionals[0];
  const title = values.title;
  if (positionals.length !== 1 || id === undefined || title === undefined)
    throw new UsageError('講座 ID を 1 つと --title <題> を渡す（使い方は --help）');
  const create = async () => {
    const { COURSES } = await import('../content/index');
    const plan = planScaffold(
      ROOT,
      {
        id,
        title,
        ...(values.prefix === undefined ? {} : { prefix: values.prefix }),
        ...(values.theme === undefined ? {} : { theme: values.theme }),
      },
      COURSES,
    );
    if (!values['dry-run']) writeScaffold(plan);
    console.log(`${values['dry-run'] ? '作成予定' : '作成した'}: ${plan.course.id}（${plan.course.prefix}01）`);
    for (const file of Object.keys(plan.files)) console.log(`  ${file}`);
    console.log('  content/courses.ts に登録を 1 行追加');
    console.log(
      `次: 台本・出典・確認日・版を書く → npm run gen → npm run chalk -- build --course ${plan.course.id} --to site`,
    );
    console.log('公開前に、読み・静止画・npm run check と docs/operations/publish.md の手順を確かめる。');
  };
  if (values['dry-run']) await create();
  else
    await withLock(path.join(ROOT, '.work/locks/scaffold.lock'), create, { what: '講座のひな形作成', timeoutMs: 5000 });
};

if (import.meta.main) await runMain(main);
