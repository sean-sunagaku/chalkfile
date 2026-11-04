// サイトの固定の文字も書体に入れる。言語ごとの辞書と HTML を読む（コメントや属性の文字も含め、取りこぼさない）。
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Lang } from '../../content/i18n';
import { ROOT } from '../lib/paths';

export const siteFontText = (lang: Lang): string[] => [
  readFileSync(path.join(ROOT, 'site/i18n', `${lang}.ts`), 'utf8'),
  ...['home', 'template', 'offline', 'offline-panel', 'not-found'].map((name) =>
    readFileSync(path.join(ROOT, 'site', `${name}.html`), 'utf8'),
  ),
];
