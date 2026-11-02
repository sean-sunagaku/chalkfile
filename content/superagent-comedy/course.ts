import type { Course } from '../types';
import { S01 } from './S01';
import { S02 } from './S02';
import { S03 } from './S03';
import { S04 } from './S04';
import { S05 } from './S05';
import { S06 } from './S06';
import { SUPERAGENT_SOURCES } from './sources';

/**
 * DeepSeek Harness チームの記事「Exploring Super-agent Design」を読み解くお笑い版（全 6 章）。
 * ずんだもん（ボケ）・先生（ツッコミ）・天の声の掛け合いで、記事の設計の考え方を順に見る。
 */
export const SUPERAGENT_COMEDY: Course = {
  id: 'superagent-comedy',
  unitLabel: 'CHAPTER',
  theme: 'stage',
  disclaimer: 'DeepSeek・DeepSeek Harness のチームとは関係のない、個人が作った非公式の動画です。ボケの台詞は、わざと間違えています',
  title: '笑ってわかる Super-agent',
  subtitle: 'セッションに縛られないエージェントの設計を、ずんだもんと読み解くお笑い版',
  headline: '人の**注意**を、ボトルネックにしないエージェントの設計',
  sections: [
    { no: 1, title: 'はじめに' },
    { no: 2, title: '二層構造' },
    { no: 3, title: 'イベント駆動' },
    { no: 4, title: '止まらない仕組み' },
  ],
  lectures: [S01, S02, S03, S04, S05, S06],
  cast: {
    zundamon: { name: 'ずんだもん', tone: 'mint' },
    'zundamon-cry': { name: 'ずんだもん', tone: 'mint' },
    narrator: { name: '先生', tone: 'coral' },
    tsukkomi: { name: '先生', tone: 'coral' },
    tennokoe: { name: '天の声', tone: 'violet' },
  },
  sources: SUPERAGENT_SOURCES,
  ui: { takeaways: '要点メモ', docs: '出典・参考資料', searchHint: 'Router、パススルー、Watchdog' },
  docsNote:
    '動画の内容は、DeepSeek Harness のチームが 2026 年 11 月 1 日に X で公開した記事「Exploring Super-agent Design: Towards a More Autonomous Agent System」の英語版（原文は中国語で、英語版は機械翻訳と記事に書かれている）を、2026 年 11 月 2 日に読んでまとめたものです。記事は設計の考え方の提案で、DeepSeek Harness の今の機能の紹介ではありません。実験の数字は、記事の著者が作った負荷と簡単にした環境で測った参考の値です。ずんだもん（ボケ）の台詞は、わざと間違えています。',
  sourceNote:
    'ボケの声は VOICEVOX:ずんだもん、天の声は VOICEVOX:玄野武宏。台本と図は、DeepSeek Harness のチームの記事（2026 年 11 月 1 日公開、11 月 2 日確認）と、試作のリポジトリ・Anthropic の記事をもとに、自分の言葉と自分の図で作成。DeepSeek とは関係のない、個人の勉強用の非公式の動画です',
};
