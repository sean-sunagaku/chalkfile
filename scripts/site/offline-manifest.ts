// 講座の保存の manifest（<講座>/offline-manifest.json。形は site/offline-shared.ts の CourseManifest。SW の validateManifest が読む）。
// 版（pageVersion）は、版の印を入れたまま描いたページと、ここで並べるファイル（動画・ポスター・字幕版）から決める（scripts/site-version.ts）
import type { MediaEntry } from '../../site/media-shared';
import { mediaPath } from '../../site/media-shared';
import type { Asset, CourseManifest } from '../../site/offline-shared';
import { asset, hash } from '../pwa';
import { PAGE_VERSION_MARK, stampVersion } from '../site-version';

/** 動画（Worker が /media/ で配る。大きさと sha256 は動画の一覧のもの） */
export const videoAsset = (e: MediaEntry): Asset => ({
  url: mediaPath(e),
  bytes: e.bytes,
  sha256: e.sha256,
  type: 'video/mp4',
});

/** 講座のフォルダに置くポスター（講座の media/<key>.jpg） */
export type PosterFile = { file: string; from: string; data: Buffer; type: string };

/**
 * 保存の manifest に入る、ページのほかのファイル。レクチャーごとに、動画・ポスター・字幕を焼き込んだ版の順。
 * ポスターの URL の ?v= は版の印のまま（版を決めたあとで stampVersion で置き換える）
 */
export const pageFiles = (o: {
  cid: string;
  lectures: { id: string; key: string }[];
  posters: PosterFile[];
  video: (lecture: string, kind: MediaEntry['kind']) => MediaEntry | undefined;
}): Asset[] =>
  o.lectures.flatMap((lec) => {
    const poster = o.posters.find((f) => f.file === `${lec.key}.jpg`);
    const standard = o.video(lec.id, 'standard');
    if (!standard) throw new Error(`動画の一覧がありません: ${o.cid}/${lec.id}。先に bun scripts/media.ts push`);
    const cc = o.video(lec.id, 'captioned');
    return [
      videoAsset(standard),
      ...(poster ? [asset(`${o.cid}/media/${poster.file}?v=${PAGE_VERSION_MARK}`, poster.data, poster.type)] : []),
      ...(cc ? [videoAsset(cc)] : []),
    ];
  });

/** 保存の manifest。ページの sha256 と大きさは、版を差し込んだ最終のページから。ポスターの ?v= も版にする */
export const courseManifest = (o: {
  cid: string;
  title: string;
  page: Uint8Array;
  files: Asset[];
  pageVersion: string;
}): CourseManifest => {
  const saved = [
    asset(`${o.cid}/`, o.page, 'text/html'),
    ...o.files.map((f) => ({ ...f, url: stampVersion(f.url, o.pageVersion) })),
  ];
  return {
    schema: 1,
    id: o.cid,
    title: o.title,
    pageVersion: o.pageVersion,
    revision: hash(JSON.stringify(saved)),
    bytes: saved.reduce((sum, f) => sum + f.bytes, 0),
    files: saved,
  };
};
