// 分けた教材を集める入口。npm run gen と台本の codemod が同じ形で作る。
import path from 'node:path';
import { ROOT } from './lib/paths';
import { listFiles } from './stages/pipeline/digest';

export const MATERIALS_REGISTRY = 'content/materials.ts';

export const materialsRegistry = (root = ROOT, files = listFiles(root, ['content'])): string => {
  const rows = files
    .filter((file) => /^content\/[^/]+\/[A-Z]\d{2}\.material\.ts$/.test(file))
    .sort()
    .map((file) => ({ file, id: path.basename(file, '.material.ts') }));
  const ids = new Set<string>();
  for (const row of rows) {
    if (ids.has(row.id)) throw new Error(`教材の ID が重なっている: ${row.id}`);
    ids.add(row.id);
  }
  return [
    '// npm run gen が *.material.ts から作る。手で直さない。動画専用の入口は、このファイルを読まない。',
    "import type { ChapterMaterials } from '../engine/core/materials';",
    ...rows.map(({ file, id }) => `import { ${id}_MATERIAL } from './${file.slice('content/'.length, -3)}';`),
    '',
    'export const MATERIALS: ChapterMaterials = {',
    ...rows.map(({ id }) => `  ${id}: ${id}_MATERIAL,`),
    '};',
    '',
  ].join('\n');
};
