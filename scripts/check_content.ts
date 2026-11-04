// 公開の前に、台本と Git に入れるファイルを確かめる。問題があれば止まる（scripts/legacy/deploy_pages.sh と CI が使う）。
//   bun scripts/check_content.ts                     # 確かめる
//   bun scripts/check_content.ts --require-denylist  # ローカルの禁止語の一覧が無ければ止める（手元から公開物を出す前に使う）
//   bun scripts/check_content.ts --self-test         # 点検そのものの点検（tests/unit/check-content.test.ts を bun test で流す）
//
// 見るもの（出力の［］の中は規則の名前）
//   1. 台本（content/ の講座。訳の講座も）の全部の文字。訳の講座に残った日本語（訳し残し［untranslated］）も止める
//      - AI への指示文（プロンプトインジェクション）［injection］: 「前の指示を無視して」「ignore previous instructions」など
//      - HTML・スクリプト・javascript: のリンク［html］（サイトに出る文字。コードの場面と端末の場面は除く）
//      - 見えない文字［invisible］（ゼロ幅・向きを変える制御文字）、制御文字［control］（タブ・改行・復帰のほか）
//      - 秘密情報の形［secret］（API キー・Webhook の署名シークレット・秘密鍵など）
//      - http:// のリンク［http］・メールアドレス［email］・電話番号［phone］（注意として出す）
//   2. Git に入れる全部のファイル（追跡しているものと、追跡していないが無視もしていないもの）
//      - 中身: 見えない文字・制御文字・秘密情報の形・ローカルの禁止語［denylist］。名前の見えない文字・制御文字も
//      - 動画と音声［media］（mp4・mov・wav・flac・m4a など）。動画は Releases、声と BGM の素材は materials ブランチに置く
//      - 大きすぎるファイル［size］（5MiB を超えるもの。外すものは LARGE_OK に理由つきで書く）
//      - 認証ファイル［credential］・外を指す symlink［symlink］（どちらも中身は読まない）
//   3. clone した人の手元で勝手に動くもの
//      - 開く・入る・使うだけでコマンドが動く設定ファイル［autorun］（AUTORUN の表）。bunfig.toml の preload・plugins、
//        .vscode/settings.json のシェル・実行ファイルの場所・自動で動く tasks の許可、Git の hooks を入れる package.json の項目も
//      - npm のインストール時スクリプト［install-script］
//      - Claude Code［claude］: .claude/ に入れてよいのはスキルと launch.json だけ。スキルの頭書きに hooks・allowed-tools を書かない
//      - .claude/launch.json が起動するのは、決めたコマンドだけ［launch］（LAUNCH_COMMANDS。npm run で package.json の scripts を起こす。
//        その scripts の中身も決めたものだけにし、npm が前後に流す pre・post のスクリプトを置かない）
//      - AI への指示のファイル（CLAUDE.md・AGENTS.md）［agents］: リポジトリの直下にだけ置く。@ で読み込むのはリポジトリの中のファイルだけ
//        （Claude Code は @<パス> のファイルを開いた人の手元から読んで AI に渡す。~ や / で始まるパス・.. で外に出るパス・.git/・認証ファイルを止める）
//
// ローカルの禁止語: 1 行 1 語の一覧（# で始まる行は注釈）を置くと、全部のファイルと台本から探す。一覧は Git に入れない。
//   自分の仕事のサービス名・社内の言葉など、公開物に入ってはいけない語を書いておく。置き場所は 2 つで、両方あれば合わせて使う
//   - <Git の共通のフォルダ>/info/chalkfile-denylist（git rev-parse --git-common-dir。ふつうの clone なら .git/info/）: 同じ clone の全部の worktree が読む
//   - リポジトリの直下の .denylist.local: これまでの置き場所。その作業フォルダだけで効く
//   どちらも無いときは、手元ではっきり警告し、CI（CI=true）では注意だけにする。--require-denylist を付けると止める
//
// わざと書いた例（指示文の例を見せる講座など）は、scripts/content-allow.json に規則ごとに書いて、その規則だけを外す。
//   [{ "text": "台本の中の文字列", "rule": "injection", "why": "許す理由" }]
//   見つけた所が、台本の文字列の中の text の所に収まるときだけ外れる（同じ文字列のほかの所・ほかの規則は、そのまま見る）。
//   外せるのは injection・html・http・email・phone。見えない文字・制御文字・秘密情報の形・禁止語は外せない。
//   前の書き方（文字列だけ。含めば全部の点検を飛ばしていた）は、どの規則を外すつもりかが分からないので読み替えず、止めて書き直しを促す
// 終了コード: 0 止めるものなし・1 止めるものがある・2 使い方の誤り・3 前提が足りない（--require-denylist で禁止語の一覧が無い）
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, type Stats } from 'node:fs';
import path from 'node:path';
import { EXIT, readArgs, runMain, showHelp } from './lib/args';
import { ROOT } from './lib/paths';

type Level = 'error' | 'warn';
/** 規則の名前。出力の［］の中と、scripts/content-allow.json の rule に使う */
export type Rule =
  | 'injection' | 'html' | 'invisible' | 'control' | 'secret' | 'denylist' | 'http' | 'email' | 'phone' | 'untranslated' | 'stale'
  | 'media' | 'size' | 'credential' | 'symlink' | 'autorun' | 'install-script' | 'claude' | 'launch' | 'agents' | 'allow';
export type Finding = { level: Level; where: string; what: string; sample: string; rule: Rule };
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export const checkSecrets = (text: string, where: string, out: Finding[]) => {
  for (const [rx, what] of SECRETS) if (rx.test(text)) out.push({ level: 'error', where, what, sample: '（伏せる）', rule: 'secret' });
};

/* ───────────── 見つける形 ───────────── */

const INJECTION: [RegExp, string][] = [
  [/\b(ignore|disregard|forget|override)\b[^.\n]{0,40}\b(previous|prior|above|earlier|all|any|these|those)\b[^.\n]{0,24}\b(instructions?|prompts?|rules?|directions?|messages?)\b/i, 'AI への指示文（前の指示を無視させる）'],
  [/\b(you are now|from now on,? you|act as|pretend (to be|you are))\b[^.\n]{0,48}\b(ai|assistant|chatgpt|claude|gpt|llm|model|agent|system)\b/i, 'AI への指示文（役割を変えさせる）'],
  [/\b(system|developer|hidden)\s*(prompt|message|instructions?)\s*[:：]/i, 'AI への指示文（システムプロンプトを装う）'],
  [/<\|?\s*(im_start|im_end|system|endoftext|assistant)\s*\|?>/i, 'AI への指示文（会話の区切りを装う）'],
  [/\b(run|execute|exec)\b[^.\n]{0,32}(rm\s+-rf\s+[/~]|curl\s[^|\n]*\|\s*(ba)?sh|wget\s[^|\n]*\|\s*(ba)?sh|sudo\s)/i, 'AI への指示文（危ないコマンドを実行させる）'],
  [/(前|上|これまで|以前|先|ここまで)の(指示|命令|プロンプト|ルール|設定)を(すべて|全部)?(無視|忘れ|破棄)/, 'AI への指示文（前の指示を無視させる）'],
  [/(指示|命令|プロンプト|ルール)を(すべて|全部)?(無視|忘れ)(して|しろ|せよ|すること)/, 'AI への指示文（指示を無視させる）'],
  [/あなたは(今から|これから|今後|以降)[^。\n]{0,24}(として|になって|になりきって|になれ)/, 'AI への指示文（役割を変えさせる）'],
  [/(システム|開発者|隠し)(プロンプト|メッセージ|指示)\s*[:：]/, 'AI への指示文（システムプロンプトを装う）'],
  [/(AI|ＡＩ|エーアイ|アシスタント|モデル|エージェント|Claude|クロード)\s*(へ|に)の(指示|命令)\s*[:：]/i, 'AI への指示文（AI 宛ての命令）'],
];

const HTML: [RegExp, string][] = [
  [/<\s*\/?\s*(script|iframe|frame|object|embed|style|link|meta|base|form|input|button|img|svg|math|video|audio|source|template|a)\b/i, 'HTML のタグ'],
  [/\bon[a-z]{3,}\s*=\s*["'`]?/i, 'HTML のイベント属性（onerror= など）'],
  [/\b(javascript|vbscript)\s*:/i, 'javascript: のリンク'],
  [/\bdata\s*:\s*(text\/html|image\/svg\+xml|application\/(x-)?javascript)/i, 'data: の HTML・SVG・スクリプト'],
];

// 見えない文字。ゼロ幅・向きを変える制御文字（Trojan Source）・ワードジョイナー・BOM・ソフトハイフン
const INVISIBLE = /[\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/;
// 制御文字。タブ・改行・復帰のほかの C0（ESC も）・DEL・C1（U+0080〜U+009F。端末によっては ESC と同じに働く）
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/;

const SECRETS: [RegExp, string][] = [
  [/\b(sk|rk)_(live|test)_[0-9A-Za-z]{10,}/, 'Stripe の秘密鍵の形'],
  [/\bpk_live_[0-9A-Za-z]{10,}/, 'Stripe の本番の公開鍵の形'],
  [/\bwhsec_[0-9A-Za-z]{16,}/, 'Webhook の署名シークレットの形'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS のアクセスキーの形'],
  [/\bgh[pousr]_[0-9A-Za-z]{30,}\b/, 'GitHub のトークンの形'],
  [/\bgithub_pat_[0-9A-Za-z_]{40,}/, 'GitHub のトークンの形'],
  [/\bxox[abposr]-[0-9A-Za-z-]{10,}/, 'Slack のトークンの形'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, '秘密鍵'],
  [/\bAIza[0-9A-Za-z_-]{35}\b/, 'Google の API キーの形'],
  [/\bsk-(ant-|proj-)?[0-9A-Za-z_-]{24,}/, 'AI の API キーの形'],
  [/\b(cfk|cfut|cfat|cfoat)_[A-Za-z0-9_-]{24,}\b/, 'Cloudflare の秘密鍵・API/OAuth tokenの形'],
  [/\b(CLOUDFLARE_API_TOKEN|CF_API_TOKEN|CF_API_KEY)["']?\s*[:=]\s*["']?[A-Za-z0-9_-]{20,}/, 'Cloudflare の認証値の直書き'],
  [/https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/]{20,}/, 'Slack の Webhook URL'],
  [/\b(password|passwd|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*['"][^'"\s]{8,}['"]/i, 'パスワード・キーの直書き'],
];

const HTTP = /\bhttp:\/\/(?!localhost|127\.0\.0\.1)[^\s'"]+/;
const EMAIL = /\b[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}\b/g;
const SAFE_EMAIL_DOMAIN = /@(example\.(com|jp|org|net)|users\.noreply\.github\.com|anthropic\.com)$/i;
const PHONE = /(?<![\d-])0\d{1,4}-\d{1,4}-\d{3,4}(?![\d-])/;

/* ───────────── わざと書いた例の許可（scripts/content-allow.json） ───────────── */

/** 外せる規則。見えない文字・制御文字・秘密情報の形・禁止語は、わざと書く理由が無いので外せない（禁止語は、許可に書くと公開されてしまう） */
export const ALLOWABLE_RULES = ['injection', 'html', 'http', 'email', 'phone'] as const;
export type AllowRule = (typeof ALLOWABLE_RULES)[number];
/** 台本の文字列の中の text の所でだけ、rule の点検を外す。why は許す理由（Pull Request にも書く） */
export type AllowEntry = { text: string; rule: AllowRule; why?: string };

const ALLOW_FILE = 'scripts/content-allow.json';
const ALLOW_SHAPE = `{ "text": "台本の中の文字列", "rule": "${ALLOWABLE_RULES.join('|')}", "why": "許す理由" }`;
/** content-allow.json の中身を読む。直すところは problems に入れ、その項目は使わない（呼ぶ側が止める） */
export const parseAllow = (value: unknown): { entries: AllowEntry[]; problems: string[] } => {
  const entries: AllowEntry[] = [];
  const problems: string[] = [];
  if (!Array.isArray(value)) return { entries, problems: [`配列でない。[${ALLOW_SHAPE}, …] の形にする`] };
  value.forEach((v, i) => {
    const at = `${i + 1} 件目`;
    if (typeof v === 'string') {
      problems.push(`${at}が前の書き方（文字列だけ。含めば、その文字列の全部の点検を飛ばしていた）。外す規則を書いた ${ALLOW_SHAPE} に書き直す`);
      return;
    }
    if (!isObject(v)) {
      problems.push(`${at}が ${ALLOW_SHAPE} の形でない`);
      return;
    }
    const { text, rule, why, ...rest } = v;
    if (Object.keys(rest).length) problems.push(`${at}に知らない項目がある（${Object.keys(rest).join('・')}）。書けるのは text・rule・why`);
    else if (typeof text !== 'string' || !text.trim()) problems.push(`${at}の text が無いか空`);
    else if (!ALLOWABLE_RULES.includes(rule as AllowRule)) problems.push(`${at}の rule「${String(rule)}」は外せない（外せるのは ${ALLOWABLE_RULES.join('・')}）`);
    else if (why !== undefined && typeof why !== 'string') problems.push(`${at}の why が文字列でない`);
    else entries.push({ text, rule: rule as AllowRule, ...(why === undefined ? {} : { why }) });
  });
  return { entries, problems };
};
// 許可は最初に使うときに 1 回だけ読む（import しただけでは読まない。読めなくても import した側は止めない）
let allowRead: ReturnType<typeof parseAllow> | undefined;
const allowList = () => {
  if (allowRead) return allowRead;
  const file = path.join(ROOT, ALLOW_FILE);
  try {
    allowRead = existsSync(file) ? parseAllow(JSON.parse(readFileSync(file, 'utf8'))) : { entries: [], problems: [] };
  } catch (e) {
    allowRead = { entries: [], problems: [`JSON として読めない（${e instanceof Error ? e.message : String(e)}）`] };
  }
  return allowRead;
};
/** 実際に何かを外した許可（使っていない許可は、最後に注意として出す） */
const usedAllow = new Set<AllowEntry>();

/** text の [start, end) が、同じ規則の許可の text が出てくる所の、どれかに収まるか */
const allowedAt = (text: string, rule: Rule, start: number, end: number, allow: AllowEntry[]) =>
  allow.some((a) => {
    if (a.rule !== rule) return false;
    for (let i = text.indexOf(a.text); i >= 0 && i <= start; i = text.indexOf(a.text, i + 1)) {
      if (end <= i + a.text.length) {
        usedAllow.add(a);
        return true;
      }
    }
    return false;
  });
const globalOf = new Map<RegExp, RegExp>();
/** rx が text の中で見つかる所のうち、許可で外れない最初の所 */
const firstHit = (rx: RegExp, text: string, rule: Rule, allow: AllowEntry[]) => {
  let g = globalOf.get(rx);
  if (!g) {
    g = new RegExp(rx.source, `${rx.flags.replace('g', '')}g`);
    globalOf.set(rx, g);
  }
  for (const m of text.matchAll(g)) if (!allowedAt(text, rule, m.index, m.index + m[0].length, allow)) return m;
  return undefined;
};

/* ───────────── 調べ方 ───────────── */

/** ローカルの禁止語の一覧の置き場所。shared は全部の worktree で共有する場所（Git の外なら無い）、local はその作業フォルダだけの場所 */
export const denylistPaths = (root = ROOT) => {
  let shared: string | undefined;
  try {
    const common = execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    shared = path.join(path.resolve(root, common), 'info/chalkfile-denylist');
  } catch {
    // Git の外（tarball で取ってきたなど）。共有の場所は無い
  }
  return { shared, local: path.join(root, '.denylist.local') };
};
/** ローカルの禁止語を読む。両方の場所にあれば合わせる */
export const loadDenylist = (root = ROOT) => {
  const { shared, local } = denylistPaths(root);
  const files = [shared, local].filter((f): f is string => !!f && existsSync(f));
  return [...new Set(files.flatMap((f) => readFileSync(f, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))))];
};
// 一覧は最初に使うときに 1 回だけ読む（import しただけでは git を呼ばない）
let denylist: string[] | undefined;
const denylistTerms = () => (denylist ??= loadDenylist());

const INVISIBLE_ALL = new RegExp(INVISIBLE.source, 'g');
const CONTROL_ALL = new RegExp(CONTROL.source, 'g');
/** 名前や見つけた所を出すとき、見えない文字と制御文字は印にする（端末に色やカーソルの命令として届かないように） */
const shown = (s: string) => s.replace(INVISIBLE_ALL, '⟨見えない文字⟩').replace(CONTROL_ALL, '⟨制御文字⟩');
const short = (s: string, i = 0) => shown(s.slice(Math.max(0, i - 20), i + 40)).replace(/\s+/g, ' ');
const hex = (c: string) => `U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`;

type TextOptions = { deny?: string[]; allow?: AllowEntry[] };
/** 1 つの文字列を調べる。site=true はサイトに HTML として出る文字（HTML の点検をする）。
 *  deny はローカルの禁止語（既定は一覧のファイルから読む）、allow はわざと書いた例の許可（既定は scripts/content-allow.json） */
export const checkText = (text: string, where: string, site: boolean, out: Finding[], { deny = denylistTerms(), allow = allowList().entries }: TextOptions = {}) => {
  for (const [rx, what] of INJECTION) {
    const m = firstHit(rx, text, 'injection', allow);
    if (m) out.push({ level: 'error', where, what, sample: short(text, m.index), rule: 'injection' });
  }
  if (site) {
    for (const [rx, what] of HTML) {
      const m = firstHit(rx, text, 'html', allow);
      if (m) out.push({ level: 'error', where, what, sample: short(text, m.index), rule: 'html' });
    }
  }
  // 見えない文字・制御文字・秘密情報の形・禁止語は、許可があっても外さない
  const inv = INVISIBLE.exec(text);
  if (inv) out.push({ level: 'error', where, what: `見えない文字 ${hex(inv[0])}`, sample: short(text, inv.index), rule: 'invisible' });
  const ctl = CONTROL.exec(text);
  if (ctl) out.push({ level: 'error', where, what: `制御文字 ${hex(ctl[0])}`, sample: short(text, ctl.index), rule: 'control' });
  checkSecrets(text, where, out);
  for (const term of deny) {
    if (text.toLowerCase().includes(term.toLowerCase())) out.push({ level: 'error', where, what: 'ローカルの禁止語', sample: '（伏せる）', rule: 'denylist' });
  }
  if (site) {
    const http = firstHit(HTTP, text, 'http', allow);
    if (http) out.push({ level: 'warn', where, what: 'https でないリンク', sample: short(text, http.index), rule: 'http' });
    for (const m of text.matchAll(EMAIL)) {
      if (!SAFE_EMAIL_DOMAIN.test(m[0]) && !allowedAt(text, 'email', m.index, m.index + m[0].length, allow)) out.push({ level: 'warn', where, what: 'メールアドレス', sample: '（伏せる）', rule: 'email' });
    }
    if (firstHit(PHONE, text, 'phone', allow)) out.push({ level: 'warn', where, what: '電話番号の形', sample: '（伏せる）', rule: 'phone' });
  }
};

/** 台本の中の文字を全部たどる。コードの場面と端末の場面の中身は HTML の点検から外す（動画の中で文字として描くだけ） */
const walk = (v: unknown, where: string, site: boolean, out: Finding[], key = '') => {
  if (typeof v === 'string') return checkText(v, where, site && !['code', 'cmd', 'out'].includes(key), out);
  if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${where}[${i}]`, site, out, key));
  if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${where}.${k}`, site, out, k);
};

const checkContent = async (out: Finding[]) => {
  const { COURSES, coursesIn } = await import(path.join(ROOT, 'content/index.ts'));
  const { LANGS, TRANSLATED_LANGS, untranslated } = await import(path.join(ROOT, 'content/i18n.ts'));
  // 日本語の台本と、訳の講座（日本語の台本に訳を重ねたもの）の全部の文字
  for (const lang of LANGS) {
    for (const c of coursesIn(lang)) {
      const { lectures, ...rest } = c;
      const at = lang === 'ja' ? c.id : `${lang}/${c.id}`;
      walk(rest, at, true, out);
      for (const lec of lectures) walk(lec, `${at}/${lec.id}`, true, out);
    }
  }
  // 訳し残し（訳の講座に残った日本語の文字）は止める
  for (const lang of TRANSLATED_LANGS) for (const c of coursesIn(lang)) for (const u of untranslated(c, lang, COURSES.find((x: { id: string }) => x.id === c.id))) out.push({ level: 'error', where: u.split(':')[0], what: '訳し残し（日本語のまま）', sample: u.slice(u.indexOf(':') + 2), rule: 'untranslated' });
  // 訳したあとに日本語の台本の訳す文字が変わった訳（stale）。公開する言語（chalkfile.config.ts の publishLangs）なら止め、まだ公開しない言語は注意（scripts/i18n.ts の staleNotices）
  const { staleNotices, translationRows } = (await import(path.join(ROOT, 'scripts/i18n.ts'))) as typeof import('./i18n');
  for (const n of staleNotices(translationRows())) out.push({ level: n.level, where: n.file, what: n.message, sample: '', rule: 'stale' });
};

/* ───────────── Git に入れるファイル ───────────── */

/** 中身を文字として読まないもの（画像・書体・PDF・zip。動画と音声は MEDIA で止める） */
const BINARY = /\.(jpe?g|png|gif|webp|ico|woff2?|ttf|otf|pdf|zip)$/i;
/** main に入れない動画と音声。動画は Releases（media.ts push）、声と BGM・効果音の素材は materials ブランチ（materials.ts push）に置く */
const MEDIA = /\.(mp4|m4v|mov|webm|mkv|avi|wav|flac|m4a|mp3|aac|ogg|oga|opus|aiff?)$/i;
/** 認証ファイル。中身は読まずに止める */
const CREDENTIAL = /(^|\/)(\.env(?:\..*)?|\.dev\.vars(?:\..*)?|[^/]+\.(pem|key))$/;
const MiB = 1024 ** 2;
/** 1 ファイルの大きさの上限。Git の履歴に一度入ると、あとで消しても clone のたびに全員が取ってくる */
export const MAX_TRACKED_BYTES = 5 * MiB;
/** 5MiB の上限から外すもの（理由つき）。外したものも LARGE_OK_MAX（GitHub が警告を出す 50MiB）を超えたら止める */
const LARGE_OK: [RegExp, string][] = [
  [/^content\/[^/]+\/generated\/posters\/[^/]+\.jpg$/, 'ポスターは公開に要る正本で main に置く（CI はここから組み立てる）。大きさは書き出し（scripts/stages/video/render.config.ts の幅 1280 の JPEG）で決まる'],
  [/^tests\/fixtures\//, 'テストの入力。保存データの互換や大きさの上限を試すとき、本物と同じ形と大きさのファイルが要ることがある'],
];
const LARGE_OK_MAX = 50 * MiB;

/** clone した人の手元で、開く・入る・使うだけでコマンドが動く設定ファイル。Git に入れない（要るときは、この表を直す Pull Request で持ち主が決める） */
const AUTORUN: [RegExp, string][] = [
  [/(^|\/)\.npmrc$/, 'npm の設定（node-options・script-shell などで、npm を使うたびにコマンドが動く）'],
  [/(^|\/)\.yarnrc(\.yml)?$/, 'yarn の設定（yarnPath で、yarn を使うたびに別のコードが動く）'],
  [/(^|\/)\.pnpmfile\.[cm]?js$/, 'pnpm の hooks（入れるたびにコードが動く）'],
  [/(^|\/)\.mcp\.json$/, 'Claude Code の MCP サーバー（開いた人の手元でコマンドが動く）'],
  [/(^|\/)\.(vscode|cursor)\/mcp\.json$/, 'エディタの MCP サーバー（開いた人の手元でコマンドが動く）'],
  [/(^|\/)\.cursor\/hooks\.json$/, 'Cursor の hooks（AI が動くたびにコマンドが動く）'],
  [/(^|\/)\.vscode\/tasks\.json$/, 'VS Code の tasks（runOn: folderOpen で、フォルダを開いただけで動く）'],
  [/\.code-workspace$/, 'VS Code のワークスペース（settings と、開いただけで動く tasks を持てる）'],
  [/(^|\/)\.devcontainer(\/|\.json$)/, 'Dev Container（initializeCommand は手元で、postCreateCommand などはコンテナで動く）'],
  [/(^|\/)\.envrc$/, 'direnv（フォルダに入るたびに動く）'],
  [/(^|\/)(\.?mise(\.[\w-]+)?\.toml$|\.mise\/|\.config\/mise)/, 'mise の設定（hooks と env の source が、フォルダに入るたびに動く。道具の版は .node-version などに書く）'],
  [/(^|\/)\.husky\//, 'husky（Git の hooks）'],
  [/(^|\/)(\.?lefthook(-local)?\.(yml|yaml|json|toml)$|\.lefthook\/)/, 'lefthook（Git の hooks）'],
  [/(^|\/)\.pre-commit-config\.yaml$/, 'pre-commit（Git の hooks）'],
  [/(^|\/)\.githooks\//, 'Git の hooks のフォルダ'],
];
const CLAUDE_CONFIG = /(^|\/)\.claude\/(settings(\.local)?\.json$|hooks\/)/;
/** .claude/ に入れてよいもの（.gitignore と同じ）: スキルと launch.json だけ */
const CLAUDE_SHARED = /(^|\/)\.claude\/(skills\/|launch\.json$)/;
/** AI への指示のファイル。AI エージェントが自分から読む（Claude Code は CLAUDE.md、Codex などは AGENTS.md。CLAUDE.md は @AGENTS.md で読み込む） */
const AGENT_FILE = /(^|\/)(CLAUDE|AGENTS)\.md$/i;
/** AI への指示のファイルの @<パス>（Claude Code が読み込むファイル）のうち、開いた人の手元の、リポジトリの外か Git に入れないファイルを指すもの。
 *  行の頭か空白のあとの @ を読み込みとみなす（メールアドレスの @ は見ない）。ファイルは直下に置くので、パスは直下から読む。
 *  コードの囲みの中も見分けずに見る（Claude Code はそこを読み込まないが、見分け方の違いですり抜けさせない） */
export const agentImportsOutside = (text: string): string[] =>
  [...text.matchAll(/(?:^|\s)@(\S+)/g)]
    .map((m) => m[1])
    .filter((p) => {
      if (/^[~/\\]|^[A-Za-z]:/.test(p)) return true;
      const to = path.posix.normalize(p.replaceAll('\\', '/'));
      return to === '..' || to.startsWith('../') || to === '.git' || to.startsWith('.git/') || CREDENTIAL.test(to);
    });

/** ファイルの名前と大きさで決まるもの: 名前の見えない文字・制御文字、動画と音声、大きさ、手元で動く設定ファイル、Claude Code の設定。bytes は分からなければ省く */
export const checkPath = (f: string, bytes: number | undefined, out: Finding[]) => {
  const where = shown(f);
  const stop = (rule: Rule, what: string) => out.push({ level: 'error', where, what, sample: '', rule });
  const inv = INVISIBLE.exec(f);
  if (inv) stop('invisible', `ファイルの名前に見えない文字 ${hex(inv[0])}`);
  const ctl = CONTROL.exec(f);
  if (ctl) stop('control', `ファイルの名前に制御文字 ${hex(ctl[0])}`);
  if (MEDIA.test(f)) stop('media', '動画・音声は main に入れない（動画は media.ts push で Releases、声と BGM の素材は materials.ts push で materials ブランチ）');
  if (bytes !== undefined) {
    const large = LARGE_OK.some(([rx]) => rx.test(f));
    const max = large ? LARGE_OK_MAX : MAX_TRACKED_BYTES;
    if (bytes > max) stop('size', `大きすぎる（${bytes.toLocaleString('en-US')} バイト。上限は ${max / MiB}MiB${large ? '。5MiB の上限からは外しているが、それでも大きすぎる' : '。大きなものは Releases か materials ブランチに置く'}）`);
  }
  for (const [rx, what] of AUTORUN) if (rx.test(f)) stop('autorun', `clone した人の手元で勝手に動く: ${what}`);
  if (CLAUDE_CONFIG.test(f)) stop('claude', 'Claude Code の設定・hooks は Git に入れない（clone した人の手元でコマンドが動く）');
  else if (/(^|\/)\.claude\//.test(f) && !CLAUDE_SHARED.test(f)) stop('claude', 'Claude Code のフォルダに入れてよいのは skills/ と launch.json だけ（設定・agents・commands は、開いた人の手元で使われる）');
  if (AGENT_FILE.test(f) && f.includes('/')) stop('agents', 'AI への指示のファイル（CLAUDE.md・AGENTS.md）は、リポジトリの直下にだけ置く（下のフォルダのものは、そこで作業するときだけ AI が読むので、見落としやすい）');
};

/**
 * .claude/launch.json（Claude Code のプレビューが起動するコマンド）で起動してよいもの。どれも package.json の scripts を npm run で起こす
 * （npx は、手元に無い依存をネットから取ってくるので使わない）。script はその scripts の中身で、ほかの中身にすると止める。
 * 後ろに付けてよいのは、port が true のものの -- --port <番号> だけ（-- が無いと、npm が --port を自分の設定として読む）
 */
export const LAUNCH_COMMANDS: { argv: string[]; port: boolean; script: string }[] = [
  // 講座サイト（番号は環境変数 PORT で変える）
  { argv: ['npm', 'run', 'serve'], port: false, script: 'bun scripts/serve.ts' },
  // Remotion Studio（--config などで別のファイルを読ませない）
  { argv: ['npm', 'run', 'studio'], port: true, script: 'remotion studio' },
  // Worker を手元で（先に Worker の許可リストを作る。--remote で Cloudflare のアカウントを使わせない）
  { argv: ['npm', 'run', 'dev:worker'], port: true, script: 'bun scripts/gen.ts --media && wrangler dev' },
];
/** launch.json の 1 つの設定に書いてよい項目。env・cwd などがあると、決めた一覧の外のものが動きうる */
const LAUNCH_KEYS = ['name', 'runtimeExecutable', 'runtimeArgs', 'port', 'url'];
const LOCAL_URL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?\/?$/;
const isPortArgs = (rest: string[]) =>
  !rest.length ||
  (rest[0] === '--' && ((rest.length === 2 && /^--port=\d{1,5}$/.test(rest[1])) || (rest.length === 3 && rest[1] === '--port' && /^\d{1,5}$/.test(rest[2]))));
export const checkLaunch = (where: string, text: string, out: Finding[]) => {
  const stop = (what: string) => { out.push({ level: 'error', where, what: `.claude/launch.json: ${what}`, sample: '', rule: 'launch' }); };
  let value: unknown;
  try {
    value = Bun.JSONC.parse(text);
  } catch {
    return stop('JSON として読めない');
  }
  if (!isObject(value) || !Array.isArray(value.configurations)) return stop('configurations の配列が無い');
  // 起動に関わる項目を 1 つの設定に 2 回書くと、読む道具によって違う値が使われうる（ここは後の値、プレビューは先の値など）。
  // 項目の名前は \u の書き方でも書けて、数えるのをすり抜けられるので、それも止める
  if (text.includes('\\u')) stop('\\u の書き方を使わない（項目の名前を隠せる）');
  for (const key of ['runtimeExecutable', 'runtimeArgs']) {
    const written = text.split(`"${key}"`).length - 1;
    const read = value.configurations.filter((c: unknown) => isObject(c) && c[key] !== undefined).length;
    if (written !== read) stop(`${key} を 1 つの設定に 2 回書いている（読む道具によって、違う値が使われうる）`);
  }
  const extraTop = Object.keys(value).filter((k) => k !== 'version' && k !== 'configurations');
  if (extraTop.length) stop(`知らない項目（${shown(extraTop.join('・'))}）`);
  value.configurations.forEach((c: unknown, i: number) => {
    const at = `${i + 1} 番目の設定${isObject(c) && typeof c.name === 'string' ? `（${shown(c.name)}）` : ''}`;
    if (!isObject(c)) return stop(`${at}がオブジェクトでない`);
    const extra = Object.keys(c).filter((k) => !LAUNCH_KEYS.includes(k));
    if (extra.length) stop(`${at}に知らない項目（${shown(extra.join('・'))}）。書けるのは ${LAUNCH_KEYS.join('・')}（env・cwd などで、決めた一覧の外のものが動きうる）`);
    if (c.url !== undefined && !(typeof c.url === 'string' && LOCAL_URL.test(c.url))) stop(`${at}の url が手元（localhost）でない`);
    // url だけの設定は、もう動いているサーバーにつなぐだけで、何も起動しない
    if (c.runtimeExecutable === undefined && c.runtimeArgs === undefined) return;
    const argv = [c.runtimeExecutable, ...(Array.isArray(c.runtimeArgs) ? c.runtimeArgs : c.runtimeArgs === undefined ? [] : [c.runtimeArgs])];
    const ok = argv.every((a) => typeof a === 'string') &&
      LAUNCH_COMMANDS.some(({ argv: cmd, port }) => cmd.every((x, k) => argv[k] === x) && (port ? isPortArgs(argv.slice(cmd.length) as string[]) : argv.length === cmd.length));
    if (!ok) stop(`${at}の起動コマンドが、決めた一覧の外（${shown(argv.map(String).join(' '))}）。起動してよいのは ${LAUNCH_COMMANDS.map((x) => `${x.argv.join(' ')}${x.port ? ' [-- --port <番号>]' : ''}`).join('・')}`);
  });
};

/** .vscode/settings.json で止める項目（分かる範囲）: 端末のシェル・プロファイル・環境変数、自動で動く tasks の許可、道具の実行ファイルの場所 */
const VSCODE_RISKY: RegExp[] = [
  /^terminal\.integrated\.(profiles|defaultProfile|shell|shellArgs|automationProfile|automationShell|env|cwd)\b/,
  /^task\.allowAutomaticTasks$/,
  // 最後の段が …path(s)・…bin・tsdk・runtime・…command…・…executable…・…interpreter…・…shell…・…env・envFile のもの
  // （git.path・python.defaultInterpreterPath・eslint.nodePath・eslint.runtime・typescript.tsdk・biome.lspBin・jest.jestCommandLine など）
  /(^|\.)\w*(paths?|bin|tsdk|runtime|command\w*|executable\w*|interpreter\w*|shell\w*|env|envfile)$/i,
];
const checkVscodeSettings = (where: string, text: string, out: Finding[]) => {
  const stop = (what: string) => { out.push({ level: 'error', where, what: `clone した人の手元で勝手に動く: ${what}`, sample: '', rule: 'autorun' }); };
  let value: unknown;
  try {
    value = Bun.JSONC.parse(text);
  } catch {
    return stop('VS Code の設定が JSON として読めない');
  }
  if (!isObject(value)) return stop('VS Code の設定がオブジェクトでない');
  // 言語ごとの上書き（"[python]": {…}）の中も見る。ほかの値の中（files.exclude のパターンなど）は設定の名前ではないので見ない
  const keys = Object.entries(value).flatMap(([k, v]) => (/^\[.+\]$/.test(k) && isObject(v) ? Object.keys(v) : [k]));
  for (const k of keys) if (VSCODE_RISKY.some((rx) => rx.test(k))) stop(`VS Code の設定「${shown(k)}」（シェル・実行ファイルの場所・自動で動く tasks を決める項目）`);
};

/** bunfig.toml で止める項目: preload（bun を使うたびに先に動く。[test] の中も）と plugins。[test] root などは置いてよい */
const checkBunfig = (where: string, text: string, out: Finding[]) => {
  const stop = (what: string) => { out.push({ level: 'error', where, what: `clone した人の手元で勝手に動く: ${what}`, sample: '', rule: 'autorun' }); };
  let value: unknown;
  try {
    value = Bun.TOML.parse(text);
  } catch {
    return stop('bunfig.toml が TOML として読めない');
  }
  const visit = (v: unknown, at: string) => {
    if (Array.isArray(v)) return v.forEach((x) => visit(x, at));
    if (!isObject(v)) return;
    for (const [k, x] of Object.entries(v)) {
      const key = at ? `${at}.${k}` : k;
      if (k === 'preload' || k === 'plugins') stop(`bunfig.toml の ${shown(key)}（bun を使うたびに、書いたモジュールが先に動く）`);
      visit(x, key);
    }
  };
  visit(value, '');
};

/** npm と bun が入れるときに動かすスクリプト（dependencies は node_modules が変わるたびに動く） */
const INSTALL_SCRIPTS = ['preinstall', 'install', 'postinstall', 'preprepare', 'prepare', 'postprepare', 'prepublish', 'dependencies'];
/** 依存のインストール時スクリプトで、Git の hooks を入れる設定 */
const HOOK_INSTALLERS = ['husky', 'simple-git-hooks'];
const checkPackageJson = (where: string, text: string, out: Finding[], root: boolean) => {
  let pkg: unknown;
  try {
    pkg = JSON.parse(text);
  } catch {
    out.push({ level: 'error', where, what: 'package.json が JSON として読めない', sample: '', rule: 'install-script' });
    return;
  }
  if (!isObject(pkg)) return;
  const scripts = isObject(pkg.scripts) ? pkg.scripts : {};
  for (const k of INSTALL_SCRIPTS) {
    if (scripts[k] !== undefined) out.push({ level: 'error', where, what: `npm のインストール時スクリプト（${k}）は置かない`, sample: shown(String(scripts[k])), rule: 'install-script' });
  }
  for (const k of HOOK_INSTALLERS) {
    if (pkg[k] !== undefined) out.push({ level: 'error', where, what: `clone した人の手元で勝手に動く: Git の hooks を入れる設定（${k}）`, sample: '', rule: 'autorun' });
  }
  if (!root) return;
  // .claude/launch.json が npm run で起こす scripts は、決めた中身だけにする。npm がその前後に流す pre・post も置かない
  for (const { argv, script } of LAUNCH_COMMANDS) {
    const name = argv[2];
    if (scripts[name] !== undefined && scripts[name] !== script) out.push({ level: 'error', where, what: `.claude/launch.json が起こす npm run ${name} の中身が、決めたもの（${script}）と違う。変えるなら scripts/check_content.ts の LAUNCH_COMMANDS も直す`, sample: shown(String(scripts[name])), rule: 'launch' });
    for (const k of [`pre${name}`, `post${name}`]) {
      if (scripts[k] !== undefined) out.push({ level: 'error', where, what: `.claude/launch.json が起こす npm run ${name} の前後に、npm が流すスクリプト（${k}）は置かない`, sample: shown(String(scripts[k])), rule: 'launch' });
    }
  }
};

/** スキルの頭書き（--- で囲んだところ）で止める項目: hooks（スキルを使う間、コマンドが動く）と allowed-tools（確かめずにツールを使わせる） */
const checkSkill = (where: string, text: string, out: Finding[]) => {
  const head = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? '';
  for (const m of head.matchAll(/^["']?(hooks|allowed[-_]?tools)["']?\s*:/gim)) {
    const what = /^hooks$/i.test(m[1]) ? 'スキルを使う間、コマンドが動く' : '確かめずにツールを使わせる';
    out.push({ level: 'error', where, what: `clone した人の手元で勝手に動く: スキルの頭書きの ${m[1]}（${what}）`, sample: '', rule: 'claude' });
  }
};

/** 1 つのテキストファイルの中身: 見えない文字・制御文字・秘密情報の形・ローカルの禁止語と、手元で動く設定の中身 */
export const checkFileText = (f: string, text: string, out: Finding[], deny: string[]) => {
  const where = shown(f);
  const inv = INVISIBLE.exec(text);
  if (inv) out.push({ level: 'error', where, what: `見えない文字 ${hex(inv[0])}`, sample: short(text, inv.index), rule: 'invisible' });
  const ctl = CONTROL.exec(text);
  if (ctl) out.push({ level: 'error', where, what: `制御文字 ${hex(ctl[0])}`, sample: short(text, ctl.index), rule: 'control' });
  checkSecrets(text, where, out);
  for (const term of deny) if (text.toLowerCase().includes(term.toLowerCase())) out.push({ level: 'error', where, what: 'ローカルの禁止語', sample: '（伏せる）', rule: 'denylist' });
  if (/(^|\/)\.claude\/launch\.json$/.test(f)) checkLaunch(where, text, out);
  if (/(^|\/)\.vscode\/settings\.json$/.test(f)) checkVscodeSettings(where, text, out);
  if (/(^|\/)\.?bunfig\.toml$/.test(f)) checkBunfig(where, text, out);
  if (/(^|\/)package\.json$/.test(f)) checkPackageJson(where, text, out, f === 'package.json');
  if (/(^|\/)\.claude\/skills\/.+\/SKILL\.md$/.test(f)) checkSkill(where, text, out);
  if (AGENT_FILE.test(f)) {
    for (const p of agentImportsOutside(text)) out.push({ level: 'error', where, what: 'AI への指示のファイルが、リポジトリの外か Git に入れないファイルを @ で読み込む（開いた人の手元のファイルが AI に渡る）', sample: shown(p), rule: 'agents' });
  }
};

/** Git に入れる全部のファイル（追跡しているものと、追跡していないが無視もしていないもの）を調べる。root と deny はテストで変える */
export const checkFiles = (out: Finding[], { root = ROOT, deny }: { root?: string; deny?: string[] } = {}) => {
  const terms = deny ?? (root === ROOT ? denylistTerms() : loadDenylist(root));
  const files = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean))];
  for (const f of files) {
    if (CREDENTIAL.test(f)) {
      out.push({ level: 'error', where: shown(f), what: '認証ファイルを公開対象に入れない', sample: '（内容は読まない）', rule: 'credential' });
      continue;
    }
    const full = path.join(root, f);
    let st: Stats | undefined;
    try {
      st = lstatSync(full);
    } catch {
      // 作業フォルダで消したもの（名前だけ見る）
    }
    checkPath(f, st?.isFile() ? st.size : undefined, out);
    if (!st) continue;
    if (st.isSymbolicLink()) {
      out.push({ level: 'error', where: shown(f), what: '外部ファイルを指す symlink を公開対象に入れない', sample: '（内容は読まない）', rule: 'symlink' });
      continue;
    }
    if (!st.isFile() || BINARY.test(f) || MEDIA.test(f)) continue;
    checkFileText(f, readFileSync(full, 'utf8'), out, terms);
  }
};

/* ───────────── この点検の点検 ───────────── */

/** 見つけるべき例を見つけ、見逃すべき例を見逃すか。例と確かめ方は tests/unit/check-content.test.ts にあり、bun test で流す（CI はこの入口から呼ぶ） */
const SELF_TEST = 'tests/unit/check-content.test.ts';
const selfTest = (): number => {
  const r = Bun.spawnSync([process.execPath, 'test', path.join(ROOT, SELF_TEST)], { cwd: ROOT, stdin: 'ignore', stdout: 'inherit', stderr: 'inherit' });
  console.log(r.exitCode === 0 ? `点検の点検: ${SELF_TEST} の例が全部合った` : `点検の点検: 合わない例がある（${SELF_TEST}。上の bun test の出力を見る）`);
  return r.exitCode === 0 ? 0 : 1;
};

/* ───────────── 実行 ───────────── */

const main = async (argv: string[]) => {
  const { values } = readArgs(argv, { 'self-test': { type: 'boolean' }, 'require-denylist': { type: 'boolean' } });
  if (values.help) return showHelp(import.meta.filename);
  if (values['self-test']) return selfTest();
  // ローカルの禁止語の一覧が無いと、非公開の名前が入っても止まらない。手元でははっきり警告し、CI（一覧を置かない）では注意だけにする
  const ci = process.env.CI === 'true';
  const { shared, local } = denylistPaths();
  const places = [...(shared ? [`    ${shared}（同じ clone の全部の worktree が読む）`] : []), `    ${local}（この作業フォルダだけ）`];
  const terms = denylistTerms();
  if (!terms.length && values['require-denylist']) {
    console.error(['止める  ローカルの禁止語の一覧が無いので止めます（--require-denylist）。1 行 1 語の一覧を、次のどちらかに置いてください', ...places].join('\n'));
    return EXIT.missing;
  }
  const out: Finding[] = [];
  const allow = allowList();
  for (const p of allow.problems) out.push({ level: 'error', where: ALLOW_FILE, what: p, sample: '', rule: 'allow' });
  await checkContent(out);
  checkFiles(out);
  for (const a of allow.entries) {
    if (!usedAllow.has(a)) out.push({ level: 'warn', where: ALLOW_FILE, what: `使っていない許可（${a.rule}）。台本にもう無いなら消す`, sample: short(a.text), rule: 'allow' });
  }
  if (!terms.length) out.push({ level: 'warn', where: '（禁止語の一覧）', what: `ローカルの禁止語の一覧が無いので、禁止語は見ていない${ci ? '（CI には一覧を置かない）' : ''}`, sample: '', rule: 'denylist' });
  const errors = out.filter((f) => f.level === 'error');
  const warns = out.filter((f) => f.level === 'warn');
  for (const f of [...errors, ...warns]) console.log(`${f.level === 'error' ? '止める' : '注意  '}  ${f.where}  ${f.what}［${f.rule}］${f.sample ? `  「${f.sample}」` : ''}`);
  if (errors.some((f) => (ALLOWABLE_RULES as readonly Rule[]).includes(f.rule))) {
    console.log(`わざと書いた例なら、${ALLOW_FILE} に ${ALLOW_SHAPE} を足すと、その所でその規則だけを外せる（外せるのは ${ALLOWABLE_RULES.join('・')}。Pull Request に理由を書く）`);
  }
  console.log(`台本とファイルの点検: 止める ${errors.length} 件・注意 ${warns.length} 件${terms.length ? `（ローカルの禁止語 ${terms.length} 語も見た）` : ''}`);
  if (!terms.length && !ci) {
    const bar = '!'.repeat(72);
    console.error([bar, '警告: ローカルの禁止語の一覧がありません。非公開の名前が入っていても、この点検では止まりません。',
      '  1 行 1 語の一覧を、次のどちらかに置く（どちらも Git に入らない）', ...places,
      '  一覧が無いときに止めるには --require-denylist を付ける（手元から公開物を出す前に使う）', bar].join('\n'));
  }
  return errors.length ? 1 : 0;
};

if (import.meta.main) await runMain(main);
