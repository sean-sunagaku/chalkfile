// 依存の向きの決まり（biome.jsonc の noRestrictedImports）が効いているかの点検。
//   engine/core/ は engine/core/ の外を読まない ・ content/ が読んでよいのは content/ の中と engine/core/ だけ ・
//   src/ で content/ を読むのは src/project.ts だけ ・ scripts/ は src/ の内部を読まない
// 今の biome.jsonc を一時のフォルダに写し、同じ置き場所に「わざと決まりを破る import」と「守った import」の見本を置いて、
// Biome の lint が破ったものだけを止めるかを見る（決まりを書き換えて効かなくなったら、ここで落ちる）
import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parse } from 'jsonc-parser';

const ROOT = path.resolve(import.meta.dir, '../..');
const BIOME = path.join(ROOT, 'node_modules/.bin/biome');

/** 見本 1 つ。file は置き場所（リポジトリの直下から）、line は 1 行の import、stop は lint が止めるべきか */
type Probe = { file: string; line: string; stop: boolean };

const PROBES: Probe[] = [
  // engine/core/: 同じフォルダのファイル（./）だけ
  { file: 'engine/core/probe-a.ts', line: "import { x } from './schema';", stop: false },
  { file: 'engine/core/probe-b.ts', line: "import { x } from '../../content/themes';", stop: true },
  { file: 'engine/core/probe-c.ts', line: "import type { x } from '../../content/types';", stop: true },
  { file: 'engine/core/probe-d.ts', line: "import { x } from '../../src/video.config';", stop: true },
  { file: 'engine/core/probe-e.ts', line: "import { x } from 'react';", stop: true },
  { file: 'engine/core/probe-f.ts', line: "import { x } from 'node:crypto';", stop: true },
  { file: 'engine/core/probe-g.ts', line: "import { x } from '@remotion/google-fonts/Inter';", stop: true },
  { file: 'engine/core/probe-h.ts', line: "export * from '../../scripts/voices';", stop: true },
  // content/ の直下（共通のファイル）
  { file: 'content/probe-a.ts', line: "export * from '../engine/core/schema';", stop: false },
  { file: 'content/probe-b.ts', line: "import { x } from './courses';", stop: false },
  { file: 'content/probe-c.ts', line: "import { x } from '../src/theme';", stop: true },
  { file: 'content/probe-d.ts', line: "import { x } from '../scripts/voices';", stop: true },
  // 講座のフォルダ（講座の中・講座どうし・content/ の共通のファイル・engine/core/ は読める）
  { file: 'content/sample/probe-a.ts', line: "import type { x } from '../types';", stop: false },
  { file: 'content/sample/probe-b.ts', line: "import { x } from './course';", stop: false },
  { file: 'content/sample/probe-c.ts', line: "import { x } from '../other-course/sources';", stop: false },
  { file: 'content/sample/probe-d.ts', line: "import { x } from '../../engine/core/sources';", stop: false },
  { file: 'content/sample/probe-e.ts', line: "import { x } from '../../src/components/icons';", stop: true },
  { file: 'content/sample/probe-f.ts', line: "import { x } from '../../engine/other/x';", stop: true },
  { file: 'content/sample/probe-g.ts', line: "import { x } from 'lucide-react';", stop: true },
  { file: 'content/sample/probe-h.ts', line: "import { x } from 'node:fs';", stop: true },
  { file: 'content/sample/probe-i.ts', line: "import { x } from '../../site/media-shared';", stop: true },
  // 訳のフォルダ（1 段深い）
  { file: 'content/sample/en/probe-a.ts', line: "import type { x } from '../../i18n';", stop: false },
  { file: 'content/sample/en/probe-b.ts', line: "import { x } from '../../../engine/core/i18n';", stop: false },
  { file: 'content/sample/en/probe-c.ts', line: "import { x } from '../../../src/theme';", stop: true },
  // src/: content/ を読むのは src/project.ts だけ
  { file: 'src/probe-a.tsx', line: "import { x } from '../content';", stop: true },
  { file: 'src/probe-b.tsx', line: "import type { x } from '../content/types';", stop: true },
  { file: 'src/scenes/probe-a.tsx', line: "import type { x } from '../../content/types';", stop: true },
  { file: 'src/scenes/probe-b.tsx', line: "import { x } from '../../content/voices';", stop: true },
  { file: 'src/scenes/probe-c.tsx', line: "import type { x } from '../../engine/core/schema';", stop: false },
  { file: 'src/scenes/probe-d.tsx', line: "import { x } from '../components/content';", stop: false },
  { file: 'src/scenes/probe-e.tsx', line: "import { x } from '../../scripts/lib/paths';", stop: true },
  { file: 'src/project.ts', line: "import { x } from '../content';", stop: false },
  // scripts/: src/ の内部を読まない
  { file: 'scripts/probe-a.ts', line: "import { x } from '../src/video.config';", stop: true },
  { file: 'scripts/probe-b.ts', line: "import { x } from '../engine/core/video-config';", stop: false },
  { file: 'scripts/probe-c.ts', line: "import { x } from '../content';", stop: false },
  { file: 'scripts/lib/probe-a.ts', line: "import { x } from '../../src/scenes';", stop: true },
  { file: 'scripts/stages/timeline/probe-a.ts', line: "import { x } from '../../../src/theme';", stop: true },
];

type Diagnostic = { category?: string; severity?: string; location?: { path?: string } };

/** 見本を一時のフォルダに置き、今の biome.jsonc で lint して、import の決まりで止まったファイルを返す */
const stoppedFiles = (probes: Probe[]): Set<string> => {
  const dir = mkdtempSync(path.join(tmpdir(), 'chalkfile-import-rules-'));
  try {
    const config = parse(readFileSync(path.join(ROOT, 'biome.jsonc'), 'utf8')) as Record<string, unknown>;
    // 一時のフォルダは Git の外なので vcs を切る。GritQL の決まり（plugins）は、ここでは見ない（置き場所の相対パスが変わるため）
    delete config.$schema;
    delete config.plugins;
    config.vcs = { enabled: false };
    writeFileSync(path.join(dir, 'biome.json'), JSON.stringify(config));
    for (const p of probes) {
      mkdirSync(path.dirname(path.join(dir, p.file)), { recursive: true });
      writeFileSync(path.join(dir, p.file), `${p.line}\nexport const probe = typeof x;\n`);
    }
    const r = spawnSync(BIOME, ['lint', '--reporter=json', '--colors=off', '--max-diagnostics=none', '.'], {
      cwd: dir,
      encoding: 'utf8',
    });
    const report = JSON.parse(r.stdout) as { diagnostics: Diagnostic[] };
    return new Set(
      report.diagnostics
        .filter((d) => d.category === 'lint/style/noRestrictedImports' && d.severity === 'error')
        .map((d) => d.location?.path ?? ''),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

describe('依存の向きの決まり（biome.jsonc の noRestrictedImports）', () => {
  const stopped = stoppedFiles(PROBES);
  for (const p of PROBES) {
    test(`${p.file}: ${p.line} を${p.stop ? '止める' : '止めない'}`, () => {
      expect(`${p.file} ${stopped.has(p.file) ? '止めた' : '通した'}`).toBe(
        `${p.file} ${p.stop ? '止めた' : '通した'}`,
      );
    });
  }
});
