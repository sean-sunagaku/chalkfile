# Chalkfile の動画の素材

講座の動画を作るための素材だけを置くブランチです。main にはマージしません。

- `bun scripts/materials.ts push` は足すだけです。手元の素材を足すか上書きし、手元の台本に無い講座や台詞の素材は消さずに残します。コミットは前の版を親にするので、送るのは新しい素材だけで、前の版にも戻せます
- 消すのは `bun scripts/materials.ts gc` だけです。`--keep` の ref（既定 origin/main）の台本が使わない素材を一覧にし、`--confirm` を付けたときだけ消します。gc は親の無い 1 コミットで置き換え、それまでの履歴を切ります
- 台詞の音声の名前は声の鍵です（v2 は読み上げる文と合成のレシピから、v1 は前の作り方）。v2 の鍵で作った声は、読みの隣に声の記録（`.meta.json`。合成のレシピとエンジンの版）を置きます

素材があれば、台詞を変えていない章は VOICEVOX なしで、時刻 → 音のミックス → 動画 → 講座サイトまで作り直せます。手順はリポジトリの docs/guide/quickstart.md の「B. 素材から作る」です。

全部で 757.7MB（音声は FLAC。取り出すと WAV に戻り、`SHA256SUMS` と同じ中身になる）。どの台本から足したかは、このブランチのコミットのメッセージ（`git log`）にあります。

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
| `SHA256SUMS` | 取り出した後のファイル（WAV・読み・声の記録）の sha256（パスはリポジトリの最上位から） | | |
| `DURATIONS.json` | 台詞の音声（WAV）の長さ（サンプルの数）と、測った WAV の sha256。CI が音声を取り出さずに時刻を作るのに使う（`synth.ts --cached-only --durations-only`） | | |

## 使い方

```bash
bun scripts/materials.ts pull                    # 全部の講座の素材を取り出す（台詞の声は作業フォルダの間で共有のキャッシュ ~/.cache/chalkfile/tts/ に、BGM・効果音は public/audio/ に）
bun scripts/materials.ts pull nudge-product      # 1 つの講座だけ
bun scripts/materials.ts pull --videos           # Releases の動画も site/media/ に取り出す（ポスターは講座のフォルダの generated/posters/）
bun scripts/materials.ts push --dry-run          # 足す・変える・同じ・残すの本数だけを見る（何も書かない）
```

## クレジットと利用規約

- 声（日本語）: VOICEVOX:No.7、VOICEVOX:青山龍星、VOICEVOX:ずんだもん、VOICEVOX:玄野武宏。音声を使うときは、VOICEVOX と各キャラクターの利用規約に従い、クレジットを書いてください
- 声（英語・中国語）: Kokoro-82M（hexgrad、Apache-2.0）の af_heart・af_bella・bm_george・am_fenrir・zf_019・zf_092・zm_031・zm_029（英語は Kokoro-82M、中国語は Kokoro-82M-v1.1-zh）
- BGM・ジングル・効果音: `scripts/build_music.py` が numpy で合成したオリジナル（外の音源は使っていません）
