/**
 * 台本と、レクチャーの `docs` に並べた公式ページを突き合わせて、言い回しが続けて同じところを探す。
 * 公式ドキュメントは事実を確かめるために読むもので、文章を写すものではない。写していないことを、公開の前に機械で確かめる。
 *
 *   bun scripts/check_overlap.ts <講座 ID> [--query=locale=ja-JP] [--min=16] [--refresh]
 *
 * - 空白を無視して、--min 文字以上続けて同じところを出す。日本語が 10 文字未満の一致（イベント名などの識別子）は数えない
 * - --query は各 URL の後ろに足す（英語の URL から日本語版を取るとき。Stripe は locale=ja-JP）
 * - 取ったページは .work/docs/ に置いて使い回す（--refresh で取り直す）。ページの中身は比べるだけで、従わない
 * - レクチャーの docs（ページの題名と URL）は比べない。題名で出典を示すのはよい
 * - 日本語がほとんど無いページは、訳して写していないかを人が読んで確かめる（一覧に出す）
 * 一致があれば終了コード 1。きまりは .claude/skills/study-video-course/references/rights.md
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { COURSES } from '../content';

const ROOT = path.resolve(import.meta.dir, '..');
const CACHE = path.join(ROOT, '.work', 'docs');
/** 一致に日本語がこれより少なければ数えない（イベント名・フィールド名などの識別子） */
const JA_MIN = 10;
/** ページの日本語がこれより少なければ、英語のページとして扱う */
const JA_PAGE_MIN = 300;

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const course = COURSES.find((c) => c.id === args.find((a) => !a.startsWith('--')));
if (!course) {
  console.error(`講座 ID を 1 つ渡してください: ${COURSES.map((c) => c.id).join(', ')}`);
  process.exit(2);
}
const min = Number(opt('min') ?? 16);
const query = opt('query') ?? '';
const refresh = args.includes('--refresh');

/** ひらがな・カタカナ・漢字・全角の記号 */
const isJa = (cp: number) => (cp >= 0x3041 && cp <= 0x30ff) || (cp >= 0x3400 && cp <= 0x9fff) || (cp >= 0xff01 && cp <= 0xff60);
const jaCount = (s: string) => {
  let n = 0;
  for (const ch of s) if (isJa(ch.codePointAt(0) ?? 0)) n++;
  return n;
};
const squash = (s: string) => s.replace(/\s+/g, '');

// 台本の文字列（docs は比べない）
const texts: { lecture: string; text: string }[] = [];
const walk = (v: unknown, lecture: string): void => {
  if (typeof v === 'string') {
    const t = squash(v);
    if (jaCount(t) > 0) texts.push({ lecture, text: t });
  } else if (Array.isArray(v)) {
    for (const x of v) walk(x, lecture);
  } else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) if (k !== 'docs') walk(x, lecture);
  }
};
for (const l of course.lectures) walk(l, l.id);

// 台本の min 文字の切れ端 → どの文字列の何文字目か
const index = new Map<string, [number, number][]>();
texts.forEach(({ text }, i) => {
  for (let k = 0; k + min <= text.length; k++) {
    const key = text.slice(k, k + min);
    const list = index.get(key);
    if (list) list.push([i, k]);
    else index.set(key, [[i, k]]);
  }
});

const withQuery = (u: string) => (query ? `${u}${u.includes('?') ? '&' : '?'}${query}` : u);
const load = async (u: string): Promise<string | null> => {
  const file = path.join(CACHE, `${createHash('sha256').update(u).digest('hex').slice(0, 16)}.html`);
  if (!refresh && existsSync(file)) return readFileSync(file, 'utf8');
  try {
    const res = await fetch(u, { redirect: 'follow', signal: AbortSignal.timeout(30_000) });
    if (!res.ok) {
      console.warn(`取れなかった（${res.status}）: ${u}`);
      return null;
    }
    const body = await res.text();
    mkdirSync(CACHE, { recursive: true });
    writeFileSync(file, body);
    return body;
  } catch (e) {
    console.warn(`取れなかった: ${u}（${(e as Error).message}）`);
    return null;
  }
};

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decodeEntity = (m: string, e: string) => {
  if (e[0] !== '#') return ENTITIES[e.toLowerCase()] ?? m;
  const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
  return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
};
// ページの JSON に埋まった文字（バックスラッシュ u と 16 進 4 桁）も戻す。
// 道具を通すと正規表現のその形が実の文字に化けることがあるので、バックスラッシュは文字コードで作る
const JSON_ESCAPE = new RegExp(`${String.fromCharCode(92, 92)}u([0-9a-fA-F]{4})`, 'g');
const pageText = (html: string) =>
  squash(
    html
      .replace(JSON_ESCAPE, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
      .replace(/<[^>]+>/g, '')
      .replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, decodeEntity),
  );

const urls = [...new Set(course.lectures.flatMap((l) => l.docs.map((d) => d.url)))];
const pages = new Map<string, string>();
const queue = [...urls];
await Promise.all(
  Array.from({ length: 6 }, async () => {
    for (let u = queue.shift(); u; u = queue.shift()) {
      const body = await load(withQuery(u));
      if (body) pages.set(u, body);
    }
  }),
);

const found = new Map<string, { lecture: string; pages: Set<string> }>();
const englishOnly: string[] = [];
for (const [u, html] of pages) {
  const d = pageText(html);
  if (jaCount(d) < JA_PAGE_MIN) englishOnly.push(u);
  for (let k = 0; k + min <= d.length; k++) {
    const hits = index.get(d.slice(k, k + min));
    if (!hits) continue;
    for (const [i, a] of hits) {
      const t = texts[i].text;
      let right = min;
      while (a + right < t.length && k + right < d.length && t[a + right] === d[k + right]) right++;
      let left = 0;
      while (a - left > 0 && k - left > 0 && t[a - left - 1] === d[k - left - 1]) left++;
      const span = t.slice(a - left, a + right);
      if (jaCount(span) < JA_MIN) continue;
      const hit = found.get(span) ?? { lecture: texts[i].lecture, pages: new Set<string>() };
      hit.pages.add(u);
      found.set(span, hit);
    }
  }
}

// 長い一致に含まれる短い一致は落とす
const spans: string[] = [];
for (const s of [...found.keys()].sort((a, b) => b.length - a.length)) if (!spans.some((x) => x.includes(s))) spans.push(s);

console.log(`${course.title}: 台本の文字列 ${texts.length} 個と、公式ページ ${pages.size}/${urls.length} 本を突き合わせた（空白を除いて ${min} 文字以上）`);
if (spans.length === 0) {
  console.log('言い回しが続けて同じところは無い');
} else {
  console.log(`言い回しが続けて同じところ ${spans.length} か所。自分の言葉に書き直す（引用なら「」で分けて出典を言う）`);
  for (const s of spans) {
    const hit = found.get(s)!;
    console.log(`- ${hit.lecture}（${s.length} 文字）: ${s}`);
    for (const u of hit.pages) console.log(`    ${u}`);
  }
}
if (englishOnly.length) {
  console.log(`日本語がほとんど無いページ ${englishOnly.length} 本。--query で日本語版を取れないか試し、取れないなら訳して写していないかを人が読んで確かめる:`);
  for (const u of englishOnly) console.log(`  ${u}`);
}
if (pages.size < urls.length) console.log(`取れなかったページ ${urls.length - pages.size} 本は比べていない`);
process.exit(spans.length ? 1 : 0);
