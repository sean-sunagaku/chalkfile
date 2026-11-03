"""Python の道具（scripts/mix.py・tts_kokoro.py・check_speech.py）が共有する部品。標準のモジュールだけを使う（依存を入れる前にも読める）。

- write_atomic・atomic_path: 同じフォルダの一時の名前に書いてから置き換える。途中で止まっても、前の中身か新しい中身のどちらかになり、
  同じ作業フォルダで道具を並べて流しても（別々の動画の synth を 2 つなど）、書きかけのファイルが見えない
"""

from __future__ import annotations

import os
import secrets
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path


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
