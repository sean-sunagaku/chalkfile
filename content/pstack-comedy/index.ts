// 講座の登録（content/courses.ts に 1 行で並べる）。講座は course.ts、訳は <言語>/course.ts、読みの辞書は reading.ts
import { defineCourseModule } from '../course-module';
import { PSTACK_COMEDY } from './course';
import { PSTACK_COMEDY_EN } from './en/course';
import { READING } from './reading';
import { PSTACK_COMEDY_ZH } from './zh/course';

export default defineCourseModule({ course: PSTACK_COMEDY, translations: { en: PSTACK_COMEDY_EN, zh: PSTACK_COMEDY_ZH }, reading: READING });
