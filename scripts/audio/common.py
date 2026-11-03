"""Python の道具（scripts/mix.py・tts_kokoro.py・check_speech.py）が共有する部品。標準のモジュールだけを読む（依存を入れる前にも読める）。

- wants_help・stop: 使い方と終了コード（0 成功・1 失敗・2 使い方の誤り・3 前提が足りない。TS の道具の scripts/lib/args.ts と同じ）
- write_atomic・atomic_path: 同じフォルダの一時の名前に書いてから置き換える。途中で止まっても、前の中身か新しい中身のどちらかになり、
  同じ作業フォルダで道具を並べて流しても（別々の動画の synth を 2 つなど）、書きかけのファイルが見えない
- run_ffmpeg: ffmpeg を流す（-nostdin を付け、標準入力を読ませない）
- db_to_linear・linear_to_db: dB と振幅の比の変換（向きを名前で示す）
"""

from __future__ import annotations

import os
import secrets
import subprocess
import sys
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import NoReturn

USAGE = 2  # 終了コード: 使い方の誤り
MISSING = 3  # 終了コード: 前提が足りない（道具・素材・前の段の出力）


def wants_help(argv: list[str]) -> bool:
    """-h か --help があるか（あれば、頭書きを出すだけにする）"""
    return bool({"-h", "--help"} & set(argv[1:]))


def stop(code: int, message: str) -> NoReturn:
    """message を標準エラーに出して、code で終える"""
    print(message, file=sys.stderr)
    raise SystemExit(code)


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


def run_ffmpeg(args: list[str], *, capture: bool = True, check: bool = False) -> subprocess.CompletedProcess[str]:
    """ffmpeg を流す（-nostdin を付けて、標準入力を読ませない）。

    capture: 出力（stdout・stderr）を受け取る（ebur128・loudnorm の測った値は stderr に出る）。
    check: 終了コードが 0 でなければ止める（CalledProcessError）。ffmpeg が無ければ、終了コード 3 で止める
    """
    try:
        return subprocess.run(["ffmpeg", "-nostdin", *args], capture_output=capture, text=True, check=check)
    except FileNotFoundError:
        stop(MISSING, "ffmpeg が見つからない（入れてから流す。docs/guide/quickstart.md の「前提の道具」）")


def db_to_linear(db):
    """dB → 振幅の比（10^(dB/20)）。numpy の値もそのまま受け取る"""
    return 10 ** (db / 20)


def linear_to_db(x):
    """振幅の比 → dB（20·log10）。numpy で計算する（numpy を入れる前にもこのファイルを読めるよう、使うときに読む）"""
    import numpy as np

    return 20 * np.log10(x)
