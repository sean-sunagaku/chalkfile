// 講座の台本と画面構成のデータ型（台本の形）。台本（content/<講座>/）は content/types.ts から読む（ここを再 export しているだけ）。
// 画面の要素は `at`（その場面の何番目の台詞の頭で出すか、0 始まり）でナレーションに同期させる。
// at は台詞の番号のほかに、同じ場面の台詞の id（Line の id）でも書ける（At）。id で書いた台本の型は AuthoredLecture・AuthoredCourse。
// 読み込むとき（content/index.ts。直し方は engine/core/lines.ts）に id を番号に直すので、描く側・声を作る側が受け取るのは、at が番号の Lecture・Course だけ
import type { Lang } from './i18n';
import type { IconName } from './icons';
import type { SfxId } from './sfx';

/**
 * 画面の要素を出す台詞。その場面の何番目の台詞の頭で出すか（0 始まり）か、同じ場面の台詞の id（Line の id）。
 * id で書くと、台詞を足したり並べ替えたりしても、要素は同じ台詞に付いたまま動く（番号を数え直さなくてよい）。
 * 読み込むときに番号に直してから、台本の検証（engine/core/validate.ts）にかける。場面の型の A は at の型で、
 * 台本に書く形（AuthoredScene など）は At、読み込んだあと（Scene など）は number
 */
export type At = number | string;

export type Tone = 'pink' | 'violet' | 'cyan' | 'mint' | 'amber' | 'coral' | 'slate';

/**
 * 声（VOICEVOX・Kokoro の話者と話し方は engine/core/voices.ts）。narrator: 講師、announcer: 呼び込み。
 * お笑い版の掛け合い: zundamon（ボケ）・zundamon-cry（ボケの涙声）・tsukkomi（講師の声で短く刺すツッコミ）・tennokoe（天の声）
 */
export type VoiceId = 'narrator' | 'announcer' | 'zundamon' | 'zundamon-cry' | 'tsukkomi' | 'tennokoe';

/** 効果音の名前。一覧（名前・ミックスの音量・何の音か）は engine/core/sfx.ts の SFX で、型はそこから作る */
export type { SfxId };

/** 台本の icon に書ける名前。一覧は engine/core/icons.ts の ICON_NAMES（名前は lucide-react の名前ではなく、短い独自の名前。描くアイコンとの対応は src/components/icons.ts の ICONS） */
export type { IconName };

export type Line = {
  /**
   * この台詞の名前（同じ場面の中で重ねない）。画面の要素の at に書くと、その台詞の頭で出す。
   * 訳では、対応する台詞に同じ id を付ければ、訳の台詞の数が日本語と違っても at を書き直さなくてよい
   */
  id?: string;
  /** 画面の台本・字幕に出す文 */
  t: string;
  /** 読み上げ用の文。省略すると t を辞書で開いたもの */
  s?: string;
  v?: VoiceId;
  /** この台詞の後に足す間（秒）。負の値で、台詞の間（0.3 秒）を詰める（食い気味のツッコミ。最短 0.05 秒） */
  pause?: number;
  sfx?: SfxId;
  /** 台詞の後の間に鳴らす効果音（ボケがスベった後の chin、溜めの drumroll など） */
  sfxAfter?: SfxId;
  /** cut: この台詞の頭で BGM を止める（急にシリアスにする）。back: この台詞の頭で戻す。戻さなければ場面の終わりで戻る */
  bgm?: 'cut' | 'back';
};

/** どの種類の場面にもある項目 */
export type SceneBase = Base;

type Base = {
  /** ヘッダーに出す場面の見出し */
  heading?: string;
  lines: Line[];
  /** 場面の最後に足す余白（秒）。クイズの考える時間など */
  hold?: number;
  /** 見出しの横に出す、この場面の根拠の種類（研究結果・公式や法令・実務指針・説明用の仮の例） */
  evidence?: Evidence;
  /** 左下に出す出典の短い表記（例: Johnson & Goldstein, Science, 2003） */
  cite?: string;
};

export type OpeningScene = Base & {
  kind: 'opening';
  /** タイトルの上の札。省略すると出さない */
  section?: string;
  title: string;
  /**
   * タイトルを行に分けて出す（2 行以上なら 1 行目をグラデーションの文字にする）。書かなければ title を 1 行で出す。
   * 古い書き方（title の全角の空白か改行で分ける）も描けるが、台本の検証が注意を出す（engine/core/legacy.ts）
   */
  titleLines?: string[];
  /** タイトルの下の一文。省略すると出さない */
  subtitle?: string;
};

export type GoalsScene<A extends At = number> = Base & {
  kind: 'goals';
  items: { text: string; at: A }[];
};

export type PointsScene<A extends At = number> = Base & {
  kind: 'points';
  items: { title: string; body?: string; at: A; tone?: Tone; icon?: IconName }[];
  columns?: 1 | 2 | 3 | 4;
  numbered?: boolean;
};

export type ConceptCard<A extends At = number> = {
  key: string;
  en: string;
  ja: string;
  desc: string;
  idPrefix?: string;
  tone: Tone;
  icon: IconName;
  at: A;
};

export type ConceptsScene<A extends At = number> = Base & {
  kind: 'concepts';
  cards: ConceptCard<A>[];
  columns?: 2 | 3 | 4;
};

export type SequenceScene<A extends At = number> = Base & {
  kind: 'sequence';
  actors: {
    key: string;
    label: string;
    sub?: string;
    /** sub を等幅の書体で出す（URL やパスのとき）。古い書き方（sub に / があれば等幅）も描けるが、台本の検証が注意を出す */
    subMono?: boolean;
    tone: Tone;
    icon: IconName;
  }[];
  steps: {
    from: string;
    to: string;
    label: string;
    at: A;
    dashed?: boolean;
    tone?: Tone;
  }[];
};

export type FlowNode<A extends At = number> = {
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
  at: A;
  mono?: boolean;
};

export type FlowScene<A extends At = number> = Base & {
  kind: 'flow';
  nodes: FlowNode<A>[];
  groups?: { label: string; x: number; y: number; w: number; h: number; tone: Tone; at: A }[];
  edges: {
    from: string;
    to: string;
    label?: string;
    at: A;
    tone?: Tone;
    dashed?: boolean;
    /** 曲げ（正で右回りに膨らむ） */
    bend?: number;
    fromSide?: 'l' | 'r' | 't' | 'b';
    toSide?: 'l' | 'r' | 't' | 'b';
    labelDx?: number;
    labelDy?: number;
  }[];
  focus?: { keys: string[]; at: A }[];
};

export type StatesScene<A extends At = number> = Base & {
  kind: 'states';
  nodes: {
    key: string;
    code: string;
    ja: string;
    x: number;
    y: number;
    tone: Tone;
    at: A;
    badge?: string;
    /**
     * 箱の見た目。start は始まりの見た目（点線の枠・ごく薄い面・太い本文の書体）、state（既定）は状態の見た目（等幅の書体）。
     * 古い書き方（key が 'start' の箱を始まりの見た目にする）も描けるが、台本の検証が注意を出す
     */
    variant?: 'start' | 'state';
  }[];
  edges: {
    from: string;
    to: string;
    label: string;
    at: A;
    bend?: number;
    fromSide?: 'l' | 'r' | 't' | 'b';
    toSide?: 'l' | 'r' | 't' | 'b';
    labelDx?: number;
    labelDy?: number;
  }[];
  focus?: { keys: string[]; at: A }[];
};

export type CodeScene<A extends At = number> = Base & {
  kind: 'code';
  lang: 'python' | 'ts' | 'bash' | 'json' | 'text';
  file: string;
  code: string;
  /** 行は 1 始まり。at で光らせ、note を横に出す */
  marks: { from: number; to: number; at: A; note?: string; tone?: Tone }[];
  /** コード全体を出す台詞 */
  showAt?: A;
  fontSize?: number;
};

export type TableScene<A extends At = number> = Base & {
  kind: 'table';
  columns: string[];
  rows: { cells: string[]; at: A; tone?: Tone }[];
  widths?: number[];
  mono?: number[];
  fontSize?: number;
};

export type CompareSide<A extends At = number> = {
  title: string;
  sub?: string;
  tone: Tone;
  icon?: IconName;
  at: A;
  items: { text: string; at: A }[];
};

export type CompareScene<A extends At = number> = Base & {
  kind: 'compare';
  left: CompareSide<A>;
  right: CompareSide<A>;
  verdict?: { text: string; at: A; tone?: Tone };
};

export type BigScene<A extends At = number> = Base & {
  kind: 'big';
  kicker?: string;
  /** **で囲んだ部分を強調色にする */
  text: string;
  textAt?: A;
  sub?: string;
  subAt?: A;
  tone?: Tone;
  icon?: IconName;
};

export type NumbersScene<A extends At = number> = Base & {
  kind: 'numbers';
  items: { label: string; value: number; prefix?: string; suffix?: string; decimals?: number; at: A; tone: Tone; note?: string; op?: '' | '−' | '＝' }[];
  footnote?: { text: string; at: A };
};

export type TimelineScene<A extends At = number> = Base & {
  kind: 'timeline';
  items: {
    key: string;
    /** 題の上の小さな札（例: STEP 1）。古い書き方（title を全角の空白で札と題に分ける）も描けるが、台本の検証が注意を出す */
    kicker?: string;
    title: string;
    sub: string;
    detail?: string;
    at: A;
    tone: Tone;
  }[];
  focus?: { key: string | null; at: A }[];
};

export type QuizScene<A extends At = number> = Base & {
  kind: 'quiz';
  no: number;
  question: string;
  answer: boolean;
  explain: string;
  revealAt: A;
};

export type RecapScene<A extends At = number> = Base & {
  kind: 'recap';
  items: { text: string; at: A }[];
};

export type RefsScene<A extends At = number> = Base & {
  kind: 'refs';
  refs: { title: string; url: string; note: string; at: A }[];
};

export type PhoneScreen<A extends At = number> = {
  at: A;
  title: string;
  /** app はアプリの画面、done は終わりの画面（緑の地にチェック） */
  kind: 'app' | 'done';
  /** 画面の上に出す、架空のアプリの名前（例: サンプル家計簿）。エンジンは既定の名前を持たないので、講座ごとに書く */
  brand: string;
  /** 名前の下の小さな文字（例: 架空のアプリ）。書かなければ出さない */
  brandSub?: string;
  lead?: string;
  /** lead を等幅の書体で出す（URL の一部など）。古い書き方（lead が ? で始まれば等幅）も描けるが、台本の検証が注意を出す */
  leadMono?: boolean;
  body: string[];
  primary?: string;
  secondary?: string;
  caption: string;
};

export type PhoneScene<A extends At = number> = Base & {
  kind: 'phone';
  screens: PhoneScreen<A>[];
};

/**
 * 架空のアプリの画面の部品（改善前・改善後の比べに使う）。色は画面のモックの色で、講座のテーマとは別。
 * weak: わざと読みにくい（薄い文字・薄い線）。改善前の悪い例を描くとき。
 * id: 部品の名前（同じ画面の中で重ねない）。注（MockNote）の blockId で、番号を数えずに指せる
 */
export type MockBlock = { id?: string } & (
  | { type: 'title'; text: string; weak?: boolean }
  | { type: 'text'; text: string; weak?: boolean; small?: boolean }
  | { type: 'field'; label?: string; placeholder?: string; value?: string; error?: string; hint?: string; required?: boolean; weak?: boolean }
  | { type: 'button'; text: string; variant: 'primary' | 'secondary' | 'link' | 'danger'; weak?: boolean }
  | { type: 'buttons'; items: { text: string; variant: 'primary' | 'secondary' | 'link' | 'danger'; weak?: boolean }[] }
  | { type: 'alert'; text: string; tone: 'error' | 'info' | 'warn' | 'success' }
  | { type: 'toggle'; label: string; on: boolean; sub?: string }
  | { type: 'check'; label: string; checked: boolean; weak?: boolean }
  | { type: 'steps'; items: string[]; current: number }
  | { type: 'list'; items: string[]; weak?: boolean }
  | { type: 'badge'; text: string }
  | { type: 'divider' }
  | { type: 'spacer'; h: number }
);

/** 部品の右に出す番号つきの注。指す部品は、block か blockId のどちらかで書く（両方が無い・食い違うと、台本の検証が誤りにする） */
export type MockNote<A extends At = number> = {
  n: number;
  text: string;
  /** 注を付ける部品の番号（blocks の番号。0 始まり） */
  block?: number;
  /** 注を付ける部品の id（MockBlock の id）。読み込むときに block に直す */
  blockId?: string;
  at: A;
  tone?: Tone;
};

export type MockScreen<A extends At = number> = {
  /** 画面の上の札（例: 改善前） */
  label: string;
  tone: Tone;
  /** 窓の題（ブラウザのタブ・アプリの見出し） */
  title?: string;
  blocks: MockBlock[];
  /** 部品の右に出す番号つきの注（MockNote） */
  notes?: MockNote<A>[];
  at: A;
};

/** 同じ画面の改善前と改善後を並べる（right を省くと 1 枚と注の一覧） */
export type ScreensScene<A extends At = number> = Base & {
  kind: 'screens';
  device?: 'browser' | 'phone';
  /**
   * 画面の中身の拡大率（部品が少ない画面は大きくして読みやすくする）。既定はスマホ 1.3、ブラウザは 2 枚並べるとき 1.1・1 枚だけのとき 1.15
   * （src/scenes/screens.tsx の Frame に渡す値）
   */
  zoom?: number;
  left: MockScreen<A>;
  right?: MockScreen<A>;
};

/** 端末の出力の色。書かなければ薄い色（コードのコメントの色）。ok: 成功した行（文字列の色）、info: 目を向けてほしい行（関数の色） */
export type TerminalTone = 'ok' | 'info';
/** 端末の出力の 1 行。文字だけなら薄い色で出す。色を付けるときは { text, tone } と書く */
export type TerminalOut = string | { text: string; tone?: TerminalTone };

export type TerminalScene<A extends At = number> = Base & {
  kind: 'terminal';
  title: string;
  entries: { cmd?: string; out?: TerminalOut[]; at: A; note?: string }[];
};

export type EndingScene = Base & {
  kind: 'ending';
  next?: { no: number; title: string };
  /** 最後のレクチャーで「おつかれさまでした」の下に出す一言 */
  closing?: string;
};

/** 場面。A は at の型（読み込んだあとは number。台本に書く形は AuthoredScene） */
export type Scene<A extends At = number> =
  | OpeningScene
  | GoalsScene<A>
  | PointsScene<A>
  | ConceptsScene<A>
  | SequenceScene<A>
  | FlowScene<A>
  | StatesScene<A>
  | CodeScene<A>
  | TableScene<A>
  | CompareScene<A>
  | BigScene<A>
  | NumbersScene<A>
  | TimelineScene<A>
  | QuizScene<A>
  | RecapScene<A>
  | RefsScene<A>
  | PhoneScene<A>
  | ScreensScene<A>
  | TerminalScene<A>
  | EndingScene;

/** 台本に書く形の場面（at に台詞の id、注に blockId も書ける）。読み込むと Scene になる */
export type AuthoredScene = Scene<At>;

export type QuizItem = { q: string; choices: string[]; answer: number; explain: string };

/* ───────────── 教材（読む教材・実践課題・AI チャットの参照先） ─────────────
 * 動画の台本（scenes）とは別に、章ごとの「読んで学べる教材」を持つ。
 * 章 ID・節 ID は公開後に変えない（あとで AI 質問チャットが、どの節を根拠に答えたかを指すのに使う）。
 */

/** 根拠の種類。研究結果・公式や法令や規格・一般的な実務指針・説明用の仮の例を分けて書く */
export type Evidence = 'research' | 'official' | 'practice' | 'example';

/** 出典。教材と台本の主張から id で引く */
export type Source = {
  /** 講座の中で重ならない ID（例: 'johnson-goldstein-2003'） */
  id: string;
  title: string;
  url: string;
  /** 著者・発行元 */
  publisher: string;
  /** 発行年（版） */
  year: string;
  /** research（研究）・official（公式・法令・規格）・practice（実務家の指針・解説） */
  kind: Exclude<Evidence, 'example'>;
  /** 確かめた日（YYYY-MM-DD） */
  checked: string;
  /** 何を確かめたか（自分の言葉で） */
  note: string;
};

/** 教材本文の節 */
export type MaterialSection = {
  /** 節 ID（例: 'nudge-01-s02'）。公開後に変えない */
  id: string;
  title: string;
  /** 段落。Markdown の **強調** と「- 」で始まる箇条書きを使ってよい（HTML は書かない） */
  body: string[];
  /** この節に出てくる根拠の種類 */
  evidence: Evidence[];
  /** この節で頼った出典（Source の id） */
  sources?: string[];
  /** 対応する動画の場面（1 始まり） */
  scenes?: number[];
};

/** 図解・比較例（表・流れ・コードのどれか） */
export type Figure = {
  /** 図 ID（例: 'nudge-01-f01'） */
  id: string;
  title: string;
  caption: string;
  evidence: Evidence;
  /** 表。1 行目が見出し */
  table?: string[][];
  /** 流れ（左から右へ進む手順）。Markdown では Mermaid の図にもする */
  flow?: string[];
  /** コードの例 */
  code?: string;
  lang?: string;
};

/** 自分のサービスで取り組む実践課題 */
export type Exercise = {
  /** 課題 ID（例: 'nudge-01-ex'） */
  id: string;
  title: string;
  /** 何ができるようになるか */
  goal: string;
  /** 目安の時間 */
  timebox: string;
  /** 取り組む手順 */
  steps: string[];
  /** 出すもの（成果物） */
  deliverable: string;
  /** 回答例（架空のサンプルアプリで書く） */
  example: { title: string; body: string[] };
  /** 評価基準（観点ごとに、できている／もう一歩／やり直し） */
  rubric: { criterion: string; good: string; fair: string; poor: string }[];
};

/** 章の教材（各章の成果物のうち、動画以外のもの） */
export type ChapterMaterial = {
  /** 章 ID（例: 'nudge-01'）。節 ID・図 ID・課題 ID の頭にする */
  id: string;
  /** 章の学習目標 */
  goals: string[];
  /** 前提知識 */
  prerequisites: string[];
  /** 教材本文 */
  sections: MaterialSection[];
  /** 図解・比較例 */
  figures: Figure[];
  /** 実践課題 */
  exercise: Exercise;
  /** 要点まとめ */
  summary: string[];
  /** 参考資料（Source の id）。並べた順に出す */
  references: string[];
  /** 学習画面の右側の AI チャットに聞ける質問例と、答えの根拠にする節 ID */
  askExamples: { q: string; refs: string[] }[];
};

/** 講座の計画にある章（まだ動画を作っていない章も含む） */
export type PlannedChapter = {
  /** 章 ID（例: 'nudge-02'） */
  id: string;
  /** 動画（レクチャー）の ID（例: 'N02'） */
  lectureId: string;
  no: number;
  /** sections の no */
  section: number;
  title: string;
  /** この章で答える問い */
  question: string;
  goals: string[];
  prerequisites: string[];
  /** 動画の長さの目安（分） */
  minutes: number;
  /** 動画の構成（困りごと → 考え方 → 良い例・悪い例 → 実践手順 → 演習 → 振り返り） */
  storyline: { step: '困りごと' | '考え方' | '良い例・悪い例' | '実践手順' | '演習' | '振り返り'; content: string }[];
  /** 実践課題の案 */
  exercise: string;
  /** 主な出典（Source の id） */
  sources: string[];
  /** produced: 動画と教材を作った／planned: 計画だけ */
  status: 'produced' | 'planned';
};

/** 講座の設計（全体の目次・到達目標・動画構成） */
export type Syllabus = {
  /** 受講者 */
  audience: string;
  /** 講座の前提知識 */
  prerequisites: string[];
  /** 講座を終えたらできること */
  outcomes: string[];
  /** 最後に自分のサービスで仕上げるもの */
  finalProject: string;
  /** 例に使う架空のサービス */
  sample: string;
  chapters: PlannedChapter[];
};

/** 動画 1 本。A は at の型（読み込んだあとは number。台本に書く形は AuthoredLecture） */
export type Lecture<A extends At = number> = {
  id: string; // 例: 'L01'。講座の頭文字（Course の prefix）と 2 桁の番号。講座をまたいで重ならない
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
  /** 動画の右下に出し続け、サイトにも出す注意書き（法律・税・規約など、判断を専門家や公式に委ねる話のとき） */
  caution?: string;
  scenes: Scene<A>[];
  /** 読む教材・実践課題・AI チャットの質問例（講座サイトのタブと docs/ の Markdown に出る） */
  material?: ChapterMaterial;
};

/** 台本に書く形の動画（at に台詞の id も書ける）。id で at を書く台本は、この型にする。読み込むと Lecture になる */
export type AuthoredLecture = Lecture<At>;

/** 講座 1 つ分（講座サイト 1 枚と、動画の右上の講座名）。A は at の型（台本に書く形は AuthoredCourse） */
export type Course<A extends At = number> = {
  id: string; // 例: 'stripe-billing'。サイトの URL（/<id>/）になる
  /**
   * 台本の形の版。書かなければ 1（今の形）。台本の形を変えたとき、古い形で書いた講座を読み込みで今の形に直すのに使う
   * （engine/core/migrate.ts。凍結しているものと変えるときの手順は docs/adr/2026-11-03-frozen-contracts.md）
   */
  schemaVersion?: number;
  /**
   * レクチャー ID の頭文字（英大文字 1 字。例: 'G'）。ID は頭文字と 2 桁の番号（G01）。講座をまたいで重ねない
   * （npm run validate が確かめ、空いている文字を出す。使っている文字の表は docs/guide/new-course.md）
   */
  prefix: string;
  /** 講座の一覧（サイトの一覧ページ・README の表・COURSES）の並び。小さい順に並ぶ。講座をまたいで重ねない（content/courses.ts の行の順には頼らない） */
  order: number;
  /** 講座の言語。日本語の台本では書かない（ja）。訳の講座は localizeCourse（engine/core/i18n.ts）が付ける */
  lang?: Lang;
  /** サイトの見出しと動画の右上に出す講座名 */
  title: string;
  subtitle: string;
  /** サイト冒頭の一文 */
  headline: string;
  sections: { no: number; title: string }[];
  lectures: Lecture<A>[];
  /** 「公式ドキュメント」タブの前置き */
  docsNote: string;
  /** フッターのクレジットの後ろに足す、台本のもと */
  sourceNote: string;
  /** 講座サイトの見出しの横に出すリンク（関連する講座など）。GitHub へのリンクは chalkfile.config.ts から足す */
  links?: { label: string; url: string }[];
  /** 動画と講座サイトのテーマ（content/themes.ts の id）。省略すると Chalkfile の既定のテーマ */
  theme?: string;
  /** 動画のはじめと終わり、サイトの見出しの下に出す注意書き（実在の会社や製品を扱う講座では「非公式」と書く） */
  disclaimer?: string;
  /** 掛け合いの講座の配役（声ごとの名前と色）。字幕の帯と、サイトの台本・字幕に名前を付ける */
  cast?: Partial<Record<VoiceId, { name: string; tone: Tone }>>;
  /** 1 本の動画の呼び名（動画の見出しとサイトに出す）。既定は LECTURE。章立ての講座は CHAPTER */
  unitLabel?: 'LECTURE' | 'CHAPTER';
  /** 1 本だけで完結する解説動画。動画に番号（オープニングの 01 と 01 / 1、見出しの上の LECTURE 01、クイズの 1 / 1、終わりの 1 / 1 完了）を出さない */
  standalone?: boolean;
  /** 講座の設計（全体の目次・到達目標・動画構成）。まだ作っていない章もサイトのカリキュラムに「準備中」で出る */
  syllabus?: Syllabus;
  /** 出典の一覧（教材と台本から id で引く） */
  sources?: Source[];
  /** サイトの言葉を講座に合わせる */
  ui?: {
    /** 概要タブの要点の見出し（既定: 実装に効くメモ） */
    takeaways?: string;
    /** 出典タブの名前（既定: 公式ドキュメント） */
    docs?: string;
    /** 台本の検索欄の例 */
    searchHint?: string;
  };
};

/** 台本に書く形の講座（動画の at に台詞の id も書ける）。id で at を書く動画を入れる講座は、この型にする。読み込むと Course になる */
export type AuthoredCourse = Course<At>;

/**
 * 動画 1 本（レクチャー × 言語）。key は日本語なら S01、ほかは S01.en（engine/core/i18n.ts の videoKey）。
 * 訳の動画の lecture と course は、訳を重ねたもの（その言語の講座）。一覧は content/index.ts の VIDEOS
 */
export type Video = { key: string; lang: Lang; lecture: Lecture; course: Course };

/** 本文の書体。並べた順に使う（英字用の書体を先に置くと、英字だけその書体になる）。noto-sc は中国語（簡体字）の講座で日本語の書体の代わりに使う */
export type FontKey = 'zen-maru' | 'noto' | 'inter' | 'noto-sc';

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
  /**
   * 暗い地（scheme が dark）の面と線の色。暗い地のテーマには必ず書く。明るい地は color から作るので書かない。
   * 地の暗さと色みで合う値が違うので、テーマごとに決める（NIGHT は最初の版の値）。CSS の色（#RRGGBB か rgba()）で書く
   */
  dark?: DarkSurfaces;
};

/** 暗い地の面と線（Theme の dark） */
export type DarkSurfaces = {
  /** カードの面（上と下）。地に白を薄く重ねる */
  glass: string;
  glass2: string;
  /** 図の上に重ねる札の面（矢印の文字・クイズの判定・比べるの結論） */
  overlay: string;
  /** 色の付かない矢印・線 */
  edge: string;
  /** 縦の補助線（やりとりの図） */
  lane: string;
  /** 進み具合の溝 */
  track: string;
  /** タイトルの後ろを横切る薄い光 */
  sheen: string;
  /** ごく薄い面（始まりの状態・選ばれていない丸） */
  faint: string;
  /** 図の色（tone の main）の上に乗せる文字 */
  onTone: string;
};
