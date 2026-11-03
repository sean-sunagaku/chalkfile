// 講座の「読む教材」を Markdown と JSON に書き出す。台本（content/）が正本で、ここは毎回作り直す。Git に入れている台本と生成物だけを読む
// （synth を流していない checkout でも、同じ中身になる）。
//   bun scripts/build_materials.ts                 # 教材を持つ全講座（消した章・講座の古いファイルも消す）
//   bun scripts/build_materials.ts nudge-product   # 一部の講座だけ（その講座のフォルダの古いファイルも消す）
//   bun scripts/build_materials.ts --check         # 書かずに、作り直したものと docs/courses を比べる（違えば一覧を出して 1 で終える。CI の check）
//   npm run chalk -- docs build [--check]          # 1 つの入口からも流せる（docs/guide/commands.md の「chalk」）
// 出力（docs/courses/<講座 ID>/）:
//   README.md            講座の設計（全体の目次・到達目標・動画構成）
//   <章 ID>.md           章の一式（教材本文・ナレーション台本・絵コンテ・図解と比較例・確認問題・実践課題・要点と参考資料・AI チャットの質問例）
//   chunks.jsonl         AI 質問チャットが参照する単位（節・図・課題・問題）。id は章 ID・節 ID をそのまま使う
// 絵コンテの秒数とナレーションの時刻は、Git に入れている timeline（content/<講座>/generated/timeline/<ID>.json）から取る。
// まだ無ければ秒数は空欄になる。話し手の名前は講座の cast（無ければ役の名前）、声の名前は creditsIn から（章の話者と、講座の README の
// 「動画の声」に、使った全部の声のクレジットを出す）。Markdown の頭には生成物の印を書く
// 終了コード: 0 できた（--check は同じ）・1 違う・2 使い方の誤り
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { COURSES } from '../content';
import type { Course, Evidence, Figure, Lecture, Source, VoiceId } from '../content/types';
import { creditsIn, VOICES, voicesOf } from '../content/voices';
import { describeScene, SCENE_INFO } from '../engine/core/scenes';
import { readArgs, runMain, showHelp, UsageError } from './lib/args';
import { writeAtomic } from './lib/fsx';
import { ROOT } from './lib/paths';
import { readTimelinesByKey } from './timelines';
import { materialProblems } from './validate';

const OUT = path.join(ROOT, 'docs/courses');
/** 生成する Markdown の頭の印（scripts/check_docs.ts の hasGeneratedMark が見る） */
export const GENERATED_MARK = '<!-- 生成物: bun scripts/build_materials.ts が content/ の台本と timeline から作る。手で直さない -->';

const EVIDENCE: Record<Evidence, string> = {
  research: '研究・学術',
  official: '公式・法令・規格',
  practice: '実務の指針',
  example: '説明用の仮の例',
};

type SiteData = {
  duration: number;
  chapters: { scene: number; start: number }[];
  cues: { start: number; end: number; text: string; scene: number }[];
};

const timelines = readTimelinesByKey();
/**
 * 絵コンテとナレーションの時刻（秒）。synth.ts が site/data/<ID>.json に書くのと同じ値になるように、timeline のフレームを秒にして
 * 小数 2 桁に丸める（台詞の時刻は、場面の頭と、場面の中の台詞の頭を足す）。timeline が無ければ null
 */
const readData = (id: string): SiteData | null => {
  const t = timelines.get(id)?.[0]?.timeline;
  if (!t) return null;
  const sec = (frames: number) => +(frames / t.fps).toFixed(2);
  return {
    duration: sec(t.durationInFrames),
    chapters: t.scenes.map((s, scene) => ({ scene, start: sec(s.start) })),
    cues: t.scenes.flatMap((s, scene) => s.lines.map((l) => ({ start: sec(s.start + l.start), end: sec(s.start + l.end), text: '', scene }))),
  };
};

/** 役の名前（講座に cast が無いとき） */
const ROLE: Record<VoiceId, string> = { narrator: '講師', announcer: '呼び込み', zundamon: 'ずんだもん', 'zundamon-cry': 'ずんだもん', tsukkomi: 'ツッコミ', tennokoe: '天の声' };
/** 話し手の名前（講座の cast。無ければ役の名前） */
const speakerOf = (c: Course, v: VoiceId) => c.cast?.[v]?.name ?? ROLE[v];
/** その章で使った声の話し手と、声の名前（VOICES の順・重なりなし。名前は creditsIn） */
export const speakersLine = (c: Course, lec: Lecture) => {
  const used = new Set(voicesOf(lec));
  const pairs = (Object.keys(VOICES) as VoiceId[]).filter((v) => used.has(v)).map((v) => `${speakerOf(c, v)} = ${creditsIn('ja', [v]).join('・')}`);
  return `話者: ${[...new Set(pairs)].join('、')}。時刻は合成した音声の実測。`;
};

const plain = (s: string) => s.replace(/\*\*/g, '');
/** 段落を並べる。続く箇条書き（「- 」「1. 」）の間には空行を入れない */
const paras = (list: string[]): string[] => {
  const isItem = (x: string) => /^(- |\d+\. )/.test(x);
  const out: string[] = [];
  list.forEach((b, i) => {
    out.push(b);
    if (!(isItem(b) && list[i + 1] !== undefined && isItem(list[i + 1]))) out.push('');
  });
  return out;
};
const cell = (s: string) => plain(s).replace(/\|/g, '｜').replace(/\n/g, ' ');
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const sourceMap = (c: Course) => new Map((c.sources ?? []).map((s) => [s.id, s]));

const srcLine = (s: Source) => `${s.publisher}（${s.year}）「${s.title}」 ${s.url} （${EVIDENCE[s.kind]}・${s.checked} 確認）`;

const figureMd = (f: Figure): string[] => {
  const out = [`### [${f.id}] ${f.title}`, '', `${f.caption}（${EVIDENCE[f.evidence]}）`, ''];
  if (f.table) {
    const [head, ...rows] = f.table;
    out.push(`| ${head.map(cell).join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`), '');
  }
  if (f.flow) {
    out.push('```mermaid', 'flowchart LR', ...f.flow.map((x, i) => `  s${i}["${plain(x).replace(/"/g, "'")}"]${i < f.flow!.length - 1 ? ` --> s${i + 1}` : ''}`), '```', '');
    out.push(`流れ: ${f.flow.map(plain).join(' → ')}`, '');
  }
  if (f.code) out.push('```' + (f.lang ?? ''), f.code, '```', '');
  return out;
};

const lectureMd = (c: Course, lec: Lecture): string => {
  const m = lec.material!;
  const src = sourceMap(c);
  const data = readData(lec.id);
  const unit = c.unitLabel === 'CHAPTER' ? '章' : 'レクチャー';
  const L: string[] = [];
  const ref = (ids?: string[]) => (ids ?? []).map((id) => {
    const s = src.get(id);
    if (!s) throw new Error(`${lec.id}: 出典が sources に無い: ${id}`);
    return `[${s.publisher} ${s.year}](${s.url})`;
  });

  L.push(GENERATED_MARK, '', `# 第 ${lec.no} ${unit}　${lec.title}`, '');
  L.push(`- 講座: ${c.title}（${c.id}）`, `- 章 ID: \`${m.id}\`　動画 ID: \`${lec.id}\``, `- 動画: ${data ? `${mmss(data.duration)}（${data.cues.length} 台詞）` : '未合成（bun scripts/synth.ts で時刻が入る）'}`, `- 要約: ${lec.summary}`, '');
  L.push('> このファイルは `bun scripts/build_materials.ts` が `content/` の台本から作ります。直すときは台本（`content/' + c.id + '/` の TS）を直してください。', '');
  L.push('## 学習目標', '', ...m.goals.map((g) => `- ${g}`), '', '## 前提知識', '', ...m.prerequisites.map((g) => `- ${g}`), '');
  L.push('根拠の種類の札: **研究・学術**（査読のある研究・メタ分析・学術書の定義）／**公式・法令・規格**（法律・官公庁・標準化団体・公式ガイドライン）／**実務の指針**（実務家や専門機関の一般的な指針。条件によって外れる）／**説明用の仮の例**（架空のサンプルで、実在のデータではない）', '');

  // 1. 教材本文
  L.push('## 1. 教材本文', '');
  for (const s of m.sections) {
    L.push(`### [${s.id}] ${s.title}`, '');
    L.push(`根拠: ${s.evidence.map((e) => EVIDENCE[e]).join('・')}${s.scenes?.length ? `　動画の場面: ${s.scenes.join(', ')}` : ''}${s.sources?.length ? `　出典: ${ref(s.sources).join('、')}` : ''}`, '');
    L.push(...paras(s.body));
  }

  // 2. ナレーション台本
  L.push('## 2. ナレーション台本', '');
  L.push(speakersLine(c, lec), '');
  let k = 0;
  for (const [si, s] of lec.scenes.entries()) {
    L.push(`### 場面 ${si + 1}　${s.kind === 'opening' ? 'オープニング' : s.kind === 'ending' ? 'エンディング' : (s.heading ?? SCENE_INFO[s.kind].label)}`, '');
    for (const ln of s.lines) {
      const cue = data?.cues[k++];
      const who = speakerOf(c, ln.v ?? 'narrator');
      L.push(`- ${cue ? `\`${mmss(cue.start)}\` ` : ''}${who !== speakerOf(c, 'narrator') ? `（${who}）` : ''}${ln.t}`);
    }
    if (s.hold) L.push(`- （${s.hold} 秒の間。考える時間）`);
    L.push('');
  }

  // 3. 絵コンテ
  L.push('## 3. 絵コンテ', '');
  L.push('| # | 開始 | 秒数 | 図解の種類 | 根拠 | 表示内容（画面の文字） | 読み上げ（字幕と同じ） |', '| --- | --- | --- | --- | --- | --- | --- |');
  for (const [si, s] of lec.scenes.entries()) {
    const st = data?.chapters[si]?.start;
    const en = data ? (data.chapters[si + 1]?.start ?? data.duration) : undefined;
    const secs = st !== undefined && en !== undefined ? `${Math.round(en - st)} 秒` : '';
    L.push(`| ${si + 1} | ${st !== undefined ? mmss(st) : ''} | ${secs} | ${SCENE_INFO[s.kind].label} | ${s.evidence ? EVIDENCE[s.evidence] : ''} | ${cell((s.heading ? `【${s.heading}】` : '') + describeScene(s))} | ${cell(s.lines.map((x) => x.t).join(' '))}${s.hold ? `（${s.hold} 秒の間）` : ''} |`);
  }
  L.push('', '字幕: 全部の台詞を日本語字幕にする（講座サイトは動画の下の帯、`out/captioned/` の動画は焼き込み）。画面の文字は要点だけにし、説明はナレーションと教材本文で補う。', '');

  // 4. 図解・比較例
  L.push('## 4. 図解・比較例', '');
  for (const f of m.figures) L.push(...figureMd(f));

  // 5. 理解確認問題
  L.push('## 5. 理解確認問題', '');
  lec.quiz.forEach((q, i) => {
    L.push(`### 問 ${i + 1}. ${q.q}`, '', ...q.choices.map((ch, j) => `${j + 1}. ${ch}`), '', `<details><summary>答えと解説</summary>\n\n**答え: ${q.answer + 1}. ${q.choices[q.answer]}**\n\n${q.explain}\n\n</details>`, '');
  });

  // 6. 実践課題
  const ex = m.exercise;
  L.push(`## 6. 実践課題 [${ex.id}] ${ex.title}`, '', `- ねらい: ${ex.goal}`, `- 目安の時間: ${ex.timebox}`, `- 出すもの: ${ex.deliverable}`, '', '### 手順', '', ...ex.steps.map((x, i) => `${i + 1}. ${x}`), '');
  L.push(`### 回答例: ${ex.example.title}`, '', ...paras(ex.example.body));
  L.push('### 評価基準', '', '| 観点 | できている | もう一歩 | やり直し |', '| --- | --- | --- | --- |', ...ex.rubric.map((r) => `| ${cell(r.criterion)} | ${cell(r.good)} | ${cell(r.fair)} | ${cell(r.poor)} |`), '');

  // 7. 要点まとめと参考資料
  L.push('## 7. 要点まとめと参考資料', '', '### 要点', '', ...m.summary.map((x) => `- ${x}`), '', '### 参考資料', '');
  for (const id of m.references) {
    const s = src.get(id);
    if (!s) throw new Error(`${lec.id}: 参考資料が sources に無い: ${id}`);
    L.push(`- ${srcLine(s)}`, `  - ${s.note}`);
  }
  L.push('');

  // 8. AI チャットの質問例
  L.push('## 8. 学習画面の右側の AI チャットに聞ける質問例', '', '（チャットはまだ作っていません。質問ごとに、答えの根拠にする節 ID を付けています）', '');
  m.askExamples.forEach((a, i) => {
    L.push(`${i + 1}. ${a.q}　→ 参照: ${a.refs.map((r) => `\`${r}\``).join('、')}`);
  });
  L.push('');
  return L.join('\n');
};

/** 講座の動画で使った全部の声のクレジット（VOICES の順・重なりなし。名前は creditsIn）。動画がまだ無ければ出さない */
export const courseVoicesLine = (c: Course): string[] => {
  const credits = creditsIn('ja', c.lectures.flatMap(voicesOf));
  return credits.length ? [`- 動画の声: ${credits.join('、')}（章ごとの話者は、各章の「2. ナレーション台本」）。BGM・効果音はプログラムで合成したオリジナル`] : [];
};

const syllabusMd = (c: Course): string => {
  const y = c.syllabus!;
  const src = sourceMap(c);
  const L: string[] = [];
  L.push(GENERATED_MARK, '', `# ${c.title}`, '', `${c.subtitle}`, '', `- 講座 ID: \`${c.id}\``, `- 受講者: ${y.audience}`, `- 例に使う架空のサービス: ${y.sample}`, ...courseVoicesLine(c), '');
  if (c.disclaimer) L.push(`> ${c.disclaimer}`, '');
  L.push('## 到達目標', '', ...y.outcomes.map((x, i) => `${i + 1}. ${x}`), '', `最後の実践: ${y.finalProject}`, '');
  L.push('## 前提知識', '', ...y.prerequisites.map((x) => `- ${x}`), '');
  L.push('## 全体の目次と動画構成', '');
  // 長さは、合成した章なら動画の実際の長さ、計画だけの章なら目安
  L.push('| 章 | 章 ID | 動画 | セクション | タイトル | この章で答える問い | 長さ | 状態 |', '| --- | --- | --- | --- | --- | --- | --- | --- |');
  let made = 0;
  let madeSec = 0;
  for (const ch of y.chapters) {
    const sec = c.sections.find((s) => s.no === ch.section);
    const data = ch.status === 'produced' ? readData(ch.lectureId) : null;
    const t = data ? Math.round(data.duration) : 0;
    if (data) {
      made++;
      madeSec += data.duration;
    }
    L.push(`| ${ch.no} | \`${ch.id}\` | \`${ch.lectureId}\` | ${sec ? cell(sec.title) : ch.section} | ${ch.status === 'produced' ? `[${cell(ch.title)}](${ch.id}.md)` : cell(ch.title)} | ${cell(ch.question)} | ${data ? `${Math.floor(t / 60)} 分 ${t % 60} 秒` : `目安 ${ch.minutes} 分`} | ${ch.status === 'produced' ? '教材・動画あり' : '計画'} |`);
  }
  const plan = y.chapters.reduce((a, ch) => a + ch.minutes, 0);
  L.push('', made ? `動画の合計: 約 ${Math.round(madeSec / 60)} 分（${made} 章。計画の目安は全 ${y.chapters.length} 章で約 ${plan} 分）` : `合計の目安: 約 ${plan} 分`, '');
  L.push('各章は「具体的な困りごと → 考え方 → 良い例・悪い例 → 実践手順 → 演習 → 振り返り」の順に進みます。', '');
  for (const ch of y.chapters) {
    L.push(`### 第 ${ch.no} 章 ${ch.title}（\`${ch.id}\`）`, '', `問い: ${ch.question}`, '');
    L.push('学習目標:', '', ...ch.goals.map((g) => `- ${g}`), '', '前提知識:', '', ...ch.prerequisites.map((g) => `- ${g}`), '');
    L.push('動画の構成:', '', '| 流れ | 中身 |', '| --- | --- |', ...ch.storyline.map((s) => `| ${s.step} | ${cell(s.content)} |`), '');
    L.push(`実践課題の案: ${ch.exercise}`, '');
    if (ch.sources.length) {
      L.push('主な出典:', '', ...ch.sources.map((id) => {
        const s = src.get(id);
        if (!s) throw new Error(`${c.id} ${ch.id}: 出典が sources に無い: ${id}`);
        return `- ${srcLine(s)}`;
      }), '');
    }
  }
  L.push('## 出典の一覧', '', '| ID | 種類 | 出典 | 確認日 | 何を確かめたか |', '| --- | --- | --- | --- | --- |');
  for (const s of c.sources ?? []) L.push(`| \`${s.id}\` | ${EVIDENCE[s.kind]} | [${cell(`${s.publisher}（${s.year}）${s.title}`)}](${s.url}) | ${s.checked} | ${cell(s.note)} |`);
  L.push('', c.sourceNote, '');
  return L.join('\n');
};

type Chunk = { id: string; course: string; chapter: string; type: 'section' | 'figure' | 'exercise' | 'quiz' | 'summary' | 'chapter-plan'; title: string; text: string; evidence: string[]; sources: { id: string; title: string; url: string; checked: string }[] };

const chunksOf = (c: Course): Chunk[] => {
  const src = sourceMap(c);
  const cite = (ids?: string[]) => (ids ?? []).map((id) => src.get(id)!).filter(Boolean).map((s) => ({ id: s.id, title: `${s.publisher}（${s.year}）${s.title}`, url: s.url, checked: s.checked }));
  const out: Chunk[] = [];
  for (const ch of c.syllabus?.chapters ?? []) {
    out.push({ id: ch.id, course: c.id, chapter: ch.id, type: 'chapter-plan', title: `第 ${ch.no} 章 ${ch.title}`, text: [`問い: ${ch.question}`, ...ch.goals.map((g) => `目標: ${g}`), ...ch.storyline.map((s) => `${s.step}: ${s.content}`), `実践課題の案: ${ch.exercise}`].join('\n'), evidence: [], sources: cite(ch.sources) });
  }
  for (const lec of c.lectures) {
    const m = lec.material;
    if (!m) continue;
    for (const s of m.sections) out.push({ id: s.id, course: c.id, chapter: m.id, type: 'section', title: s.title, text: s.body.join('\n'), evidence: s.evidence.map((e) => EVIDENCE[e]), sources: cite(s.sources) });
    for (const f of m.figures) out.push({ id: f.id, course: c.id, chapter: m.id, type: 'figure', title: f.title, text: [f.caption, ...(f.table ?? []).map((r) => r.join(' | ')), ...(f.flow ? [f.flow.join(' → ')] : []), f.code ?? ''].filter(Boolean).join('\n'), evidence: [EVIDENCE[f.evidence]], sources: [] });
    const ex = m.exercise;
    out.push({ id: ex.id, course: c.id, chapter: m.id, type: 'exercise', title: ex.title, text: [ex.goal, ...ex.steps, `出すもの: ${ex.deliverable}`, `回答例: ${ex.example.body.join(' ')}`, ...ex.rubric.map((r) => `${r.criterion}: できている=${r.good} もう一歩=${r.fair} やり直し=${r.poor}`)].join('\n'), evidence: [EVIDENCE.example], sources: [] });
    lec.quiz.forEach((q, i) => {
      out.push({ id: `${m.id}-q${i + 1}`, course: c.id, chapter: m.id, type: 'quiz', title: q.q, text: `${q.choices.map((x, j) => `${j + 1}. ${x}`).join(' ')}\n答え: ${q.choices[q.answer]}\n${q.explain}`, evidence: [], sources: [] });
    });
    out.push({ id: `${m.id}-summary`, course: c.id, chapter: m.id, type: 'summary', title: `${lec.title} の要点`, text: m.summary.join('\n'), evidence: [], sources: cite(m.references) });
  }
  return out;
};

/**
 * 教材のファイル（docs/courses からのパス → 中身）。courses を渡すとその講座だけ（一覧の README は毎回作る）。
 * 書き出す前に、節 ID・図 ID が重なっていないか（AI チャットの参照先がぶれないように）と、質問例の参照先があるかを全部の講座で確かめる
 * （中身は scripts/validate.ts の materialProblems。PR の CI の npm run validate も同じものを流す）
 */
export const materialOutputs = (wanted: string[] = []): Map<string, string> => {
  const targets = COURSES.filter((c) => c.syllabus && (!wanted.length || wanted.includes(c.id)));
  const problems = targets.flatMap(materialProblems);
  if (problems.length) throw new Error(problems.join('\n'));
  const out = new Map<string, string>();
  for (const c of targets) {
    out.set(`${c.id}/README.md`, syllabusMd(c));
    for (const lec of c.lectures) if (lec.material) out.set(`${c.id}/${lec.material.id}.md`, lectureMd(c, lec));
    out.set(`${c.id}/chunks.jsonl`, chunksOf(c).map((x) => JSON.stringify(x)).join('\n') + '\n');
  }
  // 講座の一覧
  if (targets.length) {
    const all = COURSES.filter((c) => c.syllabus);
    const L = [GENERATED_MARK, '', '# 講座の教材', '', 'Chalkfile で作った講座の、読む教材・設計・AI チャット用のチャンクです。`bun scripts/build_materials.ts` で台本（`content/`）から作り直します。', '', '| 講座 | 章 | 教材と動画を作った章 | 設計 |', '| --- | --- | --- | --- |'];
    for (const c of all) L.push(`| ${c.title} | ${c.syllabus!.chapters.length} | ${c.lectures.filter((l) => l.material).map((l) => `[${l.material!.id}](${c.id}/${l.material!.id}.md)`).join('、')} | [README](${c.id}/README.md) |`);
    out.set('README.md', L.join('\n') + '\n');
  }
  return out;
};

/** 今ある教材のファイル（docs/courses からのパス）。courses を渡すと、その講座のフォルダと一覧の README だけ */
const existingFiles = (wanted: string[]): string[] => {
  const walk = (dir: string): string[] =>
    existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.relative(OUT, path.join(dir, e.name))])) : [];
  const files = walk(OUT).map((f) => f.split(path.sep).join('/'));
  return wanted.length ? files.filter((f) => f === 'README.md' || wanted.includes(f.split('/')[0])) : files;
};

const main = (argv: string[]) => {
  const { values, positionals: wanted } = readArgs(argv, { check: { type: 'boolean' } }, { positionals: true });
  if (values.help) return showHelp(import.meta.filename);
  for (const id of wanted) if (!COURSES.some((c) => c.id === id && c.syllabus)) throw new UsageError(`教材（syllabus）を持つ講座が無い: ${id}`);
  const outputs = materialOutputs(wanted);
  if (!outputs.size) console.log('教材（syllabus）を持つ講座がありません');
  // 消した章・講座の古いファイル（作るものに無い、今あるファイル）
  const stale = existingFiles(wanted).filter((f) => !outputs.has(f));
  if (values.check) {
    const changed = [...outputs].filter(([f, text]) => !existsSync(path.join(OUT, f)) || readFileSync(path.join(OUT, f), 'utf8') !== text).map(([f]) => f);
    for (const f of changed) console.log(`${existsSync(path.join(OUT, f)) ? '違う' : '無い'}: docs/courses/${f}`);
    for (const f of stale) console.log(`残っている（消した章か講座）: docs/courses/${f}`);
    const n = changed.length + stale.length;
    console.log(n ? `教材が ${n} 個、台本から作り直したものと違う（bun scripts/build_materials.ts で作り直す。手で直さない）` : `教材は台本から作り直したものと同じ（${outputs.size} 個）`);
    return n ? 1 : 0;
  }
  for (const [f, text] of outputs) writeAtomic(path.join(OUT, f), text);
  for (const f of stale) {
    rmSync(path.join(OUT, f));
    // 空になった講座のフォルダも消す
    const dir = path.dirname(path.join(OUT, f));
    if (dir !== OUT && !readdirSync(dir).length) rmSync(dir, { recursive: true });
    console.log(`消した（消した章か講座の古いファイル）: docs/courses/${f}`);
  }
  for (const c of COURSES.filter((x) => x.syllabus && (!wanted.length || wanted.includes(x.id)))) {
    console.log(`docs/courses/${c.id}/  章 ${c.syllabus!.chapters.length}（教材あり ${c.lectures.filter((l) => l.material).length}）  チャンク ${chunksOf(c).length}`);
  }
};

if (import.meta.main) await runMain(main);
