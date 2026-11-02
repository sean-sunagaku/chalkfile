import type { Source } from '../types';

/**
 * Super-agent のお笑い版の出典。checked は出典を開いて確かめた日。
 * もとの記事は設計の考え方の提案（製品の機能の説明ではない）なので、実務の指針（practice）として扱う。
 */
export const SUPERAGENT_SOURCES: Source[] = [
  {
    id: 'dsh-superagent-article',
    title: 'Exploring Super-agent Design: Towards a More Autonomous Agent System',
    url: 'https://x.com/DeepSeekHarness/article/2116857257245987236',
    publisher: 'DeepSeek Harness チーム（X の記事。実装と執筆は Yujia Qiao）',
    year: '2026（11 月 1 日公開）',
    kind: 'practice',
    checked: '2026-11-02',
    note: '講座の主張のもと。英語版を読んだ（原文は中国語で、英語版は機械翻訳と記事に書かれている）。設計の考え方の記事で、DeepSeek Harness の今の機能の紹介ではないと冒頭にある。4 つの性質・5 つの部品（二層構造・イベント駆動・全二重とマルチチャンネル・計算と状態と環境の分離・Watchdog）・予備の実験（合成した負荷と簡単にした環境で、結果は参考の値と記事に書かれている）・残る課題。X の記事はログインが要り、スクリプトでは開けなかった（HTTP 402）',
  },
  {
    id: 'dsh-superagent-prototype',
    title: 'dsh-superagent-prototype',
    url: 'https://github.com/deepseek-ai/dsh-superagent-prototype',
    publisher: 'deepseek-ai（GitHub）',
    year: '2026',
    kind: 'practice',
    checked: '2026-11-02',
    note: 'deepseek-ai の一次資料だが、製品としては非公式。記事の設計の一部を試した試作。README は「1 つの GitHub リポジトリ向けの、先回りするコーディングエージェント」と説明し、研究用の試作で DeepSeek の公式の製品ではない、本番向けではない、記事の設計の一部は今後の方向でこの試作には入っていない、と書いている。MIT ライセンス',
  },
  {
    id: 'deepseek-harness-readme',
    title: 'DeepSeek Harness（README）',
    url: 'https://github.com/deepseek-ai/deepseek-harness',
    publisher: 'deepseek-ai（GitHub）',
    year: '2026',
    kind: 'official',
    checked: '2026-11-02',
    note: 'DeepSeek Harness は、部品をプラグインとして足していくエージェントの土台（コマンドは dsh）。MIT ライセンス。開発者プレビューで、互換性が壊れる変更があると README に書かれている',
  },
  {
    id: 'anthropic-managed-agents',
    title: 'Scaling Managed Agents: Decoupling the brain from the hands',
    url: 'https://www.anthropic.com/research/managed-agents',
    publisher: 'Anthropic（Lance Martin・Gabe Cemaj・Michael Cohen）',
    year: '2026（4 月 8 日）',
    kind: 'practice',
    checked: '2026-11-02',
    note: '記事が「同じ方向」と紹介している文章。脳（Claude とハーネス）を、手（サンドボックスや道具）と、セッション（起きたことを追記していく記録）から切り離す。ハーネスは状態を持たず、落ちても記録から再開できる',
  },
];
