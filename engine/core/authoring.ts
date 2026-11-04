// 台本の繰り返しを減らす。入力の文字と順番を保ち、省いた at と効果音だけを補う。
import type { At, FlowNode, FlowScene, GoalsScene } from './schema';

type GoalInput<A extends At> = Omit<GoalsScene<A | number>, 'items'> & {
  items: (string | { text: string; at?: A })[];
  /** 各項目の台詞に pop を補う。別の効果音がある台詞には足さない。 */
  pop?: boolean;
};

export const goals = <A extends At = number>(input: GoalInput<A>): GoalsScene<A | number> => {
  const { pop = true, ...scene } = input;
  return {
    ...scene,
    items: scene.items.map((item, index) =>
      typeof item === 'string' ? { text: item, at: index + 1 } : { ...item, at: item.at ?? index + 1 },
    ),
    lines: scene.lines.map((line, index) =>
      pop && index > 0 && line.sfx === undefined ? { ...line, sfx: 'pop' } : line,
    ),
  };
};

type FlowInput<K extends string, A extends At> = Omit<FlowScene<A>, 'nodes' | 'edges' | 'focus'> & {
  nodes: (Omit<FlowNode<A>, 'key'> & { key: K })[];
  edges: (Omit<FlowScene<A>['edges'][number], 'from' | 'to'> & { from: NoInfer<K>; to: NoInfer<K> })[];
  focus?: { keys: NoInfer<K>[]; at: A }[];
};

/** ノードの key から参照先を決める。矢印と focus の値からは key の型を広げない。 */
export const flow = <const K extends string, A extends At = number>(scene: FlowInput<K, A>): FlowScene<A> => scene;
