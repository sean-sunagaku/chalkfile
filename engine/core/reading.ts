// 読み上げる文の作り方（読みのエンジン）と、全講座で共通の読みの辞書。台本の表示文（t）から読み上げ文を作る。
// 英字は VOICEVOX が読めないので、カナに開く。知らない英単語が出たら例外にして、黙って英字のまま合成しないようにする。
// 辞書は 2 つに分ける:
//   共通（このファイル。台本と道具は content/reading.ts からも読める。再 export）: 英字・数字の開き方と、どの講座でも同じ読みにしたい語（一般の語・IT の用語・VOICEVOX がよく読み違える日本語）
//   講座（content/<講座>/reading.ts）: その講座の用語・固有名詞・その講座だけの読みの直し。講座の index.ts の reading に登録する。
//     共通の辞書より優先する（同じ語は講座の読み。語句は長いものから当て、長さが同じなら講座の語句が先）
// 講座の辞書を直しても、ほかの講座の読みは変わらない。共通の辞書を直すと全講座の読みが変わりうるので、npm test（音声の鍵と読みの
// スナップショット）と npm run reading:diff（main との読みの差分）で、変わった台詞と動画を見て、合成し直す。
// 何も import しない（Node・React・Remotion にも、engine/core のほかのファイルにも依存しない）

/** 読みの辞書。phrases: 単語より先に置き換える語句（長いものから順に当てる）。words: 英単語の読み（小文字で引く） */
export type Reading = {
  readonly phrases?: readonly (readonly [string, string])[];
  readonly words?: Readonly<Record<string, string>>;
};

/**
 * 共通の語句（単語より先に置き換える。長いものから順に当てる。長さが同じ語句は、この並びの順に当てる）。
 * 足すときは、全講座の台詞に当たる。1 つの講座の用語や、その講座だけの直しは、講座の辞書に足す
 */
const PHRASES: readonly (readonly [string, string])[] = [
  // 講座を問わない名前（英字のまま画面に出し、読みだけ開く）
  ['App Store', 'アップストア'],
  ['FastAPI', 'ファスト・エーピーアイ'],
  ['PayPay', 'ペイペイ'],
  ['iOS', 'アイオーエス'],
  ['3D', 'スリーディー'],
  // 小数の読み（「三・六」を「さん・ろく」と読ませない）
  ['三・六パーセント', 'さんてんろくパーセント'],
  ['〇・七パーセント', 'れいてんななパーセント'],
  // VOICEVOX が読み違えた日本語（「いっこう」「そのかん」「おもキー」「ふりがえり」「おもてけいさん」など）
  ['一行', 'いちぎょう'],
  ['その間', 'そのあいだ'],
  ['主キー', 'しゅキー'],
  ['振り返り', 'ふりかえり'],
  ['表計算', 'ひょうけいさん'],
  ['A/B テスト', 'エービーテスト'],
  ['どうやって作', 'どうやってつく'],
  ['深刻度で', 'しんこくどで'],
  ['作り手', 'つくりて'],
  ['描き直せ', 'かきなおせ'],
  ['描けて', 'かけて'],
  ['一目で', 'ひと目で'],
  ['完成形', 'かんせいけい'],
  ['日本', 'にほん'],
  ['最初の行動', 'さいしょのこうどう'],
  ['四・三パーセント', 'よんてんさんパーセント'],
  // 講座を問わない名前
  ['GitHub', 'ギットハブ'],
  ['ReAct', 'リアクト'],
];

/** 共通の英単語の読み（小文字で引く） */
const WORDS: Readonly<Record<string, string>> = {
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
  items: 'アイテムズ',
  http: 'エイチティーティーピー',
  post: 'ポスト',
  json: 'ジェイソン',
  apple: 'アップル',
  insert: 'インサート',
  processed: 'プロセスト',
  listen: 'リッスン',
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
  google: 'グーグル',
  chrome: 'クローム',
  cursor: 'カーソル',
  agent: 'エージェント',
  router: 'ルーター',
  worker: 'ワーカー',
  thread: 'スレッド',
  watchdog: 'ウォッチドッグ',
  inline: 'インライン',
  spill: 'スピル',
  bash: 'バッシュ',
  daemon: 'デーモン',
};

/** 共通の辞書 */
const COMMON: Reading = { phrases: PHRASES, words: WORDS };

/* ───────────── 台詞と講座の辞書 ─────────────
 * 読み上げる文（engine/core/voices.ts の speechOf）は、台詞のオブジェクトに付けた講座の辞書で読む。付けるのは content/index.ts（日本語の講座を
 * 読み込むとき。動画専用の content/videos.ts も同じ辞書を付ける）。付いていない台詞（テストの見本など）は、共通の辞書だけで読む。台詞のオブジェクトを写すと（structuredClone など）辞書は
 * 付いていないので、台本から読んだ台詞のまま渡す
 */
const READING_OF = new WeakMap<object, Reading>();

/** 台詞に講座の辞書を付ける。もう別の講座の辞書が付いている台詞（2 つの講座で同じ台詞のオブジェクトを使っている）を返す（付け替えない） */
export const useReading = (lines: Iterable<object>, reading: Reading): object[] => {
  const shared: object[] = [];
  for (const line of lines) {
    const had = READING_OF.get(line);
    if (had && had !== reading) shared.push(line);
    else READING_OF.set(line, reading);
  }
  return shared;
};

/** 台詞に付いた講座の辞書（無ければ undefined。共通の辞書だけで読む） */
export const readingOf = (line: object): Reading | undefined => READING_OF.get(line);

/* ───────────── 読みのエンジン ───────────── */

const LETTERS: Record<string, string> = {
  A: 'エー',
  B: 'ビー',
  C: 'シー',
  D: 'ディー',
  E: 'イー',
  F: 'エフ',
  G: 'ジー',
  H: 'エイチ',
  I: 'アイ',
  J: 'ジェイ',
  K: 'ケー',
  L: 'エル',
  M: 'エム',
  N: 'エヌ',
  O: 'オー',
  P: 'ピー',
  Q: 'キュー',
  R: 'アール',
  S: 'エス',
  T: 'ティー',
  U: 'ユー',
  V: 'ブイ',
  W: 'ダブリュー',
  X: 'エックス',
  Y: 'ワイ',
  Z: 'ゼット',
};
const DIGITS = ['ゼロ', 'ワン', 'ツー', 'スリー', 'フォー', 'ファイブ', 'シックス', 'セブン', 'エイト', 'ナイン'];

const splitCamel = (w: string): string[] =>
  w
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .filter(Boolean);

/** 英単語の読み（講座の辞書が先、無ければ共通の辞書。小文字で引く） */
const lookup = (dict: Readonly<Record<string, string>> | undefined, w: string): string | undefined =>
  dict && Object.hasOwn(dict, w) ? dict[w] : undefined;

const word = (w: string, course?: Reading): string => {
  const lower = w.toLowerCase();
  const hit = lookup(course?.words, lower) ?? lookup(WORDS, lower);
  if (hit) return hit;
  const m = /^([A-Z]+)(\d+)$/.exec(w);
  // 一致すれば、英字と数字の捕捉群はどちらも空でない。
  if (m) return [...m[1]!].map((c) => LETTERS[c]).join('') + [...m[2]!].map((d) => DIGITS[Number(d)]).join('');
  if (/^[A-Z]{1,4}$/.test(w)) return [...w].map((c) => LETTERS[c]).join('');
  throw new Error(`読みが未登録の英単語: ${w}`);
};

const token = (tok: string, course?: Reading): string =>
  tok
    .split(/[_.\-/]+/)
    .filter(Boolean)
    .flatMap(splitCamel)
    .map((w) => word(w, course))
    .join('・');

/** 当てる語句の並び（講座の語句と共通の語句。長いものから順に当てる。長さが同じなら講座の語句が先。同じ語句は講座のものを使う） */
const sorted = new WeakMap<Reading, readonly (readonly [string, string])[]>();
const phrasesOf = (course?: Reading): readonly (readonly [string, string])[] => {
  const key = course ?? COMMON;
  let out = sorted.get(key);
  if (!out) {
    const own = course?.phrases ?? [];
    const mine = new Set(own.map(([from]) => from));
    out = [...own, ...PHRASES.filter(([from]) => !mine.has(from))].sort((a, b) => b[0].length - a[0].length);
    sorted.set(key, out);
  }
  return out;
};

/** 読み上げる文。course はその講座の辞書（content/<講座>/reading.ts）。渡さなければ共通の辞書だけで読む */
export const toSpeech = (text: string, course?: Reading): string => {
  let s = text;
  for (const [from, to] of phrasesOf(course)) s = s.split(from).join(to);
  s = s.replace(/[A-Za-z][A-Za-z0-9_.\-/]*[A-Za-z0-9]|[A-Za-z]/g, (tok) => token(tok, course));
  // 読まなくてよい記号と、表示用の半角スペース
  s = s.replace(/[{}`]/g, '').replace(/ +/g, '');
  return s;
};

/* ───────────── 中国語の読みの直し ─────────────
 * 中国語の台詞は Kokoro の misaki（jieba・pypinyin）が読みを決める。多音字で違う読みを選ぶ語を、同じ音の字に置き換えて読ませる。
 * 見つけ方: uv run scripts/check_speech.py <key>（聞き取りの食い違いと、多音字の読みの一覧を出す）
 */
const ZH_PHRASES: [RegExp, string][] = [
  // 数のあとの「行」はコードの行（háng）。pypinyin は xíng と読む
  [/([0-9一二三四五六七八九十百千万两几]+) ?行/g, '$1杭'],
  // 「走得快」の得（様子を言う de）を dé と読む。同じ音の「的」で読ませる
  [/走得快/g, '走的快'],
  // 2026-11-02 の Super-agent の見直しで見つけた読み違い（台詞の s でも直した。ここは次の訳のため）
  // 长（cháng）を zhǎng と読む語
  [/长时间/g, '常时间'],
  [/(很|太)长/g, '$1常'],
  // 地（dì）が軽声の de になる語。成本地・基本地・根本地（〜に。様子を言う de）は外す
  [/(?<![成基根])(本|原|就)地/g, '$1帝'],
];

export const toSpeechZh = (text: string): string => ZH_PHRASES.reduce((s, [from, to]) => s.replace(from, to), text);
