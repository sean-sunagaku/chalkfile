// 講座の「読む教材」を Markdown と JSON に書き出す。台本（content/）が正本で、ここは毎回作り直す。
//   bun scripts/build_materials.ts                 # 教材を持つ全講座
//   bun scripts/build_materials.ts nudge-product   # 一部の講座だけ
// 出力（docs/courses/<講座 ID>/）:
//   README.md            講座の設計（全体の目次・到達目標・動画構成）
//   <章 ID>.md           章の一式（教材本文・ナレーション台本・絵コンテ・図解と比較例・確認問題・実践課題・要点と参考資料・AI チャットの質問例）
//   chunks.jsonl         AI 質問チャットが参照する単位（節・図・課題・問題）。id は章 ID・節 ID をそのまま使う
// 絵コンテの秒数とナレーションの時刻は synth.ts の出力（site/data/<id>.json）から取る。まだ無ければ秒数は空欄になる
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { COURSES } from '../content';
import type { Course, Evidence, Figure, Lecture, Scene, Source } from '../content/types';

const ROOT = path.resolve(import.meta.dir, '..');
const OUT = path.join(ROOT, 'docs/courses');

const EVIDENCE: Record<Evidence, string> = {
  research: '研究・学術',
  official: '公式・法令・規格',
  practice: '実務の指針',
  example: '説明用の仮の例',
};

const KIND: Record<Scene['kind'], string> = {
  opening: 'タイトル',
  goals: 'ゴールの一覧',
  points: '要点のカード',
  concepts: '用語のカード',
  sequence: 'やりとりの図',
  flow: '流れの図',
  states: '状態の図',
  code: 'コード',
  table: '表',
  compare: '左右の比較',
  big: '大きな一文',
  numbers: '数字',
  timeline: '時間の流れ',
  quiz: '○×クイズ',
  recap: 'まとめ',
  refs: '参考資料',
  phone: '画面の流れ',
  screens: '画面の比較（改善前・改善後）',
  terminal: '端末',
  ending: '次の章の予告',
};

type SiteData = {
  duration: number;
  chapters: { scene: number; start: number }[];
  cues: { start: number; end: number; text: string; scene: number }[];
};

const readData = (id: string): SiteData | null => {
  const f = path.join(ROOT, 'site/data', `${id}.json`);
  return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as SiteData) : null;
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

/** 絵コンテの「表示内容」。場面の種類ごとに、画面に出る文字を短くまとめる */
const describe = (s: Scene): string => {
  switch (s.kind) {
    case 'opening':
      return [s.section, `タイトル「${s.title.replace(/　/g, ' ')}」`, s.subtitle].filter(Boolean).join('／');
    case 'goals':
      return s.items.map((x, i) => `${i + 1}. ${x.text}`).join(' ');
    case 'points':
      return s.items.map((x, i) => `${s.numbered ? `${i + 1}. ` : ''}${x.title}${x.body ? `（${x.body}）` : ''}`).join('／');
    case 'concepts':
      return s.cards.map((c) => `${c.ja}${c.en ? `（${c.en}）` : ''}: ${c.desc}`).join('／');
    case 'sequence':
      return `登場: ${s.actors.map((a) => a.label).join('・')}。${s.steps.map((x) => x.label).join(' → ')}`;
    case 'flow':
      return `${s.nodes.map((n) => n.label).join('・')}。${s.edges.filter((e) => e.label).map((e) => e.label).join('／')}`;
    case 'states':
      return s.nodes.map((n) => `${n.code}（${n.ja}）`).join(' → ');
    case 'code':
      return `${s.file}: ${s.marks.map((m) => m.note ?? `${m.from}〜${m.to} 行目`).join('／')}`;
    case 'table':
      return `${s.columns.join('｜')}: ${s.rows.map((r) => r.cells.join('・')).join('／')}`;
    case 'compare':
      return `左「${s.left.title}」${s.left.items.map((x) => x.text).join('・')}／右「${s.right.title}」${s.right.items.map((x) => x.text).join('・')}${s.verdict ? `／結論: ${s.verdict.text}` : ''}`;
    case 'big':
      return `${s.kicker ? `${s.kicker}／` : ''}${plain(s.text)}${s.sub ? `／${s.sub}` : ''}`;
    case 'numbers':
      return s.items.map((x) => `${x.op ?? ''}${x.label} ${x.prefix ?? ''}${x.value}${x.suffix ?? ''}`).join(' ') + (s.footnote ? `／${s.footnote.text}` : '');
    case 'timeline':
      return s.items.map((x) => `${x.title}（${x.sub}）`).join(' → ');
    case 'quiz':
      return `Q${s.no}. ${s.question} → 答え ${s.answer ? '○' : '×'}: ${s.explain}`;
    case 'recap':
      return s.items.map((x, i) => `${i + 1}. ${x.text}`).join(' ');
    case 'refs':
      return s.refs.map((r) => `${r.title}（${r.url}）`).join('／');
    case 'phone':
      return s.screens.map((x) => `${x.title}: ${x.caption}`).join(' → ');
    case 'screens':
      return [s.left, s.right]
        .filter((x): x is NonNullable<typeof x> => !!x)
        .map((x) => `${x.label}${x.title ? `「${x.title}」` : ''}: ${(x.notes ?? []).map((n) => `${n.n}. ${n.text}`).join(' ')}`)
        .join('／');
    case 'terminal':
      return s.entries.map((x) => x.cmd ?? (x.out ?? []).join(' ')).join('／');
    case 'ending':
      return s.next ? `次: 第 ${s.next.no} 章「${s.next.title}」` : (s.closing ?? 'おつかれさまでした');
  }
};

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

  L.push(`# 第 ${lec.no} ${unit}　${lec.title}`, '');
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
  L.push('話者: 講師 = VOICEVOX:No.7、呼び込み = VOICEVOX:青山龍星。時刻は合成した音声の実測。', '');
  let k = 0;
  for (const [si, s] of lec.scenes.entries()) {
    L.push(`### 場面 ${si + 1}　${s.kind === 'opening' ? 'オープニング' : s.kind === 'ending' ? 'エンディング' : (s.heading ?? KIND[s.kind])}`, '');
    for (const ln of s.lines) {
      const cue = data?.cues[k++];
      L.push(`- ${cue ? `\`${mmss(cue.start)}\` ` : ''}${ln.v === 'announcer' ? '（呼び込み）' : ''}${ln.t}`);
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
    L.push(`| ${si + 1} | ${st !== undefined ? mmss(st) : ''} | ${secs} | ${KIND[s.kind]} | ${s.evidence ? EVIDENCE[s.evidence] : ''} | ${cell((s.heading ? `【${s.heading}】` : '') + describe(s))} | ${cell(s.lines.map((x) => x.t).join(' '))}${s.hold ? `（${s.hold} 秒の間）` : ''} |`);
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
  m.askExamples.forEach((a, i) => L.push(`${i + 1}. ${a.q}　→ 参照: ${a.refs.map((r) => `\`${r}\``).join('、')}`));
  L.push('');
  return L.join('\n');
};

const syllabusMd = (c: Course): string => {
  const y = c.syllabus!;
  const src = sourceMap(c);
  const L: string[] = [];
  L.push(`# ${c.title}`, '', `${c.subtitle}`, '', `- 講座 ID: \`${c.id}\``, `- 受講者: ${y.audience}`, `- 例に使う架空のサービス: ${y.sample}`, '');
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
    lec.quiz.forEach((q, i) => out.push({ id: `${m.id}-q${i + 1}`, course: c.id, chapter: m.id, type: 'quiz', title: q.q, text: `${q.choices.map((x, j) => `${j + 1}. ${x}`).join(' ')}\n答え: ${q.choices[q.answer]}\n${q.explain}`, evidence: [], sources: [] }));
    out.push({ id: `${m.id}-summary`, course: c.id, chapter: m.id, type: 'summary', title: `${lec.title} の要点`, text: m.summary.join('\n'), evidence: [], sources: cite(m.references) });
  }
  return out;
};

const wanted = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const targets = COURSES.filter((c) => c.syllabus && (!wanted.length || wanted.includes(c.id)));
if (!targets.length) console.log('教材（syllabus）を持つ講座がありません');

for (const c of targets) {
  const dir = path.join(OUT, c.id);
  mkdirSync(dir, { recursive: true });
  // 節 ID・図 ID が重なっていないか（AI チャットの参照先がぶれないように）
  const ids = [...c.lectures.flatMap((l) => (l.material ? [l.material.id, ...l.material.sections.map((s) => s.id), ...l.material.figures.map((f) => f.id), l.material.exercise.id] : [])), ...(c.syllabus?.chapters.map((ch) => ch.id) ?? [])];
  const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i && !c.syllabus?.chapters.some((ch) => ch.id === id && c.lectures.some((l) => l.material?.id === id)));
  if (dupIds.length) throw new Error(`${c.id}: ID が重なっている: ${[...new Set(dupIds)].join(' ')}`);
  for (const lec of c.lectures) {
    if (!lec.material) continue;
    for (const a of lec.material.askExamples) for (const r of a.refs) if (!ids.includes(r)) throw new Error(`${lec.id}: 質問例の参照先が無い: ${r}`);
  }
  writeFileSync(path.join(dir, 'README.md'), syllabusMd(c));
  for (const lec of c.lectures) if (lec.material) writeFileSync(path.join(dir, `${lec.material.id}.md`), lectureMd(c, lec));
  const chunks = chunksOf(c);
  writeFileSync(path.join(dir, 'chunks.jsonl'), chunks.map((x) => JSON.stringify(x)).join('\n') + '\n');
  console.log(`docs/courses/${c.id}/  章 ${c.syllabus!.chapters.length}（教材あり ${c.lectures.filter((l) => l.material).length}）  チャンク ${chunks.length}`);
}

// 講座の一覧
if (targets.length) {
  const all = COURSES.filter((c) => c.syllabus);
  const L = ['# 講座の教材', '', 'Chalkfile で作った講座の、読む教材・設計・AI チャット用のチャンクです。`bun scripts/build_materials.ts` で台本（`content/`）から作り直します。', '', '| 講座 | 章 | 教材と動画を作った章 | 設計 |', '| --- | --- | --- | --- |'];
  for (const c of all) L.push(`| ${c.title} | ${c.syllabus!.chapters.length} | ${c.lectures.filter((l) => l.material).map((l) => `[${l.material!.id}](${c.id}/${l.material!.id}.md)`).join('、')} | [README](${c.id}/README.md) |`);
  writeFileSync(path.join(OUT, 'README.md'), L.join('\n') + '\n');
}
