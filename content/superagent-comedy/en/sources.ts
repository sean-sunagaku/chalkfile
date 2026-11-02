import type { CourseL10n } from '../../i18n';

/** 出典の説明の英語（題名は原題のまま）。docsTitles で、レクチャーの出典のリンクの題を作る */
export const SOURCES_EN: NonNullable<CourseL10n['sources']> = {
  'dsh-superagent-article': {
    title: 'Exploring Super-agent Design: Towards a More Autonomous Agent System',
    publisher: 'DeepSeek Harness team (an article on X, implemented and written by Yujia Qiao)',
    year: '2026, published Nov 1',
    note: 'The basis of the course. Read in its English version (the original is in Chinese; the article says the English version is a machine translation). It opens by saying it is about design ideas, not current DeepSeek Harness features. Four properties; five components (two layers, event-driven, full-duplex and multi-channel, separating compute, state and environment, Watchdog); preliminary experiments (synthetic workloads in a simplified environment, results given as reference values); open problems. X articles need a login and could not be opened by script (HTTP 402)',
  },
  'dsh-superagent-prototype': {
    title: 'dsh-superagent-prototype',
    publisher: 'deepseek-ai (GitHub)',
    year: '2026',
    note: 'A primary source from deepseek-ai, but not an official product. A prototype that tries part of the design. The README calls it a proactive coding agent for one GitHub repository, and says it is a research prototype, not an official DeepSeek product and not for production, and that parts of the design are future work not included here. MIT license',
  },
  'deepseek-harness-readme': {
    title: 'DeepSeek Harness (README)',
    publisher: 'deepseek-ai (GitHub)',
    year: '2026',
    note: 'DeepSeek Harness is a base for agents that grows by adding components as plugins (the command is dsh). MIT license. The README says it is a developer preview with breaking changes',
  },
  'anthropic-managed-agents': {
    title: 'Scaling Managed Agents: Decoupling the brain from the hands',
    publisher: 'Anthropic (Lance Martin, Gabe Cemaj, Michael Cohen)',
    year: '2026, Apr 8',
    note: 'An article the source names as going in the same direction. It separates the brain (Claude and the harness) from the hands (sandboxes and tools) and from the session (an append-only record of what happened). The harness keeps no state and can resume from the record after a crash',
  },
};

/** レクチャーの「出典・参考資料」のリンクの題（日本語の docsFrom と同じ並び: 発行元 (年) 題名） */
export const docsTitles = (ids: string[]): { title: string }[] =>
  ids.map((id) => {
    const s = SOURCES_EN[id];
    if (!s?.title) throw new Error(`出典が無い: ${id}`);
    return { title: `${s.publisher} (${s.year}) ${s.title}` };
  });
