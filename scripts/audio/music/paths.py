"""置き場所。書き出し先の public/audio/ は gitignore 済み（作った WAV は素材として materials ブランチに置く）。"""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]  # scripts/audio/music/paths.py から見たリポジトリの直下
AUDIO_DIR = ROOT / "public" / "audio"
MUSIC_DIR = AUDIO_DIR / "music"
SFX_DIR = AUDIO_DIR / "sfx"
PREVIEW_DIR = MUSIC_DIR / "preview"
