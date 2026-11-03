// 文字の部品: HTML のエスケープ（esc）と、{name} の差し込み（fill）。サイトの組み立て（scripts/site/）と Service Worker（site/sw.ts）が
// 同じものを使う。ほかのファイルを import しない（SW にも入れる）

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
