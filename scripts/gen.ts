// 講座のフォルダの台本と生成物から、全体の生成物を作る（npm run gen）。生成物がぶつかったら、main を取り込んでからこれで作り直す。
//   bun scripts/gen.ts            # 作る
//   bun scripts/gen.ts --check    # 作らずに、今のファイルと比べる（違えば一覧を出して 1 で終える）
//   bun scripts/gen.ts --media    # Worker の許可リストと実行時の設定を作る（wrangler の前。dev:worker・CI の build・deploy.yml が流す）
// 作るもの:
//   worker/src/generated/media-manifest.json   全講座の動画の一覧（Worker の許可リスト。Git に入れない）。講座ごとの
//                                              content/<講座>/generated/media.<言語>.json を、講座の登録の順につなぐ（scripts/media.ts）
//   README.md の講座の表                        <!-- courses:start --> と <!-- courses:end --> の間。講座の登録（COURSES）と timeline から
//   docs/guide/new-course.md の頭文字の表        <!-- prefixes:start --> と <!-- prefixes:end --> の間。各講座の prefix と order から
//   docs/guide/commands.md の chalk の表          <!-- cli:start --> と <!-- cli:end --> の間。scripts/cli.ts のコマンドの一覧（npm run chalk -- help の元）から
//   scripts/audio/sfx.json                     Python の道具（mix.py・build_music.py）が読む効果音の一覧。content/sfx.ts から（Git に入れる）
//   scripts/audio/video_config.json            Python の道具が読む動画の値。engine/core/video-config.ts から（Git に入れる。npm run gen:video-config と同じ）
// 表のずれは npm run check:docs（scripts/check_docs.ts）も、Python が読む JSON のずれは npm test（tests/handoff.test.ts・video-config.test.ts）も止める。
// 終了コード: 0 できた（--check は同じ）・1 違う・2 使い方の誤り
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { COURSES, coursesIn } from '../content';
import { type Lang, TRANSLATED_LANGS, videoKey } from '../content/i18n';
import type { Course } from '../content/types';
import { freePrefixes } from '../engine/core/validate';
import { commandTable } from './cli';
import { CORE_SETTINGS, WORKER_SETTINGS, LANGUAGE_SETTINGS, MEDIA_SETTINGS, mediaSettings, coreSettings, workerSettings, languageSettings, workflowSettings, wranglerSettings } from './gen_project_config';
import { VIDEO_CONFIG_JSON, videoConfigJson } from './gen_video_config';
import { readArgs, runMain, showHelp } from './lib/args';
import { readSiteConfig } from './lib/config';
import { writeAtomic } from './lib/fsx';
import { SFX_JSON, sfxJson } from './lib/handoff';
import { ROOT } from './lib/paths';
import { readMediaManifest } from './media';
import { mediaManifestJson } from './media-lists';
import { readTimelinesByKey } from './timelines';

/** Worker の許可リスト（wrangler が worker/src/index.ts と一緒にまとめる。Git に入れない） */
export const WORKER_MEDIA = 'worker/src/generated/media-manifest.json';

/* ───────────── 文書の中の生成した表 ───────────── */

/** 文書の中の、生成した表を置く場所（<!-- name:start --> と <!-- name:end --> の間）を body に置き換える */
export const replaceBlock = (text: string, name: string, body: string, file = ''): string => {
  const start = `<!-- ${name}:start -->`;
  const end = `<!-- ${name}:end -->`;
  const a = text.indexOf(start);
  const b = text.indexOf(end);
  if (a < 0 || b < a) throw new Error(`${file}: 生成した表を置く印（${start} と ${end}）が無い`);
  return `${text.slice(0, a + start.length)}\n${body}\n${text.slice(b)}`;
};

/** 表のセル（| と改行と強調の ** を外す） */
const cell = (s: string) =>
  s
    .replace(/\*\*/g, '')
    .replace(/\|/g, '｜')
    .replace(/\s*\n\s*/g, ' ')
    .trim();
const LANG_JA: Record<Exclude<Lang, 'ja'>, string> = { en: '英語', zh: '中国語' };

/** 講座の日本語の動画の長さ（分。timeline から）と、timeline の無い動画の数 */
const minutesOf = (c: Course, timelines: ReturnType<typeof readTimelinesByKey>) => {
  let seconds = 0;
  let missing = 0;
  for (const l of c.lectures) {
    const t = timelines.get(videoKey(l.id, 'ja'))?.[0]?.timeline;
    if (t) seconds += t.durationInFrames / t.fps;
    else missing++;
  }
  return { minutes: Math.round(seconds / 60), missing };
};

/** README の講座の表（講座の登録の順。長さは timeline から。訳は公開していない言語に「未公開」を付ける） */
export const courseTable = (): string => {
  const config = readSiteConfig();
  const base = config.baseUrl.endsWith('/') ? config.baseUrl : `${config.baseUrl}/`;
  const timelines = readTimelinesByKey();
  const rows = COURSES.map((c) => {
    const unit = c.unitLabel === 'CHAPTER' ? '章' : '本';
    const planned =
      c.syllabus && c.syllabus.chapters.length > c.lectures.length ? `（計画 ${c.syllabus.chapters.length} 章）` : '';
    const { minutes, missing } = minutesOf(c, timelines);
    const langs = TRANSLATED_LANGS.filter((l) => coursesIn(l).some((x) => x.id === c.id));
    const hidden = langs.filter((l) => !config.publishLangs.includes(l));
    const names = langs.map((l) => LANG_JA[l]).join('・');
    const tr = !langs.length
      ? '—'
      : hidden.length === langs.length
        ? `${names}（未公開）`
        : hidden.length
          ? `${names}（${hidden.map((l) => LANG_JA[l]).join('・')}は未公開）`
          : names;
    const length = `約 ${minutes} 分${missing ? `（未合成 ${missing} 本）` : ''}`;
    return `| [${cell(c.title)}](${base}${c.id}/) | ${cell(c.subtitle)} | \`${c.id}\` | ${c.lectures.length} ${unit}${planned} | ${length} | ${tr} |`;
  });
  return [
    '<!-- npm run gen が、講座の登録（content/courses.ts）と timeline から作る。手で直さない -->',
    '',
    '| 講座 | 中身 | ID | 本数 | 長さ | 訳 |',
    '|---|---|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');
};

/** new-course.md の頭文字の表（講座の登録の順）と、空いている文字 */
export const prefixTable = (): string =>
  [
    '<!-- npm run gen が、各講座の course.ts の prefix と order から作る。手で直さない -->',
    '',
    '| 頭文字 | 講座 ID | 並び（order） |',
    '|---|---|---|',
    ...COURSES.map((c) => `| \`${c.prefix}\` | \`${c.id}\` | ${c.order} |`),
    '',
    `- 空いている文字: ${freePrefixes(COURSES).join(' ')}（X はテストの見本が使う）`,
    '',
  ].join('\n');

/** 生成した表を入れた文書（リポジトリの直下からのパス → 中身）。scripts/check_docs.ts も、これと比べてずれを止める */
export const docOutputs = (root = ROOT): Map<string, string> => {
  const out = new Map<string, string>();
  const put = (file: string, name: string, body: string) =>
    out.set(file, replaceBlock(out.get(file) ?? readFileSync(path.join(root, file), 'utf8'), name, body, file));
  put('README.md', 'courses', courseTable());
  put('docs/guide/new-course.md', 'prefixes', prefixTable());
  put('docs/guide/commands.md', 'cli', commandTable());
  return out;
};

/* ───────────── 全部 ───────────── */

/** 設定から作る追跡済みのファイル。check:docs も比べる。 */
export const projectOutputs = (root = ROOT): Map<string, string> => {
  const out = new Map<string, string>();
  out.set(CORE_SETTINGS, coreSettings());
  out.set(LANGUAGE_SETTINGS, languageSettings(readFileSync(path.join(root, LANGUAGE_SETTINGS), 'utf8')));
  out.set(MEDIA_SETTINGS, mediaSettings(readFileSync(path.join(root, MEDIA_SETTINGS), 'utf8')));
  out.set('wrangler.jsonc', wranglerSettings(readFileSync(path.join(root, 'wrangler.jsonc'), 'utf8')));
  for (const name of ['ci', 'deploy', 'canary']) {
    const file = `.github/workflows/${name}.yml`;
    out.set(file, workflowSettings(readFileSync(path.join(root, file), 'utf8'), name === 'canary'));
  }
  return out;
};

/** 作る生成物。media だけにすると、Worker の許可リストと実行時の設定。 */
export const generated = (only?: 'media'): Map<string, string> => {
  const out = new Map<string, string>();
  out.set(WORKER_MEDIA, mediaManifestJson(readMediaManifest()));
  out.set(WORKER_SETTINGS, workerSettings());
  for (const [file, text] of projectOutputs()) {
    if (only === 'media' && file !== CORE_SETTINGS && file !== LANGUAGE_SETTINGS && file !== MEDIA_SETTINGS) continue;
    out.set(file, text);
  }
  if (only === 'media') return out;
  for (const [file, text] of docOutputs()) out.set(file, text);
  // Python の道具が読む JSON（Python は TS を読めないので、値を JSON に書き出して渡す）
  out.set(SFX_JSON, sfxJson());
  out.set(path.relative(ROOT, VIDEO_CONFIG_JSON), videoConfigJson());
  return out;
};

/** 今のファイルと違う生成物（無いものも違うとする） */
export const staleOutputs = (outputs: Map<string, string>, root = ROOT): string[] =>
  [...outputs]
    .filter(
      ([file, text]) => !existsSync(path.join(root, file)) || readFileSync(path.join(root, file), 'utf8') !== text,
    )
    .map(([file]) => file);

const main = (argv: string[]) => {
  const { values } = readArgs(argv, { check: { type: 'boolean' }, media: { type: 'boolean' } });
  if (values.help) return showHelp(import.meta.filename);
  const outputs = generated(values.media ? 'media' : undefined);
  const stale = staleOutputs(outputs);
  if (values.check) {
    for (const f of stale) console.log(`違う: ${f}（npm run gen で作り直す）`);
    console.log(
      stale.length
        ? `生成物が ${stale.length} 個、作り直したものと違う`
        : `生成物は作り直したものと同じ（${outputs.size} 個）`,
    );
    return stale.length ? 1 : 0;
  }
  for (const [file, text] of outputs) {
    if (stale.includes(file)) writeAtomic(path.join(ROOT, file), text);
  }
  console.log(
    `生成物 ${outputs.size} 個（作り直した ${stale.length} 個${stale.length ? `: ${stale.join(' ')}` : ''}）`,
  );
};

if (import.meta.main) await runMain(main);
