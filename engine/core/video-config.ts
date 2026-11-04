// 動画の決まった値（大きさ・フレームの速さ・内容の枠・ジングルの「ドン」・台詞と画面の合わせ方・役割ごとの文字の大きさ・焼き込み字幕と見出しの文字）を 1 か所に持つ。
// 部品（src/。src/video.config.ts から読む）・台本の検証（engine/core/validate.ts）・timeline の時刻（engine/core/timeline.ts・scripts/synth.ts）がここを読む。
// React・Remotion・Node に依存しない純粋なデータ。
// Python（scripts/mix.py・scripts/build_music.py）が読む値は、npm run gen:video-config で scripts/audio/video_config.json に書き出す
// （JSON もコミットする。ここを変えたら書き出し直す。ずれていると tests/unit/video-config.test.ts が止める）
// 値を変えると、動画の見た目か音が変わる（全部の書き出し直しと再ダウンロードになるので、見た目を変える直しと 1 回にまとめて出す）

/** 画面の大きさ（px）と、1 秒のフレーム数 */
export const VIDEO = { width: 1920, height: 1080, fps: 30 } as const;

/** 内容の枠。左右の余白と、場面の見出しの下から下の出典・注意書きの上までの、上の端と下の端（px） */
export const CONTENT = { pad: 96, top: 228, bottom: 1000 } as const;

/** 秒をフレームに（丸める） */
export const frames = (sec: number) => Math.round(sec * VIDEO.fps);

/**
 * 冒頭のジングル（scripts/build_music.py の sting_intro）。introHitSec は「ドン」が鳴る秒。
 * タイトルの番号と題はこの時刻に出て、呼び込みの声はこの 0.05 秒あと（scripts/synth.ts）、ジングルはこのあと小さくする（scripts/mix.py）
 */
export const STING = { introHitSec: 2.0 } as const;

/** 台詞より先に動き出すフレーム数（台詞の頭より少し前から動かすと、声と画面がそろって見える） */
export const LEAD = {
  /** 要素が出る・今の台詞の項目と focus を光らせる・コードの光る行と注・スマホの画面・端末の行 */
  appear: 4,
  /** 矢印を引き始める・クイズの答えを出す */
  draw: 2,
  /** コードの全体を出す（code の showAt） */
  code: 6,
  /** 焼き込み字幕を出す・次の台詞の手前で消す */
  caption: 3,
} as const;

/* ───────────── 文字の大きさ ─────────────
 * 文字の大きさは役割で決める。部品は数を直接書かずに TYPE から選び（tests/unit/type.test.ts が、部品に数を直接書いていないことを見る）、
 * 幅に合わせて縮める文字も、役割の下限（TYPE_MIN）より小さくしない（src/components/fit.ts の fitSize）。大きさは 1920×1080 の画面の上の px
 * （焼き込み字幕の版は、場面ごと CAPTION.scale に縮める）。下限を変えるときは、全部の動画の静止画を見る
 */

/** 役割ごとの下限（px） */
export const TYPE_MIN = {
  /** 大きな数字と文字（番号・大きな一文・数え上げる数） */
  display: 40,
  /** 題（見出し・カードの題・問い） */
  title: 30,
  /** 本文（カード・一覧・説明・注・表・字幕） */
  body: 26,
  /** 札と図の文字（矢印の札・図の補足・番号・丸の中の数・題の上の小さな札） */
  label: 22,
  /** 画面の端の文字（レクチャーの番号・講座名・出典・注意書き・クレジット） */
  meta: 22,
  /** コードと端末（行が多いと、枠に収まるまで縮める） */
  code: 20,
  /** 画面の図の中の文字（架空のアプリの画面。図ごと拡大して描くので、ここだけ小さい） */
  mock: 14,
} as const;

export type TypeRole = keyof typeof TYPE_MIN;

/** 役割ごとの文字の大きさ（px） */
export const TYPE = {
  display: {
    /** オープニングの大きな番号 */
    openingNo: 330,
    /** オープニングの題（2 行の題の 1 行目は lead） */
    openingTitle: 96,
    openingTitleLead: 104,
    /** クイズの番号（Q1）と、答えの ○ × */
    quizNo: 150,
    quizStamp: 150,
    /** クイズの考える時間の数 */
    quizCountdown: 64,
    /** エンディングの次の動画の番号と、最後の動画の「おつかれさまでした」 */
    endingNo: 120,
    endingDone: 110,
    /** 大きな一文（長い文は statementLong） */
    statement: 88,
    statementLong: 70,
    /** 数え上げる数（計算の記号・数・単位。合計の行は total） */
    numberOp: 60,
    numberValue: 72,
    numberUnit: 40,
    numberTotal: 104,
    numberTotalUnit: 52,
    /** 要点のカードの番号（2 段のときは compact） */
    pointNo: 64,
    pointNoCompact: 52,
  },
  title: {
    /** 場面の見出し（HEADING。幅に合わせて HEADING.minSize まで縮める） */
    heading: 60,
    /** オープニングの副題 */
    subtitle: 36,
    /** エンディングの次の動画の題と、最後の動画の結びの文 */
    nextTitle: 64,
    closing: 42,
    goal: 50,
    recap: 44,
    pointTitle: 42,
    pointTitleCompact: 36,
    /** 用語のカードの英語の名前 */
    conceptTerm: 36,
    compareTitle: 44,
    /** 比べたあとの結論 */
    verdict: 36,
    question: 54,
    refTitle: 44,
    /** スマホの画面の流れの、今の段と、ほかの段 */
    phoneStep: 42,
    phoneStepDim: 34,
    timelineTitle: 38,
    timelineTitleNarrow: 32,
  },
  body: {
    /** 焼き込み字幕（CAPTION。2 行に入らないときは CAPTION.minSize まで縮める） */
    caption: 38,
    bigKicker: 32,
    bigSub: 36,
    compareItem: 33,
    pointBody: 29,
    pointBodyCompact: 26,
    conceptDesc: 26,
    quizExplain: 40,
    numberLabel: 38,
    numberTotalLabel: 44,
    numberFootnote: 26,
    refNote: 30,
    phoneCaption: 28,
    timelineDetail: 27,
    timelineDetailNarrow: 26,
    /** 表の中身（台本の fontSize で変えられる） */
    table: 30,
    /** コードの光る行の注と、端末の注 */
    codeNote: 30,
    terminalNote: 26,
    /** 画面の図の注（1 枚・スマホ 2 台・ブラウザ 2 枚） */
    screenNote: 32,
    screenNotePhones: 28,
    screenNoteBrowsers: 27,
  },
  label: {
    /** 見出しの横の根拠の札（HEADING.chipSize） */
    chip: 22,
    /** 札（Pill）。既定・オープニングの節・クイズの答え・画面の図の名前・時間の流れ・状態の札 */
    pill: 22,
    pillSection: 26,
    pillAnswer: 30,
    pillScreen: 24,
    pillTimeline: 22,
    pillBadge: 22,
    /** 用語のカードの日本語の名前 */
    conceptReading: 25,
    compareSub: 24,
    goalNo: 24,
    recapNo: 34,
    quizTotal: 26,
    quizThink: 30,
    /** 矢印の札・囲みの名前 */
    edge: 22,
    group: 22,
    /** やりとりの図の矢印の札・登場人物の名前と補足 */
    step: 25,
    actorLabel: 32,
    actorSub: 22,
    /** 流れの図の箱の名前（等幅は mono）と補足 */
    nodeLabel: 32,
    nodeLabelMono: 28,
    nodeSub: 22,
    /** 状態の図の状態の名前（始まりは start）と読み */
    stateCode: 29,
    stateStart: 30,
    stateReading: 22,
    timelineKicker: 22,
    tableHead: 24,
    refUrl: 25,
    phoneStepNo: 26,
    /** 掛け合いの講座の字幕の名前札（CAPTION.nameSize） */
    captionName: 28,
    /** 画面の図の注の番号（丸の中の数） */
    noteDot: 22,
    /** コードと端末の窓の題 */
    windowTitle: 22,
    endingNext: 28,
  },
  meta: {
    courseMark: 22,
    lectureLabel: 22,
    cite: 22,
    caution: 22,
    openingUnit: 22,
    disclaimer: 22,
    endingProgress: 24,
    credits: 22,
  },
  code: {
    /** コード（台本の fontSize で変えられる。行が多いと枠に収まるまで縮める） */
    code: 26,
    terminal: 23,
  },
  mock: {
    /** 画面の図（架空のアプリ。図ごと拡大する前の大きさ） */
    title: 28,
    text: 19,
    textSmall: 15,
    label: 18,
    field: 18,
    required: 14,
    error: 16,
    hint: 15,
    button: 19,
    link: 18,
    linkWeak: 15,
    alert: 17,
    check: 17,
    checkWeak: 14,
    step: 15,
    stepNo: 14,
    list: 17,
    listWeak: 15,
    badge: 14,
    sub: 15,
    /** 窓の題（ブラウザのアドレスの欄・スマホの上の題） */
    browserBar: 14,
    phoneBar: 16,
    /** スマホの画面の流れの、架空のアプリの画面 */
    appBrand: 25,
    appBrandSub: 17,
    appTitle: 29,
    appLead: 20,
    appBody: 20,
    appButton: 21,
    appLink: 20,
  },
} as const satisfies { readonly [R in TypeRole]: Readonly<Record<string, number>> };

/**
 * 焼き込み字幕（src/Lecture.tsx の Captions）。場面を scale に縮めて下に帯を空け、台詞をそのまま出す。
 * 帯の lines 行に入らない台詞は、minSize まで縮める（入るかは、描くときに折り返した行の数を測って決める）。
 * 文字の大きさ・字間・左右の余白・帯に入る行数・名前札は、台本の検証（engine/core/validate.ts）が字幕の行数を見積もるのにも使う
 */
export const CAPTION = {
  scale: 0.88,
  /** 台詞のあとに字幕を残す秒（次の台詞の手前までか、ここまで。台詞の後の短い間で、字幕をちらつかせない） */
  holdSec: 0.7,
  size: TYPE.body.caption,
  minSize: 30,
  spacing: 1,
  /** 帯の左右の余白（px） */
  sidePad: 120,
  /** 帯に入る行数と、台本の検証が文字の幅から行数を見積もるときに、1 行に詰められる割合（折り返しは文節や単語の切れ目で起きるので、行の端が空く） */
  lines: 2,
  fill: 0.9,
  /** 掛け合いの講座の名前札。文字の大きさ・左右の余白（片側）・札と文の間（px） */
  nameSize: TYPE.label.captionName,
  namePadX: 20,
  gap: 22,
} as const;

/**
 * 場面の見出し（src/components/chrome.tsx の Header）と、横の根拠の札。見出しは 1 行で、入らなければ minSize まで縮める。
 * 台本の検証が見出しの幅を見積もるのにも使う。chipPad は札の文字のほかの幅の見込み（左右の余白 12＋16・アイコン 22・アイコンと文字の間 10・枠 2×2 = 64）
 */
export const HEADING = {
  size: TYPE.title.heading,
  minSize: 44,
  spacing: 1,
  gap: 28,
  chipSize: TYPE.label.chip,
  chipSpacing: 1,
  chipPad: 64,
} as const;

/** Python（scripts/mix.py・scripts/build_music.py）が読む値。scripts/gen_video_config.ts が scripts/audio/video_config.json に書き出す */
export const PYTHON_CONFIG = {
  fps: VIDEO.fps,
  stingIntroHitSec: STING.introHitSec,
};
