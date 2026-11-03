// 講座サイトの組み立ての設定: 置き場所・サイトの URL・出す言語・ポスターの場所・一覧のページの最初の画面に出す台本の抜き出し。
// site/config.json の形と読み方・安全のための確かめ（siteProblems）は scripts/validate.ts にある（PR の CI の npm run validate と同じもの）
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { CourseModule, HeroSnippet } from '../../content/course-module';
import { isLang, LANGS, type Lang } from '../../content/i18n';
import type { Course } from '../../content/types';
import { posterFile } from '../../engine/core/generated';
import type { SiteConfig } from '../validate';

/** リポジトリの直下 */
export const ROOT = path.resolve(import.meta.dir, '../..');
/** サイトの部品（template.html・home.html・offline-*.ts・assets/・config.json） */
export const SITE_DIR = path.join(ROOT, 'site');

/** サイトの URL（site/config.json の baseUrl。/ で終える。SW の scope と同じ） */
export const siteBase = (config: SiteConfig): string =>
  config.baseUrl.endsWith('/') ? config.baseUrl : `${config.baseUrl}/`;

/** サイトに出す言語。SITE_LANGS（a,b）で絞る。無ければ site/config.json の publishLangs。未公開の言語と、ja の無い組は止める */
export const siteLangs = (env: string | undefined, config: SiteConfig): Lang[] => {
  const v = env?.trim() || config.publishLangs.join(',');
  if (!v) return [...LANGS];
  const ls = v.split(',').map((x) => x.trim());
  for (const l of ls) if (!isLang(l)) throw new Error(`SITE_LANGS は ${LANGS.join(',')} から選ぶ: ${l}`);
  for (const l of ls) if (!config.publishLangs.includes(l as Lang)) throw new Error(`未公開の言語はビルドしない: ${l}`);
  if (!ls.includes('ja')) throw new Error('SITE_LANGS には ja（一覧と日本語の講座）を入れる');
  return LANGS.filter((l) => ls.includes(l));
};

/** 本物の講座のポスター。講座のフォルダ（content/<講座>/generated/posters/<key>.jpg）から。無ければ書き出したばかりの site/media/<key>.jpg */
export const realPosterOf = (courseId: string, key: string): string =>
  existsSync(path.join(ROOT, posterFile(courseId, key)))
    ? path.join(ROOT, posterFile(courseId, key))
    : path.join(SITE_DIR, 'media', `${key}.jpg`);

/** 一覧のページの最初の画面に出す台本の抜き出し。並び（courses の順）で最初の、heroSnippet のある講座のもの */
export const heroSnippetOf = (courses: readonly Course[], modules: readonly CourseModule[]): HeroSnippet => {
  for (const c of courses) {
    const snippet = modules.find((m) => m.course.id === c.id)?.heroSnippet;
    if (snippet) return snippet;
  }
  throw new Error(
    '一覧のページの最初の画面に出す台本の抜き出しが、どの講座にも無い（講座のフォルダの index.ts の heroSnippet）',
  );
};
