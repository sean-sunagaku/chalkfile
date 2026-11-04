// 講座サイトが使う設定。値の正本は chalkfile.config.ts。形の確かめは scripts/validate.ts の siteProblems。
import config from '../../chalkfile.config';
import type { Lang } from '../../content/i18n';

export type SiteConfig = {
  series: string;
  seriesSub: string;
  baseUrl: string;
  repoUrl: string;
  publishLangs: Lang[];
};

export const readSiteConfig = (): SiteConfig => ({
  series: config.series,
  seriesSub: config.seriesSub,
  baseUrl: config.origin,
  repoUrl: `https://github.com/${config.repository}`,
  publishLangs: [...config.publishLangs],
});
