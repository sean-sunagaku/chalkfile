// 動画の決まった値（大きさ・フレームの速さ・内容の枠・ジングルの「ドン」・台詞と画面の合わせ方・焼き込み字幕と見出しの文字）を 1 か所に持つ。
// 部品（src/）・台本の検証（engine/core/validate.ts）・声の時刻（scripts/synth.ts）がここを読む。React・Remotion に依存しない純粋なデータ。
// Python（scripts/mix.py・scripts/build_music.py）が読む値は、npm run gen:video-config で scripts/audio/video_config.json に書き出す
// （JSON もコミットする。ここを変えたら書き出し直す。ずれていると tests/video-config.test.ts が止める）
// 値を変えると、動画の見た目か音が変わる（全部の書き出し直しと再ダウンロードになるので、計画の 4-3 のとおり、まとめて出す）

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

/**
 * 焼き込み字幕（src/Lecture.tsx の Captions）。場面を scale に縮めて下に帯を空け、台詞をそのまま出す。
 * 文字の大きさ・字間・左右の余白・帯に入る行数・名前札は、台本の検証（engine/core/validate.ts）が字幕の行数を見積もるのにも使う
 */
export const CAPTION = {
  scale: 0.88,
  /** 台詞のあとに字幕を残す秒（次の台詞の手前までか、ここまで。台詞の後の短い間で、字幕をちらつかせない） */
  holdSec: 0.7,
  size: 38,
  spacing: 1,
  /** 帯の左右の余白（px） */
  sidePad: 120,
  /** 帯に入る行数 */
  lines: 2,
  /** 掛け合いの講座の名前札。文字の大きさ・左右の余白（片側）・札と文の間（px） */
  nameSize: 28,
  namePadX: 20,
  gap: 22,
} as const;

/**
 * 場面の見出し（src/components/chrome.tsx の Header）と、横の根拠の札。台本の検証が見出しの幅を見積もるのにも使う。
 * chipPad は札の文字のほかの幅の見込み（左右の余白 12＋16・アイコン 22・アイコンと文字の間 10・枠 2×2 = 64）
 */
export const HEADING = { size: 60, spacing: 1, gap: 28, chipSize: 22, chipSpacing: 1, chipPad: 64 } as const;

/** Python（scripts/mix.py・scripts/build_music.py）が読む値。scripts/gen_video_config.ts が scripts/audio/video_config.json に書き出す */
export const PYTHON_CONFIG = {
  fps: VIDEO.fps,
  stingIntroHitSec: STING.introHitSec,
};
