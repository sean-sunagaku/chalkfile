import type { Lecture } from '../types';

// 配役（声は scripts/voices.ts、名前と色は course.ts の cast）。v を省いた台詞は先生
const Z = 'zundamon' as const; // ボケ: ずんだもん
const ZC = 'zundamon-cry' as const; // ボケの涙声
const T = 'tsukkomi' as const; // ツッコミ: 先生が短く刺すとき
const TEN = 'tennokoe' as const; // 天の声

/**
 * Rive をざっくり知るお笑い版（1 本だけ）。サンプルのコードは出さず、仕組みだけを掛け合いで見せる。
 * 事実は Rive の公式ドキュメント（2026-11-01 確認）: ランタイムの一覧と MIT ライセンス（https://rive.app/docs/runtimes）、
 * ステートマシンの定義（https://rive.app/docs/editor/state-machine/state-machine）
 */
export const R01: Lecture = {
  id: 'R01',
  no: 1,
  section: { no: 1, title: 'ざっくり入門' },
  title: 'Rive ってなに？',
  summary: 'Rive を、ずんだもんと先生の掛け合いでざっくり知る。動きを作るエディタと動かすランタイムのセット、.riv ファイル、ステートマシン、対応する環境と注意点。',
  docs: [
    { title: 'Rive のランタイム（公式ドキュメント。対応環境・オープンソースと MIT ライセンス）', url: 'https://rive.app/docs/runtimes' },
    { title: 'ステートマシン（公式ドキュメント）', url: 'https://rive.app/docs/editor/state-machine/state-machine' },
    { title: '料金プラン（公式）', url: 'https://rive.app/pricing' },
  ],
  quiz: [
    {
      q: 'Rive の .riv ファイルについて、正しいものは？',
      choices: [
        'エディタから書き出し、アプリやゲーム、Web サイトのランタイムが読み込んで動かす',
        '動画のファイルなので、再生と停止しかできない',
        'エンジニアが手で書くプログラムのファイル',
        'Web サイトでしか使えない画像のファイル',
      ],
      answer: 0,
      explain: 'エディタで作った絵と動きを .riv に書き出し、公式ランタイムが実行時に読み込んで動かす。',
    },
    {
      q: 'Rive のステートマシンとは？',
      choices: [
        'ずんだ餅を焼く機械',
        'アニメーション同士をつなぎ、切り替わる条件（ロジック）を決める仕組み',
        '動画を書き出すための設定画面',
        '料金プランの名前',
      ],
      answer: 1,
      explain: '状態（再生するアニメーション）と、状態をつなぐ遷移を、エディタの中で視覚的に作る。',
    },
    {
      q: 'Rive の公式ランタイムについて、公式ドキュメントに書かれていることは？',
      choices: [
        'Web 版だけがオープンソース',
        '有料プランの人しか使えない',
        'すべてオープンソースで、MIT ライセンス',
        'Unity と Unreal には対応していない',
      ],
      answer: 2,
      explain: '公式ランタイムはすべてオープンソースで MIT ライセンス。ただし機能によっては対応していないランタイムもあるので、Feature Support のページで確かめる。',
    },
  ],
  takeaways: [
    'Rive は、動きを作るエディタと、アプリ・ゲーム・Web で動かすランタイムのセット',
    'エディタから .riv に書き出し、ランタイムが実行時に読み込んで動かす。動きをコードで作り直さなくてよい',
    'ステートマシン = アニメーション同士をつなぎ、切り替わる条件を決める仕組み。アプリは合図や値を渡す',
    '公式ランタイムはオープンソース（MIT）。機能の対応と料金は変わるので、使う前に公式で確かめる',
  ],
  scenes: [
    {
      kind: 'opening',
      section: 'ざっくり入門',
      title: 'Rive ってなに？',
      subtitle: 'お笑い版　ずんだもんと、ざっくり知る',
      lines: [
        { t: 'Rive ってなに？', v: 'announcer', pause: 0.3 },
        { t: 'ライブ！？　ずんだもんの、単独ライブなのだ！？', v: Z, pause: -0.15 },
        { t: '歌いません。', v: T, sfx: 'harisen' },
        { t: 'Rive は、動くイラストやボタンを作って、アプリやウェブで、そのまま動かすための道具です。' },
        { t: 'この動画は、Rive をざっくり知る、お笑い版である。サンプルのコードは、一行も出ない。', v: TEN },
      ],
    },
    {
      kind: 'points',
      heading: '困りごと: 動きの作り直し',
      evidence: 'example',
      columns: 3,
      items: [
        { title: '動画で動きを作る', body: 'デザイナーのずんだもん', at: 1, tone: 'violet', icon: 'pen' },
        { title: 'コードで作り直す', body: 'エンジニアのずんだもん', at: 2, tone: 'cyan', icon: 'code' },
        { title: 'なんか違う', body: 'よくある食い違い', at: 3, tone: 'coral', icon: 'frown' },
      ],
      lines: [
        { t: 'アプリの動き。例えば、ボタンを押したときの、ぷるんとした反応。' },
        { t: 'デザイナーのぼくが、動画で作ったのだ。かわいいのだ。', v: Z },
        { t: 'エンジニアのぼくが、それを、コードで作り直したのだ。', v: Z },
        { t: '……なんか、違うのだ。', v: ZC, sfxAfter: 'chin', pause: 0.8 },
        { t: '一人で作って、一人で食い違う。', v: TEN },
        { t: '作った動きと、アプリで動く動きが、別々。これが、よくある困りごとです。' },
      ],
    },
    {
      kind: 'points',
      heading: 'Rive の仕組み: 作る → 書き出す → 動かす',
      evidence: 'official',
      numbered: true,
      columns: 3,
      items: [
        { title: 'エディタで作る', body: '絵と動きを、Rive のエディタで', at: 1, tone: 'violet', icon: 'pen' },
        { title: '.riv に書き出す', body: 'エディタから書き出すファイル', at: 2, tone: 'amber', icon: 'file' },
        { title: 'ランタイムで動かす', body: 'アプリ・ゲーム・Web が実行時に読み込む', at: 5, tone: 'mint', icon: 'rocket' },
      ],
      lines: [
        { t: 'Rive は、動きを作る場所と、動かす仕組みが、セットになっています。' },
        { t: 'まず、Rive のエディタで、絵と動きを作ります。', sfx: 'pop' },
        { t: 'できたら、.riv という形式のファイルに書き出します。', s: 'できたら、ドット、アール、アイ、ブイ、という形式のファイルに書き出します。', sfx: 'pop' },
        { t: 'アール、アイ、ブイ……リブ！　スペアリブなのだ！', v: Z, pause: -0.15 },
        { t: '食べ物から、離れてください。', v: T, sfx: 'harisen' },
        { t: '最後に、アプリやゲーム、ウェブサイトに入れたランタイムが、このファイルを読み込んで、動かします。', sfx: 'pop' },
        { t: '作った動きが、そのまま動く。コードで作り直さなくていいのである。', v: TEN, sfx: 'deden' },
        { t: 'ぼくの、一人二役が……。', v: ZC },
        { t: 'もう、一役で大丈夫です。' },
      ],
    },
    {
      kind: 'states',
      heading: 'ステートマシン: 切り替えもファイルに',
      evidence: 'official',
      nodes: [
        { key: 'idle', code: 'ふつう', ja: '待機のアニメーション', x: 380, y: 580, tone: 'slate', at: 6 },
        { key: 'hungry', code: 'はらぺこ', ja: 'しょんぼりのアニメーション', x: 960, y: 580, tone: 'amber', at: 7 },
        { key: 'happy', code: 'ごきげん', ja: 'ぴょんぴょんのアニメーション', x: 1540, y: 580, tone: 'mint', at: 8 },
      ],
      edges: [
        { from: 'idle', to: 'hungry', label: '時間がたつ', at: 7 },
        { from: 'hungry', to: 'happy', label: 'ずんだ餅が来た', at: 8 },
        { from: 'happy', to: 'idle', label: '食べ終わった', at: 9, fromSide: 'b', toSide: 'b', bend: -80, labelDy: 60 },
      ],
      focus: [
        { keys: ['idle'], at: 6 },
        { keys: ['hungry'], at: 7 },
        { keys: ['happy'], at: 8 },
        { keys: ['idle', 'hungry', 'happy'], at: 9 },
      ],
      lines: [
        { t: 'そして、Rive の大きな特徴の一つが、ステートマシンです。' },
        { t: 'ステーキ……マシン……？', v: Z, pause: -0.15 },
        { t: '焼きません。', v: T, sfx: 'harisen', pause: 0.3 },
        { t: '動きと動きを、線でつないで、切り替わる条件を決める仕組みです。', bgm: 'cut', sfx: 'chime' },
        { t: '例えば、ずんだもんの気分で、作ってみましょう。', bgm: 'back' },
        { t: 'ぼくの気分は、複雑なのだ。', v: Z },
        { t: 'ふつうの状態。', sfx: 'pop' },
        { t: '時間がたつと、はらぺこの状態へ。', sfx: 'pop' },
        { t: 'ずんだ餅が来たら、ごきげんなのだ！', v: Z, sfx: 'pop' },
        { t: '食べ終わったら、ふつうに戻ります。' },
        { t: '複雑では、なかった。', v: TEN, pause: 0.3 },
        { t: 'アプリは、ずんだ餅が来た、という合図を渡すだけ。どの動きに、どう切り替えるかは、ファイルの中に入っています。', sfx: 'chime' },
        { t: 'ボタンなら、待機、押された、成功。押されたことは、ファイルの中で受け取れます。アプリは、成功した、と伝えるだけです。' },
      ],
    },
    {
      kind: 'quiz',
      heading: 'クイズ',
      no: 1,
      question: 'ステートマシンを使うと、動きの切り替えを全部コードで書く必要がある？',
      answer: false,
      explain: '状態と切り替えの条件は、エディタで作って .riv に入る。アプリは合図や値を渡す',
      revealAt: 3,
      lines: [
        { t: 'クイズです。ステートマシンを使うと、動きの切り替えを、全部コードで書く必要がある。マルか、バツか。', pause: 3.2 },
        { t: 'マルなのだ！　コードは、裏切らないのだ！', v: Z, pause: -0.15 },
        { t: 'さっきの話、聞いてました？', v: T, sfx: 'harisen' },
        { t: '答えは、バツ。切り替えの条件は、エディタで作って、ファイルに入っています。', sfx: 'reveal' },
        { t: 'ずんだもん、講座が変わっても、負ける。', v: TEN, sfxAfter: 'chin' },
      ],
    },
    {
      kind: 'table',
      heading: 'どこで動く？',
      evidence: 'official',
      cite: 'Rive 公式ドキュメント「Runtimes」（2026-11 確認）',
      columns: ['動かす場所', '公式のランタイム'],
      widths: [0.32, 0.68],
      fontSize: 34,
      rows: [
        { cells: ['Web', 'Web（JS）・React'], at: 1, tone: 'cyan' },
        { cells: ['スマホのアプリ', 'Apple・Android・React Native・Flutter'], at: 2, tone: 'mint' },
        { cells: ['ゲームエンジン', 'Unity・Unreal'], at: 3, tone: 'violet' },
        { cells: ['そのほか', 'C++'], at: 4, tone: 'slate' },
      ],
      lines: [
        { t: 'では、どこで動くのか。公式のランタイムが、こんなにあります。' },
        { t: 'ウェブ。', sfx: 'pop' },
        { t: 'iPhone や Android のアプリ。Flutter や React Native も。', s: 'アイフォーンや、アンドロイドのアプリ。フラッターや、リアクトネイティブも。', sfx: 'pop' },
        { t: 'ゲームエンジンの、Unity と Unreal。', s: 'ゲームエンジンの、ユニティと、アンリアル。', sfx: 'pop' },
        { t: 'そのほか、C++ も。', s: 'そのほか、シープラスプラスも。', sfx: 'pop' },
        { t: 'ずんだ餅の上でも、動くのだ？', s: 'ずんだ餅のうえでも、動くのだ？', v: Z, pause: -0.15 },
        { t: '画面の上で、動かしてください。', v: T, sfx: 'harisen' },
        { t: 'しかも、公式のランタイムは、すべてオープンソースで、MIT ライセンス。仕事でも使えます。', s: 'しかも、公式のランタイムは、すべてオープンソースで、エムアイティーライセンス。仕事でも使えます。', sfx: 'chime' },
      ],
    },
    {
      kind: 'big',
      heading: '使う前の注意',
      evidence: 'official',
      kicker: '公式ドキュメントと公式サイトで確かめる',
      text: '機能の対応と料金は、**使う前に公式で確かめる**',
      textAt: 0,
      sub: '機能によっては、対応していないランタイムもある',
      subAt: 1,
      tone: 'amber',
      icon: 'alert',
      lines: [
        { t: '最後に、注意です。機能の対応と料金は、使う前に、公式で確かめましょう。', sfx: 'chime' },
        { t: '機能によっては、対応していないランタイムもあります。料金のプランも、変わることがあります。' },
        { t: 'ずんだもんのライブは、無料なのだ。', v: Z, pause: -0.15 },
        { t: 'やっていません。', v: T, sfx: 'harisen' },
      ],
    },
    {
      kind: 'recap',
      heading: '振り返り',
      items: [
        { text: 'Rive は、動きを作るエディタと、アプリ・ゲーム・Web で動かすランタイムのセット', at: 0 },
        { text: 'ステートマシンで、動きの切り替えの条件まで .riv に入る。アプリは合図を渡すだけ', at: 1 },
        { text: '公式ランタイムはオープンソース（MIT）。機能の対応と料金は、公式で確かめる', at: 2 },
      ],
      lines: [
        { t: '振り返りです。Rive は、動きを作るエディタと、それを動かすランタイムのセット。', sfx: 'pop' },
        { t: 'ステートマシンで、切り替えの条件まで、ファイルに入ります。アプリは、合図を渡すだけ。', sfx: 'pop' },
        { t: '公式のランタイムは、オープンソース。機能の対応と料金は、公式で確かめましょう。', sfx: 'pop' },
        { t: 'わかったのだ。Rive は、ずんだ餅で動くのだ！', v: Z, pause: -0.15 },
        { t: '動きません。', v: T, sfx: 'harisen' },
        { t: 'ずんだもんは、まだ、少しずれている。', v: TEN },
      ],
    },
    {
      kind: 'ending',
      closing: '動きの作り方の詳しい手順は、Rive の公式ドキュメントで',
      lines: [
        { t: '次は、ずんだもんを、Rive で動かすのだ！', v: Z },
        { t: 'なお、予定はない。', v: TEN },
      ],
    },
  ],
};
