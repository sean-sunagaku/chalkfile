// 書体。テーマの書体（Theme の fonts）を言語に合わせて選ぶ決まりと、手元に置く書体のファイル（engine/fonts/）の一覧と、
// 書体に入れる文字（台本の文字）の集め方。React・Remotion・Node に依存しない。
//   fontsFor(theme, lang)   本文の書体の並び。動画のパレット（engine/core/theme.ts の derivePalette）が使う
//   FONTS                   書体ごとの名前・ファイル・太さ・文字を集める言語。動画（src/fonts.ts）が読み込み、
//                           サブセットを作る道具（scripts/fonts.ts）がファイルを作り、台本の検証が「書体に無い文字」を見る
//   videoText / courseText  動画が描く文字と、講座の台本の全部の文字（サブセットは両方、書体に無い文字の点検は動画が描く文字で見る）
// 書体のファイルは、台本の全部の文字（全講座・全言語）だけを入れたサブセット（woff2）。台本の文字が増えたら npm run fonts で作り直す
import { LANGS, type Lang } from './i18n';
import type { Course, FontKey, Lecture, Theme, Video } from './schema';
import { VIDEO_TEXT } from './video-text';
import { lectureCredits } from './voices';

/**
 * 言語ごとの本文の書体。中国語（簡体字）は、日本語の書体（Zen Maru Gothic・Noto Sans JP）の代わりに Noto Sans SC を使う
 * （日本語の書体には簡体字の字形が無く、あっても日本の字形になる）。英字用の書体（Inter）は残す。英語と日本語はテーマのまま
 */
export const fontsFor = (theme: Theme, lang: Lang = 'ja'): FontKey[] =>
  lang === 'zh' ? [...theme.fonts.filter((f) => f === 'inter'), 'noto-sc'] : theme.fonts;

/** 書体の名前。本文の書体（テーマの fonts）と、コード・ID・数字の等幅の書体（mono。JetBrains Mono） */
export type FontId = FontKey | 'mono';

/** 書体のファイル 1 つ。可変の書体（太さの軸がある）は、1 つのファイルを太さごとに登録する */
export type FontFile = {
  /** engine/fonts/ の中のファイルの名前 */
  file: string;
  /** このファイルで描く太さ（CSS の font-weight） */
  weights: readonly number[];
};

export type FontDef = {
  /** CSS の font-family の名前（元の書体と同じ名前） */
  family: string;
  files: readonly [FontFile, ...FontFile[]];
  /** 文字を集める言語（この言語の台本の文字だけを入れる） */
  langs: readonly Lang[];
  /**
   * 入れる文字の範囲（Unicode の [始め, 終わり]）。書かなければ、集めた文字の全部。
   * 英字の書体は、範囲の外の文字（矢印・丸の数字など）を次の書体で描くので、範囲を決める
   */
  ranges?: readonly (readonly [number, number])[];
};

/**
 * 英字の書体の範囲。Google Fonts の latin と同じ（前に Google Fonts から読んでいたときも、Inter と JetBrains Mono は latin だけを読んでいた。
 * 範囲の外の文字は、本文の書体で描く）
 */
export const LATIN: readonly (readonly [number, number])[] = [
  [0x0000, 0x00ff],
  [0x0131, 0x0131],
  [0x0152, 0x0153],
  [0x02bb, 0x02bc],
  [0x02c6, 0x02c6],
  [0x02da, 0x02da],
  [0x02dc, 0x02dc],
  [0x0304, 0x0304],
  [0x0308, 0x0308],
  [0x0329, 0x0329],
  [0x2000, 0x206f],
  [0x20ac, 0x20ac],
  [0x2122, 0x2122],
  [0x2191, 0x2191],
  [0x2193, 0x2193],
  [0x2212, 0x2212],
  [0x2215, 0x2215],
  [0xfeff, 0xfeff],
  [0xfffd, 0xfffd],
];

/** 範囲の中の文字か（範囲を書かない書体は、どの文字も入る） */
export const inRanges = (codePoint: number, ranges?: FontDef['ranges']): boolean =>
  !ranges || ranges.some(([from, to]) => codePoint >= from && codePoint <= to);

/**
 * 手元に置く書体（engine/fonts/）。太さは、前に Google Fonts から読んでいた太さと同じにする（無い太さは、近い太さで描く）。
 * Zen Maru Gothic は太さごとのファイル、ほかは太さの軸のある 1 つのファイル。出どころ（版と sha256）は engine/fonts/fonts.json
 */
export const FONTS: Record<FontId, FontDef> = {
  'zen-maru': {
    family: 'Zen Maru Gothic',
    files: [
      { file: 'zen-maru-gothic-500.woff2', weights: [500] },
      { file: 'zen-maru-gothic-700.woff2', weights: [700] },
      { file: 'zen-maru-gothic-900.woff2', weights: [900] },
    ],
    langs: ['ja', 'en'],
  },
  noto: {
    family: 'Noto Sans JP',
    files: [{ file: 'noto-sans-jp.woff2', weights: [400, 500, 700, 900] }],
    langs: ['ja', 'en'],
  },
  'noto-sc': {
    family: 'Noto Sans SC',
    files: [{ file: 'noto-sans-sc.woff2', weights: [400, 500, 700, 900] }],
    langs: ['zh'],
  },
  inter: {
    family: 'Inter',
    files: [{ file: 'inter.woff2', weights: [400, 500, 600, 700, 800, 900] }],
    langs: LANGS,
    ranges: LATIN,
  },
  mono: {
    family: 'JetBrains Mono',
    files: [{ file: 'jetbrains-mono.woff2', weights: [400, 500, 700] }],
    langs: LANGS,
    ranges: LATIN,
  },
};

/** 書体のファイルの置き場所（リポジトリの最上位から） */
export const FONT_DIR = 'engine/fonts';

/* ───────────── 書体に入れる文字 ───────────── */

/** 値の中の全部の文字列（オブジェクトと配列をたどる） */
const strings = (v: unknown, out: string[] = []): string[] => {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) for (const x of v) strings(x, out);
  else if (v && typeof v === 'object') for (const x of Object.values(v)) strings(x, out);
  return out;
};

/** どの書体にも入れる文字: 英数字と記号（数・番号・コード）と、部品が描く決まった文字（クイズの ○ と ×） */
export const FIXED_TEXT = `${String.fromCharCode(...Array.from({ length: 0x7f - 0x20 }, (_, i) => 0x20 + i))}○×`;

/** 動画の言語の、部品が出す決まった文字（src/i18n.ts の VIDEO_TEXT。進み具合とクレジットは、その動画の数と声で作る） */
const fixedTextOf = (lecture: Lecture, course: Course, lang: Lang): string[] => {
  const t = VIDEO_TEXT[lang];
  const total = course.syllabus?.chapters.length ?? course.lectures.length;
  return [
    ...strings({ ...t, progress: undefined, credits: undefined }),
    t.progress(lecture.no, total),
    t.credits(lectureCredits(lecture, lang)),
  ];
};

/**
 * 動画が描く文字（場面・レクチャーの題・注意書き・講座の題・断り書き・配役の名前・部品の決まった文字・クレジット）。
 * 書体に無い文字の点検は、これで見る（書体に無い文字は、手元の書体で描くので、書き出す機械で字形が変わる）
 */
export const videoText = ({ lecture, course, lang }: Video): string =>
  [
    ...strings(lecture.scenes),
    lecture.title,
    lecture.caution ?? '',
    course.title,
    course.disclaimer ?? '',
    ...Object.values(course.cast ?? {}).map((c) => c.name),
    ...fixedTextOf(lecture, course, lang),
    FIXED_TEXT,
  ].join('');

/** 講座の台本の全部の文字（読む教材・クイズ・出典なども。講座サイトも同じ書体のファイルを使うので、サブセットに入れる） */
export const courseText = (course: Course): string => strings(course).join('');

/** 文字の集まり（重なりを除いて、符号の順に並べる。改行とタブは除く） */
export const charSet = (texts: Iterable<string>): number[] => {
  const set = new Set<number>();
  for (const text of texts)
    for (const ch of text) {
      const cp = ch.codePointAt(0) ?? 0;
      if (cp >= 0x20 && cp !== 0x7f) set.add(cp);
    }
  return [...set].sort((a, b) => a - b);
};
