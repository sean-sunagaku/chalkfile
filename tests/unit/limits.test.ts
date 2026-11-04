import { required } from '../support/required';
import { describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkArtifact } from '../../scripts/check_delivery';
import * as limits from '../../site/limits';
import {
  MEDIA_LIST_MAX_ENTRIES,
  OFFLINE_COURSE_MAX_BYTES,
  OFFLINE_COURSE_MAX_FILES,
  OFFLINE_FILE_MAX_BYTES,
  OFFLINE_PAGE_MAX_BYTES,
  RELEASE_ASSET_MAX_BYTES,
  WORKERS_ASSET_MAX_BYTES,
} from '../../site/limits';
import { type MediaEntry, mediaFilename, validateMediaManifest } from '../../site/media-shared';
import { type Asset, MAX_FILE_BYTES, OfflineError, validateManifest } from '../../site/offline-shared';

// 上限の正本（site/limits.ts）と、それを使う確かめが、境目の値で合うか（その値までは通し、1 つ超えたら止める）。
// 保存の上限を厳しくすると、利用者が保存した講座が読めなくなる（tests/unit/offline-compat.test.ts）。緩める方向だけにする

describe('上限の値', () => {
  test('今の値（変えるときは site/limits.ts の頭書きを読み、ここも直す）', () => {
    expect({ ...limits }).toEqual({
      OFFLINE_FILE_MAX_BYTES: 32 * 1024 ** 2,
      OFFLINE_PAGE_MAX_BYTES: 4 * 1024 ** 2,
      OFFLINE_COURSE_MAX_BYTES: 1024 ** 3,
      OFFLINE_COURSE_MAX_FILES: 201,
      VIDEO_TARGET_BYTES: 14500 * 1024,
      RELEASE_ASSET_MAX_BYTES: 2 * 1024 ** 3 - 1,
      RELEASE_MAX_ASSETS: 1000,
      MEDIA_LIST_MAX_ENTRIES: 20000,
      WORKERS_ASSET_MAX_BYTES: 25 * 1024 ** 2,
      WORKERS_MAX_ASSETS: 20000,
    });
  });
  test('site/limits.ts は、ほかのファイルを読まない（sw.js と Worker にも入る）', () => {
    expect(readFileSync(path.join(import.meta.dir, '../../site/limits.ts'), 'utf8')).not.toMatch(
      /^\s*(import|export\s.*\sfrom)\b/m,
    );
  });
});

describe('保存の確かめ（site/offline-shared.ts の validateManifest）', () => {
  const hash = 'a'.repeat(64);
  const scope = 'https://example.com/';
  /** ページ 1 つと、lectures 本のレクチャーの動画とポスター */
  const manifest = (o: { page?: number; video?: number; lectures?: number } = {}) => {
    const files: Asset[] = [{ url: 'sample/', bytes: o.page ?? 10, sha256: hash, type: 'text/html' }];
    for (let i = 1; i <= (o.lectures ?? 1); i++) {
      const id = `S${String(i).padStart(3, '0')}`;
      files.push({ url: `/media/ja/sample/${id}.${hash}.mp4`, bytes: o.video ?? 30, sha256: hash, type: 'video/mp4' });
      files.push({ url: `sample/media/${id}.jpg?v=${hash}`, bytes: 20, sha256: hash, type: 'image/jpeg' });
    }
    return { schema: 1, id: 'sample', title: 'サンプル', pageVersion: hash, revision: hash, bytes: 0, files };
  };
  /** 合計を数え直して確かめる。通れば ok、止まれば OfflineError の code */
  const result = (m: ReturnType<typeof manifest>) => {
    m.bytes = m.files.reduce((n, f) => n + f.bytes, 0);
    try {
      validateManifest(m, 'sample', scope);
      return 'ok';
    } catch (e) {
      return e instanceof OfflineError ? e.code : String(e);
    }
  };

  test('1 ファイル（動画も）', () => {
    expect(MAX_FILE_BYTES).toBe(OFFLINE_FILE_MAX_BYTES);
    expect(result(manifest({ video: OFFLINE_FILE_MAX_BYTES }))).toBe('ok');
    expect(result(manifest({ video: OFFLINE_FILE_MAX_BYTES + 1 }))).toBe('format');
  });
  test('講座のページ（HTML）', () => {
    expect(result(manifest({ page: OFFLINE_PAGE_MAX_BYTES }))).toBe('ok');
    expect(result(manifest({ page: OFFLINE_PAGE_MAX_BYTES + 1 }))).toBe('page');
  });
  test('1 講座の合計', () => {
    // 動画を上限の大きさで並べ、最後の 1 本で合計をちょうど上限にする
    const lectures = Math.ceil(OFFLINE_COURSE_MAX_BYTES / OFFLINE_FILE_MAX_BYTES);
    const exact = manifest({ video: OFFLINE_FILE_MAX_BYTES, lectures });
    const last = required(exact.files[exact.files.length - 2]);
    last.bytes -= exact.files.reduce((n, f) => n + f.bytes, 0) - OFFLINE_COURSE_MAX_BYTES;
    expect(result(exact)).toBe('ok');
    last.bytes += 1;
    expect(result(exact)).toBe('incomplete');
  });
  test('1 講座のファイルの数', () => {
    const lectures = (OFFLINE_COURSE_MAX_FILES - 1) / 2;
    const full = manifest({ lectures });
    expect(full.files).toHaveLength(OFFLINE_COURSE_MAX_FILES);
    expect(result(full)).toBe('ok');
    full.files.push({ url: `/media/ja/sample/S001.cc.${hash}.mp4`, bytes: 30, sha256: hash, type: 'video/mp4' });
    expect(result(full)).toBe('manifest');
  });
});

describe('動画の一覧の確かめ（site/media-shared.ts の validateMediaManifest）', () => {
  const entry = (o: Partial<MediaEntry> = {}): MediaEntry => {
    const e = {
      lang: 'ja',
      course: 'sample',
      lecture: 'L01',
      kind: 'standard' as const,
      bytes: 100,
      sha256: 'a'.repeat(64),
      tag: 'media-ja-sample',
      ...o,
    };
    return { ...e, filename: mediaFilename(e) };
  };
  test('動画 1 本の大きさ（GitHub Releases の 1 ファイルは 2 GiB 未満）', () => {
    expect(() =>
      validateMediaManifest({ schema: 1, entries: [entry({ bytes: RELEASE_ASSET_MAX_BYTES })] }),
    ).not.toThrow();
    expect(() =>
      validateMediaManifest({ schema: 1, entries: [entry({ bytes: RELEASE_ASSET_MAX_BYTES + 1 })] }),
    ).toThrow();
  });
  test('一覧の項目の数（retained も数える）', () => {
    const retained = (n: number) => Array.from({ length: n }, (_, i) => entry({ lecture: `R${i}` }));
    expect(() =>
      validateMediaManifest({ schema: 1, entries: [entry()], retained: retained(MEDIA_LIST_MAX_ENTRIES - 1) }),
    ).not.toThrow();
    expect(() =>
      validateMediaManifest({ schema: 1, entries: [entry()], retained: retained(MEDIA_LIST_MAX_ENTRIES) }),
    ).toThrow();
  });
});

describe('公開物の点検（scripts/check_delivery.ts の checkArtifact）', () => {
  test('Workers の 1 ファイルの上限', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'chalkfile-limits-'));
    try {
      // 中身の無い（大きさだけの）ファイル。画像の名前なので、秘密情報の形は探さない
      const file = path.join(dir, 'big.jpg');
      writeFileSync(file, '');
      truncateSync(file, WORKERS_ASSET_MAX_BYTES);
      expect(checkArtifact(dir)).toBe(1);
      truncateSync(file, WORKERS_ASSET_MAX_BYTES + 1);
      expect(() => checkArtifact(dir)).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
