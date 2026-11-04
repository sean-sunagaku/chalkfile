// 公開物と保存の大きさの上限。正本はここだけで、ほかのファイルと文書は、この名前で読む・書く。
//   保存（PWA）: site/offline-shared.ts の validateManifest（sw.js が保存の前に確かめる）
//   動画の一覧: site/media-shared.ts の validateMediaManifest（Worker の許可リストにもなる）・scripts/media.ts（push と check）
//   組み立て: scripts/build_site.ts の最後の scripts/site-invariants.ts・scripts/check_delivery.ts
//   書き出し: scripts/scripts/stages/video/render.ts（サイト用の動画の目安。bun で、このファイルだけを読む）
// ほかのファイルを import しない（scripts/stages/video/render.ts が bun -e でこのファイルだけを読む。sw.js と Worker にも入る）。
// 値を変えるとき
//   - 保存の上限（OFFLINE_*）を厳しくすると、利用者が保存した講座が読めなくなる（tests/offline-compat.test.ts が落ちる）。緩める方向だけにする
//   - 外のサービスの上限（Workers・Releases）は、今使っている無料の枠の値。変わったら、公式の文書で確かめてから直す
//   - 数は「この値まで」（超えたら止める）。tests/limits.test.ts が、境目の値で各ファイルの確かめ方と合うかを見る

const MiB = 1024 * 1024;
const GiB = 1024 * MiB;

/* ───────────── 保存（PWA）。利用者が講座を保存するとき、SW が確かめる ───────────── */

/** 保存する 1 ファイル（動画・ポスター・ページ）の上限。動画がこれを超えると、その講座は保存できない */
export const OFFLINE_FILE_MAX_BYTES = 32 * MiB;
/** 保存する講座のページ（HTML）の上限 */
export const OFFLINE_PAGE_MAX_BYTES = 4 * MiB;
/** 1 講座の保存の合計（ページ・動画・ポスター・字幕版）の上限 */
export const OFFLINE_COURSE_MAX_BYTES = 1 * GiB;
/** 1 講座の保存のファイルの数の上限（ページ 1 つと、レクチャーごとの動画・ポスター・字幕版） */
export const OFFLINE_COURSE_MAX_FILES = 201;

/* ───────────── 動画（GitHub Releases と、/media/ の許可リスト） ───────────── */

/** サイト用の動画の大きさの目安（14,500 KiB）。scripts/stages/video/render.ts が crf を上げて合わせ、crf 29 でも超えたら警告だけを出す（上限ではない） */
export const VIDEO_TARGET_BYTES = 14500 * 1024;
/** 動画 1 本（Releases の asset 1 つ）の上限。GitHub Releases の 1 ファイルは 2 GiB 未満 */
export const RELEASE_ASSET_MAX_BYTES = 2 * GiB - 1;
/** 1 つの Release に置ける asset の数の上限 */
export const RELEASE_MAX_ASSETS = 1000;
/** 全講座の動画の一覧（講座ごとの content/<講座>/generated/media.<言語>.json をつないだもの）の項目（retained も含む）の数の上限。Worker の許可リストに全部入る */
export const MEDIA_LIST_MAX_ENTRIES = 20000;

/* ───────────── Workers の静的 assets（site/dist。Workers Free） ───────────── */

/** 1 ファイルの上限 */
export const WORKERS_ASSET_MAX_BYTES = 25 * MiB;
/** ファイルの数の上限 */
export const WORKERS_MAX_ASSETS = 20000;
