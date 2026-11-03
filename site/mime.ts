// 拡張子と MIME の対応表。正本はここだけ。値は、Workers の静的 assets が返す Content-Type の本体（; の前）と同じにする。
// SW は、起動用ファイルと保存するファイルを取るとき、応答の Content-Type を manifest の型と照らし合わせ、違えば取らない
// （起動用ファイルが 1 つでも取れないと、新しい SW の install が全員で止まる）。
//   組み立て（scripts/site/assets.ts・scripts/pwa.ts）: 起動用ファイル（site/assets・アイコン・manifest・講座のサムネイル）の型を、ここから付ける。
//     知らない拡張子なら止める（mimeOf）
//   組み立ての最後（scripts/site-invariants.ts）: 起動用ファイルと保存するファイルの型が、ここと合うか
//   手元の配信（scripts/serve.ts）・テストのサーバー（tests/browser-server.ts）: 応答の Content-Type（contentTypeOf・mimeTypeOf）
// 足すときは、Workers が返す型を確かめてから足す。ほかのファイルを import しない（SW にも入れられるように）

export const MIME: Readonly<Record<string, string>> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.vtt': 'text/vtt',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
};

/** ファイルの名前か URL のパスの拡張子（小文字。. から）。無ければ '' */
const extOf = (name: string) => /\.[^./\\]+$/.exec(name.split(/[?#]/)[0])?.[0].toLowerCase() ?? '';

/** MIME（; の前の本体）。知らない拡張子なら undefined */
export const mimeTypeOf = (name: string): string | undefined => {
  const ext = extOf(name);
  return Object.hasOwn(MIME, ext) ? MIME[ext] : undefined;
};

/** MIME。知らない拡張子なら止める（組み立てで、違う型を付けて SW の install を壊さないため） */
export const mimeOf = (name: string): string => {
  const type = mimeTypeOf(name);
  if (!type)
    throw new Error(`知らない拡張子のファイル: ${name}（site/mime.ts の MIME に、Workers が返す型を確かめてから足す）`);
  return type;
};

/** 応答の Content-Type。文字のファイル（text/*）には charset=utf-8 を付ける。知らない拡張子なら undefined */
export const contentTypeOf = (name: string): string | undefined => {
  const type = mimeTypeOf(name);
  return type?.startsWith('text/') ? `${type}; charset=utf-8` : type;
};
