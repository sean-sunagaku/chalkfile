"""Python の道具（scripts/mix.py・build_music.py・tts_kokoro.py・check_speech.py）が共有する部品。標準のモジュールだけを読む（依存を入れる前にも読める）。

- wants_help・stop: 使い方と終了コード（0 成功・1 失敗・2 使い方の誤り・3 前提が足りない。TS の道具の scripts/lib/args.ts と同じ）
- cache_dir・voice_file: 作業フォルダの間で共有するキャッシュと、台詞の音声の探し方（TS の scripts/lib/paths.ts と同じ）
- video_keys: 引数の動画の名前（L01・S01.en）。形の違う名前と知らない引数は、使い方の誤りにする（パスに使うので、形を確かめる）
- write_atomic・atomic_path: 同じフォルダの一時の名前に書いてから置き換える。途中で止まっても、前の中身か新しい中身のどちらかになり、
  同じ作業フォルダで道具を並べて流しても（別々の動画の synth を 2 つなど）、書きかけのファイルが見えない
- run_tool・run_ffmpeg: 外の道具（ffmpeg など）を流して、出力を受け取る（標準入力は読ませない）。終了コードを確かめ、失敗したら、
  何をしていたかと stderr の終わりを出して止める（TS の scripts/lib/proc.ts の runOrThrow と同じ考え方）
- db_to_linear・linear_to_db: dB と振幅の比の変換（向きを名前で示す）
受け渡しの JSON（設計図・聞き取りの対応・Kokoro の仕事・効果音の一覧）の読み方と形の確かめは handoff.py
"""

from __future__ import annotations

import os
import re
import secrets
import subprocess
import sys
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import NoReturn

FAILED = 1  # 終了コード: 失敗（外の道具の失敗・形の違う受け渡しの JSON）
USAGE = 2  # 終了コード: 使い方の誤り
MISSING = 3  # 終了コード: 前提が足りない（道具・素材・前の段の出力）
TAIL_LINES = 12  # 外の道具が失敗したときに出す、出力の終わりの行の数（原因は、たいてい最後に出る）
VIDEO_KEY = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]*(\.[a-z]{2})?")  # 動画の名前（レクチャー ID か、レクチャー ID.言語）


def wants_help(argv: list[str]) -> bool:
    """-h か --help があるか（あれば、頭書きを出すだけにする）"""
    return bool({"-h", "--help"} & set(argv[1:]))


def stop(code: int, message: str) -> NoReturn:
    """message を標準エラーに出して、code で終える"""
    print(message, file=sys.stderr)
    raise SystemExit(code)


def video_keys(args: list[str], usage: str) -> list[str]:
    """引数の動画の名前（重なりを除き、渡した順）。名前は道具が読み書きするファイルの名前になるので、形を確かめる。

    - で始まる引数（知らない引数）・形の違う名前は、使い方の誤り（2）で止める。名前が 1 つも無ければ、usage を出して 2 で止める
    """
    for a in args:
        if a.startswith("-"):
            stop(USAGE, f"知らない引数: {a}（使い方は --help）")
    if not args:
        stop(USAGE, usage)
    for a in args:
        if not VIDEO_KEY.fullmatch(a):
            stop(USAGE, f"動画の名前の形が違う: {a}（例: L01・S01.en）")
    return list(dict.fromkeys(args))


def cache_dir() -> Path:
    """作業フォルダの間で共有するキャッシュ。環境変数 CHALKFILE_CACHE_DIR、無ければ ~/.cache/chalkfile"""
    env = os.environ.get("CHALKFILE_CACHE_DIR")
    return Path(env).resolve() if env else Path.home() / ".cache" / "chalkfile"


TTS_REL = Path(".work") / "tts"  # 台詞の音声の、場所に縛られない名前の頭（設計図・聞き取りの対応に書く）


def voice_file(root: Path, rel: str) -> Path:
    """設計図などに書いた台詞の音声の名前（.work/tts/<鍵>.wav）の、今ある場所。

    先に共有のキャッシュ（<キャッシュ>/tts）、無ければ作業フォルダの .work/tts（前の置き場所）。
    ほかの名前（BGM など）と、前の設計図の絶対パスは、そのまま使う
    """
    p = Path(rel)
    if not p.is_absolute() and p.parts[:2] == TTS_REL.parts:
        cached = cache_dir() / "tts" / Path(*p.parts[2:])
        if cached.exists():
            return cached
    return root / p


def temp_path(path: Path, suffix: str = ".tmp") -> Path:
    """path と同じフォルダの、ほかと重ならない一時の名前（.<名前>.<pid>.<乱数><suffix>）。os.replace で置き換えるので、同じフォルダに置く"""
    return path.with_name(f".{path.name}.{os.getpid()}.{secrets.token_hex(4)}{suffix}")


@contextmanager
def atomic_path(path: Path, suffix: str = ".tmp") -> Iterator[Path]:
    """書く道具（soundfile・ffmpeg）に一時の名前を渡し、書き終えたら path に置き換える。失敗したら一時のファイルを消す。

    ffmpeg は出力の形を拡張子で決めるので、そのときは suffix に ".tmp.wav" のように拡張子まで渡す
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = temp_path(path, suffix)
    try:
        yield tmp
        os.replace(tmp, path)
    finally:
        tmp.unlink(missing_ok=True)


def write_atomic(path: Path, data: str | bytes) -> None:
    """一時の名前に書いてから置き換える（文字は UTF-8）"""
    with atomic_path(path) as tmp:
        if isinstance(data, str):
            tmp.write_text(data, encoding="utf-8")
        else:
            tmp.write_bytes(data)


def tail(text: str, lines: int = TAIL_LINES) -> str:
    """出力の終わりの lines 行"""
    return "\n".join(text.strip().splitlines()[-lines:])


def run_tool(cmd: list[str], *, what: str) -> subprocess.CompletedProcess[str]:
    """外の道具を流して、出力（stdout・stderr）を受け取って返す。標準入力は読ませない。

    終了コードが 0 でなければ、what（何をしていたか）・終了コード・stderr の終わりを出して、終了コード 1 で止める。
    道具が無ければ、終了コード 3 で止める
    """
    name = Path(cmd[0]).name
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, errors="replace", stdin=subprocess.DEVNULL, check=False)
    except FileNotFoundError:
        stop(MISSING, f"{name} が見つからない（入れてから流す。docs/guide/quickstart.md の「前提の道具」）")
    if r.returncode != 0:
        detail = tail(r.stderr) or tail(r.stdout)
        stop(
            FAILED,
            f"{name} が失敗した（{what}。終了コード {r.returncode}）"
            + (f"。出力の終わり:\n{detail}" if detail else ""),
        )
    return r


def run_ffmpeg(args: list[str], *, what: str) -> subprocess.CompletedProcess[str]:
    """ffmpeg を流す（-nostdin を付ける）。測った値（ebur128・loudnorm）は stderr に出るので、出力も返す。失敗したら run_tool と同じく止める"""
    return run_tool(["ffmpeg", "-nostdin", *args], what=what)


def db_to_linear(db):
    """dB → 振幅の比（10^(dB/20)）。numpy の値もそのまま受け取る"""
    return 10 ** (db / 20)


def linear_to_db(x):
    """振幅の比 → dB（20·log10）。numpy で計算する（numpy を入れる前にもこのファイルを読めるよう、使うときに読む）"""
    import numpy as np

    return 20 * np.log10(x)
