"""講座動画の BGM・ジングル・効果音を作る入口。中身は scripts/audio/music/（役割ごとのモジュール。一覧はその __init__.py）。

すべてコードだけで合成する（サンプル音源・ダウンロードなし）。乱数はすべて固定 seed なので、
同じコードと同じ numpy・scipy（pyproject.toml と uv.lock で固定）からは、毎回まったく同じ WAV ができる。

出力（public/audio/ は gitignore 済み）:
  public/audio/music/bed.wav          講義 BGM ループ（120 BPM・C major・64 小節 = 128.0 s）
  public/audio/music/sting_intro.wav  タイトルカード用ジングル（約 5.5 s）
  public/audio/music/sting_outro.wav  エンドカード用ジングル（約 3.5 s）
  public/audio/sfx/*.wav              UI 効果音（mono）。harisen・chin・drumroll・deden・zuko はお笑い版の掛け合い用
  public/audio/music/preview/*.mp3    試聴用 MP3

実行（リポジトリの直下で）:
  uv run --locked --group audio python scripts/build_music.py                # 全部を作る（npm run build:music）
  uv run --locked --group audio python scripts/build_music.py --only chin    # 効果音を 1 つだけ書き出す
  uv run --locked --group audio python scripts/build_music.py --check        # 素材と同じ WAV ができるか（npm run music:verify）

  書き出したあと、ffmpeg で音の大きさを測って目標と比べ、ループの継ぎ目を調べ、試聴用 MP3 を作る（外れたら 1 で終える）。
  --skip-verify を付けると、それを省く。ffmpeg・ffprobe は PATH から探す（--skip-verify と --check なら要らない）。
  --check は public/audio/ に書かずに一時フォルダへ作り、手元の origin/materials の SHA256SUMS と比べる
  （--sums <ファイル> で、ほかの SHA256SUMS とも比べられる）。
"""

import sys

# scripts/audio/music/ に __pycache__ を作らない（.gitignore に無いので、git status に出てしまう）
sys.dont_write_bytecode = True

# python scripts/build_music.py で流すと、sys.path の頭が scripts/ になる
from audio.music.build import main

if __name__ == "__main__":
    main()
