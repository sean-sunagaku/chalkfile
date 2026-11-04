// コードの色分け（言語ごとの規則）。コードの場面（src/scenes/code.tsx）が、1 行ずつ字句に分けて、字句の種類の色（テーマの syntax）で描く。
// 言語は台本の lang（python・ts・bash・json・text）。text は色を付けない。React・Remotion に依存しない（tests/unit/syntax.test.ts が確かめる）
import type { CodeScene, Theme } from '../../engine/core/schema';

/** 字句の種類（テーマの syntax の名前。plain は色を付けない文字） */
export type SyntaxKind = Exclude<keyof Theme['syntax'], 'plain'>;
export type Token = { text: string; kind?: SyntaxKind | undefined };

/** 言語ごとの規則。正規表現の組の順に、種類を当てる（先の組が勝つ） */
type Rule = { rx: RegExp; kinds: SyntaxKind[] };

const STRING = `"(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'`;
const NUMBER = '\\b\\d+(?:\\.\\d+)?\\b';

const RULES: Record<Exclude<CodeScene['lang'], 'text'>, Rule> = {
  // Python: コメント・文字列・予約語・デコレーター・数・関数の呼び出し
  python: {
    rx: new RegExp(
      `(#.*$)|(${STRING})|(\\b(?:def|return|if|not|in|for|and|or|try|except|class|async|await|None|True|False|import|from|with|as|elif|else|while|is)\\b)|(@[\\w.]+)|(${NUMBER})|(\\b[A-Za-z_]\\w*(?=\\())`,
      'gm',
    ),
    kinds: ['comment', 'string', 'keyword', 'deco', 'number', 'fn'],
  },
  // TypeScript: コメント（// と 1 行の /* */）・文字列（テンプレートも）・予約語と =>・デコレーター・数・関数の呼び出し
  ts: {
    rx: new RegExp(
      `(\\/\\/.*$|\\/\\*.*?\\*\\/)|(${STRING}|\`(?:[^\`\\\\]|\\\\.)*\`)|(\\b(?:const|let|var|function|return|if|else|for|while|do|of|in|new|class|extends|implements|interface|type|enum|import|from|export|default|async|await|try|catch|finally|throw|switch|case|break|continue|as|satisfies|typeof|instanceof|keyof|readonly|void|this|true|false|null|undefined)\\b|=>)|(@[\\w.]+)|(${NUMBER})|(\\b[A-Za-z_$][\\w$]*(?=\\())`,
      'gm',
    ),
    kinds: ['comment', 'string', 'keyword', 'deco', 'number', 'fn'],
  },
  // シェル: コメント（行の頭か空白のあとの #）・文字列・予約語・変数（$NAME・${…}）・数・オプション（-x・--name）
  bash: {
    rx: new RegExp(
      `((?:^|(?<=\\s))#.*$)|(${STRING})|(\\b(?:if|then|else|elif|fi|for|in|do|done|while|until|case|esac|function|return|export|local|readonly)\\b)|(\\$\\{[^}]*\\}|\\$[A-Za-z_]\\w*|\\$\\d)|(${NUMBER})|((?<=\\s)--?[A-Za-z][\\w-]*)`,
      'gm',
    ),
    kinds: ['comment', 'string', 'keyword', 'deco', 'number', 'fn'],
  },
  // JSON: キー（: が続く文字列）・値の文字列・true／false／null・数
  json: {
    rx: /("(?:[^"\\]|\\.)*"(?=\s*:))|("(?:[^"\\]|\\.)*")|(\b(?:true|false|null)\b)|(-?\b\d+(?:\.\d+)?\b)/gm,
    kinds: ['fn', 'string', 'keyword', 'number'],
  },
};

/** 1 行を字句に分ける（色の付かない文字は kind なし）。text は全部を 1 つの字句にする */
export const tokenize = (line: string, lang: CodeScene['lang']): Token[] => {
  if (lang === 'text' || !line) return line ? [{ text: line }] : [];
  const rule = RULES[lang];
  const out: Token[] = [];
  let last = 0;
  for (const m of line.matchAll(rule.rx)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: line.slice(last, i) });
    const group = m.slice(1).findIndex((g) => g !== undefined);
    out.push({ text: m[0], kind: rule.kinds[group] });
    last = i + m[0].length;
  }
  if (last < line.length) out.push({ text: line.slice(last) });
  return out;
};

/** コメントを斜めにする言語（JSON にはコメントが無い） */
export const italicComments = (lang: CodeScene['lang']): boolean => lang !== 'json' && lang !== 'text';
