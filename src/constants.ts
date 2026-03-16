import { Theme, ReaderSettings } from './types';

export const THEMES: Record<Theme, { bg: string; text: string; accent: string; secondary: string }> = {
  light: {
    bg: '#FFFFFF',
    text: '#1A1A1A',
    accent: '#3B82F6',
    secondary: '#F3F4F6',
  },
  dark: {
    bg: '#111827',
    text: '#F9FAFB',
    accent: '#60A5FA',
    secondary: '#1F2937',
  },
  sepia: {
    bg: '#F4ECD8',
    text: '#5B4636',
    accent: '#946B49',
    secondary: '#EAE0C9',
  },
  nord: {
    bg: '#2E3440',
    text: '#ECEFF4',
    accent: '#88C0D0',
    secondary: '#3B4252',
  },
  midnight: {
    bg: '#000000',
    text: '#E5E7EB',
    accent: '#8B5CF6',
    secondary: '#111111',
  },
};

export const DEFAULT_SETTINGS: ReaderSettings = {
  theme: 'light',
  viewMode: 'page',
  fontFamily: 'sans',
  fontSize: 100,
  lineHeight: 1.5,
  autoScrollSpeed: 0,
  isAutoScrolling: false,
  backgroundMusic: null,
  volume: 0.5,
  brightness: 100,
};

export const FONT_FAMILIES: Record<string, string> = {
  sans: 'Inter, sans-serif',
  serif: 'Georgia, serif',
  mono: 'JetBrains Mono, monospace',
  book: 'Crimson Text, serif',
};

export const BACKGROUND_TRACKS = [
  { id: 'lofi', name: 'Lofi Study', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { id: 'rain', name: 'Soft Rain', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { id: 'piano', name: 'Classical Piano', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
];
