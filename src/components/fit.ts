// 文字の幅を測って、幅に収まる大きさを決める（@remotion/layout-utils の measureText・fitText）。部品は、文字の数や
// 見込みの係数で大きさを決めずに、ここで測る（書体ごと・言語ごとの文字の幅の違いを、そのまま測る）。
// 測るのは書体を読み込んだあと（src/Lecture.tsx が src/fonts.ts の useFonts で待ってから場面を描く）。読み込む前に測ると止める（validateFontIsLoaded）。
// 縮めるときも、役割の下限（src/video.config.ts の TYPE_MIN）より小さくしない
import { fitText, measureText } from '@remotion/layout-utils';
import type React from 'react';
import { TYPE_MIN, type TypeRole } from '../video.config';

/** 測る文字の書体（CSS の font-family）・太さ・字間（px） */
export type TextStyle = { fontFamily: string; fontWeight: number; letterSpacing?: number };

const spacing = (s: TextStyle) => (s.letterSpacing ? `${s.letterSpacing}px` : undefined);

/** 1 行に並べたときの文字の幅（px） */
export const textWidth = (text: string, fontSize: number, s: TextStyle): number =>
  text
    ? measureText({
        text,
        fontSize,
        fontFamily: s.fontFamily,
        fontWeight: s.fontWeight,
        ...(s.letterSpacing ? { letterSpacing: spacing(s)! } : {}),
        validateFontIsLoaded: true,
      }).width
    : 0;

export type FitOptions = TextStyle & {
  /** 役割（縮めても、この役割の下限より小さくしない） */
  role: TypeRole;
  /** 収まるときの大きさ（大きくはしない） */
  max: number;
  /** 縮める下限（役割の下限より小さい値は、役割の下限にする） */
  min?: number;
  /** 収める幅（px） */
  width: number;
};

const lowest = (o: FitOptions) => Math.min(o.max, Math.max(TYPE_MIN[o.role], o.min ?? 0));

/** 1 行で幅に収まる文字の大きさ（整数の px）。max で収まれば max、収まらなければ縮める（下限で収まらなければ下限。はみ出しは台本の検証が注意にする） */
export const fitSize = (text: string, o: FitOptions): number => {
  const min = lowest(o);
  if (!text || textWidth(text, o.max, o) <= o.width) return o.max;
  // 字間は大きさによらないので、fitText の見込みから 1px ずつ下げて確かめる
  const guess = fitText({ text, withinWidth: o.width, fontFamily: o.fontFamily, fontWeight: o.fontWeight, ...(o.letterSpacing ? { letterSpacing: spacing(o)! } : {}), validateFontIsLoaded: true }).fontSize;
  let size = Math.max(min, Math.min(o.max, Math.floor(guess)));
  while (size > min && textWidth(text, size, o) > o.width) size -= 1;
  return size;
};

/** 折り返して並べるときの書き方（行の高さ・言語・折り返しの決まり。言語ごとの折り返しは src/Lecture.tsx の WRAP） */
export type WrapStyle = TextStyle & { lineHeight: number; lang: string; wrap?: React.CSSProperties };

const lineCache = new Map<string, number>();

/**
 * 幅 width に折り返して並べたときの行の数。描く文字と同じ書き方の要素を、画面の外に置いて高さを測る
 * （日本語の文節・英語の単語の切れ目で折り返すので、文字の幅を行の幅で割るより正しい）
 */
export const wrappedLines = (text: string, fontSize: number, width: number, o: WrapStyle): number => {
  if (!text) return 0;
  const key = JSON.stringify([text, fontSize, width, o]);
  const hit = lineCache.get(key);
  if (hit !== undefined) return hit;
  if (typeof document === 'undefined') throw new Error('wrappedLines は描くとき（ブラウザの中）だけで使う');
  const node = document.createElement('div');
  node.lang = o.lang;
  Object.assign(node.style, {
    position: 'absolute',
    top: '-10000px',
    left: '0',
    width: `${width}px`,
    fontFamily: o.fontFamily,
    fontWeight: String(o.fontWeight),
    fontSize: `${fontSize}px`,
    lineHeight: String(o.lineHeight),
    letterSpacing: spacing(o) ?? 'normal',
    ...o.wrap,
  });
  node.textContent = text;
  document.body.appendChild(node);
  const height = node.getBoundingClientRect().height;
  document.body.removeChild(node);
  const n = Math.max(1, Math.round(height / (fontSize * o.lineHeight)));
  lineCache.set(key, n);
  return n;
};

/** 幅に折り返して lines 行に入る、いちばん大きな文字の大きさ（整数の px。下限でも入らなければ下限） */
export const fitLines = (text: string, lines: number, o: FitOptions & WrapStyle): number => {
  const min = lowest(o);
  let size = o.max;
  while (size > min && wrappedLines(text, size, o.width, o) > lines) size -= 1;
  return size;
};

/** 幅に入れたときの行の数の見込み（1 行に並べた幅を、行の幅で割る。重ならないように場所を空けるときの見込み） */
export const lineCount = (text: string, fontSize: number, width: number, s: TextStyle): number =>
  Math.max(1, Math.ceil(textWidth(text, fontSize, s) / width));
