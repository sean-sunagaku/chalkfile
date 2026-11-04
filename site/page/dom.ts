// 画面の部品を作る小さな道具。文字はいつも文字として入れる（Text のノード。HTML として読まない）ので、エスケープが既定になる。
// innerHTML は使わない。台本の文字（題・台詞・教材・ノート）に < や & があっても、そのまま文字で出る。
//   h('li', { class: 'x', 'data-k': 1 }, '文字', h('b', null, '強く'))   要素を作る（属性の値は文字にして入れる。on… の属性は止める）
//   svg('circle', { r: 10 })                                            SVG の要素を作る
//   put(el, ...children)                                                el の中身を入れ替える
//   rich('**強調** の文')                                                **強調** だけを <strong> にする（教材の文字の決まり）

/** 属性の値。false・null・undefined は付けない。true は値の無い属性にする */
export type AttrValue = string | number | boolean | null | undefined;
export type Attrs = Readonly<Record<string, AttrValue>>;
/** 中身。文字と数は文字のノードにする。false・null・undefined は入れない。配列は開く */
export type Child = Node | string | number | false | null | undefined | readonly Child[];

const SVG_NS = 'http://www.w3.org/2000/svg';

const setAttrs = (el: Element, attrs: Attrs | null | undefined) => {
  if (!attrs) return;
  for (const [name, value] of Object.entries(attrs)) {
    // イベントの属性（onclick など）は文字の値でも動くので、ここでは付けない（addEventListener を使う）
    if (/^on/i.test(name)) throw new Error(`イベントの属性は付けない: ${name}`);
    if (value === false || value === null || value === undefined) continue;
    el.setAttribute(name, value === true ? '' : String(value));
  }
};

const append = (parent: Node, children: readonly Child[]) => {
  for (const c of children) {
    if (c === false || c === null || c === undefined) continue;
    if (Array.isArray(c)) append(parent, c);
    else if (typeof c === 'string' || typeof c === 'number') parent.appendChild(document.createTextNode(String(c)));
    else parent.appendChild(c as Node);
  }
};

/** HTML の要素を作る */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Attrs | null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  setAttrs(el, attrs);
  append(el, children);
  return el;
}

/** SVG の要素を作る */
export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs?: Attrs | null,
  ...children: Child[]
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  setAttrs(el, attrs);
  append(el, children);
  return el;
}

/** el の中身を children に入れ替える */
export const put = (el: Element, ...children: Child[]) => {
  el.replaceChildren();
  append(el, children);
};

/** id の要素（テンプレートに必ずあるもの。無ければテンプレートの誤りなので止める） */
export const byId = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`ページに #${id} がありません（site/template.html）`);
  return el as T;
};

/** イベントの起きた所から、selector に合う要素を探す（無ければ null） */
export const closest = <T extends Element = HTMLElement>(event: Event, selector: string): T | null =>
  event.target instanceof Element ? event.target.closest<T>(selector) : null;

/** 教材の文字の **強調** を <strong> にする（ほかは文字のまま） */
export const rich = (text: string): Child[] => {
  const out: Child[] = [];
  let at = 0;
  for (const m of text.matchAll(/\*\*([^*]+)\*\*/g)) {
    const start = m.index ?? 0;
    out.push(text.slice(at, start), h('strong', null, m[1]));
    at = start + m[0].length;
  }
  out.push(text.slice(at));
  return out.filter((c) => c !== '');
};

/** 教材の段落。「- 」で始まる行は箇条書き（続いた行を 1 つの <ul> にまとめる）、ほかの空でない行は <p> */
export const paragraphs = (blocks: readonly string[]): Node[] => {
  const out: Node[] = [];
  let list: HTMLUListElement | null = null;
  for (const block of blocks) {
    for (const line of String(block).split('\n')) {
      if (line.startsWith('- ')) {
        if (!list) {
          list = h('ul');
          out.push(list);
        }
        list.append(h('li', null, rich(line.slice(2))));
      } else {
        list = null;
        if (line.trim()) out.push(h('p', null, rich(line)));
      }
    }
  }
  return out;
};
