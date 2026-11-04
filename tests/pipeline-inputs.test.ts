// 段の指紋に入れるもの（scripts/stages/video/inputs.ts・scripts/stages/pipeline/stages.ts）を固定する。入れ忘れた入力の変化を
// 見逃すのが一番の危険なので、「変えると指紋が変わるもの」と「変えても変わらないもの（サイトと教材だけが使う項目）」を、本物の台本で
// 確かめる。ファイルは一時のフォルダにだけ書く（声・ミックス・動画は小さい偽物）。本物の道具は流さない
import { afterAll, describe, expect, test } from 'bun:test';
import { parse } from '@babel/parser';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { VIDEOS, type Video } from '../content';
import { THEMES } from '../content/themes';
import type { Course, Lecture } from '../content/types';
import { VOICES, speechIn } from '../content/voices';
import { mediaListFile, timelineFile } from '../engine/core/generated';
import { readSiteConfig } from '../scripts/lib/config';
import { materialOutputs } from '../scripts/build_materials';
import { courseMediaJson, readCourseMedia } from '../scripts/media-lists';
import { codeFiles, fileHasher, listFiles } from '../scripts/stages/pipeline/digest';
import { docsFiles, makeStages, MIX_CODE, MUSIC_FILES } from '../scripts/stages/pipeline/stages';
import {
  COURSE_FIELDS,
  currentInputs,
  LECTURE_FIELDS,
  publishedChecks,
  RENDER_CODE,
  RENDER_DEPS,
  readTimelineJson,
  scriptDigest,
  srcDigest,
} from '../scripts/stages/video/inputs';
import { ttsKeysIn } from '../scripts/voices';

const ROOT = path.resolve(import.meta.dir, '..');
const sandbox = mkdtempSync(path.join(os.tmpdir(), 'chalkfile-pipeline-inputs-'));
afterAll(() => rmSync(sandbox, { recursive: true, force: true }));
let n = 0;
const tmp = () => mkdtempSync(path.join(sandbox, `t${++n}-`));
const put = (root: string, file: string, body: string | Buffer) => {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), body);
};

/** 掛け合いの講座（cast あり）の動画と、Git に入れた timeline */
// biome-ignore lint/style/noNonNullAssertion: 本物の講座の動画（無ければテストが止まる）
const video = VIDEOS.find((v) => v.key === 'G01')!;
const timeline = readTimelineJson(ROOT, video);
const base = scriptDigest(video, timeline);
const lectureWith = (patch: (l: Lecture) => void): Video => {
  const lecture = structuredClone(video.lecture);
  patch(lecture);
  return { ...video, lecture };
};
const courseWith = (patch: (c: Course) => void): Video => {
  const course = structuredClone(video.course);
  patch(course);
  return { ...video, course };
};

describe('動画の台本の側の指紋（render の script・動画の一覧の inputs.script）', () => {
  test('timeline は Git にある', () => {
    expect(timeline).not.toBeNull();
  });
  test('画面の文 t だけを直すと変わる（読みの s が同じで、声も時刻も変わらないとき）', () => {
    const changed = lectureWith((l) => {
      const line = l.scenes.flatMap((s) => s.lines).find((x) => x.s);
      if (!line) throw new Error('s のある台詞が無い');
      line.t = `${line.t}（直した）`;
    });
    expect(scriptDigest(changed, timeline)).not.toBe(base);
  });
  test('動画が描くレクチャーと講座の項目・テーマの値・声のクレジット・timeline を変えると変わる', () => {
    const cases: [string, Video][] = [
      ['場面の見出し', lectureWith((l) => Object.assign(l.scenes[1], { heading: `${l.scenes[1].heading ?? ''}。` }))],
      ['注意書き', lectureWith((l) => Object.assign(l, { caution: '注意' }))],
      ['レクチャーの題', lectureWith((l) => Object.assign(l, { title: `${l.title}。` }))],
      ['番号', lectureWith((l) => Object.assign(l, { no: l.no + 1 }))],
      ['講座名', courseWith((c) => Object.assign(c, { title: `${c.title}。` }))],
      ['講座の注意書き', courseWith((c) => Object.assign(c, { disclaimer: '非公式' }))],
      ['standalone', courseWith((c) => Object.assign(c, { standalone: !c.standalone }))],
      [
        'unitLabel',
        courseWith((c) => Object.assign(c, { unitLabel: c.unitLabel === 'CHAPTER' ? 'LECTURE' : 'CHAPTER' })),
      ],
      [
        '配役の名前',
        courseWith((c) => {
          const cast = c.cast ?? {};
          const first = Object.values(cast)[0];
          if (first) first.name = `${first.name}さん`;
        }),
      ],
      ['テーマの ID', courseWith((c) => Object.assign(c, { theme: 'paper' }))],
      ['レクチャーの数', courseWith((c) => void c.lectures.push(structuredClone(c.lectures[0])))],
    ];
    for (const [what, v] of cases) expect(`${what} ${scriptDigest(v, timeline) !== base}`).toBe(`${what} true`);
    const tl = structuredClone(timeline) as { durationInFrames: number };
    tl.durationInFrames += 1;
    expect(scriptDigest(video, tl)).not.toBe(base);
  });
  test('テーマの値（content/themes.ts）と、声のクレジット（content/voices.ts）を変えると変わる', () => {
    const theme = THEMES[video.course.theme ?? 'chalkfile'];
    const bg = theme.color.bg;
    const credit = VOICES.narrator.credit;
    try {
      theme.color.bg = '#000001';
      expect(scriptDigest(video, timeline)).not.toBe(base);
      theme.color.bg = bg;
      VOICES.narrator.credit = 'VOICEVOX:だれか';
      expect(scriptDigest(video, timeline)).not.toBe(base);
    } finally {
      theme.color.bg = bg;
      VOICES.narrator.credit = credit;
    }
    expect(scriptDigest(video, timeline)).toBe(base);
  });
  test('サイトと教材だけが使う項目を直しても変わらない（動画は古くならない）', () => {
    const cases: [string, Video][] = [
      ['要約', lectureWith((l) => Object.assign(l, { summary: '別の要約' }))],
      ['公式ドキュメント', lectureWith((l) => void l.docs.push({ title: 'x', url: 'https://example.com/' }))],
      ['サイトのクイズ', lectureWith((l) => Object.assign(l, { quiz: [] }))],
      ['要点', lectureWith((l) => void l.takeaways.push('足した要点'))],
      ['セクション', lectureWith((l) => Object.assign(l, { section: { no: 9, title: '別' } }))],
      ['講座の副題', courseWith((c) => Object.assign(c, { subtitle: '別の副題' }))],
      ['講座の一文', courseWith((c) => Object.assign(c, { headline: '別の一文' }))],
      ['前置き', courseWith((c) => Object.assign(c, { docsNote: '別の前置き' }))],
      ['台本のもと', courseWith((c) => Object.assign(c, { sourceNote: '別のもと' }))],
      ['リンク', courseWith((c) => Object.assign(c, { links: [{ label: 'x', url: 'https://example.com/' }] }))],
      ['サイトの言葉', courseWith((c) => Object.assign(c, { ui: { docs: '資料' } }))],
      ['出典', courseWith((c) => Object.assign(c, { sources: [] }))],
      ['並び', courseWith((c) => Object.assign(c, { order: c.order + 100 }))],
      ['ほかのレクチャーの中身', courseWith((c) => Object.assign(c.lectures[1], { title: '別の題' }))],
      // 台詞の id は、画面の要素の at を台詞に結ぶ名前（読み込むときに番号に直す）。番号が同じなら動画は同じ
      ['台詞の id', lectureWith((l) => Object.assign(l.scenes[1].lines[0], { id: 'renamed' }))],
    ];
    for (const [what, v] of cases) expect(`${what} ${scriptDigest(v, timeline) === base}`).toBe(`${what} true`);
  });
  test('動画（src/）が読む講座とレクチャーの項目は、全部 COURSE_FIELDS・LECTURE_FIELDS にある', () => {
    const files = listFiles(ROOT, ['src']).filter((f) => /\.(ts|tsx)$/.test(f));
    const read = { course: new Set<string>(), lecture: new Set<string>() };
    for (const f of files) {
      const text = readFileSync(path.join(ROOT, f), 'utf8');
      for (const m of text.matchAll(/\b(course|lecture)\??\.([A-Za-z]+)/g))
        read[m[1] as 'course' | 'lecture'].add(m[2]);
      // const { title, no } = lecture のような取り出し方
      for (const m of text.matchAll(/\{([^}]+)\}\s*=\s*(course|lecture)\b/g))
        for (const k of m[1]
          .split(',')
          .map((x) => x.trim().split(/[:\s]/)[0])
          .filter(Boolean))
          read[m[2] as 'course' | 'lecture'].add(k);
    }
    expect([...read.course].filter((k) => !(COURSE_FIELDS as readonly string[]).includes(k)).sort()).toEqual([]);
    expect([...read.lecture].filter((k) => !(LECTURE_FIELDS as readonly string[]).includes(k)).sort()).toEqual([]);
    expect(read.course.size).toBeGreaterThan(5);
  });
});

describe('動画の描き方の側の指紋（render の src・動画の一覧の inputs.src）', () => {
  const world = () => {
    const root = tmp();
    for (const f of [
      'src/Lecture.tsx',
      'engine/core/theme.ts',
      'content/i18n.ts',
      'content/videos.ts',
      'content/themes.ts',
      'content/courses.ts',
      'content/ga4-comedy/G01.ts',
      'remotion.config.ts',
      'scripts/stages/video/render.ts',
      'scripts/stages/video/plan.ts',
      'scripts/stages/video/render.config.ts',
      'scripts/mix.py',
      'site/limits.ts',
      'site/template.html',
    ])
      put(root, f, `// ${f}`);
    put(
      root,
      'package-lock.json',
      JSON.stringify({
        packages: { 'node_modules/remotion': { version: '4.0.539' }, 'node_modules/zod': { version: '1' } },
      }),
    );
    return root;
  };
  const src = (root: string) => srcDigest(root, fileHasher(root, null));
  test('src/・engine/・訳とテーマの部品・Remotion の設定・書き出しの道具と設定・site/limits.ts・Remotion などの依存の版で変わる', () => {
    for (const f of [
      'src/Lecture.tsx',
      'engine/core/theme.ts',
      'content/i18n.ts',
      'content/videos.ts',
      'content/themes.ts',
      'remotion.config.ts',
      'scripts/stages/video/render.ts',
      'scripts/stages/video/plan.ts',
      'scripts/stages/video/render.config.ts',
      'site/limits.ts',
      'src/scenes/new.tsx',
    ]) {
      const root = world();
      const before = src(root);
      put(root, f, '// 直した');
      expect(`${f} ${src(root) !== before}`).toBe(`${f} true`);
    }
    const root = world();
    const before = src(root);
    put(root, 'package-lock.json', JSON.stringify({ packages: { 'node_modules/remotion': { version: '4.0.540' } } }));
    expect(src(root)).not.toBe(before);
  });
  test('手元の書体を読む道具と文字幅を測る道具の更新も、書き出しの指紋を変える', () => {
    for (const name of ['@remotion/fonts', '@remotion/layout-utils']) {
      const root = world();
      const lockFile = path.join(root, 'package-lock.json');
      const lock = JSON.parse(readFileSync(lockFile, 'utf8'));
      lock.packages[`node_modules/${name}`] = { version: '4.0.539' };
      put(root, 'package-lock.json', JSON.stringify(lock));
      const before = src(root);
      lock.packages[`node_modules/${name}`].version = '4.0.540';
      put(root, 'package-lock.json', JSON.stringify(lock));
      expect(src(root), name).not.toBe(before);
    }
  });
  test('講座の登録・台本のデータ・ほかの道具・サイトのひな形・ほかの依存では変わらない（CI の注意を増やさない）', () => {
    for (const f of ['content/courses.ts', 'content/ga4-comedy/G01.ts', 'scripts/mix.py', 'site/template.html']) {
      const root = world();
      const before = src(root);
      put(root, f, '// 直した');
      expect(`${f} ${src(root) === before}`).toBe(`${f} true`);
    }
    const root = world();
    const before = src(root);
    put(
      root,
      'package-lock.json',
      JSON.stringify({
        packages: { 'node_modules/remotion': { version: '4.0.539' }, 'node_modules/zod': { version: '2' } },
      }),
    );
    expect(src(root)).toBe(before);
  });
  test('動画とエンジンが読む外のパッケージを、依存の指紋に入れる', () => {
    const packages = new Set<string>();
    for (const file of listFiles(ROOT, ['src', 'engine']).filter((f) => /\.tsx?$/.test(f))) {
      const text = readFileSync(path.join(ROOT, file), 'utf8');
      for (const statement of parse(text, { sourceType: 'module', plugins: ['typescript', 'jsx'] }).program.body) {
        if (statement.type !== 'ImportDeclaration' && statement.type !== 'ExportNamedDeclaration' && statement.type !== 'ExportAllDeclaration') continue;
        const name = statement.source?.value;
        if (!name || name.startsWith('.')) continue;
        const parts = name.split('/');
        packages.add(parts[0].startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]);
      }
    }
    expect([...packages].filter((name) => !(RENDER_DEPS as readonly string[]).includes(name))).toEqual([]);
  });
  test('本物の作業フォルダでは、src/ と engine/ の全部の追跡ファイルを入れる', () => {
    const files = listFiles(ROOT, RENDER_CODE);
    const tracked = Bun.spawnSync(['git', 'ls-files', 'src', 'engine'], { cwd: ROOT })
      .stdout.toString()
      .trim()
      .split('\n');
    expect(tracked.filter((f) => !files.includes(f))).toEqual([]);
    for (const f of [
      'scripts/stages/video/render.ts',
      'scripts/stages/video/plan.ts',
      'scripts/stages/video/render.config.ts',
    ])
      expect(files).toContain(f);
  });
});

describe('道具のコード（import をたどる）', () => {
  test('synth.ts からたどると、時刻の計算・出力・timeline の形・動画の値・声と読みの部品が入り、講座のフォルダは入らない', () => {
    const files = codeFiles(ROOT, ['scripts/synth.ts']);
    for (const f of [
      'scripts/synth.ts',
      'scripts/stages/timeline/compute.ts',
      'scripts/stages/timeline/emit.ts',
      'scripts/stages/voice/store.ts',
      'scripts/voices.ts',
      'engine/core/timeline.ts',
      'engine/core/video-config.ts',
      'engine/core/voices.ts',
      'engine/core/reading.ts',
      'engine/core/i18n.ts',
    ])
      expect(files).toContain(f);
    expect(files.filter((f) => /^content\/[^/]+\//.test(f))).toEqual([]);
  });
  test('mix の道具のファイル（MIX_CODE）は、mix.py が import する Python の部品を全部含む', () => {
    const text = readFileSync(path.join(ROOT, 'scripts/mix.py'), 'utf8');
    const mods = [...text.matchAll(/^from audio\.(\w+) import/gm)].map((m) => `scripts/audio/${m[1]}.py`);
    expect(mods.length).toBeGreaterThan(0);
    for (const m of mods) expect(MIX_CODE as readonly string[]).toContain(m);
    for (const f of MIX_CODE) expect(`${f} ${existsSync(path.join(ROOT, f))}`).toBe(`${f} true`);
    // mix.py が読む BGM とジングルの名前
    for (const f of MUSIC_FILES) expect(text).toContain(`"${f}"`);
  });
  test('教材の出力の名前（docsFiles）は、build_materials.ts が作るファイルと同じ', () => {
    expect(docsFiles()).toEqual([...materialOutputs().keys()].map((f) => `docs/courses/${f}`).sort());
  });
});

/** 無音の WAV（48kHz・モノラル・16bit。samples サンプル） */
const wav = (samples: number) => {
  const data = Buffer.alloc(samples * 2);
  const head = Buffer.alloc(44);
  head.write('RIFF', 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write('WAVEfmt ', 8);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(48000, 24);
  head.writeUInt32LE(96000, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write('data', 36);
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
};

/** G01 の全部の台詞の偽の声を置いた、声の置き場所と作業フォルダ（timeline は本物を写す） */
const voiceWorld = () => {
  const root = tmp();
  const store = { cache: path.join(root, 'cache/tts'), local: path.join(root, '.work/tts') };
  const keys: string[] = [];
  for (const scene of video.lecture.scenes)
    for (const line of scene.lines) {
      const key = ttsKeysIn(speechIn(line, video.lang), line.v ?? 'narrator', video.lang)[0];
      keys.push(key);
      put(store.cache, `${key}.wav`, wav(4800));
      put(store.cache, `${key}.kana`, 'カナ');
    }
  put(
    root,
    timelineFile(video.course.id, video.key),
    readFileSync(path.join(ROOT, timelineFile(video.course.id, video.key))),
  );
  // 書き出しの出力（ポスターの置き場所）は、公開する言語で決まる
  put(root, 'chalkfile.config.ts', readFileSync(path.join(ROOT, 'chalkfile.config.ts')));
  const ctx = () => ({ root, hasher: fileHasher(root, null), store, runCommand: () => 0 });
  const stage = (name: string) => {
    const s = makeStages(ctx()).find((x) => x.name === name);
    if (!s) throw new Error(name);
    return s;
  };
  return { root, store, keys, stage };
};

describe('段の指紋（本物の段 voice・mix・render を、一時のフォルダで）', () => {
  test('voice: 台本・声の長さ・読みで変わり、声が 1 本でも無ければ「声が無い」', () => {
    const w = voiceWorld();
    const fp = w.stage('voice').fingerprint('G01');
    if (!('parts' in fp)) throw new Error(fp.missing);
    expect(Object.keys(fp.parts)).toEqual(['script', 'timing', 'voices', 'tool']);
    put(w.store.cache, `${w.keys[3]}.wav`, wav(4801));
    expect((w.stage('voice').fingerprint('G01') as { parts: Record<string, string> }).parts.voices).not.toBe(
      fp.parts.voices,
    );
    put(w.store.cache, `${w.keys[3]}.wav`, wav(4800));
    put(w.store.cache, `${w.keys[3]}.kana`, '別のカナ');
    expect((w.stage('voice').fingerprint('G01') as { parts: Record<string, string> }).parts.voices).not.toBe(
      fp.parts.voices,
    );
    rmSync(path.join(w.store.cache, `${w.keys[0]}.wav`));
    expect(w.stage('voice').fingerprint('G01')).toMatchObject({
      missing: expect.stringContaining('声が無い台詞が 1 本（s1-1'),
    });
  });
  test('voice の出力は timeline・設計図・読み・サイトの台本（訳の動画は聞き取りの対応も）', () => {
    const w = voiceWorld();
    expect(w.stage('voice').outputs('G01')).toEqual([
      'content/ga4-comedy/generated/timeline/G01.json',
      '.work/plan/G01.json',
      '.work/kana/G01.txt',
      'site/data/G01.json',
    ]);
    const tr = VIDEOS.find((v) => v.lang !== 'ja');
    if (tr) expect(w.stage('voice').outputs(tr.key)).toContain(`.work/speech/${tr.key}.json`);
  });
  test('mix: 設計図・声の中身・BGM と効果音で変わり、設計図が無ければ「設計図が無い」', () => {
    const w = voiceWorld();
    expect(w.stage('mix').fingerprint('G01')).toMatchObject({ missing: expect.stringContaining('設計図が無い') });
    put(
      w.root,
      '.work/plan/G01.json',
      JSON.stringify({ scenes: [{ lines: [{ file: `.work/tts/${w.keys[0]}.wav` }] }] }),
    );
    for (const f of MUSIC_FILES) put(w.root, `public/audio/music/${f}`, f);
    put(w.root, 'public/audio/sfx/pop.wav', 'pop');
    const fp = w.stage('mix').fingerprint('G01') as { parts: Record<string, string> };
    expect(Object.keys(fp.parts)).toEqual(['plan', 'voices', 'music', 'tool']);
    put(w.store.cache, `${w.keys[0]}.wav`, wav(10));
    const voices = (w.stage('mix').fingerprint('G01') as { parts: Record<string, string> }).parts;
    expect(voices.voices).not.toBe(fp.parts.voices);
    put(w.root, 'public/audio/sfx/pop.wav', 'pop2');
    expect((w.stage('mix').fingerprint('G01') as { parts: Record<string, string> }).parts.music).not.toBe(voices.music);
    put(w.root, '.work/plan/G01.json', JSON.stringify({ scenes: [] }));
    expect((w.stage('mix').fingerprint('G01') as { parts: Record<string, string> }).parts.plan).not.toBe(fp.parts.plan);
    // 声が共有のキャッシュに無ければ、作業フォルダの .work/tts を読む（mix.py の voice_file と同じ）
    put(w.root, '.work/plan/G01.json', JSON.stringify({ scenes: [{ lines: [{ file: '.work/tts/local.wav' }] }] }));
    expect(w.stage('mix').fingerprint('G01')).toMatchObject({ missing: expect.stringContaining('声が無い') });
    put(w.root, '.work/tts/local.wav', 'x');
    expect('parts' in w.stage('mix').fingerprint('G01')).toBe(true);
  });
  test('render: 台本の側は動画の一覧の inputs と同じ作り方。ミックスの音で変わり、音が無ければ空', () => {
    const w = voiceWorld();
    const r = w.stage('render');
    const fp = r.fingerprint('G01') as { parts: Record<string, string> };
    expect(fp.parts.script).toBe(base);
    expect(fp.parts.audio).toBe('');
    put(w.root, 'public/audio/mix/G01.wav', 'mix');
    const withAudio = r.fingerprint('G01') as { parts: Record<string, string> };
    expect(withAudio.parts.audio).toMatch(/^[0-9a-f]{16}$/);
    expect(withAudio.parts.src).toBe(currentInputs(w.root, video, srcDigest(w.root, fileHasher(w.root, null))).src);
    // 掛け合いの講座は字幕版も出力に入る（書き出しの道具が字幕版も作ってから記録する）
    expect(r.outputs('G01')).toEqual([
      'site/media/G01.mp4',
      'site/media/G01.cc.mp4',
      'content/ga4-comedy/generated/posters/G01.jpg',
    ]);
    expect(r.recordable).toBeUndefined();
    // 公開しない言語の動画のポスターは、講座のフォルダに置かない（site/media の写しだけ）
    const tr = VIDEOS.find((v) => !readSiteConfig().publishLangs.includes(v.lang));
    if (tr) expect(r.outputs(tr.key)).toContain(`site/media/${tr.key}.jpg`);
  });
  test('render: 記録が無くても、手元の動画が公開した動画の一覧の動画と同じなら、一覧の inputs を記録の代わりにする', () => {
    const w = voiceWorld();
    const list = readCourseMedia('ga4-comedy', 'ja', ROOT);
    if (!list) throw new Error('ga4-comedy の動画の一覧が無い');
    const src = srcDigest(w.root, fileHasher(w.root, null));
    const inputs = new Map(
      list.entries.filter((e) => e.lecture === 'G01').map((e) => [e.filename, { script: base, src }]),
    );
    put(w.root, mediaListFile('ga4-comedy', 'ja'), courseMediaJson(list, inputs));
    expect(w.stage('render').fallback?.('G01')).toBeNull();
    // 手元の動画の中身が一覧と同じ（ここでは、一覧の sha256 を偽の動画の sha256 に替えて確かめる）
    const fake = { standard: 'standard', captioned: 'captioned' } as const;
    const sha = (s: string) => new Bun.CryptoHasher('sha256').update(s).digest('hex');
    const entries = list.entries.map((e) =>
      e.lecture === 'G01'
        ? {
            ...e,
            sha256: sha(fake[e.kind]),
            bytes: fake[e.kind].length,
            filename: `G01${e.kind === 'captioned' ? '.cc' : ''}.${sha(fake[e.kind])}.mp4`,
          }
        : e,
    );
    const patched = { ...list, entries };
    put(
      w.root,
      mediaListFile('ga4-comedy', 'ja'),
      courseMediaJson(
        patched,
        new Map(entries.filter((e) => e.lecture === 'G01').map((e) => [e.filename, { script: base, src }])),
      ),
    );
    put(w.root, 'site/media/G01.mp4', fake.standard);
    put(w.root, 'site/media/G01.cc.mp4', fake.captioned);
    expect(w.stage('render').fallback?.('G01')).toMatchObject({
      partial: true,
      from: 'fallback',
      parts: { script: base, src },
    });
    // 公開した動画の比べ（CI の確かめと同じ）
    expect(publishedChecks(w.root, [video], src).map((c) => `${c.kind} ${c.result}`)).toEqual([
      'standard same',
      'captioned same',
    ]);
    expect(
      publishedChecks(w.root, [lectureWith((l) => Object.assign(l, { title: '別' }))], src).map((c) => c.result),
    ).toEqual(['script', 'script']);
    expect(publishedChecks(w.root, [video], 'ffffffffffffffff').map((c) => c.result)).toEqual(['src', 'src']);
  });
});

describe('段が流す道具（本物の段の run。道具は偽物の runCommand で受けるだけ）', () => {
  test('voice は synth.ts、mix は mix.py、render は書き出しの道具（全部の動画を 1 回で。並列の数は --jobs）、docs と site は全部', async () => {
    const calls: string[] = [];
    const stages = makeStages({
      root: ROOT,
      hasher: fileHasher(ROOT, null),
      store: { cache: tmp(), local: tmp() },
      runCommand: (argv, env = {}) => {
        calls.push(
          [
            ...Object.entries(env).map(([k, v]) => `${k}=${v}`),
            ...argv.slice(argv[0] === process.execPath ? 1 : 0),
          ].join(' '),
        );
        return 0;
      },
    });
    const run = (name: string, units: string[], o = {}) => stages.find((s) => s.name === name)?.run(units, o);
    await run('voice', ['G01', 'N01'], { cachedOnly: true });
    await run('mix', ['G01']);
    await run('render', ['G01', 'N01'], { jobs: 4 });
    await run('docs', ['docs']);
    await run('site', ['site']);
    expect(calls).toEqual([
      'scripts/synth.ts --cached-only G01 N01',
      'uv run --locked --group audio python scripts/mix.py G01',
      'scripts/stages/video/render.ts --jobs 4 G01 N01',
      'scripts/build_materials.ts',
      'scripts/build_site.ts',
    ]);
  });
});
