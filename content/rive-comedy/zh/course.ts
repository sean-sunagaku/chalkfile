import type { CourseL10n } from '../../i18n';
import { R01 } from './R01';

/** 「笑ってわかる Rive アニメーション」の中国語（簡体字）版。声は Kokoro（content/voices.ts の KOKORO.zh） */
export const RIVE_COMEDY_ZH: CourseL10n = {
  title: '笑着搞懂 Rive 动画',
  subtitle: '和俊达萌一起快速了解 Rive（搞笑版）',
  headline: '**做好动画，原样就能动**的工具，快速了解',
  sections: [{ title: '快速入门' }],
  disclaimer: '本视频由个人制作，与 Rive 公司无关，属于非官方内容。搞笑角色的台词是故意说错的',
  cast: { zundamon: { name: '俊达萌' }, 'zundamon-cry': { name: '俊达萌' }, narrator: { name: '老师' }, tsukkomi: { name: '老师' }, tennokoe: { name: '旁白' } },
  ui: { takeaways: '要点', docs: '官方文档', searchHint: '状态机、运行时' },
  docsNote:
    '视频内容基于 2026 年 11 月 1 日阅读的 Rive 官方文档（运行时与状态机的页面）。功能、支持的环境和价格会变，使用前请在官方确认。俊达萌（搞笑角色）的台词是故意说错的。',
  sourceNote:
    '中文配音：Kokoro-82M-v1.1-zh（Apache-2.0）。本版中的俊达萌并非官方 VOICEVOX 的声音。脚本基于 Rive 的官方文档（2026 年 11 月确认），由日文版改编，笑点用中文重新创作。个人学习用的非官方视频，与 Rive 公司无关',
  // 1 本だけの動画。日本語の R01 は「表示は少なく」の決まりの前に作ったままだが、訳の動画は番号と根拠の札を出さない（comedy.md）
  standalone: true,
  lectures: { R01 },
};
