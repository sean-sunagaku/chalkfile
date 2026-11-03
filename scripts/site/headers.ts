// Workers の静的 assets に置く、ページのほかのファイル: 応答のヘッダー（_headers）・送らないファイル（.assetsignore）・404 のページ
import { rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * 応答のヘッダー。保存用の SHA-256 と CSP を保つため、Cloudflare による HTML や画像の書き換えと、自動の beacon の差し込みを止める
 * （no-transform）。Service Worker は no-cache
 */
export const HEADERS =
  '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Cache-Control: public, max-age=0, must-revalidate, no-transform\n/sw.js\n  Cache-Control: no-cache, no-transform\n';

/** MP4 とローカルの設定（. で始まるファイル）は、静的 assets に送らない */
export const ASSETS_IGNORE = '**/*.mp4\n.*\n';

/** 無いページの 404（wrangler.jsonc の not_found_handling: 404-page）。__CSP__ は呼ぶ側が CSP にする */
export const NOT_FOUND_HTML =
  '<!doctype html><html lang="ja"><head><meta charset="utf-8">__CSP__<meta name="viewport" content="width=device-width"><title>教材が見つかりません｜Chalkfile</title></head><body><h1>教材が見つかりません</h1><p><a href="/">講座一覧へ</a></p></body></html>';

/** ヘッダー・送らないファイル・404 のページを書く。notFound は CSP を付けた 404 のページ */
export const writeServingFiles = (dist: string, notFound: string) => {
  // 前の配信先（旧 Pages）の頃の名残の、空のファイル。消すと公開物のファイルが変わるので、ここでは残す（前の配信先の名残をまとめて消す直しで消す）
  writeFileSync(path.join(dist, '.nojekyll'), '');
  writeFileSync(path.join(dist, '.assetsignore'), ASSETS_IGNORE);
  rmSync(path.join(dist, '_redirects'), { force: true });
  writeFileSync(path.join(dist, '_headers'), HEADERS);
  writeFileSync(path.join(dist, '404.html'), notFound);
};
