// 講座の登録（content/courses.ts に 1 行で並べる）。講座は course.ts、訳は <言語>/course.ts
import { defineCourseModule } from '../course-module';
import { SUPERAGENT_COMEDY } from './course';
import { SUPERAGENT_COMEDY_EN } from './en/course';
import { SUPERAGENT_COMEDY_ZH } from './zh/course';

export default defineCourseModule({ course: SUPERAGENT_COMEDY, translations: { en: SUPERAGENT_COMEDY_EN, zh: SUPERAGENT_COMEDY_ZH } });
