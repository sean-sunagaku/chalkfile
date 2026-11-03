// ページの CSP（meta の Content-Security-Policy）。script-src には、組み立てが入れる信頼できる script のハッシュだけを、
// 描く前に計算して書く（組み上がった HTML の中の <script> から集めると、エスケープし忘れて紛れ込んだ script も許してしまう）。
// 信頼できる script は 3 本: www の移動（下の定数）・講座のページの本体（site/template.html の script）・offline-client（bundle）。
// 最終の HTML で動く script がこの 3 本のどれかで、CSP と過不足なく合うかは、組み立ての最後に scripts/site-invariants.ts が確かめる。
// 保存版のページは SW が応答のヘッダーを作り直すので、CSP は HTTP のヘッダーではなく meta に書く
import { createHash } from 'node:crypto';
import { type Html, html, inlineScript } from './html';

/**
 * www.chalkfile.com で開いたら、同じ path・query・hash の apex へ移す script。HTML は無料の assets のまま返す
 * （http:// や、任意の外のホストを移り先に使わない）。全部のページの頭（__CSP__ の所）に入れる
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

/**
 * テンプレートの __CSP__ に入れるもの: meta の CSP と、www の移動の script。scripts は、そのページがこのあとに入れる script
 * （文書の順。www の移動を先頭に足す）
 */
export const cspHead = (scripts: readonly string[]): Html => {
  const hashes = [WWW_REDIRECT_SCRIPT, ...scripts].map(scriptHash);
  return html`<meta http-equiv="Content-Security-Policy" content="${cspPolicy(hashes)}">${inlineScript(WWW_REDIRECT_SCRIPT)}`;
};

/**
 * 講座のページのテンプレートから、ページの本体の script（属性の無い <script> がちょうど 1 つ）を取り出し、その場所を __PAGE_SCRIPT__ にする。
 * 取り出した本体は、CSP のハッシュを先に計算する信頼できるソースの 1 つ
 */
export const splitPageScript = (template: string, where: string): { template: string; script: string } => {
  const blocks = [...template.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  if (blocks.length !== 1)
    throw new Error(`${where} に、ページの本体の script（属性の無い <script>）が 1 つではなく ${blocks.length} ある`);
  const [block] = blocks;
  const at = block.index ?? 0;
  return {
    template: `${template.slice(0, at)}__PAGE_SCRIPT__${template.slice(at + block[0].length)}`,
    script: block[1],
  };
};
