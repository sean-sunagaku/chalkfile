import { describe, expect, test } from 'bun:test';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// render.sh を一時フォルダに写し、偽の npx（Remotion）と ffmpeg を PATH の先に置いて流す。本物の書き出しはしない。
// render.sh は自分の 1 つ上のフォルダで動くので、リポジトリの out/・site/media・site/posters には触れない
const FAKE_NPX = `#!/bin/sh
# npx remotion render src/index.ts <コンポジション> <出力> [引数…]。FAKE_REMOTION（字幕つきの版は FAKE_REMOTION_CC）で動きを決める
echo "remotion $*" >> "$FAKE_LOG"
case "$*" in *captions*) mode=\${FAKE_REMOTION_CC:-ok} ;; *) mode=\${FAKE_REMOTION:-ok} ;; esac
case $mode in
  ok) printf new > "$5" ;;
  fail) echo 'Error: 書き出しに失敗' >&2; exit 1 ;;
  partial) printf half > "$5"; exit 1 ;;
esac
`;
const FAKE_FFMPEG = `#!/bin/sh
# 最後の引数（出力）に書く。FAKE_FFMPEG_BYTES があれば、その大きさの中身の無いファイルにする
for a; do out=$a; done
echo "ffmpeg $*" >> "$FAKE_LOG"
if [ -n "\${FAKE_FFMPEG_BYTES:-}" ]; then dd if=/dev/zero of="$out" bs=1 count=0 seek="$FAKE_FFMPEG_BYTES" 2>/dev/null; else printf encoded > "$out"; fi
`;
// 前の書き出しの出力（映像・字幕つきの映像・CHUNK の部品と一覧・サイト用の動画とポスター・字幕つきの版）
const PREVIOUS = ['out/master/T01.mp4', 'out/master/T01.cc.mp4', 'out/master/T01.part0.mp4', 'out/master/T01.part1.mp4', 'out/master/T01.parts.txt',
  'site/media/T01.mp4', 'site/media/T01.cc.mp4', 'site/media/T01.jpg', 'site/posters/T01.jpg', 'out/captioned/T01.mp4'];
const UNCHANGED = { 'out/captioned/T01.mp4': 'old', 'site/media/T01.cc.mp4': 'old', 'site/media/T01.jpg': 'old', 'site/media/T01.mp4': 'old', 'site/posters/T01.jpg': 'old' };

/** 300 フレーム（10 秒）の T01 を書き出し、終わったあとの out/・site/ の中身（大きいファイルは大きさだけ）と、偽の道具の呼ばれ方を返す */
const render = (env: Record<string, string> = {}) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'chalkfile-render-'));
  const put = (file: string, text: string) => { mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); writeFileSync(path.join(dir, file), text); };
  try {
    mkdirSync(path.join(dir, 'scripts'));
    copyFileSync(path.join(import.meta.dir, '../scripts/render.sh'), path.join(dir, 'scripts/render.sh'));
    put('src/generated/timeline.json', JSON.stringify({ T01: { durationInFrames: 300, fps: 30 } }));
    put('public/audio/mix/T01.wav', 'wav');
    put('bin/npx', FAKE_NPX); put('bin/ffmpeg', FAKE_FFMPEG);
    chmodSync(path.join(dir, 'bin/npx'), 0o755); chmodSync(path.join(dir, 'bin/ffmpeg'), 0o755);
    for (const file of PREVIOUS) put(file, 'old');
    const r = Bun.spawnSync(['bash', 'scripts/render.sh', 'T01'], { cwd: dir,
      env: { ...process.env, PATH: `${path.join(dir, 'bin')}:${process.env.PATH}`, FAKE_LOG: path.join(dir, 'calls.log'), CAPTIONS: '', CHUNK: '', ...env } });
    const files: Record<string, string> = {};
    for (const file of readdirSync(dir, { recursive: true }).map(String).filter((f) => /^(out|site)\//.test(f)).sort()) {
      const s = statSync(path.join(dir, file));
      if (s.isFile()) files[file] = s.size > 64 ? `${s.size} bytes` : readFileSync(path.join(dir, file), 'utf8');
    }
    const calls = readFileSync(path.join(dir, 'calls.log'), 'utf8').trim().split('\n');
    return { code: r.exitCode, stderr: r.stderr.toString(), files, calls };
  } finally { rmSync(dir, { recursive: true, force: true }); }
};

describe('render.sh が書き出しの失敗を見逃さない', () => {
  test('Remotion が失敗したら（途中まで書いてから失敗しても）0 でない終了コードで止まり、サイト用の出力を変えず、前の映像と部品も残さない', () => {
    for (const mode of ['fail', 'partial']) {
      const r = render({ FAKE_REMOTION: mode });
      expect(r.code).not.toBe(0);
      expect(r.stderr).toContain('T01: 映像の書き出しに失敗しました');
      expect(r.files).toEqual(UNCHANGED);
    }
  });
  test('字幕つきの版だけ失敗しても、前の字幕つきの映像で先へ進まず、通常版のサイト用の出力も変えない', () => {
    const r = render({ CAPTIONS: '1', FAKE_REMOTION_CC: 'fail' });
    expect(r.code).not.toBe(0);
    expect(r.stderr).toContain('T01: 字幕つきの映像の書き出しに失敗しました');
    expect(r.files).toEqual({ ...UNCHANGED, 'out/master/T01.mp4': 'new' });
  });
  test('CHUNK のとき、前の部品が残っていても、失敗した部品をそれで埋めない', () => {
    const r = render({ CHUNK: '150', FAKE_REMOTION: 'fail' });
    expect(r.code).not.toBe(0);
    expect(r.stderr).toContain('T01: 映像の書き出しに失敗しました（0-149）');
    expect(r.files).toEqual(UNCHANGED);
  });
  test('うまくいけば全部の出力を置き換え、一時ファイルと部品を残さない', () => {
    const r = render({ CAPTIONS: '1', CHUNK: '150' });
    expect(r.code).toBe(0);
    expect(r.files).toEqual({ 'out/captioned/T01.mp4': 'encoded', 'out/master/T01.cc.mp4': 'new', 'out/master/T01.mp4': 'encoded',
      'site/media/T01.cc.mp4': 'encoded', 'site/media/T01.jpg': 'encoded', 'site/media/T01.mp4': 'encoded', 'site/posters/T01.jpg': 'encoded' });
    expect(r.calls.filter((c) => c.startsWith('remotion ')).map((c) => /--frames=\S+|captions/.exec(c)?.[0])).toEqual(['--frames=0-149', '--frames=150-299', 'captions']);
  });
  test('字幕つきの版を作らないときは、前の字幕つきの版が残ることを知らせる', () => {
    const r = render();
    expect(r.code).toBe(0);
    expect(r.stderr).toContain('CAPTIONS=1');
    expect(r.files).toEqual({ ...UNCHANGED, 'out/master/T01.mp4': 'new', 'site/media/T01.jpg': 'encoded', 'site/media/T01.mp4': 'encoded', 'site/posters/T01.jpg': 'encoded' });
  });
  test('crf 29 でも上限を超えたら、警告して先へ進む', () => {
    const r = render({ FAKE_FFMPEG_BYTES: String(15 * 1000 * 1000) });
    expect(r.code).toBe(0);
    expect(r.stderr).toContain('警告: site/media/T01.mp4 は crf 29 でも');
    expect(r.calls.flatMap((c) => /-crf (\d+)/.exec(c)?.[1] ?? [])).toEqual(['21', '23', '25', '27', '29']);
  });
});
