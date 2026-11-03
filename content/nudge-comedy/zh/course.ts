import type { CourseL10n } from '../../i18n';
import { SOURCES_ZH } from './sources';
import { W01 } from './W01';

/** 「笑って覚えるナッジ理論」の中国語（簡体字）版。声は Kokoro（content/voices.ts の KOKORO.zh）。真面目版（nudge-product）は日本語だけなので、リンクにそう書く */
export const NUDGE_COMEDY_ZH: CourseL10n = {
  title: '笑着记住助推理论',
  subtitle: '助推课程的搞笑版，在装傻与吐槽的一来一回中记住',
  headline: '**笑出来的那一刻**，就是懂了的那一刻',
  sections: [{ title: '开篇' }, { title: '助推的工具' }, { title: '边界与伦理' }, { title: '实践' }],
  disclaimer: '搞笑角色的台词是故意说错的。正确内容，请以老师的吐槽和画面为准',
  cast: { zundamon: { name: '俊达萌' }, 'zundamon-cry': { name: '俊达萌' }, narrator: { name: '老师' }, tsukkomi: { name: '老师' }, tennokoe: { name: '旁白' } },
  links: [{ label: '正经版（日语，附教材和练习）' }],
  ui: { takeaways: '要点', docs: '出处与参考资料', searchHint: '暗黑模式、sludge、非法拘禁' },
  docsNote:
    '视频中的观点和出处，与正经版课程《把助推理论用于产品改进》（日文）的第 1 章相同，依据的是 2026 年 10 月 30 日打开确认过的研究论文与官方资料。俊达萌（搞笑角色）的台词，是为了搞笑故意说错的。正确内容，请以老师的吐槽和画面上的表格为准。阅读教材和实践作业在正经版里（日文）。本课程不承诺任何效果。',
  sourceNote:
    '中文配音：Kokoro-82M-v1.1-zh（Apache-2.0）。本版中的俊达萌并非官方 VOICEVOX 的声音。脚本和图基于与正经版助推课程相同的研究和官方资料（Thaler & Sunstein 等，2026 年 10 月确认），由日文版改编，笑点用中文重新创作。“示例记账”是虚构的应用，数字是用于说明的假设例子',
  sources: SOURCES_ZH,
  lectures: { W01 },
};
