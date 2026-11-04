// 変えると外の利用者・保存・素材・AI チャットを壊す名前と形（契約）を、テストで凍結する。変えるときの手順は
// docs/adr/2026-11-03-frozen-contracts.md（凍結したものと理由も、そこにある）。
//   1. 動画の key（L01・S01.en）とコンポジションの ID（S01-en）: 作り方と、凍結した一覧の全部が今もあること
//   2. 講座・章・節・図・課題・出典の ID と、AI チャットの参照の単位（docs/courses/<講座>/chunks.jsonl の id）: 凍結した一覧の全部が今もあること
//   3. 声の鍵の v1 の計算（scripts/voices.ts の ttsKeyV1・kokoroKeyV1）: 決まった入力の鍵が前と同じこと
//   4. timeline のファイルの形（schema: 1）
//   5. Releases のタグとファイル名の形（media-<言語>-<講座>・<レクチャー>[.cc].<SHA-256>.mp4）
//   6. 台本の形の版（Course の schemaVersion）と、古い形から直す migrate
// 凍結した一覧（tests/fixtures/contracts/frozen.json）は足すだけにする。公開した名前を一覧に足すときは
// UPDATE_CONTRACTS=1 bun test tests/unit/contracts.test.ts（今ある名前を足す。消さない）。名前を消す・変えるときは ADR の手順に従い、一覧を手で直す
import { describe, expect, test } from 'bun:test';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { AUTHORED_COURSES, COURSES, VIDEOS } from '../../content';
import { THEMES } from '../../content/themes';
import { compositionId, parseVideoKey, videoKey } from '../../engine/core/i18n';
import { COURSE_SCHEMA_VERSION, migrateCourse } from '../../engine/core/migrate';
import type { Course } from '../../engine/core/schema';
import { parseTimeline, TIMELINE_SCHEMA, type TimelineFile, timelineJson } from '../../engine/core/timeline';
import { validateCourse } from '../../engine/core/validate';
import { kokoroKeyV1, ttsKeyV1 } from '../../scripts/voices';
import { type MediaEntry, mediaFilename, mediaPath, releaseUrl } from '../../site/media-shared';
import { course, lecture, say } from '../fixtures/content/invalid/_base';

const ROOT = path.resolve(import.meta.dir, '../..');
const FROZEN = path.join(ROOT, 'tests/fixtures/contracts/frozen.json');

/** 凍結した名前の一覧。videos は動画の key → コンポジションの ID、ほかは「講座 ID/名前」（courses は講座 ID だけ） */
type Contracts = {
  courses: string[];
  videos: Record<string, string>;
  chapters: string[];
  sections: string[];
  figures: string[];
  exercises: string[];
  sources: string[];
  chunks: string[];
};
type ListKey = Exclude<keyof Contracts, 'videos'>;
const LISTS: ListKey[] = ['courses', 'chapters', 'sections', 'figures', 'exercises', 'sources', 'chunks'];

const sorted = (xs: Iterable<string>) => [...new Set(xs)].sort();

/** AI チャットの参照の単位（教材の生成物 docs/courses/<講座>/chunks.jsonl の id） */
const chunkIds = (): string[] => {
  const dir = path.join(ROOT, 'docs/courses');
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(path.join(dir, d.name, 'chunks.jsonl')))
    .flatMap((d) =>
      readFileSync(path.join(dir, d.name, 'chunks.jsonl'), 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => `${d.name}/${(JSON.parse(l) as { id: string }).id}`),
    );
};

/** 今の台本の名前（日本語の講座。動画は訳も） */
const current = (): Contracts => {
  const of = (c: Course, ids: (string | undefined)[]) =>
    ids.filter((x): x is string => !!x).map((id) => `${c.id}/${id}`);
  const materials = (c: Course) => c.lectures.flatMap((l) => (l.material ? [l.material] : []));
  return {
    courses: sorted(COURSES.map((c) => c.id)),
    videos: Object.fromEntries(
      VIDEOS.map((v) => [v.key, compositionId(v.key)] as const).sort(([a], [b]) => (a < b ? -1 : 1)),
    ),
    chapters: sorted(
      COURSES.flatMap((c) =>
        of(c, [...(c.syllabus?.chapters ?? []).map((ch) => ch.id), ...materials(c).map((m) => m.id)]),
      ),
    ),
    sections: sorted(
      COURSES.flatMap((c) =>
        of(
          c,
          materials(c).flatMap((m) => m.sections.map((s) => s.id)),
        ),
      ),
    ),
    figures: sorted(
      COURSES.flatMap((c) =>
        of(
          c,
          materials(c).flatMap((m) => m.figures.map((f) => f.id)),
        ),
      ),
    ),
    exercises: sorted(
      COURSES.flatMap((c) =>
        of(
          c,
          materials(c).map((m) => m.exercise.id),
        ),
      ),
    ),
    sources: sorted(
      COURSES.flatMap((c) =>
        of(
          c,
          (c.sources ?? []).map((s) => s.id),
        ),
      ),
    ),
    chunks: sorted(chunkIds()),
  };
};

const readFrozen = (): Contracts => JSON.parse(readFileSync(FROZEN, 'utf8')) as Contracts;

// 公開した名前を一覧に足す（消さない）。消す・変えるときは、ADR の手順のとおりに一覧を手で直す
if (process.env.UPDATE_CONTRACTS === '1') {
  const now = current();
  const old = existsSync(FROZEN) ? readFrozen() : undefined;
  const merged: Contracts = {
    ...(Object.fromEntries(LISTS.map((k) => [k, sorted([...(old?.[k] ?? []), ...now[k]])])) as Record<
      ListKey,
      string[]
    >),
    videos: Object.fromEntries(Object.entries({ ...now.videos, ...old?.videos }).sort(([a], [b]) => (a < b ? -1 : 1))),
  };
  writeFileSync(FROZEN, `${JSON.stringify(merged, null, 2)}\n`);
}

describe('凍結した名前（tests/fixtures/contracts/frozen.json）が、今の台本に全部ある', () => {
  const frozen = readFrozen();
  const now = current();
  const how = '（消す・名前を変えるときは docs/adr/2026-11-03-frozen-contracts.md の手順。名前を足すのはよい）';
  test('動画の key とコンポジションの ID（timeline・音・字幕・動画のファイル名、render と書き出しの道具が指す）', () => {
    const lost = Object.entries(frozen.videos).filter(([key, comp]) => now.videos[key] !== comp);
    expect(lost.map(([key, comp]) => `${key} → ${comp}（今は ${now.videos[key] ?? '無い'}）${how}`)).toEqual([]);
  });
  for (const k of LISTS) {
    test(`${k}（サイトの URL・保存・教材・AI チャットの参照が指す）`, () => {
      const have = new Set(now[k]);
      expect(frozen[k].filter((id) => !have.has(id)).map((id) => `${id} が無い${how}`)).toEqual([]);
    });
  }
  test('一覧は空でない（凍結が効いている）', () => {
    expect(Object.keys(frozen.videos).length).toBeGreaterThan(0);
    for (const k of LISTS) expect(`${k} ${frozen[k].length > 0}`).toBe(`${k} true`);
  });
});

describe('動画の key とコンポジションの ID の作り方', () => {
  test('日本語はレクチャー ID のまま、訳は言語を付ける。コンポジションの ID はドットをハイフンにする', () => {
    expect(videoKey('L01', 'ja')).toBe('L01');
    expect(videoKey('S01', 'en')).toBe('S01.en');
    expect(videoKey('W01', 'zh')).toBe('W01.zh');
    expect(compositionId('S01.en')).toBe('S01-en');
    expect(compositionId('L01')).toBe('L01');
    expect(parseVideoKey('S01.en')).toEqual({ id: 'S01', lang: 'en' });
    expect(parseVideoKey('L01')).toEqual({ id: 'L01', lang: 'ja' });
    expect(() => parseVideoKey('S01.fr')).toThrow();
  });
});

describe('声の鍵の v1（scripts/voices.ts。素材のブランチと声のキャッシュのファイル名）', () => {
  // 鍵は文と声の設定（engine/core/voices.ts の VOICES・KOKORO の中身と並び）から作る。どちらかが変わると、全部の音声が見つからなくなる
  test('日本語（VOICEVOX）の ttsKeyV1', () => {
    expect(ttsKeyV1('こんにちは。', 'narrator')).toBe('3e81eb37b43eac19');
    expect(ttsKeyV1('ずんだもんなのだ。', 'zundamon')).toBe('b5f34b7c05119955');
    expect(ttsKeyV1('レクチャー、いち。', 'announcer')).toBe('0e80009e67c9d0e5');
  });
  test('英語と中国語（Kokoro）の kokoroKeyV1', () => {
    expect(kokoroKeyV1('Hello.', 'narrator', 'en')).toBe('482bacdabe2ab776');
    expect(kokoroKeyV1('你好。', 'tennokoe', 'zh')).toBe('5a89f21d85da9c7b');
  });
});

describe('timeline のファイルの形（schema: 1）', () => {
  const sample: TimelineFile = {
    schema: 1,
    key: 'X01.en',
    fps: 30,
    durationInFrames: 90,
    fingerprint: '0123456789abcdef',
    scenes: [{ start: 0, duration: 90, lines: [{ start: 14, end: 60 }] }],
  };
  test('版は 1。書く中身はキーを名前の順に並べ、2 スペースで字下げし、最後に改行', () => {
    expect(TIMELINE_SCHEMA).toBe(1);
    expect(timelineJson(sample)).toBe(
      [
        '{',
        '  "durationInFrames": 90,',
        '  "fingerprint": "0123456789abcdef",',
        '  "fps": 30,',
        '  "key": "X01.en",',
        '  "scenes": [',
        '    {',
        '      "duration": 90,',
        '      "lines": [',
        '        {',
        '          "end": 60,',
        '          "start": 14',
        '        }',
        '      ],',
        '      "start": 0',
        '    }',
        '  ],',
        '  "schema": 1',
        '}',
        '',
      ].join('\n'),
    );
    expect(parseTimeline(JSON.parse(timelineJson(sample)), 'sample')).toEqual(sample);
    expect(() => parseTimeline({ ...sample, schema: 2 }, 'sample')).toThrow('schema が 1 でない');
  });
  test('置いてある timeline は、全部この形の項目だけを持つ', () => {
    const files = readdirSync(path.join(ROOT, 'content'), { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(path.join(ROOT, 'content', d.name, 'generated/timeline')))
      .flatMap((d) =>
        readdirSync(path.join(ROOT, 'content', d.name, 'generated/timeline')).map((f) =>
          path.join(ROOT, 'content', d.name, 'generated/timeline', f),
        ),
      );
    expect(files.length).toBeGreaterThan(0);
    const shapes = new Set<string>();
    for (const f of files) {
      const t = JSON.parse(readFileSync(f, 'utf8')) as TimelineFile;
      shapes.add(`file:${Object.keys(t).sort().join(',')}`);
      for (const s of t.scenes) {
        shapes.add(`scene:${Object.keys(s).sort().join(',')}`);
        for (const l of s.lines) shapes.add(`line:${Object.keys(l).sort().join(',')}`);
      }
    }
    expect([...shapes].sort()).toEqual([
      'file:durationInFrames,fingerprint,fps,key,scenes,schema',
      'line:end,start',
      'scene:duration,lines,start',
    ]);
  });
});

describe('Releases のタグとファイル名の形（公開したページと、学ぶ人が保存した講座が指す）', () => {
  const sha = 'a'.repeat(64);
  const entry: MediaEntry = {
    lang: 'ja',
    course: 'stripe-billing',
    lecture: 'L01',
    kind: 'standard',
    bytes: 1,
    sha256: sha,
    tag: 'media-ja-stripe-billing',
    filename: `L01.${sha}.mp4`,
  };
  test('ファイル名は <レクチャー ID>[.cc].<SHA-256>.mp4、配る場所は /media/<言語>/<講座>/<ファイル名>、タグは media-<言語>-<講座>', () => {
    expect(mediaFilename(entry)).toBe(`L01.${sha}.mp4`);
    expect(mediaFilename({ ...entry, kind: 'captioned' })).toBe(`L01.cc.${sha}.mp4`);
    expect(mediaPath(entry)).toBe(`/media/ja/stripe-billing/L01.${sha}.mp4`);
    expect(releaseUrl(entry)).toBe(
      `https://github.com/sean-sunagaku/chalkfile/releases/download/media-ja-stripe-billing/L01.${sha}.mp4`,
    );
  });
  test('講座の動画の一覧（content/<講座>/generated/media.<言語>.json）の項目は、全部この形', () => {
    const lists = readdirSync(path.join(ROOT, 'content'), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .flatMap((d) => {
        const dir = path.join(ROOT, 'content', d.name, 'generated');
        return existsSync(dir)
          ? readdirSync(dir)
              .filter((f) => /^media\.[a-z]+\.json$/.test(f))
              .map((f) => path.join(dir, f))
          : [];
      });
    expect(lists.length).toBeGreaterThan(0);
    const bad: string[] = [];
    for (const f of lists) {
      const m = JSON.parse(readFileSync(f, 'utf8')) as { entries: MediaEntry[]; retained?: MediaEntry[] };
      for (const e of [...m.entries, ...(m.retained ?? [])]) {
        if (
          e.tag !== `media-${e.lang}-${e.course}` ||
          e.filename !== mediaFilename(e) ||
          !/^[0-9a-f]{64}$/.test(e.sha256)
        )
          bad.push(`${path.relative(ROOT, f)}: ${e.tag} ${e.filename}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('台本の形の版（Course の schemaVersion）', () => {
  test('今の版は 1。書いていない講座は 1 として読み、今の版の講座は、そのまま返す（写さない）', () => {
    expect(COURSE_SCHEMA_VERSION).toBe(1);
    for (const c of AUTHORED_COURSES) {
      expect(`${c.id} ${c.schemaVersion ?? 1}`).toBe(`${c.id} 1`);
      expect(migrateCourse(c)).toBe(c);
    }
  });
  test('読めない版（今より新しい・整数でない）の講座は、直さずに返し、台本の検証がその講座の誤りにする', () => {
    const ok = course([lecture([{ kind: 'big', heading: '大事なこと', text: '台本', lines: say('台本です。') }])]);
    const ctx = { themes: Object.keys(THEMES) };
    expect(validateCourse({ ...ok, schemaVersion: 1 }, ctx)).toEqual([]);
    for (const v of [COURSE_SCHEMA_VERSION + 1, 0, 1.5]) {
      const c = { ...ok, schemaVersion: v };
      expect(migrateCourse(c)).toBe(c);
      expect(validateCourse(c, ctx).map((x) => `${x.level} ${x.rule} ${x.where}`)).toEqual([
        'error schema invalid-sample schemaVersion',
      ]);
    }
  });
});
