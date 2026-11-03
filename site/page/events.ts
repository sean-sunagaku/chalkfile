// 保存の画面（site/offline-client.ts）から講座のページの画面（site/course-page.ts）への知らせ。どちらも同じ HTML に入るので、
// 保存版の中でも同じ版どうしでやりとりする（前の版のページとは混ざらない）

/** 保存の状態の知らせの名前（window に CustomEvent で送る。講座のページだけ） */
export const OFFLINE_STATE = 'chalkfile:offline-state';

/** 保存の状態（offline-client が状態を描くたびに送る） */
export type OfflineState = {
  /** この講座の、そろった保存版がある */
  saved: boolean;
  /** その保存版の教材の版（無ければ undefined） */
  pageVersion?: string;
  /** 最新の保存が不完全 */
  incomplete?: boolean;
  /**
   * その保存版を、重大な不具合で無効にした（site/disabled-revisions.ts）ので、SW が保存版ではなく公開中の版のページを開いた（このページは保存版ではない。
   * 動画も、保存版に無いものは公開中のものを使う）。オフラインで保存版を開いたときは false
   */
  disabled?: boolean;
  online: boolean;
};

declare global {
  interface WindowEventMap {
    'chalkfile:offline-state': CustomEvent<OfflineState>;
  }
}
