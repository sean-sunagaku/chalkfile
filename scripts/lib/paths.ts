// リポジトリ（作業フォルダ）の置き場所。道具ごとに書いていた ROOT を、ここ 1 か所にする。
// Node で動かす道具（scripts/stills.ts）も読むので、node: のモジュールだけを使う
import path from 'node:path';

/** リポジトリ（作業フォルダ）の最上位 */
export const ROOT = path.resolve(import.meta.dirname, '../..');
