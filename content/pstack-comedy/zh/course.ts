import type { CourseL10n } from '../../i18n';
import { P01 } from './P01';

/** 「笑ってわかる pstack」の中国語（簡体字）版。声は Kokoro（content/voices.ts の KOKORO.zh） */
export const PSTACK_COMEDY_ZH: CourseL10n = {
  title: '笑着搞懂 pstack',
  subtitle: 'Cursor 的技能合集 pstack：思路与用法',
  headline: '**想走得快，先挖得深**的技能合集',
  sections: [{ title: '快速入门' }],
  disclaimer: '本视频由个人制作，与 Cursor 公司及 pstack 的作者无关，属于非官方内容。搞笑角色的台词是故意说错的',
  cast: { zundamon: { name: '俊达萌' }, 'zundamon-cry': { name: '俊达萌' }, narrator: { name: '老师' }, tsukkomi: { name: '老师' }, tennokoe: { name: '旁白' } },
  ui: { takeaways: '要点', docs: '官方说明', searchHint: 'poteto-mode、技能' },
  docsNote:
    '视频内容基于 2026 年 11 月 1 日阅读的 pstack README，以及各技能和 /poteto-mode 流程手册的说明（GitHub 上的 cursor/plugins，版本 0.15.36）。技能的数量、名称和默认模型会变，使用前请在 README 中确认。俊达萌（搞笑角色）的台词是故意说错的。',
  sourceNote:
    '中文配音：Kokoro-82M-v1.1-zh（Apache-2.0）。本版中的俊达萌并非官方 VOICEVOX 的声音。脚本基于 pstack 的 README 及各技能、流程手册的说明（2026 年 11 月确认，版本 0.15.36），由日文版改编，笑点用中文重新创作。个人学习用的非官方视频，与 Cursor 公司及 pstack 的作者无关',
  lectures: { P01 },
};
