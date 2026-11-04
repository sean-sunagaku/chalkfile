// 章ごとの納品物（scripts/export_deliverables.ts）。要るファイルが欠けたら、何も書かずに止める（欠けたものと作り方を出す）
import { afterAll, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { videoOf } from '../../content';
import { lackingParts, partsOf } from '../../scripts/export_deliverables';

const sandbox = mkdtempSync(path.join(os.tmpdir(), 'chalkfile-deliverables-test-'));
afterAll(() => rmSync(sandbox, { recursive: true, force: true }));
const put = (root: string, rel: string) => {
  mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  writeFileSync(path.join(root, rel), '');
};

describe('納品物に要るファイル', () => {
  test('教材のある章は、動画・ポスター・音・字幕の元・教材が要る。字幕を焼き込んだ版は、あれば入れる', () => {
    const { need, extra } = partsOf(videoOf('N01'), sandbox);
    expect(need.map((p) => p.from)).toEqual([
      'site/media/N01.mp4',
      'site/media/N01.jpg',
      'public/audio/mix/N01.wav',
      'site/data/N01.json',
      'docs/courses/nudge-product/nudge-01.md',
    ]);
    expect(extra.map((p) => p.from)).toEqual(['out/captioned/N01.mp4']);
  });
  test('掛け合いの講座（cast あり）は、字幕を焼き込んだ版も要る。ポスターは講座のフォルダのものを先に使う', () => {
    const root = mkdtempSync(path.join(sandbox, 'root-'));
    put(root, 'content/ga4-comedy/generated/posters/G01.jpg');
    const { need, extra } = partsOf(videoOf('G01'), root);
    expect(need.map((p) => p.from)).toEqual([
      'out/captioned/G01.mp4',
      'site/media/G01.mp4',
      'content/ga4-comedy/generated/posters/G01.jpg',
      'public/audio/mix/G01.wav',
      'site/data/G01.json',
    ]);
    expect(extra).toEqual([]);
  });
  test('欠けたファイルを、動画と作り方つきで全部挙げる。そろえば空', () => {
    const root = mkdtempSync(path.join(sandbox, 'root-'));
    const videos = [videoOf('G01'), videoOf('N01')];
    expect(lackingParts(videos, root)).toEqual([
      'G01: out/captioned/G01.mp4（CAPTIONS=1 npm run render -- G01）',
      'G01: site/media/G01.mp4（npm run render -- G01。Releases に置いた動画なら bun scripts/media.ts pull ga4-comedy）',
      'G01: site/media/G01.jpg（npm run render -- G01）',
      'G01: public/audio/mix/G01.wav（npm run mix -- G01）',
      'G01: site/data/G01.json（npm run synth -- G01。台詞を変えていなければ --cached-only）',
      'N01: site/media/N01.mp4（npm run render -- N01。Releases に置いた動画なら bun scripts/media.ts pull nudge-product）',
      'N01: site/media/N01.jpg（npm run render -- N01）',
      'N01: public/audio/mix/N01.wav（npm run mix -- N01）',
      'N01: site/data/N01.json（npm run synth -- N01。台詞を変えていなければ --cached-only）',
      'N01: docs/courses/nudge-product/nudge-01.md（npm run build:materials）',
    ]);
    for (const v of videos) for (const p of partsOf(v, root).need) put(root, p.from);
    expect(lackingParts(videos, root)).toEqual([]);
  });
});
