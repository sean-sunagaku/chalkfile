// 講座の登録（content/courses.ts に 1 行で並べる）。講座は course.ts、訳は <言語>/course.ts
import { defineCourseModule } from '../course-module';
import { INDIE_MARKETING } from './course';

export default defineCourseModule({ course: INDIE_MARKETING });
