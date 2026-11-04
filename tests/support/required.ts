// テストの見本に要る値を取り出す。見本が欠けていたら、後の検査へ進まずにその場で止める。
export function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('テストの見本に必要な値が無い');
  return value;
}
