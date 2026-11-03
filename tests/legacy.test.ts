import { describe, expect, test } from 'bun:test';
import { VIDEOS } from '../content';
import type { Scene } from '../content/types';
import { legacyUses, upgradeLecture, upgradeScene } from '../engine/core/legacy';
import { validateLecture } from '../engine/core/validate';
import { course, lecture, say, W } from './fixtures/content/invalid/_base';

const lines = say('一つ目です。', '二つ目です。');

/** 古い書き方（中身の文字を見て描き分けていた）と、同じ見た目を明示の項目で書いたもの */
const PAIRS: { name: string; old: Scene; explicit: Scene; where: string }[] = [
  {
    name: 'opening: title を全角の空白で 2 行に分ける → titleLines',
    old: { kind: 'opening', title: '基本の　考え方', lines },
    explicit: { kind: 'opening', title: '基本の　考え方', titleLines: ['基本の', '考え方'], lines },
    where: 'opening.title',
  },
  {
    name: 'opening: 改行で分ける → titleLines',
    old: { kind: 'opening', title: 'First line\nSecond line', lines },
    explicit: { kind: 'opening', title: 'First line\nSecond line', titleLines: ['First line', 'Second line'], lines },
    where: 'opening.title',
  },
  {
    name: "states: key が start の箱 → variant: 'start'",
    old: {
      kind: 'states',
      nodes: [{ key: 'start', code: 'はじめ', ja: '作る前', x: 400, y: 600, tone: 'slate', at: 0 }],
      edges: [],
      lines,
    },
    explicit: {
      kind: 'states',
      nodes: [{ key: 'start', code: 'はじめ', ja: '作る前', x: 400, y: 600, tone: 'slate', at: 0, variant: 'start' }],
      edges: [],
      lines,
    },
    where: 'states.nodes[0].key',
  },
  {
    name: 'sequence: sub に / がある → subMono: true',
    old: {
      kind: 'sequence',
      actors: [{ key: 'app', label: 'アプリ', sub: 'POST /sync', tone: 'violet', icon: 'server' }],
      steps: [],
      lines,
    },
    explicit: {
      kind: 'sequence',
      actors: [{ key: 'app', label: 'アプリ', sub: 'POST /sync', subMono: true, tone: 'violet', icon: 'server' }],
      steps: [],
      lines,
    },
    where: 'sequence.actors[0].sub',
  },
  {
    name: 'phone: lead が ? で始まる → leadMono: true',
    old: {
      kind: 'phone',
      screens: [
        { at: 0, title: '画面', kind: 'app', brand: 'サンプル家計簿', lead: '?id=1', body: [], caption: '開く' },
      ],
      lines,
    },
    explicit: {
      kind: 'phone',
      screens: [
        {
          at: 0,
          title: '画面',
          kind: 'app',
          brand: 'サンプル家計簿',
          lead: '?id=1',
          leadMono: true,
          body: [],
          caption: '開く',
        },
      ],
      lines,
    },
    where: 'phone.screens[0].lead',
  },
  {
    name: 'timeline: title を全角の空白で札と題に分ける → kicker と title（3 つ目より後は、前から出していない）',
    old: {
      kind: 'timeline',
      items: [{ key: 'a', title: 'STEP 1　書く　台本', sub: '1 日目', at: 0, tone: 'cyan' }],
      lines,
    },
    explicit: {
      kind: 'timeline',
      items: [{ key: 'a', kicker: 'STEP 1', title: '書く', sub: '1 日目', at: 0, tone: 'cyan' }],
      lines,
    },
    where: 'timeline.items[0].title',
  },
];

describe('古い書き方の読み替え（engine/core/legacy.ts）', () => {
  for (const p of PAIRS) {
    test(`${p.name}: 読み替えると、明示の項目で書いた場面と同じになる`, () =>
      expect(upgradeScene(p.old)).toEqual(p.explicit));
    test(`${p.name}: 古い書き方の場所を出し、明示の項目で書いた場面には出さない`, () => {
      expect(legacyUses(p.old).map((u) => u.path)).toEqual([p.where]);
      expect(legacyUses(p.explicit)).toEqual([]);
    });
  }
  test('明示の項目で書いた場面と、古い書き方を使っていない場面は、同じものをそのまま返す', () => {
    for (const { explicit } of PAIRS) expect(upgradeScene(explicit)).toBe(explicit);
    const plain: Scene = { kind: 'opening', title: '一行の題', lines };
    expect(upgradeScene(plain)).toBe(plain);
  });
  test('明示の項目で「古い決まりを使わない」と書ける（/ があっても等幅にしない・key が start でも状態の見た目）', () => {
    const seq: Scene = {
      kind: 'sequence',
      actors: [{ key: 'a', label: 'A', sub: '請求書 / 領収書', subMono: false, tone: 'pink', icon: 'file' }],
      steps: [],
      lines,
    };
    const st: Scene = {
      kind: 'states',
      nodes: [{ key: 'start', code: 'start', ja: '始まり', x: 0, y: 0, tone: 'slate', at: 0, variant: 'state' }],
      edges: [],
      lines,
    };
    for (const s of [seq, st]) {
      expect(upgradeScene(s)).toBe(s);
      expect(legacyUses(s)).toEqual([]);
    }
  });
  test('書き換え方を、そのまま写せる形で出す', () => {
    const [opening, , , , , timeline] = PAIRS.map((p) => legacyUses(p.old)[0].message);
    expect(opening).toContain("titleLines: ['基本の', '考え方']");
    expect(timeline).toContain("kicker: 'STEP 1', title: '書く'");
  });
  test('台本の検証が、古い書き方に注意（legacy）を出す。誤りにはしない', () => {
    const lec = lecture(PAIRS.map((p) => ({ ...p.old, heading: '見出し' }) as Scene));
    const got = validateLecture(lec, course([lec])).filter((x) => x.rule === 'legacy');
    expect(got.map((x) => `${x.level} ${x.where}`)).toEqual(
      PAIRS.map((p, i) => `warning ${W} 場面 ${i + 1} ${p.where}`),
    );
  });
  test('動画 1 本を読み替える（同じ動画なら前に作ったもの。古い書き方が無ければ、同じ動画をそのまま返す）', () => {
    const lec = lecture([PAIRS[0].old, { kind: 'big', text: '大事', lines }]);
    const up = upgradeLecture(lec);
    expect(up).not.toBe(lec);
    expect(up.scenes[0]).toEqual(PAIRS[0].explicit);
    expect(up.scenes[1]).toBe(lec.scenes[1]);
    expect(upgradeLecture(lec)).toBe(up);
    const plain = lecture([{ kind: 'big', text: '大事', lines }]);
    expect(upgradeLecture(plain)).toBe(plain);
  });
  test('今の台本は、読み替えても場面の数と種類が変わらない（台本のファイルは書き換えない）', () => {
    for (const v of VIDEOS) {
      const up = upgradeLecture(v.lecture);
      expect(up.scenes.map((s) => s.kind)).toEqual(v.lecture.scenes.map((s) => s.kind));
    }
  });
});
