import type { CourseL10n } from '../../i18n';
import { SOURCES_EN } from './sources';
import { W01 } from './W01';

/** 「笑って覚えるナッジ理論」の英語版。声は Kokoro（content/voices.ts の KOKORO.en）。真面目版（nudge-product）は日本語だけなので、リンクにそう書く */
export const NUDGE_COMEDY_EN: CourseL10n = {
  title: 'Laugh & Learn: Nudge Theory',
  subtitle: 'The comedy version of the nudge course, learned through a comic double act',
  headline: '**The moment you laugh** is the moment you get it',
  sections: [{ title: 'Introduction' }, { title: 'Tools of nudging' }, { title: 'Boundaries and ethics' }, { title: 'In practice' }],
  disclaimer: "The comic lines are wrong on purpose. Check the correct content in the Teacher's comebacks and on screen",
  cast: { zundamon: { name: 'Zundamon' }, 'zundamon-cry': { name: 'Zundamon' }, narrator: { name: 'Teacher' }, tsukkomi: { name: 'Teacher' }, tennokoe: { name: 'Narrator' } },
  links: [{ label: 'Serious version (in Japanese, with readings and exercises)' }],
  ui: { takeaways: 'Key points', docs: 'Sources and reading', searchHint: 'dark pattern, sludge, hostage-taking' },
  docsNote:
    'The claims and sources in the video are the same as Chapter 1 of the serious course, "Applying Nudge Theory to Product Improvement" (in Japanese), based on research papers and official documents opened and checked on October 30, 2026. Zundamon’s lines (the comic role) are wrong on purpose, for laughs. Check the correct content in the Teacher’s comebacks and the table on screen. The readings and the exercise are in the serious version (in Japanese). This does not promise any effect.',
  sourceNote:
    'English voices: Kokoro-82M (Apache-2.0). Zundamon is not voiced by the official VOICEVOX voice in this version. Script and figures based on the same research and official documents as the serious nudge course (Thaler & Sunstein and others, checked October 2026), adapted from the Japanese version with the jokes rewritten in English. Sample Budget is a fictional app, and its numbers are made-up examples for explanation',
  sources: SOURCES_EN,
  lectures: { W01 },
};
