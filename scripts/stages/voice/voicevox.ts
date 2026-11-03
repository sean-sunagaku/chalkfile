// 日本語の台詞を VOICEVOX のエンジン（HTTP）で読み上げる。audio_query で読みと話し方の設計を作り、声の設定を入れて synthesis で WAV にする
import { MissingError } from '../../lib/args';

/** 声の設定（content/voices.ts の VOICES の 1 つ） */
export type VoicevoxVoice = { speaker: number; speed: number; intonation: number; pitch: number };

/** VOICEVOX のエンジン。url は VOICEVOX_URL（既定 http://127.0.0.1:50021） */
export type Voicevox = { url: string };

/** audio_query の読み（アクセント句のモーラをつなぎ、句の切れ目に「、」） */
type AccentPhrase = { moras: { text: string }[]; pause_mora?: { text: string } | null };
export const kanaOf = (phrases: AccentPhrase[]): string =>
  phrases.map((ap) => ap.moras.map((m) => m.text).join('') + (ap.pause_mora ? '、' : '')).join('');

/** 1 つの台詞を読み上げ、WAV（48kHz・モノラル）と読み（カナ）を返す */
export const synthesize = async (
  engine: Voicevox,
  text: string,
  v: VoicevoxVoice,
): Promise<{ wav: Buffer; kana: string }> => {
  const q = await fetch(`${engine.url}/audio_query?speaker=${v.speaker}&text=${encodeURIComponent(text)}`, {
    method: 'POST',
  }).catch((e) => {
    throw new MissingError(
      `VOICEVOX（${engine.url}）に届かない。台詞を変えていないなら、先に素材を取り出す（bun scripts/materials.ts pull）: ${text}`,
      { cause: e },
    );
  });
  if (!q.ok) throw new Error(`audio_query ${q.status}: ${text}`);
  const query = await q.json();
  query.speedScale = v.speed;
  query.intonationScale = v.intonation;
  query.pitchScale = v.pitch;
  query.volumeScale = 1.0;
  query.prePhonemeLength = 0.08;
  query.postPhonemeLength = 0.12;
  query.outputSamplingRate = 48000;
  query.outputStereo = false;
  const kana = kanaOf(query.accent_phrases);
  const s = await fetch(`${engine.url}/synthesis?speaker=${v.speaker}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query),
  });
  if (!s.ok) throw new Error(`synthesis ${s.status}: ${text}`);
  return { wav: Buffer.from(await s.arrayBuffer()), kana };
};
