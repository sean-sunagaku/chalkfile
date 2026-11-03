// Workers の静的 assets に置く、ページのほかのファイル: 応答のヘッダー（_headers）・送らないファイル（.assetsignore）。
// 言語ごとの 404 のページは scripts/site/render-not-found.ts
import { rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * _headers の 1 つの規則。path はパスの形（* は何文字でも 1 か所だけ、:name は / を含まない 1 つの区切り）。
 * detach は、先の規則が付けたヘッダーを外すもの（_headers の「! 名前」）、set は付けるヘッダー
 */
export type HeaderRule = { path: string; detach?: readonly string[]; set: Readonly<Record<string, string>> };

/**
 * 静的な応答のヘッダーの規則（Worker が返す /media/ には効かない。そちらは worker/src/media.ts が付ける）。Workers の静的 assets は、
 * パスに当たる規則を上から順に重ねる。同じヘッダーを 2 つの規則が付けると、値をカンマでつなぐので、上書きする規則は先に外す（detach）。
 * - 全部: 保存用の SHA-256 と CSP を保つため、Cloudflare による HTML や画像の書き換えと、自動の beacon の差し込みを止める（no-transform）。
 *   ほかのサイトの枠に入れさせない（frame-ancestors は meta の CSP では効かないので、ヘッダーで送る）。使わない機能を止める。
 *   別のサイトの窓と同じ閲覧の単位に入らない（COOP）。HSTS は、ゾーンの設定を確かめてから決める（ここでは送らない）
 * - Service Worker: 毎回確かめ直す（no-cache）
 * ?v= の付いたポスターは、同じパスを一覧のページ・og:image・SW の起動用ファイルが ?v= 無しで読む。規則はパスでしか当たらないので、
 * 長くキャッシュさせない（描き直したあと、一覧のページの縮小画像が古いまま残る）
 */
export const HEADER_RULES: readonly HeaderRule[] = [
  {
    path: '/*',
    set: {
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Cache-Control': 'public, max-age=0, must-revalidate, no-transform',
      'Content-Security-Policy': "frame-ancestors 'none'",
      'X-Frame-Options': 'DENY',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  { path: '/sw.js', detach: ['Cache-Control'], set: { 'Cache-Control': 'no-cache, no-transform' } },
];

/** 規則を _headers の書き方にする（規則ごとに、パスの行と、字下げした「! 名前」「名前: 値」の行） */
export const headersFile = (rules: readonly HeaderRule[]): string => {
  const lines = rules.flatMap((r) => [
    r.path,
    ...(r.detach ?? []).map((h) => `  ! ${h}`),
    ...Object.entries(r.set).map(([k, v]) => `  ${k}: ${v}`),
  ]);
  return `${lines.join('\n')}\n`;
};

/** _headers の中身 */
export const HEADERS = headersFile(HEADER_RULES);

/** _headers を規則に戻す（組み立ての最後の確かめ scripts/site-invariants.ts が、置いたファイルを読む）。読めない行があれば止める */
export const parseHeaders = (text: string): HeaderRule[] => {
  const rules: { path: string; detach: string[]; set: Record<string, string> }[] = [];
  for (const [i, line] of text.split('\n').entries()) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      rules.push({ path: line.trim(), detach: [], set: {} });
      continue;
    }
    const rule = rules.at(-1);
    const detach = /^\s+!\s*([A-Za-z0-9-]+)\s*$/.exec(line);
    const header = /^\s+([A-Za-z0-9-]+):\s*(.*?)\s*$/.exec(line);
    if (!rule || (!detach && !header)) throw new Error(`_headers の ${i + 1} 行目が読めない: ${line}`);
    if (detach) rule.detach.push(detach[1]);
    else if (header) rule.set[header[1]] = header[2];
  }
  return rules;
};

/** パスの形を正規表現にする（Workers の静的 assets と同じ読み方。* は何文字でも、:name は / の手前まで） */
const patternOf = (p: string) =>
  new RegExp(
    `^${p
      .split('*')
      .map((part) => part.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&').replace(/:[A-Za-z]\w*/g, '[^/]+'))
      .join('.*')}$`,
  );

/**
 * パス（pathname。query は見ない）に効くヘッダー。Workers の静的 assets と同じく、当たった規則ごとに、外す → 付ける。
 * 同じヘッダーを外さずに 2 回付けると、値をカンマでつなぐ（joined に名前を入れる）
 */
export const headersFor = (
  pathname: string,
  rules: readonly HeaderRule[] = HEADER_RULES,
): { headers: Map<string, string>; joined: string[] } => {
  const headers = new Map<string, string>();
  const joined = new Set<string>();
  for (const rule of rules) {
    if (!patternOf(rule.path).test(pathname)) continue;
    for (const name of rule.detach ?? []) headers.delete(name.toLowerCase());
    for (const [name, value] of Object.entries(rule.set)) {
      const key = name.toLowerCase();
      const before = headers.get(key);
      if (before !== undefined) joined.add(name);
      headers.set(key, before === undefined ? value : `${before}, ${value}`);
    }
  }
  return { headers, joined: [...joined] };
};

/** MP4 とローカルの設定（. で始まるファイル）は、静的 assets に送らない */
export const ASSETS_IGNORE = '**/*.mp4\n.*\n';

/** ヘッダーと送らないファイルを書く */
export const writeServingFiles = (dist: string) => {
  writeFileSync(path.join(dist, '.assetsignore'), ASSETS_IGNORE);
  rmSync(path.join(dist, '_redirects'), { force: true });
  writeFileSync(path.join(dist, '_headers'), HEADERS);
};
