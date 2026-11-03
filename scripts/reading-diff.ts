// 読みの差分。比べる相手（--base。既定は origin/main）と今の作業フォルダで、全部の動画の全部の台詞の読み（VOICEVOX・Kokoro に渡す文）を比べる。
// PR の CI で流すときは、マージの commit の 1 つ目の親（--base HEAD^1。checkout は fetch-depth: 2）と比べる。
//   bun scripts/reading-diff.ts                    # origin/main と比べる（手元に無ければ取ってくる）
//   bun scripts/reading-diff.ts --base HEAD^1      # 比べる相手を変える（git の ref）
//   npm run reading:diff -- --base origin/main
// 読みが変わった台詞と動画の一覧を出す。止めるのは、公開する言語（site/config.json の publishLangs）の公開中の動画で読みが変わったのに、
// その動画を作り直していないとき（講座の動画の一覧 content/<講座>/generated/media.<言語>.json の項目が、比べる相手と同じ）。
// 公開中の動画は古い読みのままなので、合成し直し → mix → render → media push が要る、という合図（docs/operations/publish.md の順番）。
// まだ公開しない言語の動画・まだ公開していない動画・作り直した動画は、知らせるだけ。止めたら 1 で終える。
// 比べる相手の台本は git archive で一時フォルダに取り出して読む（content/ と scripts/voices.ts だけ。content/ は content/ の外を実行時に import しない）
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import type { Video } from '../content';
import type { Lang } from '../content/i18n';
import type { Line } from '../content/types';
import { mediaKey, type MediaManifest } from '../site/media-shared';
import { readCourseMedia } from './media-lists';

const ROOT = path.resolve(import.meta.dir, '..');

/** 台詞 1 つの読み。at は「s<場面>-<台詞>」（scripts/snapshots.ts・.work/kana と同じ） */
export type LineReading = { at: string; voice: string; speech: string; text: string };
/** 動画 1 本の読み */
export type VideoReading = { video: string; lang: string; course: string; lecture: string; lines: LineReading[] };
type SpeechIn = (line: Line, lang: Lang) => string;

/** 動画の一覧から、全部の台詞の読みを作る（読めない台詞は、読めない理由を読みの代わりに入れる。synth が同じ所で止まる） */
export const readingsOf = (videos: readonly Video[], speechIn: SpeechIn): VideoReading[] =>
  videos.map((v) => ({
    video: v.key,
    lang: v.lang,
    course: v.course.id,
    lecture: v.lecture.id,
    lines: v.lecture.scenes.flatMap((s, si) =>
      s.lines.map((l, li) => {
        let speech: string;
        try {
          speech = speechIn(l, v.lang);
        } catch (e) {
          speech = `（読めない: ${e instanceof Error ? e.message : String(e)}）`;
        }
        return { at: `s${si + 1}-${li + 1}`, voice: l.v ?? 'narrator', speech, text: l.t };
      }),
    ),
  }));

/** 台詞 1 つの違い。before が無ければ足した台詞、after が無ければ消した台詞 */
export type LineChange = { at: string; voice: string; text?: string; before?: string; after?: string };
export type VideoChange = { video: string; lang: string; course: string; lecture: string; lines: LineChange[] };

/** 両方にある動画で、読みが変わった台詞（台詞は「s<場面>-<台詞>」の位置で比べる）。足した動画・消した動画は見ない */
export const readingChanges = (base: readonly VideoReading[], head: readonly VideoReading[]): VideoChange[] => {
  const before = new Map(base.map((v) => [v.video, v]));
  const out: VideoChange[] = [];
  for (const v of head) {
    const b = before.get(v.video);
    if (!b) continue;
    const old = new Map(b.lines.map((l) => [l.at, l]));
    const now = new Set(v.lines.map((l) => l.at));
    const lines: LineChange[] = [];
    for (const l of v.lines) {
      const o = old.get(l.at);
      if (!o) lines.push({ at: l.at, voice: l.voice, text: l.text, after: l.speech });
      else if (o.speech !== l.speech)
        lines.push({ at: l.at, voice: l.voice, text: l.text, before: o.speech, after: l.speech });
    }
    for (const o of b.lines)
      if (!now.has(o.at)) lines.push({ at: o.at, voice: o.voice, text: o.text, before: o.speech });
    if (lines.length) out.push({ video: v.video, lang: v.lang, course: v.course, lecture: v.lecture, lines });
  }
  return out;
};

/** 動画の一覧の項目（通常版・字幕を焼き込んだ版）の SHA-256。key は mediaKey（言語/講座/レクチャー/種類） */
export type MediaHashes = ReadonlyMap<string, string>;
export const mediaHashes = (lists: readonly (MediaManifest | null)[]): MediaHashes =>
  new Map(lists.flatMap((m) => m?.entries ?? []).map((e) => [mediaKey(e), e.sha256]));

/**
 * 読みが変わった動画を、止めるもの・作り直したもの・知らせるだけのものに分ける。
 * 止める: 公開する言語の動画で、比べる相手の動画の一覧にあり（公開中）、どの種類の項目も SHA-256 が変わっていない（作り直していない）
 */
export const judge = (
  changes: readonly VideoChange[],
  published: readonly string[],
  base: MediaHashes,
  head: MediaHashes,
) => {
  const stop: VideoChange[] = [];
  const remade: VideoChange[] = [];
  const notice: VideoChange[] = [];
  for (const c of changes) {
    const kinds = (['standard', 'captioned'] as const)
      .map((kind) => mediaKey({ lang: c.lang, course: c.course, lecture: c.lecture, kind }))
      .filter((k) => base.has(k));
    if (!published.includes(c.lang) || !kinds.length) notice.push(c);
    else if (kinds.every((k) => head.has(k) && head.get(k) !== base.get(k))) remade.push(c);
    else stop.push(c);
  }
  return { stop, remade, notice };
};

/* ───────────── 比べる相手の台本 ───────────── */

const git = (args: string[]) => spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });

/** 比べる相手の commit（origin/<branch> が手元に無ければ取ってくる） */
const resolveBase = (ref: string): string => {
  const found = () => git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
  let r = found();
  const remote = /^origin\/([\w./-]+)$/.exec(ref);
  if (r.status !== 0 && remote) {
    const f = git([
      'fetch',
      '--quiet',
      '--no-tags',
      '--depth=1',
      'origin',
      `+refs/heads/${remote[1]}:refs/remotes/origin/${remote[1]}`,
    ]);
    if (f.status !== 0) throw new Error(`${ref} を取ってこられない: ${f.stderr.trim()}`);
    r = found();
  }
  if (r.status !== 0) throw new Error(`比べる相手の ref が無い: ${ref}（先に git fetch origin）`);
  return r.stdout.trim();
};

/** 比べる相手の台本を一時フォルダに取り出し、全部の動画の読みと、動画の一覧の項目を作る */
const baseReadings = async (commit: string): Promise<{ readings: VideoReading[]; media: MediaHashes }> => {
  const dir = mkdtempSync(path.join(tmpdir(), 'chalkfile-reading-diff-'));
  try {
    const r = spawnSync(
      'bash',
      ['-c', 'set -eo pipefail; git archive "$1" -- content scripts/voices.ts | tar -x -C "$2"', 'bash', commit, dir],
      { cwd: ROOT, encoding: 'utf8' },
    );
    if (r.status !== 0)
      throw new Error(`比べる相手の台本を取り出せない（git archive か tar が失敗した）: ${r.stderr.trim()}`);
    const index = (await import(path.join(dir, 'content/index.ts'))) as typeof import('../content');
    // 読み上げる文（speechIn）は content/voices.ts にある。それより前の版は scripts/voices.ts にある
    const voices = existsSync(path.join(dir, 'content/voices.ts'))
      ? ((await import(path.join(dir, 'content/voices.ts'))) as { speechIn?: SpeechIn })
      : {};
    const old =
      voices.speechIn ?? ((await import(path.join(dir, 'scripts/voices.ts'))) as { speechIn?: SpeechIn }).speechIn;
    if (!old || !index.VIDEOS)
      throw new Error('比べる相手の台本から、動画の一覧（VIDEOS）か読み上げる文（speechIn）を読めない');
    const ids = index.COURSES.map((c) => c.id);
    const langs = [...new Set(index.VIDEOS.map((v) => v.lang))];
    return {
      readings: readingsOf(index.VIDEOS, old),
      media: mediaHashes(ids.flatMap((id) => langs.map((lang) => readCourseMedia(id, lang, dir)))),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

/* ───────────── 表示 ───────────── */

const SHOW = 8;
const cut = (s = '', n = 50) => (s.length > n ? `${s.slice(0, n)}…` : s);
/** 変わった所の前後だけを出す（長い台詞でも、どこが変わったかが見えるように） */
export const around = (before: string, after: string, pad = 12): [string, string] => {
  let i = 0;
  while (i < before.length && i < after.length && before[i] === after[i]) i++;
  let j = 0;
  while (j < before.length - i && j < after.length - i && before[before.length - 1 - j] === after[after.length - 1 - j])
    j++;
  const from = Math.max(0, i - pad);
  const show = (s: string) =>
    `${from > 0 ? '…' : ''}${s.slice(from, Math.min(s.length, s.length - j + pad))}${s.length - j + pad < s.length ? '…' : ''}`;
  return [show(before), show(after)];
};
const block = (c: VideoChange) => [
  `  ${c.video}（${c.course}・${c.lang}）${c.lines.length} 台詞`,
  ...c.lines.slice(0, SHOW).map((l) => {
    if (l.before === undefined) return `    ${l.at} [${l.voice}] 足した台詞「${cut(l.after)}」`;
    if (l.after === undefined) return `    ${l.at} [${l.voice}] 消した台詞「${cut(l.before)}」`;
    const [b, a] = around(l.before, l.after);
    return `    ${l.at} [${l.voice}] 「${b}」→「${a}」（台詞: ${cut(l.text, 30)}）`;
  }),
  ...(c.lines.length > SHOW ? [`    …ほか ${c.lines.length - SHOW} 台詞`] : []),
];

/* ───────────── 実行 ───────────── */

if (import.meta.main) {
  const { values: opt } = parseArgs({
    options: {
      base: { type: 'string', default: 'origin/main' },
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
  });
  if (opt.help) {
    console.log('使い方: bun scripts/reading-diff.ts [--base <ref>]（既定は origin/main。PR の CI は HEAD^1）');
    process.exit(0);
  }
  const ref = opt.base ?? 'origin/main';
  const commit = resolveBase(ref);
  const base = await baseReadings(commit);
  const { VIDEOS, COURSES } = await import('../content');
  const { speechIn } = await import('../content/voices');
  const { LANGS } = await import('../content/i18n');
  const head = readingsOf(VIDEOS, speechIn);
  const headMedia = mediaHashes(COURSES.flatMap((c) => LANGS.map((lang) => readCourseMedia(c.id, lang))));
  const published = (
    JSON.parse(readFileSync(path.join(ROOT, 'site/config.json'), 'utf8')) as { publishLangs: string[] }
  ).publishLangs;
  const changes = readingChanges(base.readings, head);
  const { stop, remade, notice } = judge(changes, published, base.media, headMedia);
  const lines = head.reduce((n, v) => n + v.lines.length, 0);
  console.log(
    `読みの差分（${ref} ${commit.slice(0, 7)} → 今の作業フォルダ。動画 ${head.length} 本・台詞 ${lines}）: 読みが変わった動画 ${changes.length} 本`,
  );
  if (stop.length) {
    console.log(
      '■ 止める: 公開する言語の公開中の動画で読みが変わったのに、動画を作り直していない（動画の一覧の項目が同じ）',
    );
    for (const c of stop) console.log(block(c).join('\n'));
    console.log(
      '  → 合成し直し（npm run synth -- <動画>）→ 素材を足す → mix → render → media push --course <講座>。わざとでなければ、読みの辞書か台詞の s を戻す',
    );
  }
  if (remade.length) {
    console.log('■ 作り直した（動画の一覧の項目が、比べる相手と違う）');
    for (const c of remade) console.log(block(c).join('\n'));
  }
  if (notice.length) {
    console.log('■ 知らせるだけ（まだ公開しない言語か、まだ公開していない動画）');
    for (const c of notice) console.log(block(c).join('\n'));
  }
  if (!changes.length) console.log('読みは変わっていない');
  process.exit(stop.length ? 1 : 0);
}
