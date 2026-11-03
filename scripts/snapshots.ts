// 音声の鍵・読み・訳の指紋のスナップショット。声の一覧を動かす・読みの辞書を分ける・指紋や鍵の作り方を見直すときに、
// 全台詞の音声ファイルの名前（鍵）・読み・訳の指紋が黙って変わらないようにする網（tests/speech-snapshot.test.ts が照らし合わせる）。
// 鍵が変わると素材のブランチの音声が当たらなくなり（CI の synth.ts --cached-only で公開が止まる）、指紋が変わると訳が stale になる。
//   bun scripts/snapshots.ts            # 今の台本とスナップショットを比べる（違いを動画と台詞ごとに出す。違えば 1 で終わる）
//   bun scripts/snapshots.ts --update   # 作り直す（わざと変えたときだけ。作り直したら、PR に「合成し直しが要る」と書く）
// 置き場所と形は tests/fixtures/snapshots/README.md。動画 1 本に 1 ファイルで、全体の値（鍵の一覧など）は置かずにファイルから求める
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { LECTURES, VIDEOS, type Video } from '../content';
import { LANGS, parseVideoKey } from '../content/i18n';
import type { VoiceId } from '../content/types';
import { fingerprint } from './i18n';
import { creditsIn, speechIn, ttsKeyIn } from './voices';

const ROOT = path.resolve(import.meta.dir, '..');
export const SNAPSHOT_DIR = path.join(ROOT, 'tests/fixtures/snapshots');

/** 台詞 1 つ。at は synth.ts の読みの記録（.work/kana）と同じ「s<場面>-<台詞>」 */
export type LineValue = { at: string; voice: VoiceId; key: string; speech: string };
/**
 * 動画 1 本。fingerprint は訳の指紋（scripts/i18n.ts の stamp が訳のファイルに書く、日本語の台本の指紋）で、訳がある動画だけが持つ。
 * 訳の動画と、その元の日本語の動画。訳の無い台本は、画面の文字を直しても困らないので見ない
 */
export type VideoValue = { video: string; fingerprint?: string; credits: string[]; lines: LineValue[] };

/** 全部の動画（日本語の全講座と全部の訳）の値。synth.ts と同じ関数・同じ選び方（声は v か先生、読みは speechIn、鍵は ttsKeyIn）で求める */
export const speechValues = (videos: Video[] = VIDEOS): VideoValue[] => {
  const translated = new Set(videos.filter((v) => v.lang !== 'ja').map((v) => v.lecture.id));
  return videos.map(({ key, lang, lecture }) => {
    const lines = lecture.scenes.flatMap((scene, si) =>
      scene.lines.map((line, li): LineValue => {
        const voice = line.v ?? 'narrator';
        const speech = speechIn(line, lang);
        return { at: `s${si + 1}-${li + 1}`, voice, key: ttsKeyIn(speech, voice, lang), speech };
      }),
    );
    const ja = LECTURES.find((l) => l.id === lecture.id);
    if (!ja) throw new Error(`日本語の台本が無い: ${key}`);
    return { video: key, ...(translated.has(lecture.id) ? { fingerprint: fingerprint(ja) } : {}), credits: creditsIn(lang, lines.map((l) => l.voice)), lines };
  });
};

/* ───────────── 置く形 ───────────── */

/** 動画 1 本のファイル（videos/<動画>.json）。台詞は「<場面>-<台詞> <声> <鍵> <読みのハッシュ>」の 1 行（台本の文はもう 1 か所に写さない） */
export type VideoFile = { video: string; fingerprint?: string; credits: string[]; lines: string[] };
/** 動画の名前 → ファイルの中身 */
export type Snapshot = Map<string, VideoFile>;

const speechHash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 12);
const byName = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const keyOf = (line: string) => line.split(' ')[2];

export const snapshotOf = (values: VideoValue[]): Snapshot =>
  new Map(
    [...values]
      .sort((a, b) => byName(a.video, b.video))
      .map((v) => [
        v.video,
        { video: v.video, ...(v.fingerprint ? { fingerprint: v.fingerprint } : {}), credits: v.credits, lines: v.lines.map((l) => `${l.at} ${l.voice} ${l.key} ${speechHash(l.speech)}`) },
      ]),
  );

/** 全部の動画の鍵（並べ替えて重なりを除く。素材のブランチと .work/tts に要る音声の一覧と同じ）。全体の値は置かず、こうしてファイルから求める */
export const snapshotKeys = (snap: Snapshot): string[] => [...new Set([...snap.values()].flatMap((v) => v.lines.map(keyOf)))].sort();

/** JSON はキーを並べて整形し、最後に改行（作り直しても同じバイトになり、差分は変わった台詞の行だけになる） */
const sortKeys = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(sortKeys)
    : v && typeof v === 'object'
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => byName(a, b)).map(([k, x]) => [k, sortKeys(x)]))
      : v;
const toJson = (v: unknown) => `${JSON.stringify(sortKeys(v), null, 2)}\n`;

export const readSnapshot = (dir = SNAPSHOT_DIR): Snapshot => {
  const snap: Snapshot = new Map();
  const videoDir = path.join(dir, 'videos');
  for (const f of existsSync(videoDir) ? readdirSync(videoDir).filter((x) => x.endsWith('.json')).sort() : []) {
    const v = JSON.parse(readFileSync(path.join(videoDir, f), 'utf8')) as VideoFile;
    if (`${v.video}.json` !== f) throw new Error(`スナップショットのファイル名と中身が合わない: videos/${f}（中身は ${v.video}）`);
    snap.set(v.video, v);
  }
  return snap;
};

export const writeSnapshot = (values: VideoValue[], dir = SNAPSHOT_DIR) => {
  const snap = snapshotOf(values);
  const videoDir = path.join(dir, 'videos');
  mkdirSync(videoDir, { recursive: true });
  // 無くなった動画のファイルを消す（動画のファイル以外には触らない）
  for (const f of readdirSync(videoDir)) if (f.endsWith('.json') && !snap.has(f.slice(0, -'.json'.length))) rmSync(path.join(videoDir, f));
  for (const [video, v] of snap) writeFileSync(path.join(videoDir, `${video}.json`), toJson(v));
};

/* ───────────── 比べる ───────────── */

export type Category = 'videos' | 'keys' | 'speech' | 'fingerprints' | 'credits' | 'keyList';
/** 値の種類ごとの見出しと、変わったときに要ること（テストと、このスクリプトの表示に使う） */
export const MEANING: Record<Category, { title: string; next: string }> = {
  videos: {
    title: '動画とスナップショットのファイルが合わない（content/index.ts の VIDEOS と videos/<動画>.json）',
    next: 'bun scripts/snapshots.ts --update で足す・消す。合成が要るかどうかは鍵の差で分かる（スナップショットに無い鍵の数）',
  },
  keys: { title: '音声の鍵（音声ファイルの名前）が変わった', next: '素材の音声が当たらなくなる。わざと変えたなら --update で作り直し、PR に「合成し直しが要る」と書く' },
  speech: { title: '読み（VOICEVOX・Kokoro に渡す文）が変わった', next: '鍵も変わる。わざと変えたなら --update で作り直し、PR に「合成し直しが要る」と書く' },
  fingerprints: { title: '訳の指紋（訳がある台本の指紋）が変わった', next: 'その訳が stale になる（合成は要らない）。わざと変えたなら --update で作り直し、訳を見直して bun scripts/i18n.ts stamp' },
  credits: { title: '動画の終わりのクレジットが変わった', next: '動画の書き出し直しが要る（音声は同じ）。わざと変えたなら --update で作り直す' },
  keyList: {
    title: '鍵の一覧（全部の動画・重なりなし。動画ごとのファイルから求める）が変わった',
    next: 'スナップショットに無い鍵の台詞は合成が要る。無い鍵が 0 なら、今ある音声を使い回せる（時刻の作り直しだけ）',
  },
};
/** found は値の種類ごとの違い。resynth はスナップショットに無い鍵がある動画（「動画（鍵の数）」。合成が要る） */
export type Differences = { found: Record<Category, string[]>; resynth: string[] };

/** 1 本の動画で出す台詞の数・鍵の数（ほかは数だけ出す） */
const SHOW = 5;
const quote = (s: string) => (s.length > 40 ? `${s.slice(0, 40)}…` : s);
const block = (video: string, items: string[]) => [
  `${video}（${items.length} 台詞）`,
  ...items.slice(0, SHOW).map((x) => `  ${x}`),
  ...(items.length > SHOW ? [`  …ほか ${items.length - SHOW} 台詞`] : []),
];
const some = (keys: string[]) => `${keys.slice(0, SHOW).join(' ')}${keys.length > SHOW ? ' …' : ''}`;

/** 置いたスナップショットと今の値の違い。変わった動画と台詞（何番目・どの値）を、値の種類ごとに文にする */
export const differences = (saved: Snapshot, values: VideoValue[]): Differences => {
  const found: Record<Category, string[]> = { videos: [], keys: [], speech: [], fingerprints: [], credits: [], keyList: [] };
  const savedKeys = new Set(snapshotKeys(saved));
  const resynth: string[] = [];
  const now = new Map(values.map((v) => [v.video, v]));
  for (const v of [...values].sort((a, b) => byName(a.video, b.video))) {
    const fresh = new Set(v.lines.map((l) => l.key).filter((k) => !savedKeys.has(k)));
    if (fresh.size) resynth.push(`${v.video}（${fresh.size}）`);
    const old = saved.get(v.video);
    if (!old) {
      found.videos.push(`${v.video}: videos/${v.video}.json が無い（新しい動画。台詞 ${v.lines.length}・スナップショットに無い鍵 ${fresh.size}）`);
      continue;
    }
    if (old.fingerprint !== v.fingerprint) {
      const source = parseVideoKey(v.video).lang === 'ja' ? '' : `（元の日本語の台本 ${parseVideoKey(v.video).id}）`;
      found.fingerprints.push(
        !old.fingerprint
          ? `${v.video}: 訳ができた（指紋 ${v.fingerprint} を置く）`
          : !v.fingerprint
            ? `${v.video}: 訳が無くなった（指紋 ${old.fingerprint} を外す）`
            : `${v.video}: ${old.fingerprint} → ${v.fingerprint}${source}`,
      );
    }
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
    if (keys.length) found.keys.push(...block(v.video, keys));
    if (speech.length) found.speech.push(...block(v.video, speech));
  }
  for (const video of [...saved.keys()].sort(byName)) if (!now.has(video)) found.videos.push(`${video}: 動画が無いのに videos/${video}.json が残っている`);
  // 全体の鍵の一覧は、動画ごとのファイルから求めて比べる（スナップショットに無い鍵 = 合成が要る台詞）
  const nowKeys = new Set(values.flatMap((v) => v.lines.map((l) => l.key)));
  const added = [...nowKeys].filter((k) => !savedKeys.has(k)).sort();
  const removed = [...savedKeys].filter((k) => !nowKeys.has(k)).sort();
  if (added.length) found.keyList.push(`スナップショットに無い鍵 ${added.length}（合成が要る）: ${some(added)}`);
  if (removed.length) found.keyList.push(`使わなくなった鍵 ${removed.length}（素材に残るだけ）: ${some(removed)}`);
  return { found, resynth };
};

/** 違いを表示用の行にする（違いが無ければ空） */
export const report = ({ found }: Differences): string[] =>
  (Object.keys(MEANING) as Category[]).flatMap((c) => (found[c].length ? [`■ ${MEANING[c].title}`, ...found[c].map((x) => `  ${x}`), `  → ${MEANING[c].next}`] : []));

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
  const inLang = (lang: string) => values.filter((v) => parseVideoKey(v.video).lang === lang).length;
  const size = [
    `動画 ${values.length} 本（${LANGS.map((l) => `${l} ${inLang(l)}`).join('・')}）`,
    `台詞 ${values.reduce((n, v) => n + v.lines.length, 0)}`,
    `鍵 ${new Set(values.flatMap((v) => v.lines.map((l) => l.key))).size}`,
    `訳の指紋 ${values.filter((v) => v.fingerprint).length} 本`,
  ].join('・');
  for (const l of lines) console.log(l);
  if (args.includes('--update')) {
    writeSnapshot(values);
    console.log(`${lines.length ? '作り直した' : '変わっていない（書き直しただけ）'}: ${path.relative(ROOT, SNAPSHOT_DIR)}/videos（${size}）`);
    if (diff.resynth.length) console.log(`PR に「合成し直しが要る」と書く。スナップショットに無い鍵がある動画（鍵の数）: ${diff.resynth.join(' ')}`);
  } else {
    console.log(lines.length ? `スナップショットと違う。わざと変えたなら bun scripts/snapshots.ts --update（${size}）` : `スナップショットと同じ（${size}）`);
    process.exit(lines.length ? 1 : 0);
  }
}
