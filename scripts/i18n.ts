// 訳の状態を見る・訳したときの台本の指紋を書く。
//   bun scripts/i18n.ts status            # レクチャー × 言語の表（訳がある・日本語の台本が訳のあとで変わった・訳し残し）
//   bun scripts/i18n.ts stamp P01.en      # 今の日本語の台本の指紋を、訳のファイルの source に書く（訳を台本に合わせ直したあと）
//   bun scripts/i18n.ts stamp '*.en'      # その言語の全部
//   bun scripts/i18n.ts try superagent-comedy en S03   # 講座に並べる前の訳のファイルを 1 本だけ確かめる（重ね方・訳し残し・点検・長さ）
// 訳のファイルは content/<講座>/<言語>/<レクチャー ID>.ts（content/i18n.ts）
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { AUTHORED_COURSES, COURSES, coursesIn, TRANSLATIONS } from '../content';
import { localizeLecture, TRANSLATED_LANGS, untranslated, type LectureL10n, type TranslatedLang } from '../content/i18n';
import type { Course, Lecture } from '../content/types';
import { checkText } from './check_content';

const ROOT = path.resolve(import.meta.dir, '..');

/** 日本語の台本の指紋（台詞・画面・クイズ・出典のどれかが変わると変わる） */
export const fingerprint = (lec: Lecture): string => createHash('sha1').update(JSON.stringify(lec)).digest('hex').slice(0, 12);

type Row = { course: string; id: string; lang: TranslatedLang; state: 'ok' | 'stale' | 'none'; file: string };
export const translationRows = (): Row[] =>
  COURSES.flatMap((course) =>
    course.lectures.flatMap((lec) =>
      TRANSLATED_LANGS.map((lang): Row => {
        const tr = TRANSLATIONS[lang][course.id]?.lectures[lec.id];
        const file = path.join('content', course.id, lang, `${lec.id}.ts`);
        return { course: course.id, id: lec.id, lang, state: !tr ? 'none' : tr.source === fingerprint(lec) ? 'ok' : 'stale', file };
      }),
    ),
  );

if (import.meta.main) {
  const [cmd, ...args] = process.argv.slice(2);
  const rows = translationRows();
  if (cmd === 'status' || !cmd) {
    for (const course of COURSES) {
      const mine = rows.filter((r) => r.course === course.id);
      if (!mine.some((r) => r.state !== 'none')) continue;
      console.log(`${course.id}`);
      for (const lec of course.lectures) {
        const cells = TRANSLATED_LANGS.map((lang) => {
          const r = mine.find((x) => x.id === lec.id && x.lang === lang)!;
          return `${lang}: ${r.state === 'ok' ? '訳あり' : r.state === 'stale' ? '台本が変わった（訳を見直して stamp）' : '未訳'}`;
        });
        console.log(`  ${lec.id}  ${cells.join('　')}`);
      }
    }
    let left = 0;
    for (const lang of TRANSLATED_LANGS) for (const c of coursesIn(lang)) for (const u of untranslated(c, lang, COURSES.find((x) => x.id === c.id))) {
      left++;
      console.log(`訳し残し  ${u}`);
    }
    const stale = rows.filter((r) => r.state === 'stale').length;
    console.log(`訳: ${rows.filter((r) => r.state !== 'none').length} 本（台本が変わった ${stale} 本・訳し残し ${left} か所）`);
    process.exit(left ? 1 : 0);
  } else if (cmd === 'stamp') {
    const want = (r: Row) => args.some((a) => a === `${r.id}.${r.lang}` || a === `${r.id}.*` || a === `*.${r.lang}`);
    const picked = rows.filter((r) => r.state !== 'none' && want(r));
    if (!picked.length) throw new Error(`訳が無い: ${args.join(' ')}（例: P01.en、'*.zh'）`);
    for (const r of picked) {
      const file = path.join(ROOT, r.file);
      if (!existsSync(file)) throw new Error(`訳のファイルが無い: ${r.file}`);
      const lec = COURSES.find((c) => c.id === r.course)!.lectures.find((l) => l.id === r.id)!;
      const src = readFileSync(file, 'utf8');
      const next = src.replace(/source: '[0-9a-f]*'/, `source: '${fingerprint(lec)}'`);
      if (next === src && r.state !== 'ok') throw new Error(`${r.file}: source: '…' が見つからない`);
      writeFileSync(file, next);
      console.log(`${r.file}: source を ${fingerprint(lec)} にした`);
    }
  } else if (cmd === 'try') {
    // 講座の訳（course.ts）に並べる前の、レクチャーの訳を 1 本だけ確かめる（章ごとに並行して訳すとき）
    const [courseId, lang, id] = args as [string, TranslatedLang, string];
    // 訳は、at の id を番号に直す前の日本語の台本に重ねる（content/index.ts の coursesIn と同じ）
    const course = AUTHORED_COURSES.find((c) => c.id === courseId);
    const base = course?.lectures.find((l) => l.id === id);
    if (!course || !base || !TRANSLATED_LANGS.includes(lang)) throw new Error('使い方: bun scripts/i18n.ts try <講座 ID> <en|zh> <レクチャー ID>');
    const mod = (await import(path.join(ROOT, 'content', courseId, lang, `${id}.ts`))) as Record<string, LectureL10n>;
    const tr = mod[id];
    if (!tr) throw new Error(`content/${courseId}/${lang}/${id}.ts が ${id} を export していない`);
    // セクションの名前は講座の訳で決まるので、ここでは仮の名前にする
    const shell: Course = { ...course, sections: course.sections.map((x) => ({ ...x, title: `section ${x.no}` })), lectures: [] };
    const lec = localizeLecture(base, tr, lang, shell);
    const problems = untranslated({ ...shell, lectures: [lec], title: 'x', subtitle: 'x', headline: 'x', docsNote: 'x', sourceNote: 'x', disclaimer: 'x', cast: undefined, sources: undefined, ui: undefined, links: undefined } as Course, lang, { ...course, lectures: [base] });
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
    // 長さの目安: 字幕は 2 行まで、見出しは 1 行
    const maxLine = lang === 'en' ? 150 : 60;
    const maxHeading = lang === 'en' ? 44 : 24;
    const long: string[] = [];
    lec.scenes.forEach((sc, i) => {
      if (sc.heading && sc.heading.length > maxHeading) long.push(`場面 ${i + 1} の見出しが長い（${sc.heading.length} 字 > ${maxHeading}）: ${sc.heading}`);
      sc.lines.forEach((ln, k) => { if (ln.t.length > maxLine) long.push(`場面 ${i + 1} 台詞 ${k + 1} が長い（${ln.t.length} 字 > ${maxLine}。字幕が 3 行になる）: ${ln.t}`); });
    });
    console.log(`${id}.${lang}: 場面 ${lec.scenes.length}（台詞 ${lec.scenes.reduce((n, x) => n + x.lines.length, 0)}・日本語 ${base.scenes.reduce((n, x) => n + x.lines.length, 0)}）`);
    for (const p of problems) console.log(`訳し残し  ${p}`);
    for (const f of findings) console.log(`${f.level === 'error' ? '止める' : '注意'}  ${f.where}  ${f.what}  ${f.sample}`);
    for (const l of long) console.log(`長さ  ${l}`);
    const bad = problems.length + findings.filter((f) => f.level === 'error').length;
    console.log(bad ? `直すところ ${bad} か所` : `重ね方・訳し残し・点検は通った（長さの注意 ${long.length}）`);
    process.exit(bad ? 1 : 0);
  } else {
    console.error("使い方: bun scripts/i18n.ts status | stamp <ID.言語 …>（'*.en' で英語の全部）| try <講座 ID> <en|zh> <レクチャー ID>");
    process.exit(1);
  }
}
