"""効果音（mono・ピーク -3 dBFS）。sfx/<名前>.wav に書き出す。

名前とミックスの音量の正本は content/sfx.ts（足し方も、そこの頭書き）。ここの SFX は、その名前ごとの合成。
名前が一覧（npm run gen が書く scripts/audio/sfx.json）と合わなければ、build.py が何も作らずに止める。
"""

from __future__ import annotations

import numpy as np
from scipy import signal

from .dsp import (
    SR,
    add_into,
    fade_in,
    fade_out,
    filt,
    hz,
    mid,
    osc_sine,
    peak_normalize,
    perc,
    reverb_ir,
    rng_for,
    saw,
    sweep,
    to_samples,
)
from .instruments import crash_sample, epiano_note, kick_sample, snare_sample, tom_sample

SFX_PEAK_DB = -3.0  # 効果音のピーク（dBFS。verify.py が ffmpeg で確かめる）


# ----------------------------------------------------------------------------
# 効果音（mono・ピーク -3 dBFS・ナレーションの下で鳴るので控えめに）
# ----------------------------------------------------------------------------
def _bell_tone(
    midi: int, n: int, tau: float, partials=((1.0, 1.0), (2.0, 0.32), (3.01, 0.16), (4.17, 0.08))
) -> np.ndarray:
    """倍音を足したベル音（高い倍音ほど早く減衰）。"""
    t = np.arange(n) / SR
    f = hz(midi)
    y = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * np.sqrt(r) / tau) for r, a in partials)
    return fade_in(y, 0.001)


def sfx_pop() -> np.ndarray:
    n = to_samples(0.12)
    t = np.arange(n) / SR
    f = 380.0 + 560.0 * (1 - np.exp(-t / 0.016))  # 上向きに跳ねる「ポッ」
    x = (osc_sine(f, n) + 0.12 * osc_sine(2 * f, n)) * perc(n, 0.0015, 0.028)
    return filt(x, "lowpass", 6000.0)


def sfx_whoosh() -> np.ndarray:
    n = to_samples(0.6)
    u = np.arange(n) / n
    env = u**1.6 * (1 - u) ** 1.1
    fc = np.exp(np.interp(u, [0.0, 0.55, 1.0], np.log([350.0, 2600.0, 1100.0])))
    body = sweep(rng_for("whoosh").standard_normal(n), "bandpass", fc, q=0.8)
    air = sweep(rng_for("whoosh-air").standard_normal(n), "highpass", np.minimum(fc * 3.0, 12000.0), q=0.7)
    x = filt((body + 0.12 * air) * env / env.max(), "lowpass", 9000.0)
    fade_in(x, 0.005)
    return x


def sfx_chime() -> np.ndarray:
    n = to_samples(0.9)
    x = np.zeros(n)
    for start, m, g in ((0.0, 84, 0.8), (0.11, 91, 1.0)):  # C6 → G6
        s = to_samples(start)
        add_into(x, s, _bell_tone(m, n - s, 0.28), g)
    return x


def sfx_tick() -> np.ndarray:
    n = to_samples(0.05)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * 2400.0 * t) * np.exp(-t / 0.004)
    x += 0.3 * filt(rng_for("tick").standard_normal(n), "bandpass", 4500.0, 1.0) * np.exp(-t / 0.0015)
    return filt(fade_in(x, 0.0002), "lowpass", 9000.0)


def sfx_reveal() -> np.ndarray:
    n = to_samples(0.7)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for i, m in enumerate((79, 84, 88, 91, 96)):  # G5 C6 E6 G6 C7 のきらめき
        s = to_samples(0.04 * i)
        add_into(x, s, _bell_tone(m, n - s, 0.22), 0.8 - 0.08 * i)
    shimmer = filt(rng_for("reveal").standard_normal(n), "highpass", 6000.0)
    swell = np.where(t < 0.15, (t / 0.15) ** 1.5, np.exp(-(t - 0.15) / 0.12))
    x += 0.12 * shimmer * swell
    ir = mid(reverb_ir(0.35, 0.3, 0.2, "reveal"))
    return x + 0.3 * signal.oaconvolve(x, ir)[:n]


def sfx_correct() -> np.ndarray:
    n = to_samples(0.8)
    x = np.zeros(n)
    for start, m, tau, g in (
        (0.0, 79, 0.12, 0.7),
        (0.085, 84, 0.12, 0.75),
        (0.17, 88, 0.32, 1.0),
        (0.17, 91, 0.3, 0.35),
    ):
        s = to_samples(start)
        k = n - s
        ep = epiano_note(m, 0.12, 0.8, ("correct", s, m))[:k]
        ep = np.pad(ep, (0, k - ep.shape[-1])) * np.exp(-np.arange(k) / SR / tau)
        add_into(x, s, 0.6 * _bell_tone(m, k, tau) + 0.4 * ep, g)
    return x


def sfx_type() -> np.ndarray:
    n = to_samples(0.08)
    t = np.arange(n) / SR
    click = filt(rng_for("type").standard_normal(n), "bandpass", 3200.0, 1.0) * np.exp(-t / 0.0025)
    thock = osc_sine(190.0 * (1 + 0.3 * np.exp(-t / 0.004)), n) * np.exp(-t / 0.012)
    return filt(fade_in(0.9 * click + 0.5 * thock, 0.0003), "lowpass", 8000.0)


# お笑い版の掛け合い用 ---------------------------------------------------------
def sfx_harisen() -> np.ndarray:
    """ツッコミのハリセン「パシッ」: 紙が重なって鳴る鋭いノイズの破裂 3 枚と、短い部屋鳴り。"""
    n = to_samples(0.32)
    x = np.zeros(n)
    for i, (dt, g) in enumerate(((0.0, 1.0), (0.0055, 0.75), (0.0125, 0.5))):
        s = to_samples(dt)
        k = n - s
        add_into(x, s, rng_for("harisen", i).standard_normal(k) * perc(k, 0.0003, 0.016), g)
    body = filt(x, "bandpass", 2300.0, 0.8) + 0.55 * filt(x, "highpass", 5200.0) + 0.3 * filt(x, "lowpass", 700.0)
    ir = mid(reverb_ir(0.22, 0.18, 0.1, "harisen"))
    return body + 0.15 * signal.oaconvolve(body, ir)[:n]


def sfx_chin() -> np.ndarray:
    """スベったときの「チーン」: おりんのように長く残る金属の響き（非整数倍の倍音と、ゆっくりしたうなり）。"""
    n = to_samples(2.6)
    t = np.arange(n) / SR
    f = 1180.0
    partials = ((1.0, 1.0, 1.5), (1.004, 0.55, 1.5), (2.72, 0.32, 0.6), (5.06, 0.14, 0.3), (8.14, 0.05, 0.15))
    y = sum(a * np.sin(2 * np.pi * f * r * t + 0.4 * i) * np.exp(-t / tau) for i, (r, a, tau) in enumerate(partials))
    strike = filt(rng_for("chin").standard_normal(n), "bandpass", 3800.0, 1.2) * perc(n, 0.0002, 0.0025)
    return fade_in(y + 0.25 * strike, 0.0006)


def sfx_drumroll() -> np.ndarray:
    """溜めのドラムロール（1.5 秒、だんだん大きく）と、最後の「ジャン」（シンバルとキック）。"""
    roll = 1.5
    n = to_samples(roll + 1.6)
    x = np.zeros(n)
    hits = [snare_sample(k) for k in range(6)]
    tight = np.exp(-np.arange(hits[0].shape[-1]) / SR / 0.05)
    step = 1 / 26  # 1 秒に 26 打
    for i in range(int(roll / step)):
        u = i * step / roll
        g = (0.18 + 0.62 * u**1.6) * (1.0 if i % 2 == 0 else 0.85)
        add_into(x, to_samples(i * step), hits[i % len(hits)] * tight, g)
    end = to_samples(roll)
    add_into(x, end, mid(crash_sample(1.5)), 0.9)
    add_into(x, end, kick_sample(), 0.8)
    add_into(x, end, snare_sample(9), 0.7)
    return x


def sfx_deden() -> np.ndarray:
    """衝撃の「デデーン」: 低い金管の和音（ノコギリ波）を短く 1 回、長く 1 回。低い太鼓を重ねる。"""
    n = to_samples(1.8)
    x = np.zeros(n)
    chord = (38, 45, 50, 53)  # D2 A2 D3 F3（短三和音）
    for start, dur, g in ((0.0, 0.13, 0.8), (0.2, 1.0, 1.0)):
        s = to_samples(start)
        k = n - s
        tt = np.arange(k) / SR
        tone = sum(saw(hz(m) * (1 + 0.002 * j), k) for j, m in enumerate(chord)) / len(chord)
        tail = np.exp(-dur / (dur * 1.8)) * np.exp(-(tt - dur) / 0.12)
        env = np.minimum(tt / 0.012, 1.0) * np.where(tt < dur, np.exp(-tt / (dur * 1.8)), tail)
        brass = sweep(tone * env, "lowpass", 900.0 + 2600.0 * np.exp(-tt / 0.15), q=0.9)
        add_into(x, s, brass, g)
        add_into(x, s, tom_sample(55.0), 0.7 * g)
    return x


def sfx_zuko() -> np.ndarray:
    """ずっこけの「ヒューン」: すべり笛のように音程が下がる音（ビブラート付き）と、最後の小さな着地。"""
    n = to_samples(0.9)
    t = np.arange(n) / SR
    u = np.clip(t / 0.62, 0.0, 1.0)
    f = 1500.0 * (280.0 / 1500.0) ** (u**1.3) * (1 + 0.025 * np.sin(2 * np.pi * 7.0 * t))
    env = np.minimum(t / 0.01, 1.0) * np.where(t < 0.62, 1.0, np.exp(-(t - 0.62) / 0.05))
    whistle = (osc_sine(f, n) + 0.18 * osc_sine(2 * f, n)) * env
    breath = filt(rng_for("zuko").standard_normal(n), "bandpass", 2000.0, 0.7) * env * 0.05
    land = np.zeros(n)
    add_into(land, to_samples(0.64), tom_sample(90.0), 0.5)
    return whistle + breath + land


SFX = {
    "pop": sfx_pop,
    "whoosh": sfx_whoosh,
    "chime": sfx_chime,
    "tick": sfx_tick,
    "reveal": sfx_reveal,
    "correct": sfx_correct,
    "type": sfx_type,
    "harisen": sfx_harisen,
    "chin": sfx_chin,
    "drumroll": sfx_drumroll,
    "deden": sfx_deden,
    "zuko": sfx_zuko,
}


def finish_sfx(x: np.ndarray) -> np.ndarray:
    x = filt(x, "highpass", 40.0)
    fade_in(x, 0.0003)
    fade_out(x, min(0.03, 0.15 * x.shape[-1] / SR))
    return peak_normalize(x, SFX_PEAK_DB)
