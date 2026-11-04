// Worker の型（worker/worker-configuration.d.ts）を wrangler types で作る。生成物なので手で直さない。
//   bun scripts/worker_types.ts           # 作り直して、今の中身と同じかを確かめる（npm run typecheck:worker-types。npm run typecheck の中でも流す）
//   bun scripts/worker_types.ts --write   # 作り直して書く（npm run gen:worker-types）。wrangler.jsonc か wrangler の版を変えたら流して commit する
// 型の中身は、wrangler.jsonc（binding・compatibility_date・compatibility_flags・main）と、固定した版の wrangler と workerd で決まる。
// 頭の行に作ったときのコマンドとファイルの場所が入り、mainModule の import もこのファイルからの相対の場所なので、
// 確かめるときも同じ場所に作り直して比べ、比べ終わったら元の中身に戻す。
// wrangler は、同じ場所に前のファイルがあると、頭の行が合えば Workers の型の部分をそこから写す（作り直さない）。
// 手で直した所を見逃さないよう、前のファイルをどけてから作る。
// wrangler は、置いてあれば .env・.dev.vars を読む（secret の名前を Env の型に足す）。秘密情報を読ませないため、
// 置いてあれば wrangler を流さずに止める（中身は読まない）。CI には置かない
// 終了コード: 0 同じ（--write は書いた）・1 違う・失敗・2 使い方の誤り・3 前提が足りない（.env・.dev.vars がある）
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { EXIT, readArgs, runMain, showHelp } from './lib/args';
import { ROOT } from './lib/paths';

const TYPES = 'worker/worker-configuration.d.ts';
const WRANGLER = path.join(ROOT, 'node_modules/.bin/wrangler');

const main = (argv: string[]) => {
  const { values } = readArgs(argv, { write: { type: 'boolean' } });
  if (values.help) return showHelp(import.meta.filename);
  const write = values.write === true;

  const secrets = readdirSync(ROOT).filter((f) => /^(\.env|\.dev\.vars)(\..*)?$/.test(f));
  if (secrets.length) {
    console.error(
      `${secrets.join('・')} があるので止めます。wrangler types はこれを読み、secret の名前を Env の型に足します（中身は読んでいません）。` +
        'このリポジトリには置かない決まりです。別の場所へ移してから流してください',
    );
    return EXIT.missing;
  }

  const file = path.join(ROOT, TYPES);
  const before = existsSync(file) ? readFileSync(file, 'utf8') : null;
  if (before === null && !write) {
    console.error(`${TYPES} がありません。npm run gen:worker-types で作って commit してください`);
    return EXIT.failed;
  }
  return compare(file, before, write);
};

/** 作り直して、前の中身とくらべる（write なら書く）。確かめるだけのときは、前の中身に戻す */
const compare = (file: string, before: string | null, write: boolean): number => {
  let after: string | null = null;
  let failure = '';
  try {
    rmSync(file, { force: true });
    const result = spawnSync(WRANGLER, ['types', TYPES], {
      cwd: ROOT,
      encoding: 'utf8',
      // 使った記録を Cloudflare に送らない。.env の値と、手元の環境変数を secret として型に入れない
      env: {
        ...process.env,
        WRANGLER_SEND_METRICS: 'false',
        CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false',
        CLOUDFLARE_INCLUDE_PROCESS_ENV: 'false',
      },
    });
    if (result.status === 0 && existsSync(file)) after = readFileSync(file, 'utf8');
    else {
      failure = [
        `${result.stdout ?? ''}${result.stderr ?? ''}`.trim(),
        `wrangler types が失敗しました（${result.error?.message ?? `終了コード ${result.status ?? result.signal}`}）`,
      ].join('\n');
    }
  } finally {
    // 失敗したときは、前の中身に戻す。確かめるだけのときも、作り直した中身が違えば前の中身に戻す（手元のファイルを書き換えたままにしない）
    if (before !== null && (after === null || (!write && after !== before))) writeFileSync(file, before);
  }
  if (after === null) {
    console.error(failure);
    return EXIT.failed;
  }

  if (write) {
    console.log(
      before === after ? `${TYPES} は変わりませんでした` : `${TYPES} を作り直しました。差分を見て commit してください`,
    );
    return EXIT.ok;
  }
  if (before === after) {
    console.log(`${TYPES} は、wrangler.jsonc と wrangler の版から作り直した中身と同じです`);
    return EXIT.ok;
  }
  const a = (before ?? '').split('\n');
  const b = after.split('\n');
  const at = a.findIndex((l, i) => l !== b[i]);
  const line = at < 0 ? a.length + 1 : at + 1;
  const show = (s: string | undefined) =>
    s === undefined ? '（行が無い）' : s.length > 160 ? `${s.slice(0, 160)}…` : s;
  console.error(
    [
      `${TYPES} が、wrangler.jsonc と wrangler の版から作り直した中身と違います（${line} 行目から）`,
      `  今の中身:       ${show(a[line - 1])}`,
      `  作り直した中身: ${show(b[line - 1])}`,
      '直し方: npm run gen:worker-types で作り直し、差分を見て commit する（手では直さない）',
    ].join('\n'),
  );
  return EXIT.failed;
};

if (import.meta.main) await runMain(main);
