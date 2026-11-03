// 手元で作るための前提を確かめる（道具の版・VOICEVOX・gh の認証の有無・空き容量・ポート・声のキャッシュ）。何も書かない。
//   bun scripts/doctor.ts            # 表にして出す（npm run chalk -- doctor でも同じ）
//   bun scripts/doctor.ts --json     # 結果を JSON で出す（AI・ほかの道具が読む）
// 入力: .node-version・.bun-version・.python-version、PATH の道具、環境変数 VOICEVOX_URL・CHALKFILE_CACHE_DIR
// 出力: 項目ごとの OK・注意・足りない。gh は認証があるかだけを見る（token は読まない・出さない）。
//   終了コード: 0 作れる（注意はあってよい）・2 使い方の誤り・3 前提が足りない（git・bun・node・node_modules のどれかが無い）
// 前提: なし
import { existsSync, readdirSync, readFileSync, statfsSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { EXIT, readArgs, runMain, showHelp } from './lib/args';
import { ROOT, ttsDirs } from './lib/paths';
import { run } from './lib/proc';

/** 1 つの項目。need: 足りないと作れないもの（足りなければ終了コード 3） */
type Item = { name: string; state: 'ok' | 'warn' | 'missing'; detail: string; need?: boolean };

/** 道具の版（無ければ null）。出力の最初の行から、版らしい数を取り出す */
const versionOf = (cmd: string, args: string[] = ['--version']): string | null => {
  try {
    const r = run(cmd, args, { cwd: ROOT, timeoutMs: 10_000 });
    if (r.code !== 0) return null;
    return /\d+\.\d+(?:\.\d+)?/.exec(`${r.stdout}\n${r.stderr}`)?.[0] ?? '';
  } catch {
    return null;
  }
};
const pinned = (file: string) =>
  existsSync(path.join(ROOT, file)) ? readFileSync(path.join(ROOT, file), 'utf8').trim() : '';
/** 版がそろっているか（want は .node-version などの頭の部分。24 なら 24.x.y） */
const matches = (have: string, want: string) => !want || have === want || have.startsWith(`${want}.`);

const tool = (name: string, cmd: string, want: string, what: string, need = false, args?: string[]): Item => {
  const v = versionOf(cmd, args);
  if (v === null) return { name, state: 'missing', detail: `見つからない（${what}）`, need };
  const ok = matches(v, want);
  return {
    name,
    state: ok ? 'ok' : 'warn',
    detail: `${v}${want ? `（${ok ? '' : '決めた版は '}${want}${ok ? ' にそろう' : '。CI はこの版'}）` : ''}`,
  };
};

/** gh の認証があるか（gh auth status の終了コードだけを見る。出力には token の一部が出ることがあるので、読まない） */
const ghAuth = (): Item => {
  if (versionOf('gh') === null)
    return {
      name: 'gh の認証',
      state: 'warn',
      detail: 'gh が無い（動画の push・pull と、build:site --strict に要る）',
    };
  const r = run('gh', ['auth', 'status', '--hostname', 'github.com'], { cwd: ROOT, timeoutMs: 15_000 });
  return r.code === 0
    ? { name: 'gh の認証', state: 'ok', detail: 'ある（github.com）' }
    : {
        name: 'gh の認証',
        state: 'warn',
        detail: '無い（gh auth login。動画の push・pull と、build:site --strict に要る）',
      };
};

/** VOICEVOX のエンジンにつながるか（新しい台詞を作るときだけ要る） */
const voicevox = async (): Promise<Item> => {
  const engine = process.env.VOICEVOX_URL ?? 'http://127.0.0.1:50021';
  try {
    const r = await fetch(`${engine}/version`, { signal: AbortSignal.timeout(1500) });
    const v = r.ok ? (await r.text()).replace(/"/g, '').trim() : '';
    return {
      name: 'VOICEVOX',
      state: r.ok ? 'ok' : 'warn',
      detail: r.ok ? `${v}（${engine}）` : `${engine} が ${r.status} を返す`,
    };
  } catch {
    return {
      name: 'VOICEVOX',
      state: 'warn',
      detail: `${engine} につながらない（新しい台詞を作るときだけ要る。今の台詞は npm run materials:pull の声で作れる）`,
    };
  }
};

/** 空き容量（そのフォルダのあるディスク） */
const free = (name: string, dir: string, warnBelow: number): Item => {
  let at = dir;
  while (!existsSync(at)) at = path.dirname(at);
  const s = statfsSync(at);
  const gb = (s.bavail * s.bsize) / 1e9;
  return {
    name,
    state: gb < warnBelow ? 'warn' : 'ok',
    detail: `${gb.toFixed(1)}GB 空いている（${dir}）${gb < warnBelow ? `。${warnBelow}GB より少ない（動画の書き出しは 1 本で数 GB を使う。npm run clean で空ける）` : ''}`,
  };
};

/** ポートを使っているものがあるか（ほかの作業フォルダのサーバーかもしれない） */
const port = (name: string, n: number) =>
  new Promise<Item>((resolve) => {
    const server = net.createServer();
    server.once('error', () =>
      resolve({
        name: `ポート ${n}`,
        state: 'warn',
        detail: `${name}: ほかのものが使っている（ほかの作業フォルダかもしれない。docs/guide/commands.md の「ポート」で番号を変える）`,
      }),
    );
    server.listen(n, '127.0.0.1', () =>
      server.close(() => resolve({ name: `ポート ${n}`, state: 'ok', detail: `${name}: 空いている` })),
    );
  });

/** 台詞の声の共有のキャッシュ（数えるだけ） */
const voiceCache = (): Item => {
  const { cache, local } = ttsDirs(ROOT);
  const count = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.wav')).length : 0);
  const [c, l] = [count(cache), count(local)];
  const legacy = l ? `。前の置き場所の .work/tts に ${l} 本（そのまま読める）` : '';
  return c
    ? { name: '声のキャッシュ', state: 'ok', detail: `${c} 本（${cache}）${legacy}` }
    : {
        name: '声のキャッシュ',
        state: 'warn',
        detail: `まだ無い（${cache}。npm run materials:pull で取り出す）${legacy}`,
      };
};

export const checks = async (): Promise<Item[]> => {
  const items: Item[] = [
    tool('git', 'git', '', '入れる', true),
    tool('bun', process.execPath, pinned('.bun-version'), 'https://bun.sh', true),
    tool('node', 'node', pinned('.node-version'), 'Remotion・Playwright に要る', true),
    existsSync(path.join(ROOT, 'node_modules/.bin/remotion'))
      ? { name: 'node_modules', state: 'ok', detail: 'ある' }
      : { name: 'node_modules', state: 'missing', detail: '無い（npm ci --ignore-scripts）', need: true },
    tool('uv', 'uv', '', 'Python の道具（mix・Kokoro・BGM）に要る'),
    tool('python', 'python3', pinned('.python-version'), 'uv が用意する。mix・Kokoro に要る'),
    tool('ffmpeg', 'ffmpeg', '', '素材の取り出し・mix・書き出しに要る', false, ['-version']),
    ghAuth(),
    await voicevox(),
    voiceCache(),
    free('空き（作業フォルダ）', ROOT, 10),
    free('空き（声のキャッシュ）', ttsDirs(ROOT).cache, 3),
  ];
  for (const [name, n] of [
    ['npm run serve', 8765],
    ['npm run studio', 3000],
    ['npm run dev:worker', 8787],
    ['ブラウザのテスト', 8877],
  ] as const)
    items.push(await port(name, n));
  return items;
};

const LABEL: Record<Item['state'], string> = { ok: 'OK    ', warn: '注意  ', missing: '足りない' };
/** 端末での幅（全角は 2） */
const width = (s: string) => [...s].reduce((n, ch) => n + ((ch.codePointAt(0) ?? 0) > 0xff ? 2 : 1), 0);
const pad = (s: string, n: number) => s + ' '.repeat(Math.max(0, n - width(s)));

const main = async (argv: string[]) => {
  const { values } = readArgs(argv, { json: { type: 'boolean' } });
  if (values.help) return showHelp(import.meta.filename);
  const items = await checks();
  const lacking = items.filter((x) => x.need && x.state === 'missing');
  if (values.json) console.log(JSON.stringify({ ok: !lacking.length, items }, null, 2));
  else {
    const w = Math.max(...items.map((x) => width(x.name)));
    for (const x of items) console.log(`${LABEL[x.state]}  ${pad(x.name, w)}  ${x.detail}`);
    const warns = items.filter((x) => x.state !== 'ok').length;
    console.log(
      lacking.length
        ? `足りない: ${lacking.map((x) => x.name).join('・')}（入れてから、もう一度流す）`
        : `作れる（注意 ${warns} 件）`,
    );
  }
  return lacking.length ? EXIT.missing : EXIT.ok;
};

if (import.meta.main) await runMain(main);
