import { describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { AUTHORED_COURSES, COURSES, coursesIn, TRANSLATIONS } from '../content';
import { AT_KEYS, COURSE_FIELDS, LECTURE_FIELDS, lectureTexts, REPLACE, SCENE_FIELDS, walkCourse, walkLecture } from '../content/fields';
import { l10nProblems, localizeCourse, localizeLecture, TRANSLATED_LANGS, untranslated, type CourseL10n, type LectureL10n } from '../content/i18n';
import type { ConceptsScene, Course, Lecture } from '../content/types';
import { validateCourse, validateLecture } from '../engine/core/validate';
import { THEMES } from '../content/themes';
import { fingerprint, fingerprintV1, scaffold, staleNotices, translationRows, type Row } from '../scripts/i18n';
import { ALL_SCENES } from './fixtures/content/all-scenes/course';
import { LINE_IDS } from './fixtures/content/line-ids/course';

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
const localize = (lec: Lecture, l10n: LectureL10n) => localizeLecture(lec, l10n, course([lec]));
const first = (lec: Lecture) => lec.scenes[0] as ConceptsScene;
/** 重ねたときの誤り（場所と文） */
const problems = (lec: Lecture) => l10nProblems(lec).map((p) => `${p.where}: ${p.message}`);

describe('訳の重ね方（content/i18n.ts）', () => {
  test('画面の文字は上書きし、色・アイコン・key・at は日本語の台本のまま', () => {
    const out = localize(base(), tr());
    expect(first(out).cards[0]).toEqual({ key: 'scene', en: 'Scene', ja: 'Scene', desc: 'One block of the screen', tone: 'violet', icon: 'layout', at: 0 });
    expect(out.title).toBe('Sample');
    expect(out.quiz[0]).toEqual({ q: 'Question', choices: ['A', 'B'], answer: 1, explain: 'Why' });
    expect(out.docs[0]).toEqual({ title: 'Docs', url: 'https://example.com' });
    expect(out.material).toBeUndefined();
    expect(problems(out)).toEqual([]);
  });
  test('並べ替え: 訳の項目に key を書けば、日本語の項目を並べ替えても、訳の文字は同じ項目に付く', () => {
    const reordered = base({ scenes: [{ kind: 'concepts', heading: '言葉', cards: [cards[1], cards[0]], lines: [{ t: '台詞です。' }, { t: '場面です。' }] }] });
    const keyed = tr({ scenes: [scene({ cards: [{ key: 'scene', ja: 'Scene' }, { key: 'line', ja: 'Line' }] })] });
    expect(first(localize(base(), keyed)).cards.map((c) => `${c.key}:${c.ja}`)).toEqual(['scene:Scene', 'line:Line']);
    expect(first(localize(reordered, keyed)).cards.map((c) => `${c.key}:${c.ja}`)).toEqual(['line:Line', 'scene:Scene']);
    // key を書いても、並びと色・アイコン・at は日本語の台本のもの
    expect(first(localize(reordered, keyed)).cards.map((c) => `${c.tone} ${c.at}`)).toEqual(['pink 1', 'violet 0']);
    // key を書かない訳は位置で重なる（並べ替えると違う項目に付く）。そのときは、訳す文字の並びが変わるので訳の指紋も変わり、stale になる
    expect(first(localize(reordered, tr())).cards.map((c) => `${c.key}:${c.ja}`)).toEqual(['line:Scene', 'scene:Line']);
    expect(fingerprint(reordered)).not.toBe(fingerprint(base()));
  });
  test('key で重ねる配列: 日本語に無い key・2 回書いた key・訳に無い key・書いた項目と書かない項目の混ざりは誤り', () => {
    const check = (cs: ConceptsL10n['cards']) => problems(localize(base(), tr({ scenes: [scene({ cards: cs })] })));
    expect(check([{ key: 'scene', ja: 'Scene' }, { key: 'nope', ja: 'Nope' }])).toEqual([
      '場面 1 concepts.cards[1].key: key「nope」が、日本語の台本に無い（あるのは scene・line）',
      '場面 1 concepts.cards: 訳に無い key: line（key で重ねる配列は、日本語の台本の項目を全部書く）',
    ]);
    expect(check([{ key: 'scene', ja: 'Scene' }, { key: 'scene', ja: 'Again' }])[0]).toBe('場面 1 concepts.cards[1].key: key「scene」を、訳に 2 回書いている');
    expect(check([{ key: 'scene', ja: 'Scene' }, { ja: 'Line' }])[0]).toContain('場面 1 concepts.cards: 訳の項目の key は、全部に書くか、全部に書かない');
  });
  test('数の違い: 位置で重ねる配列の数が日本語の台本と違うと、その動画の誤りになる（読み込みは止めない）', () => {
    const out = localize(base(), tr({ scenes: [scene({ cards: [{ ja: 'Scene' }] })] }));
    expect(problems(out)).toEqual(['場面 1 concepts.cards: 日本語の台本と数が合わない（台本 2・訳 1）']);
    // 重ねられない配列は日本語の台本のまま（画面は出るが、台本の検証がこの動画を止める）
    expect(first(out).cards.map((c) => c.ja)).toEqual(['場面', '台詞']);
  });
  test('台詞は丸ごと置き換わり、数が変わってよい（そのときは at も書く）', () => {
    const lines = [{ t: 'One.' }, { t: 'Two.' }, { t: 'Three.' }];
    const out = localize(base(), tr({ scenes: [scene({ lines, cards: [{ ja: 'Scene', at: 0 }, { ja: 'Line', at: 2 }] })] }));
    expect(out.scenes[0].lines).toEqual(lines);
    expect(first(out).cards.map((c) => c.at)).toEqual([0, 2]);
    expect(problems(out)).toEqual([]);
  });
  test('at の書き忘れ: 台詞の数が違う場面で数の at を書かないと、どの項目かを挙げる', () => {
    const l10n = tr({ scenes: [scene({ lines: [{ t: 'One.' }, { t: 'Two.' }, { t: 'Three.' }] })] });
    expect(problems(localize(base(), l10n)).map((p) => p.split(':')[0])).toEqual(['場面 1 concepts.cards[0].at', '場面 1 concepts.cards[1].at']);
    // key で重ねても、書き忘れは同じ場所に出る
    const keyed = tr({ scenes: [scene({ lines: [{ t: 'One.' }, { t: 'Two.' }, { t: 'Three.' }], cards: [{ key: 'line', ja: 'Line', at: 2 }, { key: 'scene', ja: 'Scene' }] })] });
    expect(problems(localize(base(), keyed)).map((p) => p.split(':')[0])).toEqual(['場面 1 concepts.cards[0].at']);
  });
  test('重ねたあとの at が、訳の台詞の範囲の外だと、台本の検証がその動画の誤りにする', () => {
    const l10n = tr({ scenes: [scene({ lines: [{ t: 'Only one.' }], cards: [{ ja: 'Scene', at: 0 }, { ja: 'Line', at: 2 }] })] });
    const out = localize(base(), l10n);
    const errors = validateLecture(out, { ...course([out]), lang: 'en' }).filter((x) => x.level === 'error');
    expect(errors.map((x) => `${x.rule} ${x.where}`)).toEqual(['at sample/X01.en 場面 1 concepts.cards[1].at']);
  });
  test('場面の数・種類が違うか、台詞が空だと、その動画の誤りになる', () => {
    expect(problems(localize(base(), tr({ scenes: [] })))).toEqual(['scenes: 場面の数が日本語の台本と合わない（台本 1・訳 0）']);
    expect(problems(localize(base(), tr({ scenes: [{ kind: 'big', text: 'Big', lines: [{ t: 'Big.' }] }] })))).toEqual(['場面 1: 種類が日本語の台本と違う（台本 concepts・訳 big）']);
    expect(problems(localize(base(), tr({ scenes: [scene({ lines: [] })] })))).toEqual(['場面 1 concepts lines: 台詞が無い']);
  });
  test('日本語の台本に注意書きがあれば、訳にも書く', () => {
    expect(problems(localize(base({ caution: '注意' }), tr()))).toEqual(['caution: 日本語の台本に注意書き（caution）があるので、訳も書く']);
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
  test('日本語に無いレクチャーの訳と、セクションの数の違いは、講座の誤りになる', () => {
    const extra = localizeCourse(course(), courseTr({ lectures: { X01: tr(), X09: tr() } }), 'en');
    expect(l10nProblems(extra).map((p) => p.message)).toEqual(['日本語の講座に無いレクチャーの訳: X09']);
    expect(validateCourse(extra, { themes: Object.keys(THEMES) }).filter((x) => x.rule === 'l10n').map((x) => x.where)).toEqual(['sample（en） lectures.X09']);
    expect(l10nProblems(localizeCourse(course(), courseTr({ sections: [] }), 'en')).map((p) => p.message)).toEqual(['セクションの数が合わない（講座 1・訳 0）']);
  });
  test('出典の訳は説明だけを重ね、不明な ID は講座の誤りになる', () => {
    const original = { ...course(), sources: [{ id: 'spec', title: '仕様', url: 'https://example.com/spec', publisher: '作成者', year: '2026', kind: 'official' as const, checked: '2026-11-04', note: '試験の見本' }] };
    const out = localizeCourse(original, courseTr({ sources: { spec: { title: 'Specification' }, missing: { note: 'Unknown' } } }), 'en');
    expect(out.sources).toEqual([{ ...original.sources[0], title: 'Specification' }]);
    expect(l10nProblems(out)).toEqual([{ where: 'sources.missing', message: '日本語の講座に無い出典の訳: missing' }]);
    expect(validateCourse(out, { themes: Object.keys(THEMES) }).filter((issue) => issue.rule === 'l10n').map((issue) => issue.where)).toEqual(['sample（en） sources.missing']);
  });
  test('誤りは動画ごと: 1 本の訳が壊れていても、ほかの動画の訳は誤りにならない（Studio はその動画だけを止める）', () => {
    const two = course([base(), base({ id: 'X02', no: 2 })]);
    const out = localizeCourse(two, courseTr({ lectures: { X01: tr({ scenes: [] }), X02: tr() } }), 'en');
    const [broken, fine] = out.lectures;
    expect(validateLecture(broken, out).filter((x) => x.rule === 'l10n').map((x) => x.where)).toEqual(['sample/X01.en scenes']);
    expect(validateLecture(fine, out).filter((x) => x.level === 'error')).toEqual([]);
    // 日本語の動画には誤りが付かない
    expect(validateLecture(two.lectures[0], two).filter((x) => x.level === 'error')).toEqual([]);
  });
  test('訳し残し: 英語の講座に残った日本語の文字を見つける', () => {
    const left = localizeCourse(course(), courseTr({ lectures: { X01: tr({ title: '見本のまま' }) } }), 'en');
    expect(untranslated(left, 'en')).toEqual(['sample.en/X01.title: 見本のまま']);
    expect(untranslated(localizeCourse(course(), courseTr(), 'en'), 'en')).toEqual([]);
  });
  test('訳し残し: 見るのは訳す文字だけ（色・ID・URL・コード・読み上げる文 s は見ない）', () => {
    const out = localizeCourse(course(), courseTr({ lectures: { X01: tr({ scenes: [scene({ lines: [{ t: 'This is a scene.', s: 'これは読み' }, { t: 'This is a line.' }] })] }) } }), 'en');
    expect(untranslated(out, 'en')).toEqual([]);
  });
});

describe('項目の役目（content/fields.ts）', () => {
  test('AT_KEYS・REPLACE は、場面の種類ごとの項目から作る（前の一覧と同じ名前）', () => {
    expect([...AT_KEYS].sort()).toEqual(['at', 'revealAt', 'showAt', 'subAt', 'textAt']);
    expect([...REPLACE].sort()).toEqual(['lines', 'takeaways']);
    expect(Object.keys(SCENE_FIELDS)).toHaveLength(20);
    expect(Object.keys(LECTURE_FIELDS)).toContain('scenes');
    expect(Object.keys(COURSE_FIELDS)).toContain('lectures');
  });
  test('今の全部の台本・訳・見本に、項目の役目を書いていない項目が無い', () => {
    const unknown: string[] = [];
    const visit = (role: unknown, _v: unknown, _ja: unknown, p: string) => { if (role === undefined) unknown.push(p); };
    for (const lang of ['ja', ...TRANSLATED_LANGS] as const)
      for (const c of coursesIn(lang)) {
        walkCourse(c, undefined, `${c.id}.${lang}`, visit);
        for (const l of c.lectures) walkLecture(l, undefined, `${c.id}.${lang}/${l.id}`, visit);
      }
    for (const c of [ALL_SCENES, LINE_IDS]) for (const l of c.lectures) walkLecture(l, undefined, `${c.id}/${l.id}`, visit);
    expect(unknown).toEqual([]);
  });
});

describe('訳の指紋（scripts/i18n.ts の fingerprint）', () => {
  const lec = base();
  const withCard = (patch: Partial<ConceptsScene['cards'][number]>) => base({ scenes: [{ ...base().scenes[0], cards: [{ ...cards[0], ...patch }, cards[1]] } as ConceptsScene] });
  test('訳す文字だけから作る: 色・アイコン・at・読み上げる文・効果音・読む教材を直しても変わらない', () => {
    const same = fingerprint(lec);
    expect(fingerprint(withCard({ tone: 'mint', icon: 'eye', at: 1 }))).toBe(same);
    expect(fingerprint(base({ scenes: [{ ...base().scenes[0], lines: [{ t: '場面です。', s: 'ばめんです。', sfx: 'pop' }, { t: '台詞です。' }] }] }))).toBe(same);
    const withMaterial = COURSES.flatMap((c) => c.lectures).find((l) => l.material);
    if (!withMaterial) throw new Error('読む教材のある動画が無い');
    expect(fingerprint({ ...withMaterial, material: undefined })).toBe(fingerprint(withMaterial));
    expect(fingerprint({ ...lec, docs: [{ title: '説明', url: 'https://example.com/other' }] })).toBe(same);
  });
  test('訳す文字が変わると変わる: 題・要約・クイズ・要点・出典の題・注意書き・見出し・画面の要素の文字・台詞', () => {
    const now = fingerprint(lec);
    const changed: Lecture[] = [
      base({ title: '別の題' }),
      base({ summary: '別の要約' }),
      base({ quiz: [{ q: '問い', choices: ['あ', 'う'], answer: 1, explain: '理由' }] }),
      base({ takeaways: ['要点', '足した要点'] }),
      base({ docs: [{ title: '別の説明', url: 'https://example.com' }] }),
      base({ caution: '注意' }),
      base({ scenes: [{ ...base().scenes[0], heading: '別の見出し' } as ConceptsScene] }),
      withCard({ desc: '別の説明' }),
      base({ scenes: [{ ...base().scenes[0], lines: [{ t: '場面です。' }, { t: '台詞を直しました。' }] }] }),
    ];
    for (const c of changed) expect(fingerprint(c)).not.toBe(now);
  });
  test('今の訳は全部、今の作り方の指紋で付いていて、stale が 0 本（前の作り方の指紋とは違う値）', () => {
    const rows = translationRows().filter((r) => r.state !== 'none');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.filter((r) => r.state !== 'ok').map((r) => `${r.id}.${r.lang}`)).toEqual([]);
    for (const c of COURSES) for (const l of c.lectures) if (TRANSLATIONS.en[c.id]?.lectures[l.id]) expect(fingerprintV1(l)).not.toBe(fingerprint(l));
  });
  test('訳す文字の一覧は、場所と文字の組（台詞の t は入り、s は入らない）', () => {
    const texts = lectureTexts(base({ scenes: [{ ...base().scenes[0], lines: [{ t: '場面です。', s: 'よみ' }, { t: '台詞です。' }] }] }));
    expect(texts).toContainEqual(['.scenes[0].lines[0].t', '場面です。']);
    expect(texts.some(([, t]) => t === 'よみ')).toBe(false);
    expect(texts).toContainEqual(['.scenes[0].cards[0].desc', '画面の 1 まとまり']);
  });
});

describe('stale の訳を止める（scripts/i18n.ts の staleNotices）', () => {
  const row = (lang: 'en' | 'zh', patch: Partial<Row> = {}): Row => ({ course: 'sample', id: 'X01', lang, state: 'stale', file: `content/sample/${lang}/X01.ts`, ...patch });
  test('公開する言語（publishLangs）の stale は止める。まだ公開しない言語は注意だけ', () => {
    const rows = [row('en'), row('zh'), row('en', { state: 'ok' }), row('zh', { state: 'none' })];
    expect(staleNotices(rows, ['ja']).map((n) => `${n.level} ${n.file}`)).toEqual(['warn content/sample/en/X01.ts', 'warn content/sample/zh/X01.ts']);
    expect(staleNotices(rows, ['ja', 'en']).map((n) => `${n.level} ${n.file}`)).toEqual(['error content/sample/en/X01.ts', 'warn content/sample/zh/X01.ts']);
    expect(staleNotices(rows, ['ja', 'en'])[0].message).toContain('en は公開する言語なので止める');
  });
  test('前の作り方の指紋のままの訳は、restamp で付け直すように知らせる', () => {
    expect(staleNotices([row('en', { old: true })], ['ja'])[0].message).toContain('bun scripts/i18n.ts restamp');
  });
  test('今の CI は止まらない（公開する言語は ja だけで、stale も 0 本）', () => {
    expect(staleNotices(translationRows()).filter((n) => n.level === 'error')).toEqual([]);
  });
});

describe('訳のひな形（scripts/i18n.ts の scaffold）', () => {
  const load = async (code: string, id: string): Promise<LectureL10n> => {
    const dir = mkdtempSync(path.join(tmpdir(), 'chalkfile-scaffold-'));
    try {
      writeFileSync(path.join(dir, `${id}.ts`), code);
      return ((await import(path.join(dir, `${id}.ts`))) as Record<string, LectureL10n>)[id];
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
  test('全部の動画で: ひな形は、そのまま重ねても重ね方の誤りが出ない（注意書きのある動画は、注意書きを訳に書くまで止まる）', async () => {
    for (const c of AUTHORED_COURSES)
      for (const l of c.lectures) {
        const code = scaffold(l, 'en', fingerprint(l));
        const t = await load(code, l.id);
        expect(t.source).toBe(fingerprint(l));
        const got = l10nProblems(localizeLecture(l, t, c)).map((p) => p.where);
        expect({ id: l.id, got }).toEqual({ id: l.id, got: l.caution ? ['caution'] : [] });
      }
  });
  test('訳す文字は空にして日本語を注釈に入れ、key と台詞の id・声・効果音は写す', () => {
    const code = scaffold(LINE_IDS.lectures[0], 'en', 'abcdef012345');
    expect(code).toContain("source: 'abcdef012345',");
    expect(code).toContain("title: '', // id で書く見本");
    expect(code).toContain("{ id: 'first', t: '', sfx: 'pop' }, // 台詞に id を付けること。");
    expect(code).toContain("{ t: '', v: 'zundamon' }, // [zundamon] それは大変なのだ！");
  });
  test('ひな形の key で重なる: 日本語で項目を並べ替えても、訳の文字は同じ項目に付く', async () => {
    const [x01] = ALL_SCENES.lectures;
    const t = await load(scaffold(x01, 'en', fingerprint(x01)), 'X01');
    // ひな形の文字を、日本語の key の名前で埋める（どの項目に付いたかが分かるように）
    const fill = (v: unknown, keyOf?: string): unknown => {
      if (Array.isArray(v)) return v.map((x) => fill(x));
      if (!v || typeof v !== 'object') return v;
      const o = v as Record<string, unknown>;
      const key = typeof o.key === 'string' ? o.key : keyOf;
      return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, x === '' && key ? `tr:${key}` : fill(x, key)]));
    };
    const filled = { ...t, scenes: t.scenes.map((s) => fill(s)) } as LectureL10n;
    const reversed = { ...x01, scenes: x01.scenes.map((s) => (s.kind === 'concepts' ? { ...s, cards: [...s.cards].reverse() } : s.kind === 'flow' ? { ...s, nodes: [...s.nodes].reverse() } : s)) } as Lecture;
    const out = localizeLecture(reversed, filled, ALL_SCENES);
    expect(l10nProblems(out).map((p) => p.where)).toEqual(['caution']);
    for (const s of out.scenes) {
      if (s.kind === 'concepts') for (const c of s.cards) expect(c.ja).toBe(`tr:${c.key}`);
      if (s.kind === 'flow') for (const n of s.nodes) expect(n.label).toBe(`tr:${n.key}`);
    }
  });
});
