// 新しい講座の登録で、既存の動画や訳を隠さず、同じ一覧から引けることを確かめる。
import { describe, expect, test } from 'bun:test';
import { createCatalog } from '../../engine/core/catalog';
import type { CourseModule } from '../../engine/core/course-module';
import type { CourseL10n } from '../../engine/core/i18n';
import type { AuthoredLecture } from '../../engine/core/schema';
import { required } from '../support/required';

const lecture = (id: string): AuthoredLecture => ({
  id,
  no: 1,
  section: { no: 1, title: 'はじめに' },
  title: '見本',
  summary: '登録の見本',
  docs: [],
  quiz: [],
  takeaways: [],
  scenes: [{ kind: 'opening', title: '見本', lines: [{ t: 'はじめます。' }] }],
});

const moduleOf = (id: string, lectureIds: string[], order = 10): CourseModule => ({
  course: {
    id,
    prefix: lectureIds[0]?.[0] ?? 'X',
    order,
    title: '登録の見本',
    subtitle: '見本',
    headline: '見本',
    sections: [{ no: 1, title: 'はじめに' }],
    lectures: lectureIds.map(lecture),
    docsNote: '試験用',
    sourceNote: '試験用',
  },
});

const translation = (id: string): CourseL10n => ({
  title: 'Example',
  subtitle: 'Example',
  headline: 'Example',
  sections: [{ title: 'Introduction' }],
  docsNote: 'Example',
  sourceNote: 'Example',
  lectures: {
    [id]: {
      source: '',
      title: 'Example',
      summary: 'Example',
      quiz: [],
      takeaways: [],
      scenes: [{ kind: 'opening', title: 'Example', lines: [{ t: 'Let us begin.' }] }],
    },
  },
});

describe('講座と動画の索引', () => {
  test('講座の並びとレクチャーの順を保ち、一覧そのもののオブジェクトを引く', () => {
    const registry = [moduleOf('later', ['Z01'], 20), moduleOf('beta', ['B01']), moduleOf('alpha', ['A02', 'A01'])];
    const catalog = createCatalog(registry);
    expect(registry.map((m) => m.course.id)).toEqual(['later', 'beta', 'alpha']);
    expect(catalog.COURSES.map((c) => c.id)).toEqual(['alpha', 'beta', 'later']);
    expect(catalog.LECTURES.map((l) => l.id)).toEqual(['A02', 'A01', 'B01', 'Z01']);
    for (const course of catalog.COURSES)
      for (const l of course.lectures) {
        expect(catalog.courseOf(l.id)).toBe(course);
        expect(catalog.videoOf(l.id).lecture).toBe(l);
        expect(catalog.videoOf(l.id).course).toBe(course);
      }
    expect(catalog.coursesIn('ja')).toBe(catalog.COURSES);
    expect(catalog.SHARED_LINES).toEqual([]);
  });

  test('講座 ID の重複は、別の動画 ID でも訳の表を作る前に止める', () => {
    expect(() => createCatalog([moduleOf('same-course', ['A01']), moduleOf('same-course', ['B01'])])).toThrow(
      '講座 ID が重なっている: same-course',
    );
  });

  test('同じ講座内と講座をまたぐレクチャー ID の重複を止める', () => {
    expect(() => createCatalog([moduleOf('one-course', ['A01', 'A01'])])).toThrow(
      'レクチャー ID が講座をまたいで重なっている: A01',
    );
    expect(() => createCatalog([moduleOf('one-course', ['A01']), moduleOf('other-course', ['A01'])])).toThrow(
      'レクチャー ID が講座をまたいで重なっている: A01',
    );
  });

  test('訳のある動画だけを引き、繰り返しても同じ訳の一覧を返す', () => {
    const module = moduleOf('one-course', ['A01', 'A02']);
    module.translations = { en: translation('A01') };
    const catalog = createCatalog([module]);
    expect(catalog.VIDEOS.map((v) => v.key)).toEqual(['A01', 'A02', 'A01.en']);
    expect(catalog.videoOf('A01.en')).toBe(required(catalog.VIDEOS[2]));
    expect(catalog.videoOf('A01.en').course).toBe(required(catalog.coursesIn('en')[0]));
    expect(catalog.coursesIn('en')).toBe(catalog.coursesIn('en'));
    expect(catalog.coursesIn('zh')).toEqual([]);
    expect(() => catalog.videoOf('A02.en')).toThrow('A02 の en の訳が無い');
    expect(() => catalog.videoOf('A01.fr')).toThrow('動画の名前が読めない');
  });

  test('空の登録と見つからない ID は、既存の呼び方のまま扱う', () => {
    const catalog = createCatalog([]);
    expect(catalog.COURSES).toEqual([]);
    expect(catalog.VIDEOS).toEqual([]);
    expect(() => catalog.courseOf('X01')).toThrow('どの講座にも無いレクチャー: X01');
    expect(() => catalog.videoOf('X01')).toThrow('どの講座にも無いレクチャー');
  });
});
