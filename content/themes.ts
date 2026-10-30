import type { Theme } from './types';

/**
 * Chalkfile の既定のテーマ。明るい教室の黒板を裏返したような配色で、
 * 文字は黒板の深い緑、色はチョーク、コードの面だけ黒板の色にする。書体は角の丸いゴシック。
 */
export const CHALKFILE: Theme = {
  id: 'chalkfile',
  label: 'Chalkfile',
  summary: '明るい教室の黒板を裏返した配色。文字は黒板の緑、色はチョーク、コードだけ黒板の面に書く。角の丸いゴシック。',
  scheme: 'light',
  fonts: ['zen-maru'],
  color: {
    bg: '#F2F7F4',
    bg2: '#E6EFEA',
    surface: '#FFFFFF',
    surface2: '#F4F8F6',
    ink: '#14312A',
    sub: '#3D5A52',
    muted: '#728C84',
    line: '#D3E1DA',
    line2: '#A9BFB6',
    accent: '#FFC93C',
    onAccent: '#14312A',
    code: '#1E3A33',
  },
  shadow: '0 2px 0 rgba(20,49,42,0.06), 0 22px 44px -22px rgba(20,49,42,0.32)',
  gradient: ['#FFC93C', '#FF9E5E'],
  display: ['#14312A', '#2C7A63'],
  mesh: ['#FFC93C', '#FF9AB5', '#8FD3F2', '#9BE3C1'],
  tones: {
    pink: '#E0507F',
    violet: '#7458DA',
    cyan: '#1693C6',
    mint: '#1B9468',
    amber: '#D88B00',
    coral: '#DD5236',
    slate: '#6A827C',
  },
  syntax: { plain: '#F1F6F3', comment: '#8FAEA3', string: '#C4EE8C', keyword: '#FFB1C8', deco: '#FFCF8A', number: '#FFE07A', fn: '#A3DCF7' },
  decor: 'chalk',
  radius: 18,
};

/**
 * Stripe の雰囲気のテーマ（Stripe 社とは関係ない）。白い地・紺の文字・紫の主役の色・斜めのグラデーションの帯。
 * ロゴや社名の書体は使わない。英字は Inter、日本語は Noto Sans JP。
 */
export const STRIPE: Theme = {
  id: 'stripe',
  label: 'Stripe 風',
  summary: '白い地に紺の文字、紫の主役の色、角を斜めに切るグラデーションの帯。英字は Inter。ロゴや社名の書体は使わない。',
  scheme: 'light',
  fonts: ['inter', 'noto'],
  color: {
    bg: '#F6F9FC',
    bg2: '#FFFFFF',
    surface: '#FFFFFF',
    surface2: '#F6F9FC',
    ink: '#0A2540',
    sub: '#425466',
    muted: '#7A8CA1',
    line: '#E3E8EE',
    line2: '#C4CDD5',
    accent: '#635BFF',
    onAccent: '#FFFFFF',
    code: '#0D1F36',
  },
  shadow: '0 13px 27px -5px rgba(50,50,93,0.22), 0 8px 16px -8px rgba(0,0,0,0.22)',
  gradient: ['#635BFF', '#A960EE'],
  display: ['#7A73FF', '#4B3FE0'],
  mesh: ['#A960EE', '#FF5C7A', '#FFCB57', '#80E9FF'],
  tones: {
    pink: '#E3367E',
    violet: '#635BFF',
    cyan: '#0A93D6',
    mint: '#0E9F70',
    amber: '#E58F00',
    coral: '#E0464C',
    slate: '#6B7C93',
  },
  syntax: { plain: '#E6EBF1', comment: '#7E91AD', string: '#62E3B4', keyword: '#B9A6FF', deco: '#FFB878', number: '#FFC66D', fn: '#80E9FF' },
  decor: 'band',
  radius: 12,
};

/** 最初の版の暗いテーマ（濃紺の地・ピンクから水色のグラデーション・光の粒） */
export const NIGHT: Theme = {
  id: 'night',
  label: 'Night',
  summary: '最初の版の暗いテーマ。濃紺の地に、ピンクから水色のグラデーションと光の粒。',
  scheme: 'dark',
  fonts: ['noto'],
  color: {
    bg: '#090D22',
    bg2: '#11173A',
    surface: '#1A2046',
    surface2: '#121838',
    ink: '#F4F6FF',
    sub: '#BCC3E2',
    muted: '#858EB3',
    line: '#2A3160',
    line2: '#3B4378',
    accent: '#9C8CFF',
    onAccent: '#0B0F24',
    code: '#0C1130',
  },
  shadow: '0 24px 60px rgba(3,6,20,0.55)',
  gradient: ['#FF6FA3', '#9C8CFF', '#45D3F4'],
  display: ['#FF6FA3', '#9C8CFF', '#45D3F4'],
  mesh: ['#FF6FA3', '#9C8CFF', '#45D3F4', '#4CE2B2'],
  tones: {
    pink: '#FF6FA3',
    violet: '#9C8CFF',
    cyan: '#45D3F4',
    mint: '#4CE2B2',
    amber: '#FFC260',
    coral: '#FF8A6A',
    slate: '#97A2C6',
  },
  syntax: { plain: '#E6E9FA', comment: '#7F89B0', string: '#8EF0C6', keyword: '#FF8FB8', deco: '#FFB38A', number: '#FFC260', fn: '#7FDBFF' },
  decor: 'stars',
  radius: 26,
};

export const THEMES: Record<string, Theme> = { chalkfile: CHALKFILE, stripe: STRIPE, night: NIGHT };

export const DEFAULT_THEME = 'chalkfile';

export const themeOf = (id?: string): Theme => {
  const t = THEMES[id || DEFAULT_THEME];
  if (!t) throw new Error(`テーマが見つからない: ${id}（content/themes.ts の THEMES に足す）`);
  return t;
};
