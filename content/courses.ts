// 講座の登録表（1 講座 1 行。講座のフォルダの index.ts を並べる）。講座を足すときは、自分の講座の 1 行だけを足す。
// 並びは Course の order で決まり、この行の順には頼らない。.gitattributes の merge=union で、並行の PR が足した行は両方残る
// 頭文字（prefix）と order が講座をまたいで重なっていないかは npm run validate が見る

export { default as ga4Comedy } from './ga4-comedy';
export { default as indieMarketing } from './indie-marketing';
export { default as nudgeComedy } from './nudge-comedy';
export { default as nudgeProduct } from './nudge-product';
export { default as pstackComedy } from './pstack-comedy';
export { default as riveComedy } from './rive-comedy';
export { default as stripeBilling } from './stripe-billing';
export { default as superagentComedy } from './superagent-comedy';
export { default as uiuxEngineers } from './uiux-engineers';
export { default as deepseekCreator } from './deepseek-creator';
