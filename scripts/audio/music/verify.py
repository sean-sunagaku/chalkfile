"""確かめる: ffmpeg の計測と目標の判定・bed.wav のループの継ぎ目・試聴用 MP3・素材の SHA256SUMS との照合。

- 書き出した音の大きさ（integrated loudness・true peak・sample peak）を測って判定するのは、ここの ffmpeg（ebur128）だけ。
  生成の dsp.lufs()・dsp.true_peak_db() は目標に合わせるための計算で、置き換えると WAV のバイト列が変わるので残している
- 素材の SHA256SUMS との照合（--check）は、作った WAV が materials ブランチの WAV と 1 バイトも違わないかを見る
"""

from __future__ import annotations

import hashlib
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import NamedTuple

import numpy as np
from scipy.io import wavfile

from .dsp import SR, db, to_samples
from .paths import MUSIC_DIR, PREVIEW_DIR, ROOT
from .score import BED_SAMPLES, at

# ----------------------------------------------------------------------------
# ffmpeg で計測・目標の判定・ループの継ぎ目検査・試聴用 MP3
# ----------------------------------------------------------------------------
FFMPEG = shutil.which("ffmpeg")
FFPROBE = shutil.which("ffprobe")
LUFS_TOL = 0.5  # integrated loudness の、目標からの幅（LU）
TP_TOL = 0.2  # true peak の、上限を超えてよい幅（dB）。生成（4 倍オーバーサンプル）と ffmpeg の補間の違いの分
PEAK_TOL = 0.1  # sample peak の、目標からの幅（dB）


class Target(NamedTuple):
    """書き出した 1 本の目標（生成が合わせた値）。verify() が ffmpeg で測って比べる。"""

    lufs: float | None = None  # integrated loudness（LUFS）
    ceiling: float | None = None  # true peak の上限（dBTP）
    peak: float | None = None  # sample peak（dBFS）

    def label(self) -> str:
        parts = []
        if self.lufs is not None:
            parts.append(f"{self.lufs:.1f} LUFS")
        if self.ceiling is not None:
            parts.append(f"TP {self.ceiling:.1f} dBTP 以下")
        if self.peak is not None:
            parts.append(f"peak {self.peak:.1f} dBFS")
        return "・".join(parts)

    def misses(self, m: dict) -> list[str]:
        """ffmpeg で測った値（ffmpeg_measure）のうち、目標から外れたものの説明。NaN（測れなかった）も外れにする。"""

        def within(diff: float, tol: float) -> bool:
            return round(diff, 6) <= tol  # ffmpeg は 0.1 刻みで出すので、ちょうど幅の端の値を浮動小数の誤差で外さない

        out = []
        if self.lufs is not None and not within(abs(m["lufs"] - self.lufs), LUFS_TOL):
            out.append(f"LUFS {m['lufs']:.1f}（目標 {self.lufs:.1f} ±{LUFS_TOL}）")
        if self.ceiling is not None and not within(m["tp"] - self.ceiling, TP_TOL):
            out.append(f"true peak {m['tp']:.1f} dBTP（上限 {self.ceiling:.1f}。+{TP_TOL} までは許す）")
        if self.peak is not None and not within(abs(m["peak"] - self.peak), PEAK_TOL):
            out.append(f"sample peak {m['peak']:.1f} dBFS（目標 {self.peak:.1f} ±{PEAK_TOL}）")
        return out


def run(cmd: list) -> subprocess.CompletedProcess:
    return subprocess.run([str(c) for c in cmd], capture_output=True, text=True, check=True)


def ffmpeg_measure(path: Path) -> dict:
    """ffmpeg ebur128 の integrated loudness・sample peak・true peak と、ffprobe の長さ・サンプル数。"""
    af = "ebur128=peak=sample+true"
    err = run([FFMPEG, "-hide_banner", "-nostats", "-i", path, "-af", af, "-f", "null", "-"]).stderr
    summary = err[err.rfind("Summary:") :]
    i = re.search(r"I:\s+(-?[\d.]+|-inf) LUFS", summary)
    sp = re.search(r"Sample peak:\s+Peak:\s+(-?[\d.]+|-inf) dBFS", summary)
    tp = re.search(r"True peak:\s+Peak:\s+(-?[\d.]+|-inf) dBFS", summary)
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
        "peak": float(sp.group(1)) if sp else float("nan"),
        "tp": float(tp.group(1)) if tp else float("nan"),
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


def measure(files: list[tuple[Path, Target]]) -> list[str]:
    """ffmpeg で測った表を出し、目標から外れたものの説明を返す。"""
    print("\n== ffmpeg 計測（ebur128。音の大きさの判定はこの値で行う）==")
    print(f"{'file':<36}{'sec':>9}{'samples':>11}{'ch':>4}{'LUFS':>8}{'TP dBFS':>9}{'peak':>8}{'DC':>10}  目標")
    bad = []
    for f, target in files:
        m = ffmpeg_measure(f)
        _, data = wavfile.read(str(f))
        x = data.astype(float) / 32768.0
        lu = f"{m['lufs']:.1f}" if m["sec"] >= 0.4 else "n/a"
        name = f.relative_to(ROOT).as_posix()
        cols = f"{m['sec']:>9.3f}{m['samples']:>11}{m['ch']:>4}{lu:>8}{m['tp']:>9.1f}{m['peak']:>8.1f}{x.mean():>10.1e}"
        miss = target.misses(m)
        print(f"{name:<36}{cols}  {'外れ（' + '・'.join(miss) + '）' if miss else 'ok（' + target.label() + '）'}")
        bad += [f"{name}: {s}" for s in miss]
    print(f"（目標からの幅: LUFS ±{LUFS_TOL} LU・TP は上限の +{TP_TOL} dB まで・peak ±{PEAK_TOL} dB）")
    return bad


def verify(files: list[tuple[Path, Target]], seam: bool = True) -> None:
    """ffmpeg で測って目標と比べる。seam なら bed.wav の継ぎ目も調べ、試聴用 MP3 を作る。外れたら 1 で終える。"""
    if not FFMPEG or not FFPROBE:
        raise SystemExit(
            "ffmpeg・ffprobe が PATH に無い。入れてから流すか、--skip-verify で計測を省く（WAV は書き終えている）"
        )
    bad = measure(files)
    if seam:
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
    if bad:
        sys.stdout.flush()  # 表を先に出してから、外れた一覧を出す
        raise SystemExit("目標から外れた（ffmpeg の計測。WAV は書き終えている）:\n  " + "\n  ".join(bad))


# ----------------------------------------------------------------------------
# 素材の SHA256SUMS との照合（--check。npm run music:verify）
# ----------------------------------------------------------------------------
def parse_sums(text: str) -> dict[str, str]:
    """SHA256SUMS（「sha256  パス」の行。scripts/materials.ts が書く）を、パス → sha256 にする。"""
    sums = {}
    for line in filter(None, text.split("\n")):
        m = re.fullmatch(r"([0-9a-f]{64}) [ *](.+)", line)
        if not m:
            raise SystemExit(f"SHA256SUMS が読めない: {line[:80]}")
        sums[m.group(2)] = m.group(1)
    return sums


def materials_sums(sums_file: Path | None) -> tuple[dict[str, str], str]:
    """素材の SHA256SUMS と、どこのものかの説明。

    既定は、手元にある素材のブランチ（<remote>/<branch>）のもの。remote と branch は scripts/materials.ts と同じ
    環境変数 MATERIALS_REMOTE・MATERIALS_BRANCH で変えられる。取ってくるのは npm run materials:pull に任せる。
    """
    if sums_file is not None:
        return parse_sums(sums_file.read_text()), str(sums_file)
    remote = os.environ.get("MATERIALS_REMOTE", "origin")
    branch = os.environ.get("MATERIALS_BRANCH", "materials")
    ref = f"refs/remotes/{remote}/{branch}^{{commit}}"
    found = subprocess.run(
        ["git", "-C", str(ROOT), "rev-parse", "--verify", "--quiet", ref], capture_output=True, text=True, check=False
    )
    if found.returncode != 0:
        raise SystemExit(
            f"素材のブランチ {remote}/{branch} が手元に無い。npm run materials:pull で取ってくるか、--sums で SHA256SUMS を渡す"
        )
    sha = found.stdout.strip()
    text = run(["git", "-C", ROOT, "show", f"{sha}:SHA256SUMS"]).stdout
    return parse_sums(text), f"{remote}/{branch} @ {sha[:7]}"


def check_sums(built: dict[str, Path], sums: dict[str, str], where: str, dirs: list[str] | None) -> bool:
    """作った WAV（素材のパス → 作ったファイル）の sha256 を、素材の SHA256SUMS と比べる。

    dirs（public/audio/music/ など）を渡したら、そこにあって作っていない素材も「違う」に数える（全部を作ったとき）。
    """
    print(f"\n== 素材の SHA256SUMS と照らし合わせる（{where}）==")
    same = 0
    for rel, path in built.items():
        got = hashlib.sha256(path.read_bytes()).hexdigest()
        want = sums.get(rel)
        if got == want:
            same += 1
            print(f"  同じ          {rel}")
        elif want is None:
            print(f"  素材に無い    {rel}（作った {got[:12]}）")
        else:
            print(f"  違う          {rel}（作った {got[:12]}・素材 {want[:12]}）")
    unmade = sorted(rel for rel in sums if dirs and rel.startswith(tuple(dirs)) and rel not in built)
    for rel in unmade:
        print(f"  作っていない  {rel}（素材にはある）")
    ok = same == len(built) and not unmade
    hint = "。音を変えたつもりが無ければ、変えたところを見直す（素材が古いなら npm run materials:pull）"
    print(f"{same}/{len(built)} 個が素材と同じ{'' if ok else hint}")
    return ok
