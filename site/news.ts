// 講座の「新しい版」の案内に出す、何が変わったかの短い文（正本はここだけ）。学ぶ人が保存した版より新しい版を公開するときに、1 件足す。
// 組み立て（scripts/site/build.ts）が、講座ごとの保存用の教材情報（<講座>/offline-manifest.json の news）に、その講座に当たる新しいものから
// NEWS_MAX 件を、講座の言語の文で入れる。画面（site/offline-client.ts）は、更新を確かめて新しい版が見つかったとき、保存した日より後の日付のものを出す。
// news は版（pageVersion・revision）に入らないので、ここを直しても「新しい版」は出ない（文を直すだけなら、保存した人に取り直しが起きない）。
//   date      公開する日（YYYY-MM-DD）。保存した日と比べるので、公開の日に合わせる
//   history   その回のお知らせ（docs/history/ の Markdown。名前の頭は同じ日付）。詳しいことはそちらに書き、ここは 1 文にする
//   courses   当たる講座の ID（訳の講座は言語を付けない ID）。書かなければ全部の講座
//   text      言語ごとの 1 文（公開する言語は全部書く。組み立てが確かめる）
import type { Lang } from '../content/i18n';

export type SiteNews = {
  date: string;
  history: string;
  courses?: readonly string[];
  text: Readonly<Record<Lang, string>>;
};

/** 教材情報に入れる数（新しいものから） */
export const NEWS_MAX = 3;

/** 新しいものを先に書く */
export const SITE_NEWS: readonly SiteNews[] = [
  {
    date: '2026-11-04',
    history: 'docs/history/2026-11-04-course-page.md',
    text: {
      ja: '講座のページの画面を作り直し、キーボードと読み上げで使いやすく、開くときの通信を少なくしました。全講座の動画も読みやすい書体と配色で作り直しました。保存した講座を更新すると、動画をすべてダウンロードし直します。',
      en: 'Course pages and videos now use clearer text and colors. Keyboard and screen-reader support is improved. Updating a saved course downloads all its videos again.',
      zh: '重新制作了课程页面，更方便用键盘和读屏软件使用，打开时的流量也更少了。所有课程视频也已采用更易读的字体和配色重新制作。更新已保存的课程时，会重新下载该课程的全部视频。',
    },
  },
];
