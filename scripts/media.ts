// ローカルで作った動画を Releases へ先に置く。CI は check だけを行う。
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { COURSES } from '../content';
import { OFFLINE_COURSE_MAX_BYTES, OFFLINE_COURSE_MAX_FILES, OFFLINE_FILE_MAX_BYTES, RELEASE_MAX_ASSETS } from '../site/limits';
import {
  MEDIA_REPOSITORY, allMediaEntries, mediaFilename, mediaKey, mediaPath, retainDeadline, retainedWarnings, validateMediaManifest,
  type MediaEntry, type MediaManifest, type RetainedMediaEntry,
} from '../site/media-shared';

const ROOT = path.resolve(import.meta.dir, '..');
const MANIFEST = path.join(ROOT, 'site/media-manifest.json');
export const localMediaPath = (e: Pick<MediaEntry, 'lang' | 'lecture' | 'kind'>, root = ROOT) =>
  path.join(root, 'site/media', `${e.lecture}${e.lang === 'ja' ? '' : `.${e.lang}`}${e.kind === 'captioned' ? '.cc' : ''}.mp4`);
const digest = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
export const readMediaManifest = () => validateMediaManifest(JSON.parse(readFileSync(MANIFEST, 'utf8')));
// gh は既存の認証を内部で使う。認証ファイル・token・HTTP header を読み出したり表示したりしない。
const gh = (args: string[]) => {
  try { return execFileSync('gh', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 }); }
  catch { throw new Error(`GitHub の操作に失敗しました: ${args[0]} ${args[1]}（認証・権限・通信を確認してください）`); }
};
type ReleaseAsset = { name: string; size: number; state: string; digest?: string | null };
function assetsOf(tag: string): ReleaseAsset[] {
  const release = JSON.parse(gh(['api', `repos/${MEDIA_REPOSITORY}/releases/tags/${tag}`])) as { id: number; draft: boolean };
  if (release.draft) throw new Error(`未公開の Release です: ${tag}`);
  return (JSON.parse(gh(['api', '--paginate', '--slurp', `repos/${MEDIA_REPOSITORY}/releases/${release.id}/assets?per_page=100`])) as ReleaseAsset[][]).flat();
}
export function verifyReleaseAssets(entries: MediaEntry[], assets: ReleaseAsset[]): void {
  for (const e of entries) {
    const a = assets.find((x) => x.name === e.filename);
    if (!a || a.state !== 'uploaded' || a.size !== e.bytes || (a.digest && a.digest !== `sha256:${e.sha256}`)) {
      throw new Error(`Releases に動画がないか、サイズ・SHA-256 が違います: ${mediaKey(e)}`);
    }
  }
}
export function verifyLocalMedia(entries: MediaEntry[], required = false): number {
  let checked = 0;
  for (const e of entries) {
    const file = localMediaPath(e);
    if (!existsSync(file)) { if (required) throw new Error(`手元の動画がありません: ${mediaKey(e)}`); continue; }
    if (statSync(file).size !== e.bytes || digest(file) !== e.sha256) throw new Error(`手元の動画とマニフェストが違います: ${mediaKey(e)}`);
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
export function checkMedia(manifest = readMediaManifest()): void {
  validateMediaManifest(manifest);
  assertMediaLimits(manifest);
  warnExpiredRetained(manifest);
  const remote = allMediaEntries(manifest);
  for (const tag of new Set(remote.map((e) => e.tag))) {
    const entries = remote.filter((e) => e.tag === tag);
    verifyReleaseAssets(entries, assetsOf(tag));
    console.log(`${tag}: ${entries.length} 本の公開 asset・サイズ・提供された SHA-256 が一致`);
  }
  console.log(`動画 ${manifest.entries.length} 本を照合（手元の SHA-256 ${verifyLocalMedia(manifest.entries)} 本）。`);
}

export async function pullMedia(courses: string[] = []) {
  for (const course of courses) if (!COURSES.some((c) => c.id === course)) throw new Error(`講座がありません: ${course}`);
  const entries = readMediaManifest().entries.filter((e) => e.lang === 'ja' && (!courses.length || courses.includes(e.course)));
  const missing: MediaEntry[] = [];
  for (const e of entries) {
    const file = localMediaPath(e);
    if (!existsSync(file)) missing.push(e);
    else if (statSync(file).size !== e.bytes || digest(file) !== e.sha256) throw new Error(`既存の動画を上書きしません: ${mediaKey(e)}。手元の変更を保管してから再試行してください。`);
  }
  const temp = mkdtempSync(path.join(tmpdir(), 'chalkfile-media-pull-'));
  try {
    for (const tag of new Set(missing.map((e) => e.tag))) {
      const group = missing.filter((e) => e.tag === tag);
      gh(['release', 'download', tag, '--repo', MEDIA_REPOSITORY, '--dir', temp, ...group.flatMap((e) => ['--pattern', e.filename])]);
    }
    for (const e of missing) {
      const file = path.join(temp, e.filename);
      if (statSync(file).size !== e.bytes || digest(file) !== e.sha256) throw new Error(`取得した動画が一致しません: ${mediaKey(e)}`);
    }
    for (const e of missing) { mkdirSync(path.dirname(localMediaPath(e)), { recursive: true }); copyFileSync(path.join(temp, e.filename), localMediaPath(e)); }
    verifyLocalMedia(entries, true);
    console.log(`Releases から ${missing.length} 本を取得、${entries.length} 本のSHA-256を確認。既存の変更は上書きしない。`);
  } finally { rmSync(temp, { recursive: true, force: true }); }
}
async function pushMedia() {
  // 今回公開する日本語だけを扱う。翻訳の公開は別 milestone。
  const entries: MediaEntry[] = [];
  mkdirSync(path.join(ROOT, 'site/posters'), { recursive: true });
  for (const c of COURSES) for (const l of c.lectures) {
    const poster = path.join(ROOT, 'site/media', `${l.id}.jpg`);
    if (existsSync(poster)) copyFileSync(poster, path.join(ROOT, 'site/posters', `${l.id}.jpg`));
  }
  for (const c of COURSES) for (const l of c.lectures) for (const kind of ['standard', 'captioned'] as const) {
    const partial = { lang: 'ja', course: c.id, lecture: l.id, kind };
    const file = localMediaPath(partial);
    if (!existsSync(file)) { if (kind === 'captioned') continue; throw new Error(`通常動画がありません: ${c.id}/${l.id}`); }
    const sha256 = digest(file);
    entries.push({ ...partial, bytes: statSync(file).size, sha256, filename: mediaFilename({ ...partial, sha256 }), tag: `media-ja-${c.id}` });
  }
  // 他言語の既存一覧が将来増えても消さない。古いハッシュの Release asset も削除しない。
  const previous = existsSync(MANIFEST) ? readMediaManifest() : null;
  const active = [...entries, ...(previous?.entries.filter((e) => e.lang !== 'ja') ?? [])];
  const retained = retainEntries(previous, active);
  const manifest = validateMediaManifest({ schema: 1, entries: active, ...(retained.length ? { retained } : {}) });
  // 保存できない大きさの動画を、Releases に置く前に止める
  assertMediaLimits(manifest);
  verifyLocalMedia(entries, true);
  const target = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const temp = mkdtempSync(path.join(tmpdir(), 'chalkfile-media-'));
  try {
    for (const tag of new Set(entries.map((e) => e.tag))) {
      // エラーを「未作成」と誤判定して上書きしない。存在確認は一覧 API の正常応答から行う。
      const releases = (JSON.parse(gh(['api', '--paginate', '--slurp', `repos/${MEDIA_REPOSITORY}/releases?per_page=100`])) as { tag_name: string }[][]).flat();
      if (!releases.some((r) => r.tag_name === tag)) gh(['release', 'create', tag, '--repo', MEDIA_REPOSITORY, '--target', target,
        '--title', tag, '--notes', 'Chalkfile の公開動画。ファイル名の SHA-256 ごとに保持します。', '--latest=false']);
      const current = assetsOf(tag);
      const missing = entries.filter((e) => e.tag === tag && !current.some((a) => a.name === e.filename));
      if (current.length + missing.length > RELEASE_MAX_ASSETS) throw new Error(`Release の ${RELEASE_MAX_ASSETS} asset 上限を超えます: ${tag}`);
      const staged = missing.map((e) => {
        const file = path.join(temp, e.filename);
        copyFileSync(localMediaPath(e), file);
        return file;
      });
      if (staged.length) gh(['release', 'upload', tag, '--repo', MEDIA_REPOSITORY, ...staged]);
      verifyReleaseAssets(entries.filter((e) => e.tag === tag), assetsOf(tag));
      console.log(`${tag}: 新規 ${missing.length} 本（既存のハッシュは保持）`);
    }
    // 全公開 asset の確認が済んでから一覧を atomically 更新する。
    const pending = `${MANIFEST}.tmp`;
    mkdirSync(path.dirname(MANIFEST), { recursive: true });
    writeFileSync(pending, `${JSON.stringify(manifest, null, 2)}\n`);
    renameSync(pending, MANIFEST);
    checkMedia(manifest);
  } finally { rmSync(temp, { recursive: true, force: true }); }
}
if (import.meta.main) {
  const command = process.argv[2];
  try {
    if (command === 'push') await pushMedia();
    else if (command === 'check') checkMedia();
    else if (command === 'pull') await pullMedia(process.argv.slice(3));
    else throw new Error('使い方: bun scripts/media.ts push | check | pull [講座ID…]');
  } catch (e) { console.error(e instanceof Error ? e.message : '動画の処理に失敗しました。'); process.exit(1); }
}
