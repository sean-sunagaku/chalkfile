import type { Lecture, Source } from './types';

/** 出典の一覧（講座の共通の出典と、章で足した出典）から、講座サイトの「出典・参考資料」タブに出す形にする */
export const docsFrom = (list: Source[], ids: string[]): Lecture['docs'] =>
  ids.map((id) => {
    const s = list.find((x) => x.id === id);
    if (!s) throw new Error(`出典が無い: ${id}`);
    return { title: `${s.publisher}（${s.year}）${s.title}`, url: s.url };
  });

/** 章ごとに足した出典を 1 つにまとめる。同じ id は最初のものを使う */
export const uniqueSources = (...lists: Source[][]): Source[] => {
  const seen = new Set<string>();
  return lists.flat().filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)));
};
