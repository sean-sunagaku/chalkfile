// 判別共用体の switch で、全部の種類を扱ったことを型で確かめる。default に置く:
//   switch (s.kind) { case 'opening': …; case 'goals': …; default: return assertNever(s, '場面の種類'); }
// 種類を型に足したのに case を書き忘れると、ここに渡す値が never にならず、型のエラーになる。
// 型の外の値（壊れた台本や JSON）が実行時に来たら、種類の名前を出して止める（黙って undefined を返さない）。
// React・Remotion・Node に依存しない

/** 扱っていない種類が来たら止める。what はエラーの文に入れる、何の種類か */
export function assertNever(value: never, what = '種類'): never {
  const v: unknown = value;
  const kind = v !== null && typeof v === 'object' && 'kind' in v ? v.kind : v;
  throw new Error(`扱っていない${what}です: ${typeof kind === 'string' ? `「${kind}」` : String(kind)}`);
}
