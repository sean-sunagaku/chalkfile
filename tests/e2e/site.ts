// ブラウザのテストで配る講座サイトの形。テストのサーバー（tests/browser-server.ts）が作り、テスト（tests/browser/fixtures.ts の site）が受け取る。
//   ci: 合成の講座（tests/fixtures/content/site-sample。2 本・4 秒の動画）。本物の講座も動画も要らない（CI の e2e のジョブ）
//   real: 本物の講座（site/dist と、手元の site/media の動画）と入れてある Chrome での回帰（手で流す）

/** どちらのサイトを配るか */
export type SiteMode = 'ci' | 'real';

/** 新しい版に見せるとき（Control の update）に、教材情報の news の先頭に足す文 */
export const UPDATE_NEWS = '更新テストのお知らせ';

/** 障害の差し込みの状態（POST /__test/control に渡す。書かなかった項目は既定に戻す） */
export type Control = {
  /** 保存の取得（Range の無い GET）に差し込む失敗（差し込むのは faultLecture の faultTarget だけ）。external は保存の manifest に外の動画を入れる */
  mode: 'normal' | 'fail' | 'redirect' | 'partial' | 'corrupt' | 'truncated' | 'delay' | 'external';
  /**
   * mode の失敗を差し込むもの。video は通常版の動画、poster はポスター（教材のページだけの更新では、変わっていない動画は前の保存版から
   * 写すので取りに来ない。更新の保存の失敗は、版の変わるポスターに差し込む）
   */
  faultTarget: 'video' | 'poster';
  /** 講座のページと保存の manifest を、新しい版に見せる（manifest の news の先頭に、テストの日の日付の UPDATE_NEWS を足す） */
  update: boolean;
  /** sw.js の中身を変えて、SW の更新を起こす */
  workerUpdate: boolean;
  /** sw.js の設定の「無効にした保存版の revision」（site/disabled-revisions.ts）を、この一覧にした sw.js を配る（空でなければ SW の更新も起きる） */
  disabledRevisions: string[];
  /** 保存の manifest の取得の失敗（delay-first-fail は、1 回目だけ 3 秒待ってから失敗） */
  manifestMode: 'normal' | 'fail' | 'delay-first-fail';
  /** /media/ の動画を全部 404 にする */
  mediaDown: boolean;
  /**
   * SW の install が取る起動用ファイルのうち、オフラインの案内のページ（/offline/。ページは取らない）の応答を、この ms だけ遅らせる。
   * 初めて開いたときの、SW が動き出す前（register のあと、ready の前）の間を長くする（遅い回線や遅い CI の runner と同じ形）
   */
  installDelay: number;
  /** 旧 Pages（site/legacy-config.json の scope）: old は前の公開（tests/fixtures/legacy-pages）、migrated は公開済みの移行の案内（tests/fixtures/legacy-migration） */
  legacyPhase: 'old' | 'migrated';
};

/** テスト 1 つ分の講座サイト（POST /__test/session の答え）。テストごとに別の番号（origin）で配り、障害の差し込みの状態を分ける */
export type SiteSession = {
  id: string;
  /** このテストのサイト（http://127.0.0.1:<番号>） */
  origin: string;
  mode: SiteMode;
  /** 組み立てたサイトのフォルダ（保存の manifest を読む） */
  dist: string;
  /** 保存と再生を確かめる講座 */
  course: {
    id: string;
    /** 講座のページ（/<講座>/） */
    route: string;
    title: string;
    /** 台本のタブで探す言葉 */
    searchTerm: string;
    /** レクチャーと、その通常版の動画の手元のファイル（Range の答えと照らし合わせる） */
    lectures: { id: string; video: string }[];
    /** 保存の失敗・遅れ（Control の mode）を差し込むレクチャー */
    faultLecture: string;
  };
  /** 旧 Pages の pstack-comedy の P01 の動画の手元のファイル（ci は合成の動画） */
  legacyVideo: string;
  /** SW の起動用ファイルの PNG（サイトの最上位からの場所。ci は一覧のページの画像に足したもの、real はアイコン） */
  shellPng: string;
  /** 動画の長さ（秒）。合成の講座だけ。本物の講座は長いので null（テストの時刻をそのまま使う） */
  videoSeconds: number | null;
};
