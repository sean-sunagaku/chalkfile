// 動画だけの入口。読む教材（*.material.ts）を依存関係に入れない。
import { createCatalog } from '../engine/core/catalog';
import * as REGISTRY from './courses';

export type { Video } from './types';

const modules = Object.values(REGISTRY);
export const { AUTHORED_COURSES, SHARED_LINES, COURSES, LECTURES, courseOf, TRANSLATIONS, coursesIn, VIDEOS, videoOf } = createCatalog(modules);
