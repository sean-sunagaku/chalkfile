# Chalkfile の動画の素材

講座の動画を作るための素材だけを置くブランチです。main にはマージしません（`bun scripts/materials.ts push` のたびに、親の無い 1 コミットで置き換えます）。

素材があれば、台詞を変えていない章は VOICEVOX なしで、時刻 → 音のミックス → 動画 → 講座サイトまで作り直せます。手順はリポジトリの README の「素材から作り直す」です。

- 元にした台本: `0390f43f39661198790c842cf88c9c132da491a5（HEAD）`
- 全部で 494.6MB（音声は FLAC。取り出すと WAV に戻り、`SHA256SUMS` と同じ中身になる）

| パス | 中身 | 数 | 大きさ |
|---|---|---|---|
| `tts/stripe-billing/` | Stripe サブスク課金 基礎講座（13 レクチャー）の台詞の音声（VOICEVOX・48kHz・モノラル）と読み（カナ） | 488 本 | 93.6MB |
| `tts/nudge-product/` | ナッジ理論をプロダクト改善に活かす（7 章）の台詞の音声（VOICEVOX・48kHz・モノラル）と読み（カナ） | 438 本 | 83.3MB |
| `tts/uiux-engineers/` | エンジニアのための UI・UX デザイン（8 章）の台詞の音声（VOICEVOX・48kHz・モノラル）と読み（カナ） | 471 本 | 96.6MB |
| `tts/indie-marketing/` | 個人開発者のためのマーケティング（8 章）の台詞の音声（VOICEVOX・48kHz・モノラル）と読み（カナ） | 491 本 | 98.4MB |
| `tts/nudge-comedy/` | 笑って覚えるナッジ理論（1 章）の台詞の音声（VOICEVOX・48kHz・モノラル）と読み（カナ） | 115 本 | 14.4MB |
| `tts/rive-comedy/` | 笑ってわかる Rive アニメーション（1 レクチャー）の台詞の音声（VOICEVOX・48kHz・モノラル）と読み（カナ） | 58 本 | 6.8MB |
| `tts/pstack-comedy/` | 笑ってわかる pstack（1 レクチャー）の台詞の音声（VOICEVOX・48kHz・モノラル）と読み（カナ） | 71 本 | 8.5MB |
| `tts/superagent-comedy/` | 笑ってわかる Super-agent（6 章）の台詞の音声（VOICEVOX・48kHz・モノラル）と読み（カナ） | 503 本 | 79.0MB |
| `audio/music/`・`audio/sfx/` | BGM・ジングル・効果音（`scripts/build_music.py` の合成） | 15 個 | 13.9MB |
| `SHA256SUMS` | 取り出して WAV に戻した後のファイルの sha256（パスはリポジトリの最上位から） | | |

## 使い方

```bash
bun scripts/materials.ts pull                    # 全部の講座の素材を .work/tts/ と public/audio/ に取り出す
bun scripts/materials.ts pull nudge-product      # 1 つの講座だけ
bun scripts/materials.ts pull --videos           # 公開中のサイト（gh-pages）の動画とポスターも site/media/ に取り出す
```

## クレジットと利用規約

- 声: VOICEVOX:No.7、VOICEVOX:青山龍星、VOICEVOX:ずんだもん、VOICEVOX:玄野武宏。音声を使うときは、VOICEVOX と各キャラクターの利用規約に従い、クレジットを書いてください
- BGM・ジングル・効果音: `scripts/build_music.py` が numpy で合成したオリジナル（外の音源は使っていません）
