// 台本の古い書き方（中身の文字を見て描き分けていた、暗黙の決まり）を、明示の項目に読み替える。React・Remotion・Node に依存しない。
//   upgradeLecture(lecture)  描く前に、古い書き方の場面を明示の項目に読み替える（src/Lecture.tsx が通す。台本のファイルは書き換えない）
//   legacyUses(scene)        古い書き方を使っている項目と、書き換え方（台本の検証 engine/core/validate.ts が注意として出す）
// 古い書き方のままでも、今までと同じに描ける（台本は書き換えなくてよい）。新しく書く台本は、明示の項目で書く
//
//   古い書き方                                            明示の項目
//   opening の title を全角の空白か改行で行に分ける        titleLines: ['…', '…']
//   states の key が 'start' の箱を、始まりの見た目にする   variant: 'start'
//   sequence の actors の sub に / があれば等幅にする       subMono: true（等幅にしないなら subMono: false）
//   phone の lead が ? で始まれば等幅にする                leadMono: true
//   timeline の title を全角の空白で、札と題に分ける        kicker: '…'（札）と title: '…'（題）
import type { Lecture, Scene } from './schema';

export type LegacyUse = { path: string; message: string };

/** opening の題を行に分けていた文字（全角の空白か改行） */
const TITLE_BREAK = /　|\n/;
const q = (s: string) => `'${s.replace(/\n/g, '\\n')}'`;
const str = (v: unknown): v is string => typeof v === 'string';
const list = <T>(x: T[] | undefined | null): T[] => (Array.isArray(x) ? x : []);

/** timeline の題を、古い書き方で札と題に分けたもの（3 つ目より後は、前から出していない） */
const splitKicker = (title: string) => {
  // 呼び出し側は全角空白があるときだけ使うので、先頭の 2 要素がある。
  const [kicker, rest] = title.split('　') as [string, string, ...string[]];
  return { kicker, title: rest };
};

/** 古い書き方を使っている項目。path は場面の中の場所（例: timeline.items[0].title） */
export const legacyUses = (s: Scene): LegacyUse[] => {
  const out: LegacyUse[] = [];
  const use = (path: string, message: string) =>
    out.push({ path, message: `${message}（古い書き方。今も描けるが、明示の項目に書き換えるとよい）` });
  switch (s?.kind) {
    case 'opening':
      if (s.titleLines === undefined && str(s.title) && TITLE_BREAK.test(s.title)) {
        use(
          'opening.title',
          `題を全角の空白か改行で行に分けている。titleLines: [${s.title.split(TITLE_BREAK).map(q).join(', ')}] と書く`,
        );
      }
      break;
    case 'states':
      list(s.nodes).forEach((n, i) => {
        if (n?.variant === undefined && n?.key === 'start')
          use(`states.nodes[${i}].key`, "key が start の箱を、始まりの見た目にしている。variant: 'start' と書く");
      });
      break;
    case 'sequence':
      list(s.actors).forEach((a, i) => {
        if (a?.subMono === undefined && str(a?.sub) && a.sub.includes('/'))
          use(
            `sequence.actors[${i}].sub`,
            'sub に / があるので等幅で出している。subMono: true と書く（等幅にしないなら subMono: false）',
          );
      });
      break;
    case 'phone':
      list(s.screens).forEach((x, i) => {
        if (x?.leadMono === undefined && str(x?.lead) && x.lead.startsWith('?'))
          use(`phone.screens[${i}].lead`, 'lead が ? で始まるので等幅で出している。leadMono: true と書く');
      });
      break;
    case 'timeline':
      list(s.items).forEach((it, i) => {
        if (it?.kicker === undefined && str(it?.title) && it.title.includes('　')) {
          const { kicker, title } = splitKicker(it.title);
          use(
            `timeline.items[${i}].title`,
            `題を全角の空白で札と題に分けている。kicker: ${q(kicker)}, title: ${q(title)} と書く`,
          );
        }
      });
      break;
    default:
      break;
  }
  return out;
};

/** 古い書き方の場面を、明示の項目を足した場面にする。直すところが無ければ、同じ場面をそのまま返す */
export const upgradeScene = (s: Scene): Scene => {
  switch (s.kind) {
    case 'opening':
      return s.titleLines === undefined && TITLE_BREAK.test(s.title)
        ? { ...s, titleLines: s.title.split(TITLE_BREAK) }
        : s;
    case 'states': {
      if (!s.nodes.some((n) => n.variant === undefined && n.key === 'start')) return s;
      return {
        ...s,
        nodes: s.nodes.map((n) =>
          n.variant === undefined && n.key === 'start' ? { ...n, variant: 'start' as const } : n,
        ),
      };
    }
    case 'sequence': {
      if (!s.actors.some((a) => a.subMono === undefined && !!a.sub?.includes('/'))) return s;
      return {
        ...s,
        actors: s.actors.map((a) => (a.subMono === undefined && a.sub?.includes('/') ? { ...a, subMono: true } : a)),
      };
    }
    case 'phone': {
      if (!s.screens.some((x) => x.leadMono === undefined && !!x.lead?.startsWith('?'))) return s;
      return {
        ...s,
        screens: s.screens.map((x) =>
          x.leadMono === undefined && x.lead?.startsWith('?') ? { ...x, leadMono: true } : x,
        ),
      };
    }
    case 'timeline': {
      if (!s.items.some((it) => it.kicker === undefined && it.title.includes('　'))) return s;
      return {
        ...s,
        items: s.items.map((it) =>
          it.kicker === undefined && it.title.includes('　') ? { ...it, ...splitKicker(it.title) } : it,
        ),
      };
    }
    default:
      return s;
  }
};

const memo = new WeakMap<Lecture, Lecture>();

/** 動画 1 本の場面を、明示の項目に読み替える（同じ動画なら、前に作ったものを返す） */
export const upgradeLecture = (lecture: Lecture): Lecture => {
  let out = memo.get(lecture);
  if (!out) {
    const scenes = lecture.scenes.map(upgradeScene);
    out = scenes.every((s, i) => s === lecture.scenes[i]) ? lecture : { ...lecture, scenes };
    memo.set(lecture, out);
  }
  return out;
};
