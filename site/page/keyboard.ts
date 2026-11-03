// キーボードのショートカット（Space・K で再生と停止、← → で 5 秒、J L で 10 秒、C で字幕、F で全画面、N で次のレクチャー）
import type { Player } from './player';

/** 文字を打つ所や、押すと動く部品の上では、ショートカットにしない（その部品のキーの動きを優先する） */
const OWN_KEYS = ['input', 'textarea', 'select', 'button', 'a', 'summary'];

export const bindKeyboard = (player: Player, next: () => void) => {
  document.addEventListener('keydown', (e) => {
    const tag = e.target instanceof Element ? e.target.tagName.toLowerCase() : '';
    if (OWN_KEYS.includes(tag) || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === ' ' || k === 'k') {
      e.preventDefault();
      player.togglePlay();
    } else if (k === 'ArrowLeft') player.seekBy(-5);
    else if (k === 'ArrowRight') player.seekBy(5);
    else if (k === 'j') player.seekBy(-10);
    else if (k === 'l') player.seekBy(10);
    else if (k === 'c') player.toggleCc();
    else if (k === 'f') player.toggleFull();
    else if (k === 'n') next();
  });
};
