"""TS の道具が書き、Python の道具が読む JSON（受け渡し）を読んで、形を確かめる。標準のモジュールだけを読む。

形の正本は TS の型（scripts/lib/handoff.ts）。足りない項目・違う型・知らない効果音・違う版を、どのファイルのどこかを書いた文で止める
（KeyError・IndexError などで落とさない）。
  read_plan         .work/plan/<動画>.json     ミックスの設計図（synth.ts → mix.py）
  read_speech       .work/speech/<動画>.json   訳の台詞と音声の対応（synth.ts → check_speech.py）
  read_kokoro_jobs  一時のフォルダの jobs.json  Kokoro に読ませる台詞（synth.ts → tts_kokoro.py）
  read_sfx          scripts/audio/sfx.json     効果音の名前と音量（npm run gen が content/sfx.ts から作る → mix.py・build_music.py）
形を変えたら、TS の SCHEMA とここの SCHEMA の数を 1 つ上げる（tests/handoff.test.ts が、TS の型で書いたものをここで読めるかと、
数が同じかを確かめる）。schema の無い設計図・聞き取りの対応と、配列だけの Kokoro の仕事は、schema を書く前の synth.ts が書いたもの。
今の形（1）として確かめる
"""

from __future__ import annotations

import json
import math
from collections.abc import Iterable
from pathlib import Path
from typing import Any, NamedTuple

SCHEMA = {"plan": 1, "speech": 1, "kokoroJobs": 1, "sfx": 1}
SFX_JSON = Path(__file__).resolve().parent / "sfx.json"


class HandoffError(Exception):
    """受け渡しの JSON が読めない・形が違う（文に、ファイルの名前と項目の場所を入れる）"""


class Each(NamedTuple):
    """名前の決まっていない dict（どの名前の値も shape の形）"""

    shape: Any


NUM = object()  # 数（int か float。真偽・NaN・無限大は除く）。JSON の 14 と 14.0 を同じに扱う

# 形の書き方: 型（str・int）・NUM・取れる値の組（tuple）・[形]（その形の list）・{名前: 形}（名前の末尾の ? は省ける。
# ほかの名前は見ない）・Each(形)
PLAN_LINE = {
    "file": str,
    "start": NUM,
    "end": NUM,
    "pauseAfter": NUM,
    "sfx?": str,
    "sfxAfter?": str,
    "bgm?": ("cut", "back"),
}
PLAN = {
    "schema?": int,
    "id": str,
    "duration": NUM,
    "scenes": [{"kind": str, "start": NUM, "end": NUM, "lines": [PLAN_LINE]}],
}
SPEECH = {
    "schema?": int,
    "key": str,
    "lang": str,
    "lines": [{"at": str, "voice": str, "t": str, "speech": str, "file": str}],
}
KOKORO_JOBS = {
    "schema": int,
    "jobs": [{"key": str, "text": str, "repo": str, "voice": str, "g2p": ("a", "b", "z"), "speed": NUM}],
}
SFX_LIST = {"schema": int, "sfx": Each({"db": NUM})}


def _kind(v: Any) -> str:
    """値の種類（文に出す名前）"""
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "真偽"
    if isinstance(v, (int, float)):
        return "数"
    if isinstance(v, str):
        return "文字"
    if isinstance(v, list):
        return "配列"
    if isinstance(v, dict):
        return "オブジェクト"
    return type(v).__name__


def check(value: Any, shape: Any, where: str = "") -> None:
    """value が shape の形かを確かめる。違えば HandoffError（文の頭は項目の場所。例: scenes[2].lines[0].start。空なら全体）"""
    at = where or "全体"
    if shape is NUM:
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
            raise HandoffError(f"{at} は数にする（今は {_kind(value)}: {value!r}）")
    elif shape is int:
        if isinstance(value, bool) or not isinstance(value, int):
            raise HandoffError(f"{at} は整数にする（今は {_kind(value)}: {value!r}）")
    elif shape is str:
        if not isinstance(value, str):
            raise HandoffError(f"{at} は文字にする（今は {_kind(value)}）")
    elif isinstance(shape, Each):  # Each も tuple なので、取れる値の組より先に見る
        if not isinstance(value, dict):
            raise HandoffError(f"{at} はオブジェクトにする（今は {_kind(value)}）")
        for name, item in value.items():
            check(item, shape.shape, f"{where}.{name}" if where else name)
    elif isinstance(shape, tuple):
        if value not in shape:
            raise HandoffError(f"{at} は {'・'.join(shape)} のどれか（今は {value!r}）")
    elif isinstance(shape, list):
        if not isinstance(value, list):
            raise HandoffError(f"{at} は配列にする（今は {_kind(value)}）")
        for i, item in enumerate(value):
            check(item, shape[0], f"{where}[{i}]")
    elif isinstance(shape, dict):
        if not isinstance(value, dict):
            raise HandoffError(f"{at} はオブジェクトにする（今は {_kind(value)}）")
        for name, sub in shape.items():
            key = name.removesuffix("?")
            if key in value:
                check(value[key], sub, f"{where}.{key}" if where else key)
            elif not name.endswith("?"):
                raise HandoffError(f"{f'{where}.{key}' if where else key} が無い")
    else:
        raise TypeError(f"形の書き方が違う: {shape!r}")


def read_json(path: Path, what: str) -> Any:
    """JSON を読む。ファイルが無ければ FileNotFoundError のまま（呼ぶ側が、先に流すものを出す）。JSON でなければ HandoffError"""
    text = path.read_text(encoding="utf-8")
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise HandoffError(f"{what}（{path.name}）が JSON として読めない: {e}") from None


def _versioned(data: Any, kind: str, shape: dict, name: str) -> Any:
    """形の版（schema）を確かめてから、形を確かめる。schema の無いものは、今の形として確かめる。文の頭はファイルの名前"""
    if isinstance(data, dict) and "schema" in data and data["schema"] != SCHEMA[kind]:
        raise HandoffError(
            f"{name}: 形の版（schema）が {data['schema']!r}。この道具が読めるのは {SCHEMA[kind]}"
            "（書いた道具と読む道具の版を合わせる）"
        )
    try:
        check(data, shape)
    except HandoffError as e:
        raise HandoffError(f"{name}: {e}") from None
    return data


def read_plan(path: Path, sfx: Iterable[str]) -> dict:
    """ミックスの設計図。id はファイルの名前と同じ、効果音は sfx（read_sfx の名前）にあるものだけ"""
    plan = _versioned(read_json(path, "ミックスの設計図"), "plan", PLAN, path.name)
    if plan["id"] != path.stem:
        raise HandoffError(f"{path.name}: id が {plan['id']!r}（ファイルの名前の {path.stem!r} と同じにする）")
    known = set(sfx)
    for si, scene in enumerate(plan["scenes"]):
        for li, line in enumerate(scene["lines"]):
            for k in ("sfx", "sfxAfter"):
                if k in line and line[k] not in known:
                    raise HandoffError(
                        f"{path.name}: scenes[{si}].lines[{li}].{k} の効果音「{line[k]}」が一覧（content/sfx.ts）に無い"
                    )
    return plan


def read_speech(path: Path) -> dict:
    """訳の台詞と音声の対応"""
    return _versioned(read_json(path, "聞き取りの対応"), "speech", SPEECH, path.name)


def read_kokoro_jobs(path: Path) -> list[dict]:
    """Kokoro に読ませる台詞の一覧。配列だけのもの（schema を書く前の synth.ts が書いたもの）も読む"""
    data = read_json(path, "Kokoro の仕事")
    if isinstance(data, list):
        data = {"schema": SCHEMA["kokoroJobs"], "jobs": data}
    return _versioned(data, "kokoroJobs", KOKORO_JOBS, path.name)["jobs"]


def read_sfx(path: Path = SFX_JSON) -> dict[str, float]:
    """効果音の名前 → ミックスでの音量（dB）。中身は npm run gen が content/sfx.ts から作る"""
    data = _versioned(read_json(path, "効果音の一覧"), "sfx", SFX_LIST, path.name)
    return {name: float(v["db"]) for name, v in data["sfx"].items()}
