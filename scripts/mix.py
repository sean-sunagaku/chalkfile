"""レクチャーごとの音（ナレーション・BGM・ジングル・効果音）を 1 本の WAV にまとめる。

synth.ts が書いた .work/plan/<id>.json（台詞の開始時刻と効果音）を読み、台詞の音声は作業フォルダの間で共有のキャッシュ
（CHALKFILE_CACHE_DIR。既定 ~/.cache/chalkfile/tts/）から、無ければ .work/tts/ から読んで、
public/audio/mix/<id>.wav（48kHz・ステレオ・16bit、-16 LUFS / true peak -1.5 dB）を作る。
効果音の名前と音量は scripts/audio/sfx.json（npm run gen が content/sfx.ts から作る）から読む。

- ナレーションは -17 LUFS にそろえる
- BGM（bed.wav、-18 LUFS のループ）は、話している間は -17 dB、話していない間は -7 dB（自動で下げる）
- 冒頭は sting_intro（「ドン」の秒は src/video.config.ts の STING。今は 2.0 秒）、最後は sting_outro
- 効果音: 台詞の sfx（台詞の頭）と sfxAfter（台詞の後の間）、場面の切り替わりの whoosh、クイズの考える時間の tick
- 台詞の bgm: cut で BGM を止め、back（なければ場面の終わり）で戻す（急にシリアスにする）

  uv run --locked --group audio python scripts/mix.py L01 S01.en   # 渡した動画（npm run mix -- L01 S01.en でも同じ）
  npm run mix                                                      # 公開する言語（site/config.json の publishLangs）の全部の動画
  npm run chalk -- mix --course <講座 ID>                           # 講座・形・言語で選ぶ（docs/guide/commands.md の「chalk」）

ミックスする動画は、呼ぶ側が渡す（npm run mix は npm run chalk -- mix と同じ入口で、選んだ動画をここに渡す）。
.work/plan にあるものを全部、とはしない（消した動画や、ほかの branch の動画の古い設計図をミックスしない）。
設計図と効果音の一覧は、読むときに形を確かめる（scripts/audio/handoff.py。形の正本は scripts/lib/handoff.ts）。
ミックスを始める前に、渡した全部の動画の設計図と、要る声・BGM・ジングル・効果音がそろっているかを見る（足りなければ何も作らない）。
ffmpeg が失敗したら、何をしていたかと ffmpeg の出力の終わりを出して止まる。
numpy の版は pyproject.toml と uv.lock で固定している。ffmpeg は PATH から使う。
仕上げの音は一時の名前に書いてから置き換える（書き出しが書きかけの音を読まない）。
終了コード: 0 できた・1 失敗（ffmpeg・形の違う設計図）・2 使い方の誤り（動画を渡していない・知らない引数）・
  3 前提が足りない（設計図が無い＝先に synth。声・BGM・効果音が無い＝先に materials:pull。ffmpeg が無い）
"""

from __future__ import annotations

import json
import re
import sys
import tempfile
import wave
from pathlib import Path

sys.dont_write_bytecode = True  # scripts/audio/ に __pycache__ を作らない

from audio.common import (
    FAILED,
    MISSING,
    atomic_path,
    db_to_linear,
    run_ffmpeg,
    stop,
    tail,
    video_keys,
    voice_file,
    wants_help,
)
from audio.handoff import HandoffError, read_plan, read_sfx

NO_TARGET = "ミックスする動画を渡す（例: uv run --locked --group audio python scripts/mix.py L01 S01.en。公開する言語の全部は npm run mix）"
if __name__ == "__main__":
    if wants_help(sys.argv):  # 依存（numpy）を読む前に、使い方だけを出す
        print(__doc__)
        raise SystemExit(0)
    video_keys(sys.argv[1:], NO_TARGET)  # 依存を読む前に、引数を確かめる（使い方の誤りは 2）

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
RATE = 48000
PLAN_DIR = ROOT / ".work" / "plan"
MUSIC = ROOT / "public" / "audio" / "music"
SFX_DIR = ROOT / "public" / "audio" / "sfx"
OUT_DIR = ROOT / "public" / "audio" / "mix"
# 動画と合わせる値（src/video.config.ts から npm run gen:video-config で書き出したもの）
VIDEO = json.loads((ROOT / "scripts" / "audio" / "video_config.json").read_text())
STING_HIT = float(VIDEO["stingIntroHitSec"])  # ジングルの「ドン」の秒（呼び込みの声はこの 0.05 秒あと。synth.ts）

VOICE_LUFS = -17.0
BED_SPEECH_DB = -17.0
BED_FREE_DB = -7.0
BED_START = 4.4  # ジングルの余韻に重ねて BGM を入れる
STING_DB = -1.5
# 効果音の音量（dB）は content/sfx.ts の一覧（scripts/audio/sfx.json）。ここで鳴らす名前（台本に書かないもの）
SCENE_SFX = "whoosh"  # 場面の切り替わり
QUIZ_SFX = "tick"  # クイズの考える時間
MUSIC_FILES = ("bed.wav", "sting_intro.wav", "sting_outro.wav")
BGM_CUT_FADE = 0.12  # BGM を止めるときの短いフェード（秒）
BGM_BACK_FADE = 0.8  # 戻すときのフェード（秒）
FINAL_LUFS = -16.0
FINAL_TP = -1.5


def read_wav(path: Path) -> np.ndarray:
    """float32 の (n, ch) で返す。48kHz・16bit 前提"""
    with wave.open(str(path), "rb") as w:
        if w.getframerate() != RATE or w.getsampwidth() != 2:
            stop(
                FAILED,
                f"{path}: {w.getframerate()} Hz / {w.getsampwidth() * 8} bit は読めない（48000 Hz / 16 bit にする）",
            )
        ch = w.getnchannels()
        data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
    return data.reshape(-1, ch)


def write_wav(path: Path, x: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm = (np.clip(x, -1.0, 1.0) * 32767.0).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(x.shape[1])
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(pcm.tobytes())


def lufs(x: np.ndarray) -> float:
    """ffmpeg の ebur128 で積分ラウドネスを測る"""
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "m.wav"
        write_wav(p, x)
        r = run_ffmpeg(
            ["-hide_banner", "-nostats", "-i", str(p), "-af", "ebur128=framelog=quiet", "-f", "null", "-"],
            what="音の大きさを ebur128 で測る",
        )
    m = re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)
    if not m:
        stop(FAILED, f"音の大きさ（ffmpeg の ebur128）の結果が読めない。出力の終わり:\n{tail(r.stderr)}")
    return float(m[-1])


def place(bus: np.ndarray, clip: np.ndarray, at: float, gain: float = 1.0) -> None:
    i = int(round(at * RATE))
    if i >= len(bus):
        return
    if i < 0:
        clip = clip[-i:]
        i = 0
    n = min(len(clip), len(bus) - i)
    if clip.shape[1] == 1 and bus.shape[1] == 2:
        bus[i : i + n] += clip[:n] * gain
    else:
        bus[i : i + n] += clip[:n, : bus.shape[1]] * gain


def speech_gain(n: int, intervals: list[tuple[float, float]]) -> np.ndarray:
    """話している区間（短い間はつなぐ）で BGM を下げる、なめらかなゲイン曲線"""
    ctl = 200  # 制御レート（Hz）
    m = np.zeros(int(n / RATE * ctl) + 2)
    merged: list[list[float]] = []
    for s, e in sorted(intervals):
        if merged and s - merged[-1][1] < 0.9:
            merged[-1][1] = max(merged[-1][1], e)
        else:
            merged.append([s, e])
    for s, e in merged:
        m[max(0, int((s - 0.12) * ctl)) : int((e + 0.35) * ctl)] = 1.0
    # 0.25 秒の窓でならす
    k = np.hanning(int(0.25 * ctl) * 2 + 1)
    m = np.convolve(m, k / k.sum(), mode="same")
    g_db = BED_FREE_DB + (BED_SPEECH_DB - BED_FREE_DB) * np.clip(m, 0, 1)
    t_ctl = np.arange(len(m)) / ctl
    t = np.arange(n) / RATE
    return db_to_linear(np.interp(t, t_ctl, g_db)).astype(np.float32)


def bgm_cuts(n: int, scenes: list[dict]) -> np.ndarray:
    """台詞の bgm: cut から、同じ場面の bgm: back（なければ場面の終わり）まで BGM を止めるゲイン"""
    g = np.ones(n, dtype=np.float32)
    for scene in scenes:
        lines = scene["lines"]
        for i, line in enumerate(lines):
            if line.get("bgm") != "cut":
                continue
            back = next((ln for ln in lines[i + 1 :] if ln.get("bgm") == "back"), None)
            a = int(round((line["start"] - 0.1) * RATE))
            b = int(round(((back["start"] - 0.25) if back else scene["end"]) * RATE))
            if b <= a:
                continue
            g *= fade(n, a, a + int(BGM_CUT_FADE * RATE), rising=False) + fade(
                n, b, b + int(BGM_BACK_FADE * RATE), rising=True
            )
    return np.clip(g, 0.0, 1.0)


def fade(n: int, a: int, b: int, rising: bool) -> np.ndarray:
    env = np.ones(n, dtype=np.float32)
    a, b = max(0, a), min(n, b)
    if b > a:
        ramp = np.linspace(0, 1, b - a, dtype=np.float32)
        ramp = 0.5 - 0.5 * np.cos(np.pi * ramp)
        env[a:b] = ramp if rising else 1 - ramp
    if rising:
        env[:a] = 0
    else:
        env[b:] = 0
    return env


def loudnorm(src: Path, dst: Path) -> dict:
    """ffmpeg loudnorm（2 パス・linear）で仕上げる"""
    first = run_ffmpeg(
        [
            "-hide_banner",
            "-nostats",
            "-i",
            str(src),
            "-af",
            f"loudnorm=I={FINAL_LUFS}:TP={FINAL_TP}:LRA=11:print_format=json",
            "-f",
            "null",
            "-",
        ],
        what="仕上げの音の大きさを loudnorm で測る（1 回目）",
    )
    meas = loudnorm_result(first.stderr)
    af = (
        f"loudnorm=I={FINAL_LUFS}:TP={FINAL_TP}:LRA=11:linear=true:"
        f"measured_I={meas['input_i']}:measured_TP={meas['input_tp']}:measured_LRA={meas['input_lra']}:"
        f"measured_thresh={meas['input_thresh']}:offset={meas['target_offset']}"
    )
    run_ffmpeg(
        [
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(src),
            "-af",
            af,
            "-ar",
            str(RATE),
            "-c:a",
            "pcm_s16le",
            str(dst),
        ],
        what="loudnorm で仕上げる（2 回目）",
    )
    return meas


LOUDNORM_KEYS = ("input_i", "input_tp", "input_lra", "input_thresh", "target_offset")


def loudnorm_result(stderr: str) -> dict:
    """loudnorm（print_format=json）が stderr の最後に出す測った値。読めなければ、ffmpeg の出力の終わりを出して止める"""
    a, b = stderr.rfind("{"), stderr.rfind("}")
    try:
        meas = json.loads(stderr[a : b + 1]) if 0 <= a < b else None
    except json.JSONDecodeError:
        meas = None
    if not isinstance(meas, dict) or any(k not in meas for k in LOUDNORM_KEYS):
        stop(FAILED, f"仕上げの音の大きさ（ffmpeg の loudnorm）の結果が読めない。出力の終わり:\n{tail(stderr)}")
    return meas


def load_sfx() -> dict[str, float]:
    """効果音の名前 → 音量（dB）。ここで鳴らす名前（場面の切り替わり・クイズ）も一覧にあるか確かめる"""
    try:
        sfx_db = read_sfx()
    except FileNotFoundError:
        stop(MISSING, "効果音の一覧（scripts/audio/sfx.json）が無い。npm run gen で content/sfx.ts から作る")
    except HandoffError as e:
        stop(FAILED, f"{e}（npm run gen で content/sfx.ts から作り直す）")
    for name in (SCENE_SFX, QUIZ_SFX):
        if name not in sfx_db:
            stop(FAILED, f"効果音の一覧（content/sfx.ts）に {name} が無い（mix.py が鳴らす）")
    return sfx_db


def load_plan(lec_id: str, sfx_db: dict[str, float]) -> dict:
    """動画の設計図（形を確かめたもの）"""
    try:
        return read_plan(PLAN_DIR / f"{lec_id}.json", sfx_db)
    except FileNotFoundError:
        stop(MISSING, f"{lec_id}: 設計図（.work/plan/{lec_id}.json）が無い。先に npm run synth -- {lec_id}")
    except HandoffError as e:
        stop(FAILED, f"{e}（設計図を作り直す: npm run synth -- {lec_id}）")


def sfx_used(plan: dict) -> set[str]:
    """その動画で鳴らす効果音の名前"""
    names = {SCENE_SFX} if len(plan["scenes"]) > 1 else set()
    for scene in plan["scenes"]:
        if scene["kind"] == "quiz" and scene["lines"]:
            names.add(QUIZ_SFX)
        for line in scene["lines"]:
            names.update(line[k] for k in ("sfx", "sfxAfter") if line.get(k))
    return names


def lacking(plans: dict[str, dict]) -> list[str]:
    """ミックスに要るのに無いファイル（BGM・ジングル・効果音と、台詞の音声）"""
    files = [MUSIC / f for f in MUSIC_FILES] + [
        SFX_DIR / f"{n}.wav" for n in sorted(set().union(*map(sfx_used, plans.values())))
    ]
    out = [str(f.relative_to(ROOT)) for f in files if not f.exists()]
    for lec_id, plan in plans.items():
        for scene in plan["scenes"]:
            for line in scene["lines"]:
                if not voice_file(ROOT, line["file"]).exists():
                    out.append(f"{lec_id} の台詞の音声 {line['file']}")
    return out


def build(lec_id: str, plan: dict, sfx_db: dict[str, float]) -> None:
    dur = plan["duration"]
    n = int(np.ceil(dur * RATE))
    voice = np.zeros((n, 1), dtype=np.float32)
    fx = np.zeros((n, 2), dtype=np.float32)
    intervals: list[tuple[float, float]] = []
    sfx_cache: dict[str, np.ndarray] = {}

    def sfx(name: str, at: float) -> None:
        if name not in sfx_cache:
            sfx_cache[name] = read_wav(SFX_DIR / f"{name}.wav")
        place(fx, sfx_cache[name], at, db_to_linear(sfx_db[name]))

    for si, scene in enumerate(plan["scenes"]):
        if si > 0:
            sfx(SCENE_SFX, scene["start"] - 0.08)
        for li, line in enumerate(scene["lines"]):
            # synth.ts は場所に縛られない名前（.work/tts/<鍵>.wav）で書く。共有のキャッシュ → .work/tts の順に探す
            # （前の設計図の絶対パスもそのまま読める。あることは、始める前に lacking で確かめた）
            clip = read_wav(voice_file(ROOT, line["file"]))
            place(voice, clip, line["start"])
            intervals.append((line["start"], line["end"]))
            if line.get("sfx"):
                # 声の頭（1 モーラ目）を消さないよう、映像の動き出しに合わせて少し前に鳴らす
                sfx(line["sfx"], line["start"] - 0.2)
            if line.get("sfxAfter"):
                # 台詞の後の間に鳴らす（ボケの後の「チーン」、溜めのドラムロールなど）
                sfx(line["sfxAfter"], line["end"] + 0.08)
            # クイズ: 問題を読んだあとの考える時間に 3 回 tick
            if scene["kind"] == "quiz" and li == 0:
                for k in range(3):
                    sfx(QUIZ_SFX, line["end"] + 0.25 + k)

    # ナレーションを -17 LUFS に
    v_lufs = lufs(voice)
    voice *= db_to_linear(VOICE_LUFS - v_lufs)

    # BGM（ループ）
    bed = read_wav(MUSIC / "bed.wav")
    reps = int(np.ceil(n / len(bed))) + 1
    bed_long = np.tile(bed, (reps, 1))
    b0 = int(BED_START * RATE)
    bed_bus = np.zeros((n, 2), dtype=np.float32)
    bed_bus[b0:] = bed_long[: n - b0]
    ending = plan["scenes"][-1]
    last_end = ending["lines"][-1]["end"] if ending["lines"] else ending["start"]
    out_at = last_end + 0.35  # 締めのジングルの頭
    env = fade(n, b0, b0 + int(1.4 * RATE), rising=True) * fade(
        n, int((out_at - 1.2) * RATE), int((out_at + 0.4) * RATE), rising=False
    )
    bed_bus *= (env * speech_gain(n, intervals) * bgm_cuts(n, plan["scenes"]))[:, None]

    stings = np.zeros((n, 2), dtype=np.float32)
    # 「ドン」（STING_HIT 秒）のあとは呼び込みの声の下に回す
    intro = read_wav(MUSIC / "sting_intro.wav")
    t = np.arange(len(intro)) / RATE
    duck = np.interp(t, [0.0, STING_HIT + 0.1, STING_HIT + 0.45], [0.0, 0.0, -7.0])
    place(stings, intro * db_to_linear(duck)[:, None].astype(np.float32), 0.0, db_to_linear(STING_DB))
    place(stings, read_wav(MUSIC / "sting_outro.wav"), out_at, db_to_linear(STING_DB))

    mix = np.repeat(voice, 2, axis=1) + bed_bus + stings + fx
    # 頭と尻の 10ms をフェード
    k = int(0.01 * RATE)
    mix[:k] *= np.linspace(0, 1, k)[:, None]
    mix[-k:] *= np.linspace(1, 0, k)[:, None]
    peak = float(np.max(np.abs(mix)))
    if peak > 0.99:
        mix *= 0.99 / peak

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as d:
        raw = Path(d) / "raw.wav"
        write_wav(raw, mix)
        # 仕上げは一時の名前（ffmpeg が形を拡張子で決めるので .wav で終える）に書いてから置き換える。書き出し（npm run render）が書きかけの音を読まない
        with atomic_path(OUT_DIR / f"{lec_id}.wav", ".tmp.wav") as out:
            meas = loudnorm(raw, out)
    final = lufs(read_wav(OUT_DIR / f"{lec_id}.wav"))
    print(
        f"{lec_id}: {dur / 60:.2f} 分  ナレーション元 {v_lufs:.1f} LUFS → 仕上がり {final:.1f} LUFS"
        f"（入力 {meas['input_i']} / TP {meas['input_tp']}）"
    )


def main(argv: list[str]) -> None:
    keys = video_keys(argv, NO_TARGET)
    sfx_db = load_sfx()
    # 全部の動画の設計図を読み、要るファイルがそろっているかを先に見る（途中の動画で止まって、半端に作り直さない）
    plans = {k: load_plan(k, sfx_db) for k in keys}
    missing = lacking(plans)
    if missing:
        listed = "\n  ".join(missing[:10]) + (f"\n  ほか {len(missing) - 10} 個" if len(missing) > 10 else "")
        stop(
            MISSING,
            f"ミックスに要るファイルが {len(missing)} 個無い:\n  {listed}\n"
            "声・BGM・効果音は npm run materials:pull で取り出す（台詞を直したなら npm run synth -- <動画>。"
            "BGM・効果音は npm run build:music でも作れる）",
        )
    for k in keys:
        build(k, plans[k], sfx_db)


if __name__ == "__main__":
    main(sys.argv[1:])
