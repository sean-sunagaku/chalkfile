// 文字の部品: HTML のエスケープ（esc）と、{name} の差し込み（fill・texts）。サイトの組み立て（scripts/site/）・Service Worker（site/sw.ts）・
// 画面（site/course-page.ts・site/offline-client.ts）が同じものを使う。ほかのファイルを import しない（SW にも入れる）。
// 画面は、文字を DOM の文字として入れる（site/page/dom.ts）ので esc を使わない

/**
 * HTML の文字と属性の値に入れるときのエスケープ（& < > "）。文字が、組み立ての置き換えの印（__NAME__・{{key}}）に見えないように、
 * 印の形をした所の最初の 1 字を文字参照にする（表示は同じ。組み立ての最後の点検 scripts/site-invariants.ts が、置き換え忘れと取り違えない）
 */
export const esc = (s: string) =>
  s
    .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)
    .replace(/_(?=_[A-Z][A-Z0-9_]*__)/g, '&#95;')
    .replace(/\{(?=\{\s*[A-Za-z_][\w.]*\s*\}\})/g, '&#123;');

/** {name} を vars の値にする（vars に無い名前は、そのまま残す） */
export const fill = (s: string, vars: Record<string, string | number> = {}) =>
  s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));

/** 決まった文字の表から、キーで引いて {name} に値を入れる関数を作る（画面の tt。表は site/i18n.ts の SiteText など） */
export const texts =
  <K extends string>(table: Readonly<Record<K, string>>) =>
  (key: K, vars?: Record<string, string | number>) =>
    fill(table[key], vars);
