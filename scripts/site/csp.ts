// ページの CSP（meta の Content-Security-Policy）。script-src には、組み立てが入れる信頼できる script のハッシュだけを、
// 描く前に計算して書く（組み上がった HTML の中の <script> から集めると、エスケープし忘れて紛れ込んだ script も許してしまう）。
// 信頼できる script は 3 本: www の移動（下の定数）・講座のページの画面（site/course-page.ts の bundle）・offline-client（bundle）。
// 最終の HTML で動く script がこの 3 本のどれかで、CSP と過不足なく合うかは、組み立ての最後に scripts/site-invariants.ts が確かめる。
// 保存版のページは SW が応答のヘッダーを作り直すので、CSP は HTTP のヘッダーではなく meta に書く

import { createHash } from 'node:crypto';
import config from '../../chalkfile.config';
import { type Html, html, inlineScript } from './html';

/**
 * www.chalkfile.com で開いたら、同じ path・query・hash の apex へ移す script。HTML は無料の assets のまま返す
 * （http:// や、任意の外のホストを移り先に使わない）。全部のページの頭（__CSP__ の所）に入れる
 */
export const WWW_REDIRECT_SCRIPT = `if(location.hostname==='www.${new URL(config.origin).hostname}'){location.replace('${new URL(config.origin).origin}'+location.pathname+location.search+location.hash);}`;

/** CSP の script-src に書くハッシュ（'sha256-<base64>'） */
export const scriptHash = (body: string) => `'sha256-${createHash('sha256').update(body).digest('base64')}'`;

/** CSP の中身（script-src は渡したハッシュ。無ければ 'none'） */
export const cspPolicy = (hashes: readonly string[]) =>
  [
    "default-src 'self'",
    `script-src ${hashes.length ? hashes.join(' ') : "'none'"}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data:",
    "media-src 'self' blob:",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');

/**
 * テンプレートの __CSP__ に入れるもの: meta の CSP と、www の移動の script。scripts は、そのページがこのあとに入れる script
 * （文書の順。www の移動を先頭に足す）
 */
export const cspHead = (scripts: readonly string[]): Html => {
  const hashes = [WWW_REDIRECT_SCRIPT, ...scripts].map(scriptHash);
  return html`<meta http-equiv="Content-Security-Policy" content="${cspPolicy(hashes)}">${inlineScript(WWW_REDIRECT_SCRIPT)}`;
};
