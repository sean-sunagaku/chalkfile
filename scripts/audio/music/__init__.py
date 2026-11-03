"""講座動画の BGM・ジングル・効果音を、コードだけで合成する（入口は scripts/build_music.py）。

サンプル音源もダウンロードも使わない。乱数はすべて固定 seed なので、同じコードと同じ numpy・scipy
（pyproject.toml と uv.lock で固定）からは、毎回まったく同じ WAV ができる。

モジュール（import は上から下の向きだけ。下のものは上を知らない）:
  paths.py        置き場所（public/audio/ など）
  dsp.py          決まった値・乱数・フィルタ・オシレータ・エンベロープ・空間系・ダイナミクス・WAV の書き出し
  instruments.py  ドラムのワンショット・ライザー・音程楽器
  score.py        テンポ・曲の形・和声・ベースとエレピの型
  bed.py          講義 BGM のループ（bed.wav）
  stings.py       ジングル（sting_intro.wav・sting_outro.wav）
  sfx.py          効果音（sfx/*.wav）
  verify.py       ffmpeg の計測と目標の判定・ループの継ぎ目・試聴用 MP3・素材の SHA256SUMS との照合
  build.py        書き出す一覧とコマンドの引数

構成メモ:
  - 音源: PolyBLEP ノコギリ波、2-op FM（エレピ・ベル）、加算合成の金属音（ハット・シンバル）
  - 処理: RBJ biquad（scipy.signal.lfilter）、指数減衰ノイズ IR の畳み込みリバーブ、
          付点 8 分のピンポンディレイ、キック連動のサイドチェイン、バスコンプ、
          4 倍オーバーサンプルのピークで動くルックアヘッド・リミッタ
  - 音の大きさ: 生成は dsp.lufs()（BS.1770-4）で目標に合わせる。書き出した WAV を測って判定するのは verify.py の
    ffmpeg（ebur128）だけ。dsp.lufs() を ffmpeg に置き換えると WAV のバイト列が変わるので、生成はこのままにしている
"""
