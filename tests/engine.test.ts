import { describe, expect, test } from 'bun:test';
import { LANGS } from '../content/i18n';
import { CHALKFILE, NIGHT, THEMES } from '../content/themes';
import type { Theme } from '../content/types';
import { alpha, mix } from '../engine/core/color';
import { contrastRatio, contrastSummary, luminance, themeContrast } from '../engine/core/contrast';
import { derivePalette, TONE_TEXT_MIX } from '../engine/core/theme';
import { validateTheme } from '../engine/core/validate';
import { formatInteger, VIDEO_TEXT } from '../src/i18n';
import { lineEnd, lineStart } from '../src/timing';
import paletteJson from './fixtures/palette/themes.json';

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

describe('色の関数（engine/core/color.ts の alpha・mix）', () => {
  test('alpha は #RRGGBB に透明度を付ける', () => {
    expect(alpha('#FF8000', 0.5)).toBe('rgba(255,128,0,0.5)');
    expect(alpha('#ff8000', 1)).toBe('rgba(255,128,0,1)');
  });
  test('#RRGGBB でない色は、黙って壊れた色を返さずに止める（テーマの検証が誤りにする形）', () => {
    expect(() => alpha('#FFF', 0.5)).toThrow('#RRGGBB でない色');
    expect(() => mix('red', '#000000', 0.5)).toThrow('#RRGGBB でない色');
  });
  test('mix は 2 色を混ぜて、小文字の #rrggbb を返す', () => {
    expect(mix('#000000', '#FFFFFF', 0.5)).toBe('#808080');
    expect(mix('#ABCDEF', '#000000', 0)).toBe('#abcdef');
    expect(mix('#000000', '#FFFFFF', 1)).toBe('#ffffff');
  });
  test('16 進の透明度（#RRGGBBAA）と同じ値を、alpha(色, AA / 255) で書ける', () => {
    for (const aa of [0x26, 0x30, 0x38, 0x40, 0x55, 0x66, 0x88, 0xcc]) expect(alpha('#E0507F', aa / 255)).toBe(`rgba(224,80,127,${aa / 255})`);
  });
});

/** 前の src/theme.ts（applyTheme）が作った色（tests/fixtures/palette/themes.json） */
type Recorded = { C: Record<string, string>; TONES: Record<string, Record<string, string>>; GRAD: string; DISPLAY: string; SYNTAX: Record<string, string>; MESH: string[] };
const RECORDED_PALETTE = (paletteJson as { themes: Record<string, Recorded> }).themes;

describe('パレット（engine/core/theme.ts の derivePalette）', () => {
  test('5 つのテーマで、前の src/theme.ts（applyTheme）と同じ色を作る（動画の見た目を変えない）', () => {
    expect(Object.keys(THEMES).sort()).toEqual(Object.keys(RECORDED_PALETTE).sort());
    for (const [id, theme] of Object.entries(THEMES)) {
      const p = derivePalette(theme);
      const want = RECORDED_PALETTE[id];
      expect(Object.fromEntries(Object.keys(want.C).map((k) => [k, p.C[k as keyof typeof p.C]]))).toEqual(want.C);
      expect(p.TONES).toEqual(want.TONES as typeof p.TONES);
      expect({ GRAD: p.GRAD, DISPLAY: p.DISPLAY, SYNTAX: p.SYNTAX, MESH: p.MESH }).toEqual({ GRAD: want.GRAD, DISPLAY: want.DISPLAY, SYNTAX: want.SYNTAX as typeof p.SYNTAX, MESH: want.MESH });
    }
  });
  test('足した色: 字幕の文字（onCode）は白、コードの面の下の端（codeShade）は code を黒に 0.18 寄せた色', () => {
    for (const theme of Object.values(THEMES)) {
      const { C } = derivePalette(theme);
      expect(C.onCode).toBe('#FFFFFF');
      expect(C.codeShade).toBe(mix(theme.color.code, '#000000', 0.18));
    }
  });
  test('暗い地の面と線は、テーマの dark に書いた値（Night は最初の版の値）', () => {
    const { C } = derivePalette(NIGHT);
    for (const [k, v] of Object.entries(NIGHT.dark ?? {})) expect(C[k as keyof typeof C]).toBe(v);
  });
  test('暗い地のテーマに dark が無ければ止める', () => {
    const { dark: _, ...noDark } = NIGHT;
    expect(() => derivePalette({ ...noDark, id: 'no-dark' })).toThrow('dark');
  });
  test('同じテーマと言語なら、前に作ったパレットを返す（テーマごとに 1 回だけ作る）', () => {
    expect(derivePalette(CHALKFILE, 'ja')).toBe(derivePalette(CHALKFILE));
    expect(derivePalette(CHALKFILE, 'zh')).not.toBe(derivePalette(CHALKFILE, 'ja'));
  });
  test('書体の並びは言語に合わせる（中国語は Noto Sans SC。英字用の Inter は残す）', () => {
    expect(derivePalette(CHALKFILE, 'ja').fonts).toEqual(['zen-maru']);
    expect(derivePalette(CHALKFILE, 'zh').fonts).toEqual(['noto-sc']);
    expect(derivePalette(THEMES.indigo, 'zh').fonts).toEqual(['inter', 'noto-sc']);
  });
  test('tone() は省くと violet', () => {
    const p = derivePalette(CHALKFILE);
    expect(p.tone()).toBe(p.TONES.violet);
    expect(p.tone('coral').main).toBe(CHALKFILE.tones.coral);
  });
  test('講座サイトの図の文字色は、動画と作り方が違う（明るい地は ink に 0.22、暗い地はそのまま。動画は 0.3 と白に 0.45）', () => {
    expect(TONE_TEXT_MIX).toEqual({ video: { light: 0.3, dark: 0.45 }, site: { light: 0.22 } });
    const light = derivePalette(CHALKFILE);
    expect(light.site.toneText.pink).toBe(mix(CHALKFILE.tones.pink, CHALKFILE.color.ink, 0.22));
    expect(light.TONES.pink.text).toBe(mix(CHALKFILE.tones.pink, CHALKFILE.color.ink, 0.3));
    const dark = derivePalette(NIGHT);
    expect(dark.site.toneText.pink).toBe(NIGHT.tones.pink);
    expect(dark.TONES.pink.text).toBe(mix(NIGHT.tones.pink, '#FFFFFF', 0.45));
  });
});

describe('テーマの検証（engine/core/validate.ts の validateTheme）', () => {
  const brief = (theme: Theme) => validateTheme(theme, 't').map((x) => `${x.level} ${x.where}`).sort();
  test('今の 5 つのテーマに、誤りも注意も無い', () => {
    for (const t of Object.values(THEMES)) expect(validateTheme(t)).toEqual([]);
  });
  test('要る項目の抜け（色・コードの色分け・影・角の丸み）と、知らない書体を見つける', () => {
    const { muted: _, ...color } = CHALKFILE.color;
    const { fn: __, ...syntax } = CHALKFILE.syntax;
    const bad = { ...CHALKFILE, color, syntax, shadow: '', radius: -1, fonts: ['zen-maru', 'comic'] } as unknown as Theme;
    expect(brief(bad)).toEqual(['error t color.muted', 'error t fonts[1]', 'error t radius', 'error t shadow', 'error t syntax.fn']);
  });
  test('暗い地のテーマは dark が要る。dark の色は #RRGGBB か rgba()、図の色の上の文字（onTone）は #RRGGBB', () => {
    const { dark: _, ...noDark } = NIGHT;
    expect(brief(noDark)).toEqual(['error t dark']);
    const base = NIGHT.dark;
    if (!base) throw new Error('NIGHT に dark が無い');
    const dark = { ...base, overlay: 'navy', edge: 'rgba(300,0,0,0.5)', track: 'rgba(255, 255, 255, 0.1)', onTone: 'rgba(11,15,36,1)' };
    expect(brief({ ...NIGHT, dark })).toEqual(['error t dark.edge', 'error t dark.onTone', 'error t dark.overlay']);
  });
  test('明るい地のテーマに dark を書くと注意（使わない）', () => {
    expect(brief({ ...CHALKFILE, dark: NIGHT.dark })).toEqual(['warning t dark']);
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

describe('動画の決まった文字と数の書き方（src/i18n.ts）', () => {
  test('決まった英字（動画の呼び名・NEXT・Q）は、今は全部の言語で前の部品と同じ英字（訳すのは見た目の更新のとき）', () => {
    for (const lang of LANGS) {
      const { unit, next, quiz } = VIDEO_TEXT[lang];
      expect({ unit, next, quiz }).toEqual({ unit: { LECTURE: 'LECTURE', CHAPTER: 'CHAPTER' }, next: 'NEXT', quiz: 'Q' });
    }
  });
  test("整数の書き方は、どの言語でも前の toLocaleString('ja-JP') と同じ（3 桁ごとのカンマ）", () => {
    for (const lang of LANGS) {
      for (const n of [0, 7, 999, 1000, 12345, 1234567, -1500]) expect(formatInteger(n, lang)).toBe(n.toLocaleString('ja-JP'));
    }
  });
});
