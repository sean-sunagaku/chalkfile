// 学習の記録（localStorage）。講座ごと・言語ごとに分け、鍵の頭に名前を付ける（chalkfile:<言語/>?<講座 ID>:<名前>。日本語は言語を付けない）。
// 旧 GitHub Pages では同じ origin をほかのサイトと共有していた。保存済みの記録を読めるよう、鍵の名前は変えない。
// 訳の講座を言語ごとに分けるのは、動画の長さが違い、進み具合とメモの時刻を言語をまたいで使わないため。
//
// 記録の形の版（v）: 形のある値（progress・notes・quiz・prefs）には、書くときに版の番号 v を入れる（今は 1）。
//   版の無い値は、前の形（講座のページを TypeScript にする前の画面が書いたもの。tests/fixtures/local-storage/）として読む。
//   読むときは、どの版でも形を確かめ、足りない項目を補い、読めない項目を落とす（壊れた値で画面を止めない）。
//   last と tab は文字だけで、版を持たない（読むときに、今あるレクチャーとタブに照らす）。
// 前の版のページ（保存した前の版・無効にした版をオフラインで開いたとき）も、同じ鍵を読み書きする。前のページは値の中のレクチャー ID の
// 項目だけを引くので、v を足しても読める（レクチャー ID は頭文字の英大文字と 2 桁の番号で、v にはならない）。形を変えるときは、
// 前のページが読み書きしても壊れないように足すだけにし、読めない形にするときは、鍵の名前を変えて移す（版を上げ、読むときに変える）
// DOM を使わない（記録の形のテストが bun で読む。tests/offline-compat.test.ts）

/** 今の記録の形の版 */
export const STORE_VERSION = 1;

/** 1 本の進み具合。t は続きの時刻（秒）、max は見た割合（0〜1）、done は完了 */
export type Progress = { t: number; max: number; done: boolean };
/** 1 つのメモ。t は動画の時刻（秒）、at は書いた時刻（ミリ秒） */
export type Note = { t: number; text: string; at: number };
/** 再生の好み。rate は速度、cc は字幕、follow は台本を再生に合わせてスクロールするか */
export type Prefs = { rate: number; cc: boolean; follow: boolean };
/** クイズの答え（問いの番号 → 選んだ番号） */
export type Answers = Record<string, number>;

/** 講座の学習の記録（読んだもの。画面はこれを書き換えてから保存する） */
export type Learning = {
  /** レクチャー ID → 進み具合 */
  progress: Record<string, Progress>;
  /** レクチャー ID → メモ（時刻の順） */
  notes: Record<string, Note[]>;
  /** レクチャー ID → 答え */
  quiz: Record<string, Answers>;
  prefs: Prefs;
};

/** 選べる再生の速度（画面の速度のボタンと同じ） */
export const RATES = [1, 1.25, 1.5, 1.75] as const;
export const DEFAULT_PREFS: Prefs = { rate: 1, cc: true, follow: true };

/** localStorage の読み書きの所だけ（テストでは Map で代わりにする） */
export type KeyValueStore = { getItem(key: string): string | null; setItem(key: string, value: string): void };

/** 記録の鍵の頭（chalkfile:<言語/>?<講座 ID>:）。日本語は前と同じ鍵 */
export const storagePrefix = (lang: string, courseId: string) =>
  `chalkfile:${lang === 'ja' ? '' : `${lang}/`}${courseId}:`;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/** 値の中の項目（版の番号 v を除く） */
const entries = (value: unknown): [string, unknown][] =>
  isRecord(value) ? Object.entries(value).filter(([k]) => k !== 'v') : [];

/** 進み具合を読む。前の形では、完了の札だけの記録（{ done: true, t: 0 }）があり、max が無い */
export const readProgress = (value: unknown): Record<string, Progress> => {
  const out: Record<string, Progress> = {};
  for (const [id, p] of entries(value)) {
    if (!isRecord(p)) continue;
    out[id] = { t: Math.max(0, num(p.t, 0)), max: Math.min(1, Math.max(0, num(p.max, 0))), done: p.done === true };
  }
  return out;
};

/** メモを読む。文字の無いメモは落とし、時刻の順に並べる */
export const readNotes = (value: unknown): Record<string, Note[]> => {
  const out: Record<string, Note[]> = {};
  for (const [id, list] of entries(value)) {
    if (!Array.isArray(list)) continue;
    const notes = list
      .filter(isRecord)
      .map((n) => ({
        t: Math.max(0, Math.floor(num(n.t, 0))),
        text: typeof n.text === 'string' ? n.text : '',
        at: num(n.at, 0),
      }))
      .filter((n) => n.text !== '');
    if (notes.length) out[id] = notes.sort((a, b) => a.t - b.t);
  }
  return out;
};

/** クイズの答えを読む（問いと選んだ番号が 0 以上の整数のものだけ） */
export const readQuiz = (value: unknown): Record<string, Answers> => {
  const out: Record<string, Answers> = {};
  for (const [id, answers] of entries(value)) {
    const picked: Answers = {};
    for (const [q, c] of entries(answers))
      if (/^\d+$/.test(q) && Number.isInteger(c) && (c as number) >= 0) picked[q] = c as number;
    if (Object.keys(picked).length) out[id] = picked;
  }
  return out;
};

/** 再生の好みを読む（知らない速度は 1 倍。字幕と追従は、はっきり false のときだけ切る） */
export const readPrefs = (value: unknown): Prefs => {
  const p = isRecord(value) ? value : {};
  const rate = RATES.find((r) => r === p.rate) ?? DEFAULT_PREFS.rate;
  return { rate, cc: p.cc !== false, follow: p.follow !== false };
};

/** 書く値（形のある値には版の番号を入れる） */
const versioned = (value: object) => ({ v: STORE_VERSION, ...value });

/** 講座の学習の記録の読み書き。storage が使えない（null・例外）ときは、既定の値を返し、書けなくても止めない */
export const openStore = (storage: KeyValueStore | null, prefix: string) => {
  const get = (name: string): unknown => {
    try {
      const raw = storage?.getItem(prefix + name);
      return raw === null || raw === undefined ? undefined : JSON.parse(raw);
    } catch {
      return undefined;
    }
  };
  const set = (name: string, value: unknown) => {
    try {
      storage?.setItem(prefix + name, JSON.stringify(value));
    } catch {
      // 保存できなくても続ける（容量の不足・使えない設定）
    }
  };
  const text = (name: string) => {
    const v = get(name);
    return typeof v === 'string' ? v : null;
  };
  return {
    /** 学習の記録を読む */
    read: (): Learning => ({
      progress: readProgress(get('progress')),
      notes: readNotes(get('notes')),
      quiz: readQuiz(get('quiz')),
      prefs: readPrefs(get('prefs')),
    }),
    saveProgress: (progress: Learning['progress']) => set('progress', versioned(progress)),
    saveNotes: (notes: Learning['notes']) => set('notes', versioned(notes)),
    saveQuiz: (quiz: Learning['quiz']) => set('quiz', versioned(quiz)),
    savePrefs: (prefs: Prefs) => set('prefs', versioned(prefs)),
    /** 最後に開いたレクチャーの ID */
    last: () => text('last'),
    saveLast: (id: string) => set('last', id),
    /** 最後に開いていたタブ */
    tab: () => text('tab'),
    saveTab: (name: string) => set('tab', name),
  };
};

export type CourseStore = ReturnType<typeof openStore>;

/** ページの localStorage（使えない設定では、読むだけで例外になることがある） */
export const pageStorage = (): KeyValueStore | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};
