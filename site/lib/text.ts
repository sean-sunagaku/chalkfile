// 文字の部品: HTML のエスケープ（esc）と、{name} の差し込み（fill・texts の tt）と、数で形の変わる文字（plural・texts の tn）。
// サイトの組み立て（scripts/site/）・Service Worker（site/sw.ts）・画面（site/course-page.ts・site/offline-client.ts）が同じものを使う。
// ほかのファイルを import しない（SW にも入れる）。画面は、文字を DOM の文字として入れる（site/page/dom.ts）ので esc を使わない

/**
 * HTML の文字と属性の値に入れるときのエスケープ（& < > "）。文字が、組み立ての置き換えの印（__NAME__・{{key}}）に見えないように、
 * 印の形をした所の最初の 1 字を文字参照にする（表示は同じ。組み立ての最後の点検 scripts/site-invariants.ts が、置き換え忘れと取り違えない）
 */
export const esc = (s: string) =>
  s
    .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)
    .replace(/_(?=_[A-Z][A-Z0-9_]*__)/g, '&#95;')
    .replace(/\{(?=\{\s*[A-Za-z_][\w.]*\s*\}\})/g, '&#123;');

/** 文字の {name} の名前（template literal の型で取り出す。'{done} / {total} 完了' なら 'done' | 'total'） */
export type VarsOf<S> = S extends `${string}{${infer K}}${infer R}` ? K | VarsOf<R> : never;

/**
 * 数で形の変わる文字。other は必ず書く。ほかの形（zero・one・two・few・many）は、その言語の Intl.PluralRules が選ぶものだけ書く
 * （日本語と中国語は other だけ。英語は one と other）
 */
export type Plural = { readonly other: string } & { readonly [F in Exclude<Intl.LDMLPluralRule, 'other'>]?: string };

/** 差し込む値 */
export type Vars = Readonly<Record<string, string | number>>;

/** {name} を vars の値にする（vars に無い名前は、そのまま残す） */
export const fill = (s: string, vars: Vars = {}) =>
  s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));

const rules = new Map<string, Intl.PluralRules>();
/** n の形の文字を選び（locale の Intl.PluralRules。HTML の lang の ja・en・zh-Hans）、{n} と vars を入れる。無い形は other */
export const plural = (p: Plural, n: number, locale: string, vars: Vars = {}) => {
  const r = rules.get(locale) ?? new Intl.PluralRules(locale);
  rules.set(locale, r);
  return fill(p[r.select(n)] ?? p.other, { ...vars, n });
};

type StringKey<B> = { [K in keyof B]: B[K] extends string ? K : never }[keyof B] & string;
type PluralKey<B> = { [K in keyof B]: B[K] extends Plural ? K : never }[keyof B] & string;
type PluralVars<P> = { [F in keyof P]: VarsOf<P[F]> }[keyof P];
/** 差し込む値の引数（差し込みの無い文字なら渡さない） */
type VarsArg<V> = [V] extends [never] ? [] : [vars: Readonly<Record<V & string, string | number>>];
/** ページの言語の表（文字は string、数で形の変わる文字は Plural）。B は日本語の表の型 */
export type TextTable<B> = {
  readonly [K in keyof B]: B[K] extends string ? string : B[K] extends Plural ? Plural : unknown;
};

/**
 * 決まった文字の表から、キーで引いて差し込む関数を作る。tt は文字、tn は数で形の変わる文字（{n} に数を入れる）。
 * B は日本語の表の型（site/i18n/ja.ts。文字の型に差し込みの名前がある）、table はページの言語の表、locale は Intl.PluralRules の言語。
 * 差し込む値の名前が文字と合わないと、型のエラーになる
 */
export const texts = <B>(table: TextTable<B>, locale: string) => ({
  tt: <K extends StringKey<B>>(key: K, ...[vars]: VarsArg<VarsOf<B[K]>>): string => fill(table[key] as string, vars),
  tn: <K extends PluralKey<B>>(key: K, n: number, ...[vars]: VarsArg<Exclude<PluralVars<B[K]>, 'n'>>): string =>
    plural(table[key] as Plural, n, locale, vars),
});
