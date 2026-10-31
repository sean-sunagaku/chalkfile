import { uniqueSources } from '../sources-util';
import type { Course } from '../types';
import { N01 } from './N01';
import { N02, N02_SOURCES } from './N02';
import { N03, N03_SOURCES } from './N03';
import { N04, N04_SOURCES } from './N04';
import { N05, N05_SOURCES } from './N05';
import { N06, N06_SOURCES } from './N06';
import { N07, N07_SOURCES } from './N07';
import { NUDGE_SOURCES } from './sources';
import { NUDGE_SYLLABUS } from './syllabus';

/** ナッジ理論をプロダクト改善に活かす（選択アーキテクチャ・デフォルト・フレーミング・社会的規範・フィードバック・手間・倫理と検証） */
export const NUDGE_PRODUCT: Course = {
  id: 'nudge-product',
  unitLabel: 'CHAPTER',
  theme: 'chalkfile',
  title: 'ナッジ理論をプロダクト改善に活かす',
  subtitle: '選ぶ自由を守りながら、続けやすいプロダクトにする',
  headline: '**選ぶ自由を守る** 行動デザインを、自分のサービスで',
  sections: [
    { no: 1, title: 'はじめに' },
    { no: 2, title: 'ナッジの道具' },
    { no: 3, title: '境界線と倫理' },
    { no: 4, title: '実践' },
  ],
  lectures: [N01, N02, N03, N04, N05, N06, N07],
  syllabus: NUDGE_SYLLABUS,
  sources: uniqueSources(NUDGE_SOURCES, N02_SOURCES, N03_SOURCES, N04_SOURCES, N05_SOURCES, N06_SOURCES, N07_SOURCES),
  ui: { takeaways: '要点メモ', docs: '出典・参考資料', searchHint: 'デフォルト、スラッジ' },
  docsNote:
    '動画と教材の主張は、2026 年 10 月 30 日に開いて確かめた研究論文・公式資料・法令をもとにしています。札の「研究・学術」は査読のある研究や学術書、「公式・法令・規格」は官公庁や国際機関の資料、「実務の指針」は提唱者や専門家の指針、「説明用の仮の例」は架空のサンプル家計簿の例です。有料の論文や開けなかったページは、要旨・訂正通知・著者の公開版・公式の写しで確かめたものがあり、出典の一覧の「何を確かめたか」に書いています。第 2 章以降も、各章を書いたときに出典を開いて確かめたうえで、2026 年 10 月 31 日に書いた担当とは別の担当が、一次資料を開いて事実を確かめ直しました（誤りと言い過ぎを直し、出典の一覧の「何を確かめたか」に書いています）。効果を約束するものではありません。',
  sourceNote:
    '台本と図は、ナッジと選択アーキテクチャの研究（Thaler & Sunstein など）、FTC・OECD・欧州連合・消費者庁・環境省の公式資料（2026 年 10 月確認）をもとに作成。サンプル家計簿は架空のアプリで、数字は説明用の仮の例です',
};
