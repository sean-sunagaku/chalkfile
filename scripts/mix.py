"""レクチャーごとの音（ナレーション・BGM・ジングル・効果音）を 1 本の WAV にまとめる。

synth.ts が書いた .work/plan/<id>.json（台詞の開始時刻と効果音）を読み、
public/audio/mix/<id>.wav（48kHz・ステレオ・16bit、-16 LUFS / true peak -1.5 dB）を作る。

- ナレーションは -17 LUFS にそろえる
- BGM（bed.wav、-18 LUFS のループ）は、話している間は -17 dB、話していない間は -7 dB（自動で下げる）
- 冒頭は sting_intro（2.0 秒で「ドン」）、最後は sting_outro
- 効果音: 台詞の sfx、場面の切り替わりの whoosh、クイズの考える時間の tick

  uv run --with numpy --with scipy python scripts/mix.py            # 全部
  uv run --with numpy --with scipy python scripts/mix.py L01 L05    # 一部だけ
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
RATE = 48000
PLAN_DIR = ROOT / ".work" / "plan"
MUSIC = ROOT / "public" / "audio" / "music"
SFX_DIR = ROOT / "public" / "audio" / "sfx"
OUT_DIR = ROOT / "public" / "audio" / "mix"

VOICE_LUFS = -17.0
BED_SPEECH_DB = -17.0
BED_FREE_DB = -7.0
BED_START = 4.4  # ジングルの余韻に重ねて BGM を入れる
STING_DB = -1.5
SFX_DB = {"pop": -14.0, "chime": -13.0, "whoosh": -15.0, "tick": -9.0, "reveal": -7.0, "correct": -7.0, "type": -14.0}
FINAL_LUFS = -16.0
FINAL_TP = -1.5


def read_wav(path: Path) -> np.ndarray:
    """float32 の (n, ch) で返す。48kHz・16bit 前提"""
    with wave.open(str(path), "rb") as w:
        if w.getframerate() != RATE or w.getsampwidth() != 2:
            raise ValueError(f"{path}: {w.getframerate()} Hz / {w.getsampwidth() * 8} bit は想定外")
        ch = w.getnchannels()
        data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
    return data.reshape(-1, ch)


def write_wav(path: Path, x: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm = (np.clip(x, -1.0, 1.0) * 32767.0).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(x.shape[1])
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(pcm.tobytes())


def db(v: float) -> float:
    return 10 ** (v / 20)


def lufs(x: np.ndarray) -> float:
    """ffmpeg の ebur128 で積分ラウドネスを測る"""
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "m.wav"
        write_wav(p, x)
        r = subprocess.run(
            ["ffmpeg", "-hide_banner", "-nostats", "-i", str(p), "-af", "ebur128=framelog=quiet", "-f", "null", "-"],
            capture_output=True,
            text=True,
        )
    m = re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)
    return float(m[-1])


def place(bus: np.ndarray, clip: np.ndarray, at: float, gain: float = 1.0) -> None:
    i = int(round(at * RATE))
    if i >= len(bus):
        return
    if i < 0:
        clip = clip[-i:]
        i = 0
    n = min(len(clip), len(bus) - i)
    if clip.shape[1] == 1 and bus.shape[1] == 2:
        bus[i : i + n] += clip[:n] * gain
    else:
        bus[i : i + n] += clip[:n, : bus.shape[1]] * gain


def speech_gain(n: int, intervals: list[tuple[float, float]]) -> np.ndarray:
    """話している区間（短い間はつなぐ）で BGM を下げる、なめらかなゲイン曲線"""
    ctl = 200  # 制御レート（Hz）
    m = np.zeros(int(n / RATE * ctl) + 2)
    merged: list[list[float]] = []
    for s, e in sorted(intervals):
        if merged and s - merged[-1][1] < 0.9:
            merged[-1][1] = max(merged[-1][1], e)
        else:
            merged.append([s, e])
    for s, e in merged:
        m[max(0, int((s - 0.12) * ctl)) : int((e + 0.35) * ctl)] = 1.0
    # 0.25 秒の窓でならす
    k = np.hanning(int(0.25 * ctl) * 2 + 1)
    m = np.convolve(m, k / k.sum(), mode="same")
    g_db = BED_FREE_DB + (BED_SPEECH_DB - BED_FREE_DB) * np.clip(m, 0, 1)
    t_ctl = np.arange(len(m)) / ctl
    t = np.arange(n) / RATE
    return (10 ** (np.interp(t, t_ctl, g_db) / 20)).astype(np.float32)


def fade(n: int, a: int, b: int, rising: bool) -> np.ndarray:
    env = np.ones(n, dtype=np.float32)
    a, b = max(0, a), min(n, b)
    if b > a:
        ramp = np.linspace(0, 1, b - a, dtype=np.float32)
        ramp = 0.5 - 0.5 * np.cos(np.pi * ramp)
        env[a:b] = ramp if rising else 1 - ramp
    if rising:
        env[:a] = 0
    else:
        env[b:] = 0
    return env


def loudnorm(src: Path, dst: Path) -> dict:
    """ffmpeg loudnorm（2 パス・linear）で仕上げる"""
    first = subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-nostats",
            "-i",
            str(src),
            "-af",
            f"loudnorm=I={FINAL_LUFS}:TP={FINAL_TP}:LRA=11:print_format=json",
            "-f",
            "null",
            "-",
        ],
        capture_output=True,
        text=True,
    )
    meas = json.loads(first.stderr[first.stderr.rindex("{") : first.stderr.rindex("}") + 1])
    af = (
        f"loudnorm=I={FINAL_LUFS}:TP={FINAL_TP}:LRA=11:linear=true:"
        f"measured_I={meas['input_i']}:measured_TP={meas['input_tp']}:measured_LRA={meas['input_lra']}:"
        f"measured_thresh={meas['input_thresh']}:offset={meas['target_offset']}"
    )
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(src),
            "-af",
            af,
            "-ar",
            str(RATE),
            "-c:a",
            "pcm_s16le",
            str(dst),
        ],
        check=True,
    )
    return meas


def build(lec_id: str) -> None:
    plan = json.loads((PLAN_DIR / f"{lec_id}.json").read_text())
    dur = plan["duration"]
    n = int(np.ceil(dur * RATE))
    voice = np.zeros((n, 1), dtype=np.float32)
    fx = np.zeros((n, 2), dtype=np.float32)
    intervals: list[tuple[float, float]] = []
    sfx_cache: dict[str, np.ndarray] = {}

    def sfx(name: str, at: float) -> None:
        if name not in sfx_cache:
            sfx_cache[name] = read_wav(SFX_DIR / f"{name}.wav")
        place(fx, sfx_cache[name], at, db(SFX_DB[name]))

    for si, scene in enumerate(plan["scenes"]):
        if si > 0:
            sfx("whoosh", scene["start"] - 0.08)
        for li, line in enumerate(scene["lines"]):
            clip = read_wav(Path(line["file"]))
            place(voice, clip, line["start"])
            intervals.append((line["start"], line["end"]))
            if line.get("sfx"):
                # 声の頭（1 モーラ目）を消さないよう、映像の動き出しに合わせて少し前に鳴らす
                sfx(line["sfx"], line["start"] - 0.2)
            # クイズ: 問題を読んだあとの考える時間に 3 回 tick
            if scene["kind"] == "quiz" and li == 0:
                for k in range(3):
                    sfx("tick", line["end"] + 0.25 + k)

    # ナレーションを -17 LUFS に
    v_lufs = lufs(voice)
    voice *= db(VOICE_LUFS - v_lufs)

    # BGM（ループ）
    bed = read_wav(MUSIC / "bed.wav")
    reps = int(np.ceil(n / len(bed))) + 1
    bed_long = np.tile(bed, (reps, 1))
    b0 = int(BED_START * RATE)
    bed_bus = np.zeros((n, 2), dtype=np.float32)
    bed_bus[b0:] = bed_long[: n - b0]
    ending = plan["scenes"][-1]
    last_end = ending["lines"][-1]["end"] if ending["lines"] else ending["start"]
    out_at = last_end + 0.35  # 締めのジングルの頭
    env = fade(n, b0, b0 + int(1.4 * RATE), rising=True) * fade(
        n, int((out_at - 1.2) * RATE), int((out_at + 0.4) * RATE), rising=False
    )
    bed_bus *= (env * speech_gain(n, intervals))[:, None]

    stings = np.zeros((n, 2), dtype=np.float32)
    # 「ドン」（2.0 秒）のあとは呼び込みの声の下に回す
    intro = read_wav(MUSIC / "sting_intro.wav")
    t = np.arange(len(intro)) / RATE
    duck = np.interp(t, [0.0, 2.1, 2.45], [0.0, 0.0, -7.0])
    place(stings, intro * (10 ** (duck / 20))[:, None].astype(np.float32), 0.0, db(STING_DB))
    place(stings, read_wav(MUSIC / "sting_outro.wav"), out_at, db(STING_DB))

    mix = np.repeat(voice, 2, axis=1) + bed_bus + stings + fx
    # 頭と尻の 10ms をフェード
    k = int(0.01 * RATE)
    mix[:k] *= np.linspace(0, 1, k)[:, None]
    mix[-k:] *= np.linspace(1, 0, k)[:, None]
    peak = float(np.max(np.abs(mix)))
    if peak > 0.99:
        mix *= 0.99 / peak

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as d:
        raw = Path(d) / "raw.wav"
        write_wav(raw, mix)
        meas = loudnorm(raw, OUT_DIR / f"{lec_id}.wav")
    final = lufs(read_wav(OUT_DIR / f"{lec_id}.wav"))
    print(
        f"{lec_id}: {dur / 60:.2f} 分  ナレーション元 {v_lufs:.1f} LUFS → 仕上がり {final:.1f} LUFS"
        f"（入力 {meas['input_i']} / TP {meas['input_tp']}）"
    )


def main() -> None:
    ids = sys.argv[1:] or sorted(p.stem for p in PLAN_DIR.glob("*.json"))
    for i in ids:
        build(i)


if __name__ == "__main__":
    main()
