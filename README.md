# Chalkfile の動画の素材

講座の動画を作るための素材だけを置くブランチです。main にはマージしません（`bun scripts/materials.ts push` のたびに、親の無い 1 コミットで置き換えます）。

素材があれば、台詞を変えていない章は VOICEVOX なしで、時刻 → 音のミックス → 動画 → 講座サイトまで作り直せます。手順はリポジトリの README の「素材から作り直す」です。

- 元にした台本: `d5c670eeb8278db69ec250c1ea7f792b372e6a9f（feat/ga4-comedy）`
- 全部で 757.7MB（音声は FLAC。取り出すと WAV に戻り、`SHA256SUMS` と同じ中身になる）

| パス | 中身 | 数 | 大きさ |
|---|---|---|---|
| `tts/stripe-billing/` | Stripe サブスク課金 基礎講座（13 レクチャー・ja）の台詞の音声（日本語は VOICEVOX、英語・中国語は Kokoro。48kHz・モノラル）と読み（日本語はカナ、ほかは音素） | 488 本 | 93.6MB |
| `tts/nudge-product/` | ナッジ理論をプロダクト改善に活かす（7 章・ja）の台詞の音声（日本語は VOICEVOX、英語・中国語は Kokoro。48kHz・モノラル）と読み（日本語はカナ、ほかは音素） | 438 本 | 83.3MB |
| `tts/uiux-engineers/` | エンジニアのための UI・UX デザイン（8 章・ja）の台詞の音声（日本語は VOICEVOX、英語・中国語は Kokoro。48kHz・モノラル）と読み（日本語はカナ、ほかは音素） | 471 本 | 96.6MB |
| `tts/indie-marketing/` | 個人開発者のためのマーケティング（8 章・ja）の台詞の音声（日本語は VOICEVOX、英語・中国語は Kokoro。48kHz・モノラル）と読み（日本語はカナ、ほかは音素） | 491 本 | 98.4MB |
| `tts/nudge-comedy/` | 笑って覚えるナッジ理論（1 章・ja・en・zh）の台詞の音声（日本語は VOICEVOX、英語・中国語は Kokoro。48kHz・モノラル）と読み（日本語はカナ、ほかは音素） | 345 本 | 47.7MB |
| `tts/rive-comedy/` | 笑ってわかる Rive アニメーション（1 レクチャー・ja・en・zh）の台詞の音声（日本語は VOICEVOX、英語・中国語は Kokoro。48kHz・モノラル）と読み（日本語はカナ、ほかは音素） | 174 本 | 22.9MB |
| `tts/pstack-comedy/` | 笑ってわかる pstack（1 レクチャー・ja・en・zh）の台詞の音声（日本語は VOICEVOX、英語・中国語は Kokoro。48kHz・モノラル）と読み（日本語はカナ、ほかは音素） | 215 本 | 28.1MB |
| `tts/superagent-comedy/` | 笑ってわかる Super-agent（6 章・ja・en・zh）の台詞の音声（日本語は VOICEVOX、英語・中国語は Kokoro。48kHz・モノラル）と読み（日本語はカナ、ほかは音素） | 1517 本 | 257.4MB |
| `tts/ga4-comedy/` | 笑ってわかる GA4（3 章・ja）の台詞の音声（日本語は VOICEVOX、英語・中国語は Kokoro。48kHz・モノラル）と読み（日本語はカナ、ほかは音素） | 119 本 | 15.8MB |
| `audio/music/`・`audio/sfx/` | BGM・ジングル・効果音（`scripts/build_music.py` の合成） | 15 個 | 13.9MB |
| `SHA256SUMS` | 取り出して WAV に戻した後のファイルの sha256（パスはリポジトリの最上位から） | | |

## 使い方

```bash
bun scripts/materials.ts pull                    # 全部の講座の素材を .work/tts/ と public/audio/ に取り出す
bun scripts/materials.ts pull nudge-product      # 1 つの講座だけ
bun scripts/materials.ts pull --videos           # Releases の動画も site/media/ に取り出す（ポスターは site/posters/）
```

## クレジットと利用規約

- 声（日本語）: VOICEVOX:No.7、VOICEVOX:青山龍星、VOICEVOX:ずんだもん、VOICEVOX:玄野武宏。音声を使うときは、VOICEVOX と各キャラクターの利用規約に従い、クレジットを書いてください
- 声（英語・中国語）: Kokoro-82M（hexgrad、Apache-2.0）の af_heart・af_bella・bm_george・am_fenrir・zf_019・zf_092・zm_031・zm_029（英語は Kokoro-82M、中国語は Kokoro-82M-v1.1-zh）
- BGM・ジングル・効果音: `scripts/build_music.py` が numpy で合成したオリジナル（外の音源は使っていません）
