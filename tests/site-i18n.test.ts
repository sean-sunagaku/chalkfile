// 講座サイトの決まった文字（site/i18n/<言語>.ts）と、言語の一覧（content/langs.ts）から作る言語のフォルダの形。
//   - 全部の言語が、日本語と同じキーを持つ（網羅）。数で形の変わる文字は、その言語の Intl.PluralRules が選ぶ形を全部書く
//   - 差し込み（{name}）の名前が、日本語と同じ組（数で形の変わる文字は、日本語の名前の中から）
//   - 使われていないキーが無い（表ごとに、読むファイルのどこかで使う）
//   - 差し込みの名前の取り違えと、訳の表の足りないキーは、型のエラーになる（@ts-expect-error。npm run typecheck が見る）
import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { THEMES } from '../content/themes';
import { FOLDER_PATTERN, isLangFolder, LANG_INFO, LANG_PATTERN, LANGS, TRANSLATED_LANGS } from '../content/langs';
import { type CourseTextBase, courseText, LOCALES } from '../site/i18n';
import { defineLocale } from '../site/i18n/define';
import type { ja } from '../site/i18n/ja';
import { fill, type Plural, plural, texts } from '../site/lib/text';
import { parseMediaPath } from '../site/media-shared';
import { COURSE_ID } from '../site/offline-shared';

const ROOT = path.resolve(import.meta.dir, '..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');

type Tree = { readonly [k: string]: string | Tree };
const isPlural = (v: unknown): v is Plural =>
  typeof v === 'object' && v !== null && typeof (v as { other?: unknown }).other === 'string';
/** 表の中の、文字と数で形の変わる文字の場所（a.b.c）と値 */
const leaves = (t: Tree, at = ''): [string, string | Plural][] =>
  Object.entries(t).flatMap(([k, v]): [string, string | Plural][] => {
    const where = at ? `${at}.${k}` : k;
    return typeof v === 'string' || isPlural(v) ? [[where, v]] : leaves(v as Tree, where);
  });
/** 文字の差し込みの名前（並べて、重ねない） */
const varsOf = (s: string) => [...new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();
const pluralForms = (p: Plural) => Object.entries(p) as [Intl.LDMLPluralRule, string][];

describe('全部の言語の網羅', () => {
  const base = new Map(leaves(LOCALES.ja as unknown as Tree));
  test('LOCALES に、言語の一覧（content/langs.ts）の全部の言語がある', () => {
    expect(Object.keys(LOCALES).sort()).toEqual([...LANGS].sort());
  });
  for (const lang of TRANSLATED_LANGS) {
    test(`${lang}: 日本語と同じ場所に、文字と数で形の変わる文字がある（足りない・余ったものが無い）`, () => {
      const here = new Map(leaves(LOCALES[lang] as unknown as Tree));
      expect([...here.keys()].sort()).toEqual([...base.keys()].sort());
      for (const [where, v] of here) expect(`${where} ${isPlural(v)}`).toBe(`${where} ${isPlural(base.get(where))}`);
    });
  }
  for (const lang of LANGS) {
    test(`${lang}: 数で形の変わる文字は、その言語の Intl.PluralRules が選ぶ形を全部書き、ほかの形を書かない`, () => {
      const categories = [...new Intl.PluralRules(LANG_INFO[lang].html).resolvedOptions().pluralCategories].sort();
      for (const [where, v] of leaves(LOCALES[lang] as unknown as Tree)) {
        if (!isPlural(v)) continue;
        expect(`${where} ${Object.keys(v).sort().join(',')}`).toBe(`${where} ${categories.join(',')}`);
      }
    });
  }
  test('テーマの紹介文は、全部の言語に全部のテーマの分がある（日本語はテーマの summary）', () => {
    for (const lang of LANGS) expect(Object.keys(LOCALES[lang].themes).sort()).toEqual(Object.keys(THEMES).sort());
    for (const t of Object.values(THEMES))
      expect(LOCALES.ja.themes[t.id as keyof typeof LOCALES.ja.themes]).toBe(t.summary);
  });
  test('Service Worker の保存機能のエラーは、エラーの種類（site/offline-shared.ts の OfflineErrorCode）を全部書く', () => {
    const src = read('site/offline-shared.ts');
    const union = src.slice(
      src.indexOf('export type OfflineErrorCode ='),
      src.indexOf(';', src.indexOf('export type OfflineErrorCode =')),
    );
    const codes = [...union.matchAll(/'(\w+)'/g)].map((m) => m[1]).sort();
    expect(codes.length).toBeGreaterThan(20);
    for (const lang of LANGS) expect(Object.keys(LOCALES[lang].sw.errors).sort()).toEqual(codes);
  });
  test('空の文字は、日本語で空のものだけ（日本語の一覧のページの「ほかの講座」の見出しなど）', () => {
    for (const lang of TRANSLATED_LANGS) {
      for (const [where, v] of leaves(LOCALES[lang] as unknown as Tree)) {
        const empty = typeof v === 'string' ? v.trim() === '' : pluralForms(v).some(([, s]) => s.trim() === '');
        if (empty) expect(`${lang} ${where} ${empty}`).toBe(`${lang} ${where} ${base.get(where) === ''}`);
      }
    }
  });
});

describe('差し込み（{name}）の名前の一致', () => {
  const base = new Map(leaves(LOCALES.ja as unknown as Tree));
  for (const lang of TRANSLATED_LANGS) {
    test(`${lang}: 文字の差し込みの名前は日本語と同じ組。数で形の変わる文字は other が同じ組、ほかの形は日本語の名前の中から`, () => {
      for (const [where, v] of leaves(LOCALES[lang] as unknown as Tree)) {
        const ja = base.get(where);
        if (typeof v === 'string' && typeof ja === 'string') {
          expect(`${where} ${varsOf(v)}`).toBe(`${where} ${varsOf(ja)}`);
        } else if (isPlural(v) && isPlural(ja)) {
          const names = new Set(pluralForms(ja).flatMap(([, s]) => varsOf(s)));
          expect(`${where} ${varsOf(v.other)}`).toBe(`${where} ${varsOf(ja.other)}`);
          for (const [form, s] of pluralForms(v))
            for (const n of varsOf(s))
              expect(`${where}.${form} ${n} ${names.has(n)}`).toBe(`${where}.${form} ${n} true`);
        }
      }
    });
  }
});

describe('使われていないキー', () => {
  /** 表ごとに、その文字を読むファイル */
  const READERS: Record<string, string[]> = {
    common: ['site/template.html', 'site/home.html', 'site/course-page.ts', 'site/page', 'scripts/site'],
    course: [
      'site/template.html',
      'site/course-page.ts',
      'site/page',
      'scripts/site/render-course.ts',
      'scripts/site/model.ts',
    ],
    home: ['site/home.html', 'scripts/site/render-home.ts'],
    panel: ['site/offline-panel.html'],
    client: ['site/offline-client.ts', 'site/offline-panel.html'],
    offlinePage: ['site/offline.html'],
    notFound: ['scripts/site/headers.ts'],
    app: ['scripts/pwa.ts'],
    sw: ['site/sw.ts'],
  };
  const sources = (list: string[]) =>
    list
      .flatMap((f) =>
        f.endsWith('.ts') || f.endsWith('.html')
          ? [f]
          : readdirSync(path.join(ROOT, f))
              .filter((n) => n.endsWith('.ts') || n.endsWith('.html'))
              .map((n) => `${f}/${n}`),
      )
      .map(read)
      .join('\n');
  /**
   * 文字の使い方: テンプレートの {{key}}・{{表.key}}（{{evidence.research}}・{{ja.title}}）、'key'（tt('key')・tn('key')・キーを選ぶ式）、
   * .key（T.key・表を開いて読む LOCALES.ja.app.description など）、中の表を丸ごと読む（T.evidence）
   */
  const usedIn = (text: string, where: string) => {
    const parts = where.split('.');
    const key = parts.at(-1) ?? where;
    return (
      new RegExp(`\\{\\{(?:\\w+\\.)?${parts.join('\\.')}\\}\\}`).test(text) ||
      new RegExp(`'${key}'|\\.${key}\\b`).test(text) ||
      (parts.length > 1 && new RegExp(`\\.${parts[0]}\\b`).test(text))
    );
  };
  for (const [section, files] of Object.entries(READERS)) {
    test(`${section}: どのキーも、読むファイル（${files.join('・')}）で使う`, () => {
      const text = sources(files);
      const table = (LOCALES.ja as unknown as Record<string, Tree>)[section];
      const unused = leaves(table)
        .map(([where]) => where)
        // 保存機能のエラーは、エラーの種類（e.code）で引く（全部があることは、上の網羅のテストが見る）
        .filter((where) => !(section === 'sw' && where.startsWith('errors.')))
        .filter((where) => !usedIn(text, where));
      expect(unused).toEqual([]);
    });
  }
});

describe('差し込みと数の形の部品（site/lib/text.ts）', () => {
  test('plural は、その言語の Intl.PluralRules で形を選び、{n} に数を入れる（無い形は other）', () => {
    const p: Plural = { one: '{n} lecture', other: '{n} lectures' };
    expect([0, 1, 2].map((n) => plural(p, n, 'en'))).toEqual(['0 lectures', '1 lecture', '2 lectures']);
    expect([1, 2].map((n) => plural({ other: '{n} レクチャー' }, n, 'ja'))).toEqual(['1 レクチャー', '2 レクチャー']);
    expect(plural({ other: '{n} 讲' }, 1, 'zh-Hans')).toBe('1 讲');
    expect(plural({ other: '{n} / {total}' }, 3, 'ja', { total: 9 })).toBe('3 / 9');
  });
  test('講座のページの本数と長さの文字は、日本語では多言語にする前と同じ（英語は 1 本のとき単数）', () => {
    const page = (lang: 'ja' | 'en') => texts<CourseTextBase>(courseText(lang), LANG_INFO[lang].html);
    const ja = page('ja');
    expect(
      ja.tt('curSum', {
        count: ja.tn('lectureCount', 8),
        min: 60,
        plan: ja.tt('planned', { count: ja.tn('lectureCount', 10) }),
      }),
    ).toBe('8 レクチャー・60 分（計画 10 レクチャー）');
    expect(
      ja.tt('courseMeta', { sections: ja.tn('sectionCount', 3), count: ja.tn('chapterCount', 1), min: 5, plan: '' }),
    ).toBe('3 セクション・1 章・約 5 分');
    const en = page('en');
    expect(
      en.tt('courseMeta', { sections: en.tn('sectionCount', 1), count: en.tn('lectureCount', 1), min: 5, plan: '' }),
    ).toBe('1 section · 1 lecture · about 5 min');
    expect(en.tn('chapterCount', 6)).toBe('6 chapters');
  });
  test('差し込みの名前が違うと型のエラーになる（npm run typecheck が見る。ここは型の確かめの見本）', () => {
    const { tt, tn } = texts<CourseTextBase>(courseText('ja'), 'ja');
    // @ts-expect-error 差し込みの名前が違う（cpLabel は done と total）
    expect(tt('cpLabel', { done: 1, all: 2 })).toBe('1 / {total} 完了');
    // @ts-expect-error 差し込みのある文字に、値を渡していない
    expect(tt('nextIn')).toBe('{n} 秒後に再生');
    // @ts-expect-error 数で形の変わる文字は tn で引く（文字ではないので、引くと止まる）
    expect(() => tt('lectureCount')).toThrow();
    expect(tn('lectureCount', 2)).toBe('2 レクチャー');
    expect(fill('{a}{b}', { a: 1 })).toBe('1{b}');
  });
  test('訳の表は、日本語と同じ形でないと型のエラーになる（defineLocale。ここは型の確かめの見本）', () => {
    type Mini = { readonly a: '{n} 本'; readonly b: 'こんにちは'; readonly c: { readonly other: '{n} 章' } };
    const ok = defineLocale<Mini>()({ a: '{n} videos', b: 'Hello', c: { one: '{n} chapter', other: '{n} chapters' } });
    // @ts-expect-error 差し込みの名前が日本語と違う
    defineLocale<Mini>()({ a: '{m} videos', b: 'Hello', c: { other: '{n} chapters' } });
    // @ts-expect-error 日本語にあるキーが足りない
    defineLocale<Mini>()({ a: '{n} videos', c: { other: '{n} chapters' } });
    // @ts-expect-error 日本語に無いキーを足した
    defineLocale<Mini>()({ a: '{n} videos', b: 'Hello', c: { other: '{n} chapters' }, d: 'extra' });
    expect(ok.a).toBe('{n} videos');
    const full: typeof ja = LOCALES.ja as typeof ja;
    expect(full.common.lectureCount.other).toBe('{n} レクチャー');
  });
});

describe('言語のフォルダの形（言語の一覧から 1 か所で作る）', () => {
  const hash = 'a'.repeat(64);
  test('訳の言語のフォルダは、言語の名前と同じ（サイトの URL の頭・保存の講座の ID の頭・動画の名前の終わり）', () => {
    for (const lang of TRANSLATED_LANGS) expect(LANG_INFO[lang].path).toBe(`${lang}/`);
    expect(LANG_INFO.ja.path).toBe('');
    expect(FOLDER_PATTERN).toBe(`(?:${TRANSLATED_LANGS.join('|')})`);
    expect(LANG_PATTERN).toBe(`(?:${LANGS.join('|')})`);
  });
  test('保存の講座の ID・動画の配るパス・言語のフォルダの確かめは、一覧にある言語だけを通す', () => {
    for (const lang of TRANSLATED_LANGS) {
      expect(COURSE_ID.test(`${lang}/sample`)).toBe(true);
      expect(isLangFolder(lang)).toBe(true);
    }
    for (const lang of LANGS) expect(parseMediaPath(`/media/${lang}/sample/S01.${hash}.mp4`)?.lang).toBe(lang);
    // 一覧に無い言語（いつか足す言語の形も）は、どれも通さない
    for (const other of ['fr', 'pt-BR', 'ja']) {
      expect(COURSE_ID.test(`${other}/sample`)).toBe(false);
      expect(isLangFolder(other)).toBe(false);
    }
    for (const other of ['fr', 'pt-BR']) expect(parseMediaPath(`/media/${other}/sample/S01.${hash}.mp4`)).toBeNull();
  });
});
