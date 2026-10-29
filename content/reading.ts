// 台本の表示文（t）から読み上げ文を作る。英字は VOICEVOX が読めないので、カナに開く。
// 知らない英単語が出たら例外にして、黙って英字のまま合成しないようにする。

/** 単語より先に置き換える語句（長いものから順に当てる） */
const PHRASES: [string, string][] = [
  ['Checkout Session', 'チェックアウト・セッション'],
  ['Customer Portal', 'カスタマーポータル'],
  ['Stripe-Signature', 'ストライプ・シグネチャー'],
  ['Stripe Billing', 'ストライプ・ビリング'],
  ['Stripe Tax', 'ストライプ・タックス'],
  ['Stripe.js', 'ストライプ・ジェイエス'],
  ['Stripe CLI', 'ストライプ・シーエルアイ'],
  ['App Store', 'アップストア'],
  ['Test clock', 'テストクロック'],
  ['request.body', 'リクエスト・ドット・ボディ'],
  ['FastAPI', 'ファスト・エーピーアイ'],
  ['PayPay', 'ペイペイ'],
  ['iOS', 'アイオーエス'],
  ['3D', 'スリーディー'],
  ['3.1.3(b)', 'さんてんいちてんさんのビー'],
  ['三・六パーセント', 'さんてんろくパーセント'],
  ['〇・七パーセント', 'れいてんななパーセント'],
  // VOICEVOX が「せいの」「くだり」「いっこう」「おもキー」「そのかん」と読んでいた語
  ['生の本文', 'なまの本文'],
  ['一行', 'いちぎょう'],
  ['契約の行', '契約のぎょう'],
  ['複数の行', '複数のぎょう'],
  ['行が複数', 'ぎょうが複数'],
  ['最初の行', '最初のぎょう'],
  ['だった行', 'だったぎょう'],
  ['の行は', 'のぎょうは'],
  ['の行と', 'のぎょうと'],
  ['いる行は', 'いるぎょうは'],
  ['その間', 'そのあいだ'],
  ['主キー', 'しゅキー'],
  ['App 内課金', 'アプリ内課金'],
];

const WORDS: Record<string, string> = {
  stripe: 'ストライプ',
  webhook: 'ウェブフック',
  db: 'ディービー',
  checkout: 'チェックアウト',
  id: 'アイディー',
  portal: 'ポータル',
  session: 'セッション',
  active: 'アクティブ',
  api: 'エーピーアイ',
  url: 'ユーアールエル',
  past: 'パスト',
  due: 'デュー',
  web: 'ウェブ',
  pr: 'ピーアール',
  sub: 'サブ',
  subscription: 'サブスクリプション',
  subscriptions: 'サブスクリプションズ',
  canceled: 'キャンセルド',
  snapshot: 'スナップショット',
  trialing: 'トライアリング',
  thin: 'シン',
  created: 'クリエイテッド',
  sync: 'シンク',
  cancel: 'キャンセル',
  at: 'アット',
  period: 'ピリオド',
  end: 'エンド',
  current: 'カレント',
  billing: 'ビリング',
  failed: 'フェイルド',
  customer: 'カスタマー',
  client: 'クライアント',
  reference: 'リファレンス',
  status: 'ステータス',
  incomplete: 'インコンプリート',
  expired: 'エクスパイアド',
  whsec: 'ダブリューエイチセック',
  cli: 'シーエルアイ',
  required: 'リクワイアド',
  upsert: 'アップサート',
  trigger: 'トリガー',
  tax: 'タックス',
  product: 'プロダクト',
  price: 'プライス',
  invoice: 'インボイス',
  ci: 'シーアイ',
  user: 'ユーザー',
  users: 'ユーザーズ',
  events: 'イベンツ',
  event: 'イベント',
  success: 'サクセス',
  unpaid: 'アンペイド',
  paused: 'ポーズド',
  basil: 'バジル',
  items: 'アイテムズ',
  http: 'エイチティーティーピー',
  post: 'ポスト',
  json: 'ジェイソン',
  apple: 'アップル',
  insert: 'インサート',
  processed: 'プロセスト',
  listen: 'リッスン',
  cus: 'シー・ユー・エス',
  payment: 'ペイメント',
  method: 'メソッド',
  sandbox: 'サンドボックス',
  entitlement: 'エンタイトルメント',
  unit: 'ユニット',
  amount: 'アマウント',
  elements: 'エレメンツ',
  mode: 'モード',
  line: 'ライン',
  always: 'オールウェイズ',
  true: 'トゥルー',
  deleted: 'デリーテッド',
  updated: 'アップデーテッド',
  trial: 'トライアル',
  will: 'ウィル',
  construct: 'コンストラクト',
  inclusive: 'インクルーシブ',
  create: 'クリエイト',
  behavior: 'ビヘイビア',
  paid: 'ペイド',
  completed: 'コンプリーテッド',
  action: 'アクション',
  resumed: 'リジュームド',
  pro: 'プロ',
  expand: 'エクスパンド',
  object: 'オブジェクト',
  lookup: 'ルックアップ',
  key: 'キー',
  metadata: 'メタデータ',
  reason: 'リーズン',
  update: 'アップデート',
  return: 'リターン',
  flexible: 'フレキシブル',
  classic: 'クラシック',
  null: 'ヌル',
  now: 'ナウ',
  anchor: 'アンカー',
  cycle: 'サイクル',
  proration: 'プロレーション',
};

const LETTERS: Record<string, string> = {
  A: 'エー', B: 'ビー', C: 'シー', D: 'ディー', E: 'イー', F: 'エフ', G: 'ジー', H: 'エイチ', I: 'アイ',
  J: 'ジェイ', K: 'ケー', L: 'エル', M: 'エム', N: 'エヌ', O: 'オー', P: 'ピー', Q: 'キュー', R: 'アール',
  S: 'エス', T: 'ティー', U: 'ユー', V: 'ブイ', W: 'ダブリュー', X: 'エックス', Y: 'ワイ', Z: 'ゼット',
};
const DIGITS = ['ゼロ', 'ワン', 'ツー', 'スリー', 'フォー', 'ファイブ', 'シックス', 'セブン', 'エイト', 'ナイン'];

const splitCamel = (w: string): string[] =>
  w.replace(/([a-z])([A-Z])/g, '$1 $2').split(' ').filter(Boolean);

const word = (w: string): string => {
  const hit = WORDS[w.toLowerCase()];
  if (hit) return hit;
  const m = /^([A-Z]+)(\d+)$/.exec(w);
  if (m) return [...m[1]].map((c) => LETTERS[c]).join('') + [...m[2]].map((d) => DIGITS[Number(d)]).join('');
  if (/^[A-Z]{1,4}$/.test(w)) return [...w].map((c) => LETTERS[c]).join('');
  throw new Error(`読みが未登録の英単語: ${w}`);
};

const token = (tok: string): string =>
  tok
    .split(/[_.\-\/]+/)
    .filter(Boolean)
    .flatMap(splitCamel)
    .map(word)
    .join('・');

export const toSpeech = (text: string): string => {
  let s = text;
  for (const [from, to] of [...PHRASES].sort((a, b) => b[0].length - a[0].length)) s = s.split(from).join(to);
  s = s.replace(/[A-Za-z][A-Za-z0-9_.\-\/]*[A-Za-z0-9]|[A-Za-z]/g, token);
  // 読まなくてよい記号と、表示用の半角スペース
  s = s.replace(/[{}`]/g, '').replace(/ +/g, '');
  return s;
};
