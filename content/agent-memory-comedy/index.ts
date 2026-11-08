// 講座の登録（content/courses.ts に 1 行で並べる）。講座は course.ts、読みの辞書は reading.ts
import { defineCourseModule } from '../course-module';
import { AGENT_MEMORY_COMEDY } from './course';
import { READING } from './reading';

export default defineCourseModule({ course: AGENT_MEMORY_COMEDY, reading: READING });
