import { describe, expect, test } from 'bun:test';
import { localizeCourse, localizeLecture, untranslated, type CourseL10n, type LectureL10n } from '../content/i18n';
import type { ConceptsScene, Course, Lecture } from '../content/types';

// 訳の重ね方（content/i18n.ts）。日本語の台本に、訳の上書きを重ねる
const cards: ConceptsScene['cards'] = [
  { key: 'scene', en: 'Scene', ja: '場面', desc: '画面の 1 まとまり', tone: 'violet', icon: 'layout', at: 0 },
  { key: 'line', en: 'Line', ja: '台詞', desc: '声と字幕の 1 文', tone: 'pink', icon: 'message', at: 1 },
];
const base = (patch: Partial<Lecture> = {}): Lecture => ({
  id: 'X01',
  no: 1,
  section: { no: 1, title: 'はじめに' },
  title: '見本',
  summary: '訳の重ね方の見本',
  docs: [{ title: '説明', url: 'https://example.com' }],
  quiz: [{ q: '問い', choices: ['あ', 'い'], answer: 1, explain: '理由' }],
  takeaways: ['要点'],
  scenes: [{ kind: 'concepts', heading: '言葉', cards, lines: [{ t: '場面です。' }, { t: '台詞です。' }] }],
  ...patch,
});
const course = (lectures: Lecture[] = [base()]): Course => ({
  id: 'sample',
  prefix: 'X',
  order: 1,
  title: '見本の講座',
  subtitle: '副題',
  headline: '見出し',
  sections: [{ no: 1, title: 'はじめに' }],
  lectures,
  docsNote: '前置き',
  sourceNote: 'もと',
});
type ConceptsL10n = Extract<LectureL10n['scenes'][number], { kind: 'concepts' }>;
const scene = (patch: Partial<ConceptsL10n> = {}): ConceptsL10n => ({
  kind: 'concepts',
  heading: 'Words',
  cards: [{ ja: 'Scene', desc: 'One block of the screen' }, { ja: 'Line', desc: 'One sentence of voice and captions' }],
  lines: [{ t: 'This is a scene.' }, { t: 'This is a line.' }],
  ...patch,
});
const tr = (patch: Partial<LectureL10n> = {}): LectureL10n => ({
  source: '',
  title: 'Sample',
  summary: 'A sample of layering',
  docs: [{ title: 'Docs' }],
  quiz: [{ q: 'Question', choices: ['A', 'B'], explain: 'Why' }],
  takeaways: ['Point'],
  scenes: [scene()],
  ...patch,
});
const localize = (lec: Lecture, l10n: LectureL10n) => localizeLecture(lec, l10n, 'en', course([lec]));
const first = (lec: Lecture) => lec.scenes[0] as ConceptsScene;

describe('訳の重ね方（content/i18n.ts）', () => {
  test('画面の文字は上書きし、色・アイコン・key・at は日本語の台本のまま', () => {
    const out = localize(base(), tr());
    expect(first(out).cards[0]).toEqual({ key: 'scene', en: 'Scene', ja: 'Scene', desc: 'One block of the screen', tone: 'violet', icon: 'layout', at: 0 });
    expect(out.title).toBe('Sample');
    expect(out.quiz[0]).toEqual({ q: 'Question', choices: ['A', 'B'], answer: 1, explain: 'Why' });
    expect(out.docs[0]).toEqual({ title: 'Docs', url: 'https://example.com' });
    expect(out.material).toBeUndefined();
  });
  test('並べ替え: 日本語の項目を並べ替えると、訳の文字は位置のまま付く（key で重ねるのは計画の T3A-11）', () => {
    const reordered = base({ scenes: [{ kind: 'concepts', heading: '言葉', cards: [cards[1], cards[0]], lines: [{ t: '台詞です。' }, { t: '場面です。' }] }] });
    expect(first(localize(reordered, tr())).cards.map((c) => `${c.key}:${c.ja}`)).toEqual(['line:Scene', 'scene:Line']);
  });
  test('数の違い: 配列の数が日本語の台本と違うと止まる', () => {
    expect(() => localize(base(), tr({ scenes: [scene({ cards: [{ ja: 'Scene' }] })] }))).toThrow('日本語の台本と数が合わない（台本 2・訳 1）');
  });
  test('台詞は丸ごと置き換わり、数が変わってよい（そのときは at も書く）', () => {
    const lines = [{ t: 'One.' }, { t: 'Two.' }, { t: 'Three.' }];
    const out = localize(base(), tr({ scenes: [scene({ lines, cards: [{ ja: 'Scene', at: 0 }, { ja: 'Line', at: 2 }] })] }));
    expect(out.scenes[0].lines).toEqual(lines);
    expect(first(out).cards.map((c) => c.at)).toEqual([0, 2]);
  });
  test('at の書き忘れ: 台詞の数が違う場面で at を書かないと、どの項目かを挙げて止まる', () => {
    const l10n = tr({ scenes: [scene({ lines: [{ t: 'One.' }, { t: 'Two.' }, { t: 'Three.' }] })] });
    expect(() => localize(base(), l10n)).toThrow('場面 1.cards[0].at');
  });
  test('重ねたあとの at が、訳の台詞の範囲の外だと止まる', () => {
    const l10n = tr({ scenes: [scene({ lines: [{ t: 'Only one.' }], cards: [{ ja: 'Scene', at: 0 }, { ja: 'Line', at: 2 }] })] });
    expect(() => localize(base(), l10n)).toThrow('at=2（台詞は 1）');
  });
  test('場面の数・種類が違うか、台詞が空だと止まる', () => {
    expect(() => localize(base(), tr({ scenes: [] }))).toThrow('場面の数が日本語の台本と合わない');
    expect(() => localize(base(), tr({ scenes: [{ kind: 'big', text: 'Big', lines: [{ t: 'Big.' }] }] }))).toThrow('種類が日本語の台本と違う');
    expect(() => localize(base(), tr({ scenes: [scene({ lines: [] })] }))).toThrow('台詞が無い');
  });
  test('日本語の台本に注意書きがあれば、訳にも書く', () => {
    expect(() => localize(base({ caution: '注意' }), tr())).toThrow('注意書き（caution）');
    expect(localize(base({ caution: '注意' }), tr({ caution: 'Note' })).caution).toBe('Note');
  });
});

describe('講座の訳（content/i18n.ts の localizeCourse）', () => {
  const courseTr = (patch: Partial<CourseL10n> = {}): CourseL10n => ({
    title: 'Sample course',
    subtitle: 'Subtitle',
    headline: 'Headline',
    sections: [{ title: 'Introduction' }],
    docsNote: 'Note',
    sourceNote: 'Source',
    lectures: { X01: tr() },
    ...patch,
  });
  test('セクションの題は講座の訳から取り、訳の無いレクチャーは出さない', () => {
    const out = localizeCourse(course([base(), base({ id: 'X02', no: 2 })]), courseTr(), 'en');
    expect(out.lang).toBe('en');
    expect(out.lectures.map((l) => l.id)).toEqual(['X01']);
    expect(out.lectures[0].section).toEqual({ no: 1, title: 'Introduction' });
    expect(out.syllabus).toBeUndefined();
  });
  test('日本語に無いレクチャーの訳と、セクションの数の違いは止まる', () => {
    expect(() => localizeCourse(course(), courseTr({ lectures: { X01: tr(), X09: tr() } }), 'en')).toThrow('日本語の講座に無いレクチャーの訳: X09');
    expect(() => localizeCourse(course(), courseTr({ sections: [] }), 'en')).toThrow('セクションの数が合わない');
  });
  test('訳し残し: 英語の講座に残った日本語の文字を見つける', () => {
    const left = localizeCourse(course(), courseTr({ lectures: { X01: tr({ title: '見本のまま' }) } }), 'en');
    expect(untranslated(left, 'en')).toEqual(['sample.en/X01.title: 見本のまま']);
    expect(untranslated(localizeCourse(course(), courseTr(), 'en'), 'en')).toEqual([]);
  });
});
