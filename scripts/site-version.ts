// 講座のページの版（pageVersion）を、組み立てた出力から決める（サイトの組み立ての scripts/site/build.ts が使う）。
// 版が変わると、保存した人に「新しい版」が出て、更新して保存すると講座の動画を全部取り直す。そのため版は、利用者に届くもの
// （ページの HTML と、保存の manifest に入るファイル）だけから計算する。組み立てるスクリプトのソースは入れない
// （コメント・整形・関数の切り出しのように、出力の変わらない直しでは版を変えない）。
//
// 順番
//   1. 版の印 PAGE_VERSION_MARK を入れたまま、ページを描く（CSP まで）。ポスターの ?v= も印のまま
//   2. pageVersionOf で、描いたページと、保存の manifest に入るファイル（動画とポスター）から版を計算する
//   3. stampVersion で印を版に置き換える。offline-manifest.json に入るページの sha256・revision・bytes は、置き換えた後の最終のページから計算する
import type { Asset } from '../site/offline-shared';
import { hash } from './pwa';

/** 版の印。ページの版の値・ポスターの ?v= と、保存の manifest のポスターの URL に入れておき、版が決まったら置き換える */
export const PAGE_VERSION_MARK = '__PAGE_VERSION__';

export type PageVersionInput = {
  /** 版の印を入れたまま描いた講座のページ（CSP の meta まで入れた、公開するのと同じ形）。講座の ID と名前もここに入る */
  html: string;
  /** 保存の manifest（offline-manifest.json）に入る、ページのほかのファイル（動画とポスター。並びも manifest と同じ）。ポスターの URL の ?v= は印のまま */
  files: Asset[];
};

/** 講座のページの版（sha256 の 16 進 64 字）。入力が同じなら同じ版。ページの 1 字・ファイルの URL・大きさ・sha256 のどれかが変われば別の版 */
export const pageVersionOf = ({ html, files }: PageVersionInput): string => hash(JSON.stringify({ html, files }));

/** 版の印を、決まった版に置き換える（ページの HTML と、保存の manifest のポスターの URL） */
export const stampVersion = (text: string, version: string): string => text.replaceAll(PAGE_VERSION_MARK, version);
