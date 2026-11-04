// レクチャーの資料のタブ（概要・教材・台本・ノート・公式ドキュメント・確認クイズ・実践課題・AI に聞く）。開いたタブはこの端末に残す。
// キーボード: タブの列には Tab で 1 回だけ入り（今のタブだけ tabindex="0"）、← → で隣のタブ、Home と End で端のタブを開く（隠れたタブは飛ばす）。
// 中身（tabpanel）は tabindex="0" で、タブから Tab で中身へ移る
import type { Page } from './context';
import { byId } from './dom';

/** タブの名前（タブは #tab-<名前>、中身は #p-<名前>）。並びは画面の並び */
export const TABS = ['overview', 'material', 'transcript', 'notes', 'docs', 'quiz', 'exercise', 'ask'] as const;
export type TabName = (typeof TABS)[number];

const isTab = (name: string): name is TabName => (TABS as readonly string[]).includes(name);

/** キーで移る先（見えているタブの並びの中で）。ほかのキーは undefined */
const KEYS: Record<string, (at: number, n: number) => number> = {
  ArrowRight: (at, n) => (at + 1) % n,
  ArrowLeft: (at, n) => (at - 1 + n) % n,
  Home: () => 0,
  End: (_, n) => n - 1,
};

export const createTabs = (page: Page) => {
  const tab = (name: TabName) => byId(`tab-${name}`);
  /** 見えているタブ（教材の無いレクチャーでは、教材・実践課題・AI に聞くが隠れる） */
  const visible = () => TABS.filter((t) => !tab(t).hidden);

  /** タブを開く。隠れているタブと知らない名前は、概要にする。focus なら、そのタブにフォーカスを移す */
  const show = (wanted: string, focus = false) => {
    const name = isTab(wanted) && !tab(wanted).hidden ? wanted : 'overview';
    for (const t of TABS) {
      const selected = t === name;
      tab(t).setAttribute('aria-selected', selected ? 'true' : 'false');
      tab(t).tabIndex = selected ? 0 : -1;
      byId(`p-${t}`).hidden = !selected;
    }
    page.store.saveTab(name);
    if (focus) tab(name).focus();
  };
  for (const t of TABS) {
    tab(t).addEventListener('click', () => show(t));
    tab(t).addEventListener('keydown', (e) => {
      const move = KEYS[e.key];
      const list = visible();
      const at = list.indexOf(t);
      if (!move || at < 0 || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      e.preventDefault();
      // at >= 0 なので list は空でなく、移動関数はその範囲に収める。
      show(list[move(at, list.length)]!, true);
    });
  }

  return { show };
};
