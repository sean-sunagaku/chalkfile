// サイトの共有の部品: Range の応答（site/lib/http-range.ts）・文字の部品（site/lib/text.ts）・動画の配るパスの読み方と
// ダウンロードの名前（site/media-shared.ts）。SW と手元の配信とテストのサーバーが同じものを使う
import { describe, expect, test } from 'bun:test';
import { rangeResponse } from '../site/lib/http-range';
import { esc, fill } from '../site/lib/text';
import { downloadName, type MediaEntry, mediaFilename, mediaPath, parseMediaPath } from '../site/media-shared';

const DATA = new Uint8Array(Array.from({ length: 100 }, (_, i) => i));
const ETAG = '"abc"';
const req = (headers: Record<string, string> = {}, method = 'GET') =>
  new Request('https://example.com/media/x.mp4', { method, headers });
/** 保存した応答（SW の Cache の中身と同じ形） */
const saved = () =>
  new Response(DATA, { headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(DATA.length), ETag: ETAG } });
const answer = async (r: Response) => ({
  status: r.status,
  range: r.headers.get('Content-Range'),
  length: r.headers.get('Content-Length'),
  body: [...new Uint8Array(await r.arrayBuffer())],
});

describe('rangeResponse（1 つの bytes の Range に答える）', () => {
  // 手元の配信は Blob とヘッダー、SW は保存した応答とそのヘッダー（大きさは Content-Length）を渡す
  for (const [name, make] of [
    ['Blob', () => ({ body: new Blob([DATA]), headers: new Headers({ 'Content-Type': 'video/mp4', ETag: ETAG }) })],
    [
      '保存した Response',
      () => {
        const r = saved();
        return { body: r, headers: new Headers(r.headers) };
      },
    ],
  ] as const) {
    describe(name, () => {
      const call = (request: Request) => {
        const { body, headers } = make();
        return rangeResponse(request, body, headers);
      };
      test('Range が無ければ全体の 200（Accept-Ranges と大きさを付ける）', async () => {
        const r = await call(req());
        expect(await answer(r)).toEqual({ status: 200, range: null, length: '100', body: [...DATA] });
        expect(r.headers.get('Accept-Ranges')).toBe('bytes');
        expect(r.headers.get('Content-Type')).toBe('video/mp4');
      });
      for (const [range, start, end] of [
        ['bytes=0-9', 0, 9],
        ['bytes=90-', 90, 99],
        ['bytes=-5', 95, 99],
        ['bytes=95-200', 95, 99],
      ] as const) {
        test(`${range} は 206`, async () => {
          const r = await call(req({ Range: range }));
          expect(await answer(r)).toEqual({
            status: 206,
            range: `bytes ${start}-${end}/100`,
            length: String(end - start + 1),
            body: [...DATA.slice(start, end + 1)],
          });
        });
      }
      test('範囲の外は 416（Content-Range は bytes */大きさ、本文なし）', async () => {
        const r = await call(req({ Range: 'bytes=100-' }));
        expect(await answer(r)).toEqual({ status: 416, range: 'bytes */100', length: '0', body: [] });
      });
      test('複数の範囲と知らない単位は、全体の 200', async () => {
        for (const range of ['bytes=0-1,5-6', 'items=0-1']) {
          expect((await call(req({ Range: range }))).status).toBe(200);
        }
      });
      test('If-Range が ETag と同じなら部分、違えば全体', async () => {
        expect((await call(req({ Range: 'bytes=0-9', 'If-Range': ETAG }))).status).toBe(206);
        expect((await call(req({ Range: 'bytes=0-9', 'If-Range': '"old"' }))).status).toBe(200);
      });
      test('HEAD は本文なしで、Range を見ない', async () => {
        const r = await call(req({ Range: 'bytes=0-9' }, 'HEAD'));
        expect(await answer(r)).toEqual({ status: 200, range: null, length: '100', body: [] });
      });
    });
  }
  test('ETag を付けない応答は、If-Range を見ない（手元の配信の静的なファイル）', async () => {
    const r = await rangeResponse(req({ Range: 'bytes=0-9', 'If-Range': '"x"' }), new Blob([DATA]), {});
    expect(r.status).toBe(206);
    expect(r.headers.get('ETag')).toBeNull();
  });
});

describe('文字の部品（esc・fill）', () => {
  test('esc は & < > " と、印の形をした所の最初の 1 字だけを変える', () => {
    expect(esc(`<a href="x">'&'</a> __NAME__ {{key}} _a_ {b}`)).toBe(
      `&lt;a href=&quot;x&quot;&gt;'&amp;'&lt;/a&gt; &#95;_NAME__ &#123;{key}} _a_ {b}`,
    );
  });
  test('fill は {name} を差し込み、無い名前は残す', () => {
    expect(fill('{n} 本・{min} 分・{x}', { n: 3, min: '12' })).toBe('3 本・12 分・{x}');
    expect(fill('そのまま')).toBe('そのまま');
  });
});

describe('動画の配るパス（parseMediaPath）とダウンロードの名前（downloadName）', () => {
  const sha256 = 'a'.repeat(64);
  const entryOf = (o: Partial<MediaEntry>): MediaEntry => {
    const e = {
      lang: 'ja',
      course: 'stripe-billing',
      lecture: 'L01',
      kind: 'standard' as const,
      bytes: 1,
      sha256,
      tag: '',
      ...o,
    };
    return { ...e, filename: mediaFilename(e), tag: `media-${e.lang}-${e.course}` };
  };
  test('mediaPath の逆になる（通常版・字幕版・訳の言語）', () => {
    for (const e of [
      entryOf({}),
      entryOf({ kind: 'captioned' }),
      entryOf({ lang: 'en', lecture: 'P01' }),
      entryOf({ lang: 'zh', kind: 'captioned' }),
    ]) {
      expect(parseMediaPath(mediaPath(e))).toEqual({
        lang: e.lang,
        course: e.course,
        lecture: e.lecture,
        kind: e.kind,
        sha256: e.sha256,
      });
    }
  });
  test('形の違うパスは読まない（言語は講座の言語の一覧 content/langs.ts にあるものだけ）', () => {
    for (const p of [
      `/media/pt-BR/stripe-billing/L01.${sha256}.mp4`,
      `/media/fr/stripe-billing/L01.${sha256}.mp4`,
      `/media/ja/stripe-billing/L01.${sha256}.mp4?download=1`,
      `/media/ja/stripe-billing/L01.${'A'.repeat(64)}.mp4`,
      `/media/ja/stripe-billing/L01.${'a'.repeat(63)}.mp4`,
      `/media/ja/stripe-billing/L01.mp4`,
      `/media/stripe-billing/L01.${sha256}.mp4`,
      `/media/ja/x/stripe-billing/L01.${sha256}.mp4`,
      `/media/ja/../L01.${sha256}.mp4`,
      `/media/JA/stripe-billing/L01.${sha256}.mp4`,
      `/stripe-billing/media/L01.${sha256}.mp4`,
      `media/ja/stripe-billing/L01.${sha256}.mp4`,
    ]) {
      expect(parseMediaPath(p)).toBeNull();
    }
  });
  test('単体で保存するときの名前は、字幕を焼き込んだ版だけ .captioned を付ける', () => {
    expect(downloadName({ lecture: 'L01', kind: 'standard' })).toBe('L01.mp4');
    expect(downloadName({ lecture: 'L01', kind: 'captioned' })).toBe('L01.captioned.mp4');
  });
});
