// 声の設定の形。値の正本は chalkfile.config.ts、エンジンが読む値は project-settings.ts（npm run gen が作る）。
export type VoicevoxVoice = { speaker: number; speed: number; intonation: number; pitch: number; credit: string };
export type KokoroVoice = {
  engine: 'kokoro';
  repo: 'hexgrad/Kokoro-82M' | 'hexgrad/Kokoro-82M-v1.1-zh';
  voice: string;
  g2p: 'a' | 'b' | 'z';
  speed: number;
};
