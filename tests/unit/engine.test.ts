import { describe, expect, test } from 'bun:test';
import { LANGS } from '../../content/i18n';
import { CHALKFILE, isThemeId, NIGHT, THEMES } from '../../content/themes';
import type { Theme } from '../../content/types';
import { alpha, mix } from '../../engine/core/color';
import { contrastProblems, contrastRatio, contrastSummary, luminance, themeContrast } from '../../engine/core/contrast';
import { CONTRAST_MIN, derivePalette, TONE_TEXT_MIX } from '../../engine/core/theme';
import { validateTheme } from '../../engine/core/validate';
import { formatInteger, VIDEO_TEXT } from '../../src/i18n';
import { lineEnd, lineStart } from '../../src/timing';
import paletteJson from '../fixtures/palette/themes.json';

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
  test('整数でない at は描く途中で止まる（台本の検証が誤りにする理由）', () =>
    expect(() => lineStart(lines, 1.5)).toThrow());
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
    for (const aa of [0x26, 0x30, 0x38, 0x40, 0x55, 0x66, 0x88, 0xcc])
      expect(alpha('#E0507F', aa / 255)).toBe(`rgba(224,80,127,${aa / 255})`);
  });
});

/** 前の src/theme.ts（applyTheme）が作った色（tests/fixtures/palette/themes.json。見た目の更新の前の色） */
type Recorded = {
  C: Record<string, string>;
  TONES: Record<string, Record<string, string>>;
  GRAD: string;
  DISPLAY: string;
  SYNTAX: Record<string, string>;
  MESH: string[];
};
const RECORDED_PALETTE = (paletteJson as { themes: Record<string, Recorded> }).themes;

/** 見た目の更新で、読める濃さにするために変えた色（ほかの色は前のまま） */
const READABLE_C = ['muted', 'codeMuted'] as const;

describe('パレット（engine/core/theme.ts の derivePalette）', () => {
  test('5 つのテーマで、読める濃さにした色（補足の muted・行番号の codeMuted・図の色の文字 text）のほかは、前の src/theme.ts（applyTheme）と同じ色を作る', () => {
    expect<string[]>(Object.keys(THEMES).filter(isThemeId).sort()).toEqual(Object.keys(RECORDED_PALETTE).sort());
    for (const [id, theme] of Object.entries(THEMES)) {
      const p = derivePalette(theme);
      const want = RECORDED_PALETTE[id];
      const same = Object.keys(want.C).filter((k) => !(READABLE_C as readonly string[]).includes(k));
      expect(Object.fromEntries(same.map((k) => [k, p.C[k as keyof typeof p.C]]))).toEqual(
        Object.fromEntries(same.map((k) => [k, want.C[k]])),
      );
      for (const [t, set] of Object.entries(want.TONES)) {
        const got = p.TONES[t as keyof typeof p.TONES];
        expect({ main: got.main, soft: got.soft, deep: got.deep }).toEqual({
          main: set.main,
          soft: set.soft,
          deep: set.deep,
        });
      }
      expect({ GRAD: p.GRAD, DISPLAY: p.DISPLAY, SYNTAX: p.SYNTAX, MESH: p.MESH }).toEqual({
        GRAD: want.GRAD,
        DISPLAY: want.DISPLAY,
        SYNTAX: want.SYNTAX as typeof p.SYNTAX,
        MESH: want.MESH,
      });
    }
  });
  test('読める濃さにした色は、前の色が下限に届いていればそのまま、届いていなければ見出しの色（暗い地は白）に寄せた色', () => {
    const changed: string[] = [];
    for (const [id, theme] of Object.entries(THEMES)) {
      const p = derivePalette(theme);
      const want = RECORDED_PALETTE[id];
      if (p.C.muted !== want.C.muted) changed.push(`${id} muted`);
      if (p.C.codeMuted !== want.C.codeMuted) changed.push(`${id} codeMuted`);
      for (const [t, set] of Object.entries(want.TONES))
        if (p.TONES[t as keyof typeof p.TONES].text !== set.text) changed.push(`${id} ${t}.text`);
      // 暗い地（night）の補足は、前の色のまま届いている
      if (theme.scheme === 'dark') expect(p.C.muted).toBe(want.C.muted);
    }
    expect(changed.sort()).toEqual(
      [
        ...['chalkfile', 'indigo', 'paper', 'stage'].map((id) => `${id} muted`),
        ...['chalkfile', 'indigo', 'night', 'paper', 'stage'].map((id) => `${id} codeMuted`),
        'chalkfile pink.text',
        'chalkfile cyan.text',
        'chalkfile mint.text',
        'chalkfile amber.text',
        'indigo amber.text',
      ].sort(),
    );
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
  test('講座サイトの図の文字色は、動画と作り方が違う（サイトは明るい地は ink に 0.22、暗い地はそのまま。動画は 0.3 から下限に届くまでと、白に 0.45）', () => {
    expect(TONE_TEXT_MIX).toEqual({ video: { light: 0.3, dark: 0.45 }, site: { light: 0.22 } });
    const light = derivePalette(CHALKFILE);
    expect(light.site.toneText.pink).toBe(mix(CHALKFILE.tones.pink, CHALKFILE.color.ink, 0.22));
    // 動画の pink は 0.3 では本文の下限（4.5）に届かないので、0.35 まで寄せる。violet は 0.3 で届く
    expect(light.TONES.pink.text).toBe(mix(CHALKFILE.tones.pink, CHALKFILE.color.ink, 0.35));
    expect(light.TONES.violet.text).toBe(mix(CHALKFILE.tones.violet, CHALKFILE.color.ink, 0.3));
    const dark = derivePalette(NIGHT);
    expect(dark.site.toneText.pink).toBe(NIGHT.tones.pink);
    expect(dark.TONES.pink.text).toBe(mix(NIGHT.tones.pink, '#FFFFFF', 0.45));
  });
  test('図の色の上の文字（on）は、明るい地は白、白で読めない色（明るい地の amber）は見出しの色、暗い地はテーマの dark.onTone', () => {
    expect(derivePalette(CHALKFILE).TONES.violet.on).toBe('#FFFFFF');
    expect(derivePalette(CHALKFILE).TONES.amber.on).toBe(CHALKFILE.color.ink);
    expect(derivePalette(THEMES.indigo).TONES.amber.on).toBe(THEMES.indigo.color.ink);
    for (const t of Object.values(derivePalette(NIGHT).TONES)) expect(t.on).toBe(NIGHT.dark?.onTone ?? '');
  });
  test('大きな文字の図の色（strong）は、地と面に 3.0 で届けば main のまま、届かなければ濃くする', () => {
    const p = derivePalette(CHALKFILE);
    expect(p.TONES.violet.strong).toBe(CHALKFILE.tones.violet);
    expect(p.TONES.amber.strong).not.toBe(CHALKFILE.tones.amber);
    for (const t of Object.values(derivePalette(NIGHT).TONES)) expect(t.strong).toBe(t.main);
  });
});

describe('テーマの検証（engine/core/validate.ts の validateTheme）', () => {
  const brief = (theme: Theme) =>
    validateTheme(theme, 't')
      .map((x) => `${x.level} ${x.where}`)
      .sort();
  test('今の 5 つのテーマに、誤りも注意も無い', () => {
    for (const t of Object.values(THEMES)) expect(validateTheme(t)).toEqual([]);
  });
  test('要る項目の抜け（色・コードの色分け・影・角の丸み）と、知らない書体を見つける', () => {
    const { muted: _, ...color } = CHALKFILE.color;
    const { fn: __, ...syntax } = CHALKFILE.syntax;
    const bad = {
      ...CHALKFILE,
      color,
      syntax,
      shadow: '',
      radius: -1,
      fonts: ['zen-maru', 'comic'],
    } as unknown as Theme;
    expect(brief(bad)).toEqual([
      'error t color.muted',
      'error t fonts[1]',
      'error t radius',
      'error t shadow',
      'error t syntax.fn',
    ]);
  });
  test('暗い地のテーマは dark が要る。dark の色は #RRGGBB か rgba()、図の色の上の文字（onTone）は #RRGGBB', () => {
    const { dark: _, ...noDark } = NIGHT;
    expect(brief(noDark)).toEqual(['error t dark']);
    const base = NIGHT.dark;
    if (!base) throw new Error('NIGHT に dark が無い');
    const dark = {
      ...base,
      overlay: 'navy',
      edge: 'rgba(300,0,0,0.5)',
      track: 'rgba(255, 255, 255, 0.1)',
      onTone: 'rgba(11,15,36,1)',
    };
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

  test('全部のテーマで、全部の組が役割の下限に届く（本文 4.5・大きい文字 3.0）', () => {
    const low = Object.values(THEMES).flatMap((t) =>
      contrastProblems(t).map((p) => `${t.id} ${p.role} ${p.ratio.toFixed(2)}（下限 ${p.min}）`),
    );
    expect(low).toEqual([]);
  });
  test('本文の組と大きい文字の組の下限', () => {
    expect(CONTRAST_MIN).toEqual({ body: 4.5, large: 3.0 });
    const roles = Object.fromEntries(themeContrast(CHALKFILE).map((p) => [p.role.replace(/:.*$/, ''), p.min]));
    for (const r of [
      'ink/bg',
      'sub/surface',
      'muted/bg2',
      'caption/code',
      'codeMuted/code',
      'tone.text/surface',
      'tone.text/soft',
    ])
      expect(`${r} ${roles[r]}`).toBe(`${r} 4.5`);
    for (const r of ['tone.strong/surface', 'tone.on/main', 'onGrad/gradient', 'display/bg'])
      expect(`${r} ${roles[r]}`).toBe(`${r} 3`);
  });
  test('前は下限に届かなかった組（出典・注意書き・クレジットの muted、amber の文字、暗い地の名前札）が、届く', () => {
    const ratio = (id: keyof typeof THEMES, role: string) =>
      themeContrast(THEMES[id]).find((p) => p.role === role)?.ratio ?? 0;
    // 前は chalkfile 3.09・indigo 3.45・paper 3.91・stage 4.25
    for (const id of ['chalkfile', 'indigo', 'paper', 'stage'] as const)
      expect(ratio(id, 'muted/bg2')).toBeGreaterThanOrEqual(4.5);
    // 前は amber の main の文字（クイズの考える時間の数）が chalkfile 2.76・indigo 2.54
    expect(ratio('chalkfile', 'tone.text/surface:amber')).toBeGreaterThanOrEqual(4.5);
    expect(ratio('indigo', 'tone.strong/surface:amber')).toBeGreaterThanOrEqual(3);
    // 前は名前札が白の直書きで、night では 1.60〜2.76
    expect(ratio('night', 'tone.on/main:amber')).toBeGreaterThanOrEqual(3);
  });
  test('テーマの検証は、下限に届かない組を誤りにする（形が合っているテーマだけを見る）', () => {
    const bad = { ...CHALKFILE, id: 'pale', color: { ...CHALKFILE.color, ink: '#B0C4BC' } };
    expect(validateTheme(bad, 't').some((x) => x.level === 'error' && x.where.includes('コントラスト ink/bg'))).toBe(
      true,
    );
  });
  test('役割ごとのいちばん低い比にまとめる（tone ごと・syntax ごとの組は 1 つ）', () => {
    const sum = contrastSummary(themeContrast(CHALKFILE));
    expect(Object.keys(sum)).toContain('tone.text/surface');
    expect(Object.keys(sum)).toContain('syntax/code');
  });
});

describe('動画の決まった文字と数の書き方（src/i18n.ts）', () => {
  test('決まった英字（動画の呼び名・NEXT・Q）は、今は全部の言語で前の部品と同じ英字（訳すのは見た目の更新のとき）', () => {
    for (const lang of LANGS) {
      const { unit, next, quiz } = VIDEO_TEXT[lang];
      expect({ unit, next, quiz }).toEqual({
        unit: { LECTURE: 'LECTURE', CHAPTER: 'CHAPTER' },
        next: 'NEXT',
        quiz: 'Q',
      });
    }
  });
  test("整数の書き方は、どの言語でも前の toLocaleString('ja-JP') と同じ（3 桁ごとのカンマ）", () => {
    for (const lang of LANGS) {
      for (const n of [0, 7, 999, 1000, 12345, 1234567, -1500])
        expect(formatInteger(n, lang)).toBe(n.toLocaleString('ja-JP'));
    }
  });
});
