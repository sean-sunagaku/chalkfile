import type { CourseL10n } from '../../i18n';
import { P01 } from './P01';

/** 「笑ってわかる pstack」の英語版。声は Kokoro（content/voices.ts の KOKORO.en） */
export const PSTACK_COMEDY_EN: CourseL10n = {
  title: 'Laugh & Learn: pstack',
  subtitle: 'How the Cursor skill set pstack thinks, and how to use it',
  headline: 'A skill set built on **going deep first, to go fast**',
  sections: [{ title: 'Quick intro' }],
  disclaimer: 'An unofficial video made by an individual. Not affiliated with Cursor or the author of pstack. The comic lines are wrong on purpose',
  cast: { zundamon: { name: 'Zundamon' }, 'zundamon-cry': { name: 'Zundamon' }, narrator: { name: 'Teacher' }, tsukkomi: { name: 'Teacher' }, tennokoe: { name: 'Narrator' } },
  ui: { takeaways: 'Key points', docs: 'Official docs', searchHint: 'poteto-mode, skills' },
  docsNote:
    'This video is based on the pstack README and the descriptions of each skill and the /poteto-mode playbooks (cursor/plugins on GitHub, version 0.15.36), read on November 1, 2026. Skill counts, names and default models change, so check the README before you use it. Zundamon’s lines are wrong on purpose.',
  sourceNote:
    'English voices: Kokoro-82M (Apache-2.0). Zundamon is not voiced by the official VOICEVOX voice in this version. Script based on the pstack README and the descriptions of each skill and playbook (checked November 2026, version 0.15.36), adapted from the Japanese version with the jokes rewritten in English. An unofficial video for personal study, not affiliated with Cursor or the author of pstack',
  lectures: { P01 },
};
