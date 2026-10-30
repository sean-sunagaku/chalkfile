// 講座の台本と画面構成のデータ型。
// 画面の要素は `at`（その場面の何番目の台詞の頭で出すか、0 始まり）でナレーションに同期させる。

export type Tone = 'pink' | 'violet' | 'cyan' | 'mint' | 'amber' | 'coral' | 'slate';

export type VoiceId = 'narrator' | 'announcer';

export type SfxId = 'pop' | 'whoosh' | 'chime' | 'tick' | 'reveal' | 'correct' | 'type';

export type IconName =
  | 'user'
  | 'browser'
  | 'server'
  | 'database'
  | 'card'
  | 'stripe'
  | 'bell'
  | 'receipt'
  | 'tag'
  | 'box'
  | 'file'
  | 'portal'
  | 'shield'
  | 'clock'
  | 'flask'
  | 'key'
  | 'check'
  | 'x'
  | 'repeat'
  | 'zap'
  | 'lock'
  | 'heart'
  | 'phone'
  | 'code'
  | 'book'
  | 'scale'
  | 'yen'
  | 'flag'
  | 'map'
  | 'list'
  | 'alert'
  | 'link'
  | 'apple'
  | 'gift'
  | 'calendar'
  | 'route'
  | 'search'
  | 'layers';

export type Line = {
  /** 画面の台本・字幕に出す文 */
  t: string;
  /** 読み上げ用の文。省略すると t を辞書で開いたもの */
  s?: string;
  v?: VoiceId;
  /** この台詞の後に足す間（秒） */
  pause?: number;
  sfx?: SfxId;
};

type Base = {
  /** ヘッダーに出す場面の見出し */
  heading?: string;
  lines: Line[];
  /** 場面の最後に足す余白（秒）。クイズの考える時間など */
  hold?: number;
};

export type OpeningScene = Base & {
  kind: 'opening';
  section: string;
  title: string;
  subtitle: string;
};

export type GoalsScene = Base & {
  kind: 'goals';
  items: { text: string; at: number }[];
};

export type PointsScene = Base & {
  kind: 'points';
  items: { title: string; body?: string; at: number; tone?: Tone; icon?: IconName }[];
  columns?: 1 | 2 | 3 | 4;
  numbered?: boolean;
};

export type ConceptCard = {
  key: string;
  en: string;
  ja: string;
  desc: string;
  idPrefix?: string;
  tone: Tone;
  icon: IconName;
  at: number;
};

export type ConceptsScene = Base & {
  kind: 'concepts';
  cards: ConceptCard[];
  focus?: { key: string | null; at: number }[];
  columns?: 2 | 3 | 4;
};

export type SequenceScene = Base & {
  kind: 'sequence';
  actors: { key: string; label: string; sub?: string; tone: Tone; icon: IconName }[];
  steps: {
    from: string;
    to: string;
    label: string;
    at: number;
    dashed?: boolean;
    tone?: Tone;
  }[];
};

export type FlowNode = {
  key: string;
  label: string;
  sub?: string;
  /** 1920x1080 基準の中心座標 */
  x: number;
  y: number;
  w?: number;
  h?: number;
  tone: Tone;
  icon?: IconName;
  at: number;
  mono?: boolean;
};

export type FlowScene = Base & {
  kind: 'flow';
  nodes: FlowNode[];
  groups?: { label: string; x: number; y: number; w: number; h: number; tone: Tone; at: number }[];
  edges: {
    from: string;
    to: string;
    label?: string;
    at: number;
    tone?: Tone;
    dashed?: boolean;
    /** 曲げ（正で右回りに膨らむ） */
    bend?: number;
    fromSide?: 'l' | 'r' | 't' | 'b';
    toSide?: 'l' | 'r' | 't' | 'b';
    labelDx?: number;
    labelDy?: number;
  }[];
  focus?: { keys: string[]; at: number }[];
};

export type StatesScene = Base & {
  kind: 'states';
  nodes: { key: string; code: string; ja: string; x: number; y: number; tone: Tone; at: number; badge?: string }[];
  edges: {
    from: string;
    to: string;
    label: string;
    at: number;
    bend?: number;
    fromSide?: 'l' | 'r' | 't' | 'b';
    toSide?: 'l' | 'r' | 't' | 'b';
    labelDx?: number;
    labelDy?: number;
  }[];
  focus?: { keys: string[]; at: number }[];
};

export type CodeScene = Base & {
  kind: 'code';
  lang: 'python' | 'ts' | 'bash' | 'json' | 'text';
  file: string;
  code: string;
  /** 行は 1 始まり。at で光らせ、note を横に出す */
  marks: { from: number; to: number; at: number; note?: string; tone?: Tone }[];
  /** コード全体を出す台詞 */
  showAt?: number;
  fontSize?: number;
};

export type TableScene = Base & {
  kind: 'table';
  columns: string[];
  rows: { cells: string[]; at: number; tone?: Tone }[];
  widths?: number[];
  mono?: number[];
  fontSize?: number;
};

export type CompareSide = {
  title: string;
  sub?: string;
  tone: Tone;
  icon?: IconName;
  at: number;
  items: { text: string; at: number }[];
};

export type CompareScene = Base & {
  kind: 'compare';
  left: CompareSide;
  right: CompareSide;
  verdict?: { text: string; at: number; tone?: Tone };
};

export type BigScene = Base & {
  kind: 'big';
  kicker?: string;
  /** **で囲んだ部分を強調色にする */
  text: string;
  textAt?: number;
  sub?: string;
  subAt?: number;
  tone?: Tone;
  icon?: IconName;
};

export type NumbersScene = Base & {
  kind: 'numbers';
  items: { label: string; value: number; prefix?: string; suffix?: string; decimals?: number; at: number; tone: Tone; note?: string; op?: '' | '−' | '＝' }[];
  footnote?: { text: string; at: number };
};

export type TimelineScene = Base & {
  kind: 'timeline';
  items: { key: string; title: string; sub: string; detail?: string; at: number; tone: Tone }[];
  focus?: { key: string | null; at: number }[];
};

export type QuizScene = Base & {
  kind: 'quiz';
  no: number;
  question: string;
  answer: boolean;
  explain: string;
  revealAt: number;
};

export type RecapScene = Base & {
  kind: 'recap';
  items: { text: string; at: number }[];
};

export type RefsScene = Base & {
  kind: 'refs';
  refs: { title: string; url: string; note: string; at: number }[];
};

export type PhoneScreen = {
  at: number;
  title: string;
  /** app と done はアプリの画面、stripe は Stripe がホストする支払いページ */
  kind: 'app' | 'stripe' | 'done';
  /** アプリの画面の上に出すサービス名（既定はサンプルアプリ／Pro プラン） */
  brand?: string;
  brandSub?: string;
  lead?: string;
  body: string[];
  primary?: string;
  secondary?: string;
  /** stripe の画面で、申し込むボタンの上に出す説明 */
  note?: string;
  caption: string;
};

export type PhoneScene = Base & {
  kind: 'phone';
  screens: PhoneScreen[];
};

export type TerminalScene = Base & {
  kind: 'terminal';
  title: string;
  entries: { cmd?: string; out?: string[]; at: number; note?: string }[];
};

export type EndingScene = Base & {
  kind: 'ending';
  next?: { no: number; title: string };
  /** 最後のレクチャーで「おつかれさまでした」の下に出す一言 */
  closing?: string;
};

export type Scene =
  | OpeningScene
  | GoalsScene
  | PointsScene
  | ConceptsScene
  | SequenceScene
  | FlowScene
  | StatesScene
  | CodeScene
  | TableScene
  | CompareScene
  | BigScene
  | NumbersScene
  | TimelineScene
  | QuizScene
  | RecapScene
  | RefsScene
  | PhoneScene
  | TerminalScene
  | EndingScene;

export type QuizItem = { q: string; choices: string[]; answer: number; explain: string };

export type Lecture = {
  id: string; // 例: 'L01'。講座をまたいで重ならないように、講座ごとに頭の文字を変える
  no: number;
  section: { no: number; title: string };
  title: string;
  summary: string;
  /** 講座サイトの「公式ドキュメント」タブ */
  docs: { title: string; url: string }[];
  /** 講座サイトの確認クイズ */
  quiz: QuizItem[];
  /** 講座サイトに出す、このレクチャーで実装に効くメモ */
  takeaways: string[];
  scenes: Scene[];
};

/** 講座 1 つ分（講座サイト 1 枚と、動画の右上の講座名） */
export type Course = {
  id: string; // 例: 'stripe-billing'。サイトの URL（/<id>/）になる
  /** サイトの見出しと動画の右上に出す講座名 */
  title: string;
  subtitle: string;
  /** サイト冒頭の一文 */
  headline: string;
  sections: { no: number; title: string }[];
  lectures: Lecture[];
  /** 「公式ドキュメント」タブの前置き */
  docsNote: string;
  /** フッターのクレジットの後ろに足す、台本のもと */
  sourceNote: string;
  /** 講座サイトの見出しの横に出すリンク（関連する講座など）。GitHub へのリンクは site/config.json から足す */
  links?: { label: string; url: string }[];
  /** 動画と講座サイトのテーマ（content/themes.ts の id）。省略すると Chalkfile の既定のテーマ */
  theme?: string;
};

/** 本文の書体。並べた順に使う（英字用の書体を先に置くと、英字だけその書体になる） */
export type FontKey = 'zen-maru' | 'noto' | 'inter';

/**
 * 講座のトンマナ（色・書体・背景の飾り）。動画と講座サイトの両方がこれで描かれる。
 * 色はすべて #RRGGBB で書く（薄い色や文字色はここから作る）。
 */
export type Theme = {
  id: string;
  /** README やサイトに出す名前 */
  label: string;
  /** 一覧ページのテーマの紹介に出す 1 文 */
  summary: string;
  /** 明るい地か暗い地か。薄い色と図の文字色の作り方が変わる */
  scheme: 'light' | 'dark';
  fonts: FontKey[];
  color: {
    /** 画面の地（上） */
    bg: string;
    /** 画面の地（下に向かってこの色になる） */
    bg2: string;
    /** カードの面 */
    surface: string;
    /** 一段沈んだ面（表の見出し・帯） */
    surface2: string;
    /** 見出しの文字 */
    ink: string;
    /** 本文の文字 */
    sub: string;
    /** 補足の文字 */
    muted: string;
    /** 細い線 */
    line: string;
    /** 強めの線 */
    line2: string;
    /** 主役の色（進み具合・選択中・サイトのボタン） */
    accent: string;
    /** 主役の色の上に乗せる文字 */
    onAccent: string;
    /** コードと端末の面。どのテーマでも濃い色にする */
    code: string;
  };
  /** カードの影（CSS の box-shadow） */
  shadow: string;
  /** 見出しの下線・進み具合の線（2 色以上） */
  gradient: string[];
  /** オープニングとエンディングの大きな数字・文字の塗り（2 色以上。地に対して十分濃く） */
  display: string[];
  /** 背景の飾りに使う色（3〜4 色） */
  mesh: string[];
  /** 図の要素の色。薄い面と文字色はここから作る */
  tones: Record<Tone, string>;
  /** コードの色分け（code の面の上で読める色） */
  syntax: { plain: string; comment: string; string: string; keyword: string; deco: string; number: string; fn: string };
  /** 背景の飾り。chalk: 方眼の点とチョークのにじみ、band: 斜めのグラデーションの帯、stars: 暗い地に光の粒 */
  decor: 'chalk' | 'band' | 'stars';
  /** カードの角の丸み（px） */
  radius: number;
};
