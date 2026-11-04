// 台本の形を、文字と動画を変えずに移す。書く前に全ファイルを読み、予定した差分だけを書き出す。
//   npm run codemod:content                 # 教材・出典・書き方を移す差分の一覧（書かない）
//   npm run codemod:content -- --write      # 教材を分け、出典をまとめ、共通の書き方へ移す
// 終了コード: 0 できた・1 移せない形がある・2 使い方の誤り
import { parse } from '@babel/parser';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Course, Source } from '../content/types';
import { comedyCast } from '../content/_shared/comedy';
import config from '../chalkfile.config';
import { MATERIALS_REGISTRY, materialsRegistry } from './gen_materials_registry';
import { readArgs, runMain, showHelp } from './lib/args';
import { writeAtomic } from './lib/fsx';
import { ROOT } from './lib/paths';
import { listFiles } from './stages/pipeline/digest';

type Node = Record<string, unknown> & { type: string; start: number; end: number };
const isNode = (value: unknown): value is Node =>
  typeof value === 'object' &&
  value !== null &&
  'type' in value &&
  typeof value.type === 'string' &&
  'start' in value &&
  typeof value.start === 'number' &&
  'end' in value &&
  typeof value.end === 'number';

const walk = (
  node: Node,
  visit: (node: Node, parent?: Node, key?: string) => void | boolean,
  parent?: Node,
  key?: string,
) => {
  if (visit(node, parent, key) === false) return;
  for (const [childKey, value] of Object.entries(node)) {
    if (Array.isArray(value)) {
      for (const child of value) if (isNode(child)) walk(child, visit, node, childKey);
    } else if (isNode(value)) walk(value, visit, node, childKey);
  }
};

const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const tree = (source: string): Node => {
  const ast: unknown = parse(source, { sourceType: 'module', plugins: ['typescript'] });
  if (!isNode(ast)) throw new Error('台本を読めない');
  return ast;
};
type Edit = { start: number; end: number; text: string };
const edited = (source: string, edits: Edit[]): string => {
  let boundary = source.length;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    if (edit.end > boundary) throw new Error('書き換える場所が重なっている');
    source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
    boundary = edit.start;
  }
  return source;
};
const propertyName = (node: Node): string | undefined => {
  if (!isNode(node.key)) return;
  return node.key.type === 'Identifier'
    ? String(node.key.name)
    : node.key.type === 'StringLiteral'
      ? String(node.key.value)
      : undefined;
};
const propertiesOf = (source: string, id: string): Node[] => {
  let result: Node[] | undefined;
  walk(tree(source), (node) => {
    if (node.type !== 'ObjectExpression' || !Array.isArray(node.properties)) return;
    const props = node.properties.filter(isNode);
    if (
      !props.some(
        (prop) =>
          propertyName(prop) === 'id' &&
          isNode(prop.value) &&
          prop.value.type === 'StringLiteral' &&
          prop.value.value === id,
      )
    )
      return;
    if (result) throw new Error(`同じ id の台本が複数ある: ${id}`);
    result = props;
  });
  if (!result) throw new Error(`台本のオブジェクトが無い: ${id}`);
  return result;
};
const valuesOf = (source: string, id: string, values: Record<string, string>) =>
  edited(
    source,
    Object.entries(values).map(([key, text]) => {
      const property = propertiesOf(source, id).find((prop) => propertyName(prop) === key);
      if (!property || !isNode(property.value)) throw new Error(`台本の項目が無い: ${id}.${key}`);
      const padding =
        source.slice(source.lastIndexOf('\n', property.start) + 1, property.start).match(/^\s*/)?.[0] ?? '';
      return { start: property.value.start, end: property.value.end, text: text.replace(/\n/g, `\n${padding}`) };
    }),
  );

const statementRange = (source: string, node: Node): { start: number; end: number } => {
  const line = source.lastIndexOf('\n', node.start) + 1;
  const start = source.slice(line, node.start).trim() ? node.start : line;
  const end = source[node.end] === '\n' ? node.end + 1 : node.end;
  return { start, end };
};

/** 消した出典の宣言と、残った import を AST で整理する。文字列やコメントの同じ語には触らない。 */
const withoutSourceDeclarations = (source: string): string => {
  const edits: Edit[] = [];
  walk(tree(source), (node, parent) => {
    if (node.type !== 'VariableDeclaration' || !Array.isArray(node.declarations) || node.declarations.length !== 1)
      return;
    const declaration = node.declarations[0];
    if (!isNode(declaration) || !isNode(declaration.id) || declaration.id.type !== 'Identifier') return;
    const name = String(declaration.id.name);
    if (!name.endsWith('_SOURCES') && name !== 'ALL') return;
    if (!isNode(declaration.init) || !['ArrayExpression', 'CallExpression'].includes(declaration.init.type)) return;
    const statement = parent?.type === 'ExportNamedDeclaration' ? parent : node;
    edits.push({ ...statementRange(source, statement), text: '' });
  });
  return edited(source, edits);
};

const cleanImports = (source: string, remove: readonly string[] = []): string => {
  const ast = tree(source);
  const names = new Set<string>();
  const imports: Node[] = [];
  walk(ast, (node, parent, key) => {
    if (node.type === 'ImportDeclaration') {
      imports.push(node);
      return false;
    }
    if (node.type !== 'Identifier') return;
    if (
      parent &&
      !parent.computed &&
      ((parent.type === 'ObjectProperty' && key === 'key') ||
        (parent.type === 'MemberExpression' && key === 'property'))
    )
      return;
    names.add(String(node.name));
    return;
  });
  const edits: Edit[] = [];
  for (const declaration of imports) {
    if (!Array.isArray(declaration.specifiers) || !isNode(declaration.source)) continue;
    const specifiers = declaration.specifiers.filter(isNode);
    if (!specifiers.length) continue;
    const kept = specifiers.filter(
      (specifier) =>
        isNode(specifier.local) &&
        names.has(String(specifier.local.name)) &&
        !remove.includes(String(specifier.local.name)),
    );
    if (kept.length === specifiers.length) continue;
    let text = '';
    if (kept.length) {
      const named = kept.filter((specifier) => specifier.type === 'ImportSpecifier');
      const other = kept
        .filter((specifier) => specifier.type !== 'ImportSpecifier')
        .map((specifier) => source.slice(specifier.start, specifier.end));
      if (named.length)
        other.push(`{ ${named.map((specifier) => source.slice(specifier.start, specifier.end)).join(', ')} }`);
      text = `import ${declaration.importKind === 'type' ? 'type ' : ''}${other.join(', ')} from ${source.slice(declaration.source.start, declaration.source.end)};\n`;
    }
    edits.push({ ...statementRange(source, declaration), text });
  }
  return edited(source, edits);
};

type LinkSource = Pick<Source, 'id' | 'title' | 'url'>;
const sourceTitle = (source: Source | LinkSource) =>
  'publisher' in source ? `${source.publisher}（${source.year}）${source.title}` : source.title;

const sourceOutputs = async (courses: readonly Course[], outputs: Map<string, string>) => {
  const current = (file: string) => outputs.get(file) ?? read(file);
  for (const course of courses) {
    const file = `content/${course.id}/sources.ts`;
    // 移したあとは、表に残した ID も使う。新しいリンクを足しても、前の ID を振り直さない。
    const previous = existsSync(path.join(ROOT, file))
      ? ((await import(path.join(ROOT, file))) as { SOURCE_TABLE?: { all: (Source | LinkSource)[] } })
      : undefined;
    const rows: (Source | LinkSource)[] = [...(previous?.SOURCE_TABLE?.all ?? course.sources ?? [])];
    const used = new Set(rows.map((source) => source.id));
    const prefix = `${course.prefix.toLowerCase()}-doc-`;
    let sequence = Math.max(
      0,
      ...rows
        .filter((source) => source.id.startsWith(prefix))
        .map((source) => Number(source.id.slice(prefix.length)))
        .filter(Number.isFinite),
    );
    const selectors = (docs: Course['lectures'][number]['docs']) =>
      docs.map((doc) => {
        let source =
          rows.find((row) => row.url === doc.url && sourceTitle(row) === doc.title) ??
          rows.find((row) => row.url === doc.url);
        if (!source) {
          let id: string;
          do {
            id = `${course.prefix.toLowerCase()}-doc-${String(++sequence).padStart(3, '0')}`;
          } while (used.has(id));
          source = { id, title: doc.title, url: doc.url };
          rows.push(source);
          used.add(id);
        }
        return sourceTitle(source) === doc.title ? source.id : { id: source.id, title: doc.title };
      });
    for (const lecture of course.lectures) {
      const file = `content/${course.id}/${lecture.id}.ts`;
      let source = valuesOf(current(file), lecture.id, {
        docs: `docsOf(${JSON.stringify(selectors(lecture.docs), null, 2)})`,
      });
      source = withoutSourceDeclarations(source);
      source = cleanImports(source, ['docsOf']);
      outputs.set(file, `import { docsOf } from './sources';\n${source.trimStart()}`);
    }
    const aliases: string[] = [];
    if (existsSync(path.join(ROOT, file)))
      walk(tree(current(file)), (node) => {
        if (node.type === 'VariableDeclarator' && isNode(node.id) && String(node.id.name).endsWith('_SOURCES'))
          aliases.push(String(node.id.name));
      });
    const body = [
      '// 講座の出典と公式リンクの表。章は ID から引き、訳は説明の上書きだけを持つ。',
      "import { defineSources } from '../sources-util';",
      '',
      `export const SOURCE_TABLE = defineSources(${JSON.stringify(rows, null, 2)});`,
      'export const SOURCES = SOURCE_TABLE.sources;',
      'export const docsOf = SOURCE_TABLE.docs;',
      ...aliases.map((alias) => `export const ${alias} = SOURCES;`),
      '',
    ].join('\n');
    outputs.set(file, body);
    const courseFile = `content/${course.id}/course.ts`;
    if (course.sources !== undefined) {
      let source = valuesOf(current(courseFile), course.id, { sources: 'SOURCES' });
      source = cleanImports(source, ['SOURCES']);
      outputs.set(courseFile, `import { SOURCES } from './sources';\n${source.trimStart()}`);
    } else outputs.set(courseFile, cleanImports(current(courseFile)));
  }

  // 真面目版とお笑い版が共用する文字は、章どうしを import せず、共用のデータへ移す。
  const nudge = courses.find((course) => course.id === 'nudge-product');
  const lecture = nudge?.lectures.find((row) => row.id === 'N01');
  if (!nudge || !lecture) throw new Error('共用するナッジの台本が無い');
  outputs.set(
    'content/nudge-product/N01.learning.ts',
    [
      '// 真面目版とお笑い版が共用するクイズと要点。',
      "import type { Lecture } from '../types';",
      `export const N01_LEARNING: Pick<Lecture, 'quiz' | 'takeaways'> = ${JSON.stringify({ quiz: lecture.quiz, takeaways: lecture.takeaways }, null, 2)};`,
      '',
    ].join('\n'),
  );
  for (const [courseId, id, from] of [
    ['nudge-product', 'N01', './N01.learning'],
    ['nudge-comedy', 'W01', '../nudge-product/N01.learning'],
  ] as const) {
    const file = `content/${courseId}/${id}.ts`;
    let source = valuesOf(current(file), id, { quiz: 'N01_LEARNING.quiz', takeaways: 'N01_LEARNING.takeaways' });
    source = cleanImports(source, ['N01_LEARNING']);
    outputs.set(file, `import { N01_LEARNING } from '${from}';\n${source.trimStart()}`);
  }
  outputs.set(
    'content/nudge-product/course.shared.ts',
    [
      '// 真面目版とお笑い版が共用する章の名前。',
      "import type { Course } from '../types';",
      `export const NUDGE_SECTIONS: Course['sections'] = ${JSON.stringify(nudge.sections, null, 2)};`,
      '',
    ].join('\n'),
  );
  for (const [id, from] of [
    ['nudge-product', './course.shared'],
    ['nudge-comedy', '../nudge-product/course.shared'],
  ] as const) {
    const file = `content/${id}/course.ts`;
    let source = valuesOf(current(file), id, { sections: 'NUDGE_SECTIONS' });
    source = cleanImports(source, ['NUDGE_SECTIONS']);
    outputs.set(file, `import { NUDGE_SECTIONS } from '${from}';\n${source.trimStart()}`);
  }
};

const literal = (node: unknown, value: string | number): boolean =>
  isNode(node) && ['StringLiteral', 'NumericLiteral'].includes(node.type) && node.value === value;
const objectProperties = (node: Node): Node[] => (Array.isArray(node.properties) ? node.properties.filter(isNode) : []);
const findProperty = (node: Node, name: string) =>
  objectProperties(node).find((property) => propertyName(property) === name);

const sceneHelpers = (source: string): { source: string; helpers: string[] } => {
  const edits: Edit[] = [];
  const helpers = new Set<string>();
  walk(tree(source), (node) => {
    if (node.type === 'CallExpression' && isNode(node.callee) && ['goals', 'flow'].includes(String(node.callee.name))) {
      helpers.add(String(node.callee.name));
      return false;
    }
    if (node.type !== 'ObjectExpression') return;
    const kind = findProperty(node, 'kind');
    if (!kind || !isNode(kind.value) || !['goals', 'flow'].includes(String(kind.value.value))) return;
    const name = String(kind.value.value);
    helpers.add(name);
    let body = source.slice(node.start, node.end);
    if (name === 'goals') {
      const inside: Edit[] = [];
      const itemArray = findProperty(node, 'items')?.value;
      const lineArray = findProperty(node, 'lines')?.value;
      const items = isNode(itemArray) && Array.isArray(itemArray.elements) ? itemArray.elements.filter(isNode) : [];
      const lines = isNode(lineArray) && Array.isArray(lineArray.elements) ? lineArray.elements.filter(isNode) : [];
      items.forEach((item, index) => {
        const properties = objectProperties(item);
        const text = findProperty(item, 'text')?.value;
        const at = findProperty(item, 'at')?.value;
        if (
          properties.length !== 2 ||
          propertyName(properties[0]!) !== 'text' ||
          !isNode(text) ||
          !literal(at, index + 1)
        )
          return;
        inside.push({
          start: item.start - node.start,
          end: item.end - node.start,
          text: source.slice(text.start, text.end),
        });
      });
      const automaticPop =
        lines.length === items.length + 1 &&
        lines.slice(1).every((line) => {
          const properties = objectProperties(line);
          const sfx = findProperty(line, 'sfx');
          return sfx !== undefined && properties.at(-1) === sfx && literal(sfx.value, 'pop');
        });
      if (automaticPop) {
        for (const line of lines.slice(1)) {
          const properties = objectProperties(line);
          const previous = properties.at(-2);
          const sfx = properties.at(-1);
          if (!previous || !sfx) throw new Error('pop の手前に台詞が無い');
          inside.push({ start: previous.end - node.start, end: sfx.end - node.start, text: '' });
        }
      } else {
        const indent = node.start - source.lastIndexOf('\n', node.start) - 1;
        inside.push({ start: 1, end: 1, text: `\n${' '.repeat(indent + 2)}pop: false,` });
      }
      body = edited(body, inside);
    }
    edits.push({ start: node.start, end: node.end, text: `${name}(${body})` });
    return false;
  });
  source = cleanImports(edited(source, edits), ['flow', 'goals']);
  if (helpers.size)
    source = `import { ${[...helpers].sort().join(', ')} } from '../_shared/scenes';\n${source.trimStart()}`;
  return { source, helpers: [...helpers] };
};

const voiceAliases = { Z: 'zundamon', ZC: 'zundamon-cry', T: 'tsukkomi', TEN: 'tennokoe' } as const;
const commonVoices = (source: string): string => {
  const edits: Edit[] = [];
  walk(tree(source), (node) => {
    if (node.type !== 'VariableDeclaration' || !Array.isArray(node.declarations) || node.declarations.length !== 1)
      return;
    const declaration = node.declarations[0];
    if (!isNode(declaration) || !isNode(declaration.id)) return;
    const name = String(declaration.id.name);
    if (!Object.hasOwn(voiceAliases, name)) return;
    const init =
      isNode(declaration.init) && declaration.init.type === 'TSAsExpression'
        ? declaration.init.expression
        : declaration.init;
    if (!literal(init, voiceAliases[name as keyof typeof voiceAliases])) return;
    const range = statementRange(source, node);
    const lineEnd = source.indexOf('\n', node.end);
    if (lineEnd >= 0 && source.slice(node.end, lineEnd).trim().startsWith('//')) range.end = lineEnd + 1;
    edits.push({ ...range, text: '' });
  });
  source = cleanImports(edited(source, edits), Object.keys(voiceAliases));
  const used = new Set<string>();
  walk(tree(source), (node) => {
    if (node.type === 'ImportDeclaration') return false;
    if (node.type === 'Identifier') used.add(String(node.name));
    return;
  });
  const names = Object.keys(voiceAliases).filter((name) => used.has(name));
  return names.length ? `import { ${names.join(', ')} } from '../_shared/comedy';\n${source.trimStart()}` : source;
};

const helperOutputs = (courses: readonly Course[], outputs: Map<string, string>) => {
  const current = (file: string) => outputs.get(file) ?? read(file);
  const knownCourses = new Set(courses.map((course) => course.id));
  for (const course of courses) {
    for (const lecture of course.lectures) {
      const file = `content/${course.id}/${lecture.id}.ts`;
      outputs.set(file, commonVoices(sceneHelpers(current(file)).source));
    }
    const file = `content/${course.id}/course.ts`;
    let source = current(file);
    const imports: string[] = [];
    if (course.cast && JSON.stringify(course.cast) === JSON.stringify(comedyCast())) {
      source = valuesOf(source, course.id, { cast: 'comedyCast()' });
      imports.push("import { comedyCast } from '../_shared/comedy';");
    }
    if (course.links) {
      const links = course.links.map((link) => {
        const url = new URL(link.url);
        const id = url.pathname.replace(/^\//, '').replace(/\/$/, '');
        return url.origin === new URL(config.origin).origin && !url.search && !url.hash && knownCourses.has(id)
          ? { label: link.label, course: id }
          : link;
      });
      source = valuesOf(source, course.id, { links: `courseLinks(${JSON.stringify(links, null, 2)})` });
      imports.push("import { courseLinks } from '../_shared/links';");
    }
    source = cleanImports(source, ['comedyCast', 'courseLinks']);
    outputs.set(file, imports.length ? `${imports.join('\n')}\n${source.trimStart()}` : source);
  }
};

/** Babel の位置も slice も UTF-16 の番号を使う。日本語の前後でも、本文をそのまま移せる。 */
const splitMaterial = (file: string, source: string): { source: string; target: string; body: string } | null => {
  const ast: unknown = parse(source, { sourceType: 'module', plugins: ['typescript'] });
  if (!isNode(ast)) throw new Error(`台本を読めない: ${file}`);
  const properties: Node[] = [];
  walk(ast, (node) => {
    if (
      node.type === 'ObjectProperty' &&
      isNode(node.key) &&
      node.key.type === 'Identifier' &&
      node.key.name === 'material'
    )
      properties.push(node);
  });
  if (!properties.length) return null;
  if (properties.length !== 1) throw new Error(`material が 1 つでない: ${file}`);
  const property = properties[0]!;
  const value = property.value;
  if (!isNode(value) || value.type !== 'ObjectExpression') throw new Error(`教材がオブジェクトでない: ${file}`);
  walk(value, (node, parent, key) => {
    if (node.type !== 'Identifier') return;
    if (
      parent &&
      !parent.computed &&
      ((parent.type === 'ObjectProperty' && key === 'key') ||
        (parent.type === 'MemberExpression' && key === 'property'))
    )
      return;
    if (node.name === 'undefined') return;
    throw new Error(`教材の外の名前を使っているので止める: ${file} ${String(node.name)}`);
  });
  const id = path.basename(file, '.ts');
  const target = file.replace(/\.ts$/, '.material.ts');
  const body = [
    '// 動画から分けた、読む教材・実践課題・AI チャットの質問例。',
    "import type { ChapterMaterial } from '../types';",
    '',
    `export const ${id}_MATERIAL: ChapterMaterial = ${source.slice(value.start, value.end)};`,
    '',
  ].join('\n');
  if (existsSync(path.join(ROOT, target)) && read(target) !== body)
    throw new Error(`移す先に別の内容がある: ${target}`);
  const start = source.lastIndexOf('\n', property.start) + 1;
  if (source.slice(start, property.start).trim()) throw new Error(`教材が行の先頭でない: ${file}`);
  const end = source[property.end] === ',' ? property.end + 1 : property.end;
  return { source: source.slice(0, start) + source.slice(end), target, body };
};

const catalogExports =
  'AUTHORED_COURSES, SHARED_LINES, COURSES, LECTURES, courseOf, TRANSLATIONS, coursesIn, VIDEOS, videoOf';
const catalogEntry = (materials: boolean): string =>
  [
    materials
      ? '// 全講座の入口。動画だけの台本に、読む教材を付ける。'
      : '// 動画だけの入口。読む教材（*.material.ts）を依存関係に入れない。',
    "import { createCatalog } from '../engine/core/catalog';",
    ...(materials
      ? ["import { materialDecorator } from '../engine/core/materials';", "import { MATERIALS } from './materials';"]
      : []),
    "import * as REGISTRY from './courses';",
    "export type { Video } from './types';",
    '',
    'const modules = Object.values(REGISTRY);',
    ...(materials ? ['const decorate = materialDecorator(modules.map((module) => module.course), MATERIALS);'] : []),
    `export const { ${catalogExports} } = createCatalog(modules${materials ? ', decorate' : ''});`,
    '',
  ].join('\n');

const main = async (argv: string[]) => {
  const { values } = readArgs(argv, { write: { type: 'boolean' } });
  if (values.help) return showHelp(import.meta.filename);
  const files = listFiles(ROOT, ['content']);
  const outputs = new Map<string, string>();
  for (const file of files.filter((file) => /^content\/[^/]+\/[A-Z]\d{2}\.ts$/.test(file))) {
    const split = splitMaterial(file, read(file));
    if (!split) continue;
    outputs.set(file, split.source);
    outputs.set(split.target, split.body);
  }
  const { COURSES } = await import('../content');
  await sourceOutputs(COURSES, outputs);
  helperOutputs(COURSES, outputs);
  outputs.set(MATERIALS_REGISTRY, materialsRegistry(ROOT, [...new Set([...files, ...outputs.keys()])]));
  outputs.set('content/index.ts', catalogEntry(true));
  outputs.set('content/videos.ts', catalogEntry(false));
  const stale = [...outputs].filter(([file, body]) => !existsSync(path.join(ROOT, file)) || read(file) !== body);
  for (const [file, body] of stale) {
    console.log(`${values.write ? '書く' : '予定'} ${file}`);
    if (values.write) writeAtomic(path.join(ROOT, file), body);
  }
  console.log(`${stale.length} ファイル${values.write ? 'を書いた' : 'を移す（書いていない）'}`);
  return 0;
};

if (import.meta.main) await runMain(main);
