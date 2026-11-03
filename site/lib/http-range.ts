// 1 つの bytes の Range に答える部品。Service Worker（site/sw.ts。保存した講座の再生）と、手元の配信とブラウザのテストのサーバー
// （scripts/site/serve-files.ts）が同じものを使う。Worker の /media/ は配信元の 206 をそのまま返すので、ここは使わない。
// ほかのファイルを import しない（SW にも入れる）。決まりは RFC 9110 の Range・If-Range・206・416
//   - HEAD は本文なし。Range は見ない
//   - If-Range が ETag と違えば、全体の 200（ETag を付けない応答は、If-Range を見ない）
//   - 1 つの bytes の範囲（start-end・start-・-suffix）は 206。範囲の外は 416（Content-Range は bytes */大きさ）
//   - 複数の範囲・知らない単位・形の違う Range は無視して、全体の 200

export type ByteRange = { kind: 'full' } | { kind: 'partial'; start: number; end: number } | { kind: 'unsatisfiable' };

/** Range の読み方。複数 Range と未知の単位は無視して全体。対応する単一 bytes Range は部分か、範囲の外 */
export function byteRange(header: string | null, size: number): ByteRange {
  if (!header?.startsWith('bytes=') || header.includes(',')) return { kind: 'full' };
  const m = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!m || (!m[1] && !m[2])) return { kind: 'full' };
  const a = m[1] ? Number(m[1]) : null;
  const b = m[2] ? Number(m[2]) : null;
  if ((a !== null && !Number.isSafeInteger(a)) || (b !== null && !Number.isSafeInteger(b)) || size === 0)
    return { kind: 'unsatisfiable' };
  const start = a ?? Math.max(0, size - (b as number));
  const end = a === null || b === null ? size - 1 : Math.min(b, size - 1);
  if (start >= size || start > end || (a === null && b === 0)) return { kind: 'unsatisfiable' };
  return { kind: 'partial', start, end };
}

/**
 * 全体の中身から、要求に答える応答を作る。headers は全体の 200 で返すヘッダー（ETag を入れれば If-Range と照らす）。
 * body が Blob なら大きさは Blob の大きさ、Response（保存した応答）なら headers の Content-Length。
 * Response の全体は stream のまま返し、部分のときだけ Blob にして切り出す
 */
export async function rangeResponse(req: Request, body: Blob | Response, headers: HeadersInit): Promise<Response> {
  const base = new Headers(headers);
  const size = body instanceof Blob ? body.size : Number(base.get('Content-Length'));
  base.set('Accept-Ranges', 'bytes');
  base.set('Content-Length', String(size));
  if (req.method === 'HEAD') return new Response(null, { headers: base });
  const etag = base.get('ETag');
  const ifRange = req.headers.get('If-Range');
  const range = byteRange(etag && ifRange && ifRange !== etag ? null : req.headers.get('Range'), size);
  if (range.kind === 'unsatisfiable') {
    base.set('Content-Length', '0');
    base.set('Content-Range', `bytes */${size}`);
    return new Response(null, { status: 416, headers: base });
  }
  if (range.kind === 'full') return new Response(body instanceof Blob ? body : body.body, { headers: base });
  const blob = body instanceof Blob ? body : await body.blob();
  base.set('Content-Length', String(range.end - range.start + 1));
  base.set('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
  return new Response(blob.slice(range.start, range.end + 1), { status: 206, headers: base });
}
