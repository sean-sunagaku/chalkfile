// 英語と中国語の台詞を Kokoro（scripts/tts_kokoro.py。uv で流す）で読み上げる。足りない台詞をまとめて 1 回で流す（モデルの読み込みを 1 回にする）
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Video } from '../../../content';
import type { VoiceId } from '../../../content/types';
import { KOKORO, speechIn } from '../../../content/voices';
import { withLock, writeAtomic } from '../../lib/fsx';
import { ROOT } from '../../lib/paths';
import { runInherit } from '../../lib/proc';
import { type KokoroRecipe, recipeIn, ttsKeysIn } from '../../voices';
import { findVoice, metaJson, type VoiceStore } from './store';

/** Kokoro に渡す 1 本（scripts/tts_kokoro.py の jobs.json の 1 つ） */
export type KokoroJob = { key: string; text: string } & (typeof KOKORO)['en'][VoiceId];

const SCRIPT = path.join(ROOT, 'scripts/tts_kokoro.py');

/**
 * Kokoro の「エンジンの版」。scripts/tts_kokoro.py の頭書きで固定した依存の版（kokoro==0.9.4 など）を並べたもの。
 * 声の記録（<鍵>.meta.json）に書く
 */
export const kokoroVersion = (file = SCRIPT): string => {
  const head = /^# \/\/\/ script\n([\s\S]*?)^# \/\/\/$/m.exec(readFileSync(file, 'utf8'))?.[1] ?? '';
  const pins = [...head.matchAll(/^#\s+"([^"]+==[^"]+)",?$/gm)].map((m) => m[1]);
  if (!pins.length) throw new Error(`${path.relative(ROOT, file)} の頭書きに、依存の版（== で固定したもの）が無い`);
  return pins.join(' ');
};

/**
 * Kokoro の読み上げを止めるまでの時間（ミリ秒）。初回のモデルのダウンロード（数百 MB）の分の 15 分と、台詞 1 本につき 30 秒
 * （CPU で 1 本は数秒）。止まったままの読み上げを、待ち続けない
 */
export const kokoroTimeoutMs = (jobs: number): number => (15 * 60 + 30 * jobs) * 1000;

/**
 * 訳の動画で、まだ声の無い台詞（v2 → v1 の順に探して、どちらも無いもの）。新しい声の名前は v2 の鍵。同じ鍵は 1 本にまとめる。
 * recipe は声の記録に書く合成のレシピ（Kokoro には渡さない）
 */
export const kokoroJobs = (store: VoiceStore, videos: Video[]): (KokoroJob & { recipe: KokoroRecipe })[] => {
  const jobs = new Map<string, KokoroJob & { recipe: KokoroRecipe }>();
  for (const vid of videos) {
    if (vid.lang === 'ja') continue;
    for (const scene of vid.lecture.scenes)
      for (const line of scene.lines) {
        const voice = line.v ?? 'narrator';
        const text = speechIn(line, vid.lang);
        const recipe = recipeIn(voice, vid.lang) as KokoroRecipe;
        const keys = ttsKeysIn(text, voice, vid.lang, recipe);
        if (!findVoice(store, keys)) jobs.set(keys[0], { key: keys[0], text, ...KOKORO[vid.lang][voice], recipe });
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
        writeFileSync(file, JSON.stringify(jobs.map(({ recipe: _, ...job }) => job)));
        console.log(`Kokoro で ${jobs.length} 本の台詞を読み上げる（初回はモデルのダウンロードがある）`);
        // 依存の版は scripts/tts_kokoro.py.lock で固定する（--locked: ロックと頭書きがずれていたら止まる）。
        // 止まったままにならないよう、台詞の数から決めた時間で止める
        const code = runInherit('uv', ['run', '--quiet', '--locked', '--script', SCRIPT, file, store.cache], {
          cwd: ROOT,
          timeoutMs: kokoroTimeoutMs(jobs.length),
          what: `Kokoro の読み上げ（${jobs.length} 本）`,
        });
        if (code !== 0) {
          throw new Error(
            'Kokoro の読み上げに失敗した。uv が要る（docs/guide/quickstart.md の「前提の道具」）。台詞を変えていないなら、先に素材を取り出す（bun scripts/materials.ts pull）',
          );
        }
        writeMetas(store, jobs);
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
    },
    { what: 'Kokoro の読み上げ', timeoutMs: 60 * 60_000, log: console.log },
  );
};

/**
 * Kokoro が書いた声の隣に、声の記録（合成のレシピとエンジンの版）を置く。音声と読みがそろったものだけ（読みは Kokoro が最後に書く）。
 * 作ったあとに書くので、ここで止まっても、声は記録なしで使える
 */
export const writeMetas = (
  store: VoiceStore,
  jobs: (KokoroJob & { recipe: KokoroRecipe })[],
  version = kokoroVersion(),
) => {
  for (const { key, text, recipe } of jobs) {
    const done = existsSync(path.join(store.cache, `${key}.wav`)) && existsSync(path.join(store.cache, `${key}.kana`));
    if (done)
      writeAtomic(
        path.join(store.cache, `${key}.meta.json`),
        metaJson({ schema: 1, key, text, recipe, engineVersion: version }),
      );
  }
};
