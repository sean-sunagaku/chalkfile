// 音声の鍵・読み・訳の指紋のスナップショット。声の一覧を動かす・読みの辞書を分ける・指紋や鍵の作り方を見直すときに、
// 全台詞の音声ファイルの名前（鍵）・読み・訳の指紋が黙って変わらないようにする網（tests/speech-snapshot.test.ts が照らし合わせる）。
// 鍵が変わると素材のブランチの音声が当たらなくなり（CI の synth.ts --cached-only で公開が止まる）、指紋が変わると訳が stale になる。
//   bun scripts/snapshots.ts            # 今の台本とスナップショットを比べる（違いを動画と台詞ごとに出す。違えば 1 で終わる）
//   bun scripts/snapshots.ts --update   # 作り直す（わざと変えたときだけ。作り直したら、PR に「合成し直しが要る」と書く）
// 置き場所と形は tests/fixtures/snapshots/README.md
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { LECTURES, VIDEOS, type Video } from '../content';
import { LANGS, parseVideoKey, type Lang } from '../content/i18n';
import type { VoiceId } from '../content/types';
import { fingerprint } from './i18n';
import { creditsIn, speechIn, ttsKeyIn } from './voices';

const ROOT = path.resolve(import.meta.dir, '..');
export const SNAPSHOT_DIR = path.join(ROOT, 'tests/fixtures/snapshots');

/** 台詞 1 つ。at は synth.ts の読みの記録（.work/kana）と同じ「s<場面>-<台詞>」 */
export type LineValue = { at: string; voice: VoiceId; key: string; speech: string };
/** 動画 1 本。fingerprint は scripts/i18n.ts の stamp が訳のファイルに書く値（訳の動画も、元の日本語の台本から求める） */
export type VideoValue = { video: string; fingerprint: string; credits: string[]; lines: LineValue[] };

/** 全部の動画（日本語の全講座と全部の訳）の値。synth.ts と同じ関数・同じ選び方（声は v か先生、読みは speechIn、鍵は ttsKeyIn）で求める */
export const speechValues = (videos: Video[] = VIDEOS): VideoValue[] =>
  videos.map(({ key, lang, lecture }) => {
    const lines = lecture.scenes.flatMap((scene, si) =>
      scene.lines.map((line, li): LineValue => {
        const voice = line.v ?? 'narrator';
        const speech = speechIn(line, lang);
        return { at: `s${si + 1}-${li + 1}`, voice, key: ttsKeyIn(speech, voice, lang), speech };
      }),
    );
    const ja = LECTURES.find((l) => l.id === lecture.id);
    if (!ja) throw new Error(`日本語の台本が無い: ${key}`);
    return { video: key, fingerprint: fingerprint(ja), credits: creditsIn(lang, lines.map((l) => l.voice)), lines };
  });

/* ───────────── 置く形 ───────────── */

/** 動画 1 本のファイル（videos/<動画>.json）。台詞は「<場面>-<台詞> <声> <鍵> <読みのハッシュ>」の 1 行（台本の文はもう 1 か所に写さない） */
export type VideoFile = { video: string; fingerprint: string; credits: string[]; lines: string[] };
/** 全体（summary.json）。数と、値の種類ごとの全体のハッシュ */
export type Summary = {
  counts: { videos: number; lines: number; keys: number; byLang: Record<string, { videos: number; lines: number }> };
  hashes: Record<'keys' | 'speech' | 'fingerprints' | 'credits', string>;
};
export type Snapshot = { summary?: Summary; videos: Map<string, VideoFile> };

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const speechHash = (s: string) => sha256(s).slice(0, 12);
const byVideo = (a: { video: string }, b: { video: string }) => (a.video < b.video ? -1 : a.video > b.video ? 1 : 0);
const langOf = (video: string): Lang => parseVideoKey(video).lang;

export const summaryOf = (values: VideoValue[]): Summary => {
  const sorted = [...values].sort(byVideo);
  // 鍵の一覧は並べ替えて重なりを除く（素材のブランチと .work/tts に要る音声の一覧と同じ）
  const keys = [...new Set(sorted.flatMap((v) => v.lines.map((l) => l.key)))].sort();
  const mine = (lang: Lang) => sorted.filter((v) => langOf(v.video) === lang);
  return {
    counts: {
      videos: sorted.length,
      lines: sorted.reduce((n, v) => n + v.lines.length, 0),
      keys: keys.length,
      byLang: Object.fromEntries(LANGS.map((lang) => [lang, { videos: mine(lang).length, lines: mine(lang).reduce((n, v) => n + v.lines.length, 0) }])),
    },
    hashes: {
      keys: sha256(keys.join('\n')),
      speech: sha256(sorted.flatMap((v) => v.lines.map((l) => `${v.video} ${l.at} ${l.speech}`)).join('\n')),
      fingerprints: sha256(sorted.map((v) => `${v.video} ${v.fingerprint}`).join('\n')),
      credits: sha256(sorted.map((v) => `${v.video} ${v.credits.join(', ')}`).join('\n')),
    },
  };
};

export const snapshotOf = (values: VideoValue[]): Snapshot => ({
  summary: summaryOf(values),
  videos: new Map(
    [...values]
      .sort(byVideo)
      .map((v) => [v.video, { video: v.video, fingerprint: v.fingerprint, credits: v.credits, lines: v.lines.map((l) => `${l.at} ${l.voice} ${l.key} ${speechHash(l.speech)}`) }]),
  ),
});

/** JSON はキーを並べて整形し、最後に改行（作り直しても同じバイトになり、差分は変わった台詞の行だけになる） */
const sortKeys = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(sortKeys)
    : v && typeof v === 'object'
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, x]) => [k, sortKeys(x)]))
      : v;
const toJson = (v: unknown) => `${JSON.stringify(sortKeys(v), null, 2)}\n`;

export const readSnapshot = (dir = SNAPSHOT_DIR): Snapshot => {
  const videos = new Map<string, VideoFile>();
  const videoDir = path.join(dir, 'videos');
  for (const f of existsSync(videoDir) ? readdirSync(videoDir).filter((x) => x.endsWith('.json')) : []) {
    const v = JSON.parse(readFileSync(path.join(videoDir, f), 'utf8')) as VideoFile;
    if (`${v.video}.json` !== f) throw new Error(`スナップショットのファイル名と中身が合わない: videos/${f}（中身は ${v.video}）`);
    videos.set(v.video, v);
  }
  const summary = path.join(dir, 'summary.json');
  return { summary: existsSync(summary) ? (JSON.parse(readFileSync(summary, 'utf8')) as Summary) : undefined, videos };
};

export const writeSnapshot = (values: VideoValue[], dir = SNAPSHOT_DIR) => {
  const snap = snapshotOf(values);
  const videoDir = path.join(dir, 'videos');
  mkdirSync(videoDir, { recursive: true });
  // 無くなった動画のファイルを消す（README.md など、動画のファイル以外には触らない）
  for (const f of readdirSync(videoDir)) if (f.endsWith('.json') && !snap.videos.has(f.slice(0, -'.json'.length))) rmSync(path.join(videoDir, f));
  for (const [video, v] of snap.videos) writeFileSync(path.join(videoDir, `${video}.json`), toJson(v));
  writeFileSync(path.join(dir, 'summary.json'), toJson(snap.summary));
};

/* ───────────── 比べる ───────────── */

export type Category = 'videos' | 'keys' | 'speech' | 'fingerprints' | 'credits' | 'summary';
/** 値の種類ごとの見出しと、変わったときに要ること（テストと、このスクリプトの表示に使う） */
export const MEANING: Record<Category, { title: string; then: string }> = {
  videos: { title: '動画が増えた・減った', then: '台本を足した・消したなら --update で作り直す（新しい動画は、PR に「合成し直しが要る」と書く）' },
  keys: { title: '音声の鍵（音声ファイルの名前）が変わった', then: '素材の音声が当たらなくなる。わざと変えたなら --update で作り直し、PR に「合成し直しが要る」と書く' },
  speech: { title: '読み（VOICEVOX・Kokoro に渡す文）が変わった', then: '鍵も変わる。わざと変えたなら --update で作り直し、PR に「合成し直しが要る」と書く' },
  fingerprints: { title: '訳の指紋（日本語の台本の指紋）が変わった', then: 'その台本の訳が stale になる（合成は要らない）。わざと変えたなら --update で作り直し、訳がある台本は訳を見直して bun scripts/i18n.ts stamp' },
  credits: { title: '動画の終わりのクレジットが変わった', then: '動画の書き出し直しが要る（音声は同じ）。わざと変えたなら --update で作り直す' },
  summary: { title: '全体の数・ハッシュが変わった', then: 'ほかの違いを先に見る。ほかに違いが無いなら summary.json が動画のファイルと合っていない（手で直さず --update で作り直す）' },
};
export type Differences = { found: Record<Category, string[]>; resynth: string[] };

/** 1 本の動画で出す台詞の数（ほかは数だけ出す） */
const SHOW = 5;
const quote = (s: string) => (s.length > 40 ? `${s.slice(0, 40)}…` : s);
const block = (video: string, items: string[]) => [
  `${video}（${items.length} 台詞）`,
  ...items.slice(0, SHOW).map((x) => `  ${x}`),
  ...(items.length > SHOW ? [`  …ほか ${items.length - SHOW} 台詞`] : []),
];

/** 置いたスナップショットと今の値の違い。変わった動画と台詞（何番目・どの値）を、値の種類ごとに文にする */
export const differences = (saved: Snapshot, values: VideoValue[]): Differences => {
  const found: Record<Category, string[]> = { videos: [], keys: [], speech: [], fingerprints: [], credits: [], summary: [] };
  const resynth = new Set<string>();
  const now = new Map(values.map((v) => [v.video, v]));
  for (const v of [...values].sort(byVideo)) {
    const old = saved.videos.get(v.video);
    if (!old) {
      found.videos.push(`${v.video}: 新しい動画（スナップショットに無い。台詞 ${v.lines.length}）`);
      resynth.add(v.video);
      continue;
    }
    if (old.fingerprint !== v.fingerprint) found.fingerprints.push(`${v.video}: ${old.fingerprint} → ${v.fingerprint}${langOf(v.video) === 'ja' ? '' : `（元の日本語の台本 ${parseVideoKey(v.video).id}）`}`);
    if (old.credits.join('\n') !== v.credits.join('\n')) found.credits.push(`${v.video}: ${old.credits.join('、')} → ${v.credits.join('、')}`);
    const before = new Map(
      old.lines.map((s) => {
        const [at, voice, key, speech] = s.split(' ');
        return [at, { voice, key, speech }];
      }),
    );
    const keys: string[] = [];
    const speech: string[] = [];
    for (const l of v.lines) {
      const b = before.get(l.at);
      if (!b) {
        keys.push(`${l.at} [${l.voice}] 台詞が増えた（${l.key}）`);
        speech.push(`${l.at} [${l.voice}] 台詞が増えた「${quote(l.speech)}」`);
        continue;
      }
      const sameSpeech = b.speech === speechHash(l.speech);
      if (b.key !== l.key) keys.push(`${l.at} [${l.voice}] ${b.key} → ${l.key}（${!sameSpeech ? '読みが変わった' : b.voice !== l.voice ? `声が ${b.voice} から変わった` : '読みと声は同じ。声の設定が変わった'}）`);
      if (!sameSpeech) speech.push(`${l.at} [${l.voice}] 今の読み「${quote(l.speech)}」`);
    }
    const at = new Set(v.lines.map((l) => l.at));
    for (const a of before.keys()) {
      if (at.has(a)) continue;
      keys.push(`${a} 台詞が無くなった`);
      speech.push(`${a} 台詞が無くなった`);
    }
    if (keys.length) {
      found.keys.push(...block(v.video, keys));
      resynth.add(v.video);
    }
    if (speech.length) found.speech.push(...block(v.video, speech));
  }
  for (const video of [...saved.videos.keys()].sort()) if (!now.has(video)) found.videos.push(`${video}: 動画が無くなった`);
  const s = summaryOf(values);
  if (!saved.summary) found.summary.push('summary.json が無い');
  else {
    const c = saved.summary.counts;
    const counts: [string, number | undefined, number][] = [
      ['動画', c.videos, s.counts.videos],
      ['台詞', c.lines, s.counts.lines],
      ['鍵（重なりなし）', c.keys, s.counts.keys],
    ];
    for (const [name, from, to] of counts) if (from !== to) found.summary.push(`${name}の数: ${from} → ${to}`);
    for (const [name, to] of Object.entries(s.hashes)) {
      const from = saved.summary.hashes[name as keyof Summary['hashes']];
      if (from !== to) found.summary.push(`全体の ${name}: ${from} → ${to}`);
    }
  }
  return { found, resynth: [...resynth].sort() };
};

/** 違いを表示用の行にする（違いが無ければ空） */
export const report = ({ found }: Differences): string[] =>
  (Object.keys(MEANING) as Category[]).flatMap((c) => (found[c].length ? [`■ ${MEANING[c].title}`, ...found[c].map((x) => `  ${x}`), `  → ${MEANING[c].then}`] : []));

/* ───────────── 実行 ───────────── */

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.some((a) => a !== '--update')) {
    console.error('使い方: bun scripts/snapshots.ts [--update]（--update はスナップショットを作り直す）');
    process.exit(1);
  }
  const values = speechValues();
  const diff = differences(readSnapshot(), values);
  const lines = report(diff);
  const { counts } = summaryOf(values);
  const size = `動画 ${counts.videos} 本（${LANGS.map((l) => `${l} ${counts.byLang[l].videos}`).join('・')}）・台詞 ${counts.lines}・鍵 ${counts.keys}`;
  for (const l of lines) console.log(l);
  if (args.includes('--update')) {
    writeSnapshot(values);
    console.log(`${lines.length ? '作り直した' : '変わっていない（書き直しただけ）'}: ${path.relative(ROOT, SNAPSHOT_DIR)}（${size}）`);
    if (diff.resynth.length) console.log(`PR に「合成し直しが要る」と書く。鍵が変わった・増えた動画: ${diff.resynth.join(' ')}`);
  } else {
    console.log(lines.length ? `スナップショットと違う。わざと変えたなら bun scripts/snapshots.ts --update（${size}）` : `スナップショットと同じ（${size}）`);
    process.exit(lines.length ? 1 : 0);
  }
}
