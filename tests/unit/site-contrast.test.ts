// サイトの文字のコントラスト（scripts/site/contrast.ts・scripts/site_theme.ts）。テーマの色を変えても、サイトの薄い文字が読める濃さのままか
import { describe, expect, test } from 'bun:test';
import { THEMES } from '../../content/themes';
import { mix } from '../../engine/core/color';
import { contrastRatio } from '../../engine/core/contrast';
import { readableOn, TEXT_CONTRAST } from '../../scripts/site/contrast';
import { themeCss } from '../../scripts/site_theme';

describe('サイトの文字のコントラスト', () => {
  test('readableOn: 届いている色はそのまま。届かない色は、本文の色へ寄せて下限に届かせる', () => {
    expect(readableOn('#000000', ['#FFFFFF'], '#000000')).toBe('#000000');
    const light = readableOn('#AAAAAA', ['#FFFFFF', '#F4F4F4'], '#111111');
    expect(light).not.toBe('#AAAAAA');
    for (const g of ['#FFFFFF', '#F4F4F4']) expect(contrastRatio(light, g)).toBeGreaterThanOrEqual(TEXT_CONTRAST);
  });

  for (const t of Object.values(THEMES)) {
    test(`${t.id}: 薄い文字（--muted）は、地・面・一段上の面と、面に重ねた薄い色のどれに置いても下限以上`, () => {
      const muted = /--muted: (#[0-9a-fA-F]{6});/.exec(themeCss(t))?.[1];
      if (!muted) throw new Error('--muted が #rrggbb で出ていない');
      const light = t.scheme === 'light';
      const grounds = [
        t.color.bg,
        t.color.surface,
        t.color.surface2,
        mix(t.color.surface, t.tones.violet, light ? 0.1 : 0.16),
        mix(t.color.surface, t.tones.pink, light ? 0.1 : 0.14),
      ];
      for (const g of grounds) expect(contrastRatio(muted, g)).toBeGreaterThanOrEqual(TEXT_CONTRAST);
    });
  }
});
