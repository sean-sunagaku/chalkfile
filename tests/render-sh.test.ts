import { describe, expect, test } from 'bun:test';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// render.sh を一時フォルダに写し、偽の npx（Remotion）と ffmpeg を PATH の先に置いて流す。本物の書き出しはしない。
// render.sh は自分の 1 つ上のフォルダで動くので、リポジトリの out/・site/media・講座のフォルダのポスターには触れない
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
const PREVIOUS = [
  'out/master/T01.mp4',
  'out/master/T01.cc.mp4',
  'out/master/T01.part0.mp4',
  'out/master/T01.part1.mp4',
  'out/master/T01.parts.txt',
  'site/media/T01.mp4',
  'site/media/T01.cc.mp4',
  'site/media/T01.jpg',
  'content/t-course/generated/posters/T01.jpg',
  'out/captioned/T01.mp4',
];
const UNCHANGED = {
  'out/captioned/T01.mp4': 'old',
  'site/media/T01.cc.mp4': 'old',
  'site/media/T01.jpg': 'old',
  'site/media/T01.mp4': 'old',
  'content/t-course/generated/posters/T01.jpg': 'old',
};

/**
 * 300 フレーム（10 秒）の T01 を書き出し、終わったあとの out/・site/ の中身（大きいファイルは大きさだけ）と、偽の道具の呼ばれ方を返す。
 * 上限の正本（site/limits.ts）は本物を写す。limits に中身を渡すとそれに替え、null なら置かない。extra は足すファイル（偽の記録の道具など）
 */
const render = (
  env: Record<string, string> = {},
  limits: string | null = readFileSync(path.join(import.meta.dir, '../site/limits.ts'), 'utf8'),
  timeline: string | null = JSON.stringify({ key: 'T01', durationInFrames: 300, fps: 30 }),
  extra: Record<string, string> = {},
) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'chalkfile-render-'));
  const put = (file: string, text: string) => {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    writeFileSync(path.join(dir, file), text);
  };
  try {
    mkdirSync(path.join(dir, 'scripts'));
    copyFileSync(path.join(import.meta.dir, '../scripts/render.sh'), path.join(dir, 'scripts/render.sh'));
    // timeline は講座のフォルダの generated/timeline/<id>.json（scripts/synth.ts が書く）
    if (timeline !== null) put('content/t-course/generated/timeline/T01.json', timeline);
    put('public/audio/mix/T01.wav', 'wav');
    put('bin/npx', FAKE_NPX);
    put('bin/ffmpeg', FAKE_FFMPEG);
    chmodSync(path.join(dir, 'bin/npx'), 0o755);
    chmodSync(path.join(dir, 'bin/ffmpeg'), 0o755);
    for (const file of PREVIOUS) put(file, 'old');
    if (limits !== null) put('site/limits.ts', limits);
    for (const [file, text] of Object.entries(extra)) put(file, text);
    const r = Bun.spawnSync(['bash', 'scripts/render.sh', 'T01'], {
      cwd: dir,
      env: {
        ...process.env,
        PATH: `${path.join(dir, 'bin')}:${process.env.PATH}`,
        FAKE_LOG: path.join(dir, 'calls.log'),
        CAPTIONS: '',
        CHUNK: '',
        ...env,
      },
    });
    const files: Record<string, string> = {};
    for (const file of readdirSync(dir, { recursive: true })
      .map(String)
      .filter((f) => /^(out|site|content\/t-course\/generated\/posters)\//.test(f) && f !== 'site/limits.ts')
      .sort()) {
      const s = statSync(path.join(dir, file));
      if (s.isFile()) files[file] = s.size > 64 ? `${s.size} bytes` : readFileSync(path.join(dir, file), 'utf8');
    }
    const log = path.join(dir, 'calls.log');
    const calls = existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : [];
    return { code: r.exitCode, stderr: r.stderr.toString(), files, calls };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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
    expect(r.files).toEqual({
      'out/captioned/T01.mp4': 'encoded',
      'out/master/T01.cc.mp4': 'new',
      'out/master/T01.mp4': 'encoded',
      'site/media/T01.cc.mp4': 'encoded',
      'site/media/T01.jpg': 'encoded',
      'site/media/T01.mp4': 'encoded',
      'content/t-course/generated/posters/T01.jpg': 'encoded',
    });
    expect(r.calls.filter((c) => c.startsWith('remotion ')).map((c) => /--frames=\S+|captions/.exec(c)?.[0])).toEqual([
      '--frames=0-149',
      '--frames=150-299',
      'captions',
    ]);
  });
  test('字幕つきの版を作らないときは、前の字幕つきの版が残ることを知らせる', () => {
    const r = render();
    expect(r.code).toBe(0);
    expect(r.stderr).toContain('CAPTIONS=1');
    expect(r.files).toEqual({
      ...UNCHANGED,
      'out/master/T01.mp4': 'new',
      'site/media/T01.jpg': 'encoded',
      'site/media/T01.mp4': 'encoded',
      'content/t-course/generated/posters/T01.jpg': 'encoded',
    });
  });
  test('crf 29 でも目安を超えたら、警告して先へ進む', () => {
    const r = render({ FAKE_FFMPEG_BYTES: String(15 * 1000 * 1000) });
    expect(r.code).toBe(0);
    expect(r.stderr).toContain('警告: site/media/T01.mp4 は crf 29 でも');
    expect(r.stderr).toContain('目安（14500 KiB）');
    expect(r.stderr).not.toContain('保存の 1 ファイルの上限');
    expect(r.calls.flatMap((c) => /-crf (\d+)/.exec(c)?.[1] ?? [])).toEqual(['21', '23', '25', '27', '29']);
  });
});

describe('render.sh は、動画の timeline を講座のフォルダから読む', () => {
  test('timeline が無ければ、何も書き出さず・前の出力も消さずに止まる', () => {
    const before = Object.fromEntries(PREVIOUS.map((f) => [f, 'old']));
    const r = render({}, undefined, null);
    expect(r.code).not.toBe(0);
    expect(r.stderr).toContain('T01: timeline が無い');
    expect(r.files).toEqual(before);
    expect(r.calls).toEqual([]);
  });
  test('6 分より長い動画は、crf 27 から試す（長さは timeline の durationInFrames と fps）', () => {
    const r = render({ FAKE_FFMPEG_BYTES: String(20 * 1000 * 1000) }, undefined, JSON.stringify({ key: 'T01', durationInFrames: 361 * 30, fps: 30 }));
    expect(r.code).toBe(0);
    expect(r.calls.flatMap((c) => /-crf (\d+)/.exec(c)?.[1] ?? [])).toEqual(['27', '29']);
  });
});

describe('render.sh は、動画の目安と保存の上限を site/limits.ts から読む', () => {
  const limits = (target: number, max: number) =>
    `export const VIDEO_TARGET_BYTES = ${target};\nexport const OFFLINE_FILE_MAX_BYTES = ${max};\n`;
  test('目安を変えると、crf を上げる所と警告が変わる', () => {
    const small = render({ FAKE_FFMPEG_BYTES: String(20 * 1024) }, limits(10 * 1024, 1024 * 1024));
    expect(small.code).toBe(0);
    expect(small.stderr).toContain('目安（10 KiB）を超えています');
    expect(small.stderr).not.toContain('保存の 1 ファイルの上限');
    const fits = render({ FAKE_FFMPEG_BYTES: String(20 * 1024) }, limits(30 * 1024, 1024 * 1024));
    expect(fits.code).toBe(0);
    expect(fits.stderr).not.toContain('目安');
    expect(fits.calls.flatMap((c) => /-crf (\d+)/.exec(c)?.[1] ?? [])).toEqual(['21']);
  });
  test('保存の 1 ファイルの上限を超えたら、別に警告する（書き出した動画は残す。止めるのは media.ts push と build_site）', () => {
    const r = render({ FAKE_FFMPEG_BYTES: String(2 * 1024 * 1024) }, limits(10 * 1024, 1024 * 1024));
    expect(r.code).toBe(0);
    expect(r.stderr).toContain('警告: site/media/T01.mp4 は保存の 1 ファイルの上限（1 MiB）も超えています');
    expect(r.stderr).toContain('保存の 1 ファイルの上限（1 MiB）を超えた動画があります');
    expect(r.files['site/media/T01.mp4']).toBe(`${2 * 1024 * 1024} bytes`);
  });
  test('site/limits.ts が無いか、値が数でなければ、何も書き出さずに止まる', () => {
    const before = Object.fromEntries(PREVIOUS.map((f) => [f, 'old']));
    for (const content of [null, 'export const VIDEO_TARGET_BYTES = "大きい";\nexport const OFFLINE_FILE_MAX_BYTES = 1;\n']) {
      const r = render({}, content);
      expect(r.code).not.toBe(0);
      expect(r.stderr).toMatch(/site\/limits\.ts の上限(を読めません|が数ではありません)/);
      expect(r.files).toEqual(before);
      expect(r.calls).toEqual([]);
    }
  });
});

describe('render.sh は、書き出しの前後に段の記録（scripts/pipeline.ts record render）を流す', () => {
  // 記録の道具の偽物（呼ばれ方を FAKE_LOG に書く）。本物は .work/state/render/<id>.json を書く
  const FAKE_PIPELINE = `import { appendFileSync } from 'node:fs';
appendFileSync(process.env.FAKE_LOG ?? '', \`pipeline \${process.argv.slice(2).join(' ')}\\n\`);
`;
  test('書き出す前に --begin、全部の出力を置き換えたあとで記録する（字幕版もできてから）', () => {
    const r = render({ CAPTIONS: '1' }, undefined, undefined, { 'scripts/pipeline.ts': FAKE_PIPELINE });
    expect(r.code).toBe(0);
    const order = r.calls.map((c) => c.split(' ')[0] + (c.startsWith('pipeline') ? ` ${c.split(' ').slice(1).join(' ')}` : ''));
    expect(order[0]).toBe('pipeline record render --begin T01');
    expect(order[order.length - 1]).toBe('pipeline record render T01');
    expect(order.filter((c) => c.startsWith('remotion'))).toHaveLength(2);
  });
  test('書き出しに失敗したら、記録しない（--begin だけ）', () => {
    const r = render({ FAKE_REMOTION: 'fail' }, undefined, undefined, { 'scripts/pipeline.ts': FAKE_PIPELINE });
    expect(r.code).not.toBe(0);
    expect(r.calls.filter((c) => c.startsWith('pipeline'))).toEqual(['pipeline record render --begin T01']);
  });
  test('記録の道具が失敗しても、書き出しは止めない（知らせるだけ）', () => {
    const r = render({}, undefined, undefined, { 'scripts/pipeline.ts': 'process.exit(1);\n' });
    expect(r.code).toBe(0);
    expect(r.stderr).toContain('注意: --begin T01: 書き出しの記録を書けなかった');
    expect(r.files['site/media/T01.mp4']).toBe('encoded');
  });
});
