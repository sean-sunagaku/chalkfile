// 時刻の計算（scripts/stages/timeline/compute.ts。純粋な関数）を、決まった長さの声で流し、正解の値（手で確かめた値）と比べる。
// 出力（scripts/stages/timeline/emit.ts）は一時のフォルダに書き、計算した形とそのまま同じかを見る。
// 間の取り方（engine/core/timeline.ts の TIMING）や丸め方を変えたら、ここの値も直す（全部の動画の timeline が変わる）
import { afterAll, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Video } from '../content';
import type { Lecture } from '../content/types';
import { timelineFile } from '../engine/core/generated';
import { TIMING, timelineFingerprint, timelineJson } from '../engine/core/timeline';
import {
  kanaLogOf,
  type LineVoice,
  layout,
  planOf,
  siteDataOf,
  speechFileOf,
  timelineOf,
} from '../scripts/stages/timeline/compute';
import { emitVideo, outDirs } from '../scripts/stages/timeline/emit';
import { course, lecture } from './fixtures/content/invalid/_base';

const sandbox = mkdtempSync(path.join(os.tmpdir(), 'chalkfile-synth-compute-'));
afterAll(() => rmSync(sandbox, { recursive: true, force: true }));

/** オープニング（呼び込み）・3 台詞の場面（効果音・負の pause・BGM を止める台詞）・hold のあるエンディング */
const lec: Lecture = lecture([
  { kind: 'opening', title: '見本', lines: [{ t: 'はじめます。', v: 'announcer' }] },
  {
    kind: 'big',
    heading: '大事なこと',
    text: '台本が正本',
    lines: [
      { t: '一つ目です。', s: 'ひとつめです。', sfx: 'pop' },
      { t: '二つ目です。', v: 'tsukkomi', pause: -0.5 },
      { t: '三つ目です。', bgm: 'cut', sfxAfter: 'chin', pause: 0.2 },
    ],
  },
  { kind: 'ending', closing: 'おわり', hold: 0.5, lines: [{ t: 'おわりです。' }] },
]);
const c = course([lec], { cast: { tsukkomi: { name: 'ツッコミ', tone: 'cyan' } } });
/** 台詞ごとの声の長さ（秒）。フレームの境目をまたぐ長さ・ちょうどの長さを混ぜる */
const SEC = [[1.234], [2.5, 0.987, 1.6], [3.21]];
const voices: LineVoice[][] = SEC.map((s, si) =>
  s.map((sec, li) => ({ file: `.work/tts/k${si}${li}.wav`, sec, kana: `カナ${si}${li}` })),
);
const FPS = 30;

describe('時刻の計算（layout）', () => {
  const t = layout(lec, voices, FPS);
  test('間の取り方は TIMING（オープニングはジングルの「ドン」のあと）', () => {
    expect(TIMING).toEqual({ leadIn: 0.45, openingLeadIn: 2.05, gap: 0.3, minGap: 0.05, tail: 0.75, endingTail: 4 });
  });
  test('場面の始まりと終わり（秒。フレームに丸める）', () => {
    // オープニング: 2.05 秒 → 61 フレーム目に呼び込み、1.234 秒 → 0.75 秒の余白 → 121 フレーム目で終わる
    // 3 台詞の場面: 121 + 0.45 秒 → 135 フレーム目から。最後の台詞のあと 0.75 秒 → 321 フレーム目
    // エンディング: 321 + 0.45 秒 → 334 フレーム目から。3.21 秒 → 4.0 秒（締めのジングル）＋ hold 0.5 秒 → 565 フレーム目
    expect(t.scenes.map((s) => [s.kind, s.heading, s.start * FPS, s.end * FPS].map(round))).toEqual([
      ['opening', '', 0, 121],
      ['big', '大事なこと', 121, 321],
      ['ending', '', 321, 565],
    ]);
    expect(t.duration).toBe(565 / FPS);
  });
  test('台詞の始まり（フレームに丸める）・終わり（始まり＋声の長さ）・あとの間（pause を足す。最短 0.05 秒）', () => {
    expect(
      t.scenes.flatMap((s) => s.lines.map((l) => [l.text, l.start * FPS, l.end, l.pauseAfter].map(round))),
    ).toEqual([
      ['はじめます。', 61, 3.267333, 0.3],
      ['一つ目です。', 135, 7, 0.3],
      // 前の台詞の 0.3 秒あと（7.3 秒 = 219 フレーム目）
      ['二つ目です。', 219, 8.287, 0.05],
      // 負の pause は 0.05 秒まで詰める（8.337 秒 → 250 フレーム目）
      ['三つ目です。', 250, 9.933333, 0.5],
      ['おわりです。', 334, 14.343333, 0.3],
    ]);
  });
  test('台詞の声・音声・効果音・BGM の印を、そのまま持つ', () => {
    const [, big] = t.scenes;
    expect(big.lines.map(({ voice, file, sfx, sfxAfter, bgm }) => ({ voice, file, sfx, sfxAfter, bgm }))).toEqual([
      { voice: 'narrator', file: '.work/tts/k10.wav', sfx: 'pop', sfxAfter: undefined, bgm: undefined },
      { voice: 'tsukkomi', file: '.work/tts/k11.wav', sfx: undefined, sfxAfter: undefined, bgm: undefined },
      { voice: 'narrator', file: '.work/tts/k12.wav', sfx: undefined, sfxAfter: 'chin', bgm: 'cut' },
    ]);
  });
  test('声が足りなければ止める（どの台詞か出す）', () => {
    expect(() => layout(lec, [voices[0], voices[1].slice(0, 2), voices[2]], FPS)).toThrow('X01 s2-3');
  });
});

describe('出力の形', () => {
  const t = layout(lec, voices, FPS);
  test('timeline（場面の開始と長さ・場面の頭からの台詞のフレーム。指紋は時刻に効く入力から）', () => {
    expect(timelineOf('X01', lec, 'ja', t, FPS)).toEqual({
      schema: 1,
      key: 'X01',
      fps: 30,
      durationInFrames: 565,
      fingerprint: timelineFingerprint(lec, 'ja'),
      scenes: [
        { start: 0, duration: 121, lines: [{ start: 61, end: 98 }] },
        {
          start: 121,
          duration: 200,
          lines: [
            { start: 14, end: 89 },
            { start: 98, end: 128 },
            { start: 129, end: 177 },
          ],
        },
        { start: 321, duration: 244, lines: [{ start: 13, end: 109 }] },
      ],
    });
  });
  test('ミックスの設計図（項目の並びもバイト列に入る。無い印は書かない）', () => {
    const plan = JSON.stringify(planOf('X01', t));
    // 形の版（scripts/lib/handoff.ts の SCHEMA.plan）を頭に書く
    expect(
      plan.startsWith(`{"schema":1,"id":"X01","duration":${565 / FPS},"scenes":[{"kind":"opening","start":0,"end":`),
    ).toBe(true);
    expect(JSON.parse(plan).scenes[1].lines[2]).toEqual({
      file: '.work/tts/k12.wav',
      start: 250 / FPS,
      end: 250 / FPS + 1.6,
      sfxAfter: 'chin',
      bgm: 'cut',
      pauseAfter: 0.5,
    });
    expect(Object.keys(JSON.parse(plan).scenes[1].lines[0])).toEqual(['file', 'start', 'end', 'sfx', 'pauseAfter']);
  });
  test('サイトの台本（秒は小数 2 桁。見出しの無い場面はレクチャーの題。掛け合いの講座は名前を付ける）', () => {
    expect(siteDataOf('X01', lec, c, t)).toEqual({
      id: 'X01',
      duration: 18.83,
      chapters: [
        { scene: 0, start: 0, heading: '検証の見本', kind: 'opening' },
        { scene: 1, start: 4.03, heading: '大事なこと', kind: 'big' },
        { scene: 2, start: 10.7, heading: '検証の見本', kind: 'ending' },
      ],
      cues: [
        { start: 2.03, end: 3.27, text: 'はじめます。', scene: 0, heading: '' },
        { start: 4.5, end: 7, text: '一つ目です。', scene: 1, heading: '大事なこと' },
        { start: 7.3, end: 8.29, text: 'ツッコミ：二つ目です。', scene: 1, heading: '大事なこと' },
        { start: 8.33, end: 9.93, text: '三つ目です。', scene: 1, heading: '大事なこと' },
        { start: 11.13, end: 14.34, text: 'おわりです。', scene: 2, heading: '' },
      ],
    });
  });
  test('読みの記録（日本語）と、聞き取りの対応（訳だけ）', () => {
    expect(kanaLogOf('X01', lec, 'ja', voices).split('\n')).toEqual([
      'X01 s1-1 [announcer] はじめます。',
      '    カナ00',
      'X01 s2-1 [narrator] 一つ目です。',
      '    カナ10',
      'X01 s2-2 [tsukkomi] 二つ目です。',
      '    カナ11',
      'X01 s2-3 [narrator] 三つ目です。',
      '    カナ12',
      'X01 s3-1 [narrator] おわりです。',
      '    カナ20',
    ]);
    expect(speechFileOf('X01', lec, 'ja', voices)).toBeNull();
  });
  test('訳は、画面の文と読み上げた文が違えば、読み上げた文も記録する（強調の ** は読まない）', () => {
    const en = lecture([
      { kind: 'opening', title: 'Sample', lines: [{ t: 'Hello **world**.', v: 'announcer' }] },
      { kind: 'ending', closing: 'Bye', lines: [{ t: 'Bye.', s: 'Good bye.' }] },
    ]);
    const v = [[voices[0][0]], [voices[2][0]]];
    expect(kanaLogOf('X01.en', en, 'en', v).split('\n')).toEqual([
      'X01.en s1-1 [announcer] Hello **world**.',
      '    読み: Hello world.',
      '    カナ00',
      'X01.en s2-1 [narrator] Bye.',
      '    読み: Good bye.',
      '    カナ20',
    ]);
    expect(speechFileOf('X01.en', en, 'en', v)).toEqual({
      schema: 1,
      key: 'X01.en',
      lang: 'en',
      lines: [
        { at: 's1-1', voice: 'announcer', t: 'Hello **world**.', speech: 'Hello world.', file: '.work/tts/k00.wav' },
        { at: 's2-1', voice: 'narrator', t: 'Bye.', speech: 'Good bye.', file: '.work/tts/k20.wav' },
      ],
    });
  });
});

describe('出力を書く（emitVideo）', () => {
  test('自分の動画のファイルだけを、計算した形のとおりに書く（一時のファイルを残さない。字幕の VTT は書かない）', () => {
    const root = mkdtempSync(path.join(sandbox, 'root-'));
    const out = outDirs(root);
    // 前の synth が書いた字幕のファイル（誰も読まない）は消し、ほかの動画のファイルには触らない
    mkdirSync(out.siteData, { recursive: true });
    writeFileSync(path.join(out.siteData, 'X01.vtt'), 'WEBVTT\n');
    writeFileSync(path.join(out.siteData, 'X02.vtt'), 'WEBVTT\n');
    const video: Video = { key: 'X01', lang: 'ja', lecture: lec, course: c };
    const t = emitVideo(out, video, voices, FPS);
    expect(readdirSync(out.siteData).sort()).toEqual(['X01.json', 'X02.vtt']);
    expect(t).toEqual(layout(lec, voices, FPS));
    const read = (p: string) => readFileSync(path.join(root, p), 'utf8');
    expect(read(timelineFile(c.id, 'X01'))).toBe(timelineJson(timelineOf('X01', lec, 'ja', t, FPS)));
    expect(read('.work/plan/X01.json')).toBe(JSON.stringify(planOf('X01', t), null, 1));
    expect(read('.work/kana/X01.txt')).toBe(kanaLogOf('X01', lec, 'ja', voices));
    expect(read('site/data/X01.json')).toBe(JSON.stringify(siteDataOf('X01', lec, c, t)));
    // 日本語の動画は、聞き取りの対応を書かない
    expect(existsSync(out.speech)).toBe(false);
    for (const dir of [out.plan, out.kana, out.siteData, path.join(root, 'content', c.id, 'generated', 'timeline')])
      expect(readdirSync(dir).filter((f) => f.endsWith('.tmp'))).toEqual([]);
  });
});

/** 比べやすいように、6 桁に丸める（浮動小数点の最後の桁のゆれを見ない） */
function round<T>(x: T): T {
  return (typeof x === 'number' ? Math.round(x * 1e6) / 1e6 : x) as T;
}
