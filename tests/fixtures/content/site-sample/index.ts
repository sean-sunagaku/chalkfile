// 講座サイトの見本の講座の登録（content/<講座>/index.ts と同じ形。content/courses.ts には並べない）
import { defineCourseModule } from '../../../../content/course-module';
import { SITE_SAMPLE } from './course';

export default defineCourseModule({
  course: SITE_SAMPLE,
  // 一覧のページの最初の画面に出す、Y01 の big の場面
  heroSnippet: {
    file: 'tests/fixtures/content/site-sample/Y01.ts',
    lines: [
      '{',
      "  kind: 'big',",
      "  heading: 'オフラインで学ぶ',",
      "  text: '**保存** すれば通信なしで見られる',",
      "  tone: 'violet',",
    ],
  },
});
