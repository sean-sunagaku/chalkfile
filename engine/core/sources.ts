// 出典の書き方のヘルパー（講座の sources.ts と章の台本が使う。台本は content/sources-util.ts から読む）
import type { Lecture, Source } from './schema';

/** 公式リンクだけの講座も、確認済みの詳しい出典がある講座も、同じ表から引く。 */
export type SourceInput = Pick<Source, 'id' | 'title' | 'url'> & Partial<Omit<Source, 'id' | 'title' | 'url'>>;
type Selection<K extends string> = K | { id: K; title?: string };

const DETAILS = ['publisher', 'year', 'kind', 'checked', 'note'] as const;
const fullSource = (source: SourceInput): source is Source => DETAILS.every((key) => typeof source[key] === 'string');
const sameSource = (source: SourceInput) =>
  JSON.stringify(Object.fromEntries(Object.entries(source).sort(([a], [b]) => a.localeCompare(b))));

/** 出典の表。ID の重複と参照を確かめ、リンクの表示だけを上書きできる。 */
export const defineSources = <const T extends readonly SourceInput[]>(list: T) => {
  type Id = T[number]['id'];
  const byId = new Map<string, SourceInput>();
  for (const source of list) {
    if (DETAILS.some((key) => source[key] !== undefined) && !fullSource(source))
      throw new Error(`出典の説明が欠けている: ${source.id}`);
    const previous = byId.get(source.id);
    if (previous && sameSource(previous) !== sameSource(source))
      throw new Error(`同じ ID で中身が違う出典: ${source.id}`);
    if (!previous) byId.set(source.id, source);
  }
  const get = (id: Id): SourceInput => {
    const source = byId.get(id);
    if (!source) throw new Error(`出典が無い: ${id}`);
    return source;
  };
  const docs = (ids: readonly Selection<Id>[]): Lecture['docs'] =>
    ids.map((selection) => {
      const source = get(typeof selection === 'string' ? selection : selection.id);
      const title = typeof selection === 'string' ? undefined : selection.title;
      return {
        title: title ?? (fullSource(source) ? `${source.publisher}（${source.year}）${source.title}` : source.title),
        url: source.url,
      };
    });
  const all = [...byId.values()];
  // 入れたものは list の要素だけ。ID の型を、別の表で共用するときも保つ。
  return { all: all as T[number][], sources: all.filter(fullSource), get, docs };
};

/** 出典の一覧（講座の共通の出典と、章で足した出典）から、講座サイトの「出典・参考資料」タブに出す形にする */
export const docsFrom = (list: Source[], ids: string[]): Lecture['docs'] =>
  ids.map((id) => {
    const s = list.find((x) => x.id === id);
    if (!s) throw new Error(`出典が無い: ${id}`);
    return { title: `${s.publisher}（${s.year}）${s.title}`, url: s.url };
  });

/** 出典を 1 つにまとめる。同じ id と中身なら最初のものを使い、中身が違えば止める */
export const uniqueSources = (...lists: Source[][]): Source[] => defineSources(lists.flat()).sources;
