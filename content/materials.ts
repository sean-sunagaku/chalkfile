// npm run gen が *.material.ts から作る。手で直さない。動画専用の入口は、このファイルを読まない。
import type { ChapterMaterials } from '../engine/core/materials';
import { M01_MATERIAL } from './indie-marketing/M01.material';
import { M02_MATERIAL } from './indie-marketing/M02.material';
import { M03_MATERIAL } from './indie-marketing/M03.material';
import { M04_MATERIAL } from './indie-marketing/M04.material';
import { M05_MATERIAL } from './indie-marketing/M05.material';
import { M06_MATERIAL } from './indie-marketing/M06.material';
import { M07_MATERIAL } from './indie-marketing/M07.material';
import { M08_MATERIAL } from './indie-marketing/M08.material';
import { N01_MATERIAL } from './nudge-product/N01.material';
import { N02_MATERIAL } from './nudge-product/N02.material';
import { N03_MATERIAL } from './nudge-product/N03.material';
import { N04_MATERIAL } from './nudge-product/N04.material';
import { N05_MATERIAL } from './nudge-product/N05.material';
import { N06_MATERIAL } from './nudge-product/N06.material';
import { N07_MATERIAL } from './nudge-product/N07.material';
import { D01_MATERIAL } from './uiux-engineers/D01.material';
import { D02_MATERIAL } from './uiux-engineers/D02.material';
import { D03_MATERIAL } from './uiux-engineers/D03.material';
import { D04_MATERIAL } from './uiux-engineers/D04.material';
import { D05_MATERIAL } from './uiux-engineers/D05.material';
import { D06_MATERIAL } from './uiux-engineers/D06.material';
import { D07_MATERIAL } from './uiux-engineers/D07.material';
import { D08_MATERIAL } from './uiux-engineers/D08.material';

export const MATERIALS: ChapterMaterials = {
  M01: M01_MATERIAL,
  M02: M02_MATERIAL,
  M03: M03_MATERIAL,
  M04: M04_MATERIAL,
  M05: M05_MATERIAL,
  M06: M06_MATERIAL,
  M07: M07_MATERIAL,
  M08: M08_MATERIAL,
  N01: N01_MATERIAL,
  N02: N02_MATERIAL,
  N03: N03_MATERIAL,
  N04: N04_MATERIAL,
  N05: N05_MATERIAL,
  N06: N06_MATERIAL,
  N07: N07_MATERIAL,
  D01: D01_MATERIAL,
  D02: D02_MATERIAL,
  D03: D03_MATERIAL,
  D04: D04_MATERIAL,
  D05: D05_MATERIAL,
  D06: D06_MATERIAL,
  D07: D07_MATERIAL,
  D08: D08_MATERIAL,
};
