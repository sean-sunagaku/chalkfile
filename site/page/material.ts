// 教材・実践課題・AI に聞くのタブ（教材を持つレクチャーだけ）。教材の文字は、**強調** と「- 」の箇条書きだけを要素にする（dom.ts の rich・paragraphs）
import type { Page } from './context';
import type { Evidence, LectureData, MaterialData, SourceLink } from './data';
import { byId, closest, h, paragraphs, put, rich } from './dom';
import { safeUrl } from './format';

/** 教材を持つレクチャーだけに出すタブ */
export const MATERIAL_TABS = ['material', 'exercise', 'ask'] as const;

/** 教材を用意する。showTab は、節へ移るときに教材のタブを開く */
export const createMaterial = (page: Page, showTab: (name: string) => void) => {
  const { T } = page;
  const label: Record<Evidence, string> = {
    research: T.evResearch,
    official: T.evOfficial,
    practice: T.evPractice,
    example: T.evExample,
  };
  const chips = (list: readonly Evidence[]) =>
    h(
      'div',
      { class: 'evs' },
      list.map((e) => h('span', { class: `ev ${e}` }, label[e] ?? e)),
    );
  const sources = (list: readonly SourceLink[]) =>
    list.length > 0 &&
    h(
      'p',
      { class: 'msrc' },
      T.srcHead,
      list.map((s, i) => [
        i > 0 && T.srcSep,
        h(
          'a',
          { href: safeUrl(s.url, location.href), target: '_blank', rel: 'noopener noreferrer' },
          `${s.publisher}（${s.year}）`,
        ),
      ]),
    );
  const figure = (f: MaterialData['figures'][number]) =>
    h(
      'div',
      { class: 'fig', id: f.id },
      h('span', { class: 'sid' }, f.id),
      h('h4', null, f.title),
      chips([f.evidence]),
      h('p', { class: 'cap' }, rich(f.caption)),
      f.table &&
        h(
          'table',
          { class: 'mtable' },
          h(
            'thead',
            null,
            h(
              'tr',
              null,
              (f.table[0] ?? []).map((c) => h('th', null, rich(c))),
            ),
          ),
          h(
            'tbody',
            null,
            f.table.slice(1).map((r) =>
              h(
                'tr',
                null,
                r.map((c) => h('td', null, rich(c))),
              ),
            ),
          ),
        ),
      f.flow &&
        h(
          'div',
          { class: 'flowline' },
          f.flow.map((x, i) => [
            i > 0 && h('span', { class: 'ar', 'aria-hidden': 'true' }, '→'),
            h('span', { class: 'st' }, rich(x)),
          ]),
        ),
      f.code && h('pre', null, h('code', null, f.code)),
    );
  const list = (items: readonly string[]) => items.map((g) => h('li', null, rich(g)));

  /** 教材・実践課題・質問例を描く。教材の無いレクチャーではタブを隠し、教材のタブを開いていたら概要に戻す */
  const render = (lec: LectureData, storedTab: string | null) => {
    const m = lec.material;
    for (const t of MATERIAL_TABS) byId(`tab-${t}`).hidden = !m;
    if (!m) {
      if ((MATERIAL_TABS as readonly string[]).includes(storedTab ?? 'overview')) showTab('overview');
      return;
    }
    put(byId('matGoals'), list(m.goals));
    put(byId('matPre'), list(m.prerequisites));
    put(
      byId('matToc'),
      m.sections.map((s, i) => h('a', { href: `#${s.id}`, 'data-sec': s.id }, `${i + 1}. ${s.title}`)),
    );
    put(
      byId('matBody'),
      m.sections.map((s) =>
        h(
          'section',
          { class: 'msec', id: s.id },
          h('span', { class: 'sid' }, s.id),
          h('h3', null, s.title),
          chips(s.evidence),
          paragraphs(s.body),
          sources(s.sources),
        ),
      ),
    );
    put(byId('matFigs'), m.figures.map(figure));
    put(byId('matSummary'), list(m.summary));
    const ex = m.exercise;
    put(
      byId('exBody'),
      h(
        'div',
        { class: 'msec', id: ex.id },
        h('span', { class: 'sid' }, ex.id),
        h('h3', null, ex.title),
        h('p', null, h('strong', null, T.exGoal), '　', rich(ex.goal)),
        h('p', null, h('strong', null, T.exTime), '　', ex.timebox),
        h('p', null, h('strong', null, T.exOut), '　', rich(ex.deliverable)),
        h('h3', { style: 'margin-top:14px' }, T.exSteps),
        h('ol', { class: 'mat-list' }, list(ex.steps)),
      ),
      h(
        'div',
        { class: 'msec' },
        h('h3', null, T.exExample, ex.example.title),
        chips(['example']),
        paragraphs(ex.example.body),
      ),
      h(
        'div',
        { class: 'fig' },
        h('h4', null, T.rubric),
        h(
          'table',
          { class: 'mtable' },
          h(
            'thead',
            null,
            h(
              'tr',
              null,
              h('th', null, T.rubricAspect),
              h('th', null, T.rubricGood),
              h('th', null, T.rubricFair),
              h('th', null, T.rubricPoor),
            ),
          ),
          h(
            'tbody',
            null,
            ex.rubric.map((r) =>
              h(
                'tr',
                null,
                h('td', null, h('strong', null, rich(r.criterion))),
                h('td', null, rich(r.good)),
                h('td', null, rich(r.fair)),
                h('td', null, rich(r.poor)),
              ),
            ),
          ),
        ),
      ),
    );
    put(
      byId('askList'),
      m.askExamples.map((a) =>
        h(
          'li',
          null,
          h('div', { class: 'qq' }, a.q),
          h(
            'div',
            { class: 'refs' },
            T.askRefs,
            a.refs.map((r) => h('button', { type: 'button', 'data-sec': r }, r)),
          ),
        ),
      ),
    );
  };

  /** 節へ移る（目次と、質問例の参照） */
  const gotoSection = (id: string) => {
    showTab('material');
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  byId('matToc').addEventListener('click', (e) => {
    const a = closest(e, 'a[data-sec]');
    if (!a) return;
    e.preventDefault();
    gotoSection(String(a.dataset.sec));
  });
  byId('askList').addEventListener('click', (e) => {
    const b = closest(e, 'button[data-sec]');
    if (b) gotoSection(String(b.dataset.sec));
  });

  return { render };
};
