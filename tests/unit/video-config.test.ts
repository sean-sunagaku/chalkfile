// 動画の決まった値（src/video.config.ts）と、Python が読む書き出し（scripts/audio/video_config.json）がずれていないか
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { VIDEO_CONFIG_JSON, videoConfigJson } from '../../scripts/gen_video_config';

const ROOT = path.resolve(import.meta.dir, '../..');

describe('動画の決まった値（src/video.config.ts）', () => {
  test('scripts/audio/video_config.json が、src/video.config.ts から作ったものと同じ（ずれたら npm run gen:video-config で作り直す）', () => {
    expect(readFileSync(VIDEO_CONFIG_JSON, 'utf8')).toBe(videoConfigJson());
  });
  test('mix.py と build_music.py（ジングルは scripts/audio/music/stings.py）は、ジングルの「ドン」の秒をその JSON から読む', () => {
    for (const f of ['scripts/mix.py', 'scripts/audio/music/stings.py']) {
      const py = readFileSync(path.join(ROOT, f), 'utf8');
      expect(`${f} ${py.includes('ROOT / "scripts" / "audio" / "video_config.json"')}`).toBe(`${f} true`);
      expect(`${f} ${py.includes('VIDEO["stingIntroHitSec"]')}`).toBe(`${f} true`);
    }
  });
});
