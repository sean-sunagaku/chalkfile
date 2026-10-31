import { uniqueSources } from '../sources-util';
import type { Course } from '../types';
import { M01 } from './M01';
import { M02, M02_SOURCES } from './M02';
import { M03, M03_SOURCES } from './M03';
import { M04, M04_SOURCES } from './M04';
import { M05, M05_SOURCES } from './M05';
import { M06, M06_SOURCES } from './M06';
import { M07, M07_SOURCES } from './M07';
import { M08, M08_SOURCES } from './M08';
import { MARKETING_SOURCES } from './sources';
import { MARKETING_SYLLABUS } from './syllabus';

/** 個人開発者のためのマーケティング（顧客理解・課題の検証・対象顧客・ポジショニング・価値の伝え方・価格・集客・継続・効果測定） */
export const INDIE_MARKETING: Course = {
  id: 'indie-marketing',
  unitLabel: 'CHAPTER',
  theme: 'night',
  title: '個人開発者のためのマーケティング',
  subtitle: '誰の・何の課題を・なぜ自分のサービスで解決するのか',
  headline: '**広告の前に**、誰の何の課題かから始める',
  sections: [
    { no: 1, title: 'はじめに' },
    { no: 2, title: '誰の・何の課題か' },
    { no: 3, title: '伝えて選ばれる' },
    { no: 4, title: '届けて続けてもらう' },
    { no: 5, title: '測って決める' },
  ],
  lectures: [M01, M02, M03, M04, M05, M06, M07, M08],
  syllabus: MARKETING_SYLLABUS,
  sources: uniqueSources(MARKETING_SOURCES, M02_SOURCES, M03_SOURCES, M04_SOURCES, M05_SOURCES, M06_SOURCES, M07_SOURCES, M08_SOURCES),
  ui: { takeaways: '要点メモ', docs: '出典・参考資料', searchHint: '利益、価値の仮説' },
  docsNote:
    '動画と教材の主張は、2026 年 10 月 30 日に開いて確かめた団体の定義・官公庁の資料・研究と統計の解説、実務家の公式ページをもとにしています。札の「公式・法令・規格」は団体の定義や法令、「研究・学術」は研究や統計の方法、「実務の指針」は実務家の考え方、「説明用の仮の例」は架空のサンプル請求書の例です。有料の記事や開けなかったページ（日本マーケティング協会の公式ページなど）は、要旨・業界紙の取材記事などで確かめ、出典の一覧の「何を確かめたか」に書いています。第 2 章以降も、各章を書いたときに出典を開いて確かめたうえで、2026 年 10 月 31 日に書いた担当とは別の担当が、一次資料を開いて事実を確かめ直しました（誤りと言い過ぎを直し、出典の一覧の「何を確かめたか」に書いています）。売上や効果を約束するものではありません。',
  sourceNote:
    '台本と図は、米国マーケティング協会・日本マーケティング協会の定義、国税庁・消費者庁の資料、ジョブ理論などの研究、NIST の統計の解説などをもとに作成（2026 年 10 月確認）。サンプル請求書は架空のアプリで、数字は説明用の仮の例です。法律・税の判断は専門家に確かめてください',
};
