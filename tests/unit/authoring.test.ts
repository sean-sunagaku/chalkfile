// 書き方のヘルパーの省略・上書き・参照の型を確かめる。
import { describe, expect, test } from 'bun:test';
import config from '../../chalkfile.config';
import { comedyCast } from '../../content/_shared/comedy';
import { courseLinks } from '../../content/_shared/links';
import { THEMES } from '../../content/themes';
import { flow, goals } from '../../engine/core/authoring';
import { THEME_IDS } from '../../engine/core/project-settings';
import { defineSources, uniqueSources } from '../../engine/core/sources';
import type { Source } from '../../engine/core/schema';

const source: Source = {
  id: 'spec',
  title: '仕様',
  url: 'https://example.com/spec',
  publisher: '作成者',
  year: '2026',
  kind: 'official',
  checked: '2026-11-04',
  note: '試験の見本',
};

describe('出典の表', () => {
  test('同じ ID と中身は最初のものを保ち、違う中身は止める', () => {
    const { title, ...rest } = source;
    const reordered: Source = { title, ...rest };
    const table = defineSources([source, reordered]);
    expect(table.all).toHaveLength(1);
    expect(table.all[0]).toBe(source);
    expect(() => defineSources([source, { ...source, note: '違う説明' }])).toThrow('同じ ID で中身が違う');
    expect(() => uniqueSources([source], [{ ...source, title: '違う題' }])).toThrow('同じ ID で中身が違う');
  });
  test('ID からリンクを作り、短い題だけの上書きでも URL は表から取る', () => {
    const table = defineSources([source, { id: 'link', title: '公式リンク', url: 'https://example.com/link' }]);
    expect(table.sources).toEqual([source]);
    expect(table.docs(['spec', 'link', { id: 'spec', title: '短い題' }])).toEqual([
      { title: '作成者（2026）仕様', url: source.url },
      { title: '公式リンク', url: 'https://example.com/link' },
      { title: '短い題', url: source.url },
    ]);
    expect(() => table.docs(['missing'])).toThrow('出典が無い: missing');
    expect(() => defineSources([{ id: 'partial', title: '見本', url: source.url, checked: source.checked }])).toThrow(
      '出典の説明が欠けている',
    );
  });
});

describe('ゴールと図', () => {
  test('at と pop を補い、明示した at と別の効果音は保つ', () => {
    const scene = goals({
      kind: 'goals',
      items: ['最初', { text: '次', at: 'answer' }],
      lines: [{ t: 'はじめ' }, { t: '最初' }, { t: '次', sfx: 'tick' }],
    });
    expect(scene.items).toEqual([
      { text: '最初', at: 1 },
      { text: '次', at: 'answer' },
    ]);
    expect(scene.lines.map((line) => line.sfx)).toEqual([undefined, 'pop', 'tick']);
  });
  test('pop を足さない場面も、元の台詞と効果音を保つ', () => {
    const lines = [{ t: 'はじめ' }, { t: '本文' }];
    const scene = goals({ kind: 'goals', pop: false, items: ['本文'], lines });
    expect(scene.lines).toEqual(lines);
    expect(scene).not.toHaveProperty('pop');
  });
});

describe('共通の配役とリンク', () => {
  test('1 講座の配役を変えても、別の講座に伝わらない', () => {
    const first = comedyCast();
    const second = comedyCast();
    first.narrator!.name = '別の先生';
    expect(second.narrator?.name).toBe('先生');
    expect(comedyCast({ narrator: { name: '講師', tone: 'cyan' } }).narrator).toEqual({ name: '講師', tone: 'cyan' });
  });
  test('講座の参照は公開先から URL にし、外の URL は保つ', () => {
    expect(
      courseLinks([
        { course: 'nudge-product', label: '教材' },
        { url: 'https://example.com/', label: '公式' },
      ]),
    ).toEqual([
      { label: '教材', url: new URL('nudge-product/', config.origin).href },
      { label: '公式', url: 'https://example.com/' },
    ]);
    expect(() => courseLinks([{ course: '../other', label: '見本' }])).toThrow('ID が読めない');
  });
  test('台本の ThemeId は、テーマの表から書き出したものを使う', () => {
    expect<readonly string[]>(THEME_IDS).toEqual(Object.keys(THEMES));
  });
});

// 型の検証。エラーが出なくなったら tsc が止まる。実行時には呼ばない。
const checkTypes = () => {
  const table = defineSources([{ id: 'one', title: '見本', url: 'https://example.com/' }]);
  // @ts-expect-error 表に無い ID
  table.docs(['missing']);
  const nodes = [
    { key: 'start' as const, label: '前', x: 0, y: 0, tone: 'mint' as const, at: 0 },
    { key: 'end' as const, label: '後', x: 1, y: 0, tone: 'mint' as const, at: 1 },
  ];
  flow({ kind: 'flow', nodes, edges: [{ from: 'start', to: 'end', at: 1 }], lines: [] });
  flow({
    kind: 'flow',
    nodes,
    lines: [],
    edges: [
      // @ts-expect-error 矢印の文字から、ノードの key を広げない
      { from: 'missing', to: 'end', at: 1 },
    ],
  });
  flow({
    kind: 'flow',
    nodes,
    lines: [],
    edges: [],
    focus: [
      // @ts-expect-error focus もノードの key から選ぶ
      { keys: ['missing'], at: 1 },
    ],
  });
};
void checkTypes;
