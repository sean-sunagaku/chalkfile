// 書体の選び方。テーマの書体（Theme の fonts）を、動画とサイトの言語に合わせて選ぶ。
// 動画のパレット（engine/core/theme.ts の derivePalette）が使い、部品（src/theme.ts）と講座サイト（scripts/site_theme.ts）は、そのパレットの fonts を読む
import type { Lang } from './i18n';
import type { FontKey, Theme } from './schema';

/**
 * 言語ごとの本文の書体。中国語（簡体字）は、日本語の書体（Zen Maru Gothic・Noto Sans JP）の代わりに Noto Sans SC を使う
 * （日本語の書体には簡体字の字形が無く、あっても日本の字形になる）。英字用の書体（Inter）は残す。英語と日本語はテーマのまま
 */
export const fontsFor = (theme: Theme, lang: Lang = 'ja'): FontKey[] =>
  lang === 'zh' ? [...theme.fonts.filter((f) => f === 'inter'), 'noto-sc'] : theme.fonts;
