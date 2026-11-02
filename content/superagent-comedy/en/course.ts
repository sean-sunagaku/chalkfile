import type { CourseL10n } from '../../i18n';
import { S01 } from './S01';
import { S02 } from './S02';
import { S03 } from './S03';
import { S04 } from './S04';
import { S05 } from './S05';
import { S06 } from './S06';
import { SOURCES_EN } from './sources';

/** 「笑ってわかる Super-agent」の英語版。声は Kokoro（scripts/voices.ts の KOKORO.en） */
export const SUPERAGENT_COMEDY_EN: CourseL10n = {
  title: 'Laugh & Learn: Super-agent',
  subtitle: 'Reading a design for agents that are not tied to one session, with Zundamon',
  headline: 'Agent design that stops human **attention** from being the bottleneck',
  sections: [{ title: 'Introduction' }, { title: 'Two layers' }, { title: 'Event-driven' }, { title: 'Never stopping' }],
  disclaimer: 'An unofficial video made by an individual. Not affiliated with DeepSeek or the DeepSeek Harness team. The comic lines are wrong on purpose',
  cast: { zundamon: { name: 'Zundamon' }, 'zundamon-cry': { name: 'Zundamon' }, narrator: { name: 'Teacher' }, tsukkomi: { name: 'Teacher' }, tennokoe: { name: 'Narrator' } },
  ui: { takeaways: 'Key points', docs: 'Sources and reading', searchHint: 'Router, pass-through, Watchdog' },
  docsNote:
    'This video summarizes the English version of "Exploring Super-agent Design: Towards a More Autonomous Agent System", published on X by the DeepSeek Harness team on November 1, 2026 (the original is in Chinese; the article says the English version is a machine translation), read on November 2, 2026. The article proposes design ideas; it does not describe current features of DeepSeek Harness. The experiment numbers are reference values the authors measured with synthetic workloads in a simplified environment. Zundamon’s lines are wrong on purpose.',
  sourceNote:
    'English voices: Kokoro-82M (Apache-2.0). Zundamon is not voiced by the official VOICEVOX voice in this version. Script and figures made in our own words and our own diagrams, based on the DeepSeek Harness team’s article (published November 1, 2026, checked November 2), the prototype repository and an Anthropic article; adapted from the Japanese version with the jokes rewritten in English. An unofficial video for personal study, not affiliated with DeepSeek',
  sources: SOURCES_EN,
  lectures: { S01, S02, S03, S04, S05, S06 },
};
