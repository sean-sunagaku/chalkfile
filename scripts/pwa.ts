// PWA の静的ファイルと、テーマの色から作る自前のアイコン。外部画像は使わない。
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Theme } from '../content/types';
import { isLang } from '../content/i18n';
import { SITE_TEXT } from '../site/i18n';
import { fill } from '../site/lib/text';
import { mimeOf } from '../site/mime';
import type { Asset } from '../site/offline-shared';
import { fillTemplate } from './site/html';

export const hash = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');
export function asset(url: string, data: Uint8Array, type: string): Asset {
  return { url, bytes: data.byteLength, sha256: hash(data), type };
}
const chunk = (name: string, data: Buffer) => {
  const type = Buffer.from(name);
  let crc = 0xffffffff;
  for (const byte of Buffer.concat([type, data])) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, type, data, checksum]);
};
function icon(size: number, t: Theme): Buffer {
  const rgb = (hex: string) => [1, 3, 5].map((p) => parseInt(hex.slice(p, p + 2), 16));
  const bg = rgb(t.color.bg), board = rgb(t.color.code), chalk = rgb(t.color.accent);
  const row = size * 3 + 1;
  const pixels = Buffer.alloc(row * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const rect = u >= 0.18 && u <= 0.82 && v >= 0.25 && v <= 0.75;
    const line = rect && v >= 0.63;
    const color = line ? chalk : rect ? board : bg;
    for (let c = 0; c < 3; c++) pixels[y * row + 1 + x * 3 + c] = color[c];
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}

/**
 * ページに入れる script を 1 本にまとめて縮める（講座のページの画面と offline-client）。1 つのページに 2 本を入れるので、それぞれを関数で包む
 * （iife。包まないと、両方の一番上の名前が同じ大域の変数になり、あとの script が前の script の値を書き換える）。
 * CSP のハッシュは、縮めたものから組み立てが計算する（scripts/site/csp.ts）。縮め方は Bun の版で変わるので、Bun の版を上げるとページの版も変わる
 */
export async function bundle(file: string): Promise<string> {
  const result = await Bun.build({ entrypoints: [file], target: 'browser', format: 'iife', minify: true });
  if (!result.success) throw new Error(result.logs.join('\n'));
  return result.outputs[0].text();
}

/**
 * mediaRoots: 訳の言語の動画のパス（言語 → /media/en/ など。site/config.json の media。sw.js の保存の検査が使う）。
 * disabledRevisions: 無効にした保存版の revision（site/disabled-revisions.ts。SW は、当たる保存版のページをオンラインでは開かない）
 */
export async function buildPwa(
  site: string,
  dist: string,
  brand: Theme,
  courses: string[],
  shell: Asset[],
  mediaRoots: Record<string, string> = {},
  disabledRevisions: readonly string[] = [],
) {
  mkdirSync(path.join(dist, 'icons'), { recursive: true });
  for (const size of [180, 192, 512]) {
    const bytes = icon(size, brand);
    const url = `icons/icon-${size}.png`;
    writeFileSync(path.join(dist, url), bytes);
    shell.push(asset(url, bytes, mimeOf(url)));
  }
  const manifest = JSON.stringify({
    id: './', name: 'Chalkfile', short_name: 'Chalkfile', lang: 'ja', start_url: './', scope: './', display: 'standalone',
    background_color: brand.color.bg, theme_color: brand.color.bg,
    description: '選んだ講座を保存して、教材と動画でオフライン学習',
    icons: [192, 512].map((s) => ({ src: `icons/icon-${s}.png`, sizes: `${s}x${s}`, type: 'image/png', purpose: 'any maskable' })),
  }, null, 2);
  writeFileSync(path.join(dist, 'manifest.webmanifest'), manifest);
  shell.push(asset('manifest.webmanifest', Buffer.from(manifest), mimeOf('manifest.webmanifest')));
  // 未保存のページは 1 つで全部の言語を並べる（{{ja.key}} を site/i18n.ts の文字にする。エスケープは fillTemplate）。
  // __ROOT__ は、SW が配るときにアプリの場所にする（sw.ts の fallback）
  const text = (k: string) => {
    const [lang, key] = k.split('.');
    return isLang(lang) && key && Object.hasOwn(SITE_TEXT[lang], key) ? fill(SITE_TEXT[lang][key as keyof (typeof SITE_TEXT)['ja']]) : undefined;
  };
  const offline = Buffer.from(fillTemplate(readFileSync(path.join(site, 'offline.html'), 'utf8'), { text, keep: ['ROOT'] }, 'site/offline.html'));
  // Workers の HTML 正規化による転送を避け、redirect:error の保存取得で読める正規 URL を使う。
  rmSync(path.join(dist, 'offline.html'), { force: true });
  mkdirSync(path.join(dist, 'offline'), { recursive: true });
  writeFileSync(path.join(dist, 'offline/index.html'), offline);
  shell.push(asset('offline/', offline, 'text/html'));
  const build = hash(JSON.stringify(shell));
  // sw.js も縮める（ページに入らないので、sw.js が変わってもページの版は変わらない）
  const result = await Bun.build({
    entrypoints: [path.join(site, 'sw.ts')], target: 'browser', minify: true,
    define: { __BUILD_CONFIG__: JSON.stringify({ build, courses, shell, mediaRoots, disabledRevisions }) },
  });
  if (!result.success) throw new Error(result.logs.join('\n'));
  writeFileSync(path.join(dist, 'sw.js'), await result.outputs[0].text());
}
