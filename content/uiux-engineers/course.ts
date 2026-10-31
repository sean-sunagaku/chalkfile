import { uniqueSources } from '../sources-util';
import type { Course } from '../types';
import { D01 } from './D01';
import { D02, D02_SOURCES } from './D02';
import { D03, D03_SOURCES } from './D03';
import { D04, D04_SOURCES } from './D04';
import { D05, D05_SOURCES } from './D05';
import { D06, D06_SOURCES } from './D06';
import { D07, D07_SOURCES } from './D07';
import { D08, D08_SOURCES } from './D08';
import { UIUX_SOURCES } from './sources';
import { UIUX_SYLLABUS } from './syllabus';

/** エンジニアのための UI・UX デザイン（目的・情報設計・流れ・優先順位・余白・文字・色・フォーム・エラー・アクセシビリティ・確かめ方） */
export const UIUX_ENGINEERS: Course = {
  id: 'uiux-engineers',
  unitLabel: 'CHAPTER',
  theme: 'paper',
  title: 'エンジニアのための UI・UX デザイン',
  subtitle: '見た目の前に、目的と流れから画面を直す',
  headline: '**目的と流れ** から、画面を直せるエンジニアになる',
  sections: [
    { no: 1, title: 'はじめに' },
    { no: 2, title: '目的と流れ' },
    { no: 3, title: '見た目の基本' },
    { no: 4, title: 'フォームとアクセシビリティ' },
    { no: 5, title: '実践' },
  ],
  lectures: [D01, D02, D03, D04, D05, D06, D07, D08],
  syllabus: UIUX_SYLLABUS,
  sources: uniqueSources(UIUX_SOURCES, D02_SOURCES, D03_SOURCES, D04_SOURCES, D05_SOURCES, D06_SOURCES, D07_SOURCES, D08_SOURCES),
  ui: { takeaways: '要点メモ', docs: '出典・参考資料', searchHint: 'ユーザビリティ、ラベル' },
  docsNote:
    '動画と教材の主張は、2026 年 10 月 30 日に確かめた国際規格（ISO）・W3C・官公庁の資料と、Nielsen Norman Group などの専門機関の解説・研究をもとにしています。札の「公式・法令・規格」は規格や法令、「研究・学術」は論文、「実務の指針」は専門家の経験則、「説明用の仮の例」は架空のサンプル予約の例です。ISO の規格は本文が有料で、公式ページは自動では開けなかったため、定義は各国の規格機関が公開している公式のプレビューで確かめています（定義は言い換えで載せています）。第 2 章以降も、各章を書いたときに出典を開いて確かめたうえで、2026 年 10 月 31 日に書いた担当とは別の担当が、一次資料を開いて事実を確かめ直しました（誤りと言い過ぎを直し、出典の一覧の「何を確かめたか」に書いています）。',
  sourceNote:
    '台本と図は、ISO 9241-210・ISO 9241-11、W3C の WCAG、Nielsen Norman Group の解説などをもとに作成（2026 年 10 月確認）。サンプル予約は架空のサービスで、数字は説明用の仮の例です',
};
