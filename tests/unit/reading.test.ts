// 読みの辞書（content/reading.ts の共通の辞書と、content/<講座>/reading.ts の講座の辞書）。講座の辞書は、その講座の台詞にだけ効く
import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { COURSES, SHARED_LINES } from '../../content';
import * as REGISTRY from '../../content/courses';
import type { CourseModule } from '../../content/course-module';
import { readingOf, toSpeech, useReading, type Reading } from '../../content/reading';
import type { Line } from '../../content/types';
import { speechOf } from '../../content/voices';

const MODULES = Object.values(REGISTRY) as CourseModule[];
const ROOT = path.resolve(import.meta.dir, '../..');

/** 講座ごとの、日本語の全部の台詞 */
const linesOf = (courseId: string): Line[] =>
  COURSES.find((c) => c.id === courseId)?.lectures.flatMap((l) => l.scenes.flatMap((s) => s.lines)) ?? [];

describe('読みの辞書を講座ごとに分ける', () => {
  test('どの講座の台詞にも、その講座の辞書が付いている（講座をまたいで同じ台詞のオブジェクトを使っていない）', () => {
    expect(SHARED_LINES).toEqual([]);
    const seen = new Set<Reading>();
    for (const m of MODULES) {
      const lines = linesOf(m.course.id);
      expect(lines.length).toBeGreaterThan(0);
      const readings = new Set(lines.map((l) => readingOf(l)));
      expect(readings.size).toBe(1);
      const [r] = readings;
      if (!r) throw new Error(`${m.course.id} の台詞に辞書が付いていない`);
      if (m.reading) expect(r).toBe(m.reading);
      // 辞書の無い講座にも、講座ごとに別の（空の）辞書が付く
      expect(seen.has(r)).toBe(false);
      seen.add(r);
    }
  });

  test('ある講座の読みを直しても、ほかの講座の読みは変わらない（「日本」を uiux-engineers の辞書だけで「にっぽん」にする）', () => {
    const now = new Map(COURSES.map((c) => [c.id, linesOf(c.id).map(speechOf)]));
    // 前に起きたこと: 「日本 → にほん」を全講座の共通の辞書に足したら、Stripe 講座の台詞の読みも変わった
    expect(now.get('stripe-billing')?.some((s) => s.includes('にほん'))).toBe(true);
    expect(now.get('uiux-engineers')?.some((s) => s.includes('にほん'))).toBe(true);
    const uiux = MODULES.find((m) => m.course.id === 'uiux-engineers');
    const fixed: Reading = { ...uiux?.reading, phrases: [['日本', 'にっぽん'], ...(uiux?.reading?.phrases ?? [])] };
    for (const c of COURSES) {
      const after = linesOf(c.id).map((l) => (c.id === 'uiux-engineers' ? toSpeech(l.s ?? l.t, fixed) : speechOf(l)));
      if (c.id === 'uiux-engineers') expect(after).not.toEqual(now.get(c.id));
      else expect(after).toEqual(now.get(c.id) ?? []);
    }
  });

  test('辞書を付けた台詞だけが、その辞書で読む（付け替えない。別の講座の辞書が付いた台詞は返す）', () => {
    const a: Reading = { words: { foo: 'フー' } };
    const b: Reading = { words: { foo: 'フォー' } };
    const lineA: Line = { t: 'foo です。' };
    const lineB: Line = { t: 'foo です。' };
    expect(useReading([lineA], a)).toEqual([]);
    expect(useReading([lineB], b)).toEqual([]);
    expect(speechOf(lineA)).toBe('フーです。');
    expect(speechOf(lineB)).toBe('フォーです。');
    expect(useReading([lineA], b)).toEqual([lineA]);
    expect(speechOf(lineA)).toBe('フーです。');
    // 辞書の付いていない台詞は、共通の辞書だけで読む（共通に無い英単語は止める）
    expect(() => speechOf({ t: 'foo です。' })).toThrow('読みが未登録の英単語: foo');
  });

  test('講座の辞書は共通の辞書より優先する（同じ語・同じ語句は講座の読み。語句は長いものから、同じ長さなら講座の語句から）', () => {
    expect(toSpeech('id と API')).toBe('アイディーとエーピーアイ');
    expect(toSpeech('id と API', { words: { id: 'イド' } })).toBe('イドとエーピーアイ');
    expect(toSpeech('日本の振り返り', { phrases: [['日本', 'ニホン']] })).toBe('ニホンのふりかえり');
    expect(toSpeech('日本の振り返り')).toBe('にほんのふりかえり');
    // 長い語句が先（講座の「振り返り会」は、共通の「振り返り」より先に当たる）
    expect(toSpeech('振り返り会', { phrases: [['振り返り会', 'ふりかえりかい']] })).toBe('ふりかえりかい');
  });

  test('講座の辞書に、共通の辞書と同じ語・同じ読みを書いていない（書くなら、読みを変えるときだけ）', () => {
    const common = { words: new Map<string, string>(), phrases: new Map<string, string>() };
    // 共通の辞書は engine/core/reading.ts（content/reading.ts は再 export だけ）
    const src = readFileSync(path.join(ROOT, 'engine/core/reading.ts'), 'utf8');
    for (const m of src.matchAll(/^ {2}\['([^']+)', '([^']+)'\],$/gm)) common.phrases.set(m[1], m[2]);
    for (const m of src.matchAll(/^ {2}([a-z0-9]+): '([^']+)',$/gm)) common.words.set(m[1], m[2]);
    expect(common.phrases.size).toBeGreaterThan(10);
    expect(common.words.size).toBeGreaterThan(50);
    for (const m of MODULES) {
      for (const [from, to] of m.reading?.phrases ?? [])
        expect(`${m.course.id} ${from} ${common.phrases.get(from) === to}`).toBe(`${m.course.id} ${from} false`);
      for (const [w, to] of Object.entries(m.reading?.words ?? {}))
        expect(`${m.course.id} ${w} ${common.words.get(w) === to}`).toBe(`${m.course.id} ${w} false`);
    }
  });

  test('講座の辞書のファイルは、その講座のフォルダの reading.ts だけ（講座の index.ts の reading に登録する）', () => {
    const files = readdirSync(path.join(ROOT, 'content'), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .flatMap((d) => (readdirSync(path.join(ROOT, 'content', d.name)).includes('reading.ts') ? [d.name] : []))
      .sort();
    expect(files).toEqual(
      MODULES.filter((m) => m.reading)
        .map((m) => m.course.id)
        .sort(),
    );
  });
});
