// 講座サイトを組み立てる（本物の講座）。Workers の静的 assets にそのまま置けるファイルを site/dist に書く。
//   bun scripts/build_site.ts                  # 全講座（公開する全部の言語）と一覧ページ
//   bun scripts/build_site.ts stripe-billing   # 一部の講座だけ（一覧ページは毎回作る）
//   bun scripts/build_site.ts --strict         # 動画の一覧を Releases と照らし合わせ、動画かポスターが無いレクチャーがあれば止める（公開の CI が使う）
//   SITE_LANGS=ja bun scripts/build_site.ts    # その言語だけのサイトにする（site/config.json の publishLangs の中から選ぶ）
// 入力: content/（台本・訳・テーマ・一覧のページに出す台本の抜き出し heroSnippet）、site/data/<key>.json（synth.ts の出力）、
//       content/<講座>/generated/posters/<key>.jpg（render.sh が書くポスター。無ければ site/media/<key>.jpg）、
//       動画の一覧（講座ごとの content/<講座>/generated/media.<言語>.json。scripts/media.ts の readMediaManifest）、
//       site/template.html（講座のページ）、site/home.html（一覧のページ）、site/i18n.ts（サイトの決まった文字）、site/assets/、site/config.json
// 出力: site/dist/index.html と site/dist/<講座>/（日本語）、site/dist/<言語>/ と site/dist/<言語>/<講座>/（訳）。動画は入れない（Worker が /media/ で配る）
// 組み立ての本体は scripts/site/build.ts の buildSite（部品は scripts/site/。テストは合成の講座で呼ぶ）
import path from 'node:path';
import { coursesIn } from '../content';
import type { CourseModule } from '../content/course-module';
import * as REGISTRY from '../content/courses';
import { LANGS, type Lang } from '../content/i18n';
import type { Course } from '../content/types';
import { checkMedia, readMediaManifest } from './media';
import { buildSite } from './site/build';
import { heroSnippetOf, SITE_DIR, siteLangs } from './site/config';
import { readSiteConfig } from './validate';

if (import.meta.main) {
  const args = process.argv.slice(2);
  const strict = args.includes('--strict');
  try {
    const config = readSiteConfig();
    const langs = siteLangs(process.env.SITE_LANGS, config);
    const mediaManifest = readMediaManifest();
    if (strict) checkMedia(mediaManifest);
    const courses = Object.fromEntries(LANGS.map((l) => [l, coursesIn(l)])) as Record<Lang, Course[]>;
    await buildSite({
      courses,
      dataDir: path.join(SITE_DIR, 'data'),
      mediaManifest,
      outDir: path.join(SITE_DIR, 'dist'),
      langs,
      hero: heroSnippetOf(courses.ja, Object.values(REGISTRY) as CourseModule[]),
      strict,
      only: args.filter((a) => !a.startsWith('--')),
      config,
    });
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}
