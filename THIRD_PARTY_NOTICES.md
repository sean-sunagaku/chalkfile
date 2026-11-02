# 使っているもののライセンス

このリポジトリのコードと台本は [MIT License](LICENSE) です。使っている他のもののライセンスは次のとおりです。

| 名前 | 使い方 | ライセンス |
|---|---|---|
| Remotion（`remotion`・`@remotion/*` 4.0.440） | 動画を描いて書き出す | [Remotion License](https://www.remotion.dev/license)。個人と小さな会社は無料、会社の規模によっては有料のライセンスが要る |
| React・React DOM（19.2.4） | 動画の部品 | MIT |
| lucide-react（0.511.0） | アイコン | ISC |
| TypeScript（6.0.2） | 型の確かめ（開発のときだけ） | Apache-2.0 |
| Zen Maru Gothic・Noto Sans JP・Noto Sans SC・Inter・JetBrains Mono | 書体（Google Fonts から読み込む。Noto Sans SC は中国語の講座） | SIL Open Font License 1.1 |
| VOICEVOX（No.7・青山龍星・ずんだもん・玄野武宏） | 日本語のナレーションの声（作るときだけ。声は動画に入る） | VOICEVOX の利用規約と各キャラクターの利用規約。クレジットの表記が要る |
| Kokoro-82M・Kokoro-82M-v1.1-zh（hexgrad。`kokoro` 0.9.4） | 英語と中国語のナレーションの声（作るときだけ。手元で動かす `scripts/tts_kokoro.py`。声は動画に入る） | Apache-2.0（モデルの重みとコード）。中国語の声のデータは LongMaoData が許諾したもの（モデルカード）。動画とサイトに「Kokoro-82M（声の名前）」と書く |
| misaki（`misaki[en,zh]` 0.9.4）・spaCy・jieba・pypinyin | 英語と中国語の読み（音素）を作る（作るときだけ） | Apache-2.0・MIT ほか |
| espeak-ng（`espeakng-loader` が同梱） | 英語の辞書に無い語の読みを補う（作るときだけ。このリポジトリでは配らない） | GPL-3.0 |
| faster-whisper（Whisper medium のモデル）・OpenCC | 英語と中国語の読み上げの聞き取りの点検（`scripts/check_speech.py`。作るときだけ） | MIT・Apache-2.0 |
| NumPy・SciPy | BGM の合成と音のミックス（作るときだけ） | BSD-3-Clause |
| FFmpeg | 動画と音を合わせる（作るときだけ。このリポジトリでは配らない） | LGPL 2.1 以降（作り方によっては GPL） |
| Bun・Node.js・uv | 実行の環境（このリポジトリでは配らない） | MIT ほか |

- BGM と効果音は `scripts/build_music.py` が合成したオリジナルで、外の音源は使っていません
- 英語版・中国語版のずんだもんは、VOICEVOX:ずんだもんの声ではなく Kokoro の声です（キャラクターは東北ずん子・ずんだもんプロジェクトのキャラクター利用の手引きに沿って使う）
- Python の道具（Kokoro・faster-whisper など）は `uv run` が、スクリプトの頭に書いた版で用意します（このリポジトリには入れません）
- 依存しているパッケージの正確な版は `package-lock.json` にあります
