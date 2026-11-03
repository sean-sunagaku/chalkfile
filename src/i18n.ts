// 動画の中の決まった文字（部品が出す言葉）。台本の文字は content/ の台本と訳から来る。
// 日本語（ja）は、多言語にする前の部品に書いてあった文字と同じにする（日本語の動画を変えない）。
import type { Lang } from '../content/i18n';
import type { Evidence } from '../content/types';

export type VideoText = {
  /** 最後のレクチャーの終わりの大きな文字 */
  done: string;
  /** 終わりの進み具合（3 / 8 完了） */
  progress: (no: number, total: number) => string;
  /** 終わりのクレジットの行（声の一覧を受け取る） */
  credits: (voices: string[]) => string;
  /** 左下の出典の頭 */
  cite: string;
  /** クイズの考える時間の札 */
  quizThink: string;
  /** クイズの答えの札（正しい文か・誤解か） */
  quizTrue: string;
  quizFalse: string;
  /** 根拠の種類の札（講座サイトの教材タブと同じ言葉） */
  evidence: Record<Evidence, string>;
  /** 架空のアプリの画面の部品 */
  required: string;
};

export const VIDEO_TEXT: Record<Lang, VideoText> = {
  ja: {
    done: 'おつかれさまでした',
    progress: (no, total) => `${no} / ${total} 完了`,
    credits: (voices) => `ナレーション　${voices.join('　')}　／　BGM・効果音　オリジナル（プログラムで合成）`,
    cite: '出典: ',
    quizThink: '○ か × か？',
    quizTrue: '正しい',
    quizFalse: '誤解',
    evidence: { research: '研究・学術', official: '公式・法令・規格', practice: '実務の指針', example: '説明用の仮の例' },
    required: '必須',
  },
  en: {
    done: 'Well done!',
    progress: (no, total) => `${no} / ${total} complete`,
    credits: (voices) => `Voices  ${voices.join('  ')}  /  Music and sound effects  Original (synthesized in code)`,
    cite: 'Source: ',
    quizThink: 'True or false?',
    quizTrue: 'True',
    quizFalse: 'False',
    evidence: { research: 'Research', official: 'Official / law / standard', practice: 'Practitioner guidance', example: 'Illustrative example' },
    required: 'Required',
  },
  zh: {
    done: '辛苦了！',
    progress: (no, total) => `已完成 ${no} / ${total}`,
    credits: (voices) => `配音　${voices.join('　')}　／　背景音乐与音效　原创（程序合成）`,
    cite: '出处：',
    quizThink: '对还是错？',
    quizTrue: '正确',
    quizFalse: '误解',
    evidence: { research: '研究与学术', official: '官方、法规、标准', practice: '实务指南', example: '说明用的虚构示例' },
    required: '必填',
  },
};
