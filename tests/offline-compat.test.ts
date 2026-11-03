import { describe, expect, test } from 'bun:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import config from '../site/config.json';
import {
  checkSavedVersion, parseQuarantineName, parseRecord, planCleanup, QUARANTINE_DAYS, quarantineName, recordCaches, validateManifest,
  type CleanupInput, type SavedRecord,
} from '../site/offline-shared';

// 利用者が保存した記録（tests/fixtures/saved-records/<日付>/）を、今の読み込みが全部受け入れることを確かめる。
// 落ちたら、保存した講座が読めなくなる（隔離のあと 30 日で消える）。検証を元に戻すか、移行のコードを足す。fixture を書き換えて通さない。
// 決まりは docs/architecture/offline.md の「保存データの互換」
type Era = { scope: string; prefix: string; reader: 'sw' | 'legacy-sw'; mediaRoots: Record<string, string> };
const fixtures = path.join(import.meta.dir, 'fixtures/saved-records');
const read = <T>(file: string) => JSON.parse(readFileSync(file, 'utf8')) as T;
const DAY = 24 * 60 * 60 * 1000;
/** 訳の言語を公開したときの mediaRoots（site/config.json の media）。増えても日本語の講座の記録は読める */
const publishedRoots = Object.fromEntries(Object.entries(config.media).map(([lang, m]) => [lang, new URL(m.url).pathname]));

for (const date of readdirSync(fixtures).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))) {
  const { eras } = read<{ eras: Record<string, Era> }>(path.join(fixtures, date, 'index.json'));
  for (const [name, era] of Object.entries(eras)) {
    const dir = path.join(fixtures, date, name);
    const folders = readdirSync(dir).filter((d) => existsSync(path.join(dir, d, 'offline-manifest.json')));
    const records = folders.flatMap((folder) => readdirSync(path.join(dir, folder)).filter((f) => /^record.*\.json$/.test(f))
      .map((file) => ({ id: decodeURIComponent(folder), file, value: read<SavedRecord>(path.join(dir, folder, file)) })));
    describe(`保存の記録 ${date} ${name}（${era.scope}）`, () => {
      test('講座の教材情報と記録がそろっている', () => {
        expect(folders.length).toBeGreaterThan(0);
        expect(records.filter((r) => r.file === 'record.json')).toHaveLength(folders.length);
      });
      for (const folder of folders) {
        const id = decodeURIComponent(folder);
        test(`${id}: 教材情報（offline-manifest.json）を今の validateManifest が受け入れる`, () => {
          const m = read<unknown>(path.join(dir, folder, 'offline-manifest.json'));
          expect(validateManifest(m, id, era.scope, era.mediaRoots).id).toBe(id);
          if (era.reader === 'sw') expect(validateManifest(m, id, era.scope, publishedRoots).id).toBe(id);
        });
      }
      for (const { id, file, value } of records) test(`${id}: 保存の記録（${file}）を今の読み込みが受け入れる`, () => {
        // sw.ts は 1 つでも読めない版があれば記録全体を読めないとする。旧 Pages の legacy-sw.ts は、読める版だけを使う
        // （versions() が checkSavedVersion と同じ確かめ方をする。公開中の移行 SW とバイト列を変えないため、T6-01 まで手を入れない）
        if (era.reader === 'sw') expect(parseRecord(value, id, era.scope, era.prefix, era.mediaRoots).versions).toHaveLength(value.versions.length);
        for (const v of value.versions) expect(checkSavedVersion(v, id, era.scope, era.prefix, era.mediaRoots).cache).toBe(v.cache);
      });
      for (const { id, value } of records.filter((r) => r.file === 'record-updated.json')) test(`${id}: 更新して保存した記録は、新しい版の後ろに前の版をそのまま残す`, () => {
        const before = records.find((r) => r.id === id && r.file === 'record.json')!.value;
        expect(value.versions).toHaveLength(2);
        expect(value.versions[1]).toEqual(before.versions[0]);
        expect(value.versions[0].manifest.revision).not.toBe(before.versions[0].manifest.revision);
      });
      if (era.reader === 'sw') test('保存したあとの Cache を、今の cleanup は 1 つも消さず、隔離もしない', () => {
        const { caches } = read<{ caches: string[] }>(path.join(dir, 'caches.json'));
        const keep = new Set([`${era.prefix}registry`, ...caches.filter((n) => n.startsWith(`${era.prefix}shell:`))]);
        for (const r of records.filter((x) => x.file === 'record.json')) for (const v of parseRecord(r.value, r.id, era.scope, era.prefix, era.mediaRoots).versions) keep.add(v.cache);
        for (const oldShell of [false, true]) {
          expect(planCleanup({ names: caches, prefix: era.prefix, keep, held: { caches: new Set(), ids: new Set() }, oldShell, now: Date.now() }))
            .toEqual({ remove: [], create: [] });
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
      { versions: [{ ...record().versions[0], manifest: { ...record().versions[0].manifest, pageVersion: 'x' } }] },
      { versions: [null] }, { versions: 'x' }, null, 'x',
    ];
    for (const value of broken) expect(() => parseRecord(value, 'pstack-comedy', scope, prefix)).toThrow();
    expect(parseRecord({ versions: [] }, 'pstack-comedy', scope, prefix).versions).toEqual([]);
  });
  test('読めない記録が指していた Cache の名前を拾う。指す先が分からなければ null', () => {
    const v = record().versions[0];
    expect(recordCaches({ versions: [{ ...v, manifest: null }] }, 'pstack-comedy', prefix)).toEqual([v.cache]);
    expect(recordCaches({ versions: [{ ...v, cache: `${prefix}course:rive-comedy:x` }, { cache: 1 }] }, 'pstack-comedy', prefix)).toBeNull();
    for (const value of [undefined, null, 'x', { versions: 'x' }, { versions: [] }]) expect(recordCaches(value, 'pstack-comedy', prefix)).toBeNull();
  });
});

describe('cleanup の片付けと隔離（planCleanup）', () => {
  const prefix = 'chalkfile:/:offline-v1:';
  const cache = (id: string, n = 1) => `${prefix}course:${id}:${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`;
  const now = Date.UTC(2026, 10, 2, 12);
  const base = (names: string[], over: Partial<CleanupInput> = {}): CleanupInput => ({
    names: [`${prefix}registry`, `${prefix}shell:new`, ...names], prefix, keep: new Set([`${prefix}registry`, `${prefix}shell:new`]),
    held: { caches: new Set(), ids: new Set() }, oldShell: false, now, ...over,
  });
  const sorted = (plan: { remove: string[]; create: string[] }) => ({ remove: [...plan.remove].sort(), create: [...plan.create].sort() });

  test('記録が指さない講座の Cache（途中で終わった保存・更新で外れた版）は消す。ほかのアプリの Cache には触れない', () => {
    const input = base([cache('a'), cache('b'), 'neighbor-app', 'chalkfile:/chalkfile/:offline-v1:course:a:x', `quarantine:${now}:neighbor-app`]);
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
    expect(sorted(planCleanup(base([cache('a'), old], { held })))).toEqual({ remove: [cache('a'), old].sort(), create: [] });
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
    const input = base([cache('a'), cache('a', 2), cache('ab'), cache('en/a')], { held: { caches: new Set(), ids: new Set(['a']) } });
    expect(sorted(planCleanup(input))).toEqual({ remove: [cache('ab'), cache('en/a')].sort(), create: [quarantineName(cache('a'), now), quarantineName(cache('a', 2), now)].sort() });
  });
  test('中身の無い印は外し、未来の時刻の印（端末の時計のずれ）は今の時刻で付け直す', () => {
    const held = { caches: new Set([cache('a')]), ids: new Set<string>() };
    const dangling = quarantineName(cache('b'), now - DAY);
    const future = quarantineName(cache('a'), now + 400 * DAY);
    expect(sorted(planCleanup(base([cache('a'), dangling, future], { held })))).toEqual({ remove: [dangling, future].sort(), create: [quarantineName(cache('a'), now)] });
  });
  test('activate のときだけ、今の shell 以外の shell を消す', () => {
    expect(planCleanup(base([`${prefix}shell:old`]))).toEqual({ remove: [], create: [] });
    expect(planCleanup(base([`${prefix}shell:old`], { oldShell: true }))).toEqual({ remove: [`${prefix}shell:old`], create: [] });
  });
});
