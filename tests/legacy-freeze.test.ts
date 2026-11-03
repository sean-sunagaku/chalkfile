// 旧 Pages の移行のコードの凍結（docs/adr/2026-11-02-legacy-pages-end-date.md）。期限に消すまで、移行のコードを変えない。
// 移行のテスト（tests/browser/migration.spec.ts）は、公開済みの移行の案内（tests/fixtures/legacy-migration。gh-pages の 9dd4e82 を
// そのまま写したもの）を配り、今のソースから作り直さない（site/offline-shared.ts を直しても、移行のテストが壊れない）。
// 凍結を解くときは、ADR を直してから、ここの値を直す
import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dir, '..');
const sha256 = (file: string) =>
  createHash('sha256')
    .update(readFileSync(path.join(ROOT, file)))
    .digest('hex');

/** 凍結した移行のコード（変えない） */
const FROZEN: Record<string, string> = {
  'site/legacy-sw.ts': '9a52065b79bbf1a9c443d252c13641933677805a2ff7bd17deeb504daabe3c97',
  'scripts/build_migration.ts': '809ce7409a8fe9316e0e3577e8b9605cc060f22c22297ec153a7e81ec87eff6a',
};

/** 公開済みの移行の案内（gh-pages の 9dd4e82。main の ad75d60 から作ったもの）の全部のファイル */
const PUBLISHED: Record<string, string> = {
  '.nojekyll': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  '404.html': '979318ca8c0b08406a68546b09a33a96c4a22f9f86c30432d518bd91459f79c3',
  'index.html': '979318ca8c0b08406a68546b09a33a96c4a22f9f86c30432d518bd91459f79c3',
  'indie-marketing/index.html': 'bc810ebca875aa341ed6a45e775172768c6612657a875b0162528b11b27fe349',
  'migration-health.json': 'a1745553670f721a64dc823e7bcf2347bc1be29bf01c91b974f9291a0cff3c63',
  'nudge-comedy/index.html': '4cf241428fb170677773ab5bae4a59e84faa6f82009c21122b823d14410517f3',
  'nudge-product/index.html': '4616a87d9c6b39306b968b09eccbf240f3c3af2700fc9b7d7ac70940c6b69c61',
  'pstack-comedy/index.html': 'ae6e5b8ece11eb424f6db164bc72611af8d53c551bad1f205e9ef1264a2eb7e0',
  'rive-comedy/index.html': 'a7977ca7a1174fa0975bd3f33275d7baa5906d787eb194572b7ff7e502087ff2',
  'stripe-billing/index.html': 'ffed6be61ccf92354c3896431c713eb690c2afc11d55e099231807ad3999fea9',
  'superagent-comedy/index.html': 'bf70363417a04bc803eb4ede8a2b574be0e312952c5ef7d00ae30e14e70d789c',
  'sw.js': 'edf03b2d312567bead39eeaedbbd1d8ed9701bc0c69c64d094021c3ee5c12801',
  'uiux-engineers/index.html': '96638f221ab408e4dd07ac0baed51af69826eb5bca50f6179a458ba68602fd74',
};

/** フォルダの中の全部のファイル（/ で区切った、フォルダからの場所） */
const filesIn = (dir: string, at = ''): string[] =>
  readdirSync(path.join(dir, at)).flatMap((name) => {
    const rel = at ? `${at}/${name}` : name;
    return statSync(path.join(dir, rel)).isDirectory() ? filesIn(dir, rel) : [rel];
  });

describe('旧 Pages の移行のコードの凍結', () => {
  test('移行の SW と、移行の案内を作る道具を変えていない', () => {
    for (const [file, hash] of Object.entries(FROZEN)) {
      expect(`${file} ${sha256(file)}`).toBe(`${file} ${hash}`);
    }
  });
  test('移行のテストに配る fixture は、公開済みの移行の案内と同じ（足さない・直さない）', () => {
    const dir = path.join(ROOT, 'tests/fixtures/legacy-migration');
    expect(filesIn(dir).sort()).toEqual(Object.keys(PUBLISHED).sort());
    for (const [file, hash] of Object.entries(PUBLISHED)) {
      expect(`${file} ${sha256(`tests/fixtures/legacy-migration/${file}`)}`).toBe(`${file} ${hash}`);
    }
  });
});
