import { comedyCast } from '../_shared/comedy';
import type { Course } from '../types';
import { H01 } from './H01';
export const DEEPSEEK_CREATOR: Course = {
  id: 'deepseek-creator', prefix: 'H', order: 100, theme: 'stage', standalone: true,
  title: '笑ってわかる DeepSeek Harness Creator mode',
  subtitle: '会話でプラグインを作る仕組みと、迷わないメニュー案内',
  headline: '欲しい道具を、**会話から作る**',
  disclaimer: 'DeepSeek とは関係のない、個人が作った非公式の解説です。ボケの台詞は、わざと間違えています。',
  sections: [{ no: 1, title: 'Creator mode とメニュー案内' }], lectures: [H01], cast: comedyCast(),
  ui: { takeaways: '要点メモ', docs: '公式資料', searchHint: 'Creator、Plugins、メニュー' },
  docsNote: '2026 年 11 月 4 日に、DeepSeek 公式サイトと公式リポジトリの commit 8bd073392eef6f54e921a093b95076248eb08cbb（11 月 3 日）を確認。公開ソースの仕様を説明する動画であり、実機での操作実演ではありません。開発プレビューのため、配布版・設定・言語によって表示や機能は変わります。',
  sourceNote: '公式 README、モード案内、Agent presets、Plugins、Safety をもとに独自の図と台本を作成（2026-11-04 確認）。非公式の解説。ボケは意図的な誤りです。',
};
