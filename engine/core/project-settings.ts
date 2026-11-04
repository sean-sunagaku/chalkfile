// npm run gen が chalkfile.config.ts から作る。手で直さない。
export const DEFAULT_THEME = "chalkfile" as const;
export const THEME_IDS = [
  "chalkfile",
  "indigo",
  "night",
  "paper",
  "stage"
] as const;
export const VOICES = {
  "narrator": {
    "speaker": 29,
    "speed": 1.06,
    "intonation": 1.12,
    "pitch": 0,
    "credit": "VOICEVOX:No.7"
  },
  "announcer": {
    "speaker": 13,
    "speed": 1,
    "intonation": 1.25,
    "pitch": 0,
    "credit": "VOICEVOX:青山龍星"
  },
  "zundamon": {
    "speaker": 3,
    "speed": 1.08,
    "intonation": 1.2,
    "pitch": 0,
    "credit": "VOICEVOX:ずんだもん"
  },
  "zundamon-cry": {
    "speaker": 76,
    "speed": 1,
    "intonation": 1.1,
    "pitch": 0,
    "credit": "VOICEVOX:ずんだもん"
  },
  "tsukkomi": {
    "speaker": 29,
    "speed": 1.14,
    "intonation": 1.3,
    "pitch": 0,
    "credit": "VOICEVOX:No.7"
  },
  "tennokoe": {
    "speaker": 11,
    "speed": 1.02,
    "intonation": 1.1,
    "pitch": 0,
    "credit": "VOICEVOX:玄野武宏"
  }
} as const;
export const KOKORO = {
  "en": {
    "narrator": {
      "engine": "kokoro",
      "repo": "hexgrad/Kokoro-82M",
      "voice": "af_heart",
      "g2p": "a",
      "speed": 1
    },
    "tsukkomi": {
      "engine": "kokoro",
      "repo": "hexgrad/Kokoro-82M",
      "voice": "af_heart",
      "g2p": "a",
      "speed": 1.1
    },
    "zundamon": {
      "engine": "kokoro",
      "repo": "hexgrad/Kokoro-82M",
      "voice": "af_bella",
      "g2p": "a",
      "speed": 1.08
    },
    "zundamon-cry": {
      "engine": "kokoro",
      "repo": "hexgrad/Kokoro-82M",
      "voice": "af_bella",
      "g2p": "a",
      "speed": 0.9
    },
    "tennokoe": {
      "engine": "kokoro",
      "repo": "hexgrad/Kokoro-82M",
      "voice": "bm_george",
      "g2p": "b",
      "speed": 0.98
    },
    "announcer": {
      "engine": "kokoro",
      "repo": "hexgrad/Kokoro-82M",
      "voice": "am_fenrir",
      "g2p": "a",
      "speed": 1
    }
  },
  "zh": {
    "narrator": {
      "engine": "kokoro",
      "repo": "hexgrad/Kokoro-82M-v1.1-zh",
      "voice": "zf_019",
      "g2p": "z",
      "speed": 1
    },
    "tsukkomi": {
      "engine": "kokoro",
      "repo": "hexgrad/Kokoro-82M-v1.1-zh",
      "voice": "zf_019",
      "g2p": "z",
      "speed": 1.1
    },
    "zundamon": {
      "engine": "kokoro",
      "repo": "hexgrad/Kokoro-82M-v1.1-zh",
      "voice": "zf_092",
      "g2p": "z",
      "speed": 1.05
    },
    "zundamon-cry": {
      "engine": "kokoro",
      "repo": "hexgrad/Kokoro-82M-v1.1-zh",
      "voice": "zf_092",
      "g2p": "z",
      "speed": 0.9
    },
    "tennokoe": {
      "engine": "kokoro",
      "repo": "hexgrad/Kokoro-82M-v1.1-zh",
      "voice": "zm_031",
      "g2p": "z",
      "speed": 0.98
    },
    "announcer": {
      "engine": "kokoro",
      "repo": "hexgrad/Kokoro-82M-v1.1-zh",
      "voice": "zm_029",
      "g2p": "z",
      "speed": 1
    }
  }
} as const;
export const ORIGIN = "https://chalkfile.com/" as const;
