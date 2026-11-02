// ローカルで作った動画を Releases へ先に置く。CI は check だけを行う。
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { COURSES } from '../content';
import { MEDIA_REPOSITORY, mediaFilename, mediaKey, validateMediaManifest, type MediaEntry, type MediaManifest } from '../site/media-shared';

const ROOT = path.resolve(import.meta.dir, '..');
const MANIFEST = path.join(ROOT, 'site/media-manifest.json');
export const localMediaPath = (e: Pick<MediaEntry, 'lang' | 'lecture' | 'kind'>, root = ROOT) =>
  path.join(root, 'site/media', `${e.lang === 'ja' ? '' : `${e.lang}/`}${e.lecture}${e.kind === 'captioned' ? '.cc' : ''}.mp4`);
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
export function checkMedia(manifest = readMediaManifest()): void {
  validateMediaManifest(manifest);
  for (const tag of new Set(manifest.entries.map((e) => e.tag))) {
    const entries = manifest.entries.filter((e) => e.tag === tag);
    verifyReleaseAssets(entries, assetsOf(tag));
    console.log(`${tag}: ${entries.length} 本の公開 asset・サイズ・提供された SHA-256 が一致`);
  }
  console.log(`動画 ${manifest.entries.length} 本を照合（手元の SHA-256 ${verifyLocalMedia(manifest.entries)} 本）。`);
}

async function pushMedia() {
  // 今回公開する日本語だけを扱う。翻訳の公開は別 milestone。
  const entries: MediaEntry[] = [];
  for (const c of COURSES) for (const l of c.lectures) for (const kind of ['standard', 'captioned'] as const) {
    const partial = { lang: 'ja', course: c.id, lecture: l.id, kind };
    const file = localMediaPath(partial);
    if (!existsSync(file)) { if (kind === 'captioned') continue; throw new Error(`通常動画がありません: ${c.id}/${l.id}`); }
    const sha256 = digest(file);
    entries.push({ ...partial, bytes: statSync(file).size, sha256, filename: mediaFilename({ ...partial, sha256 }), tag: `media-ja-${c.id}` });
  }
  // 他言語の既存一覧が将来増えても消さない。古いハッシュの Release asset も削除しない。
  const previous = existsSync(MANIFEST) ? readMediaManifest().entries.filter((e) => e.lang !== 'ja') : [];
  const manifest = validateMediaManifest({ schema: 1, entries: [...entries, ...previous] });
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
      if (current.length + missing.length > 1000) throw new Error(`Release の 1000 asset 上限を超えます: ${tag}`);
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
    else throw new Error('使い方: bun scripts/media.ts push | check');
  } catch (e) { console.error(e instanceof Error ? e.message : '動画の処理に失敗しました。'); process.exit(1); }
}
