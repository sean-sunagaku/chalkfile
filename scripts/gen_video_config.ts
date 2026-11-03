// src/video.config.ts の値のうち、Python（scripts/mix.py・scripts/build_music.py）が読むものを scripts/audio/video_config.json に書き出す。
//   bun scripts/gen_video_config.ts           # 書き出す（npm run gen:video-config）。src/video.config.ts を変えたら流してコミットする
//   bun scripts/gen_video_config.ts --check   # 書き出したものが今の値と合うかだけを見る（ずれていたら 1 で終える）
// ずれは tests/video-config.test.ts も止める（CI の npm test）
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PYTHON_CONFIG } from '../src/video.config';

const ROOT = path.resolve(import.meta.dir, '..');
export const VIDEO_CONFIG_JSON = path.join(ROOT, 'scripts/audio/video_config.json');

/** 書き出す中身（JSON はコメントを書けないので、作り方を _note に書く） */
export const videoConfigJson = (): string =>
  `${JSON.stringify({ _note: 'src/video.config.ts から npm run gen:video-config（bun scripts/gen_video_config.ts）で作る。手で直さない', ...PYTHON_CONFIG }, null, 2)}\n`;

if (import.meta.main) {
  const args = process.argv.slice(2);
  for (const a of args) if (a !== '--check') throw new Error(`知らない引数: ${a}（使えるのは --check）`);
  const rel = path.relative(ROOT, VIDEO_CONFIG_JSON);
  const want = videoConfigJson();
  const now = existsSync(VIDEO_CONFIG_JSON) ? readFileSync(VIDEO_CONFIG_JSON, 'utf8') : null;
  if (args.includes('--check')) {
    if (now !== want) {
      console.error(`${rel} が src/video.config.ts と合わない。npm run gen:video-config で作り直してコミットする`);
      process.exit(1);
    }
    console.log(`${rel} は src/video.config.ts と合う`);
  } else {
    mkdirSync(path.dirname(VIDEO_CONFIG_JSON), { recursive: true });
    writeFileSync(VIDEO_CONFIG_JSON, want);
    console.log(`${rel} を${now === want ? '確かめた（変わらない）' : '書いた'}`);
  }
}
