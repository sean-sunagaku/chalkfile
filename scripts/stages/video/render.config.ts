// 動画の書き出しの設定（Remotion の並列の数・音なしの映像・サイト用と配る用の動画・ポスター）を 1 か所に持つ。
// 書き出しの道具（scripts/stages/video/render.ts）と、Remotion Studio の設定（remotion.config.ts）がここを読む。
// 画面の大きさ・フレームの速さは動画の値（src/video.config.ts）、サイト用の動画の大きさの目安と保存の上限は site/limits.ts が正本。
// 値を変えると、書き出す動画のバイト列が変わる（crf・品質・秒を変えると見た目も）。全部の書き出し直しと Releases への置き直しになるので、
// 見た目の更新とまとめて出す。描き方の側の指紋（scripts/stages/video/inputs.ts の RENDER_CODE）に、このファイルも入っている。
// Remotion の設定（esbuild がまとめる）からも読むので、node: のモジュールを import しない

import config from '../../../chalkfile.config';
export const RENDER = config.render;

/** 並列の数の既定（RENDER.concurrency と CPU の数の、小さいほう。1 より小さくしない） */
export const defaultConcurrency = (cpus: number): number => Math.max(1, Math.min(RENDER.concurrency, Math.floor(cpus)));
