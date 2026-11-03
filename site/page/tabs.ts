// レクチャーの資料のタブ（概要・教材・台本・ノート・公式ドキュメント・確認クイズ・実践課題・AI に聞く）。開いたタブはこの端末に残す
import type { Page } from './context';
import { byId } from './dom';

/** タブの名前（タブは #tab-<名前>、中身は #p-<名前>）。並びは画面の並び */
export const TABS = ['overview', 'material', 'transcript', 'notes', 'docs', 'quiz', 'exercise', 'ask'] as const;
export type TabName = (typeof TABS)[number];

const isTab = (name: string): name is TabName => (TABS as readonly string[]).includes(name);

export const createTabs = (page: Page) => {
  /** タブを開く。隠れているタブ（教材の無いレクチャーの教材など）と知らない名前は、概要にする */
  const show = (wanted: string) => {
    const name = isTab(wanted) && !byId(`tab-${wanted}`).hidden ? wanted : 'overview';
    for (const t of TABS) {
      byId(`tab-${t}`).setAttribute('aria-selected', t === name ? 'true' : 'false');
      byId(`p-${t}`).hidden = t !== name;
    }
    page.store.saveTab(name);
  };
  for (const t of TABS) byId(`tab-${t}`).addEventListener('click', () => show(t));
  return { show };
};
