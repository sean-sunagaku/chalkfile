// サイトの HTML を安全に組み立てる部品（scripts/site/html.ts）。エスケープが既定・raw() で外す・印の 1 回の置き換え・テーマの色の形
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  cssColor,
  esc,
  fillTemplate,
  html,
  htmlText,
  inlineScript,
  joinHtml,
  jsonHtml,
  raw,
  styleText,
} from '../scripts/site/html';
import { cspHead, scriptHash, WWW_REDIRECT_SCRIPT } from '../scripts/site/csp';

describe('html`…` と raw()', () => {
  test('文字と数はエスケープし、Html はそのまま、配列はつなぐ', () => {
    const name = '<b>"太郎" & 花子</b>';
    const h = html`<p title="${name}">${name} ${3} ${raw('<i>そのまま</i>')}${['a', html`<br>`, 'b']}</p>`;
    expect(htmlText(h)).toBe(
      '<p title="&lt;b&gt;&quot;太郎&quot; &amp; 花子&lt;/b&gt;">&lt;b&gt;&quot;太郎&quot; &amp; 花子&lt;/b&gt; 3 <i>そのまま</i>a<br>b</p>',
    );
  });
  test('joinHtml は区切りでつなぐ。jsonHtml は < を \\u003c にする', () => {
    expect(htmlText(joinHtml([html`a`, html`b`], '\n'))).toBe('a\nb');
    expect(htmlText(jsonHtml({ t: '</script><script>x</script>' }))).toBe(
      '{"t":"\\u003c/script>\\u003cscript>x\\u003c/script>"}',
    );
  });
  test('エスケープは & < > " だけ（\' と、印の形でない _ と { はそのまま）', () => {
    expect(esc(`'a' __init__ {x} {{ x`)).toBe(`'a' __init__ {x} {{ x`);
  });
  test('台本の文字の、印の形をした所（__NAME__・{{key}}）は、表示を変えずに印に見えなくする', () => {
    expect(esc('__DOCS_NOTE__ と {{tabQuiz}} と {{ja.offPageTitle}}')).toBe(
      '&#95;_DOCS_NOTE__ と &#123;{tabQuiz}} と &#123;{ja.offPageTitle}}',
    );
  });
});

describe('fillTemplate（印を 1 回の走査で置き換える）', () => {
  const text = (k: string) => ({ hello: 'こんにちは <世界>', 'ja.x': 'じゃ' })[k];
  test('__NAME__ は Html、{{key}} は文字（エスケープする）。同じ印が何度あっても全部', () => {
    const out = fillTemplate('__A__/{{hello}}/__A__/{{ja.x}}', { marks: { A: html`<b>${'1&2'}</b>` }, text }, 't');
    expect(out).toBe('<b>1&amp;2</b>/こんにちは &lt;世界&gt;/<b>1&amp;2</b>/じゃ');
  });
  test('差し込んだ値をもう一度なめない（台本に __B__ や {{hello}} と書いてあっても、ほかの印に当たらない）', () => {
    const out = fillTemplate('__A__|__B__', { marks: { A: raw('__B__ {{hello}}'), B: html`b` }, text }, 't');
    expect(out).toBe('__B__ {{hello}}|b');
  });
  test('知らない印・使われない値・値の無い印は止める（まとめて 1 つのエラー）', () => {
    expect(() => fillTemplate('__A__ __X__', { marks: { A: html`a` } }, 'site/x.html')).toThrow(
      'site/x.html の置き換え: 知らない印 __X__',
    );
    expect(() => fillTemplate('__A__', { marks: { A: html`a`, B: html`b` } }, 't')).toThrow('使われない値 __B__');
    expect(() => fillTemplate('{{nope}}', { text }, 't')).toThrow('値の無い印 {{nope}}');
    expect(() => fillTemplate('__A__', { marks: { A: 'a' as never } }, 't')).toThrow('値の無い印 __A__');
  });
  test('keep の印は残す（あとで別に置き換える __CSP__ や、SW が置き換える __ROOT__）', () => {
    expect(fillTemplate('__CSP__ __A__', { marks: { A: html`a` }, keep: ['CSP'] }, 't')).toBe('__CSP__ a');
  });
});

describe('属性・script・style に入れるもの', () => {
  test('テーマの色は #rgb・#rrggbb・#rrggbbaa・rgb()・rgba() だけを通す', () => {
    for (const ok of ['#fff', '#FFFFFF', '#14312A80', 'rgba(255,255,255,0.10)', 'rgb(0, 0, 0)'])
      expect(cssColor(ok)).toBe(ok);
    for (const bad of ['red', '#ggg', '#fff" onload="x', 'rgba(1,2,3,0.5);background:url(x)', 'url(x)'])
      expect(() => cssColor(bad)).toThrow('テーマの色の形が違う');
  });
  test('script に </script が入っていれば止める。style に </ が入っていれば止める', () => {
    expect(htmlText(inlineScript('a<b'))).toBe('<script>a<b</script>');
    expect(() => inlineScript('x="</script>"')).toThrow('</script');
    expect(htmlText(styleText('a{color:red}'))).toBe('a{color:red}');
    expect(() => styleText('a{}</style><script>')).toThrow('</');
  });
});

describe('CSP（scripts/site/csp.ts）', () => {
  test('__CSP__ の所に、meta の CSP（www の移動とページの script のハッシュ）と www の移動の script を入れる', () => {
    const head = htmlText(cspHead(['run(1)']));
    expect(head).toStartWith(
      `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src ${scriptHash(WWW_REDIRECT_SCRIPT)} ${scriptHash('run(1)')}; `,
    );
    expect(head).toEndWith(`"><script>${WWW_REDIRECT_SCRIPT}</script>`);
  });
  test('講座のページのテンプレートに、動く script を書かない（画面は site/course-page.ts。組み立てが __PAGE_SCRIPT__ の所に入れる）', () => {
    const template = readFileSync(path.join(import.meta.dir, '../site/template.html'), 'utf8');
    const scripts = [...template.matchAll(/<script\b([^>]*)>/gi)].map((m) => m[1].trim());
    expect(scripts).toEqual(['id="course-data" type="application/json"']);
    expect(template.split('__PAGE_SCRIPT__')).toHaveLength(2);
  });
});
