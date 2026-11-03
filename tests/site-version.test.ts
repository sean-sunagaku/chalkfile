import { describe, expect, test } from 'bun:test';
import { PAGE_VERSION_MARK, pageVersionOf, stampVersion, type PageVersionInput } from '../scripts/site-version';
import type { Asset } from '../site/offline-shared';

// 版の印を入れたまま描いた講座のページと、保存の manifest に入るファイル（scripts/build_site.ts と同じ形の小さな見本）
const sha = (c: string) => c.repeat(64);
const videoUrl = `/media/ja/sample/L01.${sha('a')}.mp4`;
const html = '<!doctype html><html lang="ja"><head><title>サンプル講座｜Chalkfile</title></head><body>' +
  `<script id="course-data" type="application/json">{"pageVersion":"${PAGE_VERSION_MARK}","lectures":[{"video":"${videoUrl}","poster":"media/L01.jpg?v=${PAGE_VERSION_MARK}"}]}</script>` +
  `<script id="pwa-data" type="application/json">{"course":{"id":"sample","title":"サンプル講座","pageVersion":"${PAGE_VERSION_MARK}"}}</script></body></html>`;
const video: Asset = { url: videoUrl, bytes: 1000, sha256: sha('a'), type: 'video/mp4' };
const poster: Asset = { url: `sample/media/L01.jpg?v=${PAGE_VERSION_MARK}`, bytes: 100, sha256: sha('b'), type: 'image/jpeg' };
const input = (): PageVersionInput => ({ html, files: [{ ...video }, { ...poster }] });

describe('サイトの版（出力から決める）', () => {
  test('同じ入力なら同じ版。形は sha256 の 16 進 64 字（validateManifest が求める形）', () => {
    expect(pageVersionOf(input())).toBe(pageVersionOf(input()));
    expect(pageVersionOf(input())).toMatch(/^[a-f0-9]{64}$/);
  });
  test('ページの HTML が 1 字変われば版が変わる', () => {
    const before = pageVersionOf(input());
    expect(pageVersionOf({ ...input(), html: html.replace('サンプル講座｜', 'サンプル講義｜') })).not.toBe(before);
    expect(pageVersionOf({ ...input(), html: html.replace('<body>', '<body> ') })).not.toBe(before);
  });
  test('動画の sha256 が変われば版が変わる', () => {
    const changed = input();
    changed.files[0].sha256 = sha('c');
    expect(pageVersionOf(changed)).not.toBe(pageVersionOf(input()));
  });
  test('ポスターの中身・動画の大きさ・並びが変われば版が変わる', () => {
    const before = pageVersionOf(input());
    const posterChanged = input();
    posterChanged.files[1].sha256 = sha('d');
    const bytesChanged = input();
    bytesChanged.files[0].bytes = 1001;
    expect(pageVersionOf(posterChanged)).not.toBe(before);
    expect(pageVersionOf(bytesChanged)).not.toBe(before);
    expect(pageVersionOf({ ...input(), files: [{ ...poster }, { ...video }] })).not.toBe(before);
  });
  test('印を版に置き換える（ページの全部の印と、ポスターの ?v=）', () => {
    const version = pageVersionOf(input());
    const page = stampVersion(html, version);
    expect(page).not.toContain(PAGE_VERSION_MARK);
    expect(page.split(version)).toHaveLength(html.split(PAGE_VERSION_MARK).length);
    expect(stampVersion(poster.url, version)).toBe(`sample/media/L01.jpg?v=${version}`);
    expect(stampVersion(video.url, version)).toBe(video.url);
  });
  test('公開したページと manifest のファイルから、版を計算し直せる（版は出力だけで決まる）', () => {
    const version = pageVersionOf(input());
    const page = stampVersion(html, version);
    const files = input().files.map((f) => ({ ...f, url: stampVersion(f.url, version) }));
    const back = (text: string) => text.replaceAll(version, PAGE_VERSION_MARK);
    expect(pageVersionOf({ html: back(page), files: files.map((f) => ({ ...f, url: back(f.url) })) })).toBe(version);
  });
});
