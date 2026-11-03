// この講座の読みの辞書（Super-agent の記事の用語（英字のまま画面に出し、読みだけ開く））。共通の辞書（content/reading.ts）より優先する。
// この講座の台詞の読みだけが変わる（ほかの講座の読みは変わらない）。どの講座でも同じ読みにしたい語は、共通の辞書に足す。
// 直したら npm test（音声の鍵と読みのスナップショット）と npm run reading:diff で、変わった台詞を見て、合成し直す
import type { Reading } from '../reading';

export const READING: Reading = {
  phrases: [
    ['Super-agent', 'スーパーエージェント'],
    ['DeepSeek Harness', 'ディープシーク・ハーネス'],
    ['DeepSeek', 'ディープシーク'],
    ['Chain of Recall', 'チェーン・オブ・リコール'],
    ['Inline & Spill', 'インライン・アンド・スピル'],
    ['Fast Path', 'ファストパス'],
    ['Slow Path', 'スローパス'],
    ['Agent Team', 'エージェントチーム'],
    ['A2A', 'エーツーエー'],
    ['Anthropic', 'アンソロピック'],
  ],
};
