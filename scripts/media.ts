// 手元で書き出した動画（MP4）を、Releases へ先に置く。CI は check だけを行う（動画を置く権限を渡さない）。
//   bun scripts/media.ts push --course <講座 ID> [--course <講座 ID>…] [--lang ja]
//       選んだ講座の動画だけを、手元のファイル（site/media/）から Releases に置き、その講座の一覧（content/<講座>/generated/media.<言語>.json）
//       だけを書き直す。ほかの講座の一覧には触らない（手元の動画が一覧と違えば、知らせるだけ）。前のハッシュの動画は消さず retained に回す。
//       書き出しの記録（.work/state/render/<key>.json。書き出しの scripts/stages/video/render.ts が書く）のある動画は、項目に inputs（書き出したときの台本と描き方の指紋）を
//       書く（一覧の版 2。scripts/media-lists.ts）。同じ動画をもう一度置くときは、前の一覧の inputs を引き継ぐ。書き出したあとで台本が
//       変わった動画（記録の台本の指紋が今と違う）があれば、Releases に置く前に止める。描き方のコードだけが違うときは、知らせるだけ
//   bun scripts/media.ts check            # 全講座の一覧の動画が Releases にあり、大きさと SHA-256 が合うか（手元にあれば手元の動画も）
//   bun scripts/media.ts pull [講座 ID…]  # 一覧の日本語の動画を、Releases から site/media/ に取り出す（手元の変更は上書きしない）
//   --verbose（-v）                       # どれにも付けられる。流す gh のコマンドと、失敗したときの gh のエラーの出力の全部（伏せてから）も出す
//   npm run chalk -- media push|check|pull …   # 1 つの入口からも流せる（docs/guide/commands.md の「chalk」）
// 全講座の一覧（Worker の許可リスト）は、npm run gen が講座ごとの一覧をつないで worker/src/generated/media-manifest.json に作る（Git に入れない）
// gh の認証が要る（push と pull。check も Releases を読む）。gh の呼び出しには時間切れを付ける（API は 2 分、動画の upload・download は 60 分）。
// 読むだけの API は、一時の失敗（通信が途中で切れたなど）なら、少し待って 3 回まで試す。
// 終了コード: 0 成功・1 失敗・2 使い方の誤り・3 前提が足りない（gh が無い）
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { COURSES, coursesIn, VIDEOS } from '../content';
import { isLang, LANGS, videoKey, type Lang } from '../content/i18n';
import { mediaListFile, posterFile } from '../engine/core/generated';
import { OFFLINE_COURSE_MAX_BYTES, OFFLINE_COURSE_MAX_FILES, OFFLINE_FILE_MAX_BYTES, RELEASE_MAX_ASSETS } from '../site/limits';
import {
  MEDIA_REPOSITORY, allMediaEntries, mediaFilename, mediaKey, mediaPath, retainDeadline, retainedWarnings, validateMediaManifest,
  type MediaEntry, type MediaManifest, type RetainedMediaEntry,
} from '../site/media-shared';
import { readArgs, runMain, showHelp, UsageError } from './lib/args';
import { writeAtomic } from './lib/fsx';
import { sha256File } from './lib/hash';
import { ROOT } from './lib/paths';
import { type RunOptions, type RunResult, run, setVerbose, sleepSync, tailOf } from './lib/proc';
import { courseMediaJson, type MediaInputs, readCourseMediaFile, readMediaLists } from './media-lists';
import { fileHasher } from './stages/pipeline/digest';
import { readState } from './stages/pipeline/state';
import { compareInputs, currentInputs, srcDigest } from './stages/video/inputs';

export const localMediaPath = (e: Pick<MediaEntry, 'lang' | 'lecture' | 'kind'>, root = ROOT) =>
  path.join(root, 'site/media', `${e.lecture}${e.lang === 'ja' ? '' : `.${e.lang}`}${e.kind === 'captioned' ? '.cc' : ''}.mp4`);
/* ───────────── 講座ごとの一覧 ───────────── */

/** 全講座の動画の一覧（Worker の許可リスト・サイトの組み立て・check・serve が読む）。講座の登録（COURSES）の順につなぐ（scripts/media-lists.ts） */
export const readMediaManifest = (root = ROOT): MediaManifest => readMediaLists(COURSES.map((c) => c.id), root);

/* ───────────── GitHub ───────────── */

/** gh を流して標準出力を返す（テストでは偽物に差し替える） */
export type Gh = (args: string[]) => string;
/** gh の 1 回の呼び出しの時間切れ（ミリ秒）。動画の upload・download は長く、ほかの API の問い合わせは短く */
export const ghTimeoutMs = (args: string[]): number =>
  args[0] === 'release' && (args[1] === 'upload' || args[1] === 'download') ? 60 * 60_000 : 2 * 60_000;
/** 読むだけの API（GET。書き換えるための method・field を持たない）。流し直しても、何も変わらない */
export const readOnlyGh = (args: string[]): boolean =>
  args[0] === 'api' && !args.some((a) => /^(-X|--method(=.*)?|-f|-F|--field|--raw-field|--input)$/.test(a));
/**
 * gh の流し方（テストでは exec と sleep を差し替える）。gh は既存の認証を内部で使う。エラーの出力は、token などを伏せてから出す
 * （scripts/lib/proc.ts の redact）。時間切れ（ghTimeoutMs）を付け、読むだけの API は一時の失敗なら 3 回まで試す
 */
export const ghWith =
  (
    exec: (cmd: string, args: string[], opts: RunOptions) => RunResult = run,
    sleep: (ms: number) => void = sleepSync,
    warn: (line: string) => void = (line) => console.warn(line),
  ): Gh =>
  (args) => {
    const attempts = readOnlyGh(args) ? 3 : 1;
    const timeoutMs = ghTimeoutMs(args);
    for (let attempt = 1; ; attempt++) {
      const r = exec('gh', args, { cwd: ROOT, maxBuffer: 16 * 1024 * 1024, timeoutMs });
      if (r.code === 0 && !r.timedOut) return r.stdout;
      // 理由が分かるように gh のエラーの出力も出す（伏せてから、最後の 5 行・500 字まで）
      const detail = r.timedOut ? `${Math.round(timeoutMs / 1000)} 秒で終わらなかった` : tailOf(r.stderr);
      if (attempt < attempts) {
        const wait = 1000 * 2 ** (attempt - 1);
        warn(`gh ${args[0]} ${args[1]} が失敗した（${detail || `終了コード ${r.code}`}）。${wait / 1000} 秒待って流し直す（${attempt + 1}/${attempts} 回目）`);
        sleep(wait);
        continue;
      }
      throw new Error(`GitHub の操作に失敗しました: ${args[0]} ${args[1]}（認証・権限・通信を確認してください）${detail ? `: ${detail}` : ''}`);
    }
  };
const realGh: Gh = ghWith();
type ReleaseAsset = { name: string; size: number; state: string; digest?: string | null };
function assetsOf(tag: string, gh: Gh): ReleaseAsset[] {
  const release = JSON.parse(gh(['api', `repos/${MEDIA_REPOSITORY}/releases/tags/${tag}`])) as { id: number; draft: boolean };
  if (release.draft) throw new Error(`未公開の Release です: ${tag}`);
  return (JSON.parse(gh(['api', '--paginate', '--slurp', `repos/${MEDIA_REPOSITORY}/releases/${release.id}/assets?per_page=100`])) as ReleaseAsset[][]).flat();
}
/** Release を作るときのタグの置き場所（リポジトリの既定のブランチ。HEAD の SHA だと、まだ push していないコミットで失敗する） */
function defaultBranch(gh: Gh): string {
  const branch = (JSON.parse(gh(['api', `repos/${MEDIA_REPOSITORY}`])) as { default_branch?: string }).default_branch;
  if (!branch) throw new Error(`既定のブランチが分かりません: ${MEDIA_REPOSITORY}`);
  return branch;
}
export function verifyReleaseAssets(entries: MediaEntry[], assets: ReleaseAsset[]): void {
  for (const e of entries) {
    const a = assets.find((x) => x.name === e.filename);
    if (!a || a.state !== 'uploaded' || a.size !== e.bytes || (a.digest && a.digest !== `sha256:${e.sha256}`)) {
      throw new Error(`Releases に動画がないか、サイズ・SHA-256 が違います: ${mediaKey(e)}`);
    }
  }
}
export function verifyLocalMedia(entries: MediaEntry[], required = false, root = ROOT): number {
  let checked = 0;
  for (const e of entries) {
    const file = localMediaPath(e, root);
    if (!existsSync(file)) { if (required) throw new Error(`手元の動画がありません: ${mediaKey(e)}`); continue; }
    if (statSync(file).size !== e.bytes || sha256File(file) !== e.sha256) throw new Error(`手元の動画とマニフェストが違います: ${mediaKey(e)}`);
    checked++;
  }
  return checked;
}
// 期限を過ぎた retained は警告だけにする（Actions では注釈にする）。外すかどうかは持ち主が決める。
export function warnExpiredRetained(manifest: MediaManifest, today = new Date()): number {
  const warnings = retainedWarnings(manifest, today);
  for (const message of warnings) console.warn(process.env.GITHUB_ACTIONS === 'true' ? `::warning::${message}` : `警告: ${message}`);
  return warnings.length;
}
// 一覧から外れた旧ハッシュを retained に残す。新しく入るものは今日から 90 日、すでにあるものは期限を変えない
// （期限の無い古い項目には、今日から数えた期限を付ける）。
export function retainEntries(previous: MediaManifest | null, active: MediaEntry[], today = new Date()): RetainedMediaEntry[] {
  const current = new Set(active.map(mediaPath));
  const until = retainDeadline(today);
  return [
    ...(previous?.entries ?? []).filter((e) => !current.has(mediaPath(e))).map((e) => ({ ...e, retainedUntil: until })),
    ...(previous?.retained ?? []).filter((e) => !current.has(mediaPath(e))).map((e) => ({ ...e, retainedUntil: e.retainedUntil ?? until })),
  ];
}
const mib = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
/**
 * 動画の一覧が、保存と Releases の上限（site/limits.ts）に収まるか。push は Releases に置く前に、check は照合の前に確かめる。
 * 動画が保存の上限を超えると、学ぶ人がその講座を保存できない（SW の validateManifest が「保存できない」とする）
 */
export function mediaLimitProblems(manifest: MediaManifest): string[] {
  const problems: string[] = [];
  for (const e of manifest.entries) {
    if (e.bytes > OFFLINE_FILE_MAX_BYTES) problems.push(`動画が保存の 1 ファイルの上限（${mib(OFFLINE_FILE_MAX_BYTES)}）を超えています: ${mediaKey(e)}（${mib(e.bytes)}）`);
  }
  // 講座の保存には、動画のほかに、ページ 1 つとレクチャーごとのポスターが入る（入れたあとの大きさは、組み立ての最後に scripts/site-invariants.ts が見る）
  const courses = new Map<string, MediaEntry[]>();
  for (const e of manifest.entries) courses.set(`${e.lang}/${e.course}`, [...(courses.get(`${e.lang}/${e.course}`) ?? []), e]);
  for (const [course, list] of courses) {
    const bytes = list.reduce((n, e) => n + e.bytes, 0);
    const files = 1 + list.length + list.filter((e) => e.kind === 'standard').length;
    if (bytes > OFFLINE_COURSE_MAX_BYTES) problems.push(`講座の動画の合計が、保存の 1 講座の上限（${mib(OFFLINE_COURSE_MAX_BYTES)}）を超えています: ${course}（${mib(bytes)}）`);
    if (files > OFFLINE_COURSE_MAX_FILES) problems.push(`講座の保存のファイルの数が、上限（${OFFLINE_COURSE_MAX_FILES}）を超えています: ${course}（ページとポスターを入れて ${files}）`);
  }
  // 1 つの Release に置く数（古いハッシュの retained も、同じ Release に残る）
  const tags = new Map<string, number>();
  for (const e of allMediaEntries(manifest)) tags.set(e.tag, (tags.get(e.tag) ?? 0) + 1);
  for (const [tag, n] of tags) if (n > RELEASE_MAX_ASSETS) problems.push(`Release の ${RELEASE_MAX_ASSETS} asset 上限を超えます: ${tag}（一覧に ${n} 本）`);
  return problems;
}
function assertMediaLimits(manifest: MediaManifest): void {
  const problems = mediaLimitProblems(manifest);
  if (problems.length) throw new Error(problems.join('\n'));
}
/** 一覧の動画が Releases にあり、大きさと SHA-256 が合うか（手元にある動画は、手元の SHA-256 も） */
export function checkMedia(manifest = readMediaManifest(), gh: Gh = realGh, root = ROOT, log: (line: string) => void = console.log): void {
  validateMediaManifest(manifest);
  assertMediaLimits(manifest);
  warnExpiredRetained(manifest);
  const remote = allMediaEntries(manifest);
  for (const tag of new Set(remote.map((e) => e.tag))) {
    const entries = remote.filter((e) => e.tag === tag);
    verifyReleaseAssets(entries, assetsOf(tag, gh));
    log(`${tag}: ${entries.length} 本の公開 asset・サイズ・提供された SHA-256 が一致`);
  }
  log(`動画 ${manifest.entries.length} 本を照合（手元の SHA-256 ${verifyLocalMedia(manifest.entries, false, root)} 本）。`);
}

export async function pullMedia(courses: string[] = []) {
  for (const course of courses) if (!COURSES.some((c) => c.id === course)) throw new Error(`講座がありません: ${course}`);
  const entries = readMediaManifest().entries.filter((e) => e.lang === 'ja' && (!courses.length || courses.includes(e.course)));
  const missing: MediaEntry[] = [];
  for (const e of entries) {
    const file = localMediaPath(e);
    if (!existsSync(file)) missing.push(e);
    else if (statSync(file).size !== e.bytes || sha256File(file) !== e.sha256) throw new Error(`既存の動画を上書きしません: ${mediaKey(e)}。手元の変更を保管してから再試行してください。`);
  }
  const temp = mkdtempSync(path.join(tmpdir(), 'chalkfile-media-pull-'));
  try {
    for (const tag of new Set(missing.map((e) => e.tag))) {
      const group = missing.filter((e) => e.tag === tag);
      realGh(['release', 'download', tag, '--repo', MEDIA_REPOSITORY, '--dir', temp, ...group.flatMap((e) => ['--pattern', e.filename])]);
    }
    for (const e of missing) {
      const file = path.join(temp, e.filename);
      if (statSync(file).size !== e.bytes || sha256File(file) !== e.sha256) throw new Error(`取得した動画が一致しません: ${mediaKey(e)}`);
    }
    for (const e of missing) { mkdirSync(path.dirname(localMediaPath(e)), { recursive: true }); copyFileSync(path.join(temp, e.filename), localMediaPath(e)); }
    verifyLocalMedia(entries, true);
    console.log(`Releases から ${missing.length} 本を取得、${entries.length} 本のSHA-256を確認。既存の変更は上書きしない。`);
  } finally { rmSync(temp, { recursive: true, force: true }); }
}

/* ───────────── push（講座ごと） ───────────── */

export type PushOptions = { courses: string[]; lang: Lang; root?: string; gh?: Gh; today?: Date; log?: (line: string) => void };

/** 手元の動画（site/media/ の名前）の、書き出しの記録の inputs。記録の出力の sha256 が、置く動画と同じときだけ */
export const recordedInputs = (root: string, key: string, file: string, sha256: string): MediaInputs | null => {
  const s = readState(root, 'render', key);
  return s && s.outputs[`site/media/${file}`]?.sha256 === sha256 && s.parts.script && s.parts.src
    ? { script: s.parts.script, src: s.parts.src }
    : null;
};

/**
 * 置く動画の inputs（書き出しの記録か、前の一覧の同じ動画の inputs）を集め、今の台本・描き方と比べる。
 * 書き出したあとで台本の側が変わった動画は stale に、描き方の側だけが変わった動画は src に、記録の無い動画は none に入れる
 */
export const inputsForPush = (
  root: string,
  entries: MediaEntry[],
  previous: ReadonlyMap<string, MediaInputs>,
): { inputs: Map<string, MediaInputs>; stale: string[]; src: string[]; none: string[]; unknown: string[] } => {
  const out = { inputs: new Map<string, MediaInputs>(), stale: [] as string[], src: [] as string[], none: [] as string[], unknown: [] as string[] };
  const hasher = fileHasher(root, null);
  let src: string | undefined;
  for (const e of entries) {
    const key = videoKey(e.lecture, e.lang as Lang);
    const local = path.basename(localMediaPath(e, root));
    const rec = recordedInputs(root, key, local, e.sha256) ?? previous.get(e.filename) ?? null;
    if (!rec) {
      out.none.push(mediaKey(e));
      continue;
    }
    out.inputs.set(e.filename, rec);
    const video = VIDEOS.find((v) => v.key === key && v.course.id === e.course);
    if (!video) continue;
    src ??= srcDigest(root, hasher);
    const result = compareInputs(rec, currentInputs(root, video, src));
    if (result === 'script') out.stale.push(mediaKey(e));
    else if (result === 'src') out.src.push(mediaKey(e));
    else if (result === 'unknown') out.unknown.push(mediaKey(e));
  }
  return out;
};

/**
 * 選んだ講座の動画だけを、手元のファイルから Releases に置き、その講座の一覧だけを書き直す。
 * ほかの講座の一覧は読むだけ（つないだ一覧で、動画の重なりと上限を確かめる）。ほかの講座の手元の動画が一覧と違えば、知らせるだけ。
 * 書き出しの記録のある動画には inputs を書き、書き出したあとで台本が変わった動画があれば、Releases に置く前に止める
 */
export async function pushMedia({ courses, lang, root = ROOT, gh = realGh, today = new Date(), log = console.log }: PushOptions) {
  if (!courses.length) throw new Error('push する講座を選んでください: bun scripts/media.ts push --course <講座 ID> [--lang ja]');
  const list = coursesIn(lang);
  for (const id of courses) if (!list.some((c) => c.id === id)) throw new Error(`講座がありません（${lang}）: ${id}`);
  const before = readMediaManifest(root);
  const chosen = new Set(courses);
  const updates: { file: string; manifest: MediaManifest; inputs: Map<string, MediaInputs> }[] = [];
  const stale: string[] = [];
  for (const course of list.filter((c) => chosen.has(c.id))) {
    // ポスターは書き出し（npm run render）が講座のフォルダに書く。前の手順で site/media/<key>.jpg にだけあるものは写す
    for (const l of course.lectures) {
      const key = videoKey(l.id, lang);
      const from = path.join(root, 'site/media', `${key}.jpg`);
      const to = path.join(root, posterFile(course.id, key));
      if (existsSync(from)) { mkdirSync(path.dirname(to), { recursive: true }); copyFileSync(from, to); }
    }
    const entries: MediaEntry[] = [];
    for (const l of course.lectures) for (const kind of ['standard', 'captioned'] as const) {
      const partial = { lang, course: course.id, lecture: l.id, kind };
      const file = localMediaPath(partial, root);
      if (!existsSync(file)) { if (kind === 'captioned') continue; throw new Error(`通常動画がありません: ${course.id}/${videoKey(l.id, lang)}（${path.relative(root, file)}）`); }
      const sha256 = sha256File(file);
      entries.push({ ...partial, bytes: statSync(file).size, sha256, filename: mediaFilename({ ...partial, sha256 }), tag: `media-${lang}-${course.id}` });
    }
    // 一覧から外れた前のハッシュは消さず retained に回す（Release の asset も消さない）
    const previous = readCourseMediaFile(course.id, lang, root);
    const retained = retainEntries(previous?.manifest ?? null, entries, today);
    // 書き出したときの入力の指紋（inputs）。retained に回した動画は、前の一覧の inputs のまま
    const found = inputsForPush(root, entries, previous?.inputs ?? new Map());
    const inputs = new Map([...(previous?.inputs ?? []), ...found.inputs]);
    stale.push(...found.stale);
    if (found.src.length)
      console.warn(`注意: 書き出したあとで、描き方のコード（src など）が変わった動画: ${found.src.join(' ')}（見た目が変わる直しなら、書き出し直す）`);
    if (found.unknown.length) console.warn(`注意: timeline が無いので、台本と比べられない動画: ${found.unknown.join(' ')}`);
    if (found.none.length)
      console.warn(`注意: 書き出しの記録が無いので、inputs を書かない動画: ${found.none.join(' ')}（npm run render か npm run chalk -- render で書き出すと記録する）`);
    updates.push({ file: mediaListFile(course.id, lang), manifest: validateMediaManifest({ schema: 1, entries, ...(retained.length ? { retained } : {}) }), inputs });
  }
  if (stale.length)
    throw new Error(
      `書き出したあとで台本が変わった動画がある（置くと、CI が動画を古いと止める）: ${stale.join(' ')}。書き出し直してから push する（npm run chalk -- build --to render）`,
    );
  // 選んだ講座の一覧を差し替えた全体の一覧で、重なりと保存・Releases の上限を、Releases に置く前に確かめる
  const others = (es: MediaEntry[]) => es.filter((e) => !(e.lang === lang && chosen.has(e.course)));
  const retainedAll = [...others(before.retained ?? []), ...updates.flatMap((u) => u.manifest.retained ?? [])] as RetainedMediaEntry[];
  assertMediaLimits(validateMediaManifest({ schema: 1, entries: [...others(before.entries), ...updates.flatMap((u) => u.manifest.entries)], ...(retainedAll.length ? { retained: retainedAll } : {}) }));
  const fresh = updates.flatMap((u) => u.manifest.entries);
  verifyLocalMedia(fresh, true, root);
  const target = defaultBranch(gh);
  const temp = mkdtempSync(path.join(tmpdir(), 'chalkfile-media-'));
  try {
    for (const tag of new Set(fresh.map((e) => e.tag))) {
      // エラーを「未作成」と誤判定して上書きしない。存在確認は一覧 API の正常応答から行う。
      const releases = (JSON.parse(gh(['api', '--paginate', '--slurp', `repos/${MEDIA_REPOSITORY}/releases?per_page=100`])) as { tag_name: string }[][]).flat();
      if (!releases.some((r) => r.tag_name === tag)) gh(['release', 'create', tag, '--repo', MEDIA_REPOSITORY, '--target', target,
        '--title', tag, '--notes', 'Chalkfile の公開動画。ファイル名の SHA-256 ごとに保持します。', '--latest=false']);
      const current = assetsOf(tag, gh);
      const missing = fresh.filter((e) => e.tag === tag && !current.some((a) => a.name === e.filename));
      if (current.length + missing.length > RELEASE_MAX_ASSETS) throw new Error(`Release の ${RELEASE_MAX_ASSETS} asset 上限を超えます: ${tag}`);
      const staged = missing.map((e) => {
        const file = path.join(temp, e.filename);
        copyFileSync(localMediaPath(e, root), file);
        return file;
      });
      if (staged.length) gh(['release', 'upload', tag, '--repo', MEDIA_REPOSITORY, ...staged]);
      verifyReleaseAssets(fresh.filter((e) => e.tag === tag), assetsOf(tag, gh));
      log(`${tag}: 新規 ${missing.length} 本（既存のハッシュは保持）`);
    }
    // 選んだ講座の公開 asset を全部確かめてから、その講座の一覧だけを書き直す（ほかの講座の一覧のファイルには触らない）。
    // 一覧は、同じフォルダの一時の名前に書いてから置き換える（途中で止まっても、前の一覧か新しい一覧のどちらかになる）
    for (const u of updates) {
      writeAtomic(path.join(root, u.file), courseMediaJson(u.manifest, u.inputs));
      checkMedia(u.manifest, gh, root, log);
      log(`${u.file} を書き直した（動画 ${u.manifest.entries.length} 本・retained ${u.manifest.retained?.length ?? 0} 本）`);
    }
  } finally { rmSync(temp, { recursive: true, force: true }); }
  // ほかの講座で、手元の動画が一覧と違うもの（書き出し直したが push していない、など）。push はしないで知らせる
  for (const e of others(before.entries)) {
    const file = localMediaPath(e, root);
    if (existsSync(file) && (statSync(file).size !== e.bytes || sha256File(file) !== e.sha256)) {
      console.warn(`注意: 手元の動画が一覧と違う（push していない）: ${mediaKey(e)}。その講座を出すなら bun scripts/media.ts push --course ${e.course}`);
    }
  }
}

/* ───────────── コマンド ───────────── */

const VERBOSE = { verbose: { type: 'boolean', short: 'v' } } as const;

const main = async (argv: string[]) => {
  const [command, ...rest] = argv;
  if (command === '-h' || command === '--help') return showHelp(import.meta.filename);
  if (command === undefined) throw new UsageError('コマンドを選ぶ: push・check・pull（使い方は --help）');
  if (command === 'push') {
    const { values } = readArgs(rest, { course: { type: 'string', multiple: true }, lang: { type: 'string', default: 'ja' }, ...VERBOSE });
    if (values.help) return showHelp(import.meta.filename);
    setVerbose(values.verbose === true);
    if (!isLang(values.lang)) throw new UsageError(`--lang は ${LANGS.join('・')} のどれか: ${values.lang}`);
    if (!values.course?.length) throw new UsageError('push する講座を選んでください: bun scripts/media.ts push --course <講座 ID> [--lang ja]');
    return pushMedia({ courses: values.course, lang: values.lang });
  }
  if (command === 'check') {
    const { values } = readArgs(rest, { ...VERBOSE });
    if (values.help) return showHelp(import.meta.filename);
    setVerbose(values.verbose === true);
    return checkMedia();
  }
  if (command === 'pull') {
    const { values, positionals } = readArgs(rest, { ...VERBOSE }, { positionals: true });
    if (values.help) return showHelp(import.meta.filename);
    setVerbose(values.verbose === true);
    return pullMedia(positionals);
  }
  throw new UsageError(`知らないコマンド: ${command}（push・check・pull。使い方は --help）`);
};

if (import.meta.main) await runMain(main);
