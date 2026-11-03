// 講座の登録（content/courses.ts に 1 行で並べる）。講座は course.ts、訳は <言語>/course.ts
import { defineCourseModule } from '../course-module';
import { RIVE_COMEDY } from './course';
import { RIVE_COMEDY_EN } from './en/course';
import { RIVE_COMEDY_ZH } from './zh/course';

export default defineCourseModule({ course: RIVE_COMEDY, translations: { en: RIVE_COMEDY_EN, zh: RIVE_COMEDY_ZH } });
