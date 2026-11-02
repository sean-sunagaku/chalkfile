import type { CourseL10n } from '../../i18n';
import { R01 } from './R01';

/** 「笑ってわかる Rive アニメーション」の英語版。声は Kokoro（scripts/voices.ts の KOKORO.en） */
export const RIVE_COMEDY_EN: CourseL10n = {
  title: 'Laugh & Learn: Rive Animation',
  subtitle: 'Getting the gist of Rive with Zundamon, comedy edition',
  headline: 'A quick look at the tool that lets you **make motion and run it as is**',
  sections: [{ title: 'Quick intro' }],
  disclaimer: 'An unofficial video made by an individual. Not affiliated with Rive. The comic lines are wrong on purpose',
  cast: { zundamon: { name: 'Zundamon' }, 'zundamon-cry': { name: 'Zundamon' }, narrator: { name: 'Teacher' }, tsukkomi: { name: 'Teacher' }, tennokoe: { name: 'Narrator' } },
  ui: { takeaways: 'Key points', docs: 'Official docs', searchHint: 'state machine, runtime' },
  docsNote:
    'This video is based on Rive’s official docs (the Runtimes and State Machine pages), read on November 1, 2026. Features, supported platforms and pricing change, so check the official site before you use it. Zundamon’s lines are wrong on purpose.',
  sourceNote:
    'English voices: Kokoro-82M (Apache-2.0). Zundamon is not voiced by the official VOICEVOX voice in this version. Script based on Rive’s official docs (checked November 2026), adapted from the Japanese version with the jokes rewritten in English. An unofficial video for personal study, not affiliated with Rive',
  // 1 本だけの動画。日本語の R01 は「表示は少なく」の決まりの前に作ったままだが、訳の動画は番号と根拠の札を出さない（comedy.md）
  standalone: true,
  lectures: { R01 },
};
