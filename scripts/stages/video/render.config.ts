// 動画の書き出しの設定（Remotion の並列の数・音なしの映像・サイト用と配る用の動画・ポスター）を 1 か所に持つ。
// 書き出しの道具（scripts/stages/video/render.ts）と、Remotion Studio の設定（remotion.config.ts）がここを読む。
// 画面の大きさ・フレームの速さは動画の値（src/video.config.ts）、サイト用の動画の大きさの目安と保存の上限は site/limits.ts が正本。
// 値を変えると、書き出す動画のバイト列が変わる（crf・品質・秒を変えると見た目も）。全部の書き出し直しと Releases への置き直しになるので、
// 見た目の更新とまとめて出す。描き方の側の指紋（scripts/stages/video/inputs.ts の RENDER_CODE）に、このファイルも入っている。
// Remotion の設定（esbuild がまとめる）からも読むので、node: のモジュールを import しない

export const RENDER = {
  /** Remotion の並列の数（既定）。この機械の CPU の数のほうが少なければ、その数にする（Remotion は CPU の数より多い数を受け取らない） */
  concurrency: 8,
  /** 音なしの高画質の映像（out/master/<key>.mp4）。サイト用・配る用の動画とポスターは、ここから作る */
  master: { codec: 'h264', crf: 16, imageFormat: 'jpeg', jpegQuality: 92 },
  /**
   * サイト用の動画（site/media/<key>.mp4・字幕版の <key>.cc.mp4）。大きさの目安（site/limits.ts の VIDEO_TARGET_BYTES）以下になるまで、
   * crf を first から step ずつ上げ、max で止める（max でも超えたら、警告して使う）。longSec より長い動画は、小さい crf では目安に
   * 近づかないので long から試す（これまで 6 分より長い動画は crf 27 か 29 でしか目安に近づかなかった）
   */
  site: {
    crf: { first: 21, long: 27, step: 2, max: 29 },
    longSec: 360,
    preset: 'slow',
    maxrate: '2000k',
    bufsize: '4000k',
    gop: 150,
    audioBitrate: '128k',
  },
  /** 字幕を焼き込んだ配る用の動画（out/captioned/<key>.mp4。講座サイトの外で、音なしでも見られる版） */
  captioned: { crf: 20, preset: 'slow', gop: 150, audioBitrate: '160k' },
  /** サイト用と配る用の動画の音（ミックスの音を AAC にする） */
  audio: { codec: 'aac', sampleRate: 48000 },
  /** ポスター（動画の始まり近くの静止画。動画の表紙と一覧のカード）。撮る秒・幅・JPEG の品質（ffmpeg の -q:v。小さいほど高い） */
  poster: { atSec: 4.2, width: 1280, quality: 3 },
} as const;

/** 並列の数の既定（RENDER.concurrency と CPU の数の、小さいほう。1 より小さくしない） */
export const defaultConcurrency = (cpus: number): number => Math.max(1, Math.min(RENDER.concurrency, Math.floor(cpus)));
