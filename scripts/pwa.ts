// PWA の静的ファイルと、テーマの色から作る自前のアイコン。外部画像は使わない。
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Theme } from '../content/types';
import type { Asset } from '../site/offline-shared';

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

export async function bundle(file: string): Promise<string> {
  const result = await Bun.build({ entrypoints: [file], target: 'browser', minify: false });
  if (!result.success) throw new Error(result.logs.join('\n'));
  return result.outputs[0].text();
}

export async function buildPwa(site: string, dist: string, brand: Theme, courses: string[], shell: Asset[]) {
  mkdirSync(path.join(dist, 'icons'), { recursive: true });
  for (const size of [180, 192, 512]) {
    const bytes = icon(size, brand);
    const url = `icons/icon-${size}.png`;
    writeFileSync(path.join(dist, url), bytes);
    shell.push(asset(url, bytes, 'image/png'));
  }
  const manifest = JSON.stringify({
    id: './', name: 'Chalkfile', short_name: 'Chalkfile', lang: 'ja', start_url: './', scope: './', display: 'standalone',
    background_color: brand.color.bg, theme_color: brand.color.bg,
    description: '選んだ講座を保存して、教材と動画でオフライン学習',
    icons: [192, 512].map((s) => ({ src: `icons/icon-${s}.png`, sizes: `${s}x${s}`, type: 'image/png', purpose: 'any maskable' })),
  }, null, 2);
  writeFileSync(path.join(dist, 'manifest.webmanifest'), manifest);
  shell.push(asset('manifest.webmanifest', Buffer.from(manifest), 'application/manifest+json'));
  const offline = readFileSync(path.join(site, 'offline.html'));
  writeFileSync(path.join(dist, 'offline.html'), offline);
  shell.push(asset('offline.html', offline, 'text/html'));
  const build = hash(JSON.stringify(shell));
  const result = await Bun.build({
    entrypoints: [path.join(site, 'sw.ts')], target: 'browser',
    define: { __BUILD_CONFIG__: JSON.stringify({ build, courses, shell }) },
  });
  if (!result.success) throw new Error(result.logs.join('\n'));
  writeFileSync(path.join(dist, 'sw.js'), await result.outputs[0].text());
}
