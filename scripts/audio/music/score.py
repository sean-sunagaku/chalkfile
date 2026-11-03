"""譜面: テンポ・曲の形（64 小節のループ）・和声（コードと進行・声部連結）と、ベースとエレピの型。"""

from __future__ import annotations

import itertools

import numpy as np

from .dsp import SR, to_samples

# ----------------------------------------------------------------------------
# テンポと曲の形
# ----------------------------------------------------------------------------
BPM = 120.0
BEAT = 60.0 / BPM  # 0.5 s
STEP = BEAT / 4  # 16 分音符 = 0.125 s = 6000 サンプル
BAR = 4 * BEAT  # 2.0 s
BED_BARS = 64
BED_SAMPLES = int(round(BED_BARS * BAR * SR))  # 6,144,000


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
        cost += 2.5 * sum(1 for a, b in itertools.pairwise(notes) if b - a == 1)  # 半音の団子を避ける
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


# ----------------------------------------------------------------------------
# 小節の位置と、ベース・エレピの型（bed.wav の譜面）
# ----------------------------------------------------------------------------
def at(bar: float, step: float = 0.0) -> int:
    """小節番号と 16 分位置 → サンプル位置。"""
    return to_samples((bar * 16 + step) * STEP)


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
