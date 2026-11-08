import { comedyCast } from '../_shared/comedy';
import type { Course } from '../types';
import { A01 } from './A01';
import { A02 } from './A02';
import { A03 } from './A03';
import { A04 } from './A04';
import { SOURCES } from './sources';

/**
 * Anthropic の記事「The components of agent memory」を読み解くお笑い版（全 4 章）。
 * ずんだもん（ボケ）・先生（ツッコミ）・天の声の掛け合いで、記憶の層・メモの書き方・夢（dreaming）による直し方と育て方を順に見る。
 * 章をまたぐネタ: ずんだもんの記憶フォルダの数（ずんだ餅の日記）、記憶の「クイズ、全勝」（第 3 章で記録と照らして直す）、
 * 先生の付箋、天の声の正体（この講座の記録＝トランスクリプト。第 3 章で明かす）
 */
export const AGENT_MEMORY_COMEDY: Course = {
  id: 'agent-memory-comedy',
  prefix: 'A',
  order: 110,
  unitLabel: 'CHAPTER',
  theme: 'stage',
  disclaimer: 'Anthropic・ゲームの権利者とは関係のない、個人が作った非公式の動画です。ボケの台詞は、わざと間違えています',
  title: '笑ってわかる エージェントの記憶',
  subtitle: 'AI のエージェントは、何を覚え、どう直すのか。Anthropic の記事を 4 章で読み解く',
  headline: '記憶は、ときに**未来への予言**。夢で振り返って、直して育てる',
  sections: [
    { no: 1, title: 'メモを書く' },
    { no: 2, title: '夢で直し、育てる' },
  ],
  lectures: [A01, A02, A03, A04],
  cast: comedyCast(),
  sources: SOURCES,
  ui: { takeaways: '要点メモ', docs: '出典・参考資料', searchHint: '夢、wiki、MEMORY.md' },
  docsNote:
    '動画の内容は、Anthropic が 2026 年 11 月 6 日に公開した記事「The components of agent memory」（Engineering の記事。著者は Lance Martin）を、2026 年 11 月 8 日に読んでまとめたものです。記事が紹介する Claude Code の記憶のドキュメント・sleep-time compute の論文・Continual Learning Bench（CL-Bench）の技術報告も、同じ日に確かめました。Claude Managed Agents の記憶はベータ、夢（dreams）は申請制のリサーチプレビューです（2026 年 11 月時点）。実験の数字は、記事の著者が記事に書いた条件（ベンチマーク・ゲーム・文書の集まり）で測った値で、ほかの仕事で同じになるとは限りません。モデルの名前と機能は変わることがあるので、使う前に公式のドキュメントで確かめてください。ずんだもん（ボケ）の台詞は、わざと間違えています。',
  sourceNote:
    '台本と図は、Anthropic の記事（2026 年 11 月 8 日確認）と、記事が紹介するドキュメント・論文をもとに、自分の言葉と自分の図で作成。記事の図は使っていません。ゲームの名前は、記事の実験を説明するために書いています。Anthropic・ゲームの権利者とは関係のない、個人の勉強用の非公式の動画です',
};
