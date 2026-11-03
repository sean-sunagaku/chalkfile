import { afterAll, describe, expect, test } from 'bun:test';
import { CHALKFILE, NIGHT, THEMES } from '../content/themes';
import type { Tone } from '../content/types';
import { contrastRatio, contrastSummary, luminance, mixHex, onTone, themeContrast, toneText } from '../engine/core/contrast';
import { alpha, applyTheme, C, mix, tone, TONES } from '../src/theme';
import { lineEnd, lineStart } from '../src/timing';

describe('台詞の番号からフレーム（src/timing.tsx の lineStart・lineEnd）', () => {
  const lines = [
    { start: 10, end: 40 },
    { start: 50, end: 90 },
    { start: 100, end: 130 },
  ];
  test('at 番目の台詞の頭', () => {
    expect(lineStart(lines, 0)).toBe(10);
    expect(lineStart(lines, 2)).toBe(100);
  });
  test('at が負なら、最初の台詞の頭', () => expect(lineStart(lines, -1)).toBe(10));
  test('at が台詞の数と同じ（それより大きい）なら、最後の台詞の終わり', () => {
    expect(lineStart(lines, 3)).toBe(130);
    expect(lineStart(lines, 9)).toBe(130);
  });
  test('台詞が 0 なら 0', () => {
    expect(lineStart([], 0)).toBe(0);
    expect(lineStart([], 5)).toBe(0);
    expect(lineEnd([], 0)).toBe(0);
  });
  test('lineEnd は台詞の範囲の中に丸める', () => {
    expect(lineEnd(lines, -1)).toBe(40);
    expect(lineEnd(lines, 1)).toBe(90);
    expect(lineEnd(lines, 3)).toBe(130);
  });
  test('整数でない at は描く途中で止まる（台本の検証が誤りにする理由）', () => expect(() => lineStart(lines, 1.5)).toThrow());
});

describe('色の関数（src/theme.ts の alpha・mix）', () => {
  test('alpha は #RRGGBB に透明度を付ける', () => {
    expect(alpha('#FF8000', 0.5)).toBe('rgba(255,128,0,0.5)');
    expect(alpha('#ff8000', 1)).toBe('rgba(255,128,0,1)');
  });
  test('#RRGGBB でない色は黙って壊れる（テーマの検証が誤りにする理由）', () => expect(alpha('#FFF', 0.5)).toBe('rgba(255,15,NaN,0.5)'));
  test('mix は 2 色を混ぜて、小文字の #rrggbb を返す', () => {
    expect(mix('#000000', '#FFFFFF', 0.5)).toBe('#808080');
    expect(mix('#ABCDEF', '#000000', 0)).toBe('#abcdef');
    expect(mix('#000000', '#FFFFFF', 1)).toBe('#ffffff');
  });
  test('engine/core/contrast.ts の mixHex は、src/theme.ts の mix と同じ値を出す', () => {
    for (const [a, b] of [
      ['#14312A', '#FFC93C'],
      ['#090D22', '#FFFFFF'],
      ['#E58F00', '#0A2540'],
    ])
      for (const t of [0, 0.22, 0.3, 0.45, 1]) expect(mixHex(a, b, t)).toBe(mix(a, b, t));
  });
});

describe('テーマの当てはめ（src/theme.ts の applyTheme）', () => {
  afterAll(() => applyTheme(CHALKFILE, false));
  test('5 つのテーマで、図の文字色と onTone が engine/core/contrast.ts の作り方と同じ', () => {
    for (const theme of Object.values(THEMES)) {
      applyTheme(theme, false);
      for (const t of Object.keys(theme.tones) as Tone[]) {
        expect(TONES[t].main).toBe(theme.tones[t]);
        expect(TONES[t].text).toBe(toneText(theme, t));
      }
      expect(C.onTone).toBe(onTone(theme));
    }
  });
  test('薄い面は、明るい地で 10%・暗い地で 15% の透明度', () => {
    applyTheme(CHALKFILE, false);
    expect(TONES.mint.soft).toBe(alpha(CHALKFILE.tones.mint, 0.1));
    applyTheme(NIGHT, false);
    expect(TONES.mint.soft).toBe(alpha(NIGHT.tones.mint, 0.15));
  });
  test('tone() は省くと violet', () => {
    applyTheme(CHALKFILE, false);
    expect(tone()).toBe(TONES.violet);
    expect(tone('coral').main).toBe(CHALKFILE.tones.coral);
  });
});

describe('コントラスト比（engine/core/contrast.ts）', () => {
  test('白と黒は 21・同じ色は 1・文字と地の順番によらない', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBe(21);
    expect(contrastRatio('#7A8CA1', '#7A8CA1')).toBe(1);
    expect(contrastRatio('#14312A', '#F2F7F4')).toBe(contrastRatio('#F2F7F4', '#14312A'));
  });
  test('相対輝度は 0〜1', () => {
    expect(luminance('#FFFFFF')).toBe(1);
    expect(luminance('#000000')).toBe(0);
    expect(luminance('#808080')).toBeCloseTo(0.2159, 4);
  });
  test('#RRGGBB でない色は止める', () => expect(() => contrastRatio('#FFF', '#000000')).toThrow());

  // 今の 5 テーマの数（2026-11-02 の記録）。役割ごとの、いちばん低い比（tone と syntax は全部の色の中で）。
  // テーマの色を変えたら、この表も直す。下限（本文 4.5・大きい文字 3.0）で止めるのは見た目の更新（計画の T3A-14）でまとめて行う
  const RECORDED: Record<string, Record<string, number>> = {
    chalkfile: { 'ink/bg': 12.9, 'sub/surface': 7.55, 'muted/bg2': 3.09, 'onAccent/accent': 9.1, 'caption/code': 12.29, 'syntax/code': 5.12, 'tone.main/surface': 2.76, 'tone.text/surface': 4.41, 'onTone/tone.main': 2.76, 'caption/tone.main': 2.76 },
    indigo: { 'ink/bg': 14.7, 'sub/surface': 7.8, 'muted/bg2': 3.45, 'onAccent/accent': 4.7, 'caption/code': 16.58, 'syntax/code': 5.16, 'tone.main/surface': 2.54, 'tone.text/surface': 4.34, 'onTone/tone.main': 2.54, 'caption/tone.main': 2.54 },
    night: { 'ink/bg': 17.83, 'sub/surface': 8.99, 'muted/bg2': 5.4, 'onAccent/accent': 6.87, 'caption/code': 18.45, 'syntax/code': 5.36, 'tone.main/surface': 5.68, 'tone.text/surface': 9.21, 'onTone/tone.main': 6.87, 'caption/tone.main': 1.6 },
    paper: { 'ink/bg': 16.04, 'sub/surface': 10.07, 'muted/bg2': 3.91, 'onAccent/accent': 4.29, 'caption/code': 15.63, 'syntax/code': 5.17, 'tone.main/surface': 3.76, 'tone.text/surface': 5.92, 'onTone/tone.main': 3.76, 'caption/tone.main': 3.76 },
    stage: { 'ink/bg': 16.08, 'sub/surface': 10.57, 'muted/bg2': 4.25, 'onAccent/accent': 4.69, 'caption/code': 15.84, 'syntax/code': 5.42, 'tone.main/surface': 3.81, 'tone.text/surface': 5.98, 'onTone/tone.main': 3.81, 'caption/tone.main': 3.81 },
  };
  test('今の 5 テーマの数を記録する', () => {
    expect(Object.keys(THEMES).sort()).toEqual(Object.keys(RECORDED).sort());
    for (const [id, theme] of Object.entries(THEMES)) expect(contrastSummary(themeContrast(theme))).toEqual(RECORDED[id]);
  });
  test('いちばん低い組は、amber の色の文字（明るい地）と、暗い地の字幕の名前札', () => {
    const ratio = (id: string, role: string) => themeContrast(THEMES[id]).find((p) => p.role === role)!.ratio;
    expect(ratio('chalkfile', 'tone.main/surface:amber')).toBeCloseTo(2.76, 2);
    expect(ratio('indigo', 'tone.main/surface:amber')).toBeCloseTo(2.54, 2);
    expect(ratio('night', 'caption/tone.main:amber')).toBeCloseTo(1.6, 2);
  });
});
