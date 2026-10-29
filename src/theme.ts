import { loadFont as loadJetBrains } from '@remotion/google-fonts/JetBrainsMono';
import { loadFont as loadNoto } from '@remotion/google-fonts/NotoSansJP';
import type { Tone } from '../content/types';

export const { fontFamily: SANS } = loadNoto('normal', { weights: ['400', '500', '700', '900'] });
export const { fontFamily: MONO_FAMILY } = loadJetBrains('normal', { weights: ['400', '500', '700'], subsets: ['latin'] });
export const MONO = `${MONO_FAMILY}, ${SANS}`;

export const W = 1920;
export const H = 1080;
export const PAD = 96;
export const CONTENT_TOP = 228;
export const CONTENT_BOTTOM = 1000;

export const C = {
  bg0: '#090D22',
  bg1: '#11173A',
  ink: '#F4F6FF',
  sub: '#BCC3E2',
  muted: '#858EB3',
  line: 'rgba(255,255,255,0.10)',
  line2: 'rgba(255,255,255,0.18)',
  glass: 'rgba(255,255,255,0.055)',
  glass2: 'rgba(255,255,255,0.085)',
  shadow: '0 24px 60px rgba(3,6,20,0.55)',
};

export const TONES: Record<Tone, { main: string; soft: string; deep: string; text: string }> = {
  pink: { main: '#FF6FA3', soft: 'rgba(255,111,163,0.15)', deep: 'rgba(255,111,163,0.32)', text: '#FFB3CD' },
  violet: { main: '#9C8CFF', soft: 'rgba(156,140,255,0.15)', deep: 'rgba(156,140,255,0.32)', text: '#CBC3FF' },
  cyan: { main: '#45D3F4', soft: 'rgba(69,211,244,0.14)', deep: 'rgba(69,211,244,0.30)', text: '#A8EBFB' },
  mint: { main: '#4CE2B2', soft: 'rgba(76,226,178,0.14)', deep: 'rgba(76,226,178,0.30)', text: '#A9F3DB' },
  amber: { main: '#FFC260', soft: 'rgba(255,194,96,0.14)', deep: 'rgba(255,194,96,0.30)', text: '#FFE0AE' },
  coral: { main: '#FF8A6A', soft: 'rgba(255,138,106,0.15)', deep: 'rgba(255,138,106,0.32)', text: '#FFC2B1' },
  slate: { main: '#97A2C6', soft: 'rgba(151,162,198,0.13)', deep: 'rgba(151,162,198,0.26)', text: '#D3D9EE' },
};

export const GRAD = 'linear-gradient(110deg, #FF6FA3 0%, #9C8CFF 48%, #45D3F4 100%)';
export const GRAD_SOFT = 'linear-gradient(110deg, rgba(255,111,163,0.22) 0%, rgba(156,140,255,0.22) 50%, rgba(69,211,244,0.22) 100%)';

export const tone = (t?: Tone) => TONES[t ?? 'violet'];
