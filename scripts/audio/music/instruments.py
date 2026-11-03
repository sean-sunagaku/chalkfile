"""楽器: ドラムのワンショット・ライザー・逆シンバルと、音程楽器（ベース・エレピ・パッド・プラック・ベル・スタック）。

どれも 1 音（1 打）を配列で返す。いつ・どの音を鳴らすかは、score.py・bed.py・stings.py・sfx.py が決める。
"""

from __future__ import annotations

import numpy as np

from .dsp import (
    SR,
    add_into,
    adsr,
    fade_in,
    fade_out,
    filt,
    hz,
    osc_sine,
    peak_normalize,
    perc,
    rng_for,
    saw,
    sweep,
    to_samples,
)


# ----------------------------------------------------------------------------
# ドラム（ワンショットは一度だけ合成して使い回す）
# ----------------------------------------------------------------------------
HAT_PARTIALS = (205.3, 304.4, 369.6, 522.7, 540.0, 800.0)  # 金属音を作る 6 本の矩形波の基音


def metal(n: int, scale: float, key: int) -> np.ndarray:
    """非整数比の矩形波 6 本を加算合成で作る（奇数倍音を 20 kHz 未満まで足すので折り返しなし）。"""
    t = np.arange(n) / SR
    rng = rng_for("metal", key)
    out = np.zeros(n)
    for f0 in HAT_PARTIALS:
        f = f0 * scale
        ph = rng.random() * 2 * np.pi
        k = 1
        while k * f < 20000.0:
            out += np.sin(2 * np.pi * k * f * t + k * ph) / k
            k += 2
    return out / np.abs(out).max()


def kick_sample() -> np.ndarray:
    """柔らかめのキック: ピッチが落ちるサイン + ごく短いクリック。"""
    n = to_samples(0.45)
    t = np.arange(n) / SR
    f = 47.0 + 85.0 * np.exp(-t / 0.030) + 60.0 * np.exp(-t / 0.004)
    body = osc_sine(f, n) * np.exp(-t / 0.16)
    body = np.tanh(1.5 * body) / np.tanh(1.5)
    click = filt(rng_for("kick").standard_normal(n), "bandpass", 3200.0, 0.9) * np.exp(-t / 0.002) * 0.22
    k = filt(body + click, "highpass", 30.0)
    fade_in(k, 0.0005)
    fade_out(k, 0.03)
    return peak_normalize(k)


def clap_sample(key: int = 0) -> np.ndarray:
    """クラップ: 10 ms 間隔の短いノイズバースト 3 発 + 余韻。"""
    n = to_samples(0.38)
    t = np.arange(n) / SR
    noise = rng_for("clap", key).standard_normal(n)
    env = np.zeros(n)
    for i, off in enumerate((0.0, 0.0105, 0.0205, 0.031)):
        tt = t - off
        m = tt >= 0
        tau = 0.0045 if i < 3 else 0.085
        env[m] += (1 - np.exp(-tt[m] / 0.0004)) * np.exp(-tt[m] / tau) * (0.8 if i < 3 else 1.0)
    x = filt(noise, "bandpass", 1500.0, 1.0) + 0.35 * filt(noise, "highpass", 2800.0)
    x = filt(x * env, "lowpass", 9000.0)
    fade_out(x, 0.02)
    return peak_normalize(x)


def hat_sample(open_: bool, key: int = 0) -> np.ndarray:
    """ハイハット: 金属音 + ノイズを 7 kHz 以上に絞る。open_ は裏拍の「ツッ」用に長め。"""
    n = to_samples(0.26 if open_ else 0.07)
    rng = rng_for("hat", int(open_), key)
    x = 0.55 * metal(n, 1.0 + 0.012 * key, 100 + key + 50 * int(open_)) + 0.45 * rng.standard_normal(n)
    x = filt(filt(x, "highpass", 6000.0), "highpass", 6000.0)
    x = filt(filt(x, "peak", 9000.0, 1.0, 3.0), "lowpass", 12500.0)
    x *= perc(n, 0.0004, 0.075 if open_ else 0.013)
    fade_out(x, 0.03 if open_ else 0.006)
    return peak_normalize(x)


def crash_sample(dur: float = 2.4, dark: bool = False) -> np.ndarray:
    """クラッシュシンバル（ステレオ、左右で別 seed）。dark=True は高域を抑えた控えめ版。"""
    n = to_samples(dur)
    t = np.arange(n) / SR
    chans = []
    for ch in range(2):
        x = 0.4 * metal(n, 1.47 + 0.03 * ch, 300 + ch) + 0.6 * rng_for("crash", ch, int(dark)).standard_normal(n)
        x = filt(filt(x, "highpass", 1800.0 if dark else 2500.0), "lowpass", 6500.0 if dark else 12000.0)
        x *= np.exp(-t / 0.55) * (0.65 + 0.35 * np.exp(-t / 0.06))
        fade_in(x, 0.0008)
        fade_out(x, 0.15)
        chans.append(x)
    return peak_normalize(np.stack(chans))


def tom_sample(f0: float) -> np.ndarray:
    n = to_samples(0.4)
    t = np.arange(n) / SR
    body = osc_sine(f0 * (1.0 + 0.55 * np.exp(-t / 0.035)), n) * np.exp(-t / 0.14)
    hit = filt(rng_for("tom", int(f0)).standard_normal(n), "bandpass", 4.0 * f0, 1.2) * np.exp(-t / 0.006) * 0.25
    x = body + hit
    fade_in(x, 0.0005)
    fade_out(x, 0.03)
    return peak_normalize(x)


def snare_sample(key: int = 0) -> np.ndarray:
    n = to_samples(0.28)
    t = np.arange(n) / SR
    body = (np.sin(2 * np.pi * 190.0 * t) + 0.45 * np.sin(2 * np.pi * 330.0 * t)) * np.exp(-t / 0.04)
    noise = filt(filt(rng_for("snare", key).standard_normal(n), "highpass", 1700.0), "lowpass", 10000.0)
    x = 0.55 * body + 0.8 * noise * np.exp(-t / 0.075)
    fade_in(x, 0.0005)
    fade_out(x, 0.03)
    return peak_normalize(x)


def riser(dur: float, f0: float = 300.0, f1: float = 9000.0, key: str = "riser", curve: float = 2.2) -> np.ndarray:
    """ノイズのバンドパスを上へ掃引するライザー（ステレオ、終端で最大）。"""
    n = to_samples(dur)
    u = np.arange(n) / n
    fc = f0 * (f1 / f0) ** (u**1.4)
    x = np.stack([sweep(rng_for(key, ch).standard_normal(n), "bandpass", fc, q=1.4) for ch in range(2)])
    x *= u**curve
    fade_out(x, 0.03)
    return peak_normalize(x)


def reverse_cymbal(dur: float) -> np.ndarray:
    """クラッシュを逆再生して吸い込む音（終端が最大）。"""
    x = crash_sample(dur)[:, ::-1].copy()
    x *= np.linspace(0.0, 1.0, x.shape[-1]) ** 1.5
    fade_out(x, 0.015)
    return peak_normalize(x)


# ----------------------------------------------------------------------------
# 音程楽器
# ----------------------------------------------------------------------------
def bass_note(midi: int, dur: float, vel: float, key: tuple) -> np.ndarray:
    """ディスコベース 1 音: PolyBLEP ノコギリ波 → 減衰するローパス + 基音のサイン波（サブ）。"""
    f = hz(midi)
    n = to_samples(dur + 0.05)
    t = np.arange(n) / SR
    rng = rng_for("bass", *key)
    x = sweep(saw(f, n, rng.random()), "lowpass", 220.0 + 2.0 * f + 1800.0 * vel * np.exp(-t / 0.08), q=1.0)
    y = 0.6 * x + 0.55 * np.sin(2 * np.pi * f * t)
    return y * adsr(dur, a=0.002, d=0.16, s=0.72, r=0.05, n=n) * vel


def epiano_note(midi: int, dur: float, vel: float, key: tuple) -> np.ndarray:
    """2-op FM エレピ。本体は 1:1 のペアで、打鍵直後だけ変調指数を上げて Rhodes 風の芯（バーク）を出す。
    もう 1 組の 2-op（モジュレータ 14 倍）をごく小さく重ね、打鍵の瞬間だけ鳴るティン（金属の「チン」）にする。"""
    rng = rng_for("ep", *key)
    f = hz(midi) * 2 ** (rng.uniform(-3.0, 3.0) / 1200)
    rel = 0.30
    n = to_samples(dur + rel)
    t = np.arange(n) / SR
    index = (0.6 + 2.8 * vel) * np.exp(-t / 0.16) + 0.3  # 強く弾くほど「バーク」が出る
    car = np.sin(2 * np.pi * f * t + index * np.sin(2 * np.pi * f * t + rng.random() * 2 * np.pi))
    tine = np.sin(2 * np.pi * f * t + 1.2 * vel * np.exp(-t / 0.02) * np.sin(2 * np.pi * 14.0 * f * t)) * np.exp(
        -t / 0.03
    )
    env = adsr(dur, a=0.0015, d=1.0, s=1.0, r=rel, n=n) * np.exp(-t / (1.5 * (261.6 / f) ** 0.4))
    return (car + 0.3 * tine) * env * (0.35 + 0.65 * vel)


def ep_motion(mono: np.ndarray, trem_depth: float = 0.12, pan_depth: float = 0.35) -> np.ndarray:
    """エレピのトレモロ（4 Hz = 8 分音符）とオートパン（2 小節で一周）。テンポ同期なのでループ周期と一致する。"""
    t = np.arange(mono.shape[-1]) / SR
    trem = 1.0 - trem_depth * (0.5 + 0.5 * np.sin(2 * np.pi * 4.0 * t))
    th = (pan_depth * np.sin(2 * np.pi * 0.25 * t) + 1.0) * np.pi / 4
    return np.stack([mono * trem * np.cos(th), mono * trem * np.sin(th)])


def pad_chord(midis, dur: float, key: tuple, bright: float = 1.0) -> np.ndarray:
    """デチューンした 3 本のノコギリ波 × 構成音のパッド（ステレオ、ゆっくり立ち上がる）。"""
    rel = 1.1
    n = to_samples(dur + rel)
    rng = rng_for("pad", *key)
    out = np.zeros((2, n))
    for m in midis:
        for cents, p in ((-9.0, -0.7), (0.0, 0.0), (9.0, 0.7)):
            add_into(out, 0, saw(hz(m) * 2 ** (cents / 1200), n, rng.random()), 1.0, p)
    out = filt(filt(out, "lowpass", 1500.0 * bright, 0.6), "lowpass", 2000.0 * bright, 0.6)
    out = filt(out, "highpass", 170.0)
    return out * adsr(dur, a=0.45, d=0.9, s=0.85, r=rel, n=n) / (2.0 * len(midis))


def pluck_note(midi: int, vel: float, key: tuple) -> np.ndarray:
    """アルペジオ用の短いプラック（ノコギリ波 + サイン、フィルタが一瞬だけ開く）。"""
    rng = rng_for("pluck", *key)
    f = hz(midi)
    n = to_samples(0.32)
    t = np.arange(n) / SR
    x = sweep(saw(f, n, rng.random()), "lowpass", 600.0 + 3600.0 * vel * np.exp(-t / 0.022), q=0.9)
    y = 0.5 * x + 0.5 * np.sin(2 * np.pi * f * t)
    return y * perc(n, 0.001, 0.075) * vel


def bell_note(midi: int, vel: float, key: tuple, tau: float = 0.6, dur: float = 1.6) -> np.ndarray:
    """ジングル用ベル: 1:3.5 の FM（金属的な輝き）に 1:1 の柔らかいリード層を重ねる。"""
    rng = rng_for("bell", *key)
    f = hz(midi)
    n = to_samples(dur)
    t = np.arange(n) / SR
    bright = min(1.0, 1300.0 / f)  # 高い音ほど変調を浅くして 24 kHz を超える側帯波を抑える
    idx = bright * (2.4 * vel * np.exp(-t / 0.05) + 0.6 * np.exp(-t / 0.5))
    bell = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * 3.5 * f * t + rng.random() * 2 * np.pi))
    lead = np.sin(2 * np.pi * f * t + 0.9 * np.exp(-t / 0.25) * np.sin(2 * np.pi * f * t))
    return (0.55 * bell * perc(n, 0.001, tau) + 0.45 * lead * perc(n, 0.003, tau * 0.6)) * vel


def stack_chord(midis, dur: float, key: tuple, rel: float = 0.6) -> np.ndarray:
    """ジングルのヒット用ノコギリ波スタック（フィルタが明るく開いてから閉じる）。"""
    n = to_samples(dur + rel)
    t = np.arange(n) / SR
    rng = rng_for("stack", *key)
    out = np.zeros((2, n))
    for m in midis:
        for j, cents in enumerate((-13.0, -4.0, 4.0, 13.0)):
            add_into(out, 0, saw(hz(m) * 2 ** (cents / 1200), n, rng.random()), 1.0, -0.8 + 1.6 * j / 3)
    out = sweep(out, "lowpass", 1600.0 + 5200.0 * np.exp(-t / 0.22), q=0.8)
    out = filt(out, "highpass", 120.0)
    return out * adsr(dur, a=0.005, d=0.35, s=0.55, r=rel, n=n) / (2.0 * len(midis))
