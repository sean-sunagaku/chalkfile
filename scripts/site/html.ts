// サイトの HTML を安全に組み立てる部品。値はエスケープを既定にし、外すときは raw() で明示する。
//   html`<a href="${url}">${title}</a>`  文字と数はエスケープして入れる。Html（html`…`・raw()・joinHtml() が作るもの）はそのまま入れる
//   raw(text)                             信頼できる HTML（リポジトリのファイル・組み立てが作った部品）を、エスケープせずに使うと明示する
//   fillTemplate(template, { marks, text })  テンプレートの印（__NAME__ と {{key}}・{{lang.key}}）を 1 回の走査で置き換える
// 差し込んだ値をもう一度なめないので、台本に __DOCS_NOTE__ や {{tabQuiz}} と書いても、ほかの印に当たらない。
// 知らない印・使われない値・値の無い印は止める（置き換え忘れを公開しない）
const BRAND: unique symbol = Symbol('Html');

/** エスケープ済みの HTML（html`…`・raw()・joinHtml()・jsonHtml() だけが作る） */
export type Html = { readonly [BRAND]: string };

/** html`…` に入れられる値（文字と数はエスケープする。配列はつなぐ） */
export type HtmlValue = string | number | Html | readonly HtmlValue[];

const make = (text: string): Html => ({ [BRAND]: text });
const isHtml = (v: unknown): v is Html => typeof v === 'object' && v !== null && BRAND in v;

/** Html の中身の文字 */
export const htmlText = (h: Html): string => h[BRAND];

/**
 * HTML の文字と属性の値に入れるときのエスケープ（& < > "）。台本の文字が、置き換えの印（__NAME__・{{key}}）に見えないように、
 * 印の形をした所の最初の 1 字を文字参照にする（表示は同じ。組み立ての最後の点検 scripts/site-invariants.ts が、置き換え忘れと取り違えない）
 */
export const esc = (s: string) =>
  s
    .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)
    .replace(/_(?=_[A-Z][A-Z0-9_]*__)/g, '&#95;')
    .replace(/\{(?=\{\s*[A-Za-z_][\w.]*\s*\}\})/g, '&#123;');

/** 信頼できる HTML を、エスケープせずに使う（リポジトリのファイル・組み立てが作った部品だけに使う） */
export const raw = (text: string): Html => make(text);

const render = (v: HtmlValue): string =>
  isHtml(v) ? htmlText(v) : Array.isArray(v) ? v.map(render).join('') : esc(String(v));

/** エスケープを既定にした HTML のテンプレート */
export const html = (strings: TemplateStringsArray, ...values: HtmlValue[]): Html =>
  make(strings.reduce((out, s, i) => out + render(values[i - 1] as HtmlValue) + s));

/** Html を区切りの文字でつなぐ（区切りは HTML として入れる） */
export const joinHtml = (parts: readonly Html[], sep: string): Html => make(parts.map(htmlText).join(sep));

/** <script type="application/json"> の中身。< は \u003c にする（文字が </script> を含んでも、script を閉じない） */
export const jsonHtml = (value: unknown): Html => make(JSON.stringify(value).replace(/</g, '\\u003c'));

/** ページの中で動く script（信頼できるコードだけ）。</script を含むと閉じてしまうので止める */
export const inlineScript = (code: string): Html => {
  if (/<\/script/i.test(code)) throw new Error('ページに入れる script に </script が入っている');
  return make(`<script>${code}</script>`);
};

/** <style> の中身（テーマから作る CSS）。</ を含むと style を閉じられるので止める */
export const styleText = (css: string): Html => {
  if (css.includes('</')) throw new Error('ページに入れる CSS に </ が入っている');
  return make(css);
};

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGB = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)$/;

/** 属性（style・meta の content・SVG の fill）に入れるテーマの色。#rgb・#rrggbb・rgb()・rgba() のほかは止める */
export const cssColor = (value: string): string => {
  if (!HEX.test(value) && !RGB.test(value))
    throw new Error(`テーマの色の形が違う（#rrggbb か rgba() で書く）: ${value}`);
  return value;
};

/** テンプレートの印の値。marks は __NAME__（Html）、text は {{key}}・{{lang.key}}（文字。エスケープして入れる） */
export type TemplateValues = {
  marks?: Readonly<Record<string, Html>>;
  text?: (key: string) => string | undefined;
  /** 置き換えずに残す __NAME__（あとで別に置き換えるもの。CSP・SW が配るときに置き換える __ROOT__ など） */
  keep?: readonly string[];
};

const MARKS = /__([A-Z_]+)__|\{\{(\w+(?:\.\w+)?)\}\}/g;

/** テンプレートの印を 1 回の走査で置き換える。知らない印・使われない値・値の無い印は止める。where は止めたときに出す名前 */
export const fillTemplate = (template: string, values: TemplateValues, where: string): string => {
  const marks = values.marks ?? {};
  const keep = new Set(values.keep ?? []);
  const used = new Set<string>();
  const problems: string[] = [];
  const out = template.replace(MARKS, (m, name: string | undefined, key: string | undefined) => {
    if (name !== undefined) {
      if (keep.has(name)) return m;
      if (!Object.hasOwn(marks, name)) {
        problems.push(`知らない印 ${m}`);
        return m;
      }
      used.add(name);
      const value = marks[name];
      if (!isHtml(value)) {
        problems.push(`値の無い印 ${m}`);
        return m;
      }
      return htmlText(value);
    }
    const text = key === undefined ? undefined : values.text?.(key);
    if (text === undefined) {
      problems.push(`値の無い印 ${m}`);
      return m;
    }
    return esc(text);
  });
  for (const name of Object.keys(marks)) if (!used.has(name)) problems.push(`使われない値 __${name}__`);
  if (problems.length) throw new Error(`${where} の置き換え: ${[...new Set(problems)].join('・')}`);
  return out;
};
