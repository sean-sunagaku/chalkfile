// 組み立てたものを書き出す: 前の組み立ての片付け・講座のフォルダ（ページ・ポスター・保存の manifest）・書き出したファイルの一覧
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { LANG_INFO, LANGS, type Lang } from '../../content/i18n';
import type { CourseManifest } from '../../site/offline-shared';
import { place } from './assets';
import type { PosterFile } from './offline-manifest';

/**
 * 前の組み立てを片付ける。全部の講座を組み立てるときは outDir を丸ごと消す（以前の MP4 や、公開をやめたページを残さない。元の動画には触れない）。
 * 訳の言語のページは、出さない言語なら消し、全部の講座を組み立てるときは作り直す
 * （outDir は丸ごと公開するので、残っていると出てしまう。訳をやめた講座も残さない）
 */
export const cleanOutput = (o: { outDir: string; langs: readonly Lang[]; partial: boolean }) => {
  if (!o.partial) rmSync(o.outDir, { recursive: true, force: true });
  for (const l of LANGS) {
    if (!LANG_INFO[l].path || (o.langs.includes(l) && o.partial)) continue;
    rmSync(path.join(o.outDir, LANG_INFO[l].path), { recursive: true, force: true });
  }
};

/**
 * 講座のフォルダ（<outDir>/<講座>/）を書く: ページ（index.html）・ポスター（media/。動画は Worker が /media/ で配るので置かない）・
 * 保存の manifest（全部のポスターがそろったときだけ。一部だけの公開や、欠けた生成物を「全講座保存」として案内しない）
 */
export const writeCourse = (o: {
  outDir: string;
  cid: string;
  page: Uint8Array;
  posters: PosterFile[];
  manifest: CourseManifest | null;
}) => {
  const out = path.join(o.outDir, o.cid);
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, 'index.html'), o.page);
  const mediaOut = path.join(out, 'media');
  rmSync(mediaOut, { recursive: true, force: true });
  mkdirSync(mediaOut, { recursive: true });
  for (const f of o.posters) place(f.from, path.join(mediaOut, f.file));
  const manifestPath = path.join(out, 'offline-manifest.json');
  rmSync(manifestPath, { force: true });
  if (o.manifest) writeFileSync(manifestPath, JSON.stringify(o.manifest));
};

/** 書き出したファイル（outDir からの場所と大きさ。隠しファイルも） */
export const listOutput = (outDir: string): { name: string; bytes: number }[] => {
  const emitted: { name: string; bytes: number }[] = [];
  const inspect = (dir: string) => {
    for (const file of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, file.name);
      if (file.isDirectory()) inspect(full);
      else emitted.push({ name: path.relative(outDir, full), bytes: statSync(full).size });
    }
  };
  inspect(outDir);
  return emitted;
};
