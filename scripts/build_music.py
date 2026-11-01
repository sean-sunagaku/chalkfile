#!/usr/bin/env python3
"""Stripe サブスク課金 実装講座 — BGM・ジングル・効果音ジェネレータ

すべてコードだけで合成する（サンプル音源・ダウンロードなし）。乱数はすべて固定 seed
なので、同じコードからは毎回まったく同じ WAV ができる。

出力（public/audio/ は gitignore 済み）:
  public/audio/music/bed.wav          講義 BGM ループ（120 BPM・C major・64 小節 = 128.0 s）
  public/audio/music/sting_intro.wav  タイトルカード用ジングル（約 5.5 s）
  public/audio/music/sting_outro.wav  エンドカード用ジングル（約 3.5 s）
  public/audio/sfx/*.wav              UI 効果音（mono）。harisen・chin・drumroll・deden・zuko はお笑い版の掛け合い用
  public/audio/music/preview/*.mp3    試聴用 MP3

実行（tools/stripe-billing-course で）:
  uv run --with numpy --with scipy python scripts/build_music.py
  --skip-verify を付けると ffmpeg による計測・ループ継ぎ目検査・MP3 作成を省略する。

構成メモ:
  - 音源: PolyBLEP ノコギリ波、2-op FM（エレピ・ベル）、加算合成の金属音（ハット・シンバル）
  - 処理: RBJ biquad（scipy.signal.lfilter）、指数減衰ノイズ IR の畳み込みリバーブ、
          付点 8 分のピンポンディレイ、キック連動のサイドチェイン、バスコンプ、
          4 倍オーバーサンプルのピークで動くルックアヘッド・リミッタ
  - bed.wav はループ末尾からはみ出す残響・ディレイを先まで描画し、先頭へ折り返して足す。
    非線形処理（コンプ・リミッタ）はループの前後をつないだ状態で掛けるので継ぎ目が出ない。
  - ナレーションの帯域を空けるため、音楽バスの 1〜4 kHz を約 3.5 dB 下げている。
"""

from __future__ import annotations

import argparse
import itertools
import re
import shutil
import subprocess
import tempfile
import zlib
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.io import wavfile
from scipy.ndimage import minimum_filter1d, uniform_filter1d

# ----------------------------------------------------------------------------
# 定数
# ----------------------------------------------------------------------------
SR = 48_000
BPM = 120.0
BEAT = 60.0 / BPM  # 0.5 s
STEP = BEAT / 4  # 16 分音符 = 0.125 s = 6000 サンプル
BAR = 4 * BEAT  # 2.0 s
BED_BARS = 64
BED_SAMPLES = int(round(BED_BARS * BAR * SR))  # 6,144,000
TAIL_SAMPLES = 8 * SR  # ループ末尾からはみ出す残響を描画しておく長さ
SEED = 20261028

ROOT = Path(__file__).resolve().parent.parent
MUSIC_DIR = ROOT / "public" / "audio" / "music"
SFX_DIR = ROOT / "public" / "audio" / "sfx"
PREVIEW_DIR = MUSIC_DIR / "preview"


# ----------------------------------------------------------------------------
# 小物
# ----------------------------------------------------------------------------
def rng_for(*keys) -> np.random.Generator:
    """キー列から決定的な乱数生成器を作る（hash() は実行ごとに変わるので使わない）。"""
    ints = [SEED]
    for k in keys:
        ints.append(zlib.crc32(k.encode()) if isinstance(k, str) else int(k) & 0xFFFFFFFF)
    return np.random.default_rng(ints)


def hz(midi: float) -> float:
    return 440.0 * 2.0 ** ((midi - 69.0) / 12.0)


def to_samples(t: float) -> int:
    return int(round(t * SR))


def db(x: float) -> float:
    return 20.0 * np.log10(max(float(x), 1e-12))


def undb(d: float) -> float:
    return 10.0 ** (d / 20.0)


def pan_gains(p: float) -> tuple[float, float]:
    """等パワーパン。p=-1 で左、+1 で右。"""
    th = (np.clip(p, -1.0, 1.0) + 1.0) * np.pi / 4.0
    return float(np.cos(th)), float(np.sin(th))


def add_into(buf: np.ndarray, start: int, sig: np.ndarray, gain: float = 1.0, pan: float = 0.0) -> None:
    """buf（mono: (n,) / stereo: (2, n)）の start サンプル目から sig を足す。はみ出しは切る。"""
    n_buf = buf.shape[-1]
    if start >= n_buf:
        return
    s0 = max(start, 0)
    off = s0 - start
    seg = sig[..., off : off + (n_buf - s0)]
    m = seg.shape[-1]
    if m <= 0:
        return
    if buf.ndim == 2 and seg.ndim == 1:
        gl, gr = pan_gains(pan)
        buf[0, s0 : s0 + m] += gain * gl * seg
        buf[1, s0 : s0 + m] += gain * gr * seg
    else:
        buf[..., s0 : s0 + m] += gain * seg


def fade_in(x: np.ndarray, sec: float) -> np.ndarray:
    k = min(x.shape[-1], max(1, to_samples(sec)))
    x[..., :k] *= np.sin(np.linspace(0.0, np.pi / 2, k)) ** 2
    return x


def fade_out(x: np.ndarray, sec: float) -> np.ndarray:
    k = min(x.shape[-1], max(1, to_samples(sec)))
    x[..., -k:] *= np.cos(np.linspace(0.0, np.pi / 2, k)) ** 2
    x[..., -1] = 0.0  # 最後のサンプルは厳密に 0（ディザも乗らない）
    return x


def peak_normalize(x: np.ndarray, peak_db: float = 0.0) -> np.ndarray:
    return x * (undb(peak_db) / max(np.abs(x).max(), 1e-12))


# ----------------------------------------------------------------------------
# フィルタ（RBJ Audio EQ Cookbook）
# ----------------------------------------------------------------------------
def biquad(kind: str, f0: float, q: float = 0.7071, gain_db: float = 0.0):
    f0 = float(np.clip(f0, 5.0, SR * 0.47))
    w0 = 2.0 * np.pi * f0 / SR
    c, s = np.cos(w0), np.sin(w0)
    alpha = s / (2.0 * q)
    big_a = 10.0 ** (gain_db / 40.0)
    if kind == "lowpass":
        b = [(1 - c) / 2, 1 - c, (1 - c) / 2]
        a = [1 + alpha, -2 * c, 1 - alpha]
    elif kind == "highpass":
        b = [(1 + c) / 2, -(1 + c), (1 + c) / 2]
        a = [1 + alpha, -2 * c, 1 - alpha]
    elif kind == "bandpass":  # ピーク 0 dB
        b = [alpha, 0.0, -alpha]
        a = [1 + alpha, -2 * c, 1 - alpha]
    elif kind == "peak":
        b = [1 + alpha * big_a, -2 * c, 1 - alpha * big_a]
        a = [1 + alpha / big_a, -2 * c, 1 - alpha / big_a]
    elif kind in ("lowshelf", "highshelf"):
        sq = 2.0 * np.sqrt(big_a) * alpha
        A = big_a
        if kind == "lowshelf":
            b = [A * ((A + 1) - (A - 1) * c + sq), 2 * A * ((A - 1) - (A + 1) * c), A * ((A + 1) - (A - 1) * c - sq)]
            a = [(A + 1) + (A - 1) * c + sq, -2 * ((A - 1) + (A + 1) * c), (A + 1) + (A - 1) * c - sq]
        else:
            b = [A * ((A + 1) + (A - 1) * c + sq), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - sq)]
            a = [(A + 1) - (A - 1) * c + sq, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - sq]
    else:
        raise ValueError(kind)
    b = np.asarray(b, float) / a[0]
    a = np.asarray(a, float) / a[0]
    return b, a


def filt(x: np.ndarray, kind: str, f0: float, q: float = 0.7071, gain_db: float = 0.0) -> np.ndarray:
    b, a = biquad(kind, f0, q, gain_db)
    return signal.lfilter(b, a, x, axis=-1)


def sweep(x: np.ndarray, kind: str, fc: np.ndarray, q: float = 0.7071, block: int = 64) -> np.ndarray:
    """カットオフが時間変化する biquad。ブロックごとに係数を更新し、内部状態は引き継ぐ。"""
    x = np.asarray(x, float)
    y = np.empty_like(x)
    zi = np.zeros(x.shape[:-1] + (2,))
    n = x.shape[-1]
    for s in range(0, n, block):
        e = min(s + block, n)
        b, a = biquad(kind, fc[(s + e) // 2], q)
        y[..., s:e], zi = signal.lfilter(b, a, x[..., s:e], axis=-1, zi=zi)
    return y


# ----------------------------------------------------------------------------
# オシレータとエンベロープ
# ----------------------------------------------------------------------------
def _polyblep(t: np.ndarray, dt: np.ndarray) -> np.ndarray:
    out = np.zeros_like(t)
    lo = t < dt
    x = t[lo] / dt[lo]
    out[lo] = x + x - x * x - 1.0
    hi = t > 1.0 - dt
    x = (t[hi] - 1.0) / dt[hi]
    out[hi] = x * x + x + x + 1.0
    return out


def saw(freq, n: int, phase0: float = 0.0) -> np.ndarray:
    """PolyBLEP で帯域制限したノコギリ波。freq はスカラーか長さ n の配列。"""
    dt = np.array(np.broadcast_to(np.asarray(freq, float) / SR, (n,)))
    ph = (phase0 + np.concatenate(([0.0], np.cumsum(dt[:-1])))) % 1.0
    return 2.0 * ph - 1.0 - _polyblep(ph, dt)


def osc_sine(freq, n: int, phase0: float = 0.0) -> np.ndarray:
    """周波数が時間変化してよいサイン波（位相を積分する）。"""
    f = np.broadcast_to(np.asarray(freq, float), (n,))
    ph = 2.0 * np.pi * np.concatenate(([0.0], np.cumsum(f[:-1]))) / SR
    return np.sin(ph + phase0)


def adsr(
    dur: float, a: float = 0.005, d: float = 0.2, s: float = 0.7, r: float = 0.1, n: int | None = None
) -> np.ndarray:
    """dur 秒押鍵する ADSR。長さは dur + r（n 指定時は n）、末尾は必ず 0 になる。"""
    total = to_samples(dur + r) if n is None else n
    t = np.arange(total) / SR
    a = max(a, 1e-4)
    rise = np.sin(0.5 * np.pi * np.clip(t / a, 0.0, 1.0)) ** 2
    fall = s + (1.0 - s) * np.exp(-np.maximum(t - a, 0.0) / max(d, 1e-4))
    held = np.where(t < a, rise, fall)
    g = min(to_samples(dur), total - 1)
    rel = held[g] * np.exp(-np.maximum(t - dur, 0.0) / max(r / 5.0, 1e-4))
    env = np.where(t < dur, held, rel)
    return fade_out(env, 0.002)


def perc(n: int, attack: float, tau: float) -> np.ndarray:
    """立ち上がり attack 秒、時定数 tau 秒の指数減衰。"""
    t = np.arange(n) / SR
    env = np.exp(-t / tau)
    fade_in(env, max(attack, 0.0002))
    return fade_out(env, 0.003)


# ----------------------------------------------------------------------------
# 空間系
# ----------------------------------------------------------------------------
def reverb_ir(seconds: float, rt_low: float, rt_high: float, key: str, predelay: float = 0.015) -> np.ndarray:
    """指数減衰ノイズの IR（左右で seed を変える）。高域ほど早く減衰させる。"""
    n = to_samples(seconds)
    t = np.arange(n) / SR
    chans = []
    for ch in range(2):
        noise = rng_for("reverb", key, ch).standard_normal(n)
        low = filt(noise, "lowpass", 2200.0, 0.5)
        high = noise - low
        ir = low * np.exp(-6.91 * t / rt_low) + high * np.exp(-6.91 * t / rt_high)
        ir = filt(filt(ir, "highpass", 200.0), "lowpass", 9000.0)
        fade_in(ir, 0.006)
        fade_out(ir, 0.05)
        pre = np.zeros(to_samples(predelay + 0.0035 * ch))
        chans.append(np.concatenate([pre, ir]))
    m = max(len(c) for c in chans)
    ir = np.stack([np.pad(c, (0, m - len(c))) for c in chans])
    return ir / np.sqrt((ir**2).sum(axis=1, keepdims=True))


def reverb(send: np.ndarray, ir: np.ndarray) -> np.ndarray:
    """モノラルのセンドを左右別々の IR で畳み込み、(2, n) の wet を返す（長さは入力と同じ）。"""
    n = send.shape[-1]
    return np.stack([signal.oaconvolve(send, ir[c])[:n] for c in range(2)])


def pingpong(
    x: np.ndarray, delay: float, feedback: float = 0.4, taps: int = 8, lp: float = 5000.0, hp: float = 300.0
) -> np.ndarray:
    """モノラル入力のピンポンディレイ（wet のみ、(2, n)）。反復ごとにローパスで暗くなる。"""
    n = x.shape[-1]
    out = np.zeros((2, n))
    d = to_samples(delay)
    y = filt(x, "highpass", hp)
    b, a = biquad("lowpass", lp, 0.6)
    for k in range(1, taps + 1):
        y = signal.lfilter(b, a, y)
        add_into(out[(k - 1) % 2], k * d, y, feedback ** (k - 1))
    return out


def sidechain_gain(n: int, kicks: np.ndarray, depth: float, attack: float = 0.004, recover: float = 0.30) -> np.ndarray:
    """キック位置（サンプル）から作るダッキング用ゲイン。1 - depth まで沈んで recover 秒で戻る。"""
    kicks = np.sort(np.asarray(kicks, np.int64))
    idx = np.arange(n)
    pos = np.searchsorted(kicks, idx, side="right") - 1
    since = np.where(pos >= 0, idx - kicks[np.maximum(pos, 0)], 10**9) / SR
    shape = np.zeros(n)
    m1 = since < attack
    shape[m1] = np.sin(0.5 * np.pi * since[m1] / attack) ** 2
    m2 = (since >= attack) & (since < attack + recover)
    u = (since[m2] - attack) / recover
    shape[m2] = 1.0 - u * u * (3.0 - 2.0 * u)
    return 1.0 - depth * shape


# ----------------------------------------------------------------------------
# ダイナミクスとラウドネス
# ----------------------------------------------------------------------------
def compressor(
    x: np.ndarray,
    thresh_db: float,
    ratio: float = 2.0,
    knee_db: float = 6.0,
    attack: float = 0.015,
    release: float = 0.16,
    block: int = 48,
):
    """ステレオリンクの RMS コンプ。検出とゲイン平滑は 1 ms ブロックで行い、サンプルへ補間する。"""
    x2 = np.atleast_2d(x)
    n = x2.shape[-1]
    nb = -(-n // block)
    p = np.zeros(nb * block)
    p[:n] = (x2**2).mean(axis=0)
    p = p.reshape(nb, block).mean(axis=1)
    k = np.exp(-block / (0.010 * SR))
    p = signal.lfilter([1 - k], [1, -k], p)
    over = 10 * np.log10(np.maximum(p, 1e-12)) - thresh_db
    slope = 1.0 - 1.0 / ratio
    gr = np.where(
        over <= -knee_db / 2,
        0.0,
        np.where(over >= knee_db / 2, slope * over, slope * (over + knee_db / 2) ** 2 / (2 * knee_db)),
    )
    ka = np.exp(-block / (attack * SR))
    kr = np.exp(-block / (release * SR))
    sm = np.empty(nb)
    cur = 0.0
    for i, v in enumerate(gr.tolist()):
        c = ka if v > cur else kr
        cur = c * cur + (1 - c) * v
        sm[i] = cur
    gain = np.interp(np.arange(n), (np.arange(nb) + 0.5) * block, 10 ** (-sm / 20))
    return (x2 * gain).reshape(np.shape(x)), sm


def true_peak_env(x: np.ndarray) -> np.ndarray:
    """4 倍オーバーサンプルした絶対値ピークを元のサンプル位置ごとにまとめる（全チャンネルの最大）。"""
    x2 = np.atleast_2d(x)
    n = x2.shape[-1]
    up = np.abs(signal.resample_poly(x2, 4, 1, axis=-1)).max(axis=0)[: 4 * n]
    env = up.reshape(n, 4).max(axis=1)
    return np.maximum(env, np.abs(x2).max(axis=0))


def true_peak_db(x: np.ndarray) -> float:
    return db(true_peak_env(x).max())


def limiter(x: np.ndarray, ceiling_db: float = -1.3, hold: float = 0.008, smooth: float = 0.006) -> np.ndarray:
    """ルックアヘッド・リミッタ。最小値ホールド → 移動平均の順なので、ピークは必ず ceiling 以下になる。"""
    req = np.minimum(1.0, undb(ceiling_db) / np.maximum(true_peak_env(x), 1e-12))
    h, s = to_samples(hold), min(to_samples(smooth), to_samples(hold))
    g = minimum_filter1d(req, size=2 * h + 1, mode="nearest")
    g = uniform_filter1d(g, size=2 * s + 1, mode="nearest")
    return x * g


def lufs(x: np.ndarray) -> float:
    """ITU-R BS.1770-4 の integrated loudness（48 kHz 用の K 特性係数）。"""
    x2 = np.atleast_2d(x)
    b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]
    a1 = [1.0, -1.69065929318241, 0.73248077421585]
    b2 = [1.0, -2.0, 1.0]
    a2 = [1.0, -1.99004745483398, 0.99007225036621]
    y = signal.lfilter(b2, a2, signal.lfilter(b1, a1, x2, axis=-1), axis=-1)
    block, hop = to_samples(0.4), to_samples(0.1)
    n = y.shape[-1]
    if n < block:
        return float("-inf")
    cs = np.cumsum(np.pad(y**2, ((0, 0), (1, 0))), axis=-1)
    starts = np.arange(0, n - block + 1, hop)
    z = ((cs[:, starts + block] - cs[:, starts]) / block).sum(axis=0)
    loud = -0.691 + 10 * np.log10(np.maximum(z, 1e-20))
    keep = loud > -70.0
    if not keep.any():
        return float("-inf")
    rel = -0.691 + 10 * np.log10(z[keep].mean()) - 10.0
    keep &= loud > rel
    return float(-0.691 + 10 * np.log10(z[keep].mean()))


def circular(fn, x: np.ndarray, pad: float = 2.0) -> np.ndarray:
    """ループ素材に非線形処理を掛ける。前後に反対側の端をつないで処理し、中央だけ返す。"""
    p = to_samples(pad)
    ext = np.concatenate([x[..., -p:], x, x[..., :p]], axis=-1)
    return fn(ext)[..., p : p + x.shape[-1]]


def master(x: np.ndarray, target_lufs: float, ceiling_db: float = -1.3, loop: bool = False) -> np.ndarray:
    """目標ラウドネスに合わせ、true peak が ceiling を超える分だけリミッタを掛ける。"""
    lim = (lambda y: circular(lambda z: limiter(z, ceiling_db), y)) if loop else (lambda y: limiter(y, ceiling_db))
    for _ in range(6):
        x = x * undb(target_lufs - lufs(x))
        if true_peak_db(x) <= ceiling_db:
            return x
        x = lim(x)
    return lim(x)


def write_wav(path: Path, x: np.ndarray, key: str) -> None:
    """TPDF ディザ付きで 16-bit PCM に書き出す。完全な無音サンプルにはディザを足さない。"""
    x2 = np.atleast_2d(x)
    rng = rng_for("dither", key)
    d = (rng.random(x2.shape) - rng.random(x2.shape)) / 32768.0
    d[x2 == 0.0] = 0.0
    y = np.clip(np.round((x2 + d) * 32767.0), -32768, 32767).astype(np.int16)
    path.parent.mkdir(parents=True, exist_ok=True)
    wavfile.write(str(path), SR, y.T.copy() if y.shape[0] > 1 else y[0])


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


# ----------------------------------------------------------------------------
# 和声
# ----------------------------------------------------------------------------
# コード名 → (ルートの pitch class, エレピ・パッド・アルペジオで弾くルートレス・ボイシング)
CHORDS = {
    "Fmaj7": (5, (9, 0, 4, 7)),  # A C E G（Fmaj9）
    "G6": (7, (11, 2, 4, 9)),  # B D E A（G6/9）
    "Em7": (4, (7, 11, 2, 9)),  # G B D A（Em7(11)）
    "Am7": (9, (0, 4, 7, 11)),  # C E G B（Am9）
    "G7": (7, (11, 2, 5, 9)),  # B D F A（G9）
    "A7": (9, (1, 4, 7, 11)),  # C# E G B（A9）
    "E7": (4, (8, 11, 2, 5)),  # G# B D F（E7(b9)）
    "Gm7": (7, (10, 2, 5, 9)),  # Bb D F A（Gm9）
    "C7": (0, (4, 7, 10, 2)),  # E G Bb D（C9）
    "Dm7": (2, (5, 9, 0, 4)),  # F A C E（Dm9）
    "G7sus4": (7, (0, 2, 5, 9)),  # C D F A（G9sus4）
    "Cmaj7": (0, (4, 7, 11, 2)),  # E G B D（Cmaj9）
}


def prog(*bars_spec: str) -> list:
    """ "Fmaj7" や "Gm7 C7"（2 拍ずつ）を、小節ごとの [(コード, 開始 16 分位置)] にする。"""
    out = []
    for spec in bars_spec:
        names = spec.split()
        out.append([(names[0], 0)] if len(names) == 1 else [(names[0], 0), (names[1], 8)])
    return out


OUSHI = prog("Fmaj7", "G6", "Em7", "Am7", "Fmaj7", "G7", "Em7", "A7")  # 王道進行 ×2
MARUSA = prog("Fmaj7", "E7", "Am7", "Gm7 C7") * 2  # 丸サ進行 ×2
C_PROG = prog("Dm7", "G7", "Em7", "Am7", "Dm7", "G7", "Fmaj7", "G7sus4 G7")
D_PROG = prog("Fmaj7", "Em7", "Dm7", "Cmaj7", "Fmaj7", "G6", "Am7", "A7")  # ブレイク → 盛り返し
SECTION_ORDER = ("A", "B", "A2", "C", "A3", "B2", "D", "C2")  # A, B, A', C, A'', B', D, C'
PROGRESSIONS = {"A": OUSHI, "A2": OUSHI, "A3": OUSHI, "B": MARUSA, "B2": MARUSA, "C": C_PROG, "C2": C_PROG, "D": D_PROG}


def voice(pcs, prev, lo: int, hi: int, center: float) -> list[int]:
    """前のボイシングからの移動量が最小になる配置を総当たりで選ぶ（声部連結）。"""
    options = [[m for m in range(lo, hi + 1) if m % 12 == pc] for pc in pcs]
    best, best_cost = None, float("inf")
    for combo in itertools.product(*options):
        notes = sorted(combo)
        if notes[-1] - notes[0] > 12:
            continue
        cost = 0.4 * abs(float(np.mean(notes)) - center)
        cost += 2.5 * sum(1 for a, b in zip(notes, notes[1:]) if b - a == 1)  # 半音の団子を避ける
        if prev is not None:
            cost += sum(abs(a - b) for a, b in zip(notes, prev))
        if cost < best_cost:
            best, best_cost = notes, cost
    return best


def bass_root(name: str) -> int:
    """ベースのルートを E1〜D#2 に置く（オクターブ上は +12）。"""
    m = 24 + CHORDS[name][0]
    return m + 12 if m < 28 else m


class Score:
    """bed.wav の譜面: 小節 → セクション・コード・ボイシング。"""

    def __init__(self) -> None:
        self.voicings: dict = {}
        prev = None
        for bar in range(BED_BARS):
            for name, st in self.chords(bar):
                prev = voice(CHORDS[name][1], prev, 55, 74, 63.5)
                self.voicings[(bar, st)] = prev

    @staticmethod
    def section(bar: int) -> tuple[str, int]:
        bar %= BED_BARS
        return SECTION_ORDER[bar // 8], bar % 8

    def chords(self, bar: int) -> list:
        sec, bi = self.section(bar)
        return PROGRESSIONS[sec][bi]

    def chord_at(self, bar: int, step: float) -> str:
        return [c for c, st in self.chords(bar) if st <= step][-1]

    def voicing_at(self, bar: int, step: float) -> list[int]:
        bar %= BED_BARS
        st = max(s for _, s in self.chords(bar) if s <= step)
        return self.voicings[(bar, st)]


def at(bar: float, step: float = 0.0) -> int:
    """小節番号と 16 分位置 → サンプル位置。"""
    return to_samples((bar * 16 + step) * STEP)


def mid(x: np.ndarray) -> np.ndarray:
    return 0.5 * (x[0] + x[1])


# (16 分位置, ルートからの音程, 長さ[16 分], ベロシティ)。低いルートと 1 オクターブ上を交互に弾く。
BASS_OCTAVES = [
    (s, 0 if s % 4 == 0 else 12, 1.7 if s % 4 == 0 else 1.2, (1.0 if s == 0 else 0.95) if s % 4 == 0 else 0.85)
    for s in range(0, 16, 2)
]
# (16 分位置, 長さ[16 分], ベロシティ)。エレピのシンコペーション・スタブ。
EP_PATTERNS = {
    "A": [(0, 2.0, 0.78), (6, 1.4, 0.66), (10, 1.4, 0.64), (14, 1.8, 0.70)],
    "B": [(0, 3.0, 0.74), (3, 1.0, 0.52), (6, 2.0, 0.68), (10, 1.0, 0.58), (12, 2.0, 0.66)],
    "C": [(0, 1.5, 0.76), (2, 1.0, 0.50), (6, 1.5, 0.68), (8, 1.0, 0.55), (10, 1.5, 0.66), (14, 1.8, 0.70)],
}
ARP_ORDERS = {"A2": (0, 1, 2, 3, 4, 3, 2, 1), "A3": (0, 2, 1, 3, 2, 4, 3, 1), "C2": (4, 3, 2, 1, 0, 1, 2, 3)}
# ナレーション帯域を空ける EQ（1〜4 kHz をおよそ 3〜4 dB 下げる）
VOICE_EQ = (("peak", 1250.0, 0.85, -2.9), ("peak", 3100.0, 0.85, -2.9))  # 1 kHz -3.0 / 1.5〜3 kHz -3.6 / 4 kHz -2.8 dB
BED_MIX = {
    "kick": 0.72,
    "clap": 0.50,
    "hats": 0.26,
    "perc": 0.32,
    "bass": 0.55,
    "ep": 0.23,
    "pad": 0.42,
    "arp": 0.22,
    "fx": 0.22,
}


def voice_eq(x: np.ndarray) -> np.ndarray:
    for kind, f0, q, g in VOICE_EQ:
        x = filt(x, kind, f0, q, g)
    return x


def bass_pattern(sec: str, bi: int) -> list:
    if sec == "D" and bi < 4:
        return [(0, 0, 14.0, 0.8)]  # ブレイク前半は白玉
    pat = list(BASS_OCTAVES)
    if sec in ("C", "C2"):
        pat += [(7, 12, 0.6, 0.5), (15, 7, 0.7, 0.6)]  # ゴーストと 5 度のピックアップ
    elif sec in ("B", "B2") and bi % 2 == 1:
        pat += [(15, 10, 0.7, 0.55)]  # 短 7 度のピックアップ
    if bi == 7:  # セクション終わりのフィル
        head = [e for e in pat if e[0] < 12]
        if sec == "B2":
            pat = head + [(12, 0, 3.0, 0.9)]  # D 前のブレイク
        else:
            pat = head + [(12, 0, 0.9, 0.95), (13, 12, 0.8, 0.75), (14, 10, 0.8, 0.8), (15, 7, 0.8, 0.85)]
    if sec == "D" and bi < 6:
        pat = [(s, i, d, v * 0.85) for s, i, d, v in pat]
    return sorted(pat)


def ep_pattern(sec: str, bi: int) -> list:
    if sec == "D":
        if bi < 4:
            return [(0, 15.0, 0.5)]
        return [(s, d, v * (0.8 if bi < 6 else 1.0)) for s, d, v in EP_PATTERNS["A"]]
    pat = list(EP_PATTERNS[sec[0]])
    if sec == "A3" and bi % 2 == 1:
        pat.append((3, 0.8, 0.42))
    if sec == "B2" and bi % 2 == 1 and bi != 7:
        pat.append((14, 1.5, 0.6))
    return sorted(pat)


def pushes(sec: str, bi: int) -> bool:
    """奇数小節の 4 拍裏で次のコードを先取り（シティポップ的な食い）するか。"""
    return bi % 2 == 1 and not (sec == "B2" and bi == 7) and not (sec == "D" and bi < 4)


def d_filter(x: np.ndarray) -> np.ndarray:
    """D セクション（ブレイク）だけローパスを掛け、8 小節かけて開いていく。前後は 20 ms でクロスフェード。"""
    s0, s1 = at(47, 12) - to_samples(0.05), at(56, 4) + to_samples(0.05)
    seg = x[..., s0:s1]
    pos = (np.arange(s1 - s0) + s0) / SR / BAR
    bp = [47.75, 48.0, 52.0, 54.0, 55.5, 56.0, 56.125]
    fc = np.exp(np.interp(pos, bp, np.log([20000.0, 650.0, 900.0, 2500.0, 9000.0, 18000.0, 20000.0])))
    wet = sweep(seg, "lowpass", fc, q=0.9)
    xf = to_samples(0.02)
    w = np.ones(s1 - s0)
    w[:xf] = np.linspace(0.0, 1.0, xf)
    w[-xf:] = np.linspace(1.0, 0.0, xf)
    y = x.copy()
    y[..., s0:s1] = seg * (1 - w) + wet * w
    return y


def render_bed() -> np.ndarray:
    sc = Score()
    ne = BED_SAMPLES + TAIL_SAMPLES
    st = {k: np.zeros((2, ne)) for k in ("kick", "clap", "hats", "perc", "bass", "pad", "fx")}
    ep_mono, arp_mono = np.zeros(ne), np.zeros(ne)
    rng = rng_for("bed-humanize")

    kick = kick_sample()
    claps = [clap_sample(i) for i in range(3)]
    hats_c = [hat_sample(False, i) for i in range(4)]
    hats_o = [hat_sample(True, i) for i in range(3)]
    toms = {"hi": tom_sample(196.0), "mid": tom_sample(147.0), "low": tom_sample(110.0)}
    tom_pan = {"hi": 0.35, "mid": 0.0, "low": -0.35}
    snares = [snare_sample(i) for i in range(3)]
    kick_pos = []

    for bar in range(BED_BARS):
        sec, bi = Score.section(bar)
        fill = bi == 7
        # --- キック（4 つ打ち。D の前半 4 小節は無し、続く 2 小節は 2 つ打ち）
        if sec == "D" and bi < 4:
            ksteps = []
        elif sec == "D" and bi < 6:
            ksteps = [0, 8]
        elif sec == "B2" and fill:
            ksteps = [0, 4, 8]
        else:
            ksteps = [0, 4, 8, 12]
        for s in ksteps:
            kick_pos.append(at(bar, s))
            add_into(st["kick"], at(bar, s), kick, 0.95 if s == 0 else 0.88)
        # --- クラップ（2・4 拍）
        csteps = [4] if fill and sec in ("A", "A2", "A3", "C2") else [4, 12]
        for s in csteps:
            add_into(st["clap"], at(bar, s), claps[(bar + s) % 3], 0.55 if (sec == "D" and bi < 4) else 0.9)
        # --- ハイハット（16 分のクローズ + 裏 8 分のオープン）
        for s in range(16):
            r = s % 4
            if fill and s >= 12 and sec in ("A", "A2", "A3", "C", "C2", "B2"):
                continue
            p = max(0, at(bar, s) + int(rng.normal(0.0, 0.0012) * SR))  # 負の位置はループ頭で欠けるので詰める
            if sec == "D" and bi < 6:
                if r == 2 or bi >= 4:  # 前半は裏 8 分だけ、続く 2 小節で 16 分に戻る
                    add_into(st["hats"], p, hats_c[s % 4], (0.5 if r == 2 else 0.32) * rng.uniform(0.9, 1.1), 0.25)
                continue
            if r == 2:
                add_into(st["hats"], p, hats_o[(bar + s) % 3], 0.75 * rng.uniform(0.9, 1.05), -0.15)
            elif not (sec == "A" and r == 1):
                vel = {0: 0.62, 1: 0.36, 3: 0.48}[r] * rng.uniform(0.85, 1.1)
                add_into(st["hats"], p, hats_c[(bar * 16 + s) % 4], vel, 0.25)
        # --- 8 小節目のフィル
        if fill:
            if sec in ("A", "A2", "A3"):
                for s, name, v in ((12, "hi", 0.8), (13, "hi", 0.7), (14, "mid", 0.85), (15, "low", 0.95)):
                    add_into(st["perc"], at(bar, s), toms[name], v, tom_pan[name])
            elif sec == "C2":
                for s, name, v in (
                    (10, "hi", 0.7),
                    (12, "mid", 0.8),
                    (13, "mid", 0.7),
                    (14, "low", 0.9),
                    (15, "low", 0.8),
                ):
                    add_into(st["perc"], at(bar, s), toms[name], v, tom_pan[name])
            elif sec == "B":
                for s, v in ((14, 0.55), (15, 0.8)):
                    add_into(st["clap"], at(bar, s), claps[s % 3], v)
            elif sec == "C":
                for i, s in enumerate((12, 13, 14, 15)):
                    add_into(st["perc"], at(bar, s), snares[i % 3], 0.35 + 0.15 * i)
            elif sec == "D":  # 1 小節のスネアロール（最後の 1 拍は 32 分）
                steps = list(range(12)) + [12 + 0.5 * i for i in range(8)]
                for i, s in enumerate(steps):
                    add_into(st["perc"], at(bar, s), snares[i % 3], 0.12 + 0.6 * (i / (len(steps) - 1)) ** 1.5)

        # --- ベース
        push = pushes(sec, bi)
        ep_pat, bass_pat = ep_pattern(sec, bi), bass_pattern(sec, bi)
        # ベースはエレピも食う小節で、かつ 16 分裏のピックアップが無いときだけ一緒に食う
        bass_push = push and any(s >= 14 for s, _, _ in ep_pat) and not any(e[0] == 15 for e in bass_pat)
        for s, interval, d, v in bass_pat:
            name = sc.chord_at(bar + 1, 0) if (bass_push and s == 14 and interval == 12) else sc.chord_at(bar, s)
            note = bass_note(bass_root(name) + interval, d * STEP, v * rng.uniform(0.95, 1.03), (bar, s))
            add_into(st["bass"], at(bar, s), note)
        # --- エレピ
        for s, d, v in ep_pat:
            chord = sc.voicing_at(bar + 1, 0) if (push and s >= 14) else sc.voicing_at(bar, s)
            p = max(0, at(bar, s) + int(rng.normal(0.0, 0.002) * SR))
            for k, m in enumerate(chord):
                note = epiano_note(m, d * STEP, v * rng.uniform(0.93, 1.05), (bar, int(s * 2), k))
                add_into(ep_mono, p + k * to_samples(0.0015), note)
        # --- パッド（B・B'・D）
        if sec in ("B", "B2", "D"):
            chords = sc.chords(bar)
            for i, (_, s) in enumerate(chords):
                end = chords[i + 1][1] if i + 1 < len(chords) else 16
                bright = 0.85 + 0.08 * bi if sec == "D" else 1.0
                gain = (1.35 if bi < 4 else 1.15) if sec == "D" else 1.0
                add_into(
                    st["pad"],
                    at(bar, s),
                    pad_chord(sc.voicing_at(bar, s), (end - s) * STEP + 0.03, (bar, s), bright),
                    gain,
                )
        # --- アルペジオ（A'・A''・C'）
        if sec in ARP_ORDERS:
            order = ARP_ORDERS[sec]
            for s in range(16):
                if sec == "A2" and bi < 4 and s % 2 == 1:
                    continue  # A' の前半は 8 分で入る
                v0 = sc.voicing_at(bar, s)
                tones = [m + 12 for m in v0] + [v0[0] + 24]
                vel = (0.75 if s % 4 == 2 else 0.6 if s % 2 == 0 else 0.48) * rng.uniform(0.9, 1.08)
                add_into(arp_mono, at(bar, s), pluck_note(tones[order[s % 8]], vel, (bar, s)))

    # --- シンバル・ライザー
    crash = crash_sample(2.4)
    for bar, g in ((0, 0.55), (16, 0.5), (32, 0.5), (56, 0.6)):
        add_into(st["fx"], at(bar), crash, g)
    add_into(st["fx"], at(48), crash_sample(3.0, dark=True), 0.45)
    rc = reverse_cymbal(BAR)
    add_into(st["fx"], at(48) - rc.shape[-1], rc, 0.4)  # B' → D の吸い込み
    rs = riser(2 * BAR, 250.0, 8000.0, "bed-riser")
    add_into(st["fx"], at(56) - rs.shape[-1], rs, 0.22)  # D → C' の盛り上げ

    # --- ステレオ化・D のフィルタ・サイドチェイン
    st["ep"] = ep_motion(ep_mono)
    for k in ("kick", "clap", "hats", "perc", "bass", "ep"):
        st[k] = d_filter(st[k])
    kp = np.asarray(kick_pos)
    kp = np.concatenate([kp - BED_SAMPLES, kp, kp + BED_SAMPLES])  # ループの前後へ周期的に延長

    def duck(depth: float) -> np.ndarray:
        return sidechain_gain(ne, kp, depth)

    st["bass"] *= duck(0.35)
    st["ep"] *= duck(0.22)
    st["pad"] *= duck(0.55)
    arp_mono *= duck(0.2)
    arp_wet = pingpong(arp_mono, 0.75 * BEAT, 0.42, taps=8, lp=4500.0, hp=400.0)  # 付点 8 分
    gl, gr = pan_gains(0.15)
    st["arp"] = np.stack([gl * arp_mono, gr * arp_mono]) + 0.55 * arp_wet

    # --- リバーブ
    send = (
        0.20 * mid(st["clap"])
        + 0.22 * mid(st["ep"])
        + 0.30 * mid(st["pad"])
        + 0.15 * mid(st["perc"])
        + 0.04 * mid(st["hats"])
        + 0.12 * mid(st["fx"])
        + 0.18 * mid(st["arp"])
    )
    wet = reverb(send, reverb_ir(3.0, 2.0, 1.0, "bed")) * duck(0.25)

    stem_lufs = {k: lufs(BED_MIX[k] * st[k][:, :BED_SAMPLES]) for k in BED_MIX}
    bus = sum(BED_MIX[k] * st[k] for k in BED_MIX) + 0.55 * wet
    bus = filt(filt(filt(bus, "highpass", 25.0), "lowshelf", 70.0, 0.7, -2.0), "highshelf", 8000.0, 0.7, 2.0)
    bus = voice_eq(bus)

    # --- ループ化: はみ出した残響を先頭へ折り返す
    loop = bus[:, :BED_SAMPLES].copy()
    loop[:, :TAIL_SAMPLES] += bus[:, BED_SAMPLES:]
    mix_lufs = lufs(loop)
    print("  stems (LU relative to mix): " + ", ".join(f"{k} {v - mix_lufs:+.1f}" for k, v in stem_lufs.items()))
    loop *= undb(-20.0 - mix_lufs)  # 一旦 -20 LUFS に揃えてから軽くバスコンプ
    trace = []

    def glue(z: np.ndarray) -> np.ndarray:
        y, reduction = compressor(z, thresh_db=-21.0, ratio=2.0)
        trace.append(reduction)
        return y

    loop = circular(glue, loop)
    red = trace[0]
    p95 = np.percentile(red, 95)
    print(f"  bus comp: gain reduction mean {red.mean():.1f} dB, 95% {p95:.1f} dB, max {red.max():.1f} dB")
    return master(loop, -18.0, -1.3, loop=True)


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
    n = to_samples(5.5)
    ne = n + to_samples(2.0)
    parts = {k: np.zeros((2, ne)) for k in ("drums", "fx", "bass", "keys")}
    bell = np.zeros(ne)
    hit = to_samples(BAR)

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
    return master(_sting_mix(parts, bell, n, "intro", gains, 0.35), -14.0, -1.3)


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
    return master(_sting_mix(parts, bell, n, "outro", gains, 0.3), -16.0, -1.3)


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
    return peak_normalize(x, -3.0)


# ----------------------------------------------------------------------------
# 検証（ffmpeg で計測・ループの継ぎ目検査・試聴用 MP3）
# ----------------------------------------------------------------------------
FFMPEG = shutil.which("ffmpeg") or "/opt/homebrew/bin/ffmpeg"
FFPROBE = shutil.which("ffprobe") or "/opt/homebrew/bin/ffprobe"


def run(cmd: list) -> subprocess.CompletedProcess:
    return subprocess.run([str(c) for c in cmd], capture_output=True, text=True, check=True)


def ffmpeg_measure(path: Path) -> dict:
    """ffmpeg ebur128 の integrated loudness / true peak と、ffprobe の長さ・サンプル数。"""
    err = run([FFMPEG, "-hide_banner", "-nostats", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"]).stderr
    summary = err[err.rfind("Summary:") :]
    i = re.search(r"I:\s+(-?[\d.]+|-inf) LUFS", summary)
    p = re.search(r"Peak:\s+(-?[\d.]+|-inf) dBFS", summary)
    probe = run(
        [
            FFPROBE,
            "-v",
            "error",
            "-select_streams",
            "a:0",
            "-show_entries",
            "stream=sample_rate,channels,duration_ts,duration,codec_name",
            "-of",
            "default=nw=1",
            path,
        ]
    ).stdout
    info = dict(line.split("=", 1) for line in probe.strip().splitlines())
    return {
        "lufs": float(i.group(1)) if i else float("nan"),
        "tp": float(p.group(1)) if p else float("nan"),
        "samples": int(info["duration_ts"]),
        "sec": float(info["duration"]),
        "ch": int(info["channels"]),
        "sr": int(info["sample_rate"]),
        "codec": info["codec_name"],
    }


def check_loop_seam(bed: Path, workdir: Path) -> dict:
    """bed.wav を 2 回つないだファイルで、継ぎ目のサンプル段差・波形の折れ・RMS を調べる。

    比較用に、ファイル内部の同じ音楽的位置（33 小節目の頭: キック + クラッシュ）でも同じ値を出す。
    """
    twice = workdir / "bed_x2.wav"
    run(
        [
            FFMPEG,
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            bed,
            "-i",
            bed,
            "-filter_complex",
            "[0:a][1:a]concat=n=2:v=0:a=1[a]",
            "-map",
            "[a]",
            "-c:a",
            "pcm_s16le",
            twice,
        ]
    )
    _, data = wavfile.read(str(twice))
    x = data.astype(float) / 32768.0
    n = x.shape[0] // 2
    d1 = np.abs(np.diff(x, axis=0)).max(axis=1)  # 1 次差分 = サンプル間の段差
    d3 = np.abs(np.diff(x, n=3, axis=0)).max(axis=1)  # 3 次差分 = 波形の折れ（クリック）
    w = to_samples(0.05)

    def stats(pos: int) -> dict:
        win = slice(pos - SR, pos + SR)
        return {
            "jump": d1[pos - 1],
            "jump_p999": np.percentile(d1[win], 99.9),
            "kink": d3[pos - 3 : pos].max(),
            "kink_p999": np.percentile(d3[win], 99.9),
            "rms_50ms": [db(np.sqrt(np.mean(x[q - w // 2 : q + w // 2] ** 2))) for q in pos + np.arange(-3, 4) * w],
        }

    return {"seam": stats(n), "inside_bar33": stats(at(32)), "twice": twice, "n": n}


def make_previews(workdir: Path, twice: Path) -> list[Path]:
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    mp3 = ["-c:a", "libmp3lame", "-b:a", "192k"]
    base = [FFMPEG, "-hide_banner", "-loglevel", "error", "-y"]
    bed, intro = MUSIC_DIR / "bed.wav", MUSIC_DIR / "sting_intro.wav"
    outs = {
        "bed_30s.mp3": ["-i", bed, "-t", "30", "-af", "afade=t=out:st=27:d=3"],
        "sting_intro.mp3": ["-i", intro],
        "intro_then_bed_30s.mp3": [
            "-i",
            intro,
            "-i",
            bed,
            "-filter_complex",
            "[0:a][1:a]concat=n=2:v=0:a=1,atrim=0:30,afade=t=out:st=27:d=3[a]",
            "-map",
            "[a]",
        ],
        "bed_loop_seam_20s.mp3": ["-ss", str(BED_SAMPLES / SR - 10.0), "-t", "20", "-i", twice],
    }
    paths = []
    for name, args in outs.items():
        run(base + args + mp3 + [PREVIEW_DIR / name])
        paths.append(PREVIEW_DIR / name)
    return paths


def verify(files: list[Path]) -> None:
    print("\n== ffmpeg 計測（ebur128, true peak）==")
    print(f"{'file':<36}{'sec':>9}{'samples':>11}{'ch':>4}{'LUFS':>8}{'TP dBFS':>9}{'peak':>8}{'DC':>10}")
    for f in files:
        m = ffmpeg_measure(f)
        _, data = wavfile.read(str(f))
        x = data.astype(float) / 32768.0
        lu = f"{m['lufs']:.1f}" if m["sec"] >= 0.4 else "n/a"
        name = f.relative_to(ROOT).as_posix()
        cols = f"{m['sec']:>9.3f}{m['samples']:>11}{m['ch']:>4}{lu:>8}{m['tp']:>9.1f}"
        print(f"{name:<36}{cols}{db(np.abs(x).max()):>8.1f}{x.mean():>10.1e}")
    with tempfile.TemporaryDirectory() as td:
        res = check_loop_seam(MUSIC_DIR / "bed.wav", Path(td))
        print("\n== bed.wav ループ継ぎ目（2 回連結して計測）==")
        print(f"連結後の長さ {2 * res['n']} samples（ループ 1 周 = {res['n']}）")
        for label in ("seam", "inside_bar33"):
            st = res[label]
            print(
                f"  {label:<13} 段差 {st['jump']:.5f}（前後 1 s の 99.9%: {st['jump_p999']:.5f}）  "
                f"折れ {st['kink']:.5f}（同 {st['kink_p999']:.5f}）  "
                f"RMS 50 ms 窓 dBFS: {' '.join(f'{v:.1f}' for v in st['rms_50ms'])}"
            )
        previews = make_previews(Path(td), res["twice"])
    print("\n== プレビュー ==")
    for p in previews:
        print(f"  {p.relative_to(ROOT).as_posix()}")


def main() -> None:
    ap = argparse.ArgumentParser(description="講座動画の BGM・ジングル・効果音を合成する")
    ap.add_argument("--skip-verify", action="store_true", help="ffmpeg による計測・継ぎ目検査・MP3 作成を省略")
    ap.add_argument("--only", nargs="+", metavar="NAME", help="指定した効果音だけを書き出す（BGM・ジングル・ほかの効果音には触れない）")
    args = ap.parse_args()

    if args.only:
        unknown = [k for k in args.only if k not in SFX]
        if unknown:
            raise SystemExit(f"効果音が無い: {unknown}（{', '.join(SFX)}）")
        for name in args.only:
            path = SFX_DIR / f"{name}.wav"
            x = finish_sfx(SFX[name]())
            write_wav(path, x, f"sfx-{name}")
            print(f"wrote {path.relative_to(ROOT)}  {x.shape[-1] / SR:.2f} s  true peak {true_peak_db(x):.2f} dBTP")
        return

    files = []
    jobs = [
        (MUSIC_DIR / "bed.wav", render_bed),
        (MUSIC_DIR / "sting_intro.wav", render_intro),
        (MUSIC_DIR / "sting_outro.wav", render_outro),
    ]
    for path, fn in jobs:
        print(f"rendering {path.name} ...", flush=True)
        x = fn()
        write_wav(path, x, path.stem)
        print(f"  {x.shape[-1]} samples, {lufs(x):.2f} LUFS, true peak {true_peak_db(x):.2f} dBTP (python)")
        files.append(path)
    for name, fn in SFX.items():
        path = SFX_DIR / f"{name}.wav"
        write_wav(path, finish_sfx(fn()), f"sfx-{name}")
        files.append(path)
    print(f"wrote {len(files)} files")
    if not args.skip_verify:
        verify(files)


if __name__ == "__main__":
    main()
