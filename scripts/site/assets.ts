// 静的なファイルを写す: 一覧ページの画像（site/assets）と、講座のポスター。同じディスクならハードリンク（容量を食わない）、だめならコピー。
// 写した一覧ページの画像と講座のサムネイルは、SW の起動用ファイル（install のときに全部取る）にする
import { copyFileSync, existsSync, linkSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { mimeOf } from '../../site/mime';
import type { Asset } from '../../site/offline-shared';
import { asset } from '../pwa';

/** 同じディスクならハードリンク、だめならコピー */
export const place = (from: string, to: string) => {
  try {
    linkSync(from, to);
  } catch {
    copyFileSync(from, to);
  }
};

/** 名前の順（文字コードの順。ロケールとファイルシステムに左右されない） */
const byName = (a: { name: string }, b: { name: string }) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

/**
 * フォルダを写し、写したファイルを起動用ファイルとして返す。型は拡張子の対応表（site/mime.ts）から付け、知らない拡張子なら止める
 * （SW は起動用ファイルの型を、配信の Content-Type と照らし合わせる。違うと、全員の新しい SW の install が止まる）。
 * 名前を変えた画像が残らないように、写す前に消す。並びは名前の順にする（起動用ファイルの一覧は sw.js に入るので、
 * フォルダを読む順が違う手元の macOS と CI の Linux でも、同じ sw.js にする）
 */
export const copyAssets = (from: string, to: string, dist: string): Asset[] => {
  const shell: Asset[] = [];
  const copyDir = (a: string, b: string) => {
    mkdirSync(b, { recursive: true });
    for (const e of readdirSync(a, { withFileTypes: true }).sort(byName)) {
      const src = path.join(a, e.name);
      const dst = path.join(b, e.name);
      if (e.isDirectory()) copyDir(src, dst);
      else {
        rmSync(dst, { force: true });
        place(src, dst);
        shell.push(asset(path.relative(dist, dst).split(path.sep).join('/'), readFileSync(dst), mimeOf(dst)));
      }
    }
  };
  rmSync(to, { recursive: true, force: true });
  if (existsSync(from)) copyDir(from, to);
  return shell;
};

/**
 * 一覧のページに出す、講座のサムネイル（日本語の講座の最初の動画のポスター。posters はサイトの最上位からの URL で、?v= の版が付く）。
 * 置いてあるものだけを、小さな起動用ファイルにする（URL は一覧のページが読むのと同じ ?v= 付き。SW は query まで合わせて返す）。
 * 訳の講座のサムネイルは入れない（起動用ファイルが 1 つでも取れないと、SW の install 全体が止まるので、訳の講座の反映が遅れても、
 * 講座サイトの更新が止まらないようにする）
 */
export const thumbnailAssets = (dist: string, posters: string[]): Asset[] =>
  posters.flatMap((url) => {
    const local = path.join(dist, url.split('?')[0]!);
    return existsSync(local) ? [asset(url, readFileSync(local), mimeOf(url))] : [];
  });
