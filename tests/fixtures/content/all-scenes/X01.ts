import type { Lecture } from '../../../../content/types';

const Z = 'zundamon' as const; // ボケ: ずんだもん（配役は course.ts の cast）

/**
 * 全部の場面の見本（20 種類を 1 つずつ）。エンジンの単体テストと、場面ごとの静止画の比較の見本に使う。
 * 架空のサンプルアプリの話で、文は短くする（検証の注意も 0 件にする）。timeline.json は、この台本から固定の値で作ったもの（course.ts）
 */
export const X01: Lecture = {
  id: 'X01',
  no: 1,
  section: { no: 1, title: 'はじめに' },
  title: '全部の場面の見本',
  summary: '20 種類の場面を 1 つずつ並べた、検証とテストのための見本。',
  docs: [{ title: 'サンプルアプリの説明', url: 'https://example.com/docs' }],
  quiz: [
    {
      q: '見本の場面は、いくつの種類がある？',
      choices: ['10 種類', '20 種類', '30 種類'],
      answer: 1,
      explain: '場面の種類は 20 あり、この見本は 1 つずつ使う。',
    },
  ],
  takeaways: ['場面は 20 種類', '要素は台詞の番号（at）で出す'],
  caution: '説明用の見本です',
  scenes: [
    {
      kind: 'opening',
      section: 'SECTION 1　はじめに',
      title: '全部の場面の見本',
      subtitle: '20 種類を 1 つずつ',
      lines: [
        { t: '見本 1。全部の場面の見本。', v: 'announcer', pause: 0.3 },
        { t: 'ここでは、全部の場面を順に見ます。' },
      ],
    },
    {
      kind: 'goals',
      heading: 'この見本のゴール',
      items: [
        { text: '場面の種類を知る', at: 1 },
        { text: '台詞と要素の合わせ方を知る', at: 2 },
      ],
      lines: [{ t: 'ゴールは二つです。' }, { t: '場面の種類を知ること。', sfx: 'pop' }, { t: '台詞と要素の合わせ方を知ること。', sfx: 'pop' }],
    },
    {
      kind: 'points',
      heading: '3 つの点',
      columns: 3,
      numbered: true,
      items: [
        { title: '書く', body: '台本に場面を書く', at: 0, tone: 'cyan', icon: 'pen' },
        { title: '合わせる', body: '台詞の番号で出す', at: 1, tone: 'amber', icon: 'clock' },
        { title: '確かめる', body: '静止画で見る', at: 2, tone: 'mint', icon: 'eye' },
      ],
      lines: [{ t: 'まず、台本に場面を書きます。', sfx: 'pop' }, { t: '次に、台詞の番号で要素を出します。', sfx: 'pop' }, { t: '最後に、静止画で確かめます。', sfx: 'pop' }],
    },
    {
      kind: 'concepts',
      heading: '2 つの言葉',
      columns: 2,
      cards: [
        { key: 'scene', en: 'Scene', ja: '場面', desc: '画面の 1 まとまり', tone: 'violet', icon: 'layout', at: 0 },
        { key: 'line', en: 'Line', ja: '台詞', desc: '声と字幕の 1 文', tone: 'pink', icon: 'message', at: 1 },
      ],
      lines: [{ t: '場面は、画面の一まとまりです。' }, { t: '台詞は、声と字幕の一文です。', sfx: 'pop' }],
    },
    {
      kind: 'sequence',
      heading: 'やり取りの順番',
      actors: [
        { key: 'user', label: '利用者', tone: 'pink', icon: 'user' },
        { key: 'app', label: 'アプリ', sub: 'サーバー', tone: 'violet', icon: 'server' },
        { key: 'db', label: 'DB', tone: 'mint', icon: 'database' },
      ],
      steps: [
        { from: 'user', to: 'app', label: '押す', at: 1 },
        { from: 'app', to: 'db', label: '書く', at: 2, tone: 'mint' },
        { from: 'app', to: 'user', label: '返す', at: 2, dashed: true },
      ],
      lines: [{ t: '登場するのは三つです。' }, { t: '利用者が、ボタンを押します。' }, { t: 'アプリは、DB に書いて、結果を返します。' }],
    },
    {
      kind: 'flow',
      heading: '流れ',
      evidence: 'example',
      nodes: [
        { key: 'a', label: '台本', x: 420, y: 520, tone: 'cyan', icon: 'file', at: 0 },
        { key: 'b', label: '声', x: 960, y: 520, tone: 'amber', icon: 'message', at: 1 },
        { key: 'c', label: '動画', x: 1500, y: 520, tone: 'mint', icon: 'rocket', at: 2 },
      ],
      groups: [{ label: '作る', x: 220, y: 380, w: 1480, h: 300, tone: 'slate', at: 0 }],
      edges: [
        { from: 'a', to: 'b', label: '読む', at: 1 },
        { from: 'b', to: 'c', at: 2, tone: 'mint' },
      ],
      focus: [{ keys: ['b', 'c'], at: 2 }],
      lines: [{ t: '台本から始めます。' }, { t: '台本を読んで、声にします。', sfx: 'pop' }, { t: '声に合わせて、動画にします。', sfx: 'pop' }],
    },
    {
      kind: 'states',
      heading: '状態',
      nodes: [
        { key: 'start', code: 'はじめ', ja: '作る前', x: 380, y: 600, tone: 'slate', at: 0 },
        { key: 'active', code: 'active', ja: '使える', x: 960, y: 600, tone: 'mint', at: 1, badge: 'OK' },
        { key: 'canceled', code: 'canceled', ja: '終わり', x: 1540, y: 600, tone: 'coral', at: 2 },
      ],
      edges: [
        { from: 'start', to: 'active', label: '申し込む', at: 1 },
        { from: 'active', to: 'canceled', label: 'やめる', at: 2, bend: 20 },
      ],
      focus: [{ keys: ['active'], at: 1 }],
      lines: [{ t: '状態は三つです。' }, { t: '申し込むと、使える状態になります。' }, { t: 'やめると、終わりの状態になります。' }],
    },
    {
      kind: 'code',
      heading: 'コード',
      lang: 'ts',
      file: 'sample.ts',
      code: ['// 見本のコード', 'const plan = getPlan(user);', 'if (plan === "pro") {', '  open();', '}', 'return plan;'].join('\n'),
      marks: [
        { from: 2, to: 2, at: 1, note: 'プランを読む', tone: 'cyan' },
        { from: 3, to: 5, at: 2, note: 'Pro なら開ける', tone: 'mint' },
      ],
      showAt: 0,
      lines: [{ t: 'コードを見ます。' }, { t: 'まず、プランを読みます。', sfx: 'pop' }, { t: 'Pro なら、機能を開けます。', sfx: 'pop' }],
    },
    {
      kind: 'table',
      heading: '表',
      columns: ['項目', '値', 'メモ'],
      widths: [0.3, 0.3, 0.4],
      mono: [1],
      rows: [
        { cells: ['プラン', 'pro', '月額'], at: 1, tone: 'violet' },
        { cells: ['状態', 'active', '使える'], at: 2, tone: 'mint' },
      ],
      lines: [{ t: '表で並べます。' }, { t: 'プランは pro です。', sfx: 'pop' }, { t: '状態は active です。', sfx: 'pop' }],
    },
    {
      kind: 'compare',
      heading: '比べる',
      left: { title: '前', sub: '手で書く', tone: 'coral', icon: 'x', at: 0, items: [{ text: '毎回まちがえる', at: 0 }] },
      right: { title: '後', sub: '台本から作る', tone: 'mint', icon: 'check', at: 1, items: [{ text: '何度でも同じ', at: 1 }] },
      verdict: { text: '台本を正本にする', at: 2, tone: 'mint' },
      lines: [{ t: '前は、毎回まちがえていました。' }, { t: '後は、何度でも同じに作れます。', sfx: 'pop' }, { t: '台本を正本にします。', sfx: 'chime' }],
    },
    {
      kind: 'big',
      heading: '大事なこと',
      kicker: 'ひとことで',
      text: '台本が **正本**',
      textAt: 1,
      sub: 'ほかは台本から作り直せる',
      subAt: 1,
      tone: 'violet',
      icon: 'idea',
      cite: 'サンプルアプリの設計メモ',
      lines: [{ t: '大事なことを一つ。' }, { t: '台本が正本です。', sfx: 'chime' }],
    },
    {
      kind: 'numbers',
      heading: '数字',
      items: [
        { label: '場面', value: 20, suffix: ' 種類', at: 0, tone: 'cyan' },
        { label: '見本', value: 1, suffix: ' 本', at: 1, tone: 'amber', op: '−' },
        { label: '残り', value: 19, suffix: ' 種類', at: 2, tone: 'mint', op: '＝' },
      ],
      footnote: { text: '数は説明用の例', at: 2 },
      lines: [{ t: '場面は二十種類です。' }, { t: '見本で一つ使うと、' }, { t: '残りは十九種類です。', sfx: 'pop' }],
    },
    {
      kind: 'timeline',
      heading: '時系列',
      items: [
        { key: 'write', title: 'STEP 1　書く', sub: '1 日目', detail: '台本を書く', at: 0, tone: 'cyan' },
        { key: 'voice', title: 'STEP 2　声', sub: '2 日目', detail: '声を作る', at: 1, tone: 'amber' },
        { key: 'video', title: 'STEP 3　動画', sub: '3 日目', at: 2, tone: 'mint' },
      ],
      focus: [
        { key: 'write', at: 0 },
        { key: 'voice', at: 1 },
        { key: 'video', at: 2 },
      ],
      lines: [{ t: '一日目に、台本を書きます。' }, { t: '二日目に、声を作ります。' }, { t: '三日目に、動画にします。' }],
    },
    {
      kind: 'quiz',
      heading: 'クイズ',
      no: 1,
      question: '台本が正本である',
      answer: true,
      explain: 'ほかは台本から作り直せる',
      revealAt: 1,
      hold: 2.5,
      lines: [{ t: '台本が正本である。○か×か。' }, { t: '正解は、○です。', sfx: 'correct' }],
    },
    {
      kind: 'recap',
      heading: 'まとめ',
      items: [
        { text: '場面は 20 種類', at: 0 },
        { text: '要素は台詞の番号で出す', at: 1 },
      ],
      lines: [{ t: '場面は二十種類です。' }, { t: '要素は、台詞の番号で出します。' }],
    },
    {
      kind: 'refs',
      heading: '参考',
      refs: [
        { title: 'サンプルアプリの説明', url: 'example.com/docs', note: '見本のための架空のページ', at: 0 },
        { title: 'もう 1 つの説明', url: 'example.com/more', note: '見本のための架空のページ', at: 1 },
      ],
      lines: [{ t: '参考は二つです。' }, { t: 'どちらも、架空のページです。' }],
    },
    {
      kind: 'phone',
      heading: 'スマホの画面',
      screens: [
        { at: 0, kind: 'app', brand: 'サンプルアプリ', brandSub: 'Pro プラン', title: 'Pro にする？', lead: 'はじめての設定', body: ['月 1,000 円'], primary: '申し込む', secondary: 'あとで', caption: 'アプリの画面' },
        { at: 1, kind: 'app', brand: 'サンプルアプリ', title: '支払い', lead: 'Pro プラン', body: ['14 日間無料', '月 1,000 円', 'いつでも解約できる'], primary: '申し込む', caption: '支払いの画面' },
        { at: 2, kind: 'done', brand: 'サンプルアプリ', brandSub: 'Pro プラン', title: 'ようこそ', lead: 'Pro になりました', body: ['全部の機能が使える'], primary: 'はじめる', caption: '終わりの画面' },
      ],
      lines: [{ t: 'アプリで申し込みます。', v: Z }, { t: '支払いの画面で、カードを入れます。' }, { t: '終わりの画面が出ます。', v: Z, sfxAfter: 'chin' }],
    },
    {
      kind: 'screens',
      heading: '改善前と改善後',
      device: 'browser',
      left: {
        label: '改善前',
        tone: 'coral',
        title: 'sample.example',
        blocks: [
          { type: 'title', text: '申し込み', weak: true },
          { type: 'field', label: 'メール', placeholder: 'name@example.com', weak: true },
          { type: 'button', text: '送信', variant: 'primary', weak: true },
        ],
        notes: [
          { n: 1, text: '題が**薄い**', block: 0, at: 1 },
          { n: 2, text: '何が起きるか**分からない**', block: 2, at: 1 },
        ],
        at: 0,
      },
      right: {
        label: '改善後',
        tone: 'mint',
        title: 'sample.example',
        blocks: [
          { type: 'title', text: '申し込み' },
          { type: 'steps', items: ['入力', '確認', '完了'], current: 0 },
          { type: 'field', label: 'メール', placeholder: 'name@example.com', required: true },
          { type: 'alert', text: '送る前に確かめられます', tone: 'info' },
          { type: 'buttons', items: [{ text: '確認へ進む', variant: 'primary' }, { text: '戻る', variant: 'secondary' }] },
        ],
        notes: [{ n: 1, text: '次に起きることを**書く**', block: 4, at: 2 }],
        at: 2,
      },
      lines: [{ t: '改善前の画面です。' }, { t: '題が薄く、何が起きるか分かりません。' }, { t: '改善後は、次に起きることを書きます。', sfx: 'pop' }],
    },
    {
      kind: 'terminal',
      heading: '端末',
      title: 'Terminal — 見本',
      entries: [
        { cmd: 'bun scripts/validate.ts', out: ['台本の検証: 誤り 0 件'], at: 1, note: '誤りが無いことを見る' },
        { out: [{ text: '--> done', tone: 'info' }], at: 2 },
      ],
      lines: [{ t: '端末で確かめます。' }, { t: '検証を流します。', sfx: 'type' }, { t: '誤りは無しです。', bgm: 'cut' }],
    },
    {
      kind: 'ending',
      closing: '見本はここまで',
      lines: [{ t: 'これで、全部の場面を見ました。', bgm: 'back' }],
    },
  ],
};
