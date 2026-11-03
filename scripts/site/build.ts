// 講座サイトを組み立てる本体（buildSite）。本物の講座は scripts/build_site.ts（CLI）が渡し、テストは合成の講座を渡す。
// 順番: 安全のための確かめ → 講座のページ（データ → 描く → CSP → 版 → 保存の manifest → 書く）→ 一覧のページ → 画像 → PWA（アイコン・
// 言語ごとの manifest・オフラインの案内・sw.js）→ ヘッダー・sitemap.xml と robots.txt・言語ごとの 404 → 公開物の決まりの確かめ（scripts/site-invariants.ts）
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { HeroSnippet } from '../../content/course-module';
import { LANG_INFO, LANGS, type Lang } from '../../content/i18n';
import { THEMES, themeOf } from '../../content/themes';
import type { Course } from '../../content/types';
import { posterFile } from '../../engine/core/generated';
import { DISABLED_REVISIONS } from '../../site/disabled-revisions';
import { courseText, homeText, LOCALES } from '../../site/i18n';
import { type MediaEntry, type MediaManifest, mediaKey } from '../../site/media-shared';
import { mimeOf } from '../../site/mime';
import { SITE_NEWS, type SiteNews } from '../../site/news';
import type { Asset, CourseManifest } from '../../site/offline-shared';
import { asset, buildPwa, bundle, hash } from '../pwa';
import { assertSiteInvariants } from '../site-invariants';
import { PAGE_VERSION_MARK, pageVersionOf, stampVersion } from '../site-version';
import { readSiteConfig, type SiteConfig, siteProblems } from '../validate';
import { copyAssets, thumbnailAssets } from './assets';
import { ROOT, realPosterOf, SITE_DIR, siteBase } from './config';
import { WWW_REDIRECT_SCRIPT } from './csp';
import { cleanOutput, listOutput, writeCourse } from './emit';
import { writeServingFiles } from './headers';
import { newsFor, newsProblems } from './news';
import { courseJson, homeCredits, lectureModels, minutesOf, type ReadData, type SiteData } from './model';
import { courseManifest, type PosterFile, pageFiles } from './offline-manifest';
import { type AppContext, appParts, textOf } from './parts';
import { renderCoursePage } from './render-course';
import { notFoundFile, renderNotFound } from './render-not-found';
import { robotsTxt, type SitemapPage, sitemapXml } from './seo';
import { homePosterOf, renderHomePage } from './render-home';

/** 組み立ての入力 */
export type BuildSiteOptions = {
  /** 言語ごとの講座（日本語は全部、訳の言語は訳のある講座だけ。content/index.ts の coursesIn と同じ並び） */
  courses: Readonly<Record<Lang, readonly Course[]>>;
  /** 講義のデータ（synth.ts が書く <動画の名前>.json）のフォルダ */
  dataDir: string;
  /** 動画の一覧（Worker の許可リストと同じもの。scripts/media.ts の readMediaManifest） */
  mediaManifest: MediaManifest;
  /** 書き出すフォルダ（site/dist） */
  outDir: string;
  /** サイトに出す言語（ja を含む） */
  langs: readonly Lang[];
  /** 一覧のページの最初の画面に出す台本の抜き出し（講座のフォルダの index.ts の heroSnippet） */
  hero: HeroSnippet;
  /** 動画かポスターが無いレクチャーがあれば、書き出したあとで止める */
  strict?: boolean;
  /** 組み立てる講座の ID（空なら全部。一覧のページは毎回作る） */
  only?: readonly string[];
  /** site/config.json の中身（既定は読む） */
  config?: SiteConfig;
  /** ポスターの置き場所（既定は本物の講座の置き場所。config.ts の realPosterOf） */
  posterOf?: (courseId: string, key: string) => string;
  /** 一覧のページの画像のフォルダ（既定は site/assets。写したものは全部、SW の起動用ファイルになる） */
  assetsDir?: string;
  /** 無効にした保存版の revision（既定は site/disabled-revisions.ts。sw.js の設定に入れる） */
  disabledRevisions?: readonly string[];
  /** 「新しい版」の案内に出す、何が変わったか（既定は site/news.ts。講座の保存用の教材情報の news に入れる） */
  news?: readonly SiteNews[];
  /** 進み具合の出力（既定は console.log）と注意（既定は console.warn） */
  log?: (line: string) => void;
  warn?: (line: string) => void;
};

/** 組み立ての結果 */
export type BuildSiteResult = {
  /** 書き出したファイル（outDir からの場所と大きさ） */
  files: { name: string; bytes: number }[];
  /** この組み立てで保存の manifest を作った講座（講座を指定したときは、その講座だけ） */
  manifests: CourseManifest[];
  /** sw.js に入れた、保存できる講座の ID（出す言語の全部の講座のうち、組み立てたサイトに保存の manifest があるもの） */
  courses: string[];
  /** まだ動画かポスターが無いもの */
  missing: string[];
};

/**
 * 無効にした保存版の一覧（site/disabled-revisions.ts）の誤り: revision の形（64 字の SHA-256）・重なり・今公開する版
 * （無効にすると、直した版を保存した人まで、オンラインでは保存版を開けなくなる）
 */
export const disabledRevisionProblems = (revisions: readonly string[], manifests: readonly CourseManifest[]): string[] => {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const r of revisions) {
    if (!/^[a-f0-9]{64}$/.test(r)) problems.push(`無効にした保存版の revision の形が違う（64 字の SHA-256）: ${r}`);
    else if (seen.has(r)) problems.push(`無効にした保存版の revision が重なっている: ${r}`);
    seen.add(r);
    const current = manifests.find((m) => m.revision === r);
    if (current) problems.push(`今公開する版を無効にしている（${current.id}）: ${r}。直した版を公開してから、前の版の revision を入れる`);
  }
  return problems;
};

/** 講座サイトを組み立てる（outDir を書き換える）。安全のための確かめ・公開物の決まりに通らなければ止める */
export async function buildSite(o: BuildSiteOptions): Promise<BuildSiteResult> {
  const log = o.log ?? console.log;
  const warn = o.warn ?? console.warn;
  const dist = o.outDir;
  const config = o.config ?? readSiteConfig();
  const base = siteBase(config);
  const langs: Lang[] = LANGS.filter((l) => o.langs.includes(l));
  const coursesIn = (lang: Lang): Course[] => [...o.courses[lang]];
  const only = o.only ?? [];

  // ID は URL とファイル名に使うので英数字だけ。リンクは https:// だけ（PR の CI の npm run validate も同じものを流す）。
  // 台本の中身の確かめ（注入・隠し文字・秘密情報）は scripts/check_content.ts が受け持つ
  const news = o.news ?? SITE_NEWS;
  const problems = [
    ...siteProblems(config, coursesIn),
    ...newsProblems(news, { root: ROOT, langs, courses: langs.flatMap((l) => coursesIn(l).map((c) => c.id)) }),
  ];
  if (problems.length) throw new Error(problems.join('\n'));

  // 講座のページの画面（site/course-page.ts）と保存の画面（site/offline-client.ts）は、Bun で 1 本ずつにまとめてページに入れる
  // （CSP のハッシュを先に計算する、信頼できるソース。保存版の HTML が 1 枚で完結する）
  const template = readFileSync(path.join(SITE_DIR, 'template.html'), 'utf8');
  const pageScript = await bundle(path.join(SITE_DIR, 'course-page.ts'));
  const home = readFileSync(path.join(SITE_DIR, 'home.html'), 'utf8');
  const offlineCss = readFileSync(path.join(SITE_DIR, 'offline.css'), 'utf8');
  const app: AppContext = {
    offlinePanel: readFileSync(path.join(SITE_DIR, 'offline-panel.html'), 'utf8'),
    offlineClient: await bundle(path.join(SITE_DIR, 'offline-client.ts')),
    themeColor: themeOf().color.bg,
    coursesIn,
    text: LOCALES,
  };
  const readData: ReadData = (key) => {
    const f = path.join(o.dataDir, `${key}.json`);
    return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as SiteData) : null;
  };
  const videos = new Map(o.mediaManifest.entries.map((e) => [mediaKey(e), e]));
  const posterOf = o.posterOf ?? realPosterOf;
  const assetsDir = o.assetsDir ?? path.join(SITE_DIR, 'assets');
  const missing: string[] = [];
  const manifests: CourseManifest[] = [];
  const shell: Asset[] = [];

  cleanOutput({ outDir: dist, langs, partial: only.length > 0 });

  /* ───────────── 講座のページ（言語ごと） ───────────── */
  for (const lang of langs) {
    const T = courseText(lang);
    const info = LANG_INFO[lang];
    for (const course of coursesIn(lang).filter((c) => !only.length || only.includes(c.id))) {
      const theme = themeOf(course.theme);
      const cid = `${info.path}${course.id}`;
      const video = (lecture: string, kind: MediaEntry['kind']) =>
        videos.get(mediaKey({ lang, course: course.id, lecture, kind }));
      const lectures = lectureModels(course, lang, T, readData);
      const minutes = minutesOf(course, lang, readData);
      const posters: PosterFile[] = [];
      for (const lec of lectures) {
        const from = posterOf(course.id, lec.key);
        if (existsSync(from))
          posters.push({ file: `${lec.key}.jpg`, from, data: readFileSync(from), type: mimeOf(`${lec.key}.jpg`) });
        else missing.push(posterFile(course.id, lec.key));
      }
      // 版は出力から決める（scripts/site-version.ts）。ページとポスターの ?v= には版の印を入れて描き、版が決まってから差し込む
      const json = courseJson({ course, lang, T, config, lectures, video });
      const html = renderCoursePage({
        template,
        pageScript,
        offlineClient: app.offlineClient,
        config,
        base,
        langs,
        coursesIn,
        lang,
        T,
        course,
        theme,
        root: lang === 'ja' ? '../' : '../../',
        lectures,
        minutes,
        app: appParts(app, lang, lang === 'ja' ? '../' : '../../', {
          id: cid,
          title: course.title,
          pageVersion: PAGE_VERSION_MARK,
        }),
        offlineCss,
        json,
      });
      // 保存の manifest に入る、ページのほかのファイル。ポスターの ?v= は版の印のまま
      const files = pageFiles({ cid, lectures, posters, video });
      // 版は、版の印を入れたまま描いたページ（CSP まで）と、動画・ポスターの URL・大きさ・sha256 から計算する。保存した HTML と MP4 を別の版に混ぜない。
      // 版の印は、ページで動く script の中には無い（JSON のデータにだけある）ので、版を差し込んでも CSP は変わらない
      const pageVersion = pageVersionOf({ html, files });
      const page = Buffer.from(stampVersion(html, pageVersion));
      const manifest =
        posters.length === lectures.length
          ? courseManifest({ cid, title: course.title, page, files, pageVersion, news: newsFor(news, course.id, lang) })
          : null;
      if (manifest) manifests.push(manifest);
      writeCourse({ outDir: dist, cid, page, posters, manifest });
      log(
        `site/dist/${cid}/index.html ${(html.length / 1024).toFixed(0)} KB  ${lectures.length} レクチャー  合計 ${minutes.toFixed(1)} 分  テーマ ${theme.id}`,
      );
    }
  }

  /* ───────────── 一覧のページ（言語ごと） ───────────── */
  const brand = themeOf();
  mkdirSync(dist, { recursive: true });
  /**
   * 一覧のページの縮小画像と SW の起動用ファイルの ?v=（その講座のページの版。講座のページの最初のポスターと同じ URL になり、
   * ブラウザのキャッシュを分け合う）。この組み立てで作った講座と、講座を指定して組み立てたときの前に組んだ講座は、保存の manifest から。
   * manifest の無い講座（ポスターがそろっていない）は、縮小画像の中身の sha256
   */
  const posterVersion = (c: Course): string => {
    const cid = `${LANG_INFO[(c.lang ?? 'ja') as Lang].path}${c.id}`;
    const built = manifests.find((m) => m.id === cid);
    if (built) return built.pageVersion;
    const saved = path.join(dist, cid, 'offline-manifest.json');
    if (existsSync(saved)) return (JSON.parse(readFileSync(saved, 'utf8')) as CourseManifest).pageVersion;
    const poster = path.join(dist, homePosterOf(c, '', '').split('?')[0]);
    return existsSync(poster) ? hash(readFileSync(poster)) : '';
  };
  for (const lang of langs) {
    const info = LANG_INFO[lang];
    const root = lang === 'ja' ? './' : '../';
    const html = renderHomePage({
      home,
      config,
      base,
      langs,
      coursesIn,
      lang,
      T: homeText(lang),
      brand,
      themes: Object.values(THEMES),
      themeOf,
      hasThemeImage: (id) => existsSync(path.join(assetsDir, `themes/${id}.jpg`)),
      themeSummary: (t) => textOf(LOCALES[lang].themes)(t.id) ?? t.summary,
      minutesOf: (c) => minutesOf(c, (c.lang ?? 'ja') as Lang, readData),
      credits: homeCredits(coursesIn(lang), lang),
      posterVersion,
      hero: o.hero,
      app: appParts(app, lang, root),
      offlineClient: app.offlineClient,
      offlineCss,
    });
    const dir = path.join(dist, info.path);
    mkdirSync(dir, { recursive: true });
    const page = Buffer.from(html);
    writeFileSync(path.join(dir, 'index.html'), page);
    shell.push(asset(info.path || './', page, 'text/html'));
  }

  /* ───────────── 画像・PWA・ヘッダー ───────────── */
  // 一覧のページの画像と、講座のサムネイル（日本語の講座の最初の動画のポスター）は、SW の起動用ファイルにする
  shell.push(...copyAssets(assetsDir, path.join(dist, 'assets'), dist));
  shell.push(
    ...thumbnailAssets(
      dist,
      coursesIn('ja').map((c) => homePosterOf(c, '', posterVersion(c))),
    ),
  );
  // sw.js に入れる講座（保存できる講座）は、出す言語の全部の講座から、組み立てたサイトに保存の manifest があるものを選ぶ。
  // 講座を指定して組み立てたときも、前に組んだ講座を外さない（外すと、その講座を保存できず、一覧のページの保存の欄からも消える）
  const saveable = langs
    .flatMap((lang) => coursesIn(lang).map((c) => `${LANG_INFO[lang].path}${c.id}`))
    .filter((cid) => existsSync(path.join(dist, cid, 'offline-manifest.json')));
  const published = saveable.map(
    (cid) =>
      manifests.find((m) => m.id === cid) ??
      (JSON.parse(readFileSync(path.join(dist, cid, 'offline-manifest.json'), 'utf8')) as CourseManifest),
  );
  const disabledRevisions = o.disabledRevisions ?? DISABLED_REVISIONS;
  const disabledProblems = disabledRevisionProblems(disabledRevisions, published);
  if (disabledProblems.length) throw new Error(disabledProblems.join('\n'));
  await buildPwa(SITE_DIR, dist, { brand, courses: saveable, shell, langs, series: config.series, disabledRevisions });
  writeServingFiles(dist);
  // 検索のための sitemap.xml と robots.txt（出す言語の一覧のページと講座のページ。講座を指定して組み立てても、全部の講座を並べる）
  const sitemap: SitemapPage[] = langs.flatMap((lang) => [
    { url: `${base}${LANG_INFO[lang].path}`, alternates: langs.map((l) => ({ lang: l, url: `${base}${LANG_INFO[l].path}` })) },
    ...coursesIn(lang).map((c) => ({
      url: `${base}${LANG_INFO[lang].path}${c.id}/`,
      alternates: langs
        .filter((l) => coursesIn(l).some((x) => x.id === c.id))
        .map((l) => ({ lang: l, url: `${base}${LANG_INFO[l].path}${c.id}/` })),
    })),
  ]);
  writeFileSync(path.join(dist, 'sitemap.xml'), sitemapXml(sitemap));
  writeFileSync(path.join(dist, 'robots.txt'), robotsTxt(base));
  // 無いページは言語ごと（Workers の静的 assets は、いちばん近いフォルダの 404.html を返す）
  const notFound = readFileSync(path.join(SITE_DIR, 'not-found.html'), 'utf8');
  for (const lang of langs) {
    const file = path.join(dist, notFoundFile(lang));
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, renderNotFound({ template: notFound, lang, series: config.series, basePath: new URL(base).pathname }));
  }

  // 公開物の決まり（Workers の上限・MP4 なし・印の残り・CSP と script・保存の manifest・起動用ファイル）を確かめる。破れていれば止める。
  // ページで動く script は、信頼できる 3 本（www の移動・講座のページの画面・offline-client）のどれかでなければ止める
  assertSiteInvariants({
    dist,
    scope: base,
    media: o.mediaManifest,
    shell,
    courses: saveable,
    scripts: [WWW_REDIRECT_SCRIPT, pageScript, app.offlineClient],
  });
  const files = listOutput(dist);
  log(
    `site/dist: ${files.length} files・${(files.reduce((n, f) => n + f.bytes, 0) / 1e6).toFixed(1)}MB・MP4なし。公開言語: ${langs.join(',')}`,
  );

  if (missing.length) {
    const msg = `まだ動画かポスターが無い: ${missing.join(' ')}（bash scripts/render.sh で作る）`;
    if (o.strict) throw new Error(msg);
    warn(msg);
  }
  return { files, manifests, courses: saveable, missing };
}
