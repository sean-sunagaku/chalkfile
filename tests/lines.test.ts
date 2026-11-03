// 台詞の id と at（content/lines.ts）。at を台詞の id で書くと、読み込むときに番号に直る。台詞を足しても並べ替えても、
// 画面の要素は同じ台詞に付いたまま動く。訳は、日本語の台詞と同じ id を付ければ、台詞の数が違っても at を書き直さなくてよい
import { describe, expect, test } from 'bun:test';
import { AUTHORED_COURSES, COURSES } from '../content';
import { localizeCourse, type LectureL10n } from '../content/i18n';
import { AT_KEYS, resolveCourse, resolveLecture } from '../content/lines';
import type { At, AuthoredLecture, AuthoredScene, Lecture, Line, Scene } from '../content/types';
import { validateCourse, validateLecture } from '../engine/core/validate';
import { THEMES } from '../content/themes';
import { ALL_SCENES } from './fixtures/content/all-scenes/course';
import { LINE_IDS, LINE_IDS_EN, X10_EN } from './fixtures/content/line-ids/course';
import { X10 } from './fixtures/content/line-ids/X10';

/** 講座の theme が指してよいテーマ（台本の検証に渡す、台本の外の一覧） */
const CTX = { themes: Object.keys(THEMES) };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** 場面の中の at の全部（場所と値）。台詞そのもの（lines）は見ない */
const atsOf = (scene: Scene | AuthoredScene): [string, At][] => {
  const out: [string, At][] = [];
  const walk = (v: unknown, path: string) => {
    if (Array.isArray(v))
      v.forEach((x, i) => {
        walk(x, `${path}[${i}]`);
      });
    else if (isObj(v))
      for (const [k, x] of Object.entries(v)) {
        if (path === '' && k === 'lines') continue;
        if (AT_KEYS.includes(k) && (typeof x === 'number' || typeof x === 'string')) out.push([`${path}.${k}`, x]);
        else walk(x, `${path}.${k}`);
      }
  };
  walk(scene, '');
  return out;
};

/** 要素ごとに、出る台詞の文（at が台詞の数と同じなら、最後の台詞の終わり） */
const shownAt = (lec: Lecture) =>
  lec.scenes.map((s, i) =>
    atsOf(s).map(
      ([path, at]) =>
        `場面 ${i + 1}${path} → ${typeof at === 'number' ? (s.lines[at]?.t ?? '（最後の台詞の終わり）') : `id ${at}`}`,
    ),
  );

/** 全部の場面の台詞の前に 1 つ、真ん中にも 1 つ、台詞を足す（足す台詞には id を付けない） */
const addLines = (lec: AuthoredLecture): AuthoredLecture => ({
  ...lec,
  scenes: lec.scenes.map((s) => {
    const mid = Math.ceil(s.lines.length / 2);
    const lines: Line[] = [
      { t: '足した台詞（前）。' },
      ...s.lines.slice(0, mid),
      { t: '足した台詞（真ん中）。' },
      ...s.lines.slice(mid),
    ];
    return { ...s, lines } as AuthoredScene;
  }),
});

/** 数で書いた台本を、id で書いた台本にする（台詞に l0・l1…、部品に b0・b1… を付け、at と注の block を id にする） */
const toIds = (lec: Lecture): AuthoredLecture => ({
  ...lec,
  scenes: lec.scenes.map((s) => {
    const n = s.lines.length;
    const walk = (v: unknown, top = false): unknown => {
      if (Array.isArray(v)) return v.map((x) => walk(x));
      if (!isObj(v)) return v;
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) {
        if (top && k === 'lines') out[k] = s.lines.map((l, i) => ({ ...l, id: `l${i}` }));
        // at が台詞の数と同じ（最後の台詞の終わり）ものは、指す台詞が無いので数のまま
        else if (AT_KEYS.includes(k) && typeof x === 'number' && x < n) out[k] = `l${x}`;
        else out[k] = walk(x);
      }
      if (Array.isArray(out.blocks)) out.blocks = out.blocks.map((b, i) => ({ ...(b as object), id: `b${i}` }));
      if (Array.isArray(out.notes))
        out.notes = out.notes.map((nt) => {
          const { block, ...rest } = nt as { block: number };
          return { ...rest, blockId: `b${block}` };
        });
      return out;
    };
    return walk(s, true) as AuthoredScene;
  }),
});

describe('台詞の id で書いた at（content/lines.ts）', () => {
  test('数のままの台本は、そのまま動く（今の全講座は、読み込みの前と後で同じもの）', () => {
    expect(COURSES.length).toBe(AUTHORED_COURSES.length);
    COURSES.forEach((c, i) => {
      expect(c).toBe(AUTHORED_COURSES[i] as typeof c);
    });
    for (const c of COURSES) for (const l of c.lectures) expect(resolveLecture(l)).toBe(l);
  });

  test('id で書いた見本（tests/fixtures/content/line-ids）は番号に直り、検証の誤りも注意も 0 件', () => {
    const course = resolveCourse(LINE_IDS);
    expect(validateCourse(course, CTX)).toEqual([]);
    const [lec] = course.lectures;
    expect(Object.fromEntries(lec.scenes.flatMap((s, i) => atsOf(s).map(([p, at]) => [`${i + 1}${p}`, at])))).toEqual({
      '1.items[0].at': 1,
      '1.items[1].at': 2,
      '2.left.at': 0,
      '2.left.items[0].at': 1,
      '2.right.at': 3,
      '2.right.items[0].at': 4,
      '2.verdict.at': 5,
      '3.left.at': 0,
      '3.left.notes[0].at': 1,
      '3.left.notes[1].at': 1,
      '4.revealAt': 1,
    });
    const screens = lec.scenes[2];
    if (screens.kind !== 'screens') throw new Error('場面 3 は screens');
    expect(screens.left.notes?.map((nt) => [nt.blockId, nt.block])).toEqual([
      ['title', 0],
      ['send', 2],
    ]);
  });

  test('id で書いた見本: 台詞を足しても、画面の要素は同じ台詞で出る（数で書くと、ずれる）', () => {
    const before = shownAt(resolveLecture(X10));
    const added = resolveLecture(addLines(X10));
    expect(shownAt(added)).toEqual(before);
    expect(validateLecture(added, resolveCourse(LINE_IDS)).filter((x) => x.level === 'error')).toEqual([]);
    // 同じ台本を数で書いていたら（読み込んだあとの番号のまま台詞を足すと）、要素は違う台詞で出る
    const numbers = addLines(resolveLecture(X10));
    expect(shownAt(resolveLecture(numbers))).not.toEqual(before);
  });

  test('全部の場面の種類（tests/fixtures/content/all-scenes）で: id に書き換えても同じ番号に戻り、台詞を足してもずれない', () => {
    const [x01] = ALL_SCENES.lectures;
    const ids = toIds(x01);
    // 書き換えた at と注が、全部の種類で文字になっている（数のまま残るのは、最後の台詞の終わりを指す at だけ）
    const written = ids.scenes.flatMap((s) => atsOf(s));
    expect(written.filter(([, at]) => typeof at === 'string').length).toBeGreaterThan(40);
    const resolved = resolveLecture(ids);
    expect(shownAt(resolved)).toEqual(shownAt(x01));
    expect(resolved.scenes.map((s) => atsOf(s))).toEqual(x01.scenes.map((s) => atsOf(s)));
    const screens = resolved.scenes.find((s) => s.kind === 'screens');
    const original = x01.scenes.find((s) => s.kind === 'screens');
    if (screens?.kind !== 'screens' || original?.kind !== 'screens') throw new Error('screens の場面が無い');
    expect(screens.left.notes?.map((nt) => nt.block)).toEqual(original.left.notes?.map((nt) => nt.block));
    // 台詞を足す。比べるのは id で書いた at（最後の台詞の終わりを指す at は数のままなので、足した台詞のぶんだけ前の台詞を指すようになる）
    const added = resolveLecture(addLines(ids));
    const byId = ids.scenes.map(
      (s) =>
        new Set(
          atsOf(s)
            .filter(([, at]) => typeof at === 'string')
            .map(([p]) => p),
        ),
    );
    const lineIdsAt = (lec: Lecture) =>
      lec.scenes.map((s, i) =>
        atsOf(s)
          .filter(([p]) => byId[i].has(p))
          .map(([p, at]) => `${p} → ${s.lines[at as number]?.id ?? '（id の無い台詞）'}`),
      );
    expect(lineIdsAt(added)).toEqual(lineIdsAt(resolved));
    expect(
      lineIdsAt(added)
        .flat()
        .some((x) => x.includes('id の無い')),
    ).toBe(false);
    expect(validateLecture(added, ALL_SCENES).filter((x) => x.level === 'error' && x.rule === 'at')).toEqual([]);
  });

  test('訳: 日本語の台詞と同じ id を付ければ、台詞の数が違っても at を書き直さなくてよい', () => {
    const enCourse = localizeCourse(LINE_IDS, LINE_IDS_EN, 'en');
    const [en] = enCourse.lectures;
    // ずんだもんの台詞を足した場面でも、要素は同じ id の台詞で出る
    expect(shownAt(en)[0]).toEqual([
      '場面 1.items[0].at → One: give a line an id.',
      '場面 1.items[1].at → Two: write that id in at.',
    ]);
    expect(shownAt(en)[2]).toEqual([
      '場面 3.left.at → This is the screen before.',
      '場面 3.left.notes[0].at → The title and the button are faint and hard to read.',
      '場面 3.left.notes[1].at → The title and the button are faint and hard to read.',
    ]);
    expect(shownAt(en)[3]).toEqual(['場面 4.revealAt → The answer is true.']);
    expect(validateCourse(enCourse, CTX).filter((x) => x.level === 'error')).toEqual([]);
  });

  test('訳の台詞に、日本語の at の id が無いと、その動画の誤りになる（どの id が無いかを出す）', () => {
    const [goals, ...rest] = X10_EN.scenes;
    if (goals.kind !== 'goals') throw new Error('場面 1 は goals');
    const tr: LectureL10n = {
      ...X10_EN,
      scenes: [{ ...goals, lines: goals.lines.map((l) => (l.id === 'second' ? { t: l.t } : l)) }, ...rest],
    };
    const enCourse = localizeCourse(LINE_IDS, { ...LINE_IDS_EN, lectures: { X10: tr } }, 'en');
    const errors = validateCourse(enCourse, CTX).filter((x) => x.level === 'error');
    expect(errors.map((x) => `${x.rule} ${x.where}`)).toEqual(['at line-ids/X10.en 場面 1 goals.items[1].at']);
    expect(errors[0].message).toContain('台詞の id「second」が、この場面の台詞に無い（あるのは first）');
  });
});
