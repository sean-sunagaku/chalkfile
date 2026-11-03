// 講座サイトを組み立てる本体（buildSite）。本物の講座は scripts/build_site.ts（CLI）が渡し、テストは合成の講座を渡す。
// 順番: 安全のための確かめ → 講座のページ（データ → 描く → CSP → 版 → 保存の manifest → 書く）→ 一覧のページ → 画像 → PWA（アイコン・
// manifest・オフラインの案内・sw.js）→ ヘッダーと 404 → 公開物の決まりの確かめ（scripts/site-invariants.ts）
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { HeroSnippet } from '../../content/course-module';
import { LANG_INFO, LANGS, type Lang } from '../../content/i18n';
import { THEMES, themeOf } from '../../content/themes';
import type { Course } from '../../content/types';
import { posterFile } from '../../engine/core/generated';
import { SITE_TEXT, THEME_SUMMARY } from '../../site/i18n';
import { type MediaEntry, type MediaManifest, mediaKey } from '../../site/media-shared';
import type { Asset, CourseManifest } from '../../site/offline-shared';
import { asset, buildPwa, bundle } from '../pwa';
import { assertSiteInvariants } from '../site-invariants';
import { PAGE_VERSION_MARK, pageVersionOf, stampVersion } from '../site-version';
import { mediaRootOf, readSiteConfig, type SiteConfig, siteProblems } from '../validate';
import { copyAssets, thumbnailAssets } from './assets';
import { realPosterOf, SITE_DIR, siteBase } from './config';
import { cspHead, splitPageScript, WWW_REDIRECT_SCRIPT } from './csp';
import { cleanOutput, listOutput, writeCourse } from './emit';
import { NOT_FOUND_HTML, writeServingFiles } from './headers';
import { fillTemplate } from './html';
import { courseJson, homeCredits, lectureModels, minutesOf, type ReadData, type SiteData } from './model';
import { courseManifest, type PosterFile, pageFiles } from './offline-manifest';
import { type AppContext, appParts } from './parts';
import { renderCoursePage } from './render-course';
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
  /** 前の組み立ての訳の動画のフォルダ（site/dist-media）。渡すと、訳の言語のものを消す */
  mediaOutDir?: string;
  /** 進み具合の出力（既定は console.log）と注意（既定は console.warn） */
  log?: (line: string) => void;
  warn?: (line: string) => void;
};

/** 組み立ての結果 */
export type BuildSiteResult = {
  /** 書き出したファイル（outDir からの場所と大きさ） */
  files: { name: string; bytes: number }[];
  /** 保存の manifest を作った講座（sw.js に入れた講座） */
  manifests: CourseManifest[];
  /** まだ動画かポスターが無いもの */
  missing: string[];
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
  const problems = siteProblems(config, coursesIn);
  if (problems.length) throw new Error(problems.join('\n'));

  // ページの本体の script は、テンプレートから取り出しておく（CSP のハッシュを先に計算する、信頼できるソースの 1 つ）
  const { template, script: pageScript } = splitPageScript(
    readFileSync(path.join(SITE_DIR, 'template.html'), 'utf8'),
    'site/template.html',
  );
  const home = readFileSync(path.join(SITE_DIR, 'home.html'), 'utf8');
  const offlineCss = readFileSync(path.join(SITE_DIR, 'offline.css'), 'utf8');
  const app: AppContext = {
    offlinePanel: readFileSync(path.join(SITE_DIR, 'offline-panel.html'), 'utf8'),
    offlineClient: await bundle(path.join(SITE_DIR, 'offline-client.ts')),
    themeColor: themeOf().color.bg,
    coursesIn,
    text: SITE_TEXT,
  };
  const readData: ReadData = (key) => {
    const f = path.join(o.dataDir, `${key}.json`);
    return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as SiteData) : null;
  };
  const videos = new Map(o.mediaManifest.entries.map((e) => [mediaKey(e), e]));
  const posterOf = o.posterOf ?? realPosterOf;
  const missing: string[] = [];
  const manifests: CourseManifest[] = [];
  const shell: Asset[] = [];

  cleanOutput({ outDir: dist, mediaOutDir: o.mediaOutDir, langs, partial: only.length > 0 });

  /* ───────────── 講座のページ（言語ごと） ───────────── */
  for (const lang of langs) {
    const T = SITE_TEXT[lang];
    const info = LANG_INFO[lang];
    const mediaRoot = mediaRootOf(config, lang);
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
          posters.push({ file: `${lec.key}.jpg`, from, data: readFileSync(from), type: 'image/jpeg' });
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
          ? courseManifest({ cid, title: course.title, page, files, pageVersion })
          : null;
      if (manifest) manifests.push(manifest);
      writeCourse({ outDir: dist, cid, page, posters, manifest });
      log(
        `site/dist/${cid}/index.html ${(html.length / 1024).toFixed(0)} KB  ${lectures.length} レクチャー  合計 ${minutes.toFixed(1)} 分  テーマ ${theme.id}${mediaRoot ? `  動画 ${mediaRoot}` : ''}`,
      );
    }
  }

  /* ───────────── 一覧のページ（言語ごと） ───────────── */
  const brand = themeOf();
  mkdirSync(dist, { recursive: true });
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
      T: SITE_TEXT[lang],
      brand,
      themes: Object.values(THEMES),
      themeOf,
      hasThemeImage: (id) => existsSync(path.join(SITE_DIR, `assets/themes/${id}.jpg`)),
      themeSummary: (t) => (lang === 'ja' ? t.summary : (THEME_SUMMARY[lang][t.id] ?? t.summary)),
      minutesOf: (c) => minutesOf(c, (c.lang ?? 'ja') as Lang, readData),
      credits: homeCredits(coursesIn(lang), lang),
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
  shell.push(...copyAssets(path.join(SITE_DIR, 'assets'), path.join(dist, 'assets'), dist));
  shell.push(
    ...thumbnailAssets(
      dist,
      coursesIn('ja').map((c) => homePosterOf(c, '')),
    ),
  );
  const mediaRoots = Object.fromEntries(
    langs.flatMap((l) => (mediaRootOf(config, l) ? [[l, mediaRootOf(config, l) as string]] : [])),
  );
  await buildPwa(
    SITE_DIR,
    dist,
    brand,
    manifests.map((m) => m.id),
    shell,
    mediaRoots,
  );
  writeServingFiles(dist, fillTemplate(NOT_FOUND_HTML, { marks: { CSP: cspHead([]) } }, '404.html'));

  // 公開物の決まり（Workers の上限・MP4 なし・印の残り・CSP と script・保存の manifest・起動用ファイル）を確かめる。破れていれば止める。
  // ページで動く script は、信頼できる 3 本（www の移動・講座のページの本体・offline-client）のどれかでなければ止める
  assertSiteInvariants({
    dist,
    scope: base,
    mediaRoots,
    media: o.mediaManifest,
    shell,
    courses: manifests.map((m) => m.id),
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
  return { files, manifests, missing };
}
