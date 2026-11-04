// プロジェクトの設定を、エンジンと Worker が読む純粋なデータに書き出す。
import config from '../chalkfile.config';
import { THEMES } from '../content/themes';
export const CORE_SETTINGS = 'engine/core/project-settings.ts';
export const WORKER_SETTINGS = 'worker/src/generated/project-settings.json';
export const coreSettings = (settings = config) =>
  [
    '// npm run gen が chalkfile.config.ts から作る。手で直さない。',
    ...Object.entries({
      DEFAULT_THEME: settings.defaultTheme,
      THEME_IDS: Object.keys(THEMES),
      VOICES: settings.voices,
      KOKORO: settings.translatedVoices,
      ORIGIN: settings.origin,
    }).map(([key, value]) => `export const ${key} = ${JSON.stringify(value, null, 2)} as const;`),
    '',
  ].join('\n');
export const workerSettings = (settings = config) =>
  `${JSON.stringify({ origin: settings.origin, repository: settings.repository }, null, 2)}\n`;

/** 言語の値だけを書き換える。宣言を同じファイルに保ち、SW の bundle を変えない。 */
export const LANGUAGE_SETTINGS = 'engine/core/langs.ts';
export const languageSettings = (source: string, settings = config): string =>
  replaceSetting(
    replaceSetting(
      source,
      /const LANG_LIST = .*? as const;/,
      `const LANG_LIST = ${JSON.stringify(Object.keys(settings.languages))} as const;`,
      'LANG_LIST',
    ),
    /export const LANG_INFO: Record<Lang, \{ label: string; html: string; path: string \}> = \{[\s\S]*?\n\};/,
    `export const LANG_INFO: Record<Lang, { label: string; html: string; path: string }> = ${JSON.stringify(settings.languages, null, 2)};`,
    'LANG_INFO',
  );

export const MEDIA_SETTINGS = 'site/media-shared.ts';
export const mediaSettings = (source: string, settings = config): string =>
  replaceSetting(
    source,
    /export const MEDIA_REPOSITORY = .*?;/,
    `export const MEDIA_REPOSITORY = ${JSON.stringify(settings.repository)};`,
    'MEDIA_REPOSITORY',
  );

/** 設定の値を埋める場所が消えたら、古い値を残さず止める。 */
export const replaceSetting = (source: string, pattern: RegExp, value: string, where: string): string => {
  if (!pattern.test(source)) throw new Error(`設定を書き出す場所が無い: ${where}`);
  pattern.lastIndex = 0;
  return source.replace(pattern, () => value);
};

/** Actions の fork の制限と公開先も、この設定から作る。手順と権限は変えない。 */
export const workflowSettings = (source: string, canary = false, settings = config): string => {
  let text = replaceSetting(
    source,
    /github.repository == '[^']+'/g,
    `github.repository == '${settings.repository}'`,
    'workflow repository',
  );
  if (!canary) {
    text = replaceSetting(text, /url: https:\/\/\S+/, `url: ${new URL(settings.origin).origin}`, 'workflow origin');
  } else {
    text = replaceSetting(
      text,
      /worker-site-smoke\.ts https:\/\/\S+/,
      `worker-site-smoke.ts ${settings.origin}`,
      'canary smoke',
    );
    text = replaceSetting(
      text,
      /<link rel="canonical" href="[^"]+">/,
      `<link rel="canonical" href="${settings.origin}">`,
      'canary canonical',
    );
    text = replaceSetting(text, /\{"target":"[^"]+"\}/, JSON.stringify({ target: settings.origin }), 'canary target');
  }
  return text;
};

export const wranglerSettings = (source: string, settings = config): string => {
  const host = new URL(settings.origin).hostname;
  const hosts = [host, `www.${host}`];
  let at = 0;
  const result = source.replace(
    /("pattern": ")[^"]+(", "custom_domain": true)/g,
    (_match, before: string, after: string) => `${before}${hosts[at++]}${after}`,
  );
  if (at !== hosts.length) throw new Error('wrangler の公開先は origin と www の 2 つにする');
  return result;
};
