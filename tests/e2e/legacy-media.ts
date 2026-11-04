// 凍結した旧 Pages の一覧と同じ動画を用意する。現在の動画を作り直しても、旧公開物の検査対象は変えない。
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { writeAtomic } from '../../scripts/lib/fsx';

type Expected = { bytes: number; sha256: string };
const matches = (bytes: Uint8Array, expected: Expected) =>
  bytes.byteLength === expected.bytes && createHash('sha256').update(bytes).digest('hex') === expected.sha256;

const download = async (url: string): Promise<Uint8Array> => {
  const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`旧公開動画を取れない: HTTP ${response.status} (${url})`);
  return new Uint8Array(await response.arrayBuffer());
};

export async function legacyMediaFile(options: {
  expected: Expected;
  current: string;
  cache: string;
  url: string;
  getBytes?: (url: string) => Promise<Uint8Array>;
}): Promise<string> {
  for (const file of [options.current, options.cache])
    if (existsSync(file) && matches(readFileSync(file), options.expected)) return file;
  const bytes = await (options.getBytes ?? download)(options.url);
  if (!matches(bytes, options.expected)) throw new Error('旧公開動画の大きさ・SHA-256が凍結した一覧と違う');
  writeAtomic(options.cache, bytes);
  return options.cache;
}
