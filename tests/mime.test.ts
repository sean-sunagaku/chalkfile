import { describe, expect, test } from 'bun:test';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { contentTypeOf, MIME, mimeOf, mimeTypeOf } from '../site/mime';

// 拡張子と MIME の対応表（site/mime.ts）。組み立ては site/assets の型をここから付け、知らない拡張子なら止める（W-30）
describe('拡張子と MIME の対応表', () => {
  test('拡張子から型を付ける（大文字・クエリ・フォルダの場所があっても）', () => {
    expect(mimeOf('assets/hero.jpg')).toBe('image/jpeg');
    expect(mimeOf('assets/themes/PAPER.JPG')).toBe('image/jpeg');
    expect(mimeOf('icons/icon-192.png')).toBe('image/png');
    expect(mimeOf('stripe-billing/media/L01.jpg?v=abc')).toBe('image/jpeg');
    expect(mimeOf('manifest.webmanifest')).toBe('application/manifest+json');
    expect(mimeOf('stripe-billing/index.html')).toBe('text/html');
  });
  test('知らない拡張子・拡張子の無いファイルは、組み立てを止める（違う型を付けて SW の install を壊さない）', () => {
    for (const name of [
      'assets/logo.bmp',
      'assets/logo.svg',
      'assets/README',
      '_headers',
      'a.__proto__',
      'a.constructor',
    ]) {
      expect(mimeTypeOf(name)).toBeUndefined();
      expect(() => mimeOf(name)).toThrow('知らない拡張子のファイル');
    }
  });
  test('配信の Content-Type は、文字のファイルにだけ charset=utf-8 を付ける', () => {
    expect(contentTypeOf('index.html')).toBe('text/html; charset=utf-8');
    expect(contentTypeOf('sw.js')).toBe('text/javascript; charset=utf-8');
    expect(contentTypeOf('offline-manifest.json')).toBe('application/json');
    expect(contentTypeOf('a.png')).toBe('image/png');
    expect(contentTypeOf('a.bmp')).toBeUndefined();
  });
  test('今の site/assets のファイルは、どれも型が分かる', () => {
    const root = path.join(import.meta.dir, '../site/assets');
    const files = readdirSync(root, { recursive: true, withFileTypes: true }).filter((e) => e.isFile());
    expect(files.length).toBeGreaterThan(0);
    for (const e of files) expect(Object.values(MIME)).toContain(mimeOf(e.name));
  });
});
