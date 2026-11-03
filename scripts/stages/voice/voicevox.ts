// 日本語の台詞を VOICEVOX のエンジン（HTTP）で読み上げる。audio_query で読みと話し方の設計を作り、声の設定を入れて synthesis で WAV にする。
// どの呼び出しにも時間切れを付ける。つながらない・時間切れ・5xx は、少し待って流し直す（attempts 回まで）。
// エンジンが止まったままでも、決まった時間（時間切れ × attempts と、間の待ち）で失敗する（待ち続けない）。
// エンジンの版（GET /version）は、最初に読み上げる前に 1 回だけ問い合わせる
import { MissingError, UsageError } from '../../lib/args';
import { trace } from '../../lib/proc';

/** 声の設定（content/voices.ts の VOICES の 1 つ） */
export type VoicevoxVoice = { speaker: number; speed: number; intonation: number; pitch: number };

export type VoicevoxOptions = {
  /** エンジンの URL（VOICEVOX_URL。既定 http://127.0.0.1:50021） */
  url: string;
  /** 1 回の呼び出しの時間切れ（ミリ秒） */
  timeoutMs?: number;
  /** 1 つの呼び出しを試す回数（1 回目を入れて） */
  attempts?: number;
  /** 流し直す前に待つ長さ（ミリ秒）。2 回目のあとは 2 倍、3 回目のあとは 4 倍 */
  backoffMs?: number;
  /** 流し直すことを知らせる（既定は標準エラー） */
  warn?: (line: string) => void;
};

/** 1 回の呼び出しの時間切れの既定（秒）。長い台詞の合成も、ふつうは数秒で返る。環境変数 VOICEVOX_TIMEOUT（秒）で変える */
export const VOICEVOX_TIMEOUT_SEC = 60;
const ATTEMPTS = 3;
const BACKOFF_MS = 1000;

export type Voicevox = {
  url: string;
  /** エンジンの版（例 0.25.0）。最初の 1 回だけ問い合わせる */
  version: () => Promise<string>;
  /** 1 つの台詞を読み上げ、WAV と読み（カナ）を返す */
  synthesize: (text: string, v: VoicevoxVoice) => Promise<{ wav: Buffer; kana: string }>;
};

/** audio_query の読み（アクセント句のモーラをつなぎ、句の切れ目に「、」） */
type AccentPhrase = { moras: { text: string }[]; pause_mora?: { text: string } | null };
export const kanaOf = (phrases: AccentPhrase[]): string =>
  phrases.map((ap) => ap.moras.map((m) => m.text).join('') + (ap.pause_mora ? '、' : '')).join('');

/** 環境変数 VOICEVOX_TIMEOUT（秒）を、ミリ秒にする。無ければ既定。正の数でなければ、使い方の誤り */
export const timeoutFromEnv = (env: NodeJS.ProcessEnv = process.env): number => {
  const raw = env.VOICEVOX_TIMEOUT;
  if (raw === undefined || raw === '') return VOICEVOX_TIMEOUT_SEC * 1000;
  const sec = Number(raw);
  if (!Number.isFinite(sec) || sec <= 0) throw new UsageError(`VOICEVOX_TIMEOUT は正の秒の数: ${raw}`);
  return sec * 1000;
};

/** つながらない・時間切れ（流し直してよい失敗） */
class Unreachable extends Error {
  constructor(
    message: string,
    readonly timedOut: boolean,
  ) {
    super(message);
  }
}
/** 5xx（流し直してよい失敗） */
class ServerError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const voicevox = (o: VoicevoxOptions): Voicevox => {
  const timeoutMs = o.timeoutMs ?? VOICEVOX_TIMEOUT_SEC * 1000;
  const attempts = o.attempts ?? ATTEMPTS;
  const backoffMs = o.backoffMs ?? BACKOFF_MS;
  const warn = o.warn ?? ((line: string) => console.warn(line));
  const sec = (ms: number) => `${Math.round(ms / 100) / 10} 秒`;

  /** 1 回の問い合わせ（時間切れつき）。ok の応答の本文を返す */
  const once = async (what: string, path: string, init: RequestInit, read: (r: Response) => Promise<unknown>) => {
    const t0 = Date.now();
    let r: Response;
    try {
      r = await fetch(`${o.url}${path}`, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (e) {
      const timedOut = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
      throw new Unreachable(
        timedOut ? `${sec(timeoutMs)}で答えない` : `つながらない（${e instanceof Error ? e.message : e}）`,
        timedOut,
      );
    }
    trace(`  VOICEVOX ${what}: ${r.status}（${sec(Date.now() - t0)}）`);
    if (r.status >= 500) throw new ServerError(`${r.status} を返した`);
    if (!r.ok) throw new Error(`${what} ${r.status}`);
    try {
      return await read(r);
    } catch (e) {
      // 本文の途中で切れた・止まった
      const timedOut = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
      throw new Unreachable(timedOut ? `${sec(timeoutMs)}で本文を返し終えない` : `本文が読めない（${e}）`, timedOut);
    }
  };

  /** 流し直してよい失敗（つながらない・時間切れ・5xx）は、待ってから attempts 回まで試す */
  const call = async <T>(
    what: string,
    path: string,
    init: RequestInit,
    read: (r: Response) => Promise<T>,
    text = '',
  ) => {
    for (let attempt = 1; ; attempt++) {
      trace(
        `> VOICEVOX ${init.method ?? 'GET'} ${path.split('?')[0]}${text ? `「${text.slice(0, 30)}」` : ''}（${attempt} 回目）`,
      );
      try {
        return (await once(what, path, init, read)) as T;
      } catch (e) {
        const retry = e instanceof Unreachable || e instanceof ServerError;
        if (!retry) throw text && e instanceof Error ? new Error(`${e.message}: ${text}`, { cause: e }) : e;
        if (attempt >= attempts) {
          const why = `VOICEVOX（${o.url}）の ${what} が ${e.message}（${attempts} 回試した。1 回の時間切れは ${sec(timeoutMs)}。VOICEVOX_TIMEOUT で変えられる）`;
          // エンジンが無い・止まっているのは、前提が足りない（終了コード 3）。台詞を変えていないなら、素材の声で足りる
          if (e instanceof Unreachable)
            throw new MissingError(
              `${why}。台詞を変えていないなら、先に素材を取り出す（bun scripts/materials.ts pull）${text ? `: ${text}` : ''}`,
            );
          throw new Error(`${why}${text ? `: ${text}` : ''}`);
        }
        const wait = backoffMs * 2 ** (attempt - 1);
        warn(`VOICEVOX の ${what} が ${e.message}。${sec(wait)}待って流し直す（${attempt + 1}/${attempts} 回目）`);
        await sleep(wait);
      }
    }
  };

  let versionOnce: Promise<string> | undefined;
  const version = () =>
    (versionOnce ??= call('version', '/version', { method: 'GET' }, async (r) => {
      const body = (await r.text()).trim();
      let v = body;
      try {
        const parsed = JSON.parse(body);
        if (typeof parsed === 'string') v = parsed;
      } catch {
        // 版が JSON の文字列でなければ、本文をそのまま使う
      }
      trace(`VOICEVOX の版: ${v}（${o.url}）`);
      return v;
    }));

  const synthesize = async (text: string, v: VoicevoxVoice) => {
    await version();
    const query = await call(
      'audio_query',
      `/audio_query?speaker=${v.speaker}&text=${encodeURIComponent(text)}`,
      { method: 'POST' },
      (r) => r.json() as Promise<Record<string, unknown> & { accent_phrases: AccentPhrase[] }>,
      text,
    );
    query.speedScale = v.speed;
    query.intonationScale = v.intonation;
    query.pitchScale = v.pitch;
    query.volumeScale = 1.0;
    query.prePhonemeLength = 0.08;
    query.postPhonemeLength = 0.12;
    query.outputSamplingRate = 48000;
    query.outputStereo = false;
    const kana = kanaOf(query.accent_phrases);
    const wav = await call(
      'synthesis',
      `/synthesis?speaker=${v.speaker}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(query) },
      async (r) => Buffer.from(await r.arrayBuffer()),
      text,
    );
    return { wav, kana };
  };

  return { url: o.url, version, synthesize };
};
