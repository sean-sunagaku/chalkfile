"""ジングル: タイトルカードの sting_intro.wav（約 5.5 s）と、エンドカードの sting_outro.wav（約 3.5 s）。"""

from __future__ import annotations

import json

import numpy as np

from .dsp import CEILING_DB, add_into, fade_out, filt, master, mid, pan_gains, pingpong, reverb, reverb_ir, to_samples
from .instruments import (
    bass_note,
    bell_note,
    clap_sample,
    crash_sample,
    epiano_note,
    hat_sample,
    kick_sample,
    pad_chord,
    reverse_cymbal,
    riser,
    snare_sample,
    stack_chord,
)
from .paths import ROOT
from .score import BAR, BEAT, STEP

# 動画と合わせる値（src/video.config.ts から npm run gen:video-config で書き出したもの）
VIDEO = json.loads((ROOT / "scripts" / "audio" / "video_config.json").read_text())
STING_HIT = float(VIDEO["stingIntroHitSec"])  # イントロのジングルの「ドン」の秒（動画のタイトルの番号と題が出る時刻）
# 目標のラウドネス（LUFS。verify.py が ffmpeg で確かめる）
INTRO_LUFS = -14.0
OUTRO_LUFS = -16.0


# ----------------------------------------------------------------------------
# ジングル
# ----------------------------------------------------------------------------
def _sting_mix(parts: dict, bell: np.ndarray, n: int, key: str, gains: dict, bell_delay: float) -> np.ndarray:
    """ジングル共通のミックス: ベルのピンポンディレイ + リバーブ + EQ。長さ n に切って末尾をフェード。"""
    bell_wet = pingpong(bell, 0.75 * BEAT, bell_delay, taps=6, lp=6000.0, hp=500.0)
    send = 0.25 * mid(parts["drums"]) + 0.3 * mid(parts["keys"]) + 0.35 * bell + 0.2 * mid(parts["fx"])
    wet = reverb(send, reverb_ir(2.8, 2.2, 1.1, key))
    gl, gr = pan_gains(0.1)
    mix = sum(gains[k] * parts[k] for k in parts) + gains["bell"] * (np.stack([gl * bell, gr * bell]) + 0.4 * bell_wet)
    mix = mix + gains["wet"] * wet
    mix = filt(mix, "highpass", 25.0)[:, :n]
    return fade_out(mix, 0.5)


def _ep_chord(buf: np.ndarray, start: int, midis, dur: float, vel: float, key: str) -> None:
    for k, m in enumerate(midis):
        add_into(
            buf,
            start + k * to_samples(0.002),
            epiano_note(m, dur, vel, (key, start, k)),
            0.35,
            -0.25 + 0.5 * k / max(1, len(midis) - 1),
        )


def render_intro() -> np.ndarray:
    """1 小節のライザー + スネアロール → 明るいコードのヒットとベルのモチーフ → C に解決。"""
    # ヒット（「ドン」）は 1 小節のライザーのあとに来る作り。動画の「ドン」の秒（src/video.config.ts）と違えば止める
    if STING_HIT != BAR:
        raise SystemExit(
            f"イントロは 1 小節（{BAR} 秒）のあとに「ドン」が来る作り。src/video.config.ts の「ドン」（{STING_HIT} 秒）と合わない"
        )
    n = to_samples(5.5)
    ne = n + to_samples(2.0)
    parts = {k: np.zeros((2, ne)) for k in ("drums", "fx", "bass", "keys")}
    bell = np.zeros(ne)
    hit = to_samples(STING_HIT)

    def t(step: float) -> int:
        return hit + to_samples(step * STEP)

    # ライザー（ノイズの掃引 + 逆シンバル + パッドの膨らみ）とスネアロール（8 分 → 16 分 → 32 分）
    add_into(parts["fx"], 0, riser(BAR, 250.0, 9000.0, "intro-riser", curve=1.3), 0.8)
    swell = pad_chord([48, 55, 58, 62, 65], BAR - 0.05, ("intro", "swell"), bright=1.6)  # C9sus4 が膨らんで F へ
    swell *= np.clip(np.arange(swell.shape[-1]) / hit, 0.0, 1.0) ** 1.5
    add_into(parts["keys"], 0, swell, 1.2)
    rc = reverse_cymbal(1.2)
    add_into(parts["fx"], hit - rc.shape[-1], rc, 0.3)
    snares = [snare_sample(i) for i in range(3)]
    roll = [0.25 * i for i in range(4)] + [1.0 + 0.125 * i for i in range(4)] + [1.5 + 0.0625 * i for i in range(8)]
    for i, tt in enumerate(roll):
        add_into(parts["drums"], to_samples(tt), snares[i % 3], 0.75 * (0.45 + 0.55 * (i / (len(roll) - 1)) ** 1.3))

    # ヒット: Fmaj9 → G13 → C6/9
    kick, clap, ohat = kick_sample(), clap_sample(1), hat_sample(True, 1)
    for s, v in ((0, 1.0), (8, 0.8), (12, 1.0)):
        add_into(parts["drums"], t(s), kick, 0.9 * v)
    for s, v in ((0, 0.8), (12, 0.7)):
        add_into(parts["drums"], t(s), clap, 0.45 * v)
    for s in (2, 6, 10):
        add_into(parts["drums"], t(s), ohat, 0.22, -0.1)
    add_into(parts["fx"], t(0), crash_sample(2.6), 0.55)
    add_into(parts["fx"], t(12), crash_sample(2.0, dark=True), 0.3)
    for s, m, d, v in (
        (0, 29, 1.7, 1.0),
        (2, 41, 1.2, 0.85),
        (4, 29, 1.7, 0.95),
        (6, 41, 1.2, 0.85),
        (8, 31, 1.7, 0.95),
        (10, 43, 1.2, 0.85),
        (12, 36, 6.0, 1.0),
    ):
        add_into(parts["bass"], t(s), bass_note(m, d * STEP, v, ("intro", s)))
    fmaj9, g13, c69 = [53, 60, 64, 69, 72, 79], [55, 65, 71, 76], [48, 55, 64, 69, 74, 79]
    for s, chord, d in ((0, fmaj9, 7.6), (8, g13, 3.8), (12, c69, 9.0)):  # スタックはレガート、エレピは短く
        add_into(parts["keys"], t(s), stack_chord(chord, d * STEP, ("intro", s)))
        _ep_chord(parts["keys"], t(s), chord[-4:], min(d, 4.0) * STEP, 0.8, "intro")

    # ベルのモチーフ（8 音のオリジナル）: C E G | F E D B | C
    motif = [
        (0, 84, 0.9),
        (2, 88, 0.75),
        (3, 91, 0.9),
        (6, 89, 0.7),
        (7, 88, 0.7),
        (8, 86, 0.85),
        (10, 83, 0.8),
        (12, 84, 1.0),
    ]
    for i, (s, m, v) in enumerate(motif):
        last = i == len(motif) - 1
        add_into(bell, t(s), bell_note(m, v, ("intro", i), tau=1.1 if last else 0.45, dur=3.0 if last else 1.2))
    add_into(bell, t(12), bell_note(96, 0.5, ("intro", 99), tau=0.9, dur=2.5), 0.35)  # C7 のきらめき

    gains = {"drums": 0.9, "fx": 0.45, "bass": 0.55, "keys": 0.5, "bell": 0.5, "wet": 0.5}
    return master(_sting_mix(parts, bell, n, "intro", gains, 0.35), INTRO_LUFS, CEILING_DB)


def render_outro() -> np.ndarray:
    """Fmaj7 → G6 → C6/9 の短い解決フレーズ（イントロと同じ音色）。"""
    n = to_samples(3.5)
    ne = n + to_samples(2.0)
    parts = {k: np.zeros((2, ne)) for k in ("drums", "fx", "bass", "keys")}
    bell = np.zeros(ne)

    def t(step: float) -> int:
        return to_samples(0.03 + step * STEP)

    kick, clap, ohat = kick_sample(), clap_sample(2), hat_sample(True, 2)
    for s, v in ((0, 0.75), (4, 0.7), (8, 0.9)):
        add_into(parts["drums"], t(s), kick, 0.85 * v)
    add_into(parts["drums"], t(4), clap, 0.35)
    for s in (2, 6):
        add_into(parts["drums"], t(s), ohat, 0.2, -0.1)
    add_into(parts["fx"], t(8), crash_sample(2.2, dark=True), 0.3)
    for s, m, d, v in ((0, 29, 1.7, 0.95), (2, 41, 1.2, 0.8), (4, 31, 1.7, 0.95), (6, 43, 1.2, 0.8), (8, 36, 8.0, 1.0)):
        add_into(parts["bass"], t(s), bass_note(m, d * STEP, v, ("outro", s)))
    fmaj7, g6, c69 = [53, 57, 60, 64, 67], [55, 59, 62, 64, 69], [48, 55, 60, 64, 69, 74]
    for s, chord, d in ((0, fmaj7, 3.6), (4, g6, 3.6), (8, c69, 10.0)):
        add_into(parts["keys"], t(s), pad_chord(chord, d * STEP, ("outro", s), 1.3), 1.4)
        add_into(parts["keys"], t(s), stack_chord(chord, d * STEP, ("outro", s), rel=0.8), 0.35)
        _ep_chord(parts["keys"], t(s), chord[-4:], d * STEP, 0.72, "outro")
    for i, (s, m, v) in enumerate(
        ((0, 81, 0.75), (2, 84, 0.7), (4, 83, 0.75), (6, 86, 0.75), (8, 88, 0.9), (8, 84, 0.55))
    ):
        last = s == 8
        add_into(bell, t(s), bell_note(m, v, ("outro", i), tau=1.0 if last else 0.4, dur=2.8 if last else 1.0))
    add_into(bell, t(8), bell_note(96, 0.45, ("outro", 99), tau=0.8, dur=2.2), 0.3)

    gains = {"drums": 0.8, "fx": 0.4, "bass": 0.5, "keys": 0.55, "bell": 0.5, "wet": 0.5}
    return master(_sting_mix(parts, bell, n, "outro", gains, 0.3), OUTRO_LUFS, CEILING_DB)
