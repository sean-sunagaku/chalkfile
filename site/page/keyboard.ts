// キーボードのショートカット（Space・K で再生と停止、← → で 5 秒、J L で 10 秒、C で字幕、F で全画面、N で次のレクチャー）。
// 修飾キーの無い 1 文字のショートカットは、プレーヤー（動画）にフォーカスがあるときだけ効かせる（WCAG 2.1.4。ほかの所で打った文字や、
// 支援技術のキーを横取りしない）。動画は Tab で選べる（tabindex="0"）。押すと動く部品（次の案内のボタンなど）の上では、その部品のキーを優先する
import { byId } from './dom';
import type { Player } from './player';

/** 文字を打つ所や、押すと動く部品の上では、ショートカットにしない */
const OWN_KEYS = ['input', 'textarea', 'select', 'button', 'a', 'summary'];

/** キーの動き（ショートカットでないキーは undefined） */
const actionOf = (key: string, player: Player, next: () => void): (() => void) | undefined => {
  switch (key) {
    case ' ':
    case 'k':
      return player.togglePlay;
    case 'ArrowLeft':
      return () => player.seekBy(-5);
    case 'ArrowRight':
      return () => player.seekBy(5);
    case 'j':
      return () => player.seekBy(-10);
    case 'l':
      return () => player.seekBy(10);
    case 'c':
      return player.toggleCc;
    case 'f':
      return player.toggleFull;
    case 'n':
      return next;
    default:
      return undefined;
  }
};

export const bindKeyboard = (player: Player, next: () => void) => {
  // 捕まえる段（capture）で受ける。動画の標準の操作（フォーカスのある動画の Space など）より先に動かし、そこで止める（二重に切り替えない）
  byId('player').addEventListener(
    'keydown',
    (e) => {
      const target = e.target instanceof Element ? e.target : null;
      if (!target || OWN_KEYS.includes(target.tagName.toLowerCase()) || e.metaKey || e.ctrlKey || e.altKey) return;
      const action = actionOf(e.key, player, next);
      if (!action) return;
      e.preventDefault();
      e.stopPropagation();
      action();
    },
    true,
  );
};
