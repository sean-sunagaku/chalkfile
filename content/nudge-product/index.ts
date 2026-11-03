// 講座の登録（content/courses.ts に 1 行で並べる）。講座は course.ts、訳は <言語>/course.ts
import { defineCourseModule } from '../course-module';
import { NUDGE_PRODUCT } from './course';

export default defineCourseModule({ course: NUDGE_PRODUCT });
