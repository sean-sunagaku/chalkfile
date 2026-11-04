// 組み立てたサイト（site/dist）が守る決まりを、組み立ての最後に確かめる（scripts/site/build.ts の buildSite が呼び、破れていれば止める）。
// これまでは、破れていても公開して、利用者が「保存」を押したときや、新しい SW の install のときに初めて分かっていた。
//   1. Workers の静的 assets の上限（ファイルの数・1 ファイルの大きさ。site/limits.ts）に収まり、MP4 が入っていない
//   2. HTML に置き換えの印（__X__・{{x}}・版の印）が残っていない。JSON のデータ（<script type="application/json">）は JSON として読める
//   3. CSP の script-src のハッシュの数と、ページで実際に動く script の数が合い、どの script のハッシュも CSP にある。
//      動く script は、組み立てが入れた信頼できるもの（scripts に渡したもの）のどれか（エスケープし忘れて紛れ込んだ script は、CSP に入っていても止める）
//   4. 全部の offline-manifest.json が、SW と同じ validateManifest を通る。revision と、ページ・ポスターの大きさと SHA-256 が、置いたファイルと
//      合う。動画は動画の一覧（Worker の許可リスト）にあり、大きさと SHA-256 が合う。sw.js に入れた講座と、manifest のある講座が同じ
//   5. sw.js が install のときに取る起動用ファイルが置いてあり、大きさと SHA-256 が合い、型が拡張子の対応表（site/mime.ts）と合う
//   6. _headers（scripts/site/headers.ts）の規則で、どの静的な応答にも Cache-Control の no-transform が付き、同じヘッダーを付ける規則が
//      2 つ当たって値がつながっていない（Workers の静的 assets は、当たる規則のヘッダーをカンマでつなぐ）
//   7. 長くキャッシュさせるパス（immutable。?v= の付いた資源）を、ページ（属性と JSON のデータ）・保存の manifest・起動用ファイルが
//      ?v= 無しで指していない（規則はパスでしか当たらないので、?v= 無しで読むと、描き直したあとも古いまま 1 年残る）
// 使い方: import { assertSiteInvariants } from './site-invariants' で呼ぶ（手で流す入口は無い。テストは tests/unit/site-invariants.test.ts）
import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { WORKERS_ASSET_MAX_BYTES, WORKERS_MAX_ASSETS } from '../site/limits';
import { allMediaEntries, type MediaManifest, mediaPath } from '../site/media-shared';
import { mimeTypeOf } from '../site/mime';
import { type Asset, type CourseManifest, OfflineError, validateManifest } from '../site/offline-shared';
import { hash } from './pwa';
import { type HeaderRule, headersFor, parseHeaders } from './site/headers';
import { PAGE_VERSION_MARK } from './site-version';

export type SiteInvariantInput = {
  /** 組み立てたサイトのフォルダ（site/dist） */
  dist: string;
  /** アプリの場所（chalkfile.config.ts の origin。SW の scope と同じ） */
  scope: string;
  /** 動画の一覧（Worker の許可リスト）。渡すと、保存の manifest の動画が一覧にあるかも見る */
  media?: MediaManifest;
  /** sw.js が install のときに取る起動用ファイル（buildPwa に渡したもの） */
  shell?: Asset[];
  /** sw.js に入れた、保存できる講座の ID（buildPwa に渡したもの） */
  courses?: string[];
  /** ページで動いてよい script の中身（組み立てが入れる信頼できるもの。scripts/site/csp.ts）。渡すと、ほかの script があれば止める */
  scripts?: readonly string[];
  /** Workers の上限（テストで小さくする。既定は site/limits.ts） */
  maxFiles?: number;
  maxFileBytes?: number;
};

/** SW が配るときに置き換える印（sw.ts の fallback が、オフラインの案内のページの __ROOT__ をアプリの場所にする）。ほかの印は残してはいけない */
const RUNTIME_MARKS: Record<string, string[]> = { 'offline/index.html': ['__ROOT__'] };
/** 置き換えの印（template.html などの __TITLE__・{{tabQuiz}}・{{ja.offPageTitle}}、版の印 __PAGE_VERSION__） */
const MARK = /__[A-Z][A-Z0-9_]*__|\{\{\s*[A-Za-z_][\w.]*\s*\}\}/g;

const mib = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
const sha256 = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');

/** フォルダの中の全部のファイル（隠しファイルも）。rel は / で区切った、フォルダからの場所 */
const listFiles = (root: string): { rel: string; bytes: number }[] => {
  const out: { rel: string; bytes: number }[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else out.push({ rel: path.relative(root, full).split(path.sep).join('/'), bytes: lstatSync(full).size });
    }
  };
  walk(root);
  return out.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
};

/** <script> の type。HTML の決まりでは、空か JavaScript の型か module などなら動き、ほかはデータ（動かない） */
const scriptType = (attrs: string) => {
  const m = /\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
  return (m?.[1] ?? m?.[2] ?? m?.[3] ?? '').trim().toLowerCase();
};
const runs = (type: string) =>
  type === '' ||
  ['module', 'importmap', 'speculationrules'].includes(type) ||
  /^(text|application)\/(x-)?(java|ecma)script$/.test(type) ||
  /^text\/(javascript1\.[0-5]|jscript|livescript)$/.test(type);

/** HTML 1 枚の、印の残り・JSON のデータ・CSP と script の数。trusted は、動いてよい script のハッシュ（base64。無ければ見ない） */
const checkHtml = (rel: string, html: string, problems: string[], trusted?: ReadonlySet<string>) => {
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
  // 台本の中身は JSON のデータに入る（コードの場面の {{x}} などを印と取り違えない）。データの中は、JSON として読めることと版の印だけを見る
  let outside = '';
  let at = 0;
  const executable: { src: boolean; body: string }[] = [];
  for (const m of scripts) {
    const type = scriptType(m[1]!);
    if (runs(type)) {
      executable.push({ src: /\bsrc\s*=/i.test(m[1]!), body: m[2]! });
      continue;
    }
    // 中身は開きのタグ（<script + 属性 + >）のすぐ後ろから
    const start = (m.index ?? 0) + '<script'.length + m[1]!.length + 1;
    outside += html.slice(at, start);
    at = start + m[2]!.length;
    if (m[2]!.includes(PAGE_VERSION_MARK)) {
      problems.push(`${rel}: JSON のデータに版の印 ${PAGE_VERSION_MARK} が残っています`);
    }
    if (type.endsWith('json')) {
      try {
        JSON.parse(m[2]!);
      } catch {
        problems.push(
          `${rel}: <script type="${type}"> の中身が JSON として読めません（置き換えの印が残っていないか見る）`,
        );
      }
    }
  }
  outside += html.slice(at);
  const allowed = new Set(RUNTIME_MARKS[rel] ?? []);
  const marks = [...new Set([...outside.matchAll(MARK)].map((m) => m[0]))].filter((m) => !allowed.has(m));
  if (marks.length) problems.push(`${rel}: 置き換えの印が残っています: ${marks.join('・')}`);

  const policies = [...html.matchAll(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"\s*\/?>/gi)].map(
    (m) => m[1],
  );
  if (policies.length > 1) problems.push(`${rel}: CSP の meta が ${policies.length} つあります`);
  const scriptSrc = (policies[0] ?? '')
    .split(';')
    .map((d) => d.trim())
    .find((d) => /^script-src\s/.test(d));
  const hashes = [...(scriptSrc ?? '').matchAll(/'sha256-([A-Za-z0-9+/=]+)'/g)].map((m) => m[1]);
  if (hashes.length !== executable.length) {
    problems.push(
      `${rel}: CSP の script のハッシュ（${hashes.length}）と、動く script（${executable.length}）の数が合いません`,
    );
  }
  executable.forEach((s, i) => {
    if (s.src) {
      problems.push(
        `${rel}: ${i + 1} つ目の script が外のファイルを読みます（CSP のハッシュで許していないので動かない）`,
      );
    } else {
      const digest = createHash('sha256').update(s.body).digest('base64');
      if (trusted && !trusted.has(digest)) {
        problems.push(
          `${rel}: ${i + 1} つ目の script は、組み立てが入れる信頼できる script ではありません（エスケープし忘れて紛れ込んでいないか見る）`,
        );
      }
      if (!hashes.includes(digest))
        problems.push(`${rel}: ${i + 1} つ目の script のハッシュが CSP にありません（ブラウザが止める）`);
    }
  });
};

/** 組み立てたサイトの決まりの破れの一覧（空なら守れている） */
export function siteInvariantProblems(input: SiteInvariantInput): string[] {
  const { dist, scope } = input;
  const maxFiles = input.maxFiles ?? WORKERS_MAX_ASSETS;
  const maxFileBytes = input.maxFileBytes ?? WORKERS_ASSET_MAX_BYTES;
  const problems: string[] = [];
  const files = listFiles(dist);
  const known = new Set(files.map((f) => f.rel));
  const read = (rel: string) => readFileSync(path.join(dist, ...rel.split('/')));

  // 1. Workers の静的 assets の上限と、MP4
  if (files.length > maxFiles) {
    problems.push(`Workers の静的 assets のファイルの数が上限（${maxFiles}）を超えています: ${files.length}`);
  }
  for (const f of files) {
    if (f.bytes > maxFileBytes) {
      problems.push(
        `Workers の静的 assets の 1 ファイルの上限（${mib(maxFileBytes)}）を超えています: ${f.rel}（${mib(f.bytes)}）`,
      );
    }
    if (/\.mp4$/i.test(f.rel)) {
      problems.push(`公開物に MP4 があります（動画は Releases から /media/ で配る）: ${f.rel}`);
    }
  }

  // 2・3. HTML の印・JSON のデータ・CSP
  const trusted = input.scripts
    ? new Set(input.scripts.map((s) => createHash('sha256').update(s).digest('base64')))
    : undefined;
  for (const f of files) if (/\.html$/i.test(f.rel)) checkHtml(f.rel, read(f.rel).toString('utf8'), problems, trusted);

  // アプリの中の URL（scope からの場所）を、置いたファイルの場所にする。/ で終わるのはページ（index.html）
  const scopePath = new URL(scope).pathname;
  const fileOf = (url: string) => {
    const u = new URL(url, scope);
    if (u.origin !== new URL(scope).origin || !u.pathname.startsWith(scopePath)) return null;
    const rel = decodeURIComponent(u.pathname.slice(scopePath.length));
    return rel === '' || rel.endsWith('/') ? `${rel}index.html` : rel;
  };
  const sameFile = (where: string, a: Asset, rel: string) => {
    if (!known.has(rel)) {
      problems.push(`${where}: ${a.url} のファイル（${rel}）がありません`);
      return;
    }
    const data = read(rel);
    if (data.byteLength !== a.bytes || sha256(data) !== a.sha256) {
      problems.push(`${where}: ${a.url} の大きさか SHA-256 が、置いたファイルと違います`);
    }
    const type = mimeTypeOf(rel);
    if (!type) problems.push(`${where}: ${a.url} は知らない拡張子です（site/mime.ts に無い）`);
    else if (a.type !== type) {
      problems.push(`${where}: ${a.url} の型 ${a.type} が、拡張子の型 ${type} と違います（SW が取れない）`);
    }
  };

  // 4. 保存の manifest
  const allowed = input.media ? new Map(allMediaEntries(input.media).map((e) => [mediaPath(e), e])) : null;
  const manifests = files.filter((f) => /(^|\/)offline-manifest\.json$/.test(f.rel)).map((f) => f.rel);
  for (const rel of manifests) {
    const id = path.posix.dirname(rel);
    let m: CourseManifest;
    try {
      m = validateManifest(JSON.parse(read(rel).toString('utf8')), id, scope);
    } catch (e) {
      const why =
        e instanceof OfflineError
          ? `SW の validateManifest が ${e.code} で受け付けない`
          : `読めない（${e instanceof Error ? e.message : String(e)}）`;
      problems.push(`${rel}: ${why}。このままでは、この講座を保存できません`);
      continue;
    }
    if (hash(JSON.stringify(m.files)) !== m.revision) {
      problems.push(`${rel}: revision が files と合いません（SW が保存を止める）`);
    }
    for (const f of m.files) {
      const pathname = new URL(f.url, scope).pathname;
      if (pathname.startsWith('/media/')) {
        // 動画は Worker が Releases から配る（静的 assets には置かない）。許可リストに無い動画は 404 になる
        if (!allowed) continue;
        const e = allowed.get(pathname);
        if (!e)
          problems.push(
            `${rel}: ${f.url} が動画の一覧（Worker の許可リスト。content/<講座>/generated/media.<言語>.json）に無い（Worker が配らない）`,
          );
        else if (e.bytes !== f.bytes || e.sha256 !== f.sha256) {
          problems.push(`${rel}: ${f.url} の大きさか SHA-256 が、動画の一覧と違います`);
        }
        continue;
      }
      const file = fileOf(f.url);
      if (!file) problems.push(`${rel}: ${f.url} がアプリの外を指しています`);
      else sameFile(rel, f, file);
    }
  }
  for (const id of input.courses ?? []) {
    if (!manifests.includes(`${id}/offline-manifest.json`)) {
      problems.push(`sw.js に入れた講座 ${id} の offline-manifest.json がありません`);
    }
  }
  // manifest があるのに sw.js に入っていない講座は、保存できない（SW が「公開されていない」と断る）
  if (input.courses) {
    for (const rel of manifests) {
      if (!input.courses.includes(path.posix.dirname(rel))) {
        problems.push(
          `${rel}: sw.js に入っていない講座の保存の manifest です（保存できない。講座を外したなら、講座を指定せずに組み立て直す）`,
        );
      }
    }
  }

  // 5. 起動用ファイル（sw.js の install が全部を取る。1 つでも取れないと install が止まる）
  for (const a of input.shell ?? []) {
    const file = fileOf(a.url);
    if (!file) problems.push(`起動用ファイル: ${a.url} がアプリの外を指しています`);
    else sameFile('起動用ファイル', a, file);
  }

  // 6. 静的な応答のヘッダー（_headers）。送らないファイル（. で始まるもの）と _headers そのものは見ない。index.html は、フォルダの URL でも見る
  if (!known.has('_headers')) problems.push('_headers がありません（静的な応答に no-transform が付かない）');
  else {
    let rules: HeaderRule[] = [];
    try {
      rules = parseHeaders(read('_headers').toString('utf8'));
    } catch (e) {
      problems.push(e instanceof Error ? e.message : String(e));
    }
    const served = files
      .map((f) => f.rel)
      .filter((rel) => rel !== '_headers' && !rel.split('/').some((p) => p.startsWith('.')));
    const paths = served.flatMap((rel) =>
      rel === 'index.html' || rel.endsWith('/index.html')
        ? [`/${rel}`, `/${rel.slice(0, -'index.html'.length)}`]
        : [`/${rel}`],
    );
    for (const p of paths) {
      const { headers, joined } = headersFor(p, rules);
      if (joined.length) {
        problems.push(
          `_headers: ${p} に ${joined.join('・')} を付ける規則が 2 つ当たり、値がつながります（上書きする規則で、先に「! 名前」で外す）`,
        );
      }
      if (!headers.get('cache-control')?.includes('no-transform')) {
        problems.push(
          `_headers: ${p} の Cache-Control に no-transform がありません（Cloudflare が書き換えると、CSP と保存の SHA-256 が合わない）`,
        );
      }
    }

    // 7. 長くキャッシュさせるパスを、?v= 無しで指していないか
    const origin = new URL(scope).origin;
    const pinned = (where: string, url: string, base: string) => {
      let u: URL;
      try {
        u = new URL(url, base);
      } catch {
        return;
      }
      if (u.origin !== origin || u.searchParams.has('v')) return;
      if (headersFor(u.pathname, rules).headers.get('cache-control')?.includes('immutable')) {
        problems.push(
          `${where}: ${url} は長くキャッシュさせるパス（_headers の immutable）なのに ?v= がありません（描き直したあとも古いまま残る）`,
        );
      }
    };
    for (const f of files) {
      if (!/\.html$/i.test(f.rel)) continue;
      const page = new URL(f.rel.replace(/(^|\/)index\.html$/, '$1'), scope).href;
      const text = read(f.rel).toString('utf8');
      for (const m of text.matchAll(/\b(?:src|href|poster)="([^"]+)"|<meta property="og:image" content="([^"]+)"/g)) {
        pinned(f.rel, (m[1] ?? m[2])!.replace(/&amp;/g, '&'), page);
      }
      for (const m of text.matchAll(/"poster":"([^"]+)"/g)) pinned(`${f.rel} の JSON のデータ`, m[1]!, page);
    }
    for (const rel of manifests) {
      try {
        const m = JSON.parse(read(rel).toString('utf8')) as CourseManifest;
        for (const f of m.files) pinned(rel, f.url, scope);
      } catch {
        // 読めない manifest は、4. が知らせる
      }
    }
    for (const a of input.shell ?? []) pinned('起動用ファイル', a.url, scope);
  }
  return problems;
}

/** 組み立てたサイトの決まりが破れていれば、全部の一覧をエラーにして止める（scripts/site/build.ts の buildSite の最後） */
export function assertSiteInvariants(input: SiteInvariantInput): void {
  const problems = siteInvariantProblems(input);
  if (problems.length) {
    const list = problems.map((p) => `- ${p}`).join('\n');
    throw new Error(`組み立てたサイトが、公開物の決まりを守っていません（scripts/site-invariants.ts）:\n${list}`);
  }
}
