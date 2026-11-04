// 道具（scripts/ の CLI）の引数・使い方・終了コードの決まり。どの道具も、次の形にする:
//   const main = async (argv: string[]) => {
//     const { values, positionals } = readArgs(argv, { write: { type: 'boolean' } }, { positionals: true });
//     if (values.help) return showHelp(import.meta.filename);
//     …（重い前処理は、引数を確かめたあとに始める）
//   };
//   if (import.meta.main) await runMain(main);   // import しただけでは何も起きない
// - 引数は node:util の parseArgs を strict で読む。知らない引数・値の足りない引数は「使い方の誤り」にする（黙って無視しない）
// - -h／--help は、どの道具でも頭書き（ファイルの最初のコメント）を出すだけにする（何も消さず、何も書かない）
// - 終了コード（EXIT）: 0 成功・1 失敗・2 使い方の誤り（UsageError）・3 前提が足りない（MissingError: 道具・素材・認証・サーバー）
// Node で動かす道具（scripts/stills.ts）も読むので、node: のモジュールだけを使う
import { readFileSync } from 'node:fs';
import { type ParseArgsConfig, parseArgs } from 'node:util';

export const EXIT = { ok: 0, failed: 1, usage: 2, missing: 3 } as const;

/** 使い方の誤り（知らない引数・足りない引数・合わない値）。終了コード 2 */
export class UsageError extends Error {
  override name = 'UsageError';
}
/** 前提が足りない（道具・素材・認証・ファイル・サーバー）。終了コード 3 */
export class MissingError extends Error {
  override name = 'MissingError';
}

type Options = NonNullable<ParseArgsConfig['options']>;
const HELP = { help: { type: 'boolean', short: 'h' } } as const;

/** parseArgs のエラーを、日本語の 1 行にする */
const argError = (e: unknown): string => {
  const { code, message } = e as { code?: string; message?: string };
  const name = /'([^']+)'/.exec(message ?? '')?.[1] ?? '';
  if (code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION') return `知らない引数: ${name}`;
  if (code === 'ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL') return `この道具は、この引数を取らない: ${name}`;
  if (code === 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE') return `引数の値が合わない（${message}）`;
  return `引数が読めない: ${message ?? String(e)}`;
};

/**
 * 引数を読む（strict）。-h／--help はどの道具でも読む（values.help）。知らない引数は UsageError にする。
 * positionals: 名前の無い引数（動画の名前・講座 ID など）を取るか（既定は取らない）
 */
export const readArgs = <const O extends Options>(args: string[], options: O, { positionals = false } = {}) => {
  let parsed: ReturnType<
    typeof parseArgs<{ args: string[]; options: O & typeof HELP; allowPositionals: true; strict: true }>
  >;
  try {
    parsed = parseArgs({ args, options: { ...options, ...HELP }, allowPositionals: true, strict: true });
  } catch (e) {
    throw new UsageError(`${argError(e)}（使い方は --help）`);
  }
  if (!positionals && parsed.positionals.length)
    throw new UsageError(`この道具は、この引数を取らない: ${parsed.positionals[0]}（使い方は --help）`);
  return parsed;
};

/**
 * ファイルの頭書き（最初のコメントのかたまり）。道具の使い方として、--help で出す。
 * TS・JS は // の行か /** … *\/ のかたまり、シェルは # の行（#! を除く）、Python は docstring（頭の # /// script のかたまりの後）
 */
export const headerOf = (file: string): string => {
  const lines = readFileSync(file, 'utf8').split('\n');
  // 以下の直接参照は i/j < lines.length を確かめるループの中だけ。

  let i = lines[0]?.startsWith('#!') ? 1 : 0;
  if (file.endsWith('.py')) {
    while (i < lines.length && (lines[i]!.startsWith('#') || !lines[i]!.trim())) i++;
    const first = lines[i]?.trim() ?? '';
    const quote = first.startsWith('"""') ? '"""' : first.startsWith("'''") ? "'''" : '';
    if (!quote) return '';
    const body: string[] = [];
    for (let j = i; j < lines.length; j++) {
      const line = j === i ? first.slice(3) : lines[j]!;
      const end = line.indexOf(quote);
      body.push(end >= 0 ? line.slice(0, end) : line);
      if (end >= 0) break;
    }
    return body.join('\n').trim();
  }
  const mark = file.endsWith('.sh') ? '#' : '//';
  if (mark === '//' && lines[i]?.trimStart().startsWith('/*')) {
    const body: string[] = [];
    for (let j = i; j < lines.length; j++) {
      const end = lines[j]!.includes('*/');
      const text = lines[j]!
        .replace(/^\s*\/\*\*?/, '')
        .replace(/\*\/.*$/, '')
        .replace(/^\s*\* ?/, '');
      body.push(text);
      if (end) break;
    }
    return body.join('\n').trim();
  }
  const body: string[] = [];
  for (let j = i; j < lines.length && lines[j]!.startsWith(mark); j++)
    body.push(lines[j]!.slice(mark.length).replace(/^ /, ''));
  return body.join('\n').trimEnd();
};

/** 頭書きを使い方として出す（標準出力。ほかには何もしない） */
export const showHelp = (file: string): void => {
  console.log(headerOf(file));
};

/** 投げられたものの終了コード */
export const exitCodeOf = (e: unknown): number =>
  e instanceof UsageError ? EXIT.usage : e instanceof MissingError ? EXIT.missing : EXIT.failed;

/** 投げられたものを、見せる文にする。書き方の誤り（TypeError など）は、直す場所が分かるように積み重ねも出す */
const errorText = (e: unknown): string => {
  if (!(e instanceof Error)) return String(e);
  const bug =
    e instanceof TypeError || e instanceof ReferenceError || e instanceof RangeError || e instanceof SyntaxError;
  const cause = e.cause instanceof Error ? `\n（元のエラー: ${e.cause.message}）` : '';
  return `${bug ? (e.stack ?? e.message) : e.message}${cause}`;
};

/**
 * 道具の入口。main に引数（process.argv の 3 つ目から）を渡して流す。main が数を返したら、それを終了コードにする。
 * 投げられたら、その文を出して終了コードにする（UsageError は 2、MissingError は 3、ほかは 1）
 */
export const runMain = async (main: (argv: string[]) => unknown): Promise<void> => {
  try {
    const code = await main(process.argv.slice(2));
    if (typeof code === 'number') process.exitCode = code;
  } catch (e) {
    console.error(errorText(e));
    process.exitCode = exitCodeOf(e);
  }
};
