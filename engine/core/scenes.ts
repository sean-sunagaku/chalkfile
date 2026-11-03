// 場面の種類の一覧（描かない側）。種類ごとの名前と、教材の絵コンテに出す「表示内容」のまとめ方を 1 か所に持つ。
// React・Remotion・Node に依存しない純粋なデータ（scripts/build_materials.ts と engine/core/validate.ts が読む）。
// 描く側は src/scenes/<kind>.tsx（defineScene）と、その登録表 src/scenes/index.ts。どちらも Scene['kind'] の全部を
// 型で網羅するので、場面の種類を足すと、ここと登録表に書くまで型で止まる（足し方は .claude/skills/study-video-course/references/style.md）
import type { Scene, TerminalOut } from '../../content/types';

export type SceneKind = Scene['kind'];
/** その種類の場面のデータ（SceneOf<'goals'> は GoalsScene） */
export type SceneOf<K extends SceneKind> = Extract<Scene, { kind: K }>;

/** 場面の種類 1 つ分の、描かない側の情報 */
export type SceneInfo<K extends SceneKind> = {
  /** 教材の絵コンテの「図解の種類」。ナレーション台本で、見出しの無い場面の名前にも使う */
  label: string;
  /** 絵コンテの「表示内容」。画面に出る文字を短くまとめる */
  describe: (s: SceneOf<K>) => string;
};

const plain = (s: string) => s.replace(/\*\*/g, '');

/** 端末の出力の 1 行の文字（色を付けた行は { text, tone }） */
export const terminalText = (o: TerminalOut): string => (typeof o === 'string' ? o : o.text);

/** 場面の種類（並びは README・教材の一覧と同じ。stills-compare の既定の場面もこの順） */
export const SCENE_INFO: { [K in SceneKind]: SceneInfo<K> } = {
  opening: {
    label: 'タイトル',
    describe: (s) => [s.section, `タイトル「${s.title.replace(/　/g, ' ')}」`, s.subtitle].filter(Boolean).join('／'),
  },
  goals: {
    label: 'ゴールの一覧',
    describe: (s) => s.items.map((x, i) => `${i + 1}. ${x.text}`).join(' '),
  },
  points: {
    label: '要点のカード',
    describe: (s) =>
      s.items.map((x, i) => `${s.numbered ? `${i + 1}. ` : ''}${x.title}${x.body ? `（${x.body}）` : ''}`).join('／'),
  },
  concepts: {
    label: '用語のカード',
    describe: (s) => s.cards.map((c) => `${c.ja}${c.en ? `（${c.en}）` : ''}: ${c.desc}`).join('／'),
  },
  sequence: {
    label: 'やりとりの図',
    describe: (s) => `登場: ${s.actors.map((a) => a.label).join('・')}。${s.steps.map((x) => x.label).join(' → ')}`,
  },
  flow: {
    label: '流れの図',
    describe: (s) =>
      `${s.nodes.map((n) => n.label).join('・')}。${s.edges
        .filter((e) => e.label)
        .map((e) => e.label)
        .join('／')}`,
  },
  states: {
    label: '状態の図',
    describe: (s) => s.nodes.map((n) => `${n.code}（${n.ja}）`).join(' → '),
  },
  code: {
    label: 'コード',
    describe: (s) => `${s.file}: ${s.marks.map((m) => m.note ?? `${m.from}〜${m.to} 行目`).join('／')}`,
  },
  table: {
    label: '表',
    describe: (s) => `${s.columns.join('｜')}: ${s.rows.map((r) => r.cells.join('・')).join('／')}`,
  },
  compare: {
    label: '左右の比較',
    describe: (s) =>
      `左「${s.left.title}」${s.left.items.map((x) => x.text).join('・')}／右「${s.right.title}」${s.right.items.map((x) => x.text).join('・')}${s.verdict ? `／結論: ${s.verdict.text}` : ''}`,
  },
  big: {
    label: '大きな一文',
    describe: (s) => `${s.kicker ? `${s.kicker}／` : ''}${plain(s.text)}${s.sub ? `／${s.sub}` : ''}`,
  },
  numbers: {
    label: '数字',
    describe: (s) =>
      s.items.map((x) => `${x.op ?? ''}${x.label} ${x.prefix ?? ''}${x.value}${x.suffix ?? ''}`).join(' ') +
      (s.footnote ? `／${s.footnote.text}` : ''),
  },
  timeline: {
    label: '時間の流れ',
    describe: (s) => s.items.map((x) => `${x.kicker ? `${x.kicker}　` : ''}${x.title}（${x.sub}）`).join(' → '),
  },
  quiz: {
    label: '○×クイズ',
    describe: (s) => `Q${s.no}. ${s.question} → 答え ${s.answer ? '○' : '×'}: ${s.explain}`,
  },
  recap: {
    label: 'まとめ',
    describe: (s) => s.items.map((x, i) => `${i + 1}. ${x.text}`).join(' '),
  },
  refs: {
    label: '参考資料',
    describe: (s) => s.refs.map((r) => `${r.title}（${r.url}）`).join('／'),
  },
  phone: {
    label: '画面の流れ',
    describe: (s) => s.screens.map((x) => `${x.title}: ${x.caption}`).join(' → '),
  },
  screens: {
    label: '画面の比較（改善前・改善後）',
    describe: (s) =>
      [s.left, s.right]
        .filter((x): x is NonNullable<typeof x> => !!x)
        .map(
          (x) =>
            `${x.label}${x.title ? `「${x.title}」` : ''}: ${(x.notes ?? []).map((n) => `${n.n}. ${n.text}`).join(' ')}`,
        )
        .join('／'),
  },
  terminal: {
    label: '端末',
    describe: (s) => s.entries.map((x) => x.cmd ?? (x.out ?? []).map(terminalText).join(' ')).join('／'),
  },
  ending: {
    label: '次の章の予告',
    describe: (s) => (s.next ? `次: 第 ${s.next.no} 章「${s.next.title}」` : (s.closing ?? 'おつかれさまでした')),
  },
};

/** 場面の種類（20 種類） */
export const SCENE_KINDS = Object.keys(SCENE_INFO) as SceneKind[];

/** 絵コンテの表示内容（場面の種類ごとの describe） */
export const describeScene = (s: Scene): string => (SCENE_INFO[s.kind].describe as (x: Scene) => string)(s);
