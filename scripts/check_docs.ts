// 文書の点検。文書と実装の食い違いが PR を通って入らないようにする。問題があれば止まる（npm run check と CI が使う）。
//   bun scripts/check_docs.ts            # 確かめる（npm run check:docs）
//   bun scripts/check_docs.ts --strict   # 注意も止める（一覧の食い違いと使い方の抜けを片付けたら、CI をこちらにする）
//
// 見るもの
//   1. Markdown の相対リンクとアンカー（リンク先のファイルと見出しがあるか）                    止める
//   2. スキルの description の長さ（1,024 字以下。.claude/skills/*/SKILL.md）                    止める
//   3. 古い言葉（旧 Pages の頃の公開と配り方・動かした生成物の前の場所）。例外（ALLOW_OLD）のほかで見つけたら  止める
//      例外のうち、もう古い言葉が無いもの（直したのに残った行）                                  注意
//   4. テーマの表（theme.md）と content/themes.ts の THEMES                                     注意
//   5. 生成した表（README の講座の表・new-course.md の頭文字の表。npm run gen が作る）が、作り直したものと同じか  止める
//   6. 生成物の印（docs/courses の教材の頭に「生成物」のコメントがあるか）                       注意
//   7. 直接流す道具（scripts/）の頭書きに、流し方（使い方）の行があるか                           注意
// 4・6・7 は注意にしている。片付けたら --strict で止める
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { THEMES } from '../content/themes';
import { docOutputs } from './gen';

const ROOT = path.resolve(import.meta.dir, '..');

type Level = 'error' | 'warn';
export type Finding = { level: Level; check: string; where: string; what: string };

/* ───────────── Markdown ───────────── */

/** コードの囲み（``` と ~~~）の中を空行にする（行の番号は保つ）。中のリンクと見出しは見ない */
export const withoutFences = (md: string): string[] => {
  let fence: string | null = null;
  return md.split('\n').map((line) => {
    const m = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fence) {
      if (m && m[1][0] === fence[0] && m[1].length >= fence.length && !line.trim().slice(m[1].length).trim())
        fence = null;
      return '';
    }
    if (m) {
      fence = m[1];
      return '';
    }
    return line;
  });
};

/** 行の中のコード（`...`）を外す（コードの中の [文字](先) はリンクではない） */
const withoutInlineCode = (line: string) => line.replace(/(`+)(?:(?!\1)[\s\S])*?\1/g, '');

/** 頭の YAML（--- で囲む）を空行にする */
const withoutFrontMatter = (lines: string[]): string[] => {
  if (lines[0] !== '---') return lines;
  const end = lines.indexOf('---', 1);
  return end < 0 ? lines : lines.map((l, i) => (i <= end ? '' : l));
};

/** GitHub と同じ形の見出しのアンカー（小文字・記号を外す・空白を - に。同じ見出しは -1・-2 を付ける） */
export const slug = (heading: string): string =>
  heading
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, '')
    .replace(/ /g, '-');

/** その文書の中のアンカー（見出しと、<a id> / <a name>） */
export const anchorsOf = (md: string): Set<string> => {
  const seen = new Map<string, number>();
  const out = new Set<string>();
  for (const line of withoutFrontMatter(withoutFences(md))) {
    const h = line.match(/^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/);
    if (h) {
      const base = slug(h[1]);
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      out.add(n ? `${base}-${n}` : base);
    }
    for (const m of line.matchAll(/<a\s[^>]*(?:id|name)="([^"]+)"/g)) out.add(m[1]);
  }
  return out;
};

/** リンク先（[文字](先)・[名前]: 先・href="先"・src="先"）と行の番号 */
export const linksOf = (md: string): { target: string; line: number }[] => {
  const out: { target: string; line: number }[] = [];
  withoutFrontMatter(withoutFences(md)).forEach((raw, i) => {
    const line = withoutInlineCode(raw);
    for (const m of line.matchAll(/\]\(\s*(<[^>]*>|[^)\s]+)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g)) {
      out.push({ target: m[1].replace(/^<|>$/g, ''), line: i + 1 });
    }
    const def = line.match(/^\s{0,3}\[[^\]]+\]:\s*(<[^>]*>|\S+)/);
    if (def) out.push({ target: def[1].replace(/^<|>$/g, ''), line: i + 1 });
    for (const m of line.matchAll(/(?:href|src)="([^"]+)"/g)) out.push({ target: m[1], line: i + 1 });
  });
  return out;
};

const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/** 相対リンクとアンカーを確かめる。file はリポジトリの直下からのパス */
export const checkLinks = (file: string, md: string, read: (file: string) => string | null, out: Finding[]) => {
  for (const { target, line } of linksOf(md)) {
    // 外のサイト・メール・電話は見ない（https: などの名前の付いたもの）
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('//')) continue;
    const hashAt = target.indexOf('#');
    const rawPath = (hashAt >= 0 ? target.slice(0, hashAt) : target).split('?')[0];
    const anchor = hashAt >= 0 ? decode(target.slice(hashAt + 1)) : '';
    const where = `${file}:${line}`;
    const to = rawPath
      ? path.posix
          .normalize(
            rawPath.startsWith('/')
              ? decode(rawPath).slice(1)
              : path.posix.join(path.posix.dirname(file), decode(rawPath)),
          )
          .replace(/\/+$/, '')
      : file;
    if (to.startsWith('..')) {
      out.push({ level: 'error', check: 'リンク', where, what: `リポジトリの外を指している: ${target}` });
      continue;
    }
    const text = to === file ? md : read(to);
    if (text === null) {
      out.push({ level: 'error', check: 'リンク', where, what: `リンク先が無い: ${target}` });
      continue;
    }
    if (anchor && to.endsWith('.md') && !anchorsOf(text).has(anchor.toLowerCase())) {
      out.push({ level: 'error', check: 'アンカー', where, what: `見出しが無い: ${target}` });
    }
  }
};

/* ───────────── 古い言葉 ───────────── */

/** 今の形と違う、古い言葉（旧 Pages の頃の公開と配り方・動かした生成物の前の場所）。例外（ALLOW_OLD）のほかで見つけたら止める */
export const OLD_WORDS: { rx: RegExp; word: string; now: string }[] = [
  // 旧 Pages（sean-sunagaku.github.io）。w3c.github.io のような、ほかのサイトの名前は除く
  {
    rx: /sean-sunagaku\.github\.io|(?:^|[^\w.-])github\.io/,
    word: 'github.io',
    now: '公開先は https://chalkfile.com/',
  },
  // github.com/sean-sunagaku/chalkfile/ のような、リポジトリの URL の中のものは除く
  { rx: /(?<![\w.-])\/chalkfile\//, word: '/chalkfile/', now: '旧 Pages のパス。今のサイトは chalkfile.com の直下' },
  {
    rx: /GitHub Pages に(?:出す|出し|置|そのまま)/,
    word: 'GitHub Pages に出す',
    now: 'サイトは main への merge で、Actions が chalkfile.com に出す',
  },
  { rx: /gh-pages で公開/, word: 'gh-pages で公開', now: 'サイトは main から Actions と Wrangler で公開する' },
  {
    rx: /gh-pages(?: ?ブランチ)? ?に(?:だけ)?置/,
    word: 'gh-pages に置く',
    now: '動画は Releases に置く。gh-pages は旧 Pages の案内だけ',
  },
  { rx: /deploy_pages\.sh で公開/, word: 'deploy_pages.sh で公開', now: 'deploy_pages.sh は旧 Pages の移行の案内だけ' },
  { rx: /scripts\/deploy_pages\.sh/, word: 'scripts/deploy_pages.sh', now: '旧 Pages の道具は scripts/legacy/deploy_pages.sh' },
  { rx: /dist-media/, word: 'dist-media', now: '動画は Releases に置き、/media/ で配る（media.ts push）' },
  { rx: /npm install/, word: 'npm install', now: '依存は npm ci --ignore-scripts で入れる' },
  // 動かした生成物の前の場所
  {
    rx: /src\/generated\/(?:timeline|credits|lecture-credits)\.json/,
    word: 'src/generated/*.json',
    now: 'timeline は content/<講座>/generated/timeline/<key>.json。クレジットは content/voices.ts から作る',
  },
  {
    rx: /site\/media-manifest\.json/,
    word: 'site/media-manifest.json',
    now: '動画の一覧は講座ごとの content/<講座>/generated/media.<言語>.json',
  },
  // 消した道具
  {
    rx: /\brender\.sh\b/,
    word: 'render.sh',
    now: '書き出しは scripts/stages/video/render.ts（npm run render・npm run chalk -- render）',
  },
];

/**
 * 古い言葉を書いてよい場所（例外）。わざと古い言葉を書く所だけを、理由と一緒に置く。
 * - words を書いたものは、その言葉だけを許す（ほかの古い言葉は止める）。もう古い言葉が無ければ、注意を出す（消し忘れ）
 * - pending: 直す担当が決まっていて、まだ直していないコードの説明や処理。直したら、その行を消す
 */
export type OldAllow = { rx: RegExp; words?: string[]; why: string; pending?: boolean };

export const ALLOW_OLD: OldAllow[] = [
  // 記録（当時のことを、そのまま残す）
  { rx: /^docs\/history\//, why: '日付つきの記録。当時の手順と名前をそのまま残す' },
  { rx: /^docs\/adr\//, why: '決定の記録。前の形と比べて書く' },
  // 旧 Pages からの移行（凍結した移行のコードと、その確かめ）
  { rx: /^scripts\/legacy\//, why: '旧 Pages を移行の案内に置き換える道具' },
  { rx: /^site\/legacy-/, why: '旧 Pages の保存版を守る、移行用の Service Worker とその設定' },
  {
    rx: /^scripts\/build_migration\.ts$/,
    words: ['github.io', '/chalkfile/'],
    why: '旧 Pages の URL から chalkfile.com へ移す案内を作る',
  },
  { rx: /^tests\/fixtures\//, why: '旧 Pages の頃の公開物と保存の記録（互換のテストの入力）' },
  { rx: /^tests\/browser\/migration\.spec\.ts$/, words: ['/chalkfile/'], why: '旧 Pages からの移行を確かめるテスト' },
  {
    rx: /^tests\/capture-saved-records\.ts$/,
    words: ['github.io', '/chalkfile/'],
    why: '旧 Pages の保存の記録を取る（互換のテストの入力を作る）',
  },
  { rx: /^tests\/delivery\.test\.ts$/, words: ['/chalkfile/'], why: '旧 Pages のパスを新しいサイトへ移す変換のテスト' },
  {
    rx: /^tests\/offline-compat\.test\.ts$/,
    words: ['/chalkfile/'],
    why: '旧 Pages の頃の保存の名前を、今の読み込みが受け入れるかのテスト',
  },
  { rx: /^tests\/verify-production\.ts$/, words: ['github.io'], why: '公開したあとに、旧 Pages からの移行を確かめる' },
  // 動かした生成物の前の場所を、わざと読むか止めるコード
  {
    rx: /^scripts\/stills-compare\.ts$/,
    words: ['src/generated/*.json'],
    why: '基準の版が前の形（1 つの timeline）でも比べる',
  },
  { rx: /^tests\/timeline\.test\.ts$/, words: ['src/generated/*.json'], why: '前の場所の timeline を止めることのテスト' },
  { rx: /^\.gitignore$/, words: ['dist-media'], why: '前の組み立ての出力が手元に残っていても、Git に入れない' },
  // この点検そのもの
  { rx: /^scripts\/check_docs\.ts$/, why: 'この点検（古い言葉の一覧）' },
  { rx: /^tests\/check-docs\.test\.ts$/, why: 'この点検のテスト' },
  { rx: /^CHANGELOG\.md$/, words: ['render.sh'], why: '変更の記録（当時の道具の名前をそのまま残す）' },
  { rx: /^tests\/render\.test\.ts$/, words: ['render.sh'], why: '前の書き出しの道具と同じ値で書き出すかのテスト' },
  // 直す担当が決まっている、コードの古い説明と前の形の処理（直したら、この行を消す）
  { rx: /^site\/offline-shared\.ts$/, words: ['/chalkfile/'], why: 'コメントの scope の例', pending: true },
  { rx: /^site\/limits\.ts$/, words: ['render.sh'], why: 'コメントの、大きさの目安を読む道具の名前', pending: true },
  { rx: /^scripts\/build_site\.ts$/, words: ['render.sh'], why: '頭書きの、ポスターを書く道具の名前', pending: true },
  { rx: /^scripts\/site\/build\.ts$/, words: ['render.sh'], why: '動画かポスターが無いときの案内の文', pending: true },
  { rx: /^src\/Lecture\.tsx$/, words: ['render.sh'], why: 'コメントの、字幕版を作る道具の名前', pending: true },
];

/** その場所で、その古い言葉を許す例外（無ければ undefined） */
export const allowOf = (file: string, word: string): OldAllow | undefined =>
  ALLOW_OLD.find((a) => a.rx.test(file) && (!a.words || a.words.includes(word)));

/** 古い言葉を探す。例外で許したものは used に数える（例外の消し忘れを見るため） */
export const checkOldWords = (file: string, text: string, out: Finding[], used?: Map<OldAllow, number>) => {
  text.split('\n').forEach((line, i) => {
    for (const { rx, word, now } of OLD_WORDS) {
      if (!rx.test(line)) continue;
      const allow = allowOf(file, word);
      if (allow) {
        used?.set(allow, (used.get(allow) ?? 0) + 1);
        continue;
      }
      out.push({ level: 'error', check: '古い言葉', where: `${file}:${i + 1}`, what: `「${word}」（${now}）` });
    }
  });
};

/** ファイルごとの例外（words を書いたもの）のうち、もう古い言葉が無いもの。直したなら ALLOW_OLD から消す */
export const unusedAllows = (used: Map<OldAllow, number>, allows: OldAllow[] = ALLOW_OLD) =>
  allows.filter((a) => a.words && !used.has(a));

/* ───────────── 表と実装 ───────────── */

/** 見出しの下の、最初の表の行（見出しの行と区切りの行は除く） */
export const tableUnder = (md: string, heading: string): string[][] | null => {
  const lines = withoutFences(md);
  const at = lines.findIndex(
    (l) =>
      /^#{1,6}\s/.test(l) &&
      l
        .replace(/^#+\s*/, '')
        .trim()
        .startsWith(heading),
  );
  if (at < 0) return null;
  const rows: string[][] = [];
  for (const line of lines.slice(at + 1)) {
    if (/^#{1,6}\s/.test(line)) break;
    if (!line.trim().startsWith('|')) {
      if (rows.length) break;
      continue;
    }
    rows.push(
      line
        .trim()
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((c) => c.trim()),
    );
  }
  // 1 行目は見出し、2 行目は区切り（|---|）
  return rows.length >= 2 ? rows.slice(2) : null;
};

/** 表の 1 列目の名前の集まりと、実装の名前の集まりが同じか */
export const compareSets = (where: string, what: string, inDoc: string[], inCode: string[], out: Finding[]) => {
  const missing = inCode.filter((x) => !inDoc.includes(x));
  const extra = inDoc.filter((x) => !inCode.includes(x));
  if (missing.length) out.push({ level: 'warn', check: '一覧', where, what: `${what}に無い: ${missing.join('・')}` });
  if (extra.length)
    out.push({ level: 'warn', check: '一覧', where, what: `${what}にあるが実装に無い: ${extra.join('・')}` });
};

/** テーマの表（1 列目が `id`）。どこに表があるかはここで決める（テーマの表は theme.md の 1 か所だけに置く） */
const THEME_TABLES = [{ file: '.claude/skills/study-video-course/references/theme.md', heading: '今あるテーマ' }];

const checkTables = (read: (file: string) => string | null, out: Finding[]) => {
  const themes = Object.keys(THEMES);
  for (const t of THEME_TABLES) {
    const rows = tableUnder(read(t.file) ?? '', t.heading);
    if (!rows) {
      out.push({
        level: 'warn',
        check: '一覧',
        where: t.file,
        what: `テーマの表が見つからない（見出し「${t.heading}」）`,
      });
      continue;
    }
    const ids = rows.map((r) => r[0].match(/`([^`]+)`/)?.[1] ?? r[0]);
    compareSets(t.file, `テーマの表（content/themes.ts の THEMES は ${themes.length} 個）`, ids, themes, out);
  }
};

/**
 * 生成した表（README の講座の表・docs/guide/new-course.md の頭文字の表）が、npm run gen が今作るものと同じか。
 * 手で書いた表と実装の突き合わせ（上の一覧）の代わりに、作り直して比べる（ずれたら npm run gen で作り直す）
 */
export const checkGenerated = (read: (file: string) => string | null, out: Finding[], outputs: () => Map<string, string> = docOutputs) => {
  let expected: Map<string, string>;
  try {
    expected = outputs();
  } catch (e) {
    out.push({ level: 'error', check: '生成の表', where: 'README.md', what: `表を作れない: ${e instanceof Error ? e.message : String(e)}` });
    return;
  }
  for (const [file, text] of expected) {
    if (read(file) !== text) out.push({ level: 'error', check: '生成の表', where: file, what: '生成した表が、作り直したものと違う（npm run gen で作り直す。手で直さない）' });
  }
};

/* ───────────── スキル・生成物・道具 ───────────── */

/** SKILL.md の頭の YAML から description を取り出す（1 行・引用符・| と > の複数行） */
export const descriptionOf = (md: string): string | null => {
  const lines = md.split('\n');
  if (lines[0] !== '---') return null;
  const end = lines.indexOf('---', 1);
  const head = lines.slice(1, end < 0 ? undefined : end);
  const at = head.findIndex((l) => /^description:/.test(l));
  if (at < 0) return null;
  const value = head[at].replace(/^description:\s*/, '');
  const block = value.match(/^([|>])[-+]?\s*$/);
  if (!block) return value.replace(/^(["'])([\s\S]*)\1$/, '$2').trim();
  const rest: string[] = [];
  for (const l of head.slice(at + 1)) {
    if (l.trim() && !/^\s/.test(l)) break;
    rest.push(l.trim());
  }
  return rest.join(block[1] === '>' ? ' ' : '\n').trim();
};

/** description の長さの上限（Claude Code のスキル） */
export const DESCRIPTION_MAX = 1024;

export const checkSkill = (file: string, md: string, out: Finding[]) => {
  const d = descriptionOf(md);
  if (!d) {
    out.push({ level: 'error', check: 'スキル', where: file, what: '頭の YAML に description が無い' });
    return;
  }
  const n = [...d].length;
  if (n > DESCRIPTION_MAX)
    out.push({
      level: 'error',
      check: 'スキル',
      where: file,
      what: `description が ${n} 字（${DESCRIPTION_MAX} 字まで）`,
    });
};

/** 生成物の頭の印（例: <!-- 生成物: bun scripts/build_materials.ts が content/ から作る。手で直さない -->） */
export const hasGeneratedMark = (text: string) =>
  text
    .split('\n')
    .slice(0, 3)
    .some((l) => /<!--.*(生成物|generated)/i.test(l));

/** 直接流す道具か（部品として読まれるだけのものは除く） */
export const isRunnable = (file: string, text: string) =>
  file.endsWith('.sh') ||
  /__name__ == (["'])__main__\1|import\.meta\.main|process\.argv|Bun\.argv/.test(text) ||
  /^(?:await |Bun\.serve\()/m.test(text);

/** 頭書き（頭のコメント。Python は頭のコメント（PEP 723 の依存など）のあとの docstring まで）の行 */
export const headOf = (file: string, text: string): string[] => {
  const lines = text.split('\n');
  const head: string[] = [];
  let i = lines[0]?.startsWith('#!') ? 1 : 0;
  const comment = file.endsWith('.ts') ? /^\s*\/\// : /^\s*#/;
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (file.endsWith('.ts') && head.length === 0 && /^\s*\/\*/.test(l)) {
      // /** ... */ のかたまり
      for (; i < lines.length; i++) {
        head.push(lines[i]);
        if (lines[i].includes('*/')) break;
      }
      continue;
    }
    if (!comment.test(l)) break;
    head.push(l);
  }
  if (file.endsWith('.py')) {
    while (i < lines.length && !lines[i].trim()) i++;
    const quote = lines[i]?.trim().match(/^("""|''')/)?.[1];
    if (quote) {
      for (let j = i; j < lines.length; j++) {
        head.push(lines[j]);
        if ((j > i || lines[j].trim().length > 3) && lines[j].trim().endsWith(quote)) break;
      }
    }
  }
  return head;
};

/** 頭書きに、そのファイルの流し方か「使い方」の行があるか */
export const hasUsage = (file: string, text: string) => {
  const name = path.posix.basename(file).replaceAll('.', '\\.');
  const usage = new RegExp(`(?:bun|node|bash|sh|python3?|uv run|uvx|npm run)\\b[^\\n]*${name}`);
  return headOf(file, text).some((l) => usage.test(l) || /使い方/.test(l));
};

/* ───────────── 実行 ───────────── */

/** 見る対象（Git に入れる・入れる予定のファイル） */
const listFiles = () =>
  [
    ...new Set(
      execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
        cwd: ROOT,
        encoding: 'utf8',
      })
        .split('\0')
        .filter(Boolean),
    ),
  ].filter((f) => existsSync(path.join(ROOT, f)) && statSync(path.join(ROOT, f)).isFile());

/** 古い言葉を探すテキストのファイル（生成したデータ・lock は除く）。.gitignore と .gitattributes の注も見る */
const TEXT = /(?:\.(md|ts|tsx|js|mjs|json|jsonc|sh|py|ya?ml|html|css|toml|txt)|(?:^|\/)\.git(?:ignore|attributes))$/;
const SKIP_TEXT = /^(package-lock\.json|uv\.lock|content\/[^/]+\/generated\/)/;

export const checkDocs = (out: Finding[], used: Map<OldAllow, number> = new Map()) => {
  const files = listFiles();
  // あるかどうかは Git に入れるファイルで決める（手元にだけある生成物へのリンクも、CI と同じく「無い」とする）
  const known = new Set(files);
  const dirs = new Set(
    files.flatMap((f) =>
      f
        .split('/')
        .slice(0, -1)
        .map((_, i, a) => a.slice(0, i + 1).join('/')),
    ),
  );
  const read = (file: string): string | null => {
    const f = file.replace(/\/+$/, '');
    if (f === '.' || f === '' || dirs.has(f)) return '';
    return known.has(f) ? readFileSync(path.join(ROOT, f), 'utf8') : null;
  };
  for (const file of files) {
    const text = TEXT.test(file) ? readFileSync(path.join(ROOT, file), 'utf8') : null;
    if (text === null) continue;
    if (file.endsWith('.md')) checkLinks(file, text, read, out);
    if (/(^|\/)\.claude\/skills\/[^/]+\/SKILL\.md$/.test(file)) checkSkill(file, text, out);
    if (!SKIP_TEXT.test(file)) checkOldWords(file, text, out, used);
    if (/^docs\/courses\/.+\.md$/.test(file) && !hasGeneratedMark(text)) {
      out.push({
        level: 'warn',
        check: '生成物',
        where: file,
        what: '頭に「生成物」の印が無い（scripts/build_materials.ts が作る）',
      });
    }
    if (/^scripts\/(?:legacy\/)?[^/]+\.(ts|py|sh)$/.test(file) && isRunnable(file, text) && !hasUsage(file, text)) {
      out.push({ level: 'warn', check: '使い方', where: file, what: '頭書きに流し方（使い方）の行が無い' });
    }
  }
  for (const a of unusedAllows(used)) {
    out.push({
      level: 'warn',
      check: '古い言葉の例外',
      where: 'scripts/check_docs.ts',
      what: `もう古い言葉が無い例外（${a.rx.source}。${a.why}）。直したなら ALLOW_OLD から消す`,
    });
  }
  checkTables(read, out);
  checkGenerated(read, out);
};

if (import.meta.main) {
  const strict = process.argv.includes('--strict');
  const out: Finding[] = [];
  const used = new Map<OldAllow, number>();
  checkDocs(out, used);
  if (strict) for (const f of out) f.level = 'error';
  const errors = out.filter((f) => f.level === 'error');
  const warns = out.filter((f) => f.level === 'warn');
  for (const f of [...errors, ...warns])
    console.log(`${f.level === 'error' ? '止める' : '注意  '}  [${f.check}]  ${f.where}  ${f.what}`);
  const count = (list: Finding[]) => {
    const by = new Map<string, number>();
    for (const f of list) by.set(f.check, (by.get(f.check) ?? 0) + 1);
    return [...by].map(([check, n]) => `${check} ${n}`).join('・');
  };
  const allowed = (pending: boolean) =>
    [...used].filter(([a]) => !!a.pending === pending).reduce((n, [, k]) => n + k, 0);
  console.log(
    `文書の点検: 止める ${errors.length} 件${errors.length ? `（${count(errors)}）` : ''}・注意 ${warns.length} 件${warns.length ? `（${count(warns)}）` : ''}`,
  );
  console.log(
    `古い言葉の例外（ALLOW_OLD）で許したもの: わざと書く所 ${allowed(false)} 件・直す担当が決まっている所 ${allowed(true)} 件`,
  );
  process.exit(errors.length ? 1 : 0);
}
