// 読みの差分（scripts/reading-diff.ts）。比べる相手と今の台本の読みを比べ、公開する言語の公開中の動画で読みが変わったのに
// 動画を作り直していなければ止める
import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { VIDEOS } from '../content';
import { speechIn } from '../content/voices';
import { around, judge, mediaHashes, readingChanges, readingsOf, type VideoReading } from '../scripts/reading-diff';
import { mediaFilename, mediaKey, type MediaEntry } from '../site/media-shared';

const ROOT = path.resolve(import.meta.dir, '..');

const video = (key: string, lang: string, speech: string[]): VideoReading => ({
  video: key,
  lang,
  course: 'sample',
  lecture: key.split('.')[0],
  lines: speech.map((s, i) => ({ at: `s1-${i + 1}`, voice: 'narrator', speech: s, text: s })),
});
const entry = (lecture: string, lang: string, kind: MediaEntry['kind'], sha: string): MediaEntry => {
  const e = { lang, course: 'sample', lecture, kind, bytes: 1, sha256: sha.repeat(64), tag: `media-${lang}-sample` };
  return { ...e, filename: mediaFilename(e) };
};
const hashes = (...es: MediaEntry[]) => mediaHashes([{ schema: 1, entries: es }]);

describe('読みの差分（scripts/reading-diff.ts）', () => {
  test('読みが変わった台詞・足した台詞・消した台詞を、動画ごとに出す（足した動画・消した動画は見ない）', () => {
    const base = [
      video('X01', 'ja', ['いち', 'に', 'さん']),
      video('X02', 'ja', ['おなじ']),
      video('X09', 'ja', ['けした']),
    ];
    const head = [video('X01', 'ja', ['いち', 'にー']), video('X02', 'ja', ['おなじ']), video('X03', 'ja', ['たした'])];
    expect(readingChanges(base, head)).toEqual([
      {
        video: 'X01',
        lang: 'ja',
        course: 'sample',
        lecture: 'X01',
        lines: [
          { at: 's1-2', voice: 'narrator', text: 'にー', before: 'に', after: 'にー' },
          { at: 's1-3', voice: 'narrator', text: 'さん', before: 'さん' },
        ],
      },
    ]);
  });

  test('公開する言語の公開中の動画で読みが変わったのに、動画を作り直していなければ止める', () => {
    const changes = readingChanges(
      [video('X01', 'ja', ['に']), video('X01.en', 'en', ['two'])],
      [video('X01', 'ja', ['にー']), video('X01.en', 'en', ['too'])],
    );
    const base = hashes(entry('X01', 'ja', 'standard', 'a'), entry('X01', 'en', 'standard', 'a'));
    // 作り直していない（一覧の項目が同じ）→ 日本語は止める。英語はまだ公開しない言語なので知らせるだけ
    const same = judge(changes, ['ja'], base, base);
    expect(same.stop.map((c) => c.video)).toEqual(['X01']);
    expect(same.notice.map((c) => c.video)).toEqual(['X01.en']);
    // 英語も公開すると、英語も止める
    expect(judge(changes, ['ja', 'en'], base, base).stop.map((c) => c.video)).toEqual(['X01', 'X01.en']);
    // 作り直して media push した（一覧の項目の SHA-256 が変わった）→ 止めない
    const remade = judge(
      changes,
      ['ja'],
      base,
      hashes(entry('X01', 'ja', 'standard', 'b'), entry('X01', 'en', 'standard', 'a')),
    );
    expect(remade.stop).toEqual([]);
    expect(remade.remade.map((c) => c.video)).toEqual(['X01']);
  });

  test('字幕を焼き込んだ版もある動画は、両方を作り直すまで止める。まだ公開していない動画は知らせるだけ', () => {
    const changes = readingChanges([video('X01', 'ja', ['に'])], [video('X01', 'ja', ['にー'])]);
    const base = hashes(entry('X01', 'ja', 'standard', 'a'), entry('X01', 'ja', 'captioned', 'a'));
    expect(
      judge(changes, ['ja'], base, hashes(entry('X01', 'ja', 'standard', 'b'), entry('X01', 'ja', 'captioned', 'a')))
        .stop,
    ).toHaveLength(1);
    expect(
      judge(changes, ['ja'], base, hashes(entry('X01', 'ja', 'standard', 'b'), entry('X01', 'ja', 'captioned', 'b')))
        .stop,
    ).toHaveLength(0);
    expect(judge(changes, ['ja'], hashes(), hashes()).notice).toHaveLength(1);
    expect(mediaKey(entry('X01', 'ja', 'standard', 'a'))).toBe('ja/sample/X01/standard');
  });

  test('今の台本は、同じ台本と比べると読みの差分が 0（全部の動画・全部の台詞を読める）', () => {
    const now = readingsOf(VIDEOS, speechIn);
    expect(now.length).toBe(VIDEOS.length);
    expect(now.flatMap((v) => v.lines).filter((l) => l.speech.startsWith('（読めない'))).toEqual([]);
    expect(readingChanges(now, now)).toEqual([]);
  });

  test('長い台詞は、変わった所の前後だけを出す', () => {
    expect(
      around(
        'あいうえおかきくけこさしすせそ日本たちつてとなにぬねの',
        'あいうえおかきくけこさしすせそにっぽんたちつてとなにぬねの',
        3,
      ),
    ).toEqual(['…すせそ日本たちつ…', '…すせそにっぽんたちつ…']);
  });

  test('台本（content/）は、content/ の外を実行時に import しない（読みの差分と materials gc は、content/ だけを取り出して読む）', () => {
    const outside: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = path.join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (p.endsWith('.ts'))
          for (const m of readFileSync(p, 'utf8').matchAll(/^(?:import|export)\s+(?!type\b)[^;]*?from\s+'([^']+)'/gm)) {
            const to = path.resolve(path.dirname(p), m[1]);
            if (m[1].startsWith('.') && !to.startsWith(path.join(ROOT, 'content')))
              outside.push(`${path.relative(ROOT, p)}: ${m[1]}`);
            if (!m[1].startsWith('.')) outside.push(`${path.relative(ROOT, p)}: ${m[1]}`);
          }
      }
    };
    walk(path.join(ROOT, 'content'));
    expect(outside).toEqual([]);
  });
});
