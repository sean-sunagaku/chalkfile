// ページの CSP（meta の Content-Security-Policy）。script-src は、ページの中で動く script のハッシュだけを許す。
// 保存版のページは SW が応答のヘッダーを作り直すので、CSP は HTTP のヘッダーではなく meta に書く
import { createHash } from 'node:crypto';

/**
 * www.chalkfile.com で開いたら、同じ path・query・hash の apex へ移す script。HTML は無料の assets のまま返す
 * （http:// や、任意の外のホストを移り先に使わない）。全部のページの頭に入れる
 */
export const WWW_REDIRECT_SCRIPT =
  "if(location.hostname==='www.chalkfile.com'){location.replace('https://chalkfile.com'+location.pathname+location.search+location.hash);}";

/** CSP の script-src に書くハッシュ（'sha256-<base64>'） */
export const scriptHash = (body: string) => `'sha256-${createHash('sha256').update(body).digest('base64')}'`;

/** CSP の中身（script-src は渡したハッシュ。無ければ 'none'） */
export const cspPolicy = (hashes: readonly string[]) =>
  [
    "default-src 'self'",
    `script-src ${hashes.length ? hashes.join(' ') : "'none'"}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    'font-src https://fonts.gstatic.com',
    "img-src 'self' data:",
    "media-src 'self' blob:",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');

/** ページの中のスクリプト（<script> だけのもの）のハッシュで CSP を作り、__CSP__ の所に www の移動の script と一緒に入れる */
export const withCsp = (html: string) => {
  const marked = html.replace('__CSP__', `__CSP__<script>${WWW_REDIRECT_SCRIPT}</script>`);
  const hashes = [...marked.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => scriptHash(m[1]));
  return marked.replace('__CSP__', () => `<meta http-equiv="Content-Security-Policy" content="${cspPolicy(hashes)}">`);
};
