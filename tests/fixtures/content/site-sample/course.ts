import type { Course } from '../../../../content/types';
import { Y01 } from './Y01';
import { Y02 } from './Y02';

/**
 * 講座サイトの見本の講座（content/<講座>/course.ts と同じ形。講座の一覧には並べない）。サイトの組み立てのスナップショット
 * （tests/site-build.test.ts）と、本物の講座の無いブラウザのテスト（npm run test:e2e:ci）に使う。
 * 講義のデータは data/<key>.json（synth.ts の出力と同じ形。動画は 2 秒）、ポスターは posters/<key>.jpg（小さな画像）。
 * 動画はテストのときに ffmpeg で作る（tests/e2e/fixture-site.ts）
 */
export const SITE_SAMPLE: Course = {
  id: 'site-sample',
  prefix: 'Y',
  order: 1,
  theme: 'indigo',
  title: '講座サイトの見本',
  subtitle: '保存・再生・オフラインのテスト',
  headline: '講座サイトの **保存と再生** を、2 本の短い動画で',
  sections: [{ no: 1, title: 'はじめに' }],
  lectures: [Y01, Y02],
  docsNote: '見本のための講座です。リンク先は例です。',
  sourceNote: '架空のサンプルアプリで作った見本',
};
