// 場面の種類 1 つ分の、描く側の定義。src/scenes/<kind>.tsx の最後で defineScene を呼び、src/scenes/index.ts の登録表に並べる。
// 教材の絵コンテに出す名前と表示内容は、描かない側の一覧（engine/core/scenes.ts の SCENE_INFO）に書く
// （scripts/ と engine/core は React・Remotion を読まないので、描く部品と同じファイルには置かない）
import type React from 'react';
import type { SceneKind, SceneOf } from '../../engine/core/scenes';

export type SceneDef<K extends SceneKind = SceneKind> = {
  kind: K;
  /** 場面を描く部品。台本の場面のデータを s で受け取る */
  Component: React.FC<{ s: SceneOf<K> }>;
};

export const defineScene = <K extends SceneKind>(def: SceneDef<K>): SceneDef<K> => def;

/** 全部の種類の登録表の型。種類を足し忘れるか、名前と kind が食い違うと型で止まる */
export type SceneRegistry = { [K in SceneKind]: SceneDef<K> };
