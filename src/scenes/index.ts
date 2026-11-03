// 場面の種類の登録表（描く側）。src/Lecture.tsx が、場面の kind でここを引いて描く。
// 1 種類 1 ファイル（src/scenes/<kind>.tsx の defineScene）を 1 つずつ並べる。種類を足し忘れると、SceneRegistry の型で止まる
import { big } from './big';
import { code } from './code';
import { compare } from './compare';
import { concepts } from './concepts';
import type { SceneRegistry } from './define';
import { ending } from './ending';
import { flow } from './flow';
import { goals } from './goals';
import { numbers } from './numbers';
import { opening } from './opening';
import { phone } from './phone';
import { points } from './points';
import { quiz } from './quiz';
import { recap } from './recap';
import { refs } from './refs';
import { screens } from './screens';
import { sequence } from './sequence';
import { states } from './states';
import { table } from './table';
import { terminal } from './terminal';
import { timeline } from './timeline';

export const SCENES: SceneRegistry = {
  opening,
  goals,
  points,
  concepts,
  sequence,
  flow,
  states,
  code,
  table,
  compare,
  big,
  numbers,
  timeline,
  quiz,
  recap,
  refs,
  phone,
  screens,
  terminal,
  ending,
};
