// 講座サイトの設定（site/config.json）を、型を付けて読む。形の確かめは scripts/validate.ts の siteProblems
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Lang } from '../../content/i18n';
import { ROOT } from './paths';

/**
 * site/config.json。publishLangs: 公開する言語（synth・サイトの既定の対象）。
 * media: 訳の言語の動画を置くサイト（url はサイトの URL、repo はそのサイトのリポジトリ）
 */
export type SiteConfig = {
  series: string;
  seriesSub: string;
  baseUrl: string;
  repoUrl: string;
  publishLangs: Lang[];
  media?: Partial<Record<Lang, { url: string; repo: string }>>;
};

export const readSiteConfig = (root = ROOT): SiteConfig =>
  JSON.parse(readFileSync(path.join(root, 'site/config.json'), 'utf8')) as SiteConfig;
