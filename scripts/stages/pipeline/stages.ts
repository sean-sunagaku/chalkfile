// 制作の段（voice → mix → render、voice → docs、voice → site）。どの段も、今ある道具を流す（中身は変えない）。
// 段の形と、状態の見方・組み立ては scripts/stages/pipeline/runner.ts。指紋に入れるもの（部分ごと）:
//   voice（声と時刻。scripts/synth.ts。単位は動画）
//     script  動画の台本（訳を重ねたレクチャーの全部の項目）と、講座の id・cast（サイトの台本の名前）
//     timing  timeline の指紋（engine/core/timeline.ts の timelineFingerprint。読み・声の設定・間・効果音・時刻の決め方）
//     voices  台詞ごとに見つけた声の鍵・長さ（サンプルの数と速さ）・読み（共有のキャッシュか .work/tts）
//     tool    synth.ts から import をたどったコード（content/ の講座のフォルダは入れない）
//   mix（音のミックス。scripts/mix.py。単位は動画）
//     plan    ミックスの設計図（.work/plan/<key>.json）の中身
//     voices  設計図の台詞の音声の中身（sha256）
//     music   BGM・ジングル・効果音（public/audio/music・sfx）の中身
//     tool    mix.py と、それが読む Python の部品・効果音の一覧・動画の値・依存の固定（pyproject.toml・uv.lock）
//   render（動画とポスター。scripts/stages/video/render.ts。単位は動画。書き出しは長いので、記録は書き出しの道具が動画ごとに書く）
//     script  台本の側（scripts/stages/video/inputs.ts。動画が描く台本の項目・テーマの値・クレジット・timeline）
//     src     描き方の側（src/・engine/ などのコードと、Remotion などの依存の版）。これだけが変わったときは、既定では書き出さない（--src）
//     audio   ミックスの音（public/audio/mix/<key>.wav）の中身
//   docs（読む教材。scripts/build_materials.ts。単位は全部の教材 1 つ）
//     course  教材を持つ講座（syllabus のある講座）の台本の全部、timelines その講座の timeline、tool build_materials.ts からたどったコード
//   site（講座サイト。scripts/build_site.ts。単位はサイト全体 1 つ）
//     content 全部の言語の講座の台本と一覧のページの抜き出し、data サイトの台本（site/data）、posters ポスター、
//     media 動画の一覧（Worker の許可リストと同じもの）、config chalkfile.config.ts と SITE_LANGS、
//     tool build_site.ts からたどったコード・site/ のひな形と画像・package-lock.json・bun の版
// 前の段の出力は、出力の中身（sha256）で入る。指紋に入れる値を変えたら、tests/pipeline-inputs.test.ts の決まりも直す
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { COURSES, coursesIn, VIDEOS, type Video } from '../../../content';
import type { CourseModule } from '../../../content/course-module';
import * as REGISTRY from '../../../content/courses';
import { LANGS } from '../../../content/i18n';
import { speechIn } from '../../../content/voices';
import { posterFile, timelineFile } from '../../../engine/core/generated';
import { timelineFingerprint } from '../../../engine/core/timeline';
import { readSiteConfig } from '../../lib/config';
import { runInherit } from '../../lib/proc';
import { wavFileSamples } from '../../lib/wav';
import { readMediaManifest } from '../../media';
import { mediaManifestJson, readCourseMediaFile } from '../../media-lists';
import { ttsKeysIn } from '../../voices';
import { findVoice, type VoiceStore } from '../voice/store';
import { readTimelineJson, scriptDigest, srcDigest } from '../video/inputs';
import { videoFiles } from '../video/plan';
import { codeFiles, commandVersion, digest, filesDigest, listFiles, sha256Text } from './digest';
import type { Ctx, Recorded, RunOptions, Stage } from './runner';

/** 段の名前（流す順） */
export const STAGE_NAMES = ['voice', 'mix', 'render', 'docs', 'site'] as const;

/** 子のプロセスで道具を流す（テストは偽物に替える）。終了コードを返す */
export type RunCommand = (argv: string[], env?: Record<string, string>) => number;

export type StagesCtx = Ctx & {
  /** 声の置き場所（共有のキャッシュと .work/tts） */
  store: VoiceStore;
  env?: NodeJS.ProcessEnv;
  runCommand?: RunCommand;
};

/** mix.py が読むファイル（Python の部品・効果音の一覧・動画の値・依存の固定） */
export const MIX_CODE = [
  'scripts/mix.py',
  'scripts/audio/__init__.py',
  'scripts/audio/common.py',
  'scripts/audio/handoff.py',
  'scripts/audio/sfx.json',
  'scripts/audio/video_config.json',
  'pyproject.toml',
  'uv.lock',
] as const;
/** mix.py が読む BGM とジングル（public/audio/music/） */
export const MUSIC_FILES = ['bed.wav', 'sting_intro.wav', 'sting_outro.wav'] as const;

const TTS_PREFIX = '.work/tts/';

/** 設計図に書いた音声の名前の、今ある場所（scripts/audio/common.py の voice_file と同じ。先に共有のキャッシュ、無ければ作業フォルダ） */
export const voiceFileOf = (root: string, store: VoiceStore, rel: string): string => {
  if (!path.isAbsolute(rel) && rel.startsWith(TTS_PREFIX)) {
    const cached = path.join(store.cache, rel.slice(TTS_PREFIX.length));
    if (existsSync(cached)) return cached;
  }
  return path.resolve(root, rel);
};

/** フォルダの中のファイル（. で始まる名前も入れる。無ければ空） */
const filesUnder = (root: string, rel: string): string[] => {
  const abs = path.join(root, rel);
  if (!existsSync(abs)) return [];
  return readdirSync(abs, { recursive: true })
    .map(String)
    .filter((f) => statSync(path.join(abs, f)).isFile())
    .map((f) => `${rel}/${f.split(path.sep).join('/')}`)
    .sort();
};

/** 教材のファイル（build_materials.ts の materialOutputs と同じ名前。tests/pipeline-inputs.test.ts が照らす） */
export const docsFiles = (): string[] => {
  const courses = COURSES.filter((c) => c.syllabus);
  if (!courses.length) return [];
  return [
    'docs/courses/README.md',
    ...courses.flatMap((c) => [
      `docs/courses/${c.id}/README.md`,
      ...c.lectures.flatMap((l) => (l.material ? [`docs/courses/${c.id}/${l.material.id}.md`] : [])),
      `docs/courses/${c.id}/chunks.jsonl`,
    ]),
  ].sort();
};

/** 公開した動画の一覧の記録（inputs）を、書き出しの記録の代わりにする。手元の動画が一覧の動画と同じときだけ */
const publishedRecord = (ctx: StagesCtx, v: Video): Recorded | null => {
  const list = readCourseMediaFile(v.course.id, v.lang, ctx.root);
  if (!list) return null;
  const entries = list.manifest.entries.filter((e) => e.lecture === v.lecture.id);
  const standard = entries.find((e) => e.kind === 'standard');
  const inputs = standard ? list.inputs.get(standard.filename) : undefined;
  if (!standard || !inputs) return null;
  const outputs: Recorded['outputs'] = {};
  for (const e of entries) {
    const file = `site/media/${v.key}${e.kind === 'captioned' ? '.cc' : ''}.mp4`;
    if (ctx.hasher.sha256(file) !== e.sha256) return null;
    outputs[file] = { sha256: e.sha256, bytes: e.bytes };
  }
  return { parts: { script: inputs.script, src: inputs.src }, outputs, partial: true, from: 'fallback' };
};

/** 本物の段（voice・mix・render・docs・site） */
export const makeStages = (ctx: StagesCtx): Stage[] => {
  const { root, hasher, store } = ctx;
  const env = ctx.env ?? process.env;
  const runCommand: RunCommand =
    ctx.runCommand ??
    ((argv, more = {}) => runInherit(argv[0], argv.slice(1), { cwd: root, env: { ...env, ...more } }));
  const videos = new Map(VIDEOS.map((v) => [v.key, v]));
  const video = (key: string): Video => {
    const v = videos.get(key);
    if (!v) throw new Error(`動画が無い: ${key}`);
    return v;
  };
  const memo = new Map<string, string>();
  const once = (name: string, make: () => string) => {
    if (!memo.has(name)) memo.set(name, make());
    return memo.get(name) as string;
  };
  /** 道具のコード（入口から import をたどったファイル）と、足すファイルの指紋 */
  const code = (name: string, entries: string[], extra: readonly string[] = []) =>
    once(`code:${name}`, () => filesDigest([...new Set([...codeFiles(root, entries), ...extra])], hasher));
  const sha16 = (file: string) => hasher.sha256(file)?.slice(0, 16) ?? null;

  const voice: Stage = {
    name: 'voice',
    label: '声と時刻（synth）',
    needs: [],
    unrecorded: 'run',
    units: (t) => [...t.keys],
    deps: () => [],
    fingerprint: (key) => {
      const v = video(key);
      const found: unknown[] = [];
      const lacking: string[] = [];
      try {
        for (const [si, scene] of v.lecture.scenes.entries())
          for (const [li, line] of scene.lines.entries()) {
            const at = `s${si + 1}-${li + 1}`;
            const hit = findVoice(store, ttsKeysIn(speechIn(line, v.lang), line.v ?? 'narrator', v.lang));
            if (!hit) {
              lacking.push(at);
              continue;
            }
            try {
              const { samples, rate } = wavFileSamples(path.join(hit.dir, `${hit.key}.wav`));
              found.push([hit.key, samples, rate, sha256Text(readFileSync(path.join(hit.dir, `${hit.key}.kana`)))]);
            } catch {
              lacking.push(`${at}（音声が壊れている）`);
            }
          }
      } catch (e) {
        return { missing: `読めない台詞がある（${e instanceof Error ? e.message : String(e)}）` };
      }
      if (lacking.length)
        return {
          missing: `声が無い台詞が ${lacking.length} 本（${lacking.slice(0, 3).join('・')}。VOICEVOX で合成するか、bun scripts/materials.ts pull）`,
        };
      return {
        parts: {
          script: digest({ key, lang: v.lang, course: { id: v.course.id, cast: v.course.cast }, lecture: v.lecture }),
          timing: timelineFingerprint(v.lecture, v.lang),
          voices: digest(found),
          tool: code('voice', ['scripts/synth.ts']),
        },
      };
    },
    outputs: (key) => {
      const v = video(key);
      return [
        timelineFile(v.course.id, key),
        `.work/plan/${key}.json`,
        `.work/kana/${key}.txt`,
        ...(v.lang === 'ja' ? [] : [`.work/speech/${key}.json`]),
        `site/data/${key}.json`,
      ];
    },
    run: (keys, o: RunOptions) =>
      runCommand([process.execPath, 'scripts/synth.ts', ...(o.cachedOnly ? ['--cached-only'] : []), ...keys]),
    tools: () => ({ bun: Bun.version }),
  };

  const mix: Stage = {
    name: 'mix',
    label: '音のミックス（mix.py）',
    needs: ['voice'],
    unrecorded: 'run',
    units: (t) => [...t.keys],
    deps: (key) => [{ stage: 'voice', unit: key }],
    fingerprint: (key) => {
      const planFile = `.work/plan/${key}.json`;
      const plan = sha16(planFile);
      if (!plan) return { missing: 'ミックスの設計図が無い（先に voice）' };
      let files: string[];
      try {
        const p = JSON.parse(readFileSync(path.join(root, planFile), 'utf8')) as {
          scenes: { lines: { file: string }[] }[];
        };
        files = p.scenes.flatMap((s) => s.lines.map((l) => l.file));
      } catch {
        return { missing: 'ミックスの設計図が読めない（voice を流し直す）' };
      }
      const voices = files.map((f) => [f, hasher.sha256(voiceFileOf(root, store, f))]);
      const lacking = voices.filter(([, sha]) => sha === null);
      if (lacking.length) return { missing: `声が無い台詞が ${lacking.length} 本（bun scripts/materials.ts pull）` };
      const music = [
        ...MUSIC_FILES.map((f) => `public/audio/music/${f}`),
        ...filesUnder(root, 'public/audio/sfx').filter((f) => f.endsWith('.wav')),
      ].map((f) => [f, hasher.sha256(f)]);
      if (music.some(([, sha]) => sha === null))
        return { missing: 'BGM・効果音が無い（bun scripts/materials.ts pull）' };
      return {
        parts: {
          plan,
          voices: digest(voices),
          music: digest(music),
          tool: once('code:mix', () => filesDigest(MIX_CODE, hasher)),
        },
      };
    },
    outputs: (key) => [`public/audio/mix/${key}.wav`],
    run: (keys) => runCommand(['uv', 'run', '--locked', '--group', 'audio', 'python', 'scripts/mix.py', ...keys]),
    tools: () => ({ ffmpeg: commandVersion('ffmpeg') }),
  };

  const captioned = (key: string) => Boolean(video(key).course.cast);
  let langs: readonly string[] | null = null;
  /** 公開する言語（chalkfile.config.ts の publishLangs。ポスターを講座のフォルダに置く言語） */
  const publishLangs = () => {
    langs ??= readSiteConfig().publishLangs;
    return langs;
  };
  const render: Stage = {
    name: 'render',
    label: '動画とポスター（render.ts）',
    needs: ['mix'],
    unrecorded: 'keep',
    advisory: ['src'],
    selfRecord: true,
    units: (t) => [...t.keys],
    deps: (key) => [
      { stage: 'voice', unit: key },
      { stage: 'mix', unit: key },
    ],
    fingerprint: (key) => {
      const v = video(key);
      const timeline = readTimelineJson(root, v);
      if (timeline === null) return { missing: 'timeline が無い（先に voice）' };
      // ミックスの音が無いときは空にする（記録と比べると「無い」になる。公開した動画の記録は、音を比べない）
      const audio = sha16(`public/audio/mix/${key}.wav`) ?? '';
      return { parts: { script: scriptDigest(v, timeline), src: once('src', () => srcDigest(root, hasher)), audio } };
    },
    // サイト用の動画とポスター（公開する言語の動画は講座のフォルダのポスター。site/media/<key>.jpg はその写しなので入れない。
    // ほかの言語の動画は、ポスターを site/media/<key>.jpg にだけ置く）。out/ の高画質の書き出しは入れない
    outputs: (key) => {
      const f = videoFiles(video(key), publishLangs());
      return [f.site, ...(captioned(key) ? [f.siteCc] : []), f.poster ?? f.sitePoster];
    },
    fallback: (key) => publishedRecord(ctx, video(key)),
    keepMissing: (key) => {
      const v = video(key);
      const list = readCourseMediaFile(v.course.id, v.lang, root);
      return list?.manifest.entries.some((e) => e.lecture === v.lecture.id)
        ? `公開した動画が手元に無い（取り出すなら bun scripts/media.ts pull ${v.course.id}。書き出すなら --force）`
        : null;
    },
    // 字幕版を作るかは、書き出しの道具が講座で決める（掛け合いの講座は作る）。バンドルを 1 回で済ませるので、全部の動画を 1 回で渡す
    run: (keys, o: RunOptions) =>
      runCommand([
        process.execPath,
        'scripts/stages/video/render.ts',
        ...(o.jobs ? ['--jobs', String(o.jobs)] : []),
        ...keys,
      ]),
    tools: () => ({ bun: Bun.version, ffmpeg: commandVersion('ffmpeg') }),
  };

  const docsCourses = () => COURSES.filter((c) => c.syllabus);
  const docs: Stage = {
    name: 'docs',
    label: '読む教材（build_materials）',
    needs: ['voice'],
    unrecorded: 'run',
    units: () => (docsCourses().length ? ['docs'] : []),
    deps: () => docsCourses().flatMap((c) => c.lectures.map((l) => ({ stage: 'voice', unit: l.id }))),
    fingerprint: () => {
      const courses = docsCourses();
      return {
        parts: {
          course: digest(courses),
          timelines: digest(courses.flatMap((c) => c.lectures.map((l) => [l.id, sha16(timelineFile(c.id, l.id))]))),
          tool: code('docs', ['scripts/build_materials.ts']),
        },
      };
    },
    outputs: () => docsFiles(),
    run: () => runCommand([process.execPath, 'scripts/build_materials.ts']),
    tools: () => ({ bun: Bun.version }),
  };

  const site: Stage = {
    name: 'site',
    label: '講座サイト（build_site）',
    needs: ['voice'],
    unrecorded: 'run',
    units: () => ['site'],
    deps: () => {
      const langs: string[] = readSiteConfig().publishLangs;
      return VIDEOS.filter((v) => langs.includes(v.lang)).map((v) => ({ stage: 'voice', unit: v.key }));
    },
    fingerprint: () => {
      let media: string;
      try {
        media = digest(mediaManifestJson(readMediaManifest(root)));
      } catch (e) {
        return { missing: `動画の一覧が読めない（${e instanceof Error ? e.message : String(e)}）` };
      }
      const modules = Object.values(REGISTRY) as CourseModule[];
      return {
        parts: {
          content: digest({
            courses: LANGS.map((l) => [l, coursesIn(l)]),
            hero: modules.map((m) => [m.course.id, m.heroSnippet ?? null]),
          }),
          data: digest(VIDEOS.map((v) => [v.key, hasher.sha256(`site/data/${v.key}.json`)])),
          posters: digest(
            VIDEOS.map((v) => [
              v.key,
              hasher.sha256(posterFile(v.course.id, v.key)) ?? hasher.sha256(`site/media/${v.key}.jpg`),
            ]),
          ),
          media,
          config: digest({ config: hasher.sha256('chalkfile.config.ts'), langs: env.SITE_LANGS ?? '' }),
          tool: digest({
            code: code('site', ['scripts/build_site.ts'], [...listFiles(root, ['site']), 'package-lock.json']),
            bun: Bun.version,
          }),
        },
      };
    },
    outputs: () => {
      const files = filesUnder(root, 'site/dist');
      return files.length ? files : ['site/dist/index.html'];
    },
    run: () => runCommand([process.execPath, 'scripts/build_site.ts']),
    tools: () => ({ bun: Bun.version }),
  };

  return [voice, mix, render, docs, site];
};
