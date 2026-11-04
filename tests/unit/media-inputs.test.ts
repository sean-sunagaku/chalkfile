// 動画の一覧の版 2（項目の inputs。書き出したときの台本と描き方の指紋）。版 1 も読めること・Worker の許可リストが変わらないこと・
// media push が書き出しの記録から inputs を書くこと・台本が変わった動画を置く前に止めること・CI の確かめ（validate）の誤り・注意・知らせ。
// gh は偽物で、ファイルは一時のフォルダにだけ書く（Releases には何も置かない）
import { required } from '../support/required';
import { afterAll, describe, expect, spyOn, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { VIDEOS } from '../../content';
import { mediaListFile, timelineFile } from '../../engine/core/generated';
import { type Gh, pushMedia, readMediaManifest } from '../../scripts/media';
import {
  courseMediaJson,
  type MediaInputs,
  mediaListFiles,
  mediaManifestJson,
  parseCourseMedia,
  readCourseMedia,
  readCourseMediaFile,
} from '../../scripts/media-lists';
import { fileHasher } from '../../scripts/stages/pipeline/digest';
import { STATE_SCHEMA, writeState } from '../../scripts/stages/pipeline/state';
import { currentInputs, type PublishedCheck, srcDigest } from '../../scripts/stages/video/inputs';
import { mediaInputProblems } from '../../scripts/validate';
import type { MediaEntry } from '../../site/media-shared';

const ROOT = path.resolve(import.meta.dir, '../..');
// 版 1 の互換性は、公開中の一覧が版 2 に進んでも同じ見本で確かめる。
const LEGACY_RIVE = readFileSync(path.join(ROOT, 'tests/fixtures/media/rive-v1.json'), 'utf8');
const sandbox = mkdtempSync(path.join(os.tmpdir(), 'chalkfile-media-inputs-'));
afterAll(() => rmSync(sandbox, { recursive: true, force: true }));
let n = 0;
const sha = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
const A: MediaInputs = { script: '0123456789abcdef', src: 'fedcba9876543210' };

/** Rive は版 1 の固定見本、ほかは本物の一覧を写す（Rive の timeline も写す） */
const box = () => {
  const root = mkdtempSync(path.join(sandbox, `b${++n}-`));
  for (const f of mediaListFiles()) {
    mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    cpSync(f, path.join(root, f));
  }
  const put = (file: string, body: string) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), body);
  };
  put(mediaListFile('rive-comedy', 'ja'), LEGACY_RIVE);
  put(timelineFile('rive-comedy', 'R01'), readFileSync(path.join(ROOT, timelineFile('rive-comedy', 'R01')), 'utf8'));
  return { root, put, read: (file: string) => readFileSync(path.join(root, file), 'utf8') };
};

describe('動画の一覧の版 1 と 2', () => {
  const list = parseCourseMedia(JSON.parse(LEGACY_RIVE)).manifest;
  test('inputs が 1 つも無ければ、版 1 の見本と同じバイト列で書く', () => {
    expect(courseMediaJson(list, new Map())).toBe(LEGACY_RIVE);
  });
  test('inputs のある一覧は版 2 で書き、読むと inputs を外した版 1 の形と、ファイル名 → inputs が返る', () => {
    const inputs = new Map([[required(list.entries[0]).filename, A]]);
    const text = courseMediaJson(list, inputs);
    const v = JSON.parse(text);
    expect(v.schema).toBe(2);
    expect(v.entries[0].inputs).toEqual(A);
    expect(v.entries[1].inputs).toBeUndefined();
    const parsed = parseCourseMedia(v);
    expect(parsed.schema).toBe(2);
    expect(parsed.manifest).toEqual(list);
    expect([...parsed.inputs]).toEqual([[required(list.entries[0]).filename, A]]);
  });
  test('版 1 の一覧に inputs がある・inputs の形が違う・知らない版は止める', () => {
    const e = { ...list.entries[0], inputs: A };
    expect(() => parseCourseMedia({ schema: 1, entries: [e] })).toThrow('版 1 の一覧に inputs がある');
    for (const bad of [{ script: 'x', src: A.src }, { script: A.script }, { ...A, audio: A.src }, 'abc'])
      expect(() => parseCourseMedia({ schema: 2, entries: [{ ...e, inputs: bad }] })).toThrow('inputs の形が違う');
    expect(() => parseCourseMedia({ schema: 3, entries: [] })).toThrow('形の版が違う');
  });
  test('版 2 の一覧があっても、Worker の許可リスト（全講座の一覧）は同じバイト列', () => {
    const b = box();
    try {
      const before = mediaManifestJson(readMediaManifest(b.root));
      const file = mediaListFile('rive-comedy', 'ja');
      const m = readCourseMedia('rive-comedy', 'ja', b.root);
      if (!m) throw new Error('一覧が無い');
      b.put(file, courseMediaJson(m, new Map(m.entries.map((e) => [e.filename, A]))));
      expect(JSON.parse(b.read(file)).schema).toBe(2);
      expect(mediaManifestJson(readMediaManifest(b.root))).toBe(before);
      expect(readCourseMediaFile('rive-comedy', 'ja', b.root)?.inputs.size).toBe(m.entries.length);
    } finally {
      rmSync(b.root, { recursive: true, force: true });
    }
  });
});

describe('media push --course が書く inputs（gh は偽物）', () => {
  /** Releases の偽物（タグごとの asset）。gh の呼び方は scripts/media.ts と同じ */
  const fakeReleases = (seed: Record<string, MediaEntry[]>) => {
    const releases = Object.entries(seed).map(([tag, es], i) => ({
      tag,
      id: i + 1,
      assets: es.map((e) => ({ name: e.filename, size: e.bytes, state: 'uploaded', digest: `sha256:${e.sha256}` })),
    }));
    const calls: string[][] = [];
    const gh: Gh = (args) => {
      calls.push(args);
      const [cmd, ...rest] = args;
      const target = rest.filter((a) => !a.startsWith('--'))[0] ?? '';
      if (cmd === 'api' && target === 'repos/sean-sunagaku/chalkfile')
        return JSON.stringify({ default_branch: 'main' });
      if (cmd === 'api' && target.startsWith('repos/sean-sunagaku/chalkfile/releases?'))
        return JSON.stringify([releases.map((r) => ({ tag_name: r.tag }))]);
      const byTag = /releases\/tags\/(.+)$/.exec(target);
      if (cmd === 'api' && byTag) {
        const r = releases.find((x) => x.tag === byTag[1]);
        if (!r) throw new Error('HTTP 404');
        return JSON.stringify({ id: r.id, draft: false });
      }
      const assets = /releases\/(\d+)\/assets/.exec(target);
      if (cmd === 'api' && assets)
        return JSON.stringify([releases.find((r) => r.id === Number(assets[1]))?.assets ?? []]);
      if (cmd === 'release' && rest[0] === 'upload') {
        const r = releases.find((x) => x.tag === rest[1]);
        if (!r) throw new Error('release が無い');
        for (const f of rest.slice(rest.indexOf('--repo') + 2))
          r.assets.push({
            name: path.basename(f),
            size: readFileSync(f).length,
            state: 'uploaded',
            digest: `sha256:${sha(readFileSync(f))}`,
          });
        return '';
      }
      throw new Error(`知らない gh: ${args.join(' ')}`);
    };
    return { gh, calls };
  };
  const today = new Date('2026-11-03T12:00:00Z');
  // biome-ignore lint/style/noNonNullAssertion: 本物の講座の動画
  const r01 = VIDEOS.find((v) => v.key === 'R01')!;
  /** 手元の動画と、その書き出しの記録（parts は今の指紋。patch で替える） */
  const rendered = (b: ReturnType<typeof box>, body: string, patch: Partial<MediaInputs> = {}) => {
    b.put('site/media/R01.mp4', `${body} 通常版`);
    b.put('site/media/R01.cc.mp4', `${body} 字幕版`);
    const now = currentInputs(b.root, r01, srcDigest(b.root, fileHasher(b.root, null)));
    const parts = { script: now.script ?? '', src: now.src, audio: 'aaaaaaaaaaaaaaaa', ...patch };
    writeState(b.root, {
      schema: STATE_SCHEMA,
      stage: 'render',
      unit: 'R01',
      fingerprint: 'f',
      parts,
      outputs: {
        'site/media/R01.mp4': { sha256: sha(`${body} 通常版`), bytes: 1 },
        'site/media/R01.cc.mp4': { sha256: sha(`${body} 字幕版`), bytes: 1 },
      },
      tools: {},
      at: '',
    });
    return { script: parts.script, src: parts.src };
  };
  const quietWarn = () => spyOn(console, 'warn').mockImplementation(() => {});
  const file = mediaListFile('rive-comedy', 'ja');

  test('書き出しの記録のある動画には inputs を書き（版 2）、ほかの講座の一覧には触らない', async () => {
    const b = box();
    const warn = quietWarn();
    try {
      const others = Object.fromEntries(
        mediaListFiles(b.root)
          .filter((f) => f !== file)
          .map((f) => [f, b.read(f)]),
      );
      const old = readMediaManifest(b.root).entries.filter((e) => e.course === 'rive-comedy');
      const want = rendered(b, '新しい');
      const { gh } = fakeReleases({ 'media-ja-rive-comedy': old });
      await pushMedia({ courses: ['rive-comedy'], lang: 'ja', root: b.root, gh, today, log: () => {} });
      const v = JSON.parse(b.read(file));
      expect(v.schema).toBe(2);
      expect(v.entries.map((e: { kind: string; inputs: MediaInputs }) => [e.kind, e.inputs])).toEqual([
        ['standard', want],
        ['captioned', want],
      ]);
      // 前の動画は retained に回る（前の一覧に inputs が無ければ、retained にも無い）
      expect(v.retained.every((e: { inputs?: unknown }) => e.inputs === undefined)).toBe(true);
      for (const [f, text] of Object.entries(others)) expect(`${f} ${b.read(f) === text}`).toBe(`${f} true`);
    } finally {
      warn.mockRestore();
      rmSync(b.root, { recursive: true, force: true });
    }
  });
  test('書き出したあとで台本が変わった動画（記録の script が今と違う）は、Releases に何も置かずに止める', async () => {
    const b = box();
    const warn = quietWarn();
    try {
      rendered(b, '古い', { script: 'ffffffffffffffff' });
      const before = b.read(file);
      const { gh, calls } = fakeReleases({});
      await expect(
        pushMedia({ courses: ['rive-comedy'], lang: 'ja', root: b.root, gh, today, log: () => {} }),
      ).rejects.toThrow(
        '書き出したあとで台本が変わった動画がある（置くと、CI が動画を古いと止める）: ja/rive-comedy/R01/standard ja/rive-comedy/R01/captioned',
      );
      expect(calls).toEqual([]);
      expect(b.read(file)).toBe(before);
    } finally {
      warn.mockRestore();
      rmSync(b.root, { recursive: true, force: true });
    }
  });
  test('描き方のコードだけが違うときは知らせて置く。記録の無い動画は知らせて inputs を書かない（retained に回った前の動画の inputs は残す）', async () => {
    const b = box();
    const warn = quietWarn();
    try {
      rendered(b, 'src', { src: 'ffffffffffffffff' });
      const old = readMediaManifest(b.root).entries.filter((e) => e.course === 'rive-comedy');
      await pushMedia({
        courses: ['rive-comedy'],
        lang: 'ja',
        root: b.root,
        gh: fakeReleases({ 'media-ja-rive-comedy': old }).gh,
        today,
        log: () => {},
      });
      expect(warn.mock.calls.map((c) => String(c[0])).join('\n')).toContain(
        '描き方のコード（src など）が変わった動画: ja/rive-comedy/R01/standard',
      );
      expect(JSON.parse(b.read(file)).entries[0].inputs.src).toBe('ffffffffffffffff');
      // 記録を消して、手元の動画を別のものにすると（記録が無い）、inputs は書かない
      rmSync(path.join(b.root, '.work/state'), { recursive: true, force: true });
      b.put('site/media/R01.mp4', '記録の無い通常版');
      b.put('site/media/R01.cc.mp4', '記録の無い字幕版');
      const now = readMediaManifest(b.root).entries.filter((e) => e.course === 'rive-comedy');
      warn.mockClear();
      await pushMedia({
        courses: ['rive-comedy'],
        lang: 'ja',
        root: b.root,
        gh: fakeReleases({ 'media-ja-rive-comedy': [...old, ...now] }).gh,
        today,
        log: () => {},
      });
      expect(warn.mock.calls.map((c) => String(c[0])).join('\n')).toContain(
        '書き出しの記録が無いので、inputs を書かない動画',
      );
      const v = JSON.parse(b.read(file));
      // retained に回った前の動画は、前の一覧の inputs を残すので、版 2 のまま
      expect(v.schema).toBe(2);
      expect(v.entries.every((e: { inputs?: unknown }) => e.inputs === undefined)).toBe(true);
      expect(v.retained.filter((e: { inputs?: unknown }) => e.inputs).length).toBe(2);
      // 版 2 に進んだあと、さらに更新しても最初の版の動画を残す。
      for (const e of old) expect(v.retained.some((r: MediaEntry) => r.sha256 === e.sha256)).toBe(true);
    } finally {
      warn.mockRestore();
      rmSync(b.root, { recursive: true, force: true });
    }
  });
  test('同じ動画をもう一度置くときは、記録が無くても、前の一覧の inputs を引き継ぐ', async () => {
    const b = box();
    const warn = quietWarn();
    try {
      const want = rendered(b, '同じ');
      const old = readMediaManifest(b.root).entries.filter((e) => e.course === 'rive-comedy');
      const { gh } = fakeReleases({ 'media-ja-rive-comedy': old });
      await pushMedia({ courses: ['rive-comedy'], lang: 'ja', root: b.root, gh, today, log: () => {} });
      const first = b.read(file);
      rmSync(path.join(b.root, '.work/state'), { recursive: true, force: true });
      const now = readMediaManifest(b.root).entries.filter((e) => e.course === 'rive-comedy');
      await pushMedia({
        courses: ['rive-comedy'],
        lang: 'ja',
        root: b.root,
        gh: fakeReleases({ 'media-ja-rive-comedy': [...old, ...now] }).gh,
        today,
        log: () => {},
      });
      expect(b.read(file)).toBe(first);
      expect(JSON.parse(b.read(file)).entries[0].inputs).toEqual(want);
    } finally {
      warn.mockRestore();
      rmSync(b.root, { recursive: true, force: true });
    }
  });
});

describe('CI の確かめ（validate の mediaInputProblems）', () => {
  // biome-ignore lint/style/noNonNullAssertion: 本物の講座の動画
  const g01 = VIDEOS.find((v) => v.key === 'G01')!;
  // biome-ignore lint/style/noNonNullAssertion: 本物の講座の動画
  const g02 = VIDEOS.find((v) => v.key === 'G02')!;
  const check = (
    video: typeof g01,
    kind: 'standard' | 'captioned',
    result: PublishedCheck['result'],
  ): PublishedCheck => ({
    video,
    file: mediaListFile(video.course.id, video.lang),
    kind,
    result,
  });
  test('台本が変わったのに動画が古ければ誤り（動画ごとに 1 件。通常版と字幕版をまとめる）', () => {
    const r = mediaInputProblems([
      check(g01, 'standard', 'script'),
      check(g01, 'captioned', 'script'),
      check(g02, 'standard', 'same'),
    ]);
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0]).toMatchObject({ level: 'error', rule: 'inputs', where: 'ga4-comedy/G01' });
    expect(required(r.issues[0]).message).toContain('通常版・字幕版');
    expect(required(r.issues[0]).message).toContain('npm run chalk -- build --to render --video G01');
    expect(r.notices).toEqual([]);
  });
  test('描き方のコードだけが変わったときは注意（一覧のファイルごとに 1 件）。inputs の無い項目は、知らせを 1 行だけ', () => {
    const r = mediaInputProblems([
      check(g01, 'standard', 'src'),
      check(g02, 'standard', 'src'),
      check(g02, 'captioned', 'none'),
      check(g01, 'captioned', 'unknown'),
    ]);
    expect(r.issues.map((x) => [x.level, x.where])).toEqual([
      ['warning', 'content/ga4-comedy/generated/media.ja.json'],
    ]);
    expect(required(r.issues[0]).message).toContain('2 本（G01 G02）');
    expect(r.notices).toEqual([expect.stringContaining('書き出しの記録（inputs）の無い動画が 1 本（1 個の一覧）')]);
  });
  test('今の本物の一覧は、どれも誤りにならない（記録の無い一覧は知らせだけ）', async () => {
    const { validateAll } = await import('../../scripts/validate');
    const report = await validateAll();
    expect(report.issues.filter((x) => x.rule === 'inputs' && x.level === 'error')).toEqual([]);
  });
});
