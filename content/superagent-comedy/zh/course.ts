import type { CourseL10n } from '../../i18n';
import { S01 } from './S01';
import { S02 } from './S02';
import { S03 } from './S03';
import { S04 } from './S04';
import { S05 } from './S05';
import { S06 } from './S06';
import { SOURCES_ZH } from './sources';

/** 「笑ってわかる Super-agent」の中国語（簡体字）版。声は Kokoro（content/voices.ts の KOKORO.zh） */
export const SUPERAGENT_COMEDY_ZH: CourseL10n = {
  title: '笑着搞懂 Super-agent',
  subtitle: '和俊达萌一起读懂：不被会话束缚的智能体设计',
  headline: '不让人的**注意力**成为瓶颈的智能体设计',
  sections: [{ title: '开篇' }, { title: '两层结构' }, { title: '事件驱动' }, { title: '永不停止的机制' }],
  disclaimer: '本视频由个人制作，与 DeepSeek 及 DeepSeek Harness 团队无关，属于非官方内容。搞笑角色的台词是故意说错的',
  cast: { zundamon: { name: '俊达萌' }, 'zundamon-cry': { name: '俊达萌' }, narrator: { name: '老师' }, tsukkomi: { name: '老师' }, tennokoe: { name: '旁白' } },
  ui: { takeaways: '要点', docs: '出处与参考资料', searchHint: 'Router、直通、Watchdog' },
  docsNote:
    '视频内容是 2026 年 11 月 2 日阅读并整理的：DeepSeek Harness 团队于 2026 年 11 月 1 日在 X 上发表的文章《Exploring Super-agent Design: Towards a More Autonomous Agent System》的英文版（原文是中文，文章中说明英文版为机器翻译）。文章提出的是设计思路，并不是介绍 DeepSeek Harness 现有的功能。实验数字是作者用自制负载、在简化环境中测得的参考值。俊达萌（搞笑角色）的台词是故意说错的。',
  sourceNote:
    '中文配音：Kokoro-82M-v1.1-zh（Apache-2.0）。本版中的俊达萌并非官方 VOICEVOX 的声音。脚本和图基于 DeepSeek Harness 团队的文章（2026 年 11 月 1 日发表，11 月 2 日确认）、原型仓库以及 Anthropic 的文章，用我们自己的话和自己的图制作，由日文版改编，笑点用中文重新创作。个人学习用的非官方视频，与 DeepSeek 无关',
  sources: SOURCES_ZH,
  lectures: { S01, S02, S03, S04, S05, S06 },
};
