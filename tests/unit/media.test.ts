import { required } from '../support/required';
import { describe, expect, spyOn, test } from 'bun:test';
import {
  RETAIN_DAYS,
  allMediaEntries,
  expiredRetained,
  mediaFilename,
  mediaPath,
  releaseUrl,
  retainDeadline,
  retainedWarnings,
  validateMediaManifest,
  type MediaEntry,
} from '../../site/media-shared';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { COURSES } from '../../content';
import { mediaListFile, posterFile } from '../../engine/core/generated';
import { redact } from '../../scripts/lib/proc';
import {
  ghTimeoutMs,
  ghWith,
  mediaLimitProblems,
  pushMedia,
  readMediaManifest,
  readOnlyGh,
  retainEntries,
  verifyReleaseAssets,
  warnExpiredRetained,
  type Gh,
} from '../../scripts/media';
import type { RunOptions, RunResult } from '../../scripts/lib/proc';
import { mediaListFiles, readMediaLists } from '../../scripts/media-lists';
import {
  OFFLINE_COURSE_MAX_BYTES,
  OFFLINE_COURSE_MAX_FILES,
  OFFLINE_FILE_MAX_BYTES,
  RELEASE_MAX_ASSETS,
} from '../../site/limits';
const entry: MediaEntry = {
  lang: 'ja',
  course: 'sample',
  lecture: 'L01',
  kind: 'standard',
  sha256: 'a'.repeat(64),
  bytes: 100,
  filename: `L01.${'a'.repeat(64)}.mp4`,
  tag: 'media-ja-sample',
};
describe('動画の許可リスト', () => {
  test('hash付きの固定リポジトリとパス', () => {
    expect(validateMediaManifest({ schema: 1, entries: [entry] }).entries).toHaveLength(1);
    expect(mediaPath(entry)).toBe(`/media/ja/sample/${entry.filename}`);
    expect(releaseUrl(entry)).toBe(
      `https://github.com/sean-sunagaku/chalkfile/releases/download/media-ja-sample/${entry.filename}`,
    );
  });
  for (const patch of [
    { lang: '../en' },
    { course: '../other' },
    { lecture: 'L01?q=1' },
    { kind: 'other' },
    { sha256: 'bad' },
    { bytes: 0 },
    { bytes: 2 * 1024 ** 3 },
    { filename: 'https://example.com/video.mp4' },
    { tag: 'other' },
  ]) {
    test(`形式の拒否 ${JSON.stringify(patch)}`, () =>
      expect(() => validateMediaManifest({ schema: 1, entries: [{ ...entry, ...patch }] })).toThrow());
  }
  test('重複と通常版のない字幕版を拒否', () => {
    expect(() => validateMediaManifest({ schema: 1, entries: [entry, entry] })).toThrow();
    const cc = { ...entry, kind: 'captioned' as const };
    expect(() => validateMediaManifest({ schema: 1, entries: [{ ...cc, filename: mediaFilename(cc) }] })).toThrow();
  });
  test('更新前のhashはretainedで許可リストに残し、公開する現行版と区別する', () => {
    const old = { ...entry, sha256: 'b'.repeat(64) };
    old.filename = mediaFilename(old);
    const m = validateMediaManifest({ schema: 1, entries: [entry], retained: [old] });
    expect(m.entries).toHaveLength(1);
    expect(allMediaEntries(m)).toHaveLength(2);
    expect(() => validateMediaManifest({ ...m, retained: [entry] })).toThrow();
  });
  test('Releases の欠落・サイズ違い・ハッシュ違いを公開前に拒否', () => {
    const asset = { name: entry.filename, size: entry.bytes, state: 'uploaded', digest: `sha256:${entry.sha256}` };
    expect(() => verifyReleaseAssets([entry], [asset])).not.toThrow();
    for (const assets of [
      [],
      [{ ...asset, size: 99 }],
      [{ ...asset, digest: 'sha256:bad' }],
      [{ ...asset, state: 'new' }],
    ]) {
      expect(() => verifyReleaseAssets([entry], assets)).toThrow();
    }
  });
});
describe('retained の期限', () => {
  const hashed = (c: string): MediaEntry => {
    const e = { ...entry, sha256: c.repeat(64) };
    return { ...e, filename: mediaFilename(e) };
  };
  test('期限は retained に入れた日から 90 日（UTC の日付。その日までは期限内）', () => {
    expect(RETAIN_DAYS).toBe(90);
    expect(retainDeadline(new Date('2026-11-02T23:30:00Z'))).toBe('2027-01-31');
    const m = validateMediaManifest({
      schema: 1,
      entries: [entry],
      retained: [{ ...hashed('b'), retainedUntil: '2027-01-31' }],
    });
    expect(expiredRetained(m, new Date('2027-01-31T23:59:59Z'))).toHaveLength(0);
    expect(expiredRetained(m, new Date('2027-02-01T00:00:00Z'))).toHaveLength(1);
  });
  test('期限の無い古い retained も読め、期限切れとは数えない', () => {
    const m = validateMediaManifest({ schema: 1, entries: [entry], retained: [hashed('b')] });
    expect(expiredRetained(m, new Date('2100-01-01T00:00:00Z'))).toHaveLength(0);
  });
  test('retainedUntil は retained の項目にだけ、正しい日付で付ける', () => {
    for (const retainedUntil of ['2027-02-30', '2027-1-31', '2027-01-31T00:00:00Z', '', 20270131, null]) {
      expect(() =>
        validateMediaManifest({ schema: 1, entries: [entry], retained: [{ ...hashed('b'), retainedUntil }] }),
      ).toThrow();
    }
    expect(() => validateMediaManifest({ schema: 1, entries: [{ ...entry, retainedUntil: '2027-01-31' }] })).toThrow();
  });
  test('push は一覧から外れた現行版に 90 日の期限を付け、retained の期限は変えない（無いものには付ける）', () => {
    const today = new Date('2026-11-02T12:00:00Z');
    const previous = validateMediaManifest({
      schema: 1,
      entries: [hashed('b')],
      retained: [{ ...hashed('c'), retainedUntil: '2026-12-01' }, hashed('d')],
    });
    const retained = retainEntries(previous, [hashed('f')], today);
    expect(retained.map((e) => [e.sha256[0], e.retainedUntil])).toEqual([
      ['b', '2027-01-31'],
      ['c', '2026-12-01'],
      ['d', '2027-01-31'],
    ]);
    expect(() => validateMediaManifest({ schema: 1, entries: [hashed('f')], retained })).not.toThrow();
    // 元のハッシュに戻したら、retained から外す
    expect(retainEntries(previous, [hashed('c')], today).map((e) => e.sha256[0])).toEqual(['b', 'd']);
    expect(retainEntries(null, [hashed('f')], today)).toEqual([]);
  });
  test('期限切れは警告するだけで、失敗にしない', () => {
    const later = new Date('2027-01-01T00:00:00Z');
    const m = validateMediaManifest({
      schema: 1,
      entries: [entry],
      retained: [
        { ...hashed('b'), retainedUntil: '2026-12-01' },
        { ...hashed('c'), retainedUntil: '2027-12-01' },
      ],
    });
    expect(retainedWarnings(m, later)).toEqual([expect.stringContaining(mediaPath(hashed('b')))]);
    const spy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(warnExpiredRetained(m, later)).toBe(1);
      expect(String(spy.mock.calls[0]?.[0])).toContain('2026-12-01');
      expect(warnExpiredRetained(validateMediaManifest({ schema: 1, entries: [entry] }), later)).toBe(0);
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });
});
describe('動画の一覧が、保存と Releases の上限に収まるか（mediaLimitProblems。push と check が使う）', () => {
  const MiB = 1024 ** 2;
  const video = (lecture: string, o: Partial<MediaEntry> = {}): MediaEntry => {
    const e = { ...entry, lecture, sha256: 'a'.repeat(64), ...o };
    return { ...e, filename: mediaFilename(e) };
  };
  const lectures = (n: number, o: Partial<MediaEntry> = {}) =>
    Array.from({ length: n }, (_, i) => video(`L${String(i + 1).padStart(3, '0')}`, o));
  test('今の一覧は収まる', () => {
    expect(mediaLimitProblems(readMediaManifest())).toEqual([]);
  });
  test('保存の 1 ファイルの上限を超える動画を止める（ちょうどは通す）', () => {
    expect(mediaLimitProblems({ schema: 1, entries: [video('L01', { bytes: OFFLINE_FILE_MAX_BYTES })] })).toEqual([]);
    expect(mediaLimitProblems({ schema: 1, entries: [video('L01', { bytes: OFFLINE_FILE_MAX_BYTES + 1 })] })).toEqual([
      '動画が保存の 1 ファイルの上限（32.0 MiB）を超えています: ja/sample/L01/standard（32.0 MiB）',
    ]);
  });
  test('講座の動画の合計が、保存の 1 講座の上限を超えたら止める', () => {
    const fits = lectures(OFFLINE_COURSE_MAX_BYTES / OFFLINE_FILE_MAX_BYTES, { bytes: OFFLINE_FILE_MAX_BYTES });
    expect(mediaLimitProblems({ schema: 1, entries: fits })).toEqual([]);
    expect(mediaLimitProblems({ schema: 1, entries: [...fits, video('L999', { bytes: MiB })] })).toEqual([
      '講座の動画の合計が、保存の 1 講座の上限（1024.0 MiB）を超えています: ja/sample（1025.0 MiB）',
    ]);
  });
  test('講座の保存のファイルの数（ページとポスターも数える）が上限を超えたら止める', () => {
    const fits = lectures((OFFLINE_COURSE_MAX_FILES - 1) / 2);
    expect(mediaLimitProblems({ schema: 1, entries: fits })).toEqual([]);
    const cc = { ...required(fits[0]), kind: 'captioned' as const };
    expect(mediaLimitProblems({ schema: 1, entries: [...fits, { ...cc, filename: mediaFilename(cc) }] })).toEqual([
      `講座の保存のファイルの数が、上限（${OFFLINE_COURSE_MAX_FILES}）を超えています: ja/sample（ページとポスターを入れて ${OFFLINE_COURSE_MAX_FILES + 1}）`,
    ]);
  });
  test('1 つの Release に置く数（retained も数える）が上限を超えたら止める', () => {
    const old = (n: number) =>
      Array.from({ length: n }, (_, i) => video('L001', { sha256: i.toString(16).padStart(64, '0') }));
    expect(mediaLimitProblems({ schema: 1, entries: [video('L001')], retained: old(RELEASE_MAX_ASSETS - 1) })).toEqual(
      [],
    );
    expect(mediaLimitProblems({ schema: 1, entries: [video('L001')], retained: old(RELEASE_MAX_ASSETS) })).toEqual([
      `Release の ${RELEASE_MAX_ASSETS} asset 上限を超えます: media-ja-sample（一覧に ${RELEASE_MAX_ASSETS + 1} 本）`,
    ]);
  });
});

describe('講座ごとの動画の一覧（content/<講座>/generated/media.<言語>.json）', () => {
  test('全講座の一覧は、講座の登録の順につなぎ、どの講座の一覧も自分の講座と言語の動画だけを持つ', () => {
    const all = readMediaManifest();
    expect([...new Set(all.entries.map((e) => e.course))]).toEqual(
      COURSES.map((c) => c.id).filter((id) => all.entries.some((e) => e.course === id)),
    );
    for (const f of mediaListFiles()) {
      const m = JSON.parse(readFileSync(f, 'utf8'));
      const [, course, lang] = /^content\/([^/]+)\/generated\/media\.([a-z]+)\.json$/.exec(f) ?? [];
      for (const e of m.entries) expect(`${e.course}/${e.lang}`).toBe(`${course}/${lang}`);
    }
  });
  test('登録に無い講座の一覧があれば止める（消した講座の動画を黙って配らない）', () => {
    expect(() => readMediaLists(COURSES.slice(1).map((c) => c.id))).toThrow(
      '登録に無い講座か、知らない言語の動画の一覧がある',
    );
  });
});

describe('media push --course（その講座だけを手元から作り、ほかの講座の一覧に触らない）', () => {
  const sha = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
  /** Releases の偽物（タグごとの asset）。gh の呼び方は scripts/media.ts と同じ */
  const fakeReleases = (seed: Record<string, MediaEntry[]>) => {
    const releases = Object.entries(seed).map(([tag, es], i) => ({
      tag,
      id: i + 1,
      target: '',
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
      if (cmd === 'release' && rest[0] === 'create') {
        releases.push({
          tag: required(rest[1]),
          id: releases.length + 1,
          target: required(rest[rest.indexOf('--target') + 1]),
          assets: [],
        });
        return '';
      }
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
    return { gh, releases, calls };
  };
  const sandbox = () => {
    const root = mkdtempSync(path.join(tmpdir(), 'chalkfile-media-push-'));
    for (const f of mediaListFiles()) {
      mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
      cpSync(f, path.join(root, f));
    }
    const put = (file: string, body: string) => {
      mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      writeFileSync(path.join(root, file), body);
    };
    // 公開中の一覧に保持動画や inputs が増えても、最初の更新の条件は固定する。
    put(
      mediaListFile('rive-comedy', 'ja'),
      readFileSync(path.join(import.meta.dir, '../fixtures/media/rive-v1.json'), 'utf8'),
    );
    return { root, put, read: (file: string) => readFileSync(path.join(root, file), 'utf8') };
  };
  const today = new Date('2026-11-03T12:00:00Z');

  test('選んだ講座だけ、新しいハッシュを置いて一覧を書き直し、前のハッシュは retained に回す。ほかの講座の一覧は 1 バイトも変えない', async () => {
    const box = sandbox();
    try {
      const before = Object.fromEntries(mediaListFiles(box.root).map((f) => [f, box.read(f)]));
      const old = readMediaManifest(box.root).entries.filter((e) => e.course === 'rive-comedy');
      const { gh, releases, calls } = fakeReleases({ 'media-ja-rive-comedy': old });
      box.put('site/media/R01.mp4', '新しい通常版');
      box.put('site/media/R01.cc.mp4', '新しい字幕つきの版');
      box.put('site/media/R01.jpg', 'ポスター');
      // ほかの講座の手元の動画が一覧と違っても、push しないで知らせるだけ
      box.put('site/media/W01.mp4', '書き出し直したが push していない');
      const warn = spyOn(console, 'warn').mockImplementation(() => {});
      const lines: string[] = [];
      await pushMedia({
        courses: ['rive-comedy'],
        lang: 'ja',
        root: box.root,
        gh,
        today,
        log: (l) => void lines.push(l),
      });
      const warned = warn.mock.calls.map((c) => String(c[0]));
      warn.mockRestore();
      const file = mediaListFile('rive-comedy', 'ja');
      const now = JSON.parse(box.read(file));
      expect(now.entries.map((e: MediaEntry) => `${e.kind} ${e.sha256}`)).toEqual([
        `standard ${sha('新しい通常版')}`,
        `captioned ${sha('新しい字幕つきの版')}`,
      ]);
      expect(
        now.retained.map((e: MediaEntry & { retainedUntil: string }) => `${e.kind} ${e.sha256} ${e.retainedUntil}`),
      ).toEqual(old.map((e) => `${e.kind} ${e.sha256} 2027-02-01`));
      for (const [f, text] of Object.entries(before))
        if (f !== file) expect(`${f} ${box.read(f) === text}`).toBe(`${f} true`);
      // Release は作り直さず（もうある）、新しい 2 本だけを置く。前の asset は消さない
      expect(calls.some((c) => c[0] === 'release' && c[1] === 'create')).toBe(false);
      expect(required(releases[0]).assets).toHaveLength(old.length + 2);
      expect(box.read(posterFile('rive-comedy', 'R01'))).toBe('ポスター');
      expect(warned.join('\n')).toContain('手元の動画が一覧と違う（push していない）: ja/nudge-comedy/W01/standard');
      expect(lines.join('\n')).toContain(`${file} を書き直した（動画 2 本・retained ${old.length} 本）`);
    } finally {
      rmSync(box.root, { recursive: true, force: true });
    }
  });
  test('Release が無ければ、既定のブランチ（HEAD の SHA ではない）を指して作る', async () => {
    const box = sandbox();
    try {
      const { gh, releases } = fakeReleases({});
      box.put('site/media/P01.mp4', '通常版');
      box.put('site/media/P01.cc.mp4', '字幕つき');
      rmSync(path.join(box.root, mediaListFile('pstack-comedy', 'ja')));
      await pushMedia({ courses: ['pstack-comedy'], lang: 'ja', root: box.root, gh, today, log: () => {} });
      expect(releases.map((r) => `${r.tag} ${r.target} ${r.assets.length}`)).toEqual(['media-ja-pstack-comedy main 2']);
      expect(JSON.parse(box.read(mediaListFile('pstack-comedy', 'ja'))).retained).toBeUndefined();
    } finally {
      rmSync(box.root, { recursive: true, force: true });
    }
  });
  test('講座を選ばない・通常版が手元に無いときは、何も置かずに止まる', async () => {
    const box = sandbox();
    try {
      const { gh, calls } = fakeReleases({});
      await expect(pushMedia({ courses: [], lang: 'ja', root: box.root, gh, today })).rejects.toThrow('--course');
      await expect(pushMedia({ courses: ['ga4-comedy'], lang: 'ja', root: box.root, gh, today })).rejects.toThrow(
        '通常動画がありません: ga4-comedy/G01',
      );
      await expect(pushMedia({ courses: ['no-such-course'], lang: 'ja', root: box.root, gh, today })).rejects.toThrow(
        '講座がありません',
      );
      expect(calls).toEqual([]);
    } finally {
      rmSync(box.root, { recursive: true, force: true });
    }
  });
  test('gh のエラーの出力は、token・Authorization・署名つきの URL の query を伏せてから出す', () => {
    const token = ['ghp', 'A'.repeat(36)].join('_');
    const out = redact(
      `HTTP 401: Bad credentials ${token}\nAuthorization: Bearer abc.def\nGET https://objects.githubusercontent.com/x?X-Amz-Signature=secret&a=1`,
    );
    expect(out).not.toContain(token);
    expect(out).not.toContain('abc.def');
    expect(out).not.toContain('X-Amz-Signature');
    expect(out).toContain('https://objects.githubusercontent.com/x?［伏せた］');
  });
  test('gh の呼び出しには時間切れを付け、読むだけの API は一時の失敗なら待って 3 回まで試す（書き換える呼び出しは流し直さない）', () => {
    const calls: { args: string[]; timeoutMs: number | undefined }[] = [];
    const waits: number[] = [];
    const warned: string[] = [];
    /** 決まった順に結果を返す偽の gh */
    const exec =
      (results: Partial<RunResult>[]) =>
      (_cmd: string, args: string[], opts: RunOptions): RunResult => {
        calls.push({ args, timeoutMs: opts.timeoutMs });
        return { code: 0, stdout: '', stderr: '', timedOut: false, ...results[calls.length - 1] };
      };
    const reset = () => {
      calls.length = 0;
      waits.length = 0;
      warned.length = 0;
    };
    const make = (results: Partial<RunResult>[]) =>
      ghWith(
        exec(results),
        (ms) => void waits.push(ms),
        (l) => void warned.push(l),
      );
    // 読むだけの API は、通信が途中で切れても、流し直して通れば中身を返す
    expect(
      make([{ code: 1, stderr: 'unexpected end of JSON input' }, { stdout: '{"id":1}' }])([
        'api',
        'repos/x/releases/tags/t',
      ]),
    ).toBe('{"id":1}');
    expect(waits).toEqual([1000]);
    expect(warned[0]).toContain('gh api repos/x/releases/tags/t が失敗した（unexpected end of JSON input）');
    // 3 回続けて失敗したら止める（時間切れも失敗として数える）
    reset();
    expect(() =>
      make([
        { code: 1, stderr: 'x' },
        { timedOut: true, code: 1 },
        { code: 1, stderr: 'HTTP 502 ghp_' + 'B'.repeat(36) },
      ])(['api', 'repos/x']),
    ).toThrow(
      'GitHub の操作に失敗しました: api repos/x（認証・権限・通信を確認してください）: HTTP 502 ［伏せた token］',
    );
    expect(waits).toEqual([1000, 2000]);
    // 書き換える呼び出し（upload・create・method を付けた API）は流し直さない
    for (const args of [
      ['release', 'upload', 't', 'a.mp4'],
      ['release', 'create', 't'],
      ['api', '-X', 'DELETE', 'repos/x'],
    ]) {
      reset();
      expect(() => make([{ code: 1, stderr: 'boom' }, { stdout: 'ok' }])(args)).toThrow('boom');
      expect(calls).toHaveLength(1);
    }
    // 時間切れ: 動画の upload・download は長く、ほかは短く
    expect(ghTimeoutMs(['release', 'upload', 't'])).toBe(60 * 60_000);
    expect(ghTimeoutMs(['release', 'download', 't'])).toBe(60 * 60_000);
    expect(ghTimeoutMs(['api', 'repos/x'])).toBe(2 * 60_000);
    reset();
    make([{ stdout: 'ok' }])(['release', 'download', 't']);
    expect(required(calls[0]).timeoutMs).toBe(60 * 60_000);
    expect(readOnlyGh(['api', '--paginate', '--slurp', 'repos/x/releases?per_page=100'])).toBe(true);
    expect(readOnlyGh(['api', 'repos/x', '-f', 'a=b'])).toBe(false);
  });
});
