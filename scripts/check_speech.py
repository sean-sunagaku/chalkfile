# /// script
# requires-python = ">=3.12,<3.13"
# dependencies = [
#   "faster-whisper==1.2.1",
#   "numpy==2.5.4",
#   "scipy==1.18.1",
#   "opencc-python-reimplemented==0.1.7",
#   "pypinyin==0.55.0",
#   "cn2an==0.5.23",
# ]
# ///
"""訳の動画（英語・中国語）の台詞を Whisper で聞き取り直して、読み上げの間違いを探す（日本語の .work/kana/ を読む代わり）。

synth.ts が書く .work/speech/<key>.json（台詞と音声ファイルの対応）を読む。

  uv run --locked --script scripts/check_speech.py P01.en P01.zh       # 動画ごと
  uv run --locked --script scripts/check_speech.py --all                # .work/speech/ の全部

依存の版は頭書きと scripts/check_speech.py.lock で固定する。頭書きを変えたら uv lock --script scripts/check_speech.py でロックも作り直す。

出力: 誤りの多い台詞から順に、読ませた文と聞き取った文を並べる（.work/speech/<key>.report.txt にも書く）。
英語は文字の誤り率（空白と記号を除き、数字は英単語にそろえる）、中国語は拼音（声調なし）の音節の誤り率（繁体字は簡体字に、数字は漢数字にそろえ、中の英語の語は比べない）。
誤り率が 0.2 を超える台詞は「要確認」。固有名詞（pstack・poteto など）や同じ音の別の字（不／布）でも上がるので、人が読んで判断する。
中国語は、多音字（行・重・长・还・得 など）を pypinyin がどう読むかの一覧も出す（Kokoro の読みも pypinyin で決まる）。
違う読みは content/reading.ts の ZH_PHRASES に足す。
直し方: 台詞に s（読み上げ用の文）を書いて、bun scripts/synth.ts <key> で作り直す。
Whisper のモデル（medium、MIT）は初めて使うときに Hugging Face からダウンロードされる。
聞き取りの記録（.work/speech/heard.json）と報告は、一時の名前に書いてから置き換える（途中で止めても壊れない）。
終了コード: 0 できた・1 失敗・2 使い方の誤り
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
import wave
from pathlib import Path

sys.dont_write_bytecode = True  # scripts/audio/ に __pycache__ を作らない

from audio.common import USAGE, stop, voice_file, wants_help, write_atomic

if __name__ == "__main__" and wants_help(sys.argv):  # 依存（numpy・Whisper）を読む前に、使い方だけを出す
    print(__doc__)
    raise SystemExit(0)

import numpy as np
from scipy.signal import resample_poly

ROOT = Path(__file__).resolve().parent.parent
SPEECH = ROOT / ".work" / "speech"
LIMIT = 0.2
# 中国語の多音字（読みを確かめる字）
POLY = set("行重长还得地着为都数处差发调量应角种便只和乐空藏传当好教省相正背难几假降曲给结尽卷看落露模宁朝强塞散少盛似")
ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()


def words(n: int) -> str:
    """0〜999999 の数を英単語にする（聞き取りの 23 と台本の twenty-three をそろえる）"""
    if n < 20:
        return ONES[n]
    if n < 100:
        return TENS[n // 10] + ("" if n % 10 == 0 else " " + ONES[n % 10])
    if n < 1000:
        return ONES[n // 100] + " hundred" + ("" if n % 100 == 0 else " " + words(n % 100))
    return words(n // 1000) + " thousand" + ("" if n % 1000 == 0 else " " + words(n % 1000))


def read16k(path: Path) -> np.ndarray:
    with wave.open(str(path), "rb") as w:
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
        rate = w.getframerate()
    return resample_poly(x, 1, rate // 16000).astype(np.float32) if rate % 16000 == 0 else x


def norm_en(s: str) -> list[str]:
    s = unicodedata.normalize("NFKC", s).lower().replace("’", "'").replace(",", "")
    # 聞き取りは 100% と書くので、台本の a hundred percent とそろえる
    s = re.sub(r"(\d+) ?%", r"\1 percent", s)
    s = re.sub(r"\d+", lambda m: " " + words(int(m.group())) + " " if int(m.group()) < 1000000 else m.group(), s)
    return list(re.sub(r"[^a-z0-9]+", "", s))


def dist(a: list, b: list) -> int:
    d = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(b) + 1):
            cur = min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] != b[j - 1]))
            prev, d[j] = d[j], cur
    return d[len(b)]


def main() -> None:
    keys = sys.argv[1:]
    if keys == ["--all"]:
        keys = sorted(p.stem for p in SPEECH.glob("*.json"))
    elif not keys or any(k.startswith("-") for k in keys):
        stop(USAGE, "使い方: uv run --locked --script scripts/check_speech.py P01.en P01.zh | --all（--help で説明）")
    if not keys:
        stop(USAGE, "聞き取る動画が無い（.work/speech/ が空。先に訳の動画で npm run synth -- <key>）")

    from faster_whisper import WhisperModel
    from opencc import OpenCC
    from cn2an import an2cn
    from pypinyin import Style, lazy_pinyin, pinyin

    t2s = OpenCC("t2s")
    asr = WhisperModel("medium", device="cpu", compute_type="int8")
    # 聞き取りの結果は音声ファイルごとに覚えておく（名前は文と声から決まるので、台詞を直した所だけ聞き直す）
    cache_file = SPEECH / "heard.json"
    heard: dict[str, str] = json.loads(cache_file.read_text()) if cache_file.exists() else {}
    worst_all = 0
    for key in keys:
        data = json.loads((SPEECH / f"{key}.json").read_text())
        lang = data["lang"]
        rows = []
        for ln in data["lines"]:
            if ln["file"] not in heard:
                # 音声は、共有のキャッシュ → .work/tts の順に探す（記録の鍵は、場所に縛られない名前のまま）
                segs, _ = asr.transcribe(read16k(voice_file(ROOT, ln["file"])), language=lang, beam_size=1, condition_on_previous_text=False)
                heard[ln["file"]] = "".join(s.text for s in segs).strip()
                # 一時の名前に書いてから置き換える（途中で止めても、聞き取りの記録が壊れない）
                write_atomic(cache_file, json.dumps(heard, ensure_ascii=False))
            hyp = heard[ln["file"]]
            if lang == "zh":
                # 中国語の中の英語の語（pstack・poteto mode など）は、中国語の聞き取りでは崩れるので比べない（読みは .work/kana/ の音素で見る）。
                # 漢数字と算用数字（三十七・37）、同じ音の別の字（长尾・常委）は同じに数えるよう、数を漢数字にそろえてから拼音（声調なし）で比べる。
                # 多音字の直しで s に同じ音の別の字（本地 → 本帝）を書くので、画面の文（t）と比べる
                def han(x: str) -> list[str]:
                    x = unicodedata.normalize("NFKC", x)
                    # 聞き取りは 100% と書くので、台本の 百分之百 とそろえる
                    x = re.sub(r"(\d+) ?%", lambda m: "百分之" + an2cn(m.group(1)), x)
                    x = re.sub(r"\d+", lambda m: an2cn(m.group()), x)
                    x = re.sub(r"[\W_A-Za-z0-9]+", "", x)
                    return lazy_pinyin(x)
                ref, got = han(ln["t"]), han(t2s.convert(hyp))
            else:
                ref, got = norm_en(ln["speech"]), norm_en(hyp)
            err = dist(ref, got) / max(1, len(ref))
            rows.append((err, ln, hyp))
        rows.sort(key=lambda r: -r[0])
        bad = [r for r in rows if r[0] > LIMIT]
        worst_all += len(bad)
        out = [f"{key}: {len(rows)} 台詞・要確認 {len(bad)}（{'文字' if lang != 'zh' else '拼音の音節'}の誤り率 > {LIMIT}）"]
        for err, ln, hyp in rows[: max(12, len(bad))]:
            mark = "要確認" if err > LIMIT else "      "
            out.append(f"{mark} {err:.2f} {ln['at']} [{ln['voice']}] {ln['speech']}\n          聞き取り: {hyp}")
        if lang == "zh":
            # 多音字の読み（前後 2 字と一緒に）。同じ読みはまとめる
            seen: dict[str, str] = {}
            for ln in data["lines"]:
                text = ln["speech"]
                py = pinyin(text, style=Style.TONE3, errors=lambda x: list(x))
                if len(py) != len(text):
                    continue
                for i, ch in enumerate(text):
                    if ch in POLY:
                        seen.setdefault(f"{text[max(0, i - 2): i + 3]}", f"{ch}={py[i][0]}")
            out.append("多音字の読み（違っていたら content/reading.ts の ZH_PHRASES へ）:")
            out.extend(f"  {ctx}  {r}" for ctx, r in seen.items())
        text = "\n".join(out)
        print(text, flush=True)
        write_atomic(SPEECH / f"{key}.report.txt", text + "\n")
    print(f"要確認 {worst_all} 台詞" if worst_all else "全部の台詞が聞き取れた（誤り率 0.25 以下）")


if __name__ == "__main__":
    main()
