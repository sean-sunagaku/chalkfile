import { docsFrom } from '../sources-util';
import type { Lecture } from '../types';
import { SUPERAGENT_SOURCES } from './sources';

// 配役（声は scripts/voices.ts、名前と色は course.ts の cast）。v を省いた台詞は先生
const Z = 'zundamon' as const; // ボケ: ずんだもん
const ZC = 'zundamon-cry' as const; // ボケの涙声
const T = 'tsukkomi' as const; // ツッコミ: 先生が短く刺すとき
const TEN = 'tennokoe' as const; // 天の声

/**
 * Super-agent のお笑い版 第 5 章「待たせない・場所で話し方を変える」。事実は DeepSeek Harness チームの記事（英語版、2026-11-02 確認）の
 * 4 節（4.1 全二重: 非同期の ReAct ループの start() と stop()、DeepSeek Harness では既定でオフ／4.2 チャンネルごとの話し方、返事は 100 語まで）。
 * チャットの画面の文は、架空のサンプルアプリのチームでの説明用の例
 */
export const S05: Lecture = {
  id: 'S05',
  no: 5,
  section: { no: 4, title: '止まらない仕組み' },
  title: '待たせない・場所で話し方を変える',
  summary:
    '道具を待つあいだ止まるふつうの ReAct ループ（半二重）と、start() ですぐ返り、結果を新しい出来事として受け取る非同期の ReAct ループ（全二重）。グループのチャットでは短く、GitHub やメールでは詰めて整える、チャンネルごとの話し方。',
  docs: docsFrom(SUPERAGENT_SOURCES, ['dsh-superagent-article', 'deepseek-harness-readme']),
  quiz: [
    {
      q: 'ふつうの ReAct ループで、時間のかかる道具を run() で呼ぶと、どうなる？',
      choices: ['すぐに「Started」が返る', '道具が終わるまでループが止まり、新しい話に応えられない', '道具が自動で止まる', '人の話を先に聞いてから、道具を動かす'],
      answer: 1,
      explain: '同期の呼び出しでは、道具が終わって結果が返るまでループが止まる。話は交代でしか進まない（半二重）。',
    },
    {
      q: '記事の非同期の ReAct ループで、時間のかかる道具の結果は、どう届く？',
      choices: ['start() の戻り値として、終わるまで待って受け取る', '道具が終わると、新しい出来事として会話に届く', '人が手で貼りつける', '結果は届かない'],
      answer: 1,
      explain: 'start() はすぐ「Started」を返し、ループは待たない。道具が終わると、結果は新しい出来事のメッセージとして届く。長すぎれば stop() で止められる。',
    },
    {
      q: '記事が勧める、グループのチャットでの返事の仕方は？',
      choices: [
        '考えの途中と、道具の記録を全部流す',
        '決めてほしいときだけ知らせ、まっすぐ聞き、結論は短く（記事の例は 1 回 100 語まで）',
        'PR の説明と同じ量を書く',
        '返事をしない',
      ],
      answer: 1,
      explain: 'チャットは軽く、人の手をなるべく止めない。GitHub やメールのように、あとで読む場所では、逆に情報を詰めて形を整える。',
    },
  ],
  takeaways: [
    'ふつうの ReAct ループは、run() で道具を呼ぶと終わるまで止まり、新しい話に応えられない（半二重）',
    '非同期の ReAct ループ: start() はすぐ「Started」を返し、結果は新しい出来事として届く。長すぎたら stop()。新しい話は、今の考えのひと区切りで扱える（全二重）',
    '記事によると、DeepSeek Harness はこの非同期の仕組みを持っているが、まだ既定ではオフ（2026-11-01 の記事の時点）',
    'チャットは軽く短く、決めてほしいときだけ知らせる（記事のチームの固いきまりの例: 1 回の返事は 100 語まで。英語版の記事の表記）',
    'GitHub・メール・文書は、情報を詰めて形を整える（PR は、背景・変えたこと・確かめた結果を、プロジェクトの決まりどおりに）',
  ],
  scenes: [
    {
      kind: 'opening',
      section: 'SECTION 4　止まらない仕組み',
      title: '待たせない・場所で話し方を変える',
      subtitle: 'お笑い版　非同期の ReAct ループと、チャンネル',
      lines: [
        { t: '第5章。待たせない。場所で、話し方を変える。', s: 'だいごしょう。待たせない。場所で、話し方を変える。', v: 'announcer', pause: 0.3 },
        { t: 'いま、テストを流しているのだ。終わるまで、話しかけないでほしいのだ。', v: Z, pause: -0.15 },
        { t: '二十分、返事がありません。', v: T, sfx: 'harisen' },
        { t: '前回の予告どおり、返事をしない。', v: TEN },
        { t: 'この章では、時間のかかる仕事をしながらでも、人に応える仕組みと、場所ごとの話し方を見ます。', s: 'このしょうでは、時間のかかる仕事をしながらでも、ひとに応える仕組みと、場所ごとの話し方を見ます。' },
      ],
    },
    {
      kind: 'goals',
      heading: 'この章のゴール',
      items: [
        { text: 'ふつうの ReAct ループが、止まる理由がわかる', at: 3 },
        { text: 'start と stop で動く、非同期のループを説明できる', at: 4 },
        { text: 'チャンネルごとに、返事の長さと形を変えられる', at: 5 },
      ],
      lines: [
        { t: 'この章のゴールは、三つです。' },
        { t: 'テスト、あと十八分なのだ。', v: Z, pause: -0.15 },
        { t: '……誰も、待っていません。', v: T, sfx: 'harisen' },
        { t: '一つ目。ふつうの ReAct ループが、止まる理由がわかること。', sfx: 'pop' },
        { t: '二つ目。start と stop で動く、非同期のループを説明できること。', s: '二つ目。スタートとストップで動く、非同期のループを説明できること。', sfx: 'pop' },
        { t: '三つ目。チャンネルごとに、返事の長さと形を変えられることです。', sfx: 'pop' },
      ],
    },
    {
      kind: 'sequence',
      heading: 'ふつうの ReAct ループ: 半二重',
      cite: 'DeepSeek Harness チーム「Exploring Super-agent Design」(2026)',
      actors: [
        { key: 'people', label: '人', sub: 'チャット', tone: 'slate', icon: 'users' },
        { key: 'agent', label: 'エージェント', sub: 'ReAct ループ', tone: 'violet', icon: 'brain' },
        { key: 'tool', label: '道具', sub: 'テスト・コマンド', tone: 'amber', icon: 'zap' },
      ],
      steps: [
        { from: 'people', to: 'agent', label: '頼む', at: 1 },
        { from: 'agent', to: 'tool', label: 'run()　終わるまで待つ', at: 2, tone: 'amber' },
        { from: 'people', to: 'agent', label: '今どう？', at: 3, tone: 'coral', dashed: true },
        { from: 'tool', to: 'agent', label: '終わった（20 分後）', at: 5, tone: 'amber' },
        { from: 'agent', to: 'people', label: 'やっと返事', at: 5, tone: 'violet' },
      ],
      lines: [
        { t: 'まず、ふつうの ReAct ループです。' },
        { t: '人が頼むと、エージェントは、道具を使います。', sfx: 'pop' },
        { t: 'このとき、道具を run で呼ぶと、ループは、道具が終わるまで止まって待ちます。', s: 'このとき、道具をランで呼ぶと、ループは、道具が終わるまで止まって待ちます。', sfx: 'pop' },
        { t: 'そのあいだに、人が話しかけても……', sfx: 'pop', pause: 0.6 },
        { t: '返事は、ない。エージェントは、待っている。', v: TEN, sfxAfter: 'chin' },
        { t: '道具が終わって、やっと返事ができます。話は、交代でしか進まない。これを、半二重と言います。', sfx: 'pop' },
        { t: '半二重……半分の、二重跳びなのだ！', v: Z, pause: -0.15 },
        { t: '跳びません。', v: T, sfx: 'harisen' },
        { t: 'トランシーバーのように、片方が話すあいだ、もう片方は待つしかありません。' },
      ],
    },
    {
      kind: 'sequence',
      heading: '非同期の ReAct ループ: 全二重',
      cite: 'DeepSeek Harness チーム「Exploring Super-agent Design」(2026)',
      actors: [
        { key: 'people', label: '人', sub: 'チャット', tone: 'slate', icon: 'users' },
        { key: 'agent', label: 'エージェント', sub: '非同期の ReAct ループ', tone: 'violet', icon: 'brain' },
        { key: 'tool', label: '道具', sub: '裏で動く', tone: 'amber', icon: 'zap' },
      ],
      steps: [
        { from: 'agent', to: 'tool', label: 'start()', at: 1, tone: 'amber' },
        { from: 'tool', to: 'agent', label: '「Started」（すぐ返る）', at: 1, tone: 'mint', dashed: true },
        { from: 'people', to: 'agent', label: '今どう？', at: 2 },
        { from: 'agent', to: 'people', label: '「テスト中。あと少し」', at: 2, tone: 'mint' },
        { from: 'tool', to: 'agent', label: '終わった（新しい出来事で届く）', at: 3, tone: 'amber' },
        { from: 'agent', to: 'tool', label: 'stop()（長すぎたら止める）', at: 4, tone: 'coral', dashed: true },
      ],
      lines: [
        { t: '記事は、時間のかかる道具の呼び方を、start と stop に替えます。', s: '記事は、時間のかかる道具の呼び方を、スタートとストップに替えます。' },
        { t: 'start を呼ぶと、すぐに、始めました、と返ってきます。ループは、道具を待ちません。', s: 'スタートを呼ぶと、すぐに、始めました、と返ってきます。ループは、道具を待ちません。', sfx: 'pop' },
        { t: '道具が動いているあいだも、人に応えられます。', s: '道具が動いているあいだも、ひとに応えられます。', sfx: 'pop' },
        { t: '道具が終わると、結果は、新しい出来事として、会話に届きます。', sfx: 'pop' },
        { t: '長すぎるときは、モデルが、stop で止めることもできます。', s: '長すぎるときは、モデルが、ストップで止めることもできます。', sfx: 'pop' },
        { t: '新しい話は、道具を待たず、今の考えのひと区切りが終わりしだい、扱われます。これが、全二重です。', sfx: 'chime' },
        { t: '全二重……全部、二重跳びなのだ！', v: Z, pause: -0.15 },
        { t: 'だから、跳びません。', v: T, sfx: 'harisen' },
        { t: '電話のように、両方が、いつでも話せます。' },
        { t: '記事によると、DeepSeek Harness は、この非同期の仕組みを、もう持っています。ただ、初期設定では、まだオンになっていないそうです。' },
      ],
    },
    {
      kind: 'quiz',
      heading: 'クイズ',
      no: 1,
      question: '非同期の ReAct ループでは、start を呼ぶと、道具が終わるまで、ほかの話に答えられない？',
      answer: false,
      explain: 'start はすぐ「Started」を返す。道具が動いているあいだも、人に応えられる',
      revealAt: 3,
      lines: [
        {
          t: 'クイズです。非同期の ReAct ループでは、start を呼ぶと、道具が終わるまで、ほかの話に答えられない。マルか、バツか。',
          s: 'クイズです。非同期のリアクトループでは、スタートを呼ぶと、道具が終わるまで、ほかの話に答えられない。マルか、バツか。',
          pause: 3.2,
        },
        { t: 'マルなのだ！　集中は、大事なのだ！', v: Z, pause: -0.15 },
        { t: '二十分黙っていた人の、意見ですね。', v: T, sfx: 'harisen' },
        { t: '答えは、バツ。start は、すぐ返ります。道具が動いているあいだも、人に応えられます。', s: '答えは、バツ。スタートは、すぐ返ります。道具が動いているあいだも、ひとに応えられます。', sfx: 'reveal' },
        { t: 'ずんだもん、五連敗。', v: TEN, sfxAfter: 'chin' },
      ],
    },
    {
      kind: 'screens',
      heading: 'チャンネルの話し方: グループのチャット',
      evidence: 'example',
      device: 'phone',
      left: {
        label: '先生の返事',
        tone: 'coral',
        title: 'サンプルアプリ開発',
        at: 1,
        blocks: [
          { type: 'badge', text: 'グループのチャット' },
          { type: 'text', text: 'ご質問ありがとうございます。まず背景から説明しますと、この不具合は先週の変更で、ログインの処理の順番が入れ替わり……' },
          { type: 'text', text: '道具の記録 1/48: ファイルを読む', small: true },
          { type: 'text', text: '道具の記録 2/48: テストを流す', small: true },
          { type: 'text', text: '（このあと、300 語つづく）', small: true },
        ],
        notes: [
          { n: 1, text: '考えの途中と道具の記録を、**そのまま**流す', block: 2, at: 5 },
          { n: 2, text: '何を決めてほしいかが、**わからない**', block: 1, at: 6 },
        ],
      },
      right: {
        label: 'ずんだもんの返事',
        tone: 'mint',
        title: 'サンプルアプリ開発',
        at: 7,
        blocks: [
          { type: 'badge', text: 'グループのチャット' },
          { type: 'text', text: '直し方を 2 つ用意しました。' },
          { type: 'text', text: 'A（早い）と B（安全）、どちらにしますか？' },
          { type: 'text', text: '詳しくは、PR に書きました。', small: true },
        ],
        notes: [
          { n: 1, text: '決めてほしいことだけ、**短く聞く**', block: 2, at: 8 },
          { n: 2, text: '詳しい話は、**PR** に書く', block: 3, at: 8 },
        ],
      },
      lines: [
        { t: 'もう一つは、話す場所です。人は、グループのチャット、メール、GitHub で、話し方を変えます。' },
        { t: '先生も、グループのチャットに、返事を書いてみました。', sfx: 'pop' },
        { t: '先生、長すぎるのだ！　スクロールが、終わらないのだ！', v: Z, sfx: 'harisen' },
        { t: '……すみません。', v: T, pause: 0.3 },
        { t: 'ずんだもん、この講座で、初めて、ツッコんだ。', v: TEN, sfx: 'deden' },
        { t: '一人で使う端末なら、考えの途中や道具の記録も、役に立つことがあります。でも、グループにそのまま流すと、みんなが、情報に埋もれがちです。', s: 'ひとりで使う端末なら、考えの途中や道具の記録も、役に立つことがあります。でも、グループにそのまま流すと、みんなが、情報にうもれがちです。', sfx: 'pop' },
        { t: '何を決めてほしいのかも、わかりません。', sfx: 'pop' },
        { t: 'ぼくは、こう書いたのだ。', v: Z, sfx: 'pop' },
        { t: '決めてほしいことだけを、まっすぐ、短く聞く。詳しい話は、PR に書いておく。', sfx: 'pop' },
        { t: '……私より、上手です。', v: T },
        { t: '先生、ずんだもんに、負けた。', v: TEN, sfxAfter: 'chin' },
        {
          t: 'チャットでは、軽く、人の手を、なるべく止めない。知らせるのは、決めてほしいときだけ。聞くことはまっすぐ、結論は短く。記事のチームでは、一回の返事を百語までにする、という固いきまりが、簡単で、よく効いたそうです。',
          bgm: 'cut',
          sfx: 'chime',
        },
        { t: '先生の返事は、何語だったのだ？', v: Z, bgm: 'back' },
        { t: '三百語であった。', v: TEN, sfxAfter: 'chin' },
      ],
    },
    {
      kind: 'points',
      heading: 'あとで読む場所は、詰めて整える',
      columns: 3,
      items: [
        { title: 'チャット', body: '軽く、短く。決めてほしいときだけ知らせる', at: 1, tone: 'cyan', icon: 'message' },
        { title: 'GitHub・メール・文書', body: '情報を詰めて、形を整える', at: 2, tone: 'violet', icon: 'file' },
        { title: 'PR の説明', body: '背景・変えたこと・確かめた結果を、プロジェクトの決まりどおりに', at: 3, tone: 'mint', icon: 'code' },
      ],
      lines: [
        { t: 'では、ほかの場所は、どうでしょう。' },
        { t: 'チャットは、軽く、短く。', sfx: 'pop' },
        { t: 'GitHub や、メール、文書のように、あとで読む場所では、逆に、情報を詰めて、形を整えます。', sfx: 'pop' },
        { t: '例えば PR なら、問題の背景、変えたこと、確かめた結果を、プロジェクトの決まりどおりに、きちんと書きます。', sfx: 'pop' },
        { t: 'ぼくの PR の説明は、直したのだ、の一言なのだ！', v: Z, pause: -0.15 },
        { t: 'そこは、長く書いてください。', v: T, sfx: 'harisen' },
        { t: 'ずんだもん、短くする場所と、長くする場所を、逆にした。', v: TEN, sfxAfter: 'chin' },
        { t: '二層構造のおかげで、考えの途中や道具の記録は、Worker の中にとどまり、外とのやり取りは Router がします。そのうえで、チャンネルごとの話し方を、プロンプトで決めておきます。', sfx: 'chime' },
        { t: '個人のエージェントなら、整ったメールの下書きや、文書の要約を、そのまま作ります。' },
      ],
    },
    {
      kind: 'recap',
      heading: '振り返り',
      items: [
        { text: 'ふつうの ReAct ループは、道具を待つあいだ止まる（半二重）', at: 0 },
        { text: 'start ですぐ返り、結果は新しい出来事で届く。長すぎたら stop（全二重）', at: 1 },
        { text: 'チャットは短く、決めてほしいことだけ。GitHub・メールは詰めて整える', at: 2 },
      ],
      lines: [
        { t: '振り返りです。ふつうの ReAct ループは、道具を待つあいだ、止まります。', sfx: 'pop' },
        {
          t: 'start ですぐ返り、結果は、新しい出来事として届く。長すぎたら、stop。これで、待たせずに話せます。',
          s: 'スタートですぐ返り、結果は、新しい出来事として届く。長すぎたら、ストップ。これで、待たせずに話せます。',
          sfx: 'pop',
        },
        { t: 'チャットは短く、決めてほしいことだけ。GitHub やメールは、詰めて整えます。', sfx: 'pop' },
        { t: 'わかったのだ。テストを流しながら、先生の長い返事に、ツッコめるのだ！', v: Z, pause: -0.15 },
        { t: '……ツッコむのは、私の担当です。', v: T },
        { t: 'ずんだもんは、少しだけ、全二重になった。タブは、まだ三十七個ある。', v: TEN },
      ],
    },
    {
      kind: 'ending',
      next: { no: 6, title: '止まらない仕組みと、残る課題' },
      lines: [
        { t: '次回、最終章。ずんだもん、ノートパソコンを閉じて、全部、止まる。', v: TEN },
        { t: 'お昼ごはんなのだ！', v: Z },
      ],
    },
  ],
};
