// 動画の決まった値（engine/core/video-config.ts。部品は src/video.config.ts から読む）のうち、Python（scripts/mix.py・scripts/build_music.py）が
// 読むものを scripts/audio/video_config.json に書き出す。
//   bun scripts/gen_video_config.ts           # 書き出す（npm run gen:video-config）。src/video.config.ts を変えたら流してコミットする
//   bun scripts/gen_video_config.ts --check   # 書き出したものが今の値と合うかだけを見る（ずれていたら 1 で終える）
// ずれは tests/video-config.test.ts も止める（CI の npm test）
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PYTHON_CONFIG } from '../engine/core/video-config';
import { readArgs, runMain, showHelp } from './lib/args';
import { writeAtomic } from './lib/fsx';
import { ROOT } from './lib/paths';
export const VIDEO_CONFIG_JSON = path.join(ROOT, 'scripts/audio/video_config.json');

/** 書き出す中身（JSON はコメントを書けないので、作り方を _note に書く） */
export const videoConfigJson = (): string =>
  `${JSON.stringify({ _note: 'src/video.config.ts から npm run gen:video-config（bun scripts/gen_video_config.ts）で作る。手で直さない', ...PYTHON_CONFIG }, null, 2)}\n`;

const main = (argv: string[]) => {
  const { values } = readArgs(argv, { check: { type: 'boolean' } });
  if (values.help) return showHelp(import.meta.filename);
  const rel = path.relative(ROOT, VIDEO_CONFIG_JSON);
  const want = videoConfigJson();
  const now = existsSync(VIDEO_CONFIG_JSON) ? readFileSync(VIDEO_CONFIG_JSON, 'utf8') : null;
  if (values.check) {
    if (now !== want) {
      console.error(`${rel} が src/video.config.ts と合わない。npm run gen:video-config で作り直してコミットする`);
      return 1;
    }
    console.log(`${rel} は src/video.config.ts と合う`);
  } else {
    writeAtomic(VIDEO_CONFIG_JSON, want);
    console.log(`${rel} を${now === want ? '確かめた（変わらない）' : '書いた'}`);
  }
};

if (import.meta.main) await runMain(main);
