// この講座の読みの辞書（pstack と作者の名前）。共通の辞書（content/reading.ts）より優先する。
// この講座の台詞の読みだけが変わる（ほかの講座の読みは変わらない）。どの講座でも同じ読みにしたい語は、共通の辞書に足す。
// 直したら npm test（音声の鍵と読みのスナップショット）と npm run reading:diff で、変わった台詞を見て、合成し直す
import type { Reading } from '../reading';

export const READING: Reading = {
  words: {
    pstack: 'ピースタック',
    poteto: 'ポテト',
  },
};
