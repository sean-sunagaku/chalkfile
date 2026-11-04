import { Z, ZC, T, TEN } from '../_shared/comedy';
import { docsOf } from './sources';
import type { Lecture } from '../types';

// 配役（声は content/voices.ts、名前と色は course.ts の cast）。v を省いた台詞は先生

/**
 * GA4 のお笑い版 第 2 章。サイトが送るイベント パラメータの「項目名（email_entry）」と「値（signature）」。
 * 事実は Google アナリティクスのヘルプと Google タグ（gtag.js）のドキュメント（2026-11-02 確認）。
 * サンプルのサイト・イベント名 email_signup・値 footer と、値の意味（signature = メールの署名のリンク）は説明用の架空の例
 */
export const G02: Lecture = {
  id: 'G02',
  no: 2,
  section: { no: 1, title: 'きほん' },
  title: 'email_entry と signature',
  summary:
    'サイトは、出来事（イベント）に「項目名と値」を付けて GA4 に送る。email_entry は項目名、signature はその中に入る値。値の意味は作る側が決めること、個人情報を送らないこと、送っただけではレポートの表に出ないことを知る。',
  docs: docsOf([
    "ga4-gtag-events",
    "ga4-event-params",
    "gtm-ga4-event",
    "ga-terms",
    "ga4-pii"
  ]),
  quiz: [
    {
      q: 'サイトが email_entry: signature を送るとき、項目名（パラメータの名前）はどれ？',
      choices: ['signature', 'email_entry', 'メールの入口', 'ずんだもんのサイン'],
      answer: 1,
      explain: 'email_entry が項目名で、signature はその中に入る値。「メールの入口」は、第 3 章で GA4 に付ける表示の名前。',
    },
    {
      q: 'イベント パラメータの値として、送ってはいけないものは？',
      choices: ['signature', 'footer', '登録した人のメールアドレス', 'どれも送ってよい'],
      answer: 2,
      explain: 'メールアドレス・電話番号・名前のような、個人を特定できる情報は GA4 に送ってはいけない（Google の決まり）。',
    },
    {
      q: '自分で決めた項目（email_entry）を送っただけで、ふつうのレポートや探索に、そのまま出る？',
      choices: ['出る', '出ない。カスタム ディメンションに登録する', '1 年たつと出る', 'ずんだ餅を供えると出る'],
      answer: 1,
      explain: 'レポートや探索の表にディメンションとして出すには、カスタム ディメンションに登録する（第 3 章）。登録の前でも、リアルタイムや DebugView では、届いたパラメータを見られる。',
    },
  ],
  takeaways: [
    'サイトは、イベントに「項目名と値」を付けて送る。email_entry は項目名、signature はその中に入る値',
    'GA4 にとって値はただの文字。どの値が何を意味するかは、サイトを作る側が決めて一覧にしておく',
    'メールアドレス・電話番号・名前のような、個人を特定できる情報は送らない（Google アナリティクス利用規約）。URL やページのタイトルにも入れない（どのイベントにも自動で付いて送られる）',
    '自分で決めた項目は、送っただけではレポートや探索の表に出ない。カスタム ディメンションに登録する',
  ],
  scenes: [
    {
      kind: 'opening',
      title: 'email_entry と signature',
      lines: [
        { t: '第2章。email_entry と signature。', s: 'だいにしょう。イーメール・エントリーと、シグネチャー。', v: 'announcer', pause: 0.3 },
        { t: '色紙、持ってきたのだ！　ずんだもんのサインを、GA4 に送るのだ！', s: 'しきし、持ってきたのだ！　ずんだもんのサインを、ジーエーフォーに送るのだ！', v: Z, pause: -0.15 },
        { t: 'GA4 は、色紙じゃありません。', s: 'ジーエーフォーは、しきしじゃありません。', v: T, sfx: 'harisen' },
        { t: 'この章では、サイトから GA4 に送る、項目名と値を見ます。', s: 'この章では、サイトからジーエーフォーに送る、項目名とあたいを見ます。' },
      ],
    },
    {
      kind: 'points',
      heading: 'サンプルのサイト（架空）: 値は、作る側が決める',
      columns: 3,
      items: [
        { title: 'メールの署名のリンク', body: '送る値は signature', at: 1, tone: 'violet', icon: 'link' },
        { title: 'ページの下の登録欄', body: '送る値は footer', at: 1, tone: 'amber', icon: 'layout' },
        { title: 'GA4 には、ただの文字', body: '意味は、サイトを作る側が決める', at: 4, tone: 'cyan', icon: 'clipboard' },
      ],
      lines: [
        { t: 'サンプルのサイトでは、メールの登録に、どの入口から来たかを知りたい、とします。', sfx: 'pop' },
        {
          t: '入口ごとに、送る値を決めます。メールの署名のリンクなら signature。ページの下の登録欄なら footer。',
          s: '入口ごとに、送るあたいを決めます。メールの署名のリンクなら、シグネチャー。ページの下の登録欄なら、フッター。',
          sfx: 'pop',
        },
        { t: 'GA4 なら、サインの意味くらい、わかるのだ！', s: 'ジーエーフォーなら、サインの意味くらい、わかるのだ！', v: Z, pause: -0.15 },
        { t: 'わかりません。', v: T, sfx: 'harisen' },
        {
          t: 'GA4 にとって、signature は、ただの文字です。意味を決めるのは、サイトを作る側です。',
          s: 'ジーエーフォーにとって、シグネチャーは、ただの文字です。意味を決めるのは、サイトを作る側です。',
          sfx: 'chime',
        },
        { t: 'GA4 は、サインをもらっても、喜ばない。', s: 'ジーエーフォーは、サインをもらっても、喜ばない。', v: TEN },
      ],
    },
    {
      kind: 'code',
      heading: 'サイトが送る形（Google タグ）',
      lang: 'ts',
      file: 'サンプルのサイト（登録ボタンを押したとき）',
      code: `gtag('event', 'email_signup', {
  email_entry: 'signature',
});`,
      fontSize: 44,
      showAt: 0,
      marks: [
        { from: 1, to: 1, at: 0, note: 'イベント名（出来事）', tone: 'cyan' },
        { from: 2, to: 2, at: 1, note: '項目名: 値', tone: 'violet' },
      ],
      lines: [
        {
          t: 'サイトは、出来事と一緒に、項目名と値を、GA4 に送ります。これは、Google タグで送る形です。',
          s: 'サイトは、出来事と一緒に、項目名とあたいを、ジーエーフォーに送ります。これは、グーグルタグで送る形です。',
          sfx: 'pop',
        },
        { t: 'email_entry が、項目の名前。signature が、その中に入る値です。', s: 'イーメール・エントリーが、項目の名前。シグネチャーが、その中に入るあたいです。', sfx: 'chime' },
        { t: 'わかったのだ！　名前が email_entry で、苗字が signature なのだ！', s: 'わかったのだ！　名前がイーメール・エントリーで、苗字がシグネチャーなのだ！', v: Z, pause: -0.15 },
        { t: '人じゃありません。', v: T, sfx: 'harisen' },
        { t: 'Google タグ マネージャーでも、同じように名前と値を足せます。', s: 'グーグルタグマネージャーでも、同じように名前とあたいを足せます。' },
      ],
    },
    {
      kind: 'points',
      heading: '問題: 送ってはいけない値は、どれ？',
      numbered: true,
      columns: 3,
      cite: 'Google アナリティクス利用規約 第 7 条（2026-11 確認）',
      items: [
        { title: 'signature', body: 'メールの署名のリンク', at: 0, tone: 'violet', icon: 'link' },
        { title: 'footer', body: 'ページの下の登録欄', at: 0, tone: 'amber', icon: 'layout' },
        { title: 'taro@example.com', body: '登録した人のメールアドレス', at: 0, tone: 'coral', icon: 'mail' },
      ],
      lines: [
        { t: 'ここで、問題です。この中に、送ってはいけない値が、一つあります。どれでしょう。', s: 'ここで、問題です。この中に、送ってはいけないあたいが、一つあります。どれでしょう。', pause: 2.2 },
        { t: '全部、送るのだ！　メールアドレスなら、本人まで、一発でわかるのだ！', v: Z, pause: -0.15 },
        { t: '個人情報です。', v: T, sfx: 'harisen' },
        {
          t: '答えは三番。メールアドレスや電話番号、名前のような、個人を特定できる情報は、送ってはいけません。Google の決まりです。',
          s: '答えは三番。メールアドレスや電話番号、名前のような、個人を特定できる情報は、送ってはいけません。グーグルの決まりです。',
          bgm: 'cut',
          sfx: 'chime',
        },
        { t: 'メールの入口に、メールアドレスを入れる。名前が似ていると、人は、間違える。', v: TEN, bgm: 'back' },
      ],
    },
    {
      kind: 'points',
      heading: '送っただけでは、レポートに出ない',
      numbered: true,
      columns: 3,
      items: [
        { title: 'サイトが送る', body: 'email_entry: signature', at: 0, tone: 'cyan', icon: 'code' },
        { title: 'GA4 に登録する', body: 'カスタム ディメンション', at: 3, tone: 'violet', icon: 'clipboard' },
        { title: 'レポート・探索で見る', body: '「メールの入口」で見る・絞り込む', at: 3, tone: 'mint', icon: 'chart' },
      ],
      lines: [
        { t: 'そして、自分で決めた項目は、送っただけでは、レポートや探索の表に、ディメンションとして出てきません。', sfx: 'pop' },
        { t: '送ったのに、無視されたのだ……。', v: ZC, pause: 0.4 },
        { t: '登録が、要ります。', v: T },
        {
          t: 'この項目をディメンションとして使ってね、と GA4 に登録します。それが、カスタム ディメンション。手順は、次の章です。',
          s: 'この項目をディメンションとして使ってね、とジーエーフォーに登録します。それが、カスタムディメンション。手順は、次のしょうです。',
          sfx: 'pop',
        },
        { t: 'ずんだもん、送っただけで、満足していた。', v: TEN },
      ],
    },
    {
      kind: 'quiz',
      heading: 'クイズ',
      no: 1,
      question: 'email_entry: signature を送るとき、signature は「項目名」である？',
      answer: false,
      explain: 'email_entry が項目名で、signature はその中に入る値',
      revealAt: 3,
      lines: [
        {
          t: 'クイズです。email_entry: signature を送るとき、signature は、項目名である。マルか、バツか。',
          s: 'クイズです。イーメール・エントリー、シグネチャーを送るとき、シグネチャーは、項目名である。マルか、バツか。',
          pause: 3.2,
        },
        { t: 'マルなのだ！　signature は、苗字なのだ！', s: 'マルなのだ！　シグネチャーは、苗字なのだ！', v: Z, pause: -0.15 },
        { t: '苗字でも、項目名でもありません。', v: T, sfx: 'harisen' },
        { t: '答えは、バツ。email_entry が項目名。signature は、その中に入る値です。', s: '答えは、バツ。イーメール・エントリーが項目名。シグネチャーは、その中に入るあたいです。', sfx: 'reveal' },
        { t: 'ずんだもん、章が変わっても、負ける。', s: 'ずんだもん、しょうが変わっても、負ける。', v: TEN, sfxAfter: 'chin' },
      ],
    },
    {
      kind: 'recap',
      heading: '振り返り',
      items: [
        { text: 'email_entry は項目名、signature はその中に入る値。値の意味は、作る側が決める', at: 0 },
        { text: '個人を特定できる情報（メールアドレスなど）は送らない', at: 1 },
        { text: '送っただけでは表に出ない。カスタム ディメンションに登録する', at: 1 },
      ],
      lines: [
        { t: '振り返りです。値の意味は、作る側が決めます。', s: '振り返りです。あたいの意味は、作る側が決めます。', sfx: 'pop' },
        { t: '個人情報は送らず、自分で決めた項目は、カスタム ディメンションに登録します。', s: '個人情報は送らず、自分で決めた項目は、カスタムディメンションに登録します。', sfx: 'pop' },
        { t: 'わかったのだ。ぼくのサインは、送らないのだ。', v: Z, pause: -0.15 },
        { t: '色紙も、しまってください。', s: 'しきしも、しまってください。', v: T, sfx: 'harisen' },
        { t: '色紙は、まだ、白い。', s: 'しきしは、まだ、白い。', v: TEN },
      ],
    },
    {
      kind: 'ending',
      next: { no: 3, title: '「メールの入口」を設定する' },
      lines: [
        { t: '次回。ずんだもん、GA4 に、名前を付ける。', s: '次回。ずんだもん、ジーエーフォーに、名前を付ける。', v: TEN },
        { t: 'ずんだもん、って付けるのだ！', v: Z },
      ],
    },
  ],
};
