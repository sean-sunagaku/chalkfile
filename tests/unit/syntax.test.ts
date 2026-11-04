// コードの色分け（src/components/syntax.ts）と、端末・窓の枠の部品（src/components/frame.tsx）
import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { VIDEOS } from '../../content';
import type { CodeScene } from '../../content/types';
import { italicComments, type Token, tokenize } from '../../src/components/syntax';

const ROOT = path.resolve(import.meta.dir, '../..');
const brief = (ts: Token[]) => ts.filter((t) => t.kind).map((t) => `${t.kind}:${t.text}`);

/** 前の部品（src/scenes/code.tsx）が、全部の言語に当てていた Python の規則と JSON の規則 */
const OLD_RX =
  /(#.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b(?:def|return|if|not|in|for|and|or|try|except|class|async|await|None|True|False|import|from|with|as|elif|else|while|is)\b)|(@[\w.]+)|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_]\w*(?=\())/gm;
const OLD_JSON = /("(?:[^"\\]|\\.)*"(?=\s*:))|("(?:[^"\\]|\\.)*")|(\b(?:true|false|null)\b)|(-?\b\d+(?:\.\d+)?\b)/gm;
const oldTokens = (line: string, json: boolean): string[] =>
  [...line.matchAll(json ? OLD_JSON : OLD_RX)].map((m) => {
    const kinds = json
      ? ['fn', 'string', 'keyword', 'number']
      : ['comment', 'string', 'keyword', 'deco', 'number', 'fn'];
    return `${kinds[m.slice(1).findIndex((g) => g !== undefined)]}:${m[0]}`;
  });

const codeScenes = (lang: CodeScene['lang']) =>
  VIDEOS.flatMap((v) => v.lecture.scenes.filter((s): s is CodeScene => s.kind === 'code' && s.lang === lang));

describe('コードの色分けは言語ごと', () => {
  test('Python と JSON は前と同じ字句に分ける（台本の全部の Python と JSON のコードで）', () => {
    for (const lang of ['python', 'json'] as const) {
      const scenes = codeScenes(lang);
      expect(scenes.length).toBeGreaterThan(0);
      for (const s of scenes)
        for (const line of s.code.split('\n'))
          expect(brief(tokenize(line, lang))).toEqual(oldTokens(line, lang === 'json'));
    }
  });
  test('TypeScript: // のコメント・const と =>・テンプレートの文字列・関数の呼び出しに色が付く。文字列の中の // はコメントにしない', () => {
    expect(brief(tokenize('const lin = (v: number) => lum(v); // 相対輝度', 'ts'))).toEqual([
      'keyword:const',
      'keyword:=>',
      'fn:lum',
      'comment:// 相対輝度',
    ]);
    expect(brief(tokenize("fetch('https://example.com/a', `x${1}`);", 'ts'))).toEqual([
      'fn:fetch',
      "string:'https://example.com/a'",
      'string:`x${1}`',
    ]);
    expect(brief(tokenize('return s <= 0.04045 ? s / 12.92 : 1;', 'ts'))).toEqual([
      'keyword:return',
      'number:0.04045',
      'number:12.92',
      'number:1',
    ]);
  });
  test('シェル: コメント・変数・オプション・文字列に色が付く', () => {
    expect(brief(tokenize('export URL="$HOST" && curl --silent $URL # 取る', 'bash'))).toEqual([
      'keyword:export',
      'string:"$HOST"',
      'fn:--silent',
      'deco:$URL',
      'comment:# 取る',
    ]);
  });
  test('text は色を付けない（HTML のような文でも 1 つの字句のまま）', () => {
    const line = '<input id="tel" type="tel"> # 例';
    expect(tokenize(line, 'text')).toEqual([{ text: line }]);
    expect(italicComments('text')).toBe(false);
    expect(italicComments('json')).toBe(false);
    expect(italicComments('ts')).toBe(true);
  });
  test('字句をつなぐと、もとの行に戻る', () => {
    for (const lang of ['python', 'ts', 'bash', 'json', 'text'] as const) {
      for (const s of VIDEOS.flatMap((v) => v.lecture.scenes.filter((x): x is CodeScene => x.kind === 'code'))) {
        for (const line of s.code.split('\n'))
          expect(
            tokenize(line, lang)
              .map((t) => t.text)
              .join(''),
          ).toBe(line);
      }
    }
  });
});

describe('端末と窓の枠は 1 つの部品で描く（src/components/frame.tsx）', () => {
  test('スマホの本体の色（DEVICE）と窓の信号（WINDOW_LIGHTS）を読むのは frame.tsx（スマホの画面の流れは、画面が出る前の下地の色だけ）', () => {
    const files = ['src/components', 'src/scenes'].flatMap((d) =>
      readdirSync(path.join(ROOT, d))
        .filter((f) => f.endsWith('.tsx'))
        .map((f) => `${d}/${f}`),
    );
    const users = (name: string) =>
      files.filter((f) => new RegExp(`\\b${name}\\b`).test(readFileSync(path.join(ROOT, f), 'utf8')));
    expect(users('WINDOW_LIGHTS')).toEqual(['src/components/frame.tsx']);
    expect(users('DEVICE').sort()).toEqual(['src/components/frame.tsx', 'src/scenes/phone.tsx']);
    expect(readFileSync(path.join(ROOT, 'src/scenes/phone.tsx'), 'utf8').match(/DEVICE\.\w+/g)).toEqual([
      'DEVICE.screen',
    ]);
  });
});
