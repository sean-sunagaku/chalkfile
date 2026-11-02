import type { Lecture } from '../types';

// 配役（声は scripts/voices.ts、名前と色は course.ts の cast）。v を省いた台詞は先生
const Z = 'zundamon' as const; // ボケ: ずんだもん
const ZC = 'zundamon-cry' as const; // ボケの涙声
const T = 'tsukkomi' as const; // ツッコミ: 先生が短く刺すとき
const TEN = 'tennokoe' as const; // 天の声

/**
 * pstack をざっくり知るお笑い版（1 本だけ）。コードは出さず、考え方と使い方だけを掛け合いで見せる。
 * 事実は pstack の README・plugin.json・各スキルの説明・/poteto-mode の手順書（2026-11-01 確認、版 0.15.36）: https://github.com/cursor/plugins/tree/main/pstack
 * （作者・入れ方・二十三個の手順書・スキル三十四個・原則二十四個・計画のスキルが無い理由・/automate-me・Claude Code で飛ばす手順）
 * 最後に PR を開くのは、コードを変える手順書（バグ修正・機能 など）。investigation は「No PR」、pause-safely も PR を開かないと手順書に書いてある
 */
export const P01: Lecture = {
  id: 'P01',
  no: 1,
  section: { no: 1, title: 'ざっくり入門' },
  title: 'pstack ってなに？',
  summary:
    '作った人と考え方、始め方（/add-plugin・/setup-pstack・/poteto-mode）、23 個の手順書、主なスキル（/tdd・/interrogate・/arena・/unslop）と、使う前の注意。',
  docs: [
    { title: 'pstack の README（GitHub の cursor/plugins。入れ方・スキル・手順書・原則の一覧）', url: 'https://github.com/cursor/plugins/tree/main/pstack' },
    { title: '/poteto-mode の説明（GitHub）', url: 'https://github.com/cursor/plugins/blob/main/pstack/skills/poteto-mode/SKILL.md' },
    { title: '/poteto-mode の 23 個の手順書（GitHub）', url: 'https://github.com/cursor/plugins/tree/main/pstack/skills/poteto-mode/playbooks' },
    { title: '/setup-pstack の説明（GitHub）', url: 'https://github.com/cursor/plugins/blob/main/pstack/skills/setup-pstack/SKILL.md' },
    { title: '/interrogate の説明（GitHub）', url: 'https://github.com/cursor/plugins/blob/main/pstack/skills/interrogate/SKILL.md' },
    { title: '/arena の説明（GitHub）', url: 'https://github.com/cursor/plugins/blob/main/pstack/skills/arena/SKILL.md' },
  ],
  quiz: [
    {
      q: 'pstack の /poteto-mode がすることとして、正しいものは？',
      choices: [
        '頼みごとに合う手順書を選び、やることリストにして、必要なスキルを呼び出す',
        'フライドポテトの揚げ方を教える',
        '使うモデルを係ごとに決めて、設定のルールに書く',
        'プラグインを Cursor に入れる',
      ],
      answer: 0,
      explain: '/poteto-mode は 23 個の手順書から 1 つ選び、その手順をやることリストにして、必要なスキルを呼び出す。モデルの割り当ては /setup-pstack、入れるのは /add-plugin pstack。',
    },
    {
      q: '/interrogate について、正しいものは？',
      choices: [
        '取り調べの前に、カツ丼を頼む',
        '何種類かのモデルが変更を壊しにかかり、動かして示せた指摘だけを残す',
        '指摘を見つけたら、その場でコードを直す',
        '人間が一人でレビューする',
      ],
      answer: 1,
      explain: '別々のモデルが変更を壊しにかかり、実行で示せた指摘だけが残る。/interrogate 自体はコードを直さず、指摘を報告する。',
    },
    {
      q: 'pstack の README に書かれていることは？',
      choices: [
        '計画を立てる専用のスキルが、いちばん多い',
        'Cursor でしか入れられない',
        'Claude Code にも入れられる。ただし Cursor にしかない機能が要る手順は飛ばされる',
        'ライセンスは有料',
      ],
      answer: 2,
      explain: 'Claude Code でもプラグインとして入れられる。bugbot や automations のような Cursor だけの機能が要る手順は、短い注を出して飛ばす。ライセンスは MIT。',
    },
  ],
  takeaways: [
    'pstack は、Cursor のエンジニア poteto（Lauren Tan）さんが公開した、AI エージェントの仕事の進め方のスキル集（MIT）',
    '始め方は /add-plugin pstack → /setup-pstack（係ごとのモデル）→ /poteto-mode',
    '/poteto-mode は、23 個の手順書から 1 つ選び、やることリストにして、必要なスキルを呼び出す',
    '/tdd・/interrogate・/arena・/unslop は、確かめずにそのまま出さないための仕組み',
    'スキルの数・名前・既定のモデルは変わる。使う前に README で確かめる',
  ],
  scenes: [
    {
      kind: 'opening',
      title: 'pstack ってなに？',
      lines: [
        { t: 'pstack ってなに？', v: 'announcer', pause: 0.3 },
        { t: 'ピースタック……！　ずんだ餅を、山盛りに積むのだ！', v: Z, pause: -0.15 },
        { t: '積みません。', v: T, sfx: 'harisen' },
        { t: 'pstack は、AI のエージェントに、深く調べて少なく良いコードを書かせる、スキルの詰め合わせです。' },
      ],
    },
    {
      kind: 'points',
      heading: '困りごと: 速いけど、確かめていない',
      columns: 3,
      items: [
        { title: '3 分で、1,000 行', body: 'AI に頼んだ', at: 1, tone: 'cyan', icon: 'zap' },
        { title: '動くかは、知らない', body: '確かめていない', at: 2, tone: 'amber', icon: 'help' },
        { title: '直すのは、人間', body: 'あとで、3 日', at: 4, tone: 'coral', icon: 'frown' },
      ],
      lines: [
        { t: 'AI のエージェントに頼めば、コードはすぐに書けます。' },
        { t: 'ぼくも頼んだのだ。三分で、千行なのだ！', s: 'ぼくも頼んだのだ。三分で、せんぎょうなのだ！', v: Z },
        { t: '動くかは、知らないのだ。完璧なのだ！', v: Z, pause: -0.15 },
        { t: '確かめてください。', v: T, sfx: 'harisen' },
        { t: 'その千行を、三日かけて直したのは、ずんだもん本人であった。', s: 'そのせんぎょうを、三日かけて直したのは、ずんだもん本人であった。', v: TEN, sfxAfter: 'chin' },
        { t: '確かめていないコードは、結局、人間が直す。こうした雑な出力を、英語でスロップと呼びます。' },
        { t: 'スロップ……スープなのだ？　おいしそうなのだ。', v: Z, pause: -0.15 },
        { t: '飲めません。', v: T, sfx: 'harisen' },
      ],
    },
    {
      kind: 'points',
      heading: 'pstack とは',
      columns: 3,
      items: [
        { title: '作った人', body: 'Cursor のエンジニア poteto（Lauren Tan）さん。React のコアチームの一人', at: 0, tone: 'violet', icon: 'user' },
        { title: '中身', body: 'スキル 34 個・手順書 23 個・原則 24 個（2026-11 時点）', at: 4, tone: 'cyan', icon: 'layers' },
        { title: '置き場所', body: 'Cursor の公式プラグイン集（GitHub の cursor/plugins）。MIT ライセンス', at: 4, tone: 'mint', icon: 'box' },
      ],
      lines: [
        { t: 'pstack を作ったのは、Cursor のエンジニア、Lauren Tan さん。ネットでの名前は、poteto です。', s: 'ピースタックを作ったのは、カーソルのエンジニア、ローレン・タンさん。ネットでの名前は、ポテトです。' },
        { t: 'ポテト！　フライドポテトの、スキル集なのだ！', v: Z, pause: -0.15 },
        { t: '揚げません。', v: T, sfx: 'harisen' },
        { t: 'ずんだもん、今日も、食べ物から入る。', v: TEN },
        { t: '中身は、作者が毎日の仕事で使うスキル。Cursor の公式のプラグイン集にあり、ライセンスは MIT です。', sfx: 'pop' },
      ],
    },
    {
      kind: 'big',
      heading: '作者の合言葉',
      cite: 'pstack README「if you want to go fast, go deep first」（2026-11 確認）',
      kicker: 'README の合言葉',
      text: '速く進みたいなら、**まず深く**',
      textAt: 0,
      sub: '深く調べ、少なく書き、確かめる。だから、並べて走らせられる',
      subAt: 1,
      tone: 'violet',
      icon: 'target',
      lines: [
        { t: '作者の合言葉は、速く進みたいなら、まず深く。', bgm: 'cut', sfx: 'chime' },
        { t: '深く調べ、少なく書き、確かめる。だから、何本も並べて走らせられる、という考えです。', bgm: 'back' },
        { t: 'ぼくは、浅く、速く、たくさん、なのだ。', v: Z, pause: -0.15 },
        { t: '全部、逆です。', v: T, sfx: 'harisen' },
        { t: 'ずんだもんの千行は、こうして生まれた。', s: 'ずんだもんのせんぎょうは、こうして生まれた。', v: TEN },
      ],
    },
    {
      kind: 'points',
      heading: '始め方: コマンドは 3 つ',
      numbered: true,
      columns: 3,
      items: [
        { title: '/add-plugin pstack', body: 'プラグインを入れる', at: 1, tone: 'violet', icon: 'box' },
        { title: '/setup-pstack', body: '係ごとに、使うモデルを決める', at: 2, tone: 'amber', icon: 'sliders' },
        { title: '/poteto-mode', body: '仕事を頼む（ふだんは、これだけ）', at: 3, tone: 'mint', icon: 'rocket' },
      ],
      lines: [
        { t: '始め方は、Cursor のチャットでコマンドを打つだけです。' },
        { t: 'まず、/add-plugin pstack で、入れます。', s: 'まず、スラッシュ、アドプラグイン、ピースタックで、入れます。', sfx: 'pop' },
        {
          t: '次に、/setup-pstack。コードを書く係、判断する係、レビューする係に、モデルを割り当てます。',
          s: '次に、セットアップ、ピースタック。コードを書く係、判断する係、レビューする係に、モデルを割り当てます。',
          sfx: 'pop',
        },
        { t: 'あとは、/poteto-mode で仕事を頼むだけ。', s: 'あとは、ポテトモードで仕事を頼むだけ。', sfx: 'pop' },
        { t: 'ポテトモード！　やっぱり、揚げるのだ！', v: Z, pause: -0.15 },
        { t: '揚げません。', v: T, sfx: 'harisen' },
      ],
    },
    {
      kind: 'flow',
      heading: '/poteto-mode の中身',
      nodes: [
        { key: 'ask', label: '頼みごと', sub: '例: このバグを直して', x: 300, y: 450, w: 400, h: 150, tone: 'slate', icon: 'message', at: 0 },
        { key: 'pick', label: '手順書を 1 つ選ぶ', sub: '23 個から（調査・バグ修正 など）', x: 860, y: 450, w: 460, h: 150, tone: 'violet', icon: 'book', at: 1 },
        { key: 'todo', label: 'やることリストにする', sub: '手順を、そのまま写す', x: 1450, y: 450, w: 460, h: 150, tone: 'amber', icon: 'list', at: 2 },
        { key: 'skills', label: '必要なスキルを呼ぶ', sub: '/tdd・/arena・/unslop など', x: 1450, y: 790, w: 460, h: 150, tone: 'mint', icon: 'zap', at: 3 },
        { key: 'pr', label: '最後に PR を開く', sub: 'コードを変える仕事なら', x: 860, y: 790, w: 460, h: 150, tone: 'cyan', icon: 'flag', at: 3 },
      ],
      edges: [
        { from: 'ask', to: 'pick', at: 1 },
        { from: 'pick', to: 'todo', at: 2 },
        { from: 'todo', to: 'skills', at: 3, fromSide: 'b', toSide: 't' },
        { from: 'skills', to: 'pr', at: 3 },
      ],
      lines: [
        { t: '/poteto-mode は、まず頼みごとを読みます。', s: 'ポテトモードは、まず頼みごとを読みます。' },
        { t: '二十三個の手順書から、合うものを一つ選びます。', sfx: 'pop' },
        { t: 'その手順を、やることリストにして進めます。', sfx: 'pop' },
        {
          t: '必要なスキルを呼び出し、コードを変える仕事なら、最後に PR を開きます。',
          s: '必要なスキルを呼び出し、コードを変える仕事なら、最後にピーアールを開きます。',
          sfx: 'pop',
        },
        { t: 'つまり、どのスキルを使うか、人間は覚えなくていいのである。', v: TEN, sfx: 'deden' },
        { t: 'ぼく、二十三個、全部、覚えてきたのだ……。', v: ZC, pause: 0.5 },
        { t: '一つ目は？', v: T },
        { t: '……ずんだ餅なのだ。', v: ZC, sfxAfter: 'zuko' },
      ],
    },
    {
      kind: 'table',
      heading: '主なスキル',
      cite: 'pstack README と各スキルの説明（2026-11 確認・版 0.15.36）',
      columns: ['スキル', 'やること'],
      widths: [0.27, 0.73],
      mono: [0],
      fontSize: 32,
      rows: [
        { cells: ['/tdd', 'テスト駆動開発（TDD）の流れ。バグで落ちるテストを先に書いてから直す'], at: 1, tone: 'cyan' },
        { cells: ['/interrogate', '問い詰めるレビュー。複数のモデルが壊しにかかり、再現できた指摘だけ残す'], at: 4, tone: 'violet' },
        { cells: ['/arena', '競わせる。同じ課題を何本も解かせ、良い案に、ほかの良いところを足す'], at: 7, tone: 'amber' },
        { cells: ['/unslop', 'スロップ（雑な出力）を消す。文章から AI っぽい言い回しを取る'], at: 11, tone: 'mint' },
      ],
      lines: [
        { t: 'では、主なスキルです。' },
        { t: 'まず、/tdd。直す前に、そのバグで落ちるテストを書きます。', s: 'まず、ティーディーディー。直す前に、そのバグで落ちるテストを書きます。', sfx: 'pop' },
        { t: 'TDD……とりあえず、だいたい、大丈夫、なのだ！', s: 'ティーディーディー……とりあえず、だいたい、大丈夫、なのだ！', v: Z, pause: -0.15 },
        { t: '一番だめなやつです。', v: T, sfx: 'harisen' },
        {
          t: '次に、/interrogate。何種類かのモデルが変更を壊しにかかり、動かして示せた指摘だけを残します。',
          s: '次に、インテロゲート。何種類かのモデルが変更を壊しにかかり、動かして示せた指摘だけを残します。',
          sfx: 'pop',
        },
        { t: 'インテロゲート……取り調べ！　カツ丼が出るのだ！', v: Z, pause: -0.15 },
        { t: '出ません。', v: T, sfx: 'harisen' },
        {
          t: 'そして、/arena。同じ課題を何本も並べて解かせ、良いところを一つにまとめます。',
          s: 'そして、アリーナ。同じ課題を何本も並べて解かせ、良いところを一つにまとめます。',
          sfx: 'pop',
        },
        { t: 'アリーナ！　ついに、ずんだもんの、アリーナライブなのだ！', v: Z, pause: -0.15 },
        { t: 'やりません。', v: T, sfx: 'harisen' },
        { t: 'ずんだもん、講座が変わっても、ライブをあきらめない。', v: TEN },
        { t: '最後に、/unslop。文章から、AI っぽい言い回しを消します。', s: '最後に、アンスロップ。文章から、エーアイっぽい言い回しを消します。', sfx: 'pop' },
        { t: 'アンスロップ……アン……', v: Z, sfxAfter: 'drumroll', pause: 1.5 },
        { t: '……思いつかなかったのだ。', v: ZC, sfxAfter: 'chin', pause: 0.6 },
        { t: '一番、正直です。', v: T, sfx: 'harisen' },
        { t: '四つとも、確かめずに、そのまま出さないための仕組みです。', bgm: 'cut', sfx: 'chime' },
      ],
    },
    {
      kind: 'quiz',
      heading: 'クイズ',
      no: 1,
      question: '/poteto-mode を使うとき、どのスキルを使うかは、毎回、人間が選ぶ？',
      answer: false,
      explain: '/poteto-mode が手順書を選び、必要なスキルを呼び出す',
      revealAt: 3,
      lines: [
        {
          t: 'クイズです。/poteto-mode を使うとき、どのスキルを使うかは、毎回、人間が選ぶ。マルか、バツか。',
          s: 'クイズです。ポテトモードを使うとき、どのスキルを使うかは、毎回、人間が選ぶ。マルか、バツか。',
          pause: 3.2,
        },
        { t: 'マルなのだ！　ぼくが、二十三個から選ぶのだ！', v: Z, pause: -0.15 },
        { t: 'さっき、ずんだ餅しか、言えませんでしたよね。', v: T, sfx: 'harisen' },
        { t: '答えは、バツ。手順書もスキルも、/poteto-mode が選びます。', s: '答えは、バツ。手順書もスキルも、ポテトモードが選びます。', sfx: 'reveal' },
        { t: 'ずんだもん、講座が変わっても、負ける。', v: TEN, sfxAfter: 'chin' },
      ],
    },
    {
      kind: 'points',
      heading: '使う前の注意',
      columns: 3,
      items: [
        { title: '使う量が増えやすい', body: '並べて走らせるスキルは、一度に何本ぶんもモデルを動かす', at: 1, tone: 'amber', icon: 'gauge' },
        { title: 'Cursor 専用の部分', body: 'Claude Code では、Cursor にしかない機能が要る手順は飛ばされる', at: 2, tone: 'cyan', icon: 'alert' },
        { title: '作者のやり方が強い', body: '計画専用のスキルは無い。合わなければ /automate-me で自分用を作る', at: 3, tone: 'violet', icon: 'user' },
      ],
      lines: [
        { t: '最後に、使う前の注意です。', sfx: 'chime' },
        { t: '並べて走らせるスキルは、一度に何本ぶんもモデルを動かします。', sfx: 'pop' },
        { t: 'Claude Code にも入れられますが、Cursor だけの機能が要る手順は飛ばされます。', s: 'クロードコードにも入れられますが、カーソルだけの機能が要る手順は飛ばされます。', sfx: 'pop' },
        { t: 'そして、作者のやり方が強めです。計画を立てる専用のスキルは、ありません。', sfx: 'pop' },
        { t: '計画を立てない……ぼくと、同じなのだ！', v: Z, pause: -0.15 },
        { t: '一緒にしないでください。', v: T, sfx: 'harisen' },
        { t: '作者は、計画よりコードで示す派。計画は、Cursor のプランモードと組み合わせます。' },
        { t: '合わなければ、/automate-me で、最近の会話から自分用のモードを作れます。', s: '合わなければ、オートメイトミーで、最近の会話から自分用のモードを作れます。' },
      ],
    },
    {
      kind: 'recap',
      heading: '振り返り',
      items: [
        { text: 'pstack は、Cursor のエンジニアが公開した、AI エージェントの仕事の進め方のスキル集（MIT）', at: 0 },
        { text: 'ふだんは /poteto-mode だけ。手順書を選び、必要なスキルを呼び出す', at: 1 },
        { text: '/tdd・/interrogate・/arena・/unslop で、確かめずに出さない。使う量と Cursor 専用の部分に注意', at: 2 },
      ],
      lines: [
        { t: '振り返りです。pstack は、深く調べて、少なく良く書かせるスキル集。', sfx: 'pop' },
        { t: 'ふだんは /poteto-mode だけ。手順書を選び、必要なスキルを呼び出します。', s: 'ふだんは、ポテトモードだけ。手順書を選び、必要なスキルを呼び出します。', sfx: 'pop' },
        { t: '主なスキルは、確かめずに出さない仕組み。使う量と、Cursor だけの部分に注意。', sfx: 'pop' },
        { t: 'わかったのだ。まず深く……ポテトを、深く揚げるのだ！', v: Z, pause: -0.15 },
        { t: '揚げません。', v: T, sfx: 'harisen' },
        { t: '深さだけは、合っている。', v: TEN },
      ],
    },
    {
      kind: 'ending',
      closing: '詳しい使い方は、pstack の README（GitHub の cursor/plugins）で',
      lines: [
        { t: '次は、/automate-me で、ずんだもんモードを作るのだ！', s: '次は、オートメイトミーで、ずんだもんモードを作るのだ！', v: Z },
        { t: 'なお、毎回、やりすぎる。', v: TEN },
      ],
    },
  ],
};
