// 講座サイトの設定（site/config.json）を、型を付けて読む。形の確かめは scripts/validate.ts の siteProblems
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Lang } from '../../content/i18n';
import { ROOT } from './paths';

/**
 * site/config.json。publishLangs: 公開する言語（synth・サイトの既定の対象）。
 * 動画はどの言語も、同じ origin の /media/<言語>/<講座>/ で配る（Worker が Releases から中継する）ので、ここには書かない
 */
export type SiteConfig = {
  series: string;
  seriesSub: string;
  baseUrl: string;
  repoUrl: string;
  publishLangs: Lang[];
};

export const readSiteConfig = (root = ROOT): SiteConfig =>
  JSON.parse(readFileSync(path.join(root, 'site/config.json'), 'utf8')) as SiteConfig;
