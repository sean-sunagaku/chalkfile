# /// script
# requires-python = ">=3.12,<3.13"
# dependencies = [
#   "kokoro==0.9.4",
#   "misaki[en,zh]==0.9.4",
#   "numpy==2.5.4",
#   "scipy==1.18.1",
#   "soundfile==0.14.0",
#   "torch==2.15.0",
# ]
# ///
"""英語と中国語の台詞を Kokoro（手元で動く TTS）で読み上げ、synth.ts と同じ形の WAV にする。

synth.ts が足りない台詞だけを JSON にまとめて渡す。直接は呼ばない。

  uv run --locked --script scripts/tts_kokoro.py <jobs.json> <出力フォルダ>

依存の版は頭書きと scripts/tts_kokoro.py.lock で固定する。頭書きを変えたら uv lock --script scripts/tts_kokoro.py でロックも作り直す。

jobs.json: {"schema": 1, "jobs": [{"key": "...", "text": "...", "repo": "hexgrad/Kokoro-82M", "voice": "af_heart", "g2p": "a", "speed": 1.0}, ...]}
（形と版は scripts/lib/handoff.ts の KokoroJobs。scripts/audio/handoff.py の read_kokoro_jobs が確かめる。配列だけの前の形も読む）
出力: <key>.wav（48kHz・モノラル・16bit。VOICEVOX の出力と同じ形）と <key>.kana（読み。Kokoro に渡した音素）

- モデルの重み（Apache-2.0）は、初めて使うときに Hugging Face からダウンロードされる（~/.cache/huggingface）
- 英語の読みは misaki（辞書）で作り、辞書に無い語は espeak-ng で補う。中国語の読みは misaki[zh]（jieba・pypinyin）。中の英語は英語の読みで補う
- 声の大きさは台詞ごとにそろえる（話している所の RMS を -20 dBFS、ピークは -1 dBFS まで）。最後のラウドネスは mix.py が決める
- 音声を先に、読みを後に、一時の名前から置き換えて書く（synth.ts は両方そろったものだけを使う。同時に流しても壊れない）

終了コード: 0 できた・1 失敗・2 使い方の誤り
"""

from __future__ import annotations

import sys
from collections import defaultdict
from pathlib import Path

sys.dont_write_bytecode = True  # scripts/audio/ に __pycache__ を作らない

from audio.common import FAILED, USAGE, atomic_path, db_to_linear, linear_to_db, stop, wants_help, write_atomic
from audio.handoff import HandoffError, read_kokoro_jobs

if __name__ == "__main__" and wants_help(sys.argv):  # 依存（numpy など）を読む前に、使い方だけを出す
    print(__doc__)
    raise SystemExit(0)

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

SR_IN = 24000
SR_OUT = 48000
PRE = 0.08  # VOICEVOX の prePhonemeLength と同じ
POST = 0.12  # VOICEVOX の postPhonemeLength と同じ
TARGET_RMS_DB = -20.0
PEAK_DB = -1.0


def trim(x: np.ndarray, sr: int) -> np.ndarray:
    """前後の無音を切る（ピークから -45 dB 未満を無音とみなす。声の頭と尻を削らないよう 20ms 残す）"""
    if not len(x):
        return x
    thr = np.max(np.abs(x)) * db_to_linear(-45)
    idx = np.where(np.abs(x) > thr)[0]
    if not len(idx):
        return x
    pad = int(0.02 * sr)
    return x[max(0, idx[0] - pad) : min(len(x), idx[-1] + pad)]


def level(x: np.ndarray, sr: int) -> np.ndarray:
    """話している所（20ms ごとの RMS がピークの -40 dB 以上）の RMS を -20 dBFS にそろえる"""
    frame = int(0.02 * sr)
    n = len(x) // frame
    if n == 0:
        return x
    rms = np.sqrt(np.mean(x[: n * frame].reshape(n, frame) ** 2, axis=1))
    active = rms[rms > np.max(rms) * db_to_linear(-40)]
    if not len(active):
        return x
    cur = linear_to_db(np.sqrt(np.mean(active**2)) + 1e-12)
    y = x * db_to_linear(TARGET_RMS_DB - cur)
    peak = np.max(np.abs(y))
    limit = db_to_linear(PEAK_DB)
    return y * (limit / peak) if peak > limit else y


def main() -> None:
    if len(sys.argv) != 3 or any(a.startswith("-") for a in sys.argv[1:]):
        stop(
            USAGE,
            "使い方: uv run --locked --script scripts/tts_kokoro.py <jobs.json> <出力フォルダ>（synth.ts が流す。--help で説明）",
        )
    try:
        jobs = read_kokoro_jobs(Path(sys.argv[1]))
    except HandoffError as e:
        stop(FAILED, f"Kokoro の仕事のファイルの形が違う: {e}")
    out_dir = Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)

    import torch
    from kokoro import KModel, KPipeline

    torch.manual_seed(0)
    by_repo: dict[str, list[dict]] = defaultdict(list)
    for j in jobs:
        by_repo[j["repo"]].append(j)

    done = 0
    for repo, items in by_repo.items():
        model = KModel(repo_id=repo).eval()
        pipes: dict[str, KPipeline] = {}

        def pipe(g2p: str) -> KPipeline:
            if g2p not in pipes:
                if g2p == "z":
                    # 中国語の文の中の英語（Super-agent など）は、英語の読みで補う
                    en = KPipeline(lang_code="a", repo_id=repo, model=False)
                    pipes[g2p] = KPipeline(
                        lang_code="z", repo_id=repo, model=model, en_callable=lambda t: next(en(t)).phonemes
                    )
                else:
                    pipes[g2p] = KPipeline(lang_code=g2p, repo_id=repo, model=model)
            return pipes[g2p]

        for j in items:
            results = list(pipe(j["g2p"])(j["text"], voice=j["voice"], speed=j["speed"]))
            if not results:
                raise SystemExit(f"音にならなかった: {j['text']}")
            parts = []
            for i, r in enumerate(results):
                parts.append(r.audio.numpy())
                if i < len(results) - 1:
                    parts.append(np.zeros(int(0.18 * SR_IN), dtype=np.float32))
            audio = trim(np.concatenate(parts).astype(np.float64), SR_IN)
            audio = np.concatenate([np.zeros(int(PRE * SR_IN)), audio, np.zeros(int(POST * SR_IN))])
            audio = level(resample_poly(audio, SR_OUT // SR_IN, 1), SR_OUT)
            # 音声を先に、読みを後に、一時の名前から置き換える（読みがあれば、音声も書き終えている。synth.ts は両方そろったものだけを使う）
            with atomic_path(out_dir / f"{j['key']}.wav") as tmp:
                sf.write(tmp, np.clip(audio, -1, 1), SR_OUT, subtype="PCM_16", format="WAV")
            write_atomic(out_dir / f"{j['key']}.kana", " ".join(r.phonemes for r in results))
            done += 1
            if done % 20 == 0 or done == len(jobs):
                print(f"Kokoro: {done}/{len(jobs)}", flush=True)


if __name__ == "__main__":
    main()
