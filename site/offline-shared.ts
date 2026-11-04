// 保存対象は、このサイトが生成した公開教材と MP4・ポスターだけ。大きさの上限の正本は site/limits.ts
import { FOLDER_PATTERN } from '../content/langs';
import {
  OFFLINE_COURSE_MAX_BYTES,
  OFFLINE_COURSE_MAX_FILES,
  OFFLINE_FILE_MAX_BYTES,
  OFFLINE_PAGE_MAX_BYTES,
} from './limits';
import { parseMediaPath } from './media-shared';

// 1 つの bytes の Range の読み方は site/lib/http-range.ts（再生の応答の組み立てと一緒）。前からここを読むもの（旧 Pages の移行の SW）のために、ここからも出す
export { byteRange } from './lib/http-range';
export type Asset = { url: string; bytes: number; sha256: string; type: string };
/** この講座の新しい版で変わったこと（site/news.ts から、講座の言語の文で。date は公開した日 YYYY-MM-DD） */
export type CourseNews = { date: string; text: string };
export type CourseManifest = {
  schema: 1;
  id: string;
  title: string;
  pageVersion: string;
  revision: string;
  bytes: number;
  files: Asset[];
  /**
   * 「新しい版」の案内に出す、何が変わったか（新しいものから。無いこともある）。版（pageVersion・revision）には入らず、validateManifest も
   * 見ない（前の SW も、知らない項目として、そのまま画面に渡す）。画面は文字として出すだけにする
   */
  news?: CourseNews[];
};
export type SavedVersion = { cache: string; manifest: CourseManifest; savedAt: string };
/** 保存の記録（registry の 1 件。sw.ts が Response.json で書く）。新しい版が先頭で、前の完全な版を 1 つまで持つ */
export type SavedRecord = { versions: SavedVersion[] };
export type DownloadProgress = { id: string; loaded: number; total: number; file: number; count: number };
export type CourseStatus = {
  id: string;
  saved: SavedVersion | null;
  incomplete: boolean;
  progress: DownloadProgress | null;
  /**
   * saved の版を、重大な不具合で無効にした（site/disabled-revisions.ts）。オンラインでは公開中のページを開くので、新しい版に更新して
   * 保存し直すよう案内する。前の SW は送らない（無いときは false と同じ）
   */
  disabled?: boolean;
};
/** 講座の ID。訳の講座は言語のフォルダを頭に付ける（en/superagent-comedy。言語は content/langs.ts の一覧から）。日本語の講座は付けない */
export const COURSE_ID = new RegExp(`^(?:${FOLDER_PATTERN}\\/)?[A-Za-z0-9][A-Za-z0-9_-]*$`);
const HASH = /^[a-f0-9]{64}$/;
export const MAX_FILE_BYTES = OFFLINE_FILE_MAX_BYTES;
/** 動画とポスターの名前。S01・S01.cc（字幕を焼き込んだ版）・S01.en・S01.en.cc（言語は訳の言語のフォルダの名前と同じ） */
const MEDIA_NAME = `([A-Za-z0-9][A-Za-z0-9_-]*(?:\\.${FOLDER_PATTERN})?)(\\.cc)?\\.(mp4|jpg)`;

/** 保存できないものを見つけたときのエラー。code は保存機能の文字（site/i18n/<言語>.ts の sw.errors）を選ぶ */
export type OfflineErrorCode =
  | 'manifest'
  | 'format'
  | 'origin'
  | 'page'
  | 'media'
  | 'incomplete'
  | 'unpublished'
  | 'fetchManifest'
  | 'tooLarge'
  | 'integrity'
  | 'fetchFile'
  | 'changed'
  | 'corrupt'
  | 'quota'
  | 'busy'
  | 'busyDelete'
  | 'verify'
  | 'cancelled'
  | 'noSpace'
  | 'pick'
  | 'unknownOp'
  | 'storage'
  | 'timeout';
export class OfflineError extends Error {
  constructor(readonly code: OfflineErrorCode) {
    super(code);
  }
}

/**
 * 保存用の教材情報を確かめる。scope はアプリの場所（例: https://chalkfile.com/）。
 * 動画は、同じ origin の /media/<言語>/<講座>/ の SHA-256 の入った名前。ポスター（と前の形の動画）は、講座の media/ の下で、?v= は版。
 * どのレクチャーも動画とポスターがそろっていること（字幕を焼き込んだ版はあってもなくてもよい）。
 * legacyMedia は、旧 Pages の頃に訳の言語の動画を置いた、同じ origin の別のサイト（言語 → パス）。旧 Pages の移行の SW（site/legacy-sw.ts）
 * だけが渡し、その SW を消すときに一緒に消す。今の SW は渡さない
 */
export function validateManifest(
  value: unknown,
  id: string,
  scope: string,
  legacyMedia: Record<string, string> = {},
): CourseManifest {
  const m = value as CourseManifest;
  if (
    !m ||
    m.schema !== 1 ||
    !COURSE_ID.test(id) ||
    m.id !== id ||
    typeof m.title !== 'string' ||
    m.title.length > 300 ||
    !HASH.test(m.pageVersion) ||
    !HASH.test(m.revision) ||
    !Array.isArray(m.files) ||
    m.files.length < 3 ||
    m.files.length > OFFLINE_COURSE_MAX_FILES
  ) {
    throw new OfflineError('manifest');
  }
  const origin = new URL(scope).origin;
  const lang = id.includes('/') ? id.split('/')[0] : '';
  const slug = id.split('/').pop()!;
  const legacyRoot = lang && legacyMedia[lang] ? new URL(legacyMedia[lang], scope).href : '';
  const urls = new Set<string>();
  let bytes = 0;
  const media = new Map<string, Set<string>>();
  for (const f of m.files) {
    if (
      !f ||
      typeof f.url !== 'string' ||
      urls.has(f.url) ||
      !HASH.test(f.sha256) ||
      !Number.isSafeInteger(f.bytes) ||
      f.bytes <= 0 ||
      f.bytes > MAX_FILE_BYTES
    )
      throw new OfflineError('format');
    urls.add(f.url);
    const url = new URL(f.url, scope);
    const inScope = url.href.startsWith(scope);
    const inMedia = !!legacyRoot && url.href.startsWith(legacyRoot);
    if (url.origin !== origin || (!inScope && !inMedia) || url.hash || url.username || url.password)
      throw new OfflineError('origin');
    if (f.url === `${id}/`) {
      if (f.type !== 'text/html' || f.bytes > OFFLINE_PAGE_MAX_BYTES) throw new OfflineError('page');
    } else {
      // 同じoriginの /media/ を先に判定。通常版・字幕版とも本文のhashとパスのhashを一致させる（パスの読み方は media-shared.ts の parseMediaPath。query の付いたものは読まない）
      const hashed = parseMediaPath(f.url);
      if (hashed) {
        if (
          hashed.lang !== (lang || 'ja') ||
          hashed.course !== slug ||
          hashed.sha256 !== f.sha256 ||
          f.type !== 'video/mp4'
        )
          throw new OfflineError('media');
        const key = `${hashed.lecture}${lang ? `.${lang}` : ''}`;
        const types = media.get(key) ?? new Set<string>();
        types.add(hashed.kind === 'captioned' ? 'cc' : 'mp4');
        media.set(key, types);
        bytes += f.bytes;
        continue;
      }
      const rest = inMedia ? url.href.slice(legacyRoot.length) : url.href.slice(scope.length);
      const match = new RegExp(
        `^${inMedia ? '' : `${lang ? `${lang}\\/` : ''}`}([A-Za-z0-9][A-Za-z0-9_-]*)\\/${inMedia ? '' : 'media\\/'}${MEDIA_NAME}\\?v=([a-f0-9]{64})$`,
      ).exec(rest) as (RegExpExecArray & { 2: string }) | null;
      // 正規表現の捕捉群 2（名前）と 4（拡張子）は、一致したときは必ずある。
      // 訳の講座の動画は、名前の終わりに講座の言語が付く（S01.en）。日本語の講座は付かない（S01）
      const nameLang = match?.[2].includes('.') ? match[2]!.split('.')[1] : '';
      if (
        !match ||
        match[1] !== slug ||
        nameLang !== lang ||
        match[5] !== m.pageVersion ||
        f.type !== (match[4] === 'mp4' ? 'video/mp4' : 'image/jpeg') ||
        (match[3] && match[4] !== 'mp4')
      ) {
        throw new OfflineError('media');
      }
      // 字幕を焼き込んだ版（.cc.mp4）は、同じレクチャーの動画とポスターに足すもの
      const types = media.get(match[2]!) ?? new Set<string>();
      types.add(match[3] ? 'cc' : match[4]!);
      media.set(match[2]!, types);
    }
    bytes += f.bytes;
  }
  if (
    !urls.has(`${id}/`) ||
    media.size === 0 ||
    [...media.values()].some((x) => !x.has('mp4') || !x.has('jpg')) ||
    bytes !== m.bytes ||
    bytes > OFFLINE_COURSE_MAX_BYTES
  )
    throw new OfflineError('incomplete');
  return m;
}

/**
 * 保存の記録の 1 つの版を確かめる（教材情報と、Cache の名前がその講座のものか）。prefix は Cache の名前の頭（chalkfile:<scope の path>:offline-v1:）。
 * 利用者が保存した記録も毎回ここを通る。ここと validateManifest を厳しくすると、保存した講座が読めなくなる（tests/unit/offline-compat.test.ts）
 */
export function checkSavedVersion(value: unknown, id: string, scope: string, prefix: string): SavedVersion {
  const v = value as SavedVersion;
  validateManifest(v?.manifest, id, scope);
  if (typeof v.cache !== 'string' || !v.cache.startsWith(`${prefix}course:${id}:`)) throw new OfflineError('manifest');
  return v;
}

/** 保存の記録を読む（site/sw.ts）。1 つでも読めない版があれば、記録全体を読めないとして OfflineError を投げる */
export function parseRecord(value: unknown, id: string, scope: string, prefix: string): SavedRecord {
  const r = value as SavedRecord;
  if (!r || !Array.isArray(r.versions) || r.versions.length > 2) throw new OfflineError('manifest');
  for (const v of r.versions) checkSavedVersion(v, id, scope, prefix);
  return r;
}

/** 読めない記録が指していた Cache の名前（隔離する）。記録の形が壊れていて分からなければ null（その講座の Cache を全部隔離する） */
export function recordCaches(value: unknown, id: string, prefix: string): string[] | null {
  const versions = (value as { versions?: unknown } | null | undefined)?.versions;
  const names = Array.isArray(versions)
    ? versions.flatMap((v) => {
        const cache = (v as { cache?: unknown } | null)?.cache;
        return typeof cache === 'string' && cache.startsWith(`${prefix}course:${id}:`) ? [cache] : [];
      })
    : [];
  return names.length ? names : null;
}

/** 読めない記録が指す Cache を、消さずに残す日数。過ぎたら中身ごと消す */
export const QUARANTINE_DAYS = 30;
/**
 * 隔離の印。Cache API には名前を変える操作が無く、写すと容量が 2 倍要る。そこで中身は元の名前のまま残し、
 * 空の Cache を「quarantine:<隔離した時刻（ミリ秒）>:<元の名前>」の名前で作って印にする。元の名前のままなので、記録が読めるように戻れば、そのまま保存版に戻る
 */
export const quarantineName = (cache: string, at: number) => `quarantine:${at}:${cache}`;
export function parseQuarantineName(name: string): { at: number; cache: string } | null {
  const m = /^quarantine:(\d{1,16}):(.+)$/.exec(name);
  return m ? { at: Number(m[1]), cache: m[2]! } : null;
}

export type CleanupInput = {
  /** caches.keys() */
  names: string[];
  /** Cache の名前の頭（chalkfile:<scope の path>:offline-v1:）。これで始まらない Cache と、その印には触れない */
  prefix: string;
  /** 残す Cache（registry・今の shell・読める記録が指す版） */
  keep: Set<string>;
  /** 隔離する Cache（読めない記録が指す版）と、記録の形が壊れていて指す先が分からない講座 */
  held: { caches: Set<string>; ids: Set<string> };
  /** 前の版の shell も消す（activate のときだけ） */
  oldShell: boolean;
  now: number;
};

/**
 * cleanup で消す Cache と、新しく付ける隔離の印を決める（site/sw.ts が実行する）。
 * 記録が指さない講座の Cache（途中で終わった保存の仮領域・更新で外れた版）は消す。読めない記録が指す Cache は消さずに印を付け、
 * 印から 30 日たったら中身ごと消す。読めるように戻った・記録が消えた（保存し直し・削除）ときは印を外す。未来の時刻の印（端末の時計のずれ）は付け直す
 */
export function planCleanup({ names, prefix, keep, held, oldShell, now }: CleanupInput): {
  remove: string[];
  create: string[];
} {
  const DAY = 24 * 60 * 60 * 1000;
  const course = `${prefix}course:`;
  const isHeld = (name: string) =>
    held.caches.has(name) || [...held.ids].some((id) => name.startsWith(`${course}${id}:`));
  const exists = new Set(names);
  const marks = new Map<string, { name: string; at: number }[]>();
  for (const name of names) {
    const q = parseQuarantineName(name);
    if (q?.cache.startsWith(course)) marks.set(q.cache, [...(marks.get(q.cache) ?? []), { name, at: q.at }]);
  }
  const remove = new Set<string>();
  const create: string[] = [];
  for (const name of names) {
    if (keep.has(name) || parseQuarantineName(name)) continue;
    if (name.startsWith(course)) {
      if (!isHeld(name)) {
        remove.add(name);
        continue;
      }
      const at = (marks.get(name) ?? []).filter((m) => m.at <= now + DAY).map((m) => m.at);
      if (!at.length) create.push(quarantineName(name, now));
      else if (now - Math.min(...at) >= QUARANTINE_DAYS * DAY) remove.add(name);
    } else if (oldShell && name.startsWith(`${prefix}shell:`)) remove.add(name);
  }
  for (const [cache, list] of marks) {
    const holding = exists.has(cache) && !remove.has(cache) && !keep.has(cache) && isHeld(cache);
    for (const m of list) if (!holding || m.at > now + DAY) remove.add(m.name);
  }
  return { remove: [...remove], create };
}

export async function sha256(data: ArrayBuffer): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), (x) =>
    x.toString(16).padStart(2, '0'),
  ).join('');
}

/*
 * SW とページのやりとり（型だけ。送る値は site/sw.ts と site/offline-client.ts が作る）。
 * ページは MessageChannel の port を 1 つ添えて SW に頼み、SW はその port に答える。保存・削除が終わると、SW は全部のタブに知らせる。
 * 形を変えると、開いたままの古いページと新しい SW（またはその逆）の組で、保存の画面が動かなくなる。変えるときは protocol を上げ、古い形も受ける
 */

/** ページから SW への頼みごと（type で分ける）。lang は、SW が返すエラーの文の言語 */
export type OfflineRequest =
  /** このサイトの講座と、保存してある講座の、保存の状態（id は送らない） */
  | { protocol: 1; type: 'STATUS'; id?: undefined; lang: string }
  /** id の講座の、今の保存用の教材情報（保存はしない） */
  | { protocol: 1; type: 'CHECK'; id: string; lang: string }
  /** id の講座を保存する。答えの前に、進み具合を何度か送る */
  | { protocol: 1; type: 'SAVE'; id: string; lang: string }
  /** 進んでいる保存を止める。止める講座が分からないときは id が無い（SW は「講座を選んで」と答える） */
  | { protocol: 1; type: 'CANCEL'; id: string | undefined; lang: string }
  /** id の講座の保存を消す（学習メモと進み具合は消さない） */
  | { protocol: 1; type: 'DELETE'; id: string; lang: string };
export type OfflineOperation = OfflineRequest['type'];

/** 頼みごとごとの、うまくいったときの答え */
export type OfflineResults = {
  STATUS: { ok: true; courses: CourseStatus[] };
  CHECK: { ok: true; manifest: CourseManifest };
  SAVE: { ok: true };
  CANCEL: { ok: true };
  DELETE: { ok: true };
};

/**
 * SW が port に送るもの。SAVE の途中の進み具合・うまくいった答え・うまくいかなかった答え（error は頼みごとの lang の文）のどれか。
 * 受け取る側が progress と ok で分けられるよう、それぞれに無い項目は undefined と書いておく
 */
export type OfflineReply<K extends OfflineOperation = OfflineOperation> =
  | { progress: DownloadProgress; ok?: undefined; error?: undefined }
  | (OfflineResults[K] & { progress?: undefined; error?: undefined })
  | { ok: false; error: string; progress?: undefined };

/** SW から全部のタブへの知らせ。保存（止めた・失敗したときも）と削除が終わると送り、受け取ったタブは STATUS で状態を取り直す */
export type OfflineBroadcast = { protocol: 1; type: 'CHANGED' };
