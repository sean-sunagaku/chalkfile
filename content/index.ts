// 全講座の入口。動画だけの台本に、読む教材を付ける。
import { createCatalog } from '../engine/core/catalog';
import { materialDecorator } from '../engine/core/materials';
import * as REGISTRY from './courses';
import { MATERIALS } from './materials';

export type { Video } from './types';

const modules = Object.values(REGISTRY);
const decorate = materialDecorator(modules.map((module) => module.course), MATERIALS);
export const { AUTHORED_COURSES, SHARED_LINES, COURSES, LECTURES, courseOf, TRANSLATIONS, coursesIn, VIDEOS, videoOf } = createCatalog(modules, decorate);
