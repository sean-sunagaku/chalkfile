# 使っているもののライセンス

このリポジトリのコードと台本は [MIT License](LICENSE) です。使っている他のもののライセンスは次のとおりです。

| 名前 | 使い方 | ライセンス |
|---|---|---|
| Remotion（`remotion`・`@remotion/*` 4.0.440） | 動画を描いて書き出す | [Remotion License](https://www.remotion.dev/license)。個人と小さな会社は無料、会社の規模によっては有料のライセンスが要る |
| React・React DOM（19.2.4） | 動画の部品 | MIT |
| lucide-react（0.511.0） | アイコン | ISC |
| TypeScript（6.0.2） | 型の確かめ（開発のときだけ） | Apache-2.0 |
| Zen Maru Gothic・Noto Sans JP・Inter・JetBrains Mono | 書体（Google Fonts から読み込む） | SIL Open Font License 1.1 |
| VOICEVOX（No.7・青山龍星・ずんだもん） | ナレーションの声（作るときだけ。声は動画に入る） | VOICEVOX の利用規約と各キャラクターの利用規約。クレジットの表記が要る |
| NumPy・SciPy | BGM の合成と音のミックス（作るときだけ） | BSD-3-Clause |
| FFmpeg | 動画と音を合わせる（作るときだけ。このリポジトリでは配らない） | LGPL 2.1 以降（作り方によっては GPL） |
| Bun・Node.js・uv | 実行の環境（このリポジトリでは配らない） | MIT ほか |

- BGM と効果音は `scripts/build_music.py` が合成したオリジナルで、外の音源は使っていません
- 依存しているパッケージの正確な版は `package-lock.json` にあります
