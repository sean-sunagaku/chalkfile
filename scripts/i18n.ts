// 訳の状態を見る・訳したときの台本の指紋を書く・訳のひな形を作る。
//   bun scripts/i18n.ts status            # レクチャー × 言語の表（訳がある・日本語の台本が訳のあとで変わった・訳し残し）
//   bun scripts/i18n.ts stamp P01.en      # 今の日本語の台本の指紋を、訳のファイルの source に書く（訳を台本に合わせ直したあと）
//   bun scripts/i18n.ts stamp '*.en'      # その言語の全部
//   bun scripts/i18n.ts restamp           # 前の作り方（v1）の指紋で付けた訳のうち、台本が変わっていないものだけを、今の作り方で付け直す
//   bun scripts/i18n.ts scaffold S07.en   # 訳のひな形（日本語を注釈に入れた LectureL10n）を content/<講座>/en/S07.ts に作る（--stdout で表示だけ）
//   bun scripts/i18n.ts try superagent-comedy en S03   # 講座に並べる前の訳のファイルを 1 本だけ確かめる（重ね方・訳し残し・点検・長さ）
// 訳のファイルは content/<講座>/<言語>/<レクチャー ID>.ts（content/i18n.ts）。npm run i18n -- <コマンド> でも流せる。
// 訳の指紋は、日本語の台本の訳す文字（content/fields.ts の text。題・要約・クイズ・要点・出典の題・場面の文字と台詞）だけから作る。
// 色・座標・at・効果音・読み上げる文（s）・読む教材を直しても、訳は stale（訳のあとで日本語が変わった）にならない。
// stale の訳は、公開する言語（chalkfile.config.ts の publishLangs）なら止める（scripts/check_content.ts）。まだ公開しない言語は注意だけ
import { readSiteConfig } from './lib/config';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { AUTHORED_COURSES, COURSES, coursesIn, TRANSLATIONS } from '../content';
import { fieldShape, isListShape, keyFieldOf, LECTURE_FIELDS, lectureTexts, sceneShape, type Shape, walkLecture } from '../content/fields';
import { l10nProblems, localizeLecture, TRANSLATED_LANGS, untranslated, type LectureL10n, type TranslatedLang } from '../content/i18n';
import type { AuthoredLecture, Course, Lecture } from '../content/types';
import { checkText } from './check_content';
import { stampSource } from './lib/i18n-source';
import { readArgs, runMain, showHelp, UsageError, MissingError, EXIT } from './lib/args';

const ROOT = path.resolve(import.meta.dir, '..');

const sha1 = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 12);

/**
 * 訳の指紋（日本語の台本の、訳す文字だけから作る。content/fields.ts の lectureTexts）。
 * 題・要約・セクションの題・注意書き・出典の題・クイズ・要点・場面の文字（見出し・出典の表記・画面の要素の文字・台詞の t）のどれかが変わると変わる
 */
export const fingerprint = (lec: Lecture | AuthoredLecture): string => sha1(JSON.stringify(lectureTexts(lec)));

/** 前の作り方（v1）の指紋。日本語の台本の全体の JSON から作っていた（restamp が、v1 で付けた訳を見分けるのに使う。作り方は変えない） */
export const fingerprintV1 = (lec: Lecture): string => sha1(JSON.stringify(lec));

/** 訳 1 本の状態。old: stale のうち、前の作り方（v1）の指紋が今の台本と合うもの（台本は変わっていない。restamp で付け直せる） */
export type Row = { course: string; id: string; lang: TranslatedLang; state: 'ok' | 'stale' | 'none'; file: string; old?: true };
export const translationRows = (): Row[] =>
  COURSES.flatMap((course) =>
    course.lectures.flatMap((lec) =>
      TRANSLATED_LANGS.map((lang): Row => {
        const tr = TRANSLATIONS[lang][course.id]?.lectures[lec.id];
        const file = path.join('content', course.id, lang, `${lec.id}.ts`);
        const row: Row = { course: course.id, id: lec.id, lang, state: !tr ? 'none' : tr.source === fingerprint(lec) ? 'ok' : 'stale', file };
        return row.state === 'stale' && tr?.source === fingerprintV1(lec) ? { ...row, old: true } : row;
      }),
    ),
  );

/** 公開する言語（chalkfile.config.ts の publishLangs） */
export const publishLangs = (): string[] => readSiteConfig().publishLangs;

export type StaleNotice = { level: 'error' | 'warn'; file: string; message: string };
/** stale の訳の知らせ。公開する言語の訳は止める（error）。まだ公開しない言語は注意（warn）にとどめる（scripts/check_content.ts が出す） */
export const staleNotices = (rows: readonly Row[], published: readonly string[] = publishLangs()): StaleNotice[] =>
  rows
    .filter((r) => r.state === 'stale')
    .map((r) => {
      const stop = published.includes(r.lang);
      const what = r.old
        ? `訳の指紋が前の作り方のまま（日本語の台本の ${r.id} は変わっていない）。bun scripts/i18n.ts restamp で付け直す`
        : `訳のあとで日本語の台本（${r.id}）の訳す文字が変わった。訳を見直して bun scripts/i18n.ts stamp ${r.id}.${r.lang}`;
      return { level: stop ? 'error' : 'warn', file: r.file, message: `${what}${stop ? `（${r.lang} は公開する言語なので止める）` : ''}` };
    });

/** 訳のファイルの source を、今の台本の指紋にする */
const writeSource = (r: Row): string => {
  const file = path.join(ROOT, r.file);
  if (!existsSync(file)) throw new Error(`訳のファイルが無い: ${r.file}`);
  const lec = COURSES.find((c) => c.id === r.course)?.lectures.find((l) => l.id === r.id);
  if (!lec) throw new Error(`日本語の台本が無い: ${r.course}/${r.id}`);
  const src = readFileSync(file, 'utf8');
  const hash = fingerprint(lec);
  let next: string;
  try {
    next = stampSource(src, r.id, hash);
  } catch (error) {
    throw new Error(`${r.file}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (next !== src) writeFileSync(file, next);
  return hash;
};

/* ───────────── 訳のひな形 ───────────── */

const quote = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
/** 注釈に入れる日本語（改行は「 / 」にして 1 行にする） */
const note = (s: string) => s.replace(/\s*\n\s*/g, ' / ');
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const LANG_NAME: Record<TranslatedLang, string> = { en: '英語', zh: '中国語（簡体字）' };

/** 値の中に、訳す文字があるか */
const hasText = (v: unknown, shape: Shape | undefined): boolean => {
  if (v === undefined) return false;
  if (shape === 'text') return true;
  if (typeof shape === 'string' || shape === undefined) return false;
  if (Array.isArray(v)) return v.some((x) => hasText(x, isListShape(shape) ? shape.$list : undefined));
  return isObj(v) && Object.entries(v).some(([k, x]) => hasText(x, fieldShape(shape, v, k)));
};

/** 訳のひな形の 1 項目（オブジェクト）の中身の行。訳す文字は '' にして、日本語を注釈に入れる。key は書く（訳でも key で重なる） */
const scaffoldObject = (v: Record<string, unknown>, shape: Shape | undefined, pad: string, keyed: string | undefined): string[] => {
  const out: string[] = [];
  for (const [k, x] of Object.entries(v)) {
    const s = fieldShape(shape, v, k);
    if (x === undefined) continue;
    if (k === keyed) out.push(`${pad}${k}: ${quote(String(x))},`);
    else if (s === 'text' && typeof x === 'string') out.push(`${pad}${k}: '',${x ? ` // ${note(x)}` : ''}`);
    else if (s === 'text' && Array.isArray(x)) out.push(`${pad}${k}: [${x.map(() => "''").join(', ')}], // ${x.map((y) => note(String(y))).join(' / ')}`);
    else if (isListShape(s) && Array.isArray(x)) out.push(...scaffoldList(k, x, s, pad));
    else if (isObj(x) && typeof s !== 'string' && hasText(x, s)) out.push(`${pad}${k}: {`, ...scaffoldObject(x, s, `${pad}  `, undefined), `${pad}},`);
  }
  return out;
};

/** 配列。台詞は 1 つずつ（id・声・間・効果音は日本語のまま書き、文を ''）。key を全部の項目が持つ配列は、key を書いて key で重ねる */
const scaffoldList = (k: string, xs: unknown[], s: Shape, pad: string): string[] => {
  if (!isListShape(s)) return [];
  if (s.$replace && s.$list === 'text') return [`${pad}${k}: [`, ...xs.map((x) => `${pad}  '', // ${note(String(x))}`), `${pad}],`];
  if (k === 'lines')
    return [
      `${pad}${k}: [`,
      ...xs.map((x) => {
        const l = x as Record<string, unknown>;
        const keep = (['id', 'v', 'pause', 'sfx', 'sfxAfter', 'bgm'] as const).filter((f) => l[f] !== undefined).map((f) => `${f}: ${typeof l[f] === 'string' ? quote(l[f] as string) : String(l[f])}`);
        const fields = [...(l.id !== undefined ? [keep.shift() as string] : []), "t: ''", ...keep];
        return `${pad}  { ${fields.join(', ')} }, // ${l.v ? `[${String(l.v)}] ` : ''}${note(String(l.t))}`;
      }),
      `${pad}],`,
    ];
  if (!xs.some((x) => hasText(x, s.$list))) return [];
  const key = keyFieldOf(s.$list);
  const keyed = key && xs.every((x) => isObj(x) && x[key] !== undefined) ? key : undefined;
  return [
    `${pad}${k}: [`,
    ...xs.flatMap((x) => {
      if (!isObj(x)) return [`${pad}  '',`];
      const inner = scaffoldObject(x, s.$list, `${pad}    `, keyed);
      // 項目が 1 つだけなら 1 行にする（{ text: '' }, // 日本語）
      const one = inner.length === 1 ? /^\s*(.*?),(?: \/\/ (.*))?$/.exec(inner[0]!) : null;
      if (one) return [`${pad}  { ${one[1]} },${one[2] ? ` // ${one[2]}` : ''}`];
      return inner.length ? [`${pad}  {`, ...inner, `${pad}  },`] : [`${pad}  {},`];
    }),
    `${pad}],`,
  ];
};

/**
 * 訳のひな形（content/<講座>/<言語>/<ID>.ts の中身）。日本語の台本と同じ場面・同じ項目で、訳す文字を '' にし、日本語を注釈に入れる。
 * key を持つ配列（cards・nodes・actors・timeline の items・id のある部品）は key を書くので、日本語の項目を並べ替えても、訳の文字は同じ項目に付く。
 * 台詞は日本語と同じ数で、id・声・間・効果音を写す（台詞の id で書いた at は、そのまま訳の台詞に付く）
 */
export const scaffold = (lec: AuthoredLecture, lang: TranslatedLang, source: string): string => {
  const head = [
    "import type { LectureL10n } from '../../i18n';",
    '',
    `// ${lec.id} の${LANG_NAME[lang]}の訳のひな形（bun scripts/i18n.ts scaffold ${lec.id}.${lang} が作った）。// の注釈は日本語の台本の文字。`,
    "// '' に訳を書き、注釈は消してよい。画面に出さない文字は '' のままにする。色・アイコン・座標・URL は日本語の台本のものを使うので書かない。",
    '// 台詞（lines）は言語ごとに作り直してよい。数を変えた場面は、要素の at も書く（日本語の台本が台詞の id で at を書いた要素は、訳の台詞に同じ id を付けるだけでよい）。',
    `// 書いたら: bun scripts/i18n.ts try <講座 ID> ${lang} ${lec.id} → ${lang}/course.ts の lectures に足す（source は、ひな形を作ったときの日本語の台本の指紋）`,
    `export const ${lec.id}: LectureL10n = {`,
    `  source: '${source}',`,
  ];
  const body: string[] = [];
  for (const [k, x] of Object.entries(lec)) {
    const s = fieldShape(LECTURE_FIELDS, lec, k);
    if (k === 'scenes') {
      body.push('  scenes: [');
      for (const [i, scene] of lec.scenes.entries()) {
        body.push(`    // 場面 ${i + 1}`, '    {', `      kind: '${scene.kind}',`, ...scaffoldObject(scene as Record<string, unknown>, sceneShape(scene.kind), '      ', undefined), '    },');
      }
      body.push('  ],');
    } else if (k === 'section' || k === 'id' || k === 'no') continue;
    else if (s === 'text' && typeof x === 'string') body.push(`  ${k}: '', // ${note(x)}`);
    else if (isListShape(s) && Array.isArray(x)) body.push(...scaffoldList(k, x, s, '  '));
  }
  return `${[...head, ...body, '};'].join('\n')}\n`;
};

/* ───────────── 実行 ───────────── */

async function main(argv: string[]) {
  const { values, positionals } = readArgs(argv, { stdout: { type: 'boolean' } }, { positionals: true });
  if (values.help) return showHelp(import.meta.filename);
  const [cmd, ...args] = positionals;
  if (!cmd || !['status', 'stamp', 'restamp', 'scaffold', 'try'].includes(cmd)) throw new UsageError('status | stamp | restamp | scaffold | try を指定する（使い方は --help）');
  if (values.stdout && cmd !== 'scaffold') throw new UsageError('--stdout は scaffold だけで使う');
  if ((cmd === 'status' || cmd === 'restamp') && args.length) throw new UsageError(`${cmd} は引数を取らない`);
  if (cmd === 'stamp' && (!args.length || args.some((arg) => !/^(?:[A-Z]\d{2}\.(?:en|zh|\*)|\*\.(?:en|zh))$/.test(arg)))) throw new UsageError("指紋を書く訳を指定する（例: P01.en、P01.*、'*.zh'）");
  if (cmd === 'scaffold' && (args.length !== 1 || !/^[A-Z]\d{2}\.(en|zh)$/.test(args[0] ?? ''))) throw new UsageError('scaffold <レクチャー ID>.<en|zh> [--stdout] を指定する');
  if (cmd === 'try' && (args.length !== 3 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(args[0] ?? '') || !TRANSLATED_LANGS.includes(args[1] as TranslatedLang) || !/^[A-Z]\d{2}$/.test(args[2] ?? ''))) throw new UsageError('try <講座 ID> <en|zh> <レクチャー ID> を指定する');
  const rows = translationRows();
  if (cmd === 'status' || !cmd) {
    for (const course of COURSES) {
      const mine = rows.filter((r) => r.course === course.id);
      if (!mine.some((r) => r.state !== 'none')) continue;
      console.log(`${course.id}`);
      for (const lec of course.lectures) {
        const cells = TRANSLATED_LANGS.map((lang) => {
          const r = mine.find((x) => x.id === lec.id && x.lang === lang);
          const state = !r || r.state === 'none' ? '未訳' : r.state === 'ok' ? '訳あり' : r.old ? '指紋が前の作り方（restamp で付け直す）' : '台本が変わった（訳を見直して stamp）';
          return `${lang}: ${state}`;
        });
        console.log(`  ${lec.id}  ${cells.join('　')}`);
      }
    }
    let left = 0;
    for (const lang of TRANSLATED_LANGS)
      for (const c of coursesIn(lang))
        for (const u of untranslated(c, lang, AUTHORED_COURSES.find((x) => x.id === c.id))) {
          left++;
          console.log(`訳し残し  ${u}`);
        }
    const stale = rows.filter((r) => r.state === 'stale');
    const published = publishLangs();
    const stops = stale.filter((r) => published.includes(r.lang)).length;
    console.log(`訳: ${rows.filter((r) => r.state !== 'none').length} 本（台本が変わった ${stale.length} 本〔うち公開する言語 ${stops} 本〕・訳し残し ${left} か所）`);
    return left || stops ? EXIT.failed : EXIT.ok;
  } else if (cmd === 'stamp') {
    const matches = (r: Row, a: string) => a === `${r.id}.${r.lang}` || a === `${r.id}.*` || a === `*.${r.lang}`;
    const available = rows.filter((r) => r.state !== 'none');
    const missing = args.filter((a) => !available.some((r) => matches(r, a)));
    if (missing.length) throw new MissingError(`訳が無い: ${missing.join(' ')}（例: P01.en、'*.zh'）`);
    const picked = available.filter((r) => args.some((a) => matches(r, a)));
    for (const r of picked) console.log(`${r.file}: source を ${writeSource(r)} にした`);
  } else if (cmd === 'restamp') {
    // 指紋の作り方を変えたとき（v1 → 今）に、確かめ済みの訳だけを付け直す。v1 でも stale だった訳は stale のまま残す（誰も確かめていない訳を、確かめた扱いにしない）
    const old = rows.filter((r) => r.state === 'stale' && r.old);
    for (const r of old) console.log(`${r.file}: source を ${writeSource(r)} にした（前の作り方の指紋が、今の台本と合っていた）`);
    const left = rows.filter((r) => r.state === 'stale' && !r.old);
    console.log(`付け直した ${old.length} 本。stale のまま残した ${left.length} 本${left.length ? `: ${left.map((r) => `${r.id}.${r.lang}`).join(' ')}` : ''}`);
  } else if (cmd === 'scaffold') {
    const [target, ...rest] = args;
    const m = /^([A-Z]\d{2})\.(en|zh)$/.exec(target ?? '');
    if (!m || rest.length) throw new UsageError('scaffold <レクチャー ID>.<en|zh> [--stdout] を指定する（例: S07.en）');
    const [, id, lang] = m as unknown as [string, string, TranslatedLang];
    const course = AUTHORED_COURSES.find((c) => c.lectures.some((l) => l.id === id));
    const lec = course?.lectures.find((l) => l.id === id);
    if (!course || !lec) throw new UsageError(`日本語の台本が無い: ${id}`);
    const text = scaffold(lec, lang, fingerprint(lec));
    if (values.stdout) process.stdout.write(text);
    else {
      const file = path.join('content', course.id, lang, `${id}.ts`);
      if (existsSync(path.join(ROOT, file))) throw new Error(`${file} はもうある（上書きしない。表示だけなら --stdout）`);
      mkdirSync(path.dirname(path.join(ROOT, file)), { recursive: true });
      writeFileSync(path.join(ROOT, file), text);
      console.log(`${file} を作った。訳を書いたら bun scripts/i18n.ts try ${course.id} ${lang} ${id}、そのあと ${lang}/course.ts の lectures に足す`);
    }
  } else if (cmd === 'try') {
    // 講座の訳（course.ts）に並べる前の、レクチャーの訳を 1 本だけ確かめる（章ごとに並行して訳すとき）
    const [courseId, lang, id] = args as [string, TranslatedLang, string];
    // 訳は、at の id を番号に直す前の日本語の台本に重ねる（content/index.ts の coursesIn と同じ）
    const course = AUTHORED_COURSES.find((c) => c.id === courseId);
    const base = course?.lectures.find((l) => l.id === id);
    if (!course || !base || !TRANSLATED_LANGS.includes(lang)) throw new UsageError('try <講座 ID> <en|zh> <レクチャー ID> を指定する');
    const mod = (await import(path.join(ROOT, 'content', courseId, lang, `${id}.ts`))) as Record<string, LectureL10n>;
    const tr = mod[id];
    if (!tr) throw new Error(`content/${courseId}/${lang}/${id}.ts が ${id} を export していない`);
    // セクションの名前は講座の訳で決まるので、ここでは仮の名前にする
    const shell: Course = { ...course, sections: course.sections.map((x) => ({ ...x, title: `section ${x.no}` })), lectures: [] };
    const lec = localizeLecture(base, tr, shell);
    const merged = l10nProblems(lec).map((p) => `${p.where}  ${p.message}`);
    // 講座の UI は、このレクチャー単体の検査から省く。
    const { ui: _ui, ...withoutUi } = shell;
    const problems = untranslated({ ...withoutUi, lectures: [lec], title: 'x', subtitle: 'x', headline: 'x', docsNote: 'x', sourceNote: 'x', disclaimer: 'x', cast: undefined, sources: undefined, links: undefined }, lang, { ...course, lectures: [base] });
    const findings: { level: string; where: string; what: string; sample: string }[] = [];
    const walk = (v: unknown, where: string, key = '') => {
      if (typeof v === 'string') return checkText(v, where, !['code', 'cmd', 'out'].includes(key), findings as never);
      if (Array.isArray(v)) {
        v.forEach((x, i) => {
          walk(x, `${where}[${i}]`, key);
        });
        return;
      }
      if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${where}.${k}`, k);
    };
    walk(lec, `${id}.${lang}`);
    // 訳していない文字（ひな形の '' のまま）。画面に出さないためにわざと '' にした文字（お笑い版のオープニングの札など）もあるので、注意にとどめる
    const empty: string[] = [];
    walkLecture(lec, base, `${id}.${lang}`, (role, v, ja, where) => {
      if (role === 'text' && v === '' && typeof ja === 'string' && ja.trim()) empty.push(`${where}（日本語: ${note(ja).slice(0, 40)}）`);
    });
    // 長さの目安: 字幕は 2 行まで、見出しは 1 行
    const maxLine = lang === 'en' ? 150 : 60;
    const maxHeading = lang === 'en' ? 44 : 24;
    const long: string[] = [];
    lec.scenes.forEach((sc, i) => {
      if (sc.heading && sc.heading.length > maxHeading) long.push(`場面 ${i + 1} の見出しが長い（${sc.heading.length} 字 > ${maxHeading}）: ${sc.heading}`);
      sc.lines.forEach((ln, k) => { if (ln.t.length > maxLine) long.push(`場面 ${i + 1} 台詞 ${k + 1} が長い（${ln.t.length} 字 > ${maxLine}。字幕が 3 行になる）: ${ln.t}`); });
    });
    console.log(`${id}.${lang}: 場面 ${lec.scenes.length}（台詞 ${lec.scenes.reduce((n, x) => n + x.lines.length, 0)}・日本語 ${base.scenes.reduce((n, x) => n + x.lines.length, 0)}）`);
    for (const p of merged) console.log(`重ね方  ${p}`);
    for (const p of problems) console.log(`訳し残し  ${p}`);
    for (const f of findings) console.log(`${f.level === 'error' ? '止める' : '注意'}  ${f.where}  ${f.what}  ${f.sample}`);
    for (const e of empty) console.log(`空の文字  ${e}`);
    for (const l of long) console.log(`長さ  ${l}`);
    const bad = merged.length + problems.length + findings.filter((f) => f.level === 'error').length;
    console.log(bad ? `直すところ ${bad} か所` : `重ね方・訳し残し・点検は通った（空の文字 ${empty.length}・長さの注意 ${long.length}）`);
    return bad ? EXIT.failed : EXIT.ok;
  }
  return EXIT.ok;
}
if (import.meta.main) await runMain(main);
