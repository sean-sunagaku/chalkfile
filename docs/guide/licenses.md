# 物ごとのライセンス

Chalkfile のリポジトリと、そこから作る動画・講座サイトの、物ごとのライセンスと使うときの条件。

- リポジトリのライセンスの全文は [LICENSE](../../LICENSE)（MIT）。使っているパッケージと道具のライセンスは [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md)、免責は [DISCLAIMER.md](../../DISCLAIMER.md)
- 声とクレジットの定義は `engine/core/voices.ts`（日本語の声は `VOICES` の `credit`、英語と中国語の声は `KOKORO`）。声を足したら、この表も合わせる

## 表

| 物 | 置き場所 | ライセンス・規約 | 使うときに要ること |
|---|---|---|---|
| コード（動画のエンジン・作る道具・サイト・Worker・テスト） | `src/`・`engine/`・`scripts/`・`site/`・`worker/`・`tests/` | MIT | 著作権の表示とライセンスの文を残す |
| 台本の文（台詞・画面の文字・確認クイズ・読む教材）とテーマ | `content/`（読む教材の生成物は `docs/courses/`） | MIT（コードと同じ。理由は [ADR](../adr/2026-11-03-script-text-license.md)） | 著作権の表示とライセンスの文を残す。事実は確かめた日の情報なので、使う前に公式で確かめ直す |
| 日本語の声（VOICEVOX:No.7・VOICEVOX:青山龍星・VOICEVOX:ずんだもん・VOICEVOX:玄野武宏） | 動画の中と、素材の `materials` ブランチ（`tts/`） | MIT ではない。[VOICEVOX の利用規約](https://voicevox.hiroshiba.jp/term/)と、キャラクターごとの音声ライブラリの利用規約に従う | クレジット（`VOICEVOX:ずんだもん` の形）を書く。キャラクターごとの規約は、[VOICEVOX の公式サイト](https://voicevox.hiroshiba.jp/)の各キャラクターのページから開く |
| 英語と中国語の声（Kokoro-82M・Kokoro-82M-v1.1-zh で、手元で合成した音声） | 動画の中と、素材の `materials` ブランチ（`tts/`） | 合成に使ったモデルの重みとコードは Apache-2.0（hexgrad）。中国語の声のデータは、LongMaoData が許諾したもの（モデルカード） | 動画とサイトに、モデルと声の名前（`Kokoro-82M (af_heart)` の形）を書いている |
| キャラクター（ずんだもん） | 動画の中（名前と声） | 東北ずん子・ずんだもんプロジェクトの [キャラクター利用の手引き](https://zunko.jp/guideline.html) | 英語版・中国語版のずんだもんの声は、VOICEVOX ではなく Kokoro の声 |
| 書体（Zen Maru Gothic・Noto Sans JP・Noto Sans SC・Inter・JetBrains Mono） | 動画の文字に焼き込む。サイトは Google Fonts から読み込む | SIL Open Font License 1.1 | 書体のファイルは、このリポジトリに入れていない |
| BGM・ジングル・効果音 | `scripts/build_music.py` が合成する。素材の `materials` ブランチの `audio/` | このリポジトリで合成したオリジナル（外の音源は使わない）。合成のコードは MIT | — |
| アイコン（lucide） | 動画の中 | ISC | — |
| 動画（MP4）とポスター（JPG） | GitHub の Releases（タグは `media-<言語>-<講座 ID>`）と、`content/<講座>/generated/posters/` | 上の物を組み合わせたもの。入っている物ごとに、上の条件に従う | 声のクレジットは、動画の終わり・サイト・納品物の README（`npm run chalk -- export`）・読む教材に出している |
| 動画を作る道具 Remotion | 依存（`remotion`・`@remotion/*`） | [Remotion License](https://www.remotion.dev/license)。個人と小さな会社は無料。会社の規模によっては、有料のライセンスが要る | 自分で動画を書き出すとき |

- サービス名・会社名・製品名は、各社の商標。講座では、取り上げる製品を指すためだけに名前を使う（[DISCLAIMER.md](../../DISCLAIMER.md)）
- このリポジトリに出したもの（コード・台本・テーマ）は、MIT で公開されることに同意したものとする（[CONTRIBUTING.md](../../CONTRIBUTING.md) の「ライセンス」）
