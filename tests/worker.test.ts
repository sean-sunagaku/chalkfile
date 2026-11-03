import { describe, expect, spyOn, test } from 'bun:test';
import manifest from '../site/media-manifest.json';
import { mediaPath, releaseUrl, type MediaEntry } from '../site/media-shared';
import { createMediaHandler, type MediaLog } from '../worker/src/media';

const entry = manifest.entries[0] as MediaEntry;
const request = (suffix = '', init?: RequestInit) => new Request(`https://chalkfile.com${mediaPath(entry)}${suffix}`, init);
const success = (status = 200) => new Response(new Uint8Array([0, 1]), { status, headers: {
  'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment; filename="upstream.mp4"',
  'Content-Length': '2', 'Content-Range': `bytes 0-1/${entry.bytes}`, ETag: '"upstream-etag"',
  'Set-Cookie': 'must-not-forward=1', 'X-Private-Header': 'must-not-forward',
} });
describe('/media/ の中継', () => {
  for (const status of [200, 206, 416]) test(`${status} の状態・許可ヘッダー・stream`, async () => {
    const handle = createMediaHandler([entry], async () => success(status));
    const response = await handle(request());
    expect(response.status).toBe(status);
    expect(response.headers.get('Content-Type')).toBe('video/mp4');
    expect(response.headers.get('Content-Length')).toBe('2');
    expect(response.headers.get('Content-Range')).toBe(`bytes 0-1/${entry.bytes}`);
    expect(response.headers.get('ETag')).toBe('"upstream-etag"');
    expect(response.headers.get('Accept-Ranges')).toBe('bytes');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Content-Disposition')).toBeNull();
    expect(response.headers.get('Set-Cookie')).toBeNull();
    expect(response.headers.get('X-Private-Header')).toBeNull();
    expect(response.headers.get('Cache-Control')).toBe(status === 416 ? 'no-store' : 'public, max-age=31536000, immutable');
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([0, 1]);
  });
  test('Range / If-Range だけを手動302の先まで維持する。毎回元URLから開始', async () => {
    const calls: { url: string; headers: [string, string][]; method?: string }[] = [];
    const handle = createMediaHandler([entry], async (url, init) => {
      calls.push({ url, headers: [...new Headers(init.headers)], method: init.method });
      return url === releaseUrl(entry) ? new Response(null, { status: 302, headers: { Location: 'https://release-assets.githubusercontent.com/asset?signed=not-logged' } }) : success(206);
    });
    for (let i = 0; i < 2; i++) await handle(request('', { headers: {
      Range: 'bytes=0-1', 'If-Range': '"version"', Cookie: 'private=1', Authorization: 'not-forwarded', Referer: 'https://example.com/private',
    } }));
    expect(calls.map((c) => c.url)).toEqual([releaseUrl(entry), 'https://release-assets.githubusercontent.com/asset?signed=not-logged', releaseUrl(entry), 'https://release-assets.githubusercontent.com/asset?signed=not-logged']);
    for (const call of calls) expect(call.headers).toEqual([['if-range', '"version"'], ['range', 'bytes=0-1']]);
  });
  test('範囲なしは上流にヘッダーを追加しない', async () => {
    const handle = createMediaHandler([entry], async (_, init) => { expect([...new Headers(init.headers)]).toEqual([]); return success(); });
    expect((await handle(request())).status).toBe(200);
  });
  test('HEAD は Range を無視し、本文を返さない', async () => {
    const handle = createMediaHandler([entry], async (_, init) => {
      expect(init.method).toBe('HEAD'); expect(new Headers(init.headers).has('Range')).toBeFalse(); return success();
    });
    const response = await handle(request('', { method: 'HEAD', headers: { Range: 'bytes=0-1' } }));
    expect(response.status).toBe(200); expect(await response.text()).toBe('');
  });
  test('download=1 だけに読みやすい attachment を付ける', async () => {
    const handle = createMediaHandler([entry], async () => success());
    expect((await handle(request('?download=1'))).headers.get('Content-Disposition')).toBe('attachment; filename="L01.mp4"');
    expect((await handle(request('?download=0'))).headers.has('Content-Disposition')).toBeFalse();
  });
  test('許可リスト外と非GET/HEADは上流へアクセスしない', async () => {
    let count = 0; const handle = createMediaHandler([entry], async () => { count++; return success(); });
    for (const suffix of ['/media/ja/other/L01.mp4', '/media/https://example.com/video.mp4', '/media/ja/sample/%2e%2e/file.mp4']) {
      expect((await handle(new Request(`https://chalkfile.com${suffix}`))).status).toBe(404);
    }
    const response = await handle(request('', { method: 'POST' }));
    expect(response.status).toBe(405); expect(response.headers.get('Allow')).toBe('GET, HEAD'); expect(count).toBe(0);
  });
  const logOf = (code: MediaLog['code'], status: number | null, host: string | null): MediaLog =>
    ({ code, status, host, course: entry.course, lecture: entry.lecture });
  test('上流の404は404で upstream_missing、他の状態は502で status、通信失敗は502で network を記録する', async () => {
    for (const status of [404, 403, 429, 500, 503]) {
      const logs: MediaLog[] = []; const handle = createMediaHandler([entry], async () => new Response('private upstream body', { status }), (log) => logs.push(log));
      const response = await handle(request());
      expect(response.status).toBe(status === 404 ? 404 : 502);
      expect(await response.text()).not.toContain('private');
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(logs).toEqual([logOf(status === 404 ? 'upstream_missing' : 'status', status, 'github.com')]);
    }
    const logs: MediaLog[] = [];
    const response = await createMediaHandler([entry], async () => { throw new Error('https://example.com/?private=value'); }, (log) => logs.push(log))(request());
    expect(response.status).toBe(502); expect(logs).toEqual([logOf('network', null, 'github.com')]);
  });
  test('redirect の先で失敗したら、その先のホスト名だけを残す', async () => {
    const signed = 'https://release-assets.githubusercontent.com/asset?signed=private';
    const answers: [() => Response, MediaLog][] = [
      [() => new Response('private', { status: 404 }), logOf('upstream_missing', 404, 'release-assets.githubusercontent.com')],
      [() => new Response('private', { status: 500 }), logOf('status', 500, 'release-assets.githubusercontent.com')],
      [() => { throw new Error(signed); }, logOf('network', null, 'release-assets.githubusercontent.com')],
    ];
    for (const [answer, expected] of answers) {
      const logs: MediaLog[] = [];
      const handle = createMediaHandler([entry], async (url) => url === releaseUrl(entry) ? new Response(null, { status: 302, headers: { Location: signed } }) : answer(), (log) => logs.push(log));
      await handle(request());
      expect(logs).toEqual([expected]);
    }
  });
  test('外部redirect・http・認証情報つき・Locationなし・読めないLocation・ループを拒み、行き先のホスト名だけを残す', async () => {
    const cases: [string, string | null][] = [
      ['https://example.com/video.mp4?signed=private', 'example.com'], ['http://release-assets.githubusercontent.com/asset', 'release-assets.githubusercontent.com'],
      ['https://user:pass@release-assets.githubusercontent.com/asset', 'release-assets.githubusercontent.com'], ['', null], ['https://[private', null],
    ];
    for (const [location, host] of cases) {
      const logs: MediaLog[] = []; const handle = createMediaHandler([entry], async () => new Response(null, { status: 302, headers: { Location: location } }), (log) => logs.push(log));
      expect((await handle(request())).status).toBe(502);
      expect(logs).toEqual([logOf('redirect_host', 302, host)]);
    }
    let calls = 0; const logs: MediaLog[] = [];
    const handle = createMediaHandler([entry], async () => { calls++; return new Response(null, { status: 307, headers: { Location: 'https://release-assets.githubusercontent.com/loop' } }); }, (log) => logs.push(log));
    expect((await handle(request())).status).toBe(502); expect(calls).toBe(4);
    expect(logs).toEqual([logOf('redirect_host', 307, 'release-assets.githubusercontent.com')]);
  });
  test('既定のログは console.error へ 1 件のオブジェクトで出し、URL・path・query・署名を含めない', async () => {
    const signed = 'https://release-assets.githubusercontent.com/private-path/asset.mp4?X-Amz-Signature=SIGNATURE&X-Amz-Credential=CREDENTIAL';
    const later = (answer: () => Response) => async (url: string) => url === releaseUrl(entry) ? new Response(null, { status: 302, headers: { Location: signed } }) : answer();
    const scenarios = [
      async () => new Response(null, { status: 302, headers: { Location: 'https://evil.example/private-path?X-Amz-Signature=SIGNATURE' } }),
      later(() => new Response(null, { status: 404 })), later(() => new Response(null, { status: 500 })), later(() => { throw new Error(signed); }),
    ];
    const spy = spyOn(console, 'error').mockImplementation(() => {});
    try {
      for (const scenario of scenarios) await createMediaHandler([entry], scenario)(request('?download=1'));
      expect(spy.mock.calls.map((args) => args[0]?.code)).toEqual(['redirect_host', 'upstream_missing', 'status', 'network']);
      for (const args of spy.mock.calls) {
        expect(args).toHaveLength(1);
        expect(Object.keys(args[0])).toEqual(['message', 'code', 'status', 'host', 'course', 'lecture']);
        expect(args[0].message).toBe('media_upstream_failed');
        expect(JSON.stringify(args)).not.toMatch(/[/?=&]|SIGNATURE|CREDENTIAL|private|Amz/);
      }
    } finally { spy.mockRestore(); }
  });
  test('動画全体をメモリへ取り込まず応答を返す', async () => {
    let reads = 0;
    const stream = new ReadableStream({ pull(controller) { reads++; controller.enqueue(new Uint8Array([1])); } }, { highWaterMark: 0 });
    const handle = createMediaHandler([entry], async () => new Response(stream));
    const response = await handle(request());
    expect(reads).toBe(0); await response.body!.cancel();
  });
});
