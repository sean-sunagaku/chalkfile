// 台本を検証する（engine/core/validate.ts）。全講座・全言語の台本と、テーマ・timeline の形を見て、誤り（error）があれば 1 で終える。
//   bun scripts/validate.ts             # 誤りの一覧と、注意（warning）の数と内訳
//   bun scripts/validate.ts --warnings  # 注意も一覧にする
//   bun scripts/validate.ts --json      # 結果を JSON で出す（CI・ほかの道具が読む）
// 誤り: 描くと止まるか黙って崩れるもの（矢印の行き先・at の範囲・表の幅・注の位置・テーマ・効果音・声など）と、
//       手で書いた派生データ（セクション・クイズの番号・次の動画・syllabus）の食い違い・台本と形の合わない timeline
// 注意: 見込み（焼き込み字幕が 3 行・見出しの幅）・style.md の目安（表 6 行×3 列・コード 18 行）・** の対応・意図かもしれない食い違い
// synth.ts の最初（対象の動画だけ）と Studio（src/Root.tsx。その動画だけ止める）も、同じ検証を使う
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { formatIssues, RULES, validateCourse, validateTheme, validateTimeline, type Issue, type TimelineShape } from '../engine/core/validate';

const ROOT = path.resolve(import.meta.dir, '..');

export type Report = { ok: boolean; errors: number; warnings: number; courses: number; videos: number; themes: number; issues: Issue[] };

/** 全講座・全言語を検証する。台本の読み込み（訳の重ね方）で止まったときも、誤りとして返す */
export const validateAll = async (): Promise<Report> => {
  const issues: Issue[] = [];
  let courses = 0;
  let videos = 0;
  const { THEMES } = await import('../content/themes');
  for (const [id, theme] of Object.entries(THEMES)) {
    issues.push(...validateTheme(theme, `content/themes.ts ${id}`));
    if (theme.id !== id) issues.push({ level: 'error', rule: 'theme', where: `content/themes.ts ${id}`, message: `THEMES のキー（${id}）とテーマの id（${theme.id}）が違う` });
  }
  try {
    const { coursesIn } = await import('../content');
    const { LANGS, videoKey } = await import('../content/i18n');
    const file = path.join(ROOT, 'src/generated/timeline.json');
    const timeline: Record<string, TimelineShape> = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
    for (const lang of LANGS) {
      for (const course of coursesIn(lang)) {
        courses++;
        issues.push(...validateCourse(course));
        for (const lec of course.lectures) {
          videos++;
          issues.push(...validateTimeline(lec, course, timeline[videoKey(lec.id, lang)]));
        }
      }
    }
  } catch (e) {
    // 訳の数の食い違いなどは、content/ を読み込むときに止まる（content/i18n.ts の localizeCourse）
    issues.push({ level: 'error', rule: 'scenes', where: 'content/（読み込み）', message: e instanceof Error ? e.message : String(e) });
  }
  const errors = issues.filter((x) => x.level === 'error').length;
  return { ok: errors === 0, errors, warnings: issues.length - errors, courses, videos, themes: Object.keys(THEMES).length, issues };
};

/** 注意の内訳（種類ごとの数） */
const breakdown = (issues: Issue[]) => {
  const n = new Map<string, number>();
  for (const x of issues) n.set(RULES[x.rule], (n.get(RULES[x.rule]) ?? 0) + 1);
  return [...n].map(([k, v]) => `${k} ${v}`).join('・');
};

if (import.meta.main) {
  const args = process.argv.slice(2);
  for (const a of args) if (!['--json', '--warnings'].includes(a)) throw new Error(`知らない引数: ${a}（使えるのは --json と --warnings）`);
  const report = await validateAll();
  if (args.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const errors = report.issues.filter((x) => x.level === 'error');
    const warnings = report.issues.filter((x) => x.level === 'warning');
    const shown = args.includes('--warnings') ? [...errors, ...warnings] : errors;
    if (shown.length) console.log(formatIssues(shown));
    console.log(
      `台本の検証: 誤り ${report.errors} 件・注意 ${report.warnings} 件（${report.courses} 講座・${report.videos} 本の動画・${report.themes} テーマ。訳の講座も数える）`,
    );
    if (warnings.length) console.log(`注意の内訳: ${breakdown(warnings)}${args.includes('--warnings') ? '' : '（一覧は --warnings）'}`);
  }
  process.exit(report.ok ? 0 : 1);
}
