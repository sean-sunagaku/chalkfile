// 設定の正本・実際の読み手・書き出した値のずれを確かめる。
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import config, { RENDER } from '../../chalkfile.config';
import { DEFAULT_THEME } from '../../content/themes';
import { LANG_INFO, LANGS } from '../../engine/core/langs';
import { KOKORO, VOICES } from '../../engine/core/voices';
import {
  CORE_SETTINGS,
  coreSettings,
  LANGUAGE_SETTINGS,
  languageSettings,
  MEDIA_SETTINGS,
  mediaSettings,
  workerSettings,
  workflowSettings,
  wranglerSettings,
} from '../../scripts/gen_project_config';
import { readSiteConfig } from '../../scripts/lib/config';
import { ROOT } from '../../scripts/lib/paths';
import { RENDER as renderSettings } from '../../scripts/stages/video/render.config';
import { RENDER_CODE } from '../../scripts/stages/video/inputs';
import { MEDIA_REPOSITORY } from '../../site/media-shared';

const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');

describe('プロジェクトの設定', () => {
  test('サイト・声・言語・既定テーマ・書き出しの実際の読み手が正本と一致する', () => {
    expect(readSiteConfig()).toEqual({
      series: config.series,
      seriesSub: config.seriesSub,
      baseUrl: config.origin,
      repoUrl: `https://github.com/${config.repository}`,
      publishLangs: config.publishLangs,
    });
    expect<string>(DEFAULT_THEME).toBe(config.defaultTheme);
    expect(VOICES).toEqual(config.voices);
    expect(KOKORO).toEqual(config.translatedVoices);
    expect<string[]>(LANGS).toEqual(Object.keys(config.languages));
    expect(LANG_INFO).toEqual(config.languages);
    expect(renderSettings).toBe(RENDER);
    expect(MEDIA_REPOSITORY).toBe(config.repository);
    expect(RENDER_CODE).toContain('chalkfile.config.ts');
    expect(read(CORE_SETTINGS)).toBe(coreSettings());
    expect(read(LANGUAGE_SETTINGS)).toBe(languageSettings(read(LANGUAGE_SETTINGS)));
    expect(read(MEDIA_SETTINGS)).toBe(mediaSettings(read(MEDIA_SETTINGS)));
  });

  test('fork の公開先とリポジトリを変えると Worker・中継・Actions・routes に反映する', () => {
    const fork = { ...config, origin: 'https://lessons.example/', repository: 'sample/lessons' };
    expect(JSON.parse(workerSettings(fork))).toEqual({ origin: fork.origin, repository: fork.repository });
    expect(coreSettings(fork)).toContain(JSON.stringify(fork.origin));
    expect(mediaSettings(read(MEDIA_SETTINGS), fork)).toContain(JSON.stringify(fork.repository));
    const wrangler = JSON.parse(wranglerSettings(read('wrangler.jsonc'), fork));
    expect(wrangler.routes).toEqual([
      { pattern: 'lessons.example', custom_domain: true },
      { pattern: 'www.lessons.example', custom_domain: true },
    ]);
    for (const name of ['ci', 'deploy', 'canary']) {
      const result = workflowSettings(read(`.github/workflows/${name}.yml`), name === 'canary', fork);
      expect(result).toContain(`github.repository == '${fork.repository}'`);
      expect(result).not.toContain(config.repository);
      expect(result).not.toContain(new URL(config.origin).hostname);
      expect(result).toContain(new URL(fork.origin).origin);
    }
  });

  test('声の設定を変えるとエンジンに渡す値も変わる', () => {
    const changed = { ...config, voices: { ...config.voices, narrator: { ...config.voices.narrator, speed: 1.23 } } };
    expect(coreSettings(changed)).toContain('"speed": 1.23');
    expect(coreSettings(changed)).not.toBe(coreSettings());
  });

  test('生成先の routes や fork の制限が消えたら止める', () => {
    expect(() => languageSettings('')).toThrow('LANG_LIST');
    expect(() => mediaSettings('')).toThrow('MEDIA_REPOSITORY');
    expect(() => wranglerSettings('{}')).toThrow('公開先');
    expect(() => workflowSettings('jobs: {}')).toThrow('設定を書き出す場所');
  });
});
