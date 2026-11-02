import type { CourseL10n } from '../../i18n';

/** 出典の説明の中国語（題名は原題のまま）。docsTitles で、レクチャーの出典のリンクの題を作る */
export const SOURCES_ZH: NonNullable<CourseL10n['sources']> = {
  'dsh-superagent-article': {
    title: 'Exploring Super-agent Design: Towards a More Autonomous Agent System',
    publisher: 'DeepSeek Harness 团队（X 上的文章，实现与撰写：Yujia Qiao）',
    year: '2026，11 月 1 日发表',
    note: '本课程主张的来源。阅读的是英文版（原文是中文，文章中说明英文版为机器翻译）。开头写明这是关于设计思路的文章，不是介绍 DeepSeek Harness 现有的功能。四个特性、五个部件（两层结构、事件驱动、全双工与多渠道、计算与状态与环境的分离、Watchdog）、初步实验（用合成负载在简化环境中进行，文章说明结果为参考值）、遗留课题。X 的文章需要登录，无法用脚本打开（HTTP 402）',
  },
  'dsh-superagent-prototype': {
    title: 'dsh-superagent-prototype',
    publisher: 'deepseek-ai（GitHub）',
    year: '2026',
    note: '来自 deepseek-ai 的一手资料，但并非正式产品。尝试了文章部分设计的原型。README 称其为面向单个 GitHub 仓库、会主动行动的编程智能体，并说明这是研究用原型，不是 DeepSeek 的官方产品，不适用于生产环境，文章中的部分设计属于未来方向，没有包含在这个原型中。MIT 许可证',
  },
  'deepseek-harness-readme': {
    title: 'DeepSeek Harness（README）',
    publisher: 'deepseek-ai（GitHub）',
    year: '2026',
    note: 'DeepSeek Harness 是通过插件不断添加部件的智能体基础框架（命令是 dsh）。MIT 许可证。README 说明这是开发者预览版，会有不兼容的变更',
  },
  'anthropic-managed-agents': {
    title: 'Scaling Managed Agents: Decoupling the brain from the hands',
    publisher: 'Anthropic（Lance Martin、Gabe Cemaj、Michael Cohen）',
    year: '2026，4 月 8 日',
    note: '文章介绍为“同一方向”的文章。把大脑（Claude 与 harness）同双手（沙箱与工具）以及会话（只追加记录所发生事情的日志）分离开。harness 不保存状态，崩溃后也能从记录中恢复',
  },
};

/** レクチャーの「出典・参考資料」のリンクの題（日本語の docsFrom と同じ並び: 発行元（年）題名） */
export const docsTitles = (ids: string[]): { title: string }[] =>
  ids.map((id) => {
    const s = SOURCES_ZH[id];
    if (!s?.title) throw new Error(`出典が無い: ${id}`);
    return { title: `${s.publisher}（${s.year}）${s.title}` };
  });
