// 段の単位ごとの記録（.work/state/<段>/<単位>.json）。流してできた出力が、どの入力（指紋）から作ったものかを残す。
//   { schema, stage, unit, fingerprint, parts, outputs: { <パス>: { sha256, bytes } }, tools, at }
//   fingerprint は parts（入力の部分ごとの指紋）の指紋、outputs は記録したときの出力の sha256、tools は流した道具の版（指紋には入れない）
// 書き出しのように長く流す段は、流す前に指紋を <単位>.pending.json に置き、流し終えたら比べてから記録する（流している間に入力が
// 変わったら、記録しない）。どのファイルも一時の名前に書いてから置き換える。作業フォルダの中だけに置き、Git に入れない（npm run clean が消す）
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { writeAtomic } from '../../lib/fsx';

/** 記録の形の版（形を変えたら上げる。読む側は、違う版の記録を「記録が無い」とみなす） */
export const STATE_SCHEMA = 1;
/** 記録の置き場所（リポジトリの直下から） */
export const STATE_DIR = '.work/state';

export type OutputRecord = { sha256: string; bytes: number };
/** 単位 1 つの記録 */
export type UnitState = {
  schema: typeof STATE_SCHEMA;
  stage: string;
  unit: string;
  /** parts の指紋 */
  fingerprint: string;
  /** 入力の部分ごとの指紋（どれが変わったかを見せるのに使う） */
  parts: Record<string, string>;
  /** 出力（リポジトリの直下からのパス）の sha256 と大きさ */
  outputs: Record<string, OutputRecord>;
  /** 流した道具の版（指紋には入れない。あとで調べるため） */
  tools: Record<string, string>;
  /** 記録した時刻 */
  at: string;
};
/** 流す前に置く指紋（流し終えたら比べる） */
export type Pending = { schema: typeof STATE_SCHEMA; fingerprint: string; parts: Record<string, string>; at: string };

/** 単位の名前（動画の名前 S01・S01.en、段の 1 つだけの単位 site など）。ファイルの名前にするので、形を決める */
const UNIT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const NAME = /^[a-z][a-z0-9-]*$/;
const check = (stage: string, unit: string) => {
  if (!NAME.test(stage) || !UNIT.test(unit) || unit.includes('..'))
    throw new Error(`段か単位の名前の形が違う: ${stage}/${unit}`);
};

export const stateFile = (root: string, stage: string, unit: string): string => {
  check(stage, unit);
  return path.join(root, STATE_DIR, stage, `${unit}.json`);
};
export const pendingFile = (root: string, stage: string, unit: string): string => {
  check(stage, unit);
  return path.join(root, STATE_DIR, stage, `${unit}.pending.json`);
};

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const isStrings = (x: unknown): x is Record<string, string> =>
  isObj(x) && Object.values(x).every((v) => typeof v === 'string');

const readJson = (file: string): unknown => {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};

/** 記録を読む。無い・読めない・形か版が違う・ほかの単位の記録なら null（記録が無いとみなす） */
export const readState = (root: string, stage: string, unit: string): UnitState | null => {
  const v = readJson(stateFile(root, stage, unit));
  if (!isObj(v) || v.schema !== STATE_SCHEMA || v.stage !== stage || v.unit !== unit) return null;
  if (typeof v.fingerprint !== 'string' || !isStrings(v.parts) || !isStrings(v.tools) || !isObj(v.outputs)) return null;
  for (const o of Object.values(v.outputs))
    if (!isObj(o) || typeof o.sha256 !== 'string' || typeof o.bytes !== 'number') return null;
  return v as UnitState;
};

/** 記録を書く（一時の名前に書いてから置き換える） */
export const writeState = (root: string, s: UnitState): void => {
  writeAtomic(stateFile(root, s.stage, s.unit), `${JSON.stringify(s, null, 1)}\n`);
};

export const readPending = (root: string, stage: string, unit: string): Pending | null => {
  const v = readJson(pendingFile(root, stage, unit));
  return isObj(v) && v.schema === STATE_SCHEMA && typeof v.fingerprint === 'string' && isStrings(v.parts)
    ? (v as Pending)
    : null;
};
export const writePending = (root: string, stage: string, unit: string, p: Pending): void => {
  writeAtomic(pendingFile(root, stage, unit), `${JSON.stringify(p, null, 1)}\n`);
};
export const clearPending = (root: string, stage: string, unit: string): void => {
  rmSync(pendingFile(root, stage, unit), { force: true });
};
