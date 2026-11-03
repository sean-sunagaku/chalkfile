// 静的な応答のヘッダー（scripts/site/headers.ts の _headers）。Workers の静的 assets と同じ重ね方で、パスごとに効くヘッダーを確かめる
import { describe, expect, test } from 'bun:test';
import { HEADER_RULES, HEADERS, headersFile, headersFor, parseHeaders } from '../scripts/site/headers';

const SECURITY = {
  'content-security-policy': "frame-ancestors 'none'",
  'x-frame-options': 'DENY',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'cross-origin-opener-policy': 'same-origin',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
};

describe('静的な応答のヘッダー（_headers）', () => {
  test('ページ・画像・manifest は、書き換えを止めて毎回確かめ直す。ほかのサイトの枠に入れさせない', () => {
    for (const p of [
      '/',
      '/index.html',
      '/stripe-billing/',
      '/en/pstack-comedy/',
      '/stripe-billing/media/L01.jpg',
      '/icons/icon-192.png',
      '/assets/themes/paper.jpg',
      '/manifest.webmanifest',
      '/offline/',
      '/404.html',
    ]) {
      const { headers, joined } = headersFor(p);
      expect(joined).toEqual([]);
      expect(Object.fromEntries(headers)).toEqual({
        ...SECURITY,
        'cache-control': 'public, max-age=0, must-revalidate, no-transform',
      });
    }
  });
  test('Service Worker は no-cache。全部に当たる規則の Cache-Control を外してから付けるので、値がつながらない', () => {
    const { headers, joined } = headersFor('/sw.js');
    expect(joined).toEqual([]);
    expect(headers.get('cache-control')).toBe('no-cache, no-transform');
    expect(headers.get('x-frame-options')).toBe('DENY');
  });
  test('外さずに同じヘッダーを 2 つの規則で付けると、値がカンマでつながる（前の _headers の /sw.js）', () => {
    const before =
      '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Cache-Control: public, max-age=0, must-revalidate, no-transform\n/sw.js\n  Cache-Control: no-cache, no-transform\n';
    const { headers, joined } = headersFor('/sw.js', parseHeaders(before));
    expect(joined).toEqual(['Cache-Control']);
    expect(headers.get('cache-control')).toBe(
      'public, max-age=0, must-revalidate, no-transform, no-cache, no-transform',
    );
  });
  test('_headers の書き方に戻せる（パスの行・! で外す行・名前: 値の行）', () => {
    expect(parseHeaders(HEADERS)).toEqual(
      HEADER_RULES.map((r) => ({ path: r.path, detach: [...(r.detach ?? [])], set: { ...r.set } })),
    );
    expect(HEADERS).toContain('/sw.js\n  ! Cache-Control\n  Cache-Control: no-cache, no-transform\n');
    expect(() => parseHeaders('  Cache-Control: no-store\n')).toThrow('_headers の 1 行目が読めない');
  });
  test('パスの形は、* が何文字でも、:name が / の手前まで（query は見ない）', () => {
    const rules = parseHeaders(headersFile([{ path: '/:course/media/*', set: { 'X-Test': 'media' } }]));
    expect(headersFor('/stripe-billing/media/L01.jpg', rules).headers.get('x-test')).toBe('media');
    expect(headersFor('/en/pstack-comedy/media/P01.en.jpg', rules).headers.get('x-test')).toBeUndefined();
    expect(headersFor('/stripe-billing/', rules).headers.get('x-test')).toBeUndefined();
  });
});
