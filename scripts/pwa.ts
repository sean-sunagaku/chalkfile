// PWA の静的ファイルと、テーマの色から作る自前のアイコン。外部画像は使わない。
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Theme } from '../content/types';
import { isLang, LANG_INFO, LANGS, type Lang } from '../content/i18n';
import { LOCALES } from '../site/i18n';
import { mimeOf } from '../site/mime';
import type { Asset } from '../site/offline-shared';
import { fillTemplate } from './site/html';
import { textOf } from './site/parts';

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
/** アイコンの黒板の位置（幅と高さに対する割合）と、チョークの線の始まり */
type Board = { u0: number; u1: number; v0: number; v1: number; line: number };
/** ふつうのアイコン（purpose: any） */
const BOARD: Board = { u0: 0.18, u1: 0.82, v0: 0.25, v1: 0.75, line: 0.63 };
/**
 * 形を切り抜くアイコン（purpose: maskable）。端末が円や角の丸い四角に切り抜くので、黒板を真ん中の安全な円（直径 80%）の中に収める
 * （ふつうのアイコンの 0.75 倍。角が中心から 0.31 で、円の半径 0.4 の中）
 */
const MASKABLE: Board = { u0: 0.26, u1: 0.74, v0: 0.3125, v1: 0.6875, line: 0.5975 };
function icon(size: number, t: Theme, b: Board = BOARD): Buffer {
  const rgb = (hex: string) => [1, 3, 5].map((p) => parseInt(hex.slice(p, p + 2), 16));
  const bg = rgb(t.color.bg), board = rgb(t.color.code), chalk = rgb(t.color.accent);
  const row = size * 3 + 1;
  const pixels = Buffer.alloc(row * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const rect = u >= b.u0 && u <= b.u1 && v >= b.v0 && v <= b.v1;
    const line = rect && v >= b.line;
    const color = line ? chalk : rect ? board : bg;
    for (let c = 0; c < 3; c++) pixels[y * row + 1 + x * 3 + c] = color[c]!;
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
  return result.outputs[0]!.text();
}

export type PwaOptions = {
  /** アプリの色とアイコンの色（既定のテーマ） */
  brand: Theme;
  /** sw.js に入れる、保存できる講座の ID */
  courses: string[];
  /** SW の起動用ファイル（ここで、アイコン・manifest・オフラインの案内を足す） */
  shell: Asset[];
  /** 出す言語（言語ごとの manifest.webmanifest を作る） */
  langs: readonly Lang[];
  /** アプリの名前（chalkfile.config.ts の series） */
  series: string;
  /** 無効にした保存版の revision（site/disabled-revisions.ts。SW は、当たる保存版のページをオンラインでは開かない） */
  disabledRevisions?: readonly string[];
};

/**
 * 言語ごとの Web App Manifest（日本語は最上位、訳の言語は <言語>/manifest.webmanifest）。scope はどの言語もサイトの全部
 * （訳の一覧のページに並ぶ日本語だけの講座へも、アプリのまま移る）。id は start_url から決まるので、日本語のアプリの id は前と同じ（/）
 */
export const webManifest = (lang: Lang, o: Pick<PwaOptions, 'brand' | 'series'>) => {
  const up = '../'.repeat(LANG_INFO[lang].path.split('/').filter(Boolean).length);
  return {
    id: './', name: o.series, short_name: o.series, lang: LANG_INFO[lang].html, start_url: './', scope: up || './', display: 'standalone',
    background_color: o.brand.color.bg, theme_color: o.brand.color.bg,
    description: LOCALES[lang].app.description,
    // ふつうのアイコンと、形を切り抜くアイコンを分ける（1 つの画像に any と maskable を付けると、どちらかで端が欠けるか小さく見える）
    icons: [
      ...[192, 512].map((s) => ({ src: `${up}icons/icon-${s}.png`, sizes: `${s}x${s}`, type: 'image/png', purpose: 'any' })),
      ...[192, 512].map((s) => ({ src: `${up}icons/maskable-${s}.png`, sizes: `${s}x${s}`, type: 'image/png', purpose: 'maskable' })),
    ],
  };
};

export async function buildPwa(site: string, dist: string, o: PwaOptions) {
  const { brand, courses, shell } = o;
  const disabledRevisions = o.disabledRevisions ?? [];
  mkdirSync(path.join(dist, 'icons'), { recursive: true });
  for (const [name, size, board] of [
    ['icon', 180, BOARD], ['icon', 192, BOARD], ['icon', 512, BOARD], ['maskable', 192, MASKABLE], ['maskable', 512, MASKABLE],
  ] as const) {
    const bytes = icon(size, brand, board);
    const url = `icons/${name}-${size}.png`;
    writeFileSync(path.join(dist, url), bytes);
    shell.push(asset(url, bytes, mimeOf(url)));
  }
  for (const lang of o.langs) {
    const manifest = JSON.stringify(webManifest(lang, o), null, 2);
    const url = `${LANG_INFO[lang].path}manifest.webmanifest`;
    mkdirSync(path.dirname(path.join(dist, url)), { recursive: true });
    writeFileSync(path.join(dist, url), manifest);
    shell.push(asset(url, Buffer.from(manifest), mimeOf(url)));
  }
  // 未保存のページは 1 つで全部の言語を並べる（{{ja.key}} を site/i18n の offlinePage の文字にする。エスケープは fillTemplate）。
  // __ROOT__ は、SW が配るときにアプリの場所にする（sw.ts の fallback）
  const text = (k: string) => {
    const [lang, key] = k.split('.');
    return isLang(lang!) && key ? textOf(LOCALES[lang!].offlinePage)(key) : undefined;
  };
  const offline = Buffer.from(fillTemplate(readFileSync(path.join(site, 'offline.html'), 'utf8'), { text, keep: ['ROOT'] }, 'site/offline.html'));
  // Workers の HTML 正規化による転送を避け、redirect:error の保存取得で読める正規 URL を使う。
  rmSync(path.join(dist, 'offline.html'), { force: true });
  mkdirSync(path.join(dist, 'offline'), { recursive: true });
  writeFileSync(path.join(dist, 'offline/index.html'), offline);
  shell.push(asset('offline/', offline, 'text/html'));
  const build = hash(JSON.stringify(shell));
  // sw.js も縮める（ページに入らないので、sw.js が変わってもページの版は変わらない）。保存機能のエラーの文字は、全部の言語を入れる
  // （ページは自分の言語を SW に送る。公開をやめた言語の保存版のページも、その言語で答える）
  const messages = Object.fromEntries(LANGS.map((l) => [l, LOCALES[l].sw]));
  const result = await Bun.build({
    entrypoints: [path.join(site, 'sw.ts')], target: 'browser', minify: true,
    define: { __BUILD_CONFIG__: JSON.stringify({ build, courses, shell, disabledRevisions, messages }) },
  });
  if (!result.success) throw new Error(result.logs.join('\n'));
  writeFileSync(path.join(dist, 'sw.js'), await result.outputs[0]!.text());
}
