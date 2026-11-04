// 訳の言語の決まった文字を、日本語（site/i18n/ja.ts）と同じ形に書かせる型（defineLocale）。ここは型と、渡したものをそのまま返す関数だけ。
//   - 日本語にあるキーは全部書く（足りなければ型のエラー）。日本語に無いキーは書けない（余ったキーは never のエラー）
//   - 文字の差し込み（{name}）の名前は、日本語と同じ組にする（違えば「差し込みの名前を日本語とそろえる」が出る）
//   - 数で形の変わる文字（{ other: … }）は Plural。その言語の Intl.PluralRules が選ぶ形（one・few など）を足してよい。
//     どの形の差し込みも、日本語の差し込みの名前の中から使う（one を「1 lecture」のように {n} 無しで書いてもよい）
import type { Plural, VarsOf } from '../lib/text';

/** 日本語の表 B（文字の型に差し込みの名前を持つ）から作る、どの言語にも使える表の型（文字は string、数で形の変わる文字は Plural） */
export type LocaleOf<B> = {
  readonly [K in keyof B]: B[K] extends string ? string : B[K] extends { readonly other: string } ? Plural : LocaleOf<B[K]>;
};

type PluralVars<P> = { [F in keyof P]: VarsOf<P[F]> }[keyof P];
type Same<A, C> = [A] extends [C] ? ([C] extends [A] ? true : false) : false;
/** 型のエラーに出す、直し方の印 */
type Hint<V> = { readonly 差し込みの名前を日本語とそろえる: V };

/** 訳の表 L を、日本語の表 B と照らす型（合うところは L のまま、違うところは Hint か never になり、型のエラーになる） */
type Check<B, L> = {
  readonly [K in keyof B | keyof L]: K extends keyof B
    ? K extends keyof L
      ? B[K] extends string
        ? L[K] extends string
          ? Same<VarsOf<B[K]>, VarsOf<L[K]>> extends true
            ? L[K]
            : Hint<VarsOf<B[K]>>
          : string
        : B[K] extends { readonly other: string }
          ? L[K] extends Plural
            ? [PluralVars<L[K]>] extends [PluralVars<B[K]>]
              ? L[K]
              : Hint<PluralVars<B[K]>>
            : Plural
          : Check<B[K], L[K]>
      : LocaleOf<B>[K]
    : never;
};

/**
 * 訳の言語の表を書く: export const en = defineLocale<typeof ja>()({ … })。2 段の呼び方なのは、日本語の形（B）を決めてから、
 * 書いた表（L）を文字の型のまま受け取って照らすため。返す型は、どの言語にも使える表（LocaleOf<B>）
 */
export const defineLocale =
  <B>() =>
  <const L>(locale: L & Check<B, L>): LocaleOf<B> =>
    locale as unknown as LocaleOf<B>;
