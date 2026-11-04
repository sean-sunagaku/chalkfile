// 文字の大きさ（src/video.config.ts の TYPE・TYPE_MIN）。役割ごとの下限を守っているかと、部品が大きさを直接書いていないかを確かめる
import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { captionLines } from '../../engine/core/validate';
import { CAPTION, HEADING, TYPE, TYPE_MIN, type TypeRole } from '../../src/video.config';

const ROOT = path.resolve(import.meta.dir, '../..');
const ROLES = Object.keys(TYPE_MIN) as TypeRole[];

describe('役割ごとの文字の大きさ', () => {
  test('本文の下限は 26px（style.md の「文字の量と大きさ」）', () => expect(TYPE_MIN.body).toBe(26));
  test('全部の役割に大きさがあり、どの大きさも、その役割の下限より小さくない', () => {
    expect(Object.keys(TYPE).sort()).toEqual([...ROLES].sort());
    const low = ROLES.flatMap((role) =>
      Object.entries(TYPE[role] as Record<string, number>)
        .filter(([, size]) => !(size >= TYPE_MIN[role]))
        .map(([name, size]) => `${role}.${name} = ${size}（下限 ${TYPE_MIN[role]}）`),
    );
    expect(low).toEqual([]);
  });
  test('幅に合わせて縮める文字の下限も、役割の下限より小さくない（見出しは題、字幕は本文）', () => {
    expect(HEADING.minSize).toBeGreaterThanOrEqual(TYPE_MIN.title);
    expect(HEADING.minSize).toBeLessThan(HEADING.size);
    expect(CAPTION.minSize).toBeGreaterThanOrEqual(TYPE_MIN.body);
    expect(CAPTION.minSize).toBeLessThan(CAPTION.size);
    expect({ heading: HEADING.size, chip: HEADING.chipSize, caption: CAPTION.size, name: CAPTION.nameSize }).toEqual({
      heading: TYPE.title.heading,
      chip: TYPE.label.chip,
      caption: TYPE.body.caption,
      name: TYPE.label.captionName,
    });
  });
});

describe('部品は文字の大きさを直接書かない（TYPE から選ぶ）', () => {
  const files = [
    'src/Lecture.tsx',
    ...['src/components', 'src/scenes'].flatMap((d) =>
      readdirSync(path.join(ROOT, d))
        .filter((f) => f.endsWith('.tsx'))
        .map((f) => `${d}/${f}`),
    ),
  ];
  test('fontSize と、文字の大きさを渡す部品（Pill・NoteCard・NoteList・NoteDot・Code）の size に、数を直接書いていない', () => {
    const found = files.flatMap((f) =>
      readFileSync(path.join(ROOT, f), 'utf8')
        .split('\n')
        .flatMap((line, i) =>
          /fontSize:\s*\d|fontSize=\{\s*\d|<(?:Pill|NoteCard|NoteList|NoteDot|Code)\b[^>]*\bsize=\{\s*\d/.test(line)
            ? [`${f}:${i + 1}  ${line.trim()}`]
            : [],
        ),
    );
    expect(found).toEqual([]);
  });
});

describe('台本の検証の見込み（縮めたあとの大きさでも入らないものだけを注意にする）', () => {
  test('字幕の行数の見込みは、大きさを渡せる（縮めると行が減る）', () => {
    const long = 'あ'.repeat(95);
    expect(captionLines(long)).toBe(3);
    expect(captionLines(long, undefined, CAPTION.minSize)).toBe(2);
  });
});
