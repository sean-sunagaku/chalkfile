// 読む教材を、動画だけの台本へ付ける。教材のデータそのものは呼ぶ側から渡す。
import type { AuthoredCourse, ChapterMaterial } from './schema';

export type ChapterMaterials = Readonly<Partial<Record<string, ChapterMaterial>>>;

export const materialDecorator = (courses: readonly AuthoredCourse[], materials: ChapterMaterials) => {
  const ids = new Set(courses.flatMap((course) => course.lectures.map((lecture) => lecture.id)));
  for (const id of Object.keys(materials)) {
    if (!ids.has(id)) throw new Error(`教材のレクチャーが無い: ${id}`);
  }
  return (course: AuthoredCourse): AuthoredCourse => {
    let changed = false;
    const lectures = course.lectures.map((lecture) => {
      const material = materials[lecture.id];
      if (!material) return lecture;
      changed = true;
      return { ...lecture, material };
    });
    return changed ? { ...course, lectures } : course;
  };
};
