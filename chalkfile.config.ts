// このプロジェクトの設定の正本。値を変えたら npm run gen を流す。
// エンジンには、gen が書き出す純粋なデータだけを渡す。ブラウザ・Worker・素材の旧版の読み込みも Node に依存しない。
import type { ThemeId } from './content/themes';
import type { KokoroVoice, VoicevoxVoice } from './engine/core/project-config';
import type { VoiceId } from './engine/core/schema';

export const DEFAULT_THEME = 'chalkfile' satisfies ThemeId;
export const LANG_INFO = {
  ja: { label: '日本語', html: 'ja', path: '' },
  en: { label: 'English', html: 'en', path: 'en/' },
  zh: { label: '中文', html: 'zh-Hans', path: 'zh/' },
} as const;
export const VOICES = {
  // No.7（ノーマル）: 講師。Whisper での聞き取りが候補の中で一番正確だった
  narrator: { speaker: 29, speed: 1.06, intonation: 1.12, pitch: 0, credit: 'VOICEVOX:No.7' },
  // 青山龍星（ノーマル）: レクチャー名の呼び込み
  announcer: { speaker: 13, speed: 1.0, intonation: 1.25, pitch: 0, credit: 'VOICEVOX:青山龍星' },
  // ここから、お笑い版の掛け合いの声
  // ずんだもん（ノーマル）: ボケ
  zundamon: { speaker: 3, speed: 1.08, intonation: 1.2, pitch: 0, credit: 'VOICEVOX:ずんだもん' },
  // ずんだもん（なみだめ）: ボケがへこんだとき
  'zundamon-cry': { speaker: 76, speed: 1.0, intonation: 1.1, pitch: 0, credit: 'VOICEVOX:ずんだもん' },
  // No.7（ノーマル）を少し速く、抑揚を強く: 講師の声で短く刺すツッコミ
  tsukkomi: { speaker: 29, speed: 1.14, intonation: 1.3, pitch: 0, credit: 'VOICEVOX:No.7' },
  // 玄野武宏（ノーマル）: 天の声（淡々と、真実や先のことをばらすナレーション）。青山龍星（しっとり）は聞きにくかった
  tennokoe: { speaker: 11, speed: 1.02, intonation: 1.1, pitch: 0, credit: 'VOICEVOX:玄野武宏' },
} satisfies Record<VoiceId, VoicevoxVoice>;
export const KOKORO = {
  en: {
    // 先生: af_heart（候補で一番自然。ツッコミは少し速く）
    narrator: { engine: 'kokoro', repo: 'hexgrad/Kokoro-82M', voice: 'af_heart', g2p: 'a', speed: 1.0 },
    tsukkomi: { engine: 'kokoro', repo: 'hexgrad/Kokoro-82M', voice: 'af_heart', g2p: 'a', speed: 1.1 },
    // ずんだもん: af_bella（高くて明るい声。先生と聞き分けられる）
    zundamon: { engine: 'kokoro', repo: 'hexgrad/Kokoro-82M', voice: 'af_bella', g2p: 'a', speed: 1.08 },
    'zundamon-cry': { engine: 'kokoro', repo: 'hexgrad/Kokoro-82M', voice: 'af_bella', g2p: 'a', speed: 0.9 },
    // 天の声: bm_george（落ち着いたイギリス英語の男性。淡々とばらす）
    tennokoe: { engine: 'kokoro', repo: 'hexgrad/Kokoro-82M', voice: 'bm_george', g2p: 'b', speed: 0.98 },
    // 呼び込み: am_fenrir（低めの男性）
    announcer: { engine: 'kokoro', repo: 'hexgrad/Kokoro-82M', voice: 'am_fenrir', g2p: 'a', speed: 1.0 },
  },
  zh: {
    // 先生: zf_019（落ち着いた女性。句読点の間がはっきりしていた）
    narrator: { engine: 'kokoro', repo: 'hexgrad/Kokoro-82M-v1.1-zh', voice: 'zf_019', g2p: 'z', speed: 1.0 },
    tsukkomi: { engine: 'kokoro', repo: 'hexgrad/Kokoro-82M-v1.1-zh', voice: 'zf_019', g2p: 'z', speed: 1.1 },
    // 俊达萌（ずんだもん）: zf_092（高くて明るい声）
    zundamon: { engine: 'kokoro', repo: 'hexgrad/Kokoro-82M-v1.1-zh', voice: 'zf_092', g2p: 'z', speed: 1.05 },
    'zundamon-cry': { engine: 'kokoro', repo: 'hexgrad/Kokoro-82M-v1.1-zh', voice: 'zf_092', g2p: 'z', speed: 0.9 },
    // 旁白（天の声）: zm_031（落ち着いた男性。淡々とばらす）
    tennokoe: { engine: 'kokoro', repo: 'hexgrad/Kokoro-82M-v1.1-zh', voice: 'zm_031', g2p: 'z', speed: 0.98 },
    // 呼び込み: zm_029（候補で一番低い男性）
    announcer: { engine: 'kokoro', repo: 'hexgrad/Kokoro-82M-v1.1-zh', voice: 'zm_029', g2p: 'z', speed: 1.0 },
  },
} satisfies Record<Exclude<keyof typeof LANG_INFO, 'ja'>, Record<VoiceId, KokoroVoice>>;
export const RENDER = {
  /** Remotion の並列の数（既定）。この機械の CPU の数のほうが少なければ、その数にする（Remotion は CPU の数より多い数を受け取らない） */
  concurrency: 8,
  /** 音なしの高画質の映像（out/master/<key>.mp4）。サイト用・配る用の動画とポスターは、ここから作る */
  master: { codec: 'h264', crf: 16, imageFormat: 'jpeg', jpegQuality: 92 },
  /**
   * サイト用の動画（site/media/<key>.mp4・字幕版の <key>.cc.mp4）。大きさの目安（site/limits.ts の VIDEO_TARGET_BYTES）以下になるまで、
   * crf を first から step ずつ上げ、max で止める（max でも超えたら、警告して使う）。longSec より長い動画は、小さい crf では目安に
   * 近づかないので long から試す（これまで 6 分より長い動画は crf 27 か 29 でしか目安に近づかなかった）
   */
  site: {
    crf: { first: 21, long: 27, step: 2, max: 29 },
    longSec: 360,
    preset: 'slow',
    maxrate: '2000k',
    bufsize: '4000k',
    gop: 150,
    audioBitrate: '128k',
  },
  /** 字幕を焼き込んだ配る用の動画（out/captioned/<key>.mp4。講座サイトの外で、音なしでも見られる版） */
  captioned: { crf: 20, preset: 'slow', gop: 150, audioBitrate: '160k' },
  /** サイト用と配る用の動画の音（ミックスの音を AAC にする） */
  audio: { codec: 'aac', sampleRate: 48000 },
  /** ポスター（動画の始まり近くの静止画。動画の表紙と一覧のカード）。撮る秒・幅・JPEG の品質（ffmpeg の -q:v。小さいほど高い） */
  poster: { atSec: 4.2, width: 1280, quality: 3 },
} as const;

/** このプロジェクトの設定の形。言語の名前は上の LANG_INFO から決まる。 */
export type ChalkfileConfig = {
  defaultTheme: ThemeId;
  voices: Record<VoiceId, VoicevoxVoice>;
  translatedVoices: Record<Exclude<keyof typeof LANG_INFO, 'ja'>, Record<VoiceId, KokoroVoice>>;
  languages: typeof LANG_INFO;
  render: typeof RENDER;
  series: string;
  seriesSub: string;
  origin: string;
  repository: string;
  publishLangs: (keyof typeof LANG_INFO)[];
};

const config: ChalkfileConfig = {
  defaultTheme: DEFAULT_THEME,
  voices: VOICES,
  translatedVoices: KOKORO,
  languages: LANG_INFO,
  render: RENDER,
  series: 'Chalkfile',
  seriesSub:
    '台本（コード）から、ナレーション付きの講座動画と講座サイトを作る。動画・台本・確認クイズをブラウザで見られます。',
  origin: 'https://chalkfile.com/',
  repository: 'sean-sunagaku/chalkfile',
  publishLangs: ['ja'],
};

export default config;
