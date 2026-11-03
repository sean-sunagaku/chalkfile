"""講義 BGM のループ（bed.wav。120 BPM・C major・64 小節 = 128.0 s）。

- ループ末尾からはみ出す残響・ディレイを先まで描画し、先頭へ折り返して足す。
  非線形処理（コンプ・リミッタ）はループの前後をつないだ状態で掛けるので継ぎ目が出ない。
- ナレーションの帯域を空けるため、音楽バスの 1〜4 kHz を約 3.5 dB 下げている。
"""

from __future__ import annotations

import numpy as np

from .dsp import (
    CEILING_DB,
    SR,
    add_into,
    circular,
    compressor,
    filt,
    lufs,
    master,
    mid,
    pan_gains,
    pingpong,
    reverb,
    reverb_ir,
    rng_for,
    sidechain_gain,
    sweep,
    to_samples,
    undb,
)
from .instruments import (
    bass_note,
    clap_sample,
    crash_sample,
    epiano_note,
    ep_motion,
    hat_sample,
    kick_sample,
    pad_chord,
    pluck_note,
    reverse_cymbal,
    riser,
    snare_sample,
    tom_sample,
)
from .score import (
    ARP_ORDERS,
    BAR,
    BEAT,
    BED_BARS,
    BED_SAMPLES,
    STEP,
    Score,
    at,
    bass_pattern,
    bass_root,
    ep_pattern,
    pushes,
)

TAIL_SAMPLES = 8 * SR  # ループ末尾からはみ出す残響を描画しておく長さ
BED_LUFS = -18.0  # 目標のラウドネス（verify.py が ffmpeg で確かめる）


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
    return master(loop, BED_LUFS, CEILING_DB, loop=True)
