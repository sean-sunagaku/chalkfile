"""音の部品: 決まった値・乱数・フィルタ・オシレータ・エンベロープ・空間系・ダイナミクス・WAV の書き出し。

曲（score.py）も楽器（instruments.py）も知らない。サンプリング周波数は SR だけを使う。
lufs() と true_peak_db() は、生成（master）の中で目標に合わせるための計算。変えると WAV のバイト列が変わる。
書き出した音の大きさを測って判定するのは verify.py（ffmpeg の ebur128）だけにしている。
"""

from __future__ import annotations

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
SEED = 20261028
CEILING_DB = -1.3  # BGM とジングルの true peak の上限（dBTP）。limiter と master の既定


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


# ステレオ（2, n）の左右の平均（センドや効果音を mono にする）
def mid(x: np.ndarray) -> np.ndarray:
    return 0.5 * (x[0] + x[1])


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


def limiter(x: np.ndarray, ceiling_db: float = CEILING_DB, hold: float = 0.008, smooth: float = 0.006) -> np.ndarray:
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


def master(x: np.ndarray, target_lufs: float, ceiling_db: float = CEILING_DB, loop: bool = False) -> np.ndarray:
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
