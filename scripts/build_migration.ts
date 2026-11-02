// 旧 GitHub Pages の案内だけを作る。動画・保存cacheの消去は行わない。
import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { COURSES } from '../content';
export const MIGRATION_TARGET = 'https://chalkfile.com/';
export const LEGACY_SCOPE = '/chalkfile/';
export function migrationUrl(value: string) {
  const url = new URL(value, 'https://sean-sunagaku.github.io');
  const result = new URL(MIGRATION_TARGET);
  result.pathname = `/${(url.pathname.startsWith(LEGACY_SCOPE) ? url.pathname.slice(LEGACY_SCOPE.length) : '').replace(/^\/+/, '')}`;
  result.search = url.search; result.hash = url.hash;
  return result.href;
}
export function migrationHtml(relative: string) {
  const target = new URL(relative, MIGRATION_TARGET).href;
  const script = `(async function(){var p=location.pathname.indexOf('/chalkfile/')===0?location.pathname.slice('/chalkfile/'.length):'';var next=new URL('https://chalkfile.com/');next.pathname='/'+p.replace(/^\\/+/, '');next.search=location.search;next.hash=location.hash;document.querySelector('meta[http-equiv=refresh]').content='5;url='+next.href;var link=document.getElementById('movedLink');link.href=next.href;try{if('serviceWorker' in navigator){var r=await navigator.serviceWorker.register('/chalkfile/sw.js',{scope:'/chalkfile/',updateViaCache:'none'});await r.update();}}catch(e){}location.replace(next.href);})();`;
  const hash = createHash('sha256').update(script).digest('base64');
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chalkfile は引っ越しました</title><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${hash}'; style-src 'unsafe-inline'; worker-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'"><link rel="canonical" href="${target}"><meta http-equiv="refresh" content="5;url=${target}"><meta name="referrer" content="strict-origin-when-cross-origin"><style>body{font-family:system-ui,sans-serif;line-height:1.8;max-width:42em;margin:10vh auto;padding:24px}a{color:#245b43}</style></head><body><h1>Chalkfile は引っ越しました</h1><p>講座は chalkfile.com で続けて利用できます。</p><p><a id="movedLink" href="${target}">新しい場所で講座を開く</a></p><p>旧サイトで保存した講座と学習記録は自動で移りません。オンラインで新しい場所を開き、使う講座を保存し直してください。旧サイトの保存版はオフラインでも利用できます。</p><script>${script}</script></body></html>\n`;
}
export async function buildMigration() {
  const root = path.resolve(import.meta.dir, '../site/migration-dist');
  rmSync(root, { recursive: true, force: true }); mkdirSync(root, { recursive: true });
  for (const relative of ['', ...COURSES.map((c) => `${c.id}/`)]) {
    const dir = path.join(root, relative); mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'index.html'), migrationHtml(relative));
  }
  writeFileSync(path.join(root, '404.html'), migrationHtml(''));
  writeFileSync(path.join(root, '.nojekyll'), '');
  writeFileSync(path.join(root, 'migration-health.json'), JSON.stringify({ target: MIGRATION_TARGET }));
  const result = await Bun.build({ entrypoints: [path.resolve(import.meta.dir, '../site/legacy-sw.ts')], target: 'browser' });
  if (!result.success) throw new Error('移行SWを組み立てられません。');
  writeFileSync(path.join(root, 'sw.js'), await result.outputs[0].text());
  console.log('site/migration-dist: 案内9ページ・404・保存版を保持する移行SWを作成');
}
if (import.meta.main) await buildMigration();
