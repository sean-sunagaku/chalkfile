"""書き出す一覧と、コマンドの引数（入口は scripts/build_music.py）。"""

from __future__ import annotations

import argparse
import tempfile
from collections.abc import Callable
from pathlib import Path
from typing import NamedTuple

import numpy as np

from .bed import BED_LUFS, render_bed
from .dsp import CEILING_DB, SR, write_wav
from .paths import AUDIO_DIR, ROOT
from .sfx import SFX, SFX_PEAK_DB, finish_sfx
from .stings import INTRO_LUFS, OUTRO_LUFS, render_intro, render_outro
from .verify import Target, check_sums, materials_sums, verify


class Job(NamedTuple):
    """書き出す 1 本。"""

    rel: str  # public/audio/ からのパス
    key: str  # ディザの乱数の鍵。変えると WAV のバイト列が変わる
    render: Callable[[], np.ndarray]
    target: Target  # verify.py が ffmpeg で確かめる目標


def music_jobs() -> list[Job]:
    """BGM とジングル（ディザの鍵はファイル名の stem）。"""
    return [
        Job("music/bed.wav", "bed", render_bed, Target(lufs=BED_LUFS, ceiling=CEILING_DB)),
        Job("music/sting_intro.wav", "sting_intro", render_intro, Target(lufs=INTRO_LUFS, ceiling=CEILING_DB)),
        Job("music/sting_outro.wav", "sting_outro", render_outro, Target(lufs=OUTRO_LUFS, ceiling=CEILING_DB)),
    ]


def sfx_job(name: str) -> Job:
    """効果音 1 つ（ディザの鍵は sfx-<名前>）。"""
    return Job(f"sfx/{name}.wav", f"sfx-{name}", lambda: finish_sfx(SFX[name]()), Target(peak=SFX_PEAK_DB))


def check(jobs: list[Job], sums_file: Path | None, whole: bool) -> None:
    """public/audio/ には書かず一時フォルダに作り、素材の SHA256SUMS と比べる。違えば 1 で終える。"""
    sums, where = materials_sums(sums_file)  # 作る前に読む（読めなければ、作る前に止める）
    with tempfile.TemporaryDirectory() as td:
        built = {}
        for job in jobs:
            path = Path(td) / job.rel
            if job.rel.startswith("music/"):
                print(f"rendering {path.name} ...", flush=True)
            write_wav(path, job.render(), job.key)
            built[(AUDIO_DIR / job.rel).relative_to(ROOT).as_posix()] = path
        dirs = sorted({(AUDIO_DIR / Path(job.rel).parent).relative_to(ROOT).as_posix() + "/" for job in jobs})
        ok = check_sums(built, sums, where, dirs if whole else None)
    if not ok:
        raise SystemExit(1)


def main() -> None:
    ap = argparse.ArgumentParser(description="講座動画の BGM・ジングル・効果音を合成する")
    ap.add_argument(
        "--skip-verify", action="store_true", help="ffmpeg による計測・目標の判定・継ぎ目検査・MP3 作成を省略"
    )
    ap.add_argument(
        "--only",
        nargs="+",
        metavar="NAME",
        help="指定した効果音だけを書き出す（BGM・ジングル・ほかの効果音には触れない）",
    )
    ap.add_argument(
        "--check",
        action="store_true",
        help="public/audio/ には書かずに作り、素材の SHA256SUMS と同じバイト列か照らし合わせる（違えば 1 で終える）",
    )
    ap.add_argument(
        "--sums", type=Path, metavar="FILE", help="--check で比べる SHA256SUMS（既定は手元の origin/materials のもの）"
    )
    args = ap.parse_args()
    if args.sums and not args.check:
        ap.error("--sums は --check と一緒に使う")

    if args.only:
        unknown = [k for k in args.only if k not in SFX]
        if unknown:
            raise SystemExit(f"効果音が無い: {unknown}（{', '.join(SFX)}）")
        jobs = [sfx_job(name) for name in args.only]
    else:
        jobs = music_jobs() + [sfx_job(name) for name in SFX]

    if args.check:
        check(jobs, args.sums, whole=not args.only)
        return

    files = []
    for job in jobs:
        path = AUDIO_DIR / job.rel
        music = job.rel.startswith("music/")
        if music:
            print(f"rendering {path.name} ...", flush=True)
        x = job.render()
        write_wav(path, x, job.key)
        if music:
            print(f"  {x.shape[-1]} samples（{x.shape[-1] / SR:.3f} s）")
        elif args.only:
            print(f"wrote {path.relative_to(ROOT)}  {x.shape[-1] / SR:.2f} s")
        files.append((path, job.target))
    if not args.only:
        print(f"wrote {len(files)} files")
    if not args.skip_verify:
        verify(files, seam=not args.only)
