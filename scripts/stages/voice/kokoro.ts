// 英語と中国語の台詞を Kokoro（scripts/tts_kokoro.py。uv で流す）で読み上げる。足りない台詞をまとめて 1 回で流す（モデルの読み込みを 1 回にする）
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Video } from '../../../content';
import type { VoiceId } from '../../../content/types';
import { KOKORO, speechIn } from '../../../content/voices';
import { withLock } from '../../lib/fsx';
import { ROOT } from '../../lib/paths';
import { runInherit } from '../../lib/proc';
import { ttsKeysIn } from '../../voices';
import { findVoice, type VoiceStore } from './store';

/** Kokoro に渡す 1 本（scripts/tts_kokoro.py の jobs.json の 1 つ） */
export type KokoroJob = { key: string; text: string } & (typeof KOKORO)['en'][VoiceId];

/**
 * Kokoro の読み上げを止めるまでの時間（ミリ秒）。初回のモデルのダウンロード（数百 MB）の分の 15 分と、台詞 1 本につき 30 秒
 * （CPU で 1 本は数秒）。止まったままの読み上げを、待ち続けない
 */
export const kokoroTimeoutMs = (jobs: number): number => (15 * 60 + 30 * jobs) * 1000;

/** 訳の動画で、まだ声の無い台詞（v2 → v1 の順に探して、どちらも無いもの）。新しい声の名前は v2 の鍵。同じ鍵は 1 本にまとめる */
export const kokoroJobs = (store: VoiceStore, videos: Video[]): KokoroJob[] => {
  const jobs = new Map<string, KokoroJob>();
  for (const vid of videos) {
    if (vid.lang === 'ja') continue;
    for (const scene of vid.lecture.scenes)
      for (const line of scene.lines) {
        const voice = line.v ?? 'narrator';
        const text = speechIn(line, vid.lang);
        const keys = ttsKeysIn(text, voice, vid.lang);
        if (!findVoice(store, keys)) jobs.set(keys[0], { key: keys[0], text, ...KOKORO[vid.lang][voice] });
      }
  }
  return [...jobs.values()];
};

/**
 * 訳の動画で、まだ声の無い台詞を Kokoro でまとめて作り、共有のキャッシュに書く。
 * ほかの synth（ほかの作業フォルダのものも）が Kokoro を流している間は待ち（キャッシュのロック）、
 * 終わってから足りない台詞を数え直す（同じ台詞を 2 回作らない）
 */
export const runKokoro = async (store: VoiceStore, videos: Video[]): Promise<void> => {
  if (!kokoroJobs(store, videos).length) return;
  await withLock(
    path.join(store.cache, '.kokoro.lock'),
    () => {
      const jobs = kokoroJobs(store, videos);
      if (!jobs.length) return;
      // ジョブのファイルは、流すたびに別の一時フォルダに置く（同時に流した synth のジョブと混ざらない）
      const tmp = mkdtempSync(path.join(tmpdir(), 'chalkfile-kokoro-'));
      try {
        const file = path.join(tmp, 'jobs.json');
        writeFileSync(file, JSON.stringify(jobs));
        console.log(`Kokoro で ${jobs.length} 本の台詞を読み上げる（初回はモデルのダウンロードがある）`);
        // 依存の版は scripts/tts_kokoro.py.lock で固定する（--locked: ロックと頭書きがずれていたら止まる）。
        // 止まったままにならないよう、台詞の数から決めた時間で止める
        const code = runInherit(
          'uv',
          ['run', '--quiet', '--locked', '--script', path.join(ROOT, 'scripts/tts_kokoro.py'), file, store.cache],
          { cwd: ROOT, timeoutMs: kokoroTimeoutMs(jobs.length), what: `Kokoro の読み上げ（${jobs.length} 本）` },
        );
        if (code !== 0) {
          throw new Error(
            'Kokoro の読み上げに失敗した。uv が要る（docs/guide/quickstart.md の「前提の道具」）。台詞を変えていないなら、先に素材を取り出す（bun scripts/materials.ts pull）',
          );
        }
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
    },
    { what: 'Kokoro の読み上げ', timeoutMs: 60 * 60_000, log: console.log },
  );
};
