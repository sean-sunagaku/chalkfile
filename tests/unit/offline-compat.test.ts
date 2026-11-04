import { required } from '../support/required';
import { describe, expect, test } from 'bun:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  checkSavedVersion,
  parseQuarantineName,
  parseRecord,
  planCleanup,
  QUARANTINE_DAYS,
  quarantineName,
  recordCaches,
  validateManifest,
  type CleanupInput,
  type SavedRecord,
} from '../../site/offline-shared';
import {
  type KeyValueStore,
  type Learning,
  openStore,
  readPrefs,
  readProgress,
  STORE_VERSION,
  storagePrefix,
} from '../../site/page/storage';

// 利用者が保存した記録（tests/fixtures/saved-records/<日付>/）を、今の読み込みが全部受け入れることを確かめる。
// 落ちたら、保存した講座が読めなくなる（隔離のあと 30 日で消える）。検証を元に戻すか、移行のコードを足す。fixture を書き換えて通さない。
// 決まりは docs/architecture/offline.md の「保存データの互換」。
// 読み込みは、記録を書いた SW と同じ読み方で確かめる: sw.ts は parseRecord（動画の置き場所は /media/<言語>/ だけ）、
// 旧 Pages の legacy-sw.ts は、その頃の訳の動画のサイト（mediaRoots。fixture の index.json）を validateManifest に渡す
type Era = { scope: string; prefix: string; reader: 'sw' | 'legacy-sw'; mediaRoots: Record<string, string> };
const fixtures = path.join(import.meta.dir, '../fixtures/saved-records');
const read = <T>(file: string) => JSON.parse(readFileSync(file, 'utf8')) as T;
const DAY = 24 * 60 * 60 * 1000;
/** その頃の SW の、教材情報の確かめ方（今の SW は動画のサイトを渡さない） */
const manifestOf = (era: Era, value: unknown, id: string) =>
  era.reader === 'sw' ? validateManifest(value, id, era.scope) : validateManifest(value, id, era.scope, era.mediaRoots);

for (const date of readdirSync(fixtures).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))) {
  const { eras } = read<{ eras: Record<string, Era> }>(path.join(fixtures, date, 'index.json'));
  for (const [name, era] of Object.entries(eras)) {
    const dir = path.join(fixtures, date, name);
    const folders = readdirSync(dir).filter((d) => existsSync(path.join(dir, d, 'offline-manifest.json')));
    const records = folders.flatMap((folder) =>
      readdirSync(path.join(dir, folder))
        .filter((f) => /^record.*\.json$/.test(f))
        .map((file) => ({
          id: decodeURIComponent(folder),
          file,
          value: read<SavedRecord>(path.join(dir, folder, file)),
        })),
    );
    describe(`保存の記録 ${date} ${name}（${era.scope}）`, () => {
      test('講座の教材情報と記録がそろっている', () => {
        expect(folders.length).toBeGreaterThan(0);
        expect(records.filter((r) => r.file === 'record.json')).toHaveLength(folders.length);
      });
      for (const folder of folders) {
        const id = decodeURIComponent(folder);
        test(`${id}: 教材情報（offline-manifest.json）を今の validateManifest が受け入れる`, () => {
          const m = read<unknown>(path.join(dir, folder, 'offline-manifest.json'));
          expect(manifestOf(era, m, id).id).toBe(id);
        });
      }
      for (const { id, file, value } of records)
        test(`${id}: 保存の記録（${file}）を今の読み込みが受け入れる`, () => {
          // sw.ts は 1 つでも読めない版があれば記録全体を読めないとする。旧 Pages の legacy-sw.ts は、読める版だけを使う
          // （versions() が、教材情報と Cache の名前の頭を確かめる。公開中の移行 SW とバイト列を変えないため、移行のコードを終えるまで手を入れない）
          if (era.reader === 'sw') {
            expect(parseRecord(value, id, era.scope, era.prefix).versions).toHaveLength(value.versions.length);
            for (const v of value.versions) expect(checkSavedVersion(v, id, era.scope, era.prefix).cache).toBe(v.cache);
          } else {
            for (const v of value.versions) {
              expect(manifestOf(era, v.manifest, id).id).toBe(id);
              expect(v.cache.startsWith(`${era.prefix}course:${id}:`)).toBe(true);
            }
          }
        });
      for (const { id, value } of records.filter((r) => r.file === 'record-updated.json'))
        test(`${id}: 更新して保存した記録は、新しい版の後ろに前の版をそのまま残す`, () => {
          const before = records.find((r) => r.id === id && r.file === 'record.json')!.value;
          expect(value.versions).toHaveLength(2);
          expect(value.versions[1]).toEqual(before.versions[0]);
          expect(required(value.versions[0]).manifest.revision).not.toBe(required(before.versions[0]).manifest.revision);
        });
      if (era.reader === 'sw')
        test('保存したあとの Cache を、今の cleanup は 1 つも消さず、隔離もしない', () => {
          const { caches } = read<{ caches: string[] }>(path.join(dir, 'caches.json'));
          const keep = new Set([`${era.prefix}registry`, ...caches.filter((n) => n.startsWith(`${era.prefix}shell:`))]);
          for (const r of records.filter((x) => x.file === 'record.json'))
            for (const v of parseRecord(r.value, r.id, era.scope, era.prefix).versions) keep.add(v.cache);
          for (const oldShell of [false, true]) {
            expect(
              planCleanup({
                names: caches,
                prefix: era.prefix,
                keep,
                held: { caches: new Set(), ids: new Set() },
                oldShell,
                now: Date.now(),
              }),
            ).toEqual({ remove: [], create: [] });
          }
        });
    });
  }
}

describe('読めない記録の扱い', () => {
  const scope = 'https://chalkfile.com/';
  const prefix = 'chalkfile:/:offline-v1:';
  const record = () => read<SavedRecord>(path.join(fixtures, '2026-11-02/workers/pstack-comedy/record.json'));
  test('保存した記録を壊した形は、読めないとする（版が 3 つ・別の講座の Cache・教材情報の不正・形の崩れ）', () => {
    const broken = [
      { ...record(), versions: [...record().versions, ...record().versions, ...record().versions] },
      { versions: [{ ...record().versions[0], cache: `${prefix}course:rive-comedy:x` }] },
      { versions: [{ ...record().versions[0], manifest: { ...required(record().versions[0]).manifest, pageVersion: 'x' } }] },
      { versions: [null] },
      { versions: 'x' },
      null,
      'x',
    ];
    for (const value of broken) expect(() => parseRecord(value, 'pstack-comedy', scope, prefix)).toThrow();
    expect(parseRecord({ versions: [] }, 'pstack-comedy', scope, prefix).versions).toEqual([]);
  });
  test('読めない記録が指していた Cache の名前を拾う。指す先が分からなければ null', () => {
    const v = required(record().versions[0]);
    expect(recordCaches({ versions: [{ ...v, manifest: null }] }, 'pstack-comedy', prefix)).toEqual([v.cache]);
    expect(
      recordCaches(
        { versions: [{ ...v, cache: `${prefix}course:rive-comedy:x` }, { cache: 1 }] },
        'pstack-comedy',
        prefix,
      ),
    ).toBeNull();
    for (const value of [undefined, null, 'x', { versions: 'x' }, { versions: [] }])
      expect(recordCaches(value, 'pstack-comedy', prefix)).toBeNull();
  });
});

describe('cleanup の片付けと隔離（planCleanup）', () => {
  const prefix = 'chalkfile:/:offline-v1:';
  const cache = (id: string, n = 1) =>
    `${prefix}course:${id}:${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`;
  const now = Date.UTC(2026, 10, 2, 12);
  const base = (names: string[], over: Partial<CleanupInput> = {}): CleanupInput => ({
    names: [`${prefix}registry`, `${prefix}shell:new`, ...names],
    prefix,
    keep: new Set([`${prefix}registry`, `${prefix}shell:new`]),
    held: { caches: new Set(), ids: new Set() },
    oldShell: false,
    now,
    ...over,
  });
  const sorted = (plan: { remove: string[]; create: string[] }) => ({
    remove: [...plan.remove].sort(),
    create: [...plan.create].sort(),
  });

  test('記録が指さない講座の Cache（途中で終わった保存・更新で外れた版）は消す。ほかのアプリの Cache には触れない', () => {
    const input = base([
      cache('a'),
      cache('b'),
      'neighbor-app',
      'chalkfile:/chalkfile/:offline-v1:course:a:x',
      `quarantine:${now}:neighbor-app`,
    ]);
    input.keep.add(cache('a'));
    expect(sorted(planCleanup(input))).toEqual({ remove: [cache('b')], create: [] });
  });
  test('読めない記録が指す Cache は消さずに、今の時刻の印を付ける', () => {
    const input = base([cache('a'), cache('a', 2)], { held: { caches: new Set([cache('a')]), ids: new Set() } });
    expect(sorted(planCleanup(input))).toEqual({ remove: [cache('a', 2)], create: [quarantineName(cache('a'), now)] });
    expect(parseQuarantineName(quarantineName(cache('a'), now))).toEqual({ at: now, cache: cache('a') });
  });
  test(`印から ${QUARANTINE_DAYS} 日たつまでは残し、たったら中身と印を消す`, () => {
    const held = { caches: new Set([cache('a')]), ids: new Set<string>() };
    const young = quarantineName(cache('a'), now - (QUARANTINE_DAYS * DAY - 1));
    expect(planCleanup(base([cache('a'), young], { held }))).toEqual({ remove: [], create: [] });
    const old = quarantineName(cache('a'), now - QUARANTINE_DAYS * DAY);
    expect(sorted(planCleanup(base([cache('a'), old], { held })))).toEqual({
      remove: [cache('a'), old].sort(),
      create: [],
    });
  });
  test('記録が読めるように戻ったら、印だけを外して保存版に戻す', () => {
    const mark = quarantineName(cache('a'), now - 3 * DAY);
    const input = base([cache('a'), mark]);
    input.keep.add(cache('a'));
    expect(planCleanup(input)).toEqual({ remove: [mark], create: [] });
  });
  test('保存し直し・削除で記録が指さなくなったら、隔離した Cache と印を消す', () => {
    const mark = quarantineName(cache('a'), now - 3 * DAY);
    const input = base([cache('a'), cache('a', 2), mark]);
    input.keep.add(cache('a', 2));
    expect(sorted(planCleanup(input))).toEqual({ remove: [cache('a'), mark].sort(), create: [] });
  });
  test('記録の形が壊れていて指す先が分からない講座は、その講座の Cache を全部隔離する', () => {
    const input = base([cache('a'), cache('a', 2), cache('ab'), cache('en/a')], {
      held: { caches: new Set(), ids: new Set(['a']) },
    });
    expect(sorted(planCleanup(input))).toEqual({
      remove: [cache('ab'), cache('en/a')].sort(),
      create: [quarantineName(cache('a'), now), quarantineName(cache('a', 2), now)].sort(),
    });
  });
  test('中身の無い印は外し、未来の時刻の印（端末の時計のずれ）は今の時刻で付け直す', () => {
    const held = { caches: new Set([cache('a')]), ids: new Set<string>() };
    const dangling = quarantineName(cache('b'), now - DAY);
    const future = quarantineName(cache('a'), now + 400 * DAY);
    expect(sorted(planCleanup(base([cache('a'), dangling, future], { held })))).toEqual({
      remove: [dangling, future].sort(),
      create: [quarantineName(cache('a'), now)],
    });
  });
  test('activate のときだけ、今の shell 以外の shell を消す', () => {
    expect(planCleanup(base([`${prefix}shell:old`]))).toEqual({ remove: [], create: [] });
    expect(planCleanup(base([`${prefix}shell:old`], { oldShell: true }))).toEqual({
      remove: [`${prefix}shell:old`],
      create: [],
    });
  });
});

// 学習の記録（localStorage）。見本（tests/fixtures/local-storage/<日付>.json）は、前の版の講座のページが書いたもの。
// 今の画面（site/page/storage.ts）が全部を読めること、今の画面が書き直した記録を前の版の画面も読めること（保存した前の版・
// 無効にした版をオフラインで開いたときに、同じ鍵を読み書きする）を確かめる。落ちたら、読み方を戻すか、読むときに変えるコードを足す。fixture を書き換えて通さない
type LocalFixture = { lang: string; course: string; lectures: string[]; storage: Record<string, string> };
const localFixtures = path.join(import.meta.dir, '../fixtures/local-storage');
const memory = (init: Record<string, string> = {}) => {
  const map = new Map(Object.entries(init));
  const storage: KeyValueStore = { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
  return { map, storage };
};

describe('学習の記録（localStorage）の互換', () => {
  for (const file of readdirSync(localFixtures).filter((f) => f.endsWith('.json'))) {
    const fixture = read<LocalFixture>(path.join(localFixtures, file));
    const prefix = storagePrefix(fixture.lang, fixture.course);
    const old = (name: string) => JSON.parse(required(fixture.storage[`${prefix}${name}`])) as unknown;

    test(`${file}: 前の形の記録を、今の画面が落とさずに読む`, () => {
      const store = openStore(memory(fixture.storage).storage, prefix);
      const learning = store.read();
      expect(learning.progress).toEqual(old('progress') as Learning['progress']);
      expect(learning.notes).toEqual(old('notes') as Learning['notes']);
      expect(learning.quiz).toEqual(old('quiz') as Learning['quiz']);
      expect(learning.prefs).toEqual(old('prefs') as Learning['prefs']);
      expect(store.last()).toBe(old('last') as string);
      expect(store.tab()).toBe(old('tab') as string);
      expect(fixture.lectures).toContain(store.last() ?? '');
    });

    test(`${file}: 今の画面が書き直した記録には版の番号が入り、前の版の画面も同じ項目を読める`, () => {
      const { map, storage } = memory(fixture.storage);
      const store = openStore(storage, prefix);
      const learning = store.read();
      store.saveProgress(learning.progress);
      store.saveNotes(learning.notes);
      store.saveQuiz(learning.quiz);
      store.savePrefs(learning.prefs);
      for (const name of ['progress', 'notes', 'quiz', 'prefs']) {
        const written = JSON.parse(map.get(`${prefix}${name}`) ?? 'null') as Record<string, unknown>;
        expect(written.v).toBe(STORE_VERSION);
        // 前の版の画面は、値の中のレクチャー ID（prefs は rate・cc・follow）の項目だけを引く
        for (const [k, v] of Object.entries(old(name) as Record<string, unknown>)) expect(written[k]).toEqual(v);
      }
      // 版の番号を入れた記録も、今の画面は同じに読む
      expect(openStore(storage, prefix).read()).toEqual(learning);
    });
  }

  test('鍵の頭は前と同じ（日本語は言語を付けない。訳の講座は言語を付けて分ける）', () => {
    expect(storagePrefix('ja', 'stripe-billing')).toBe('chalkfile:stripe-billing:');
    expect(storagePrefix('en', 'pstack-comedy')).toBe('chalkfile:en/pstack-comedy:');
  });

  test('前の形の、項目の足りない記録（完了の札だけ・max の無いもの）を補って読む', () => {
    expect(
      readProgress({ L01: { done: true, t: 0 }, L02: { t: 0, max: 0, done: true }, L03: { t: 12.5, max: 0.4 } }),
    ).toEqual({
      L01: { t: 0, max: 0, done: true },
      L02: { t: 0, max: 0, done: true },
      L03: { t: 12.5, max: 0.4, done: false },
    });
    expect(readPrefs({ rate: 1.25 })).toEqual({ rate: 1.25, cc: true, follow: true });
  });

  test('壊れた記録・知らない形を読んでも止めず、読めない所だけを落とす', () => {
    const { storage } = memory({
      'chalkfile:x:progress': '{"L01":"x","L02":{"t":"5","max":2,"done":"yes"},"v":9}',
      'chalkfile:x:notes': '{"L01":[{"t":4,"text":"残す"},{"t":1,"text":""},null,"x"],"L02":"x"}',
      'chalkfile:x:quiz': '{"L01":{"0":2,"a":1,"1":-1,"2":1.5},"L02":[]}',
      'chalkfile:x:prefs': '{"rate":3,"cc":"no","follow":false}',
      'chalkfile:x:last': '7',
      'chalkfile:x:tab': '{',
    });
    const store = openStore(storage, 'chalkfile:x:');
    expect(store.read()).toEqual({
      progress: { L02: { t: 0, max: 1, done: false } },
      notes: { L01: [{ t: 4, text: '残す', at: 0 }] },
      quiz: { L01: { '0': 2 } },
      prefs: { rate: 1, cc: true, follow: false },
    });
    expect(store.last()).toBeNull();
    expect(store.tab()).toBeNull();
  });

  test('localStorage を使えない（null・読み書きで例外）ときは、既定の値を返し、書けなくても止めない', () => {
    const throwing: KeyValueStore = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    for (const storage of [null, throwing]) {
      const store = openStore(storage, 'chalkfile:x:');
      expect(store.read()).toEqual({ progress: {}, notes: {}, quiz: {}, prefs: { rate: 1, cc: true, follow: true } });
      expect(() => store.saveProgress({ L01: { t: 1, max: 0.1, done: false } })).not.toThrow();
    }
  });
});
