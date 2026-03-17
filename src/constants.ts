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
  renderQuality: 2,
  stats: {
    totalPagesRead: 0,
    unlockedAchievements: [],
    streak: 0,
    longestStreak: 0,
    lastReadDate: '',
  },
};

export const ACHIEVEMENTS = [
  { id: 'a1', pages: 1, title: 'The First Step', icon: '🚶' },
  { id: 'a5', pages: 5, title: 'Warmed Up', icon: '🔥' },
  { id: 'a10', pages: 10, title: 'Getting Into It', icon: '👀' },
  { id: 'a20', pages: 20, title: 'Flow State Initiated', icon: '🌊' },
  { id: 'a50', pages: 50, title: 'Page Explorer', icon: '🧭' },
  { id: 'a75', pages: 75, title: 'Momentum Builder', icon: '⚡' },
  { id: 'a100', pages: 100, title: 'Century Mind', icon: '💯' },
  { id: 'a150', pages: 150, title: 'Deep Diver', icon: '🤿' },
  { id: 'a200', pages: 200, title: 'Story Absorber', icon: '🧠' },
  { id: 'a300', pages: 300, title: 'Narrative Navigator', icon: '🗺️' },
  { id: 'a500', pages: 500, title: 'Half-K Saga', icon: '⚔️' },
  { id: 'a750', pages: 750, title: 'Ink Warrior', icon: '🗡️' },
  { id: 'a1000', pages: 1000, title: 'One Thousand Club', icon: '👑' },
  { id: 'a1500', pages: 1500, title: 'Mind Architect', icon: '🏛️' },
  { id: 'a2000', pages: 2000, title: 'Legendary Reader', icon: '🌟' },
  { id: 'a3000', pages: 3000, title: 'Library Within', icon: '📚' },
  { id: 'a5000', pages: 5000, title: 'Walking Encyclopedia', icon: '🧠' },
  { id: 'a7500', pages: 7500, title: 'Ink Immortal', icon: '♾️' },
  { id: 'a10000', pages: 10000, title: 'The Grand Scholar', icon: '🎓' },
];

export const STREAK_ACHIEVEMENTS = [
  { days: 2, title: 'Back Again', icon: '🔥' },
  { days: 5, title: '5-Day Streak', icon: '🔥' },
  { days: 7, title: 'Week Reader', icon: '🗓️' },
  { days: 14, title: 'Two Weeks Strong', icon: '⚡' },
  { days: 30, title: 'Monthly Habit', icon: '🏆' },
  { days: 60, title: 'Reading Machine', icon: '🤖' },
  { days: 100, title: 'Century Streak', icon: '💎' },
  { days: 365, title: 'Year of Knowledge', icon: '👑' },
];

export const FONT_FAMILIES: Record<string, string> = {
  sans: 'Inter, sans-serif',
  serif: 'Georgia, serif',
  mono: 'JetBrains Mono, monospace',
  book: 'Crimson Text, serif',
};

export const BACKGROUND_TRACKS = [
  { id: 'gamma', name: 'Gamma Waves', url: 'https://cdn.pixabay.com/download/audio/2022/11/08/audio_10f0f8a845.mp3?filename=gamma-binaural-beat-14-hz-to-30-hz-123456.mp3' },
  { id: 'rain', name: 'Soft Rain', url: 'https://cdn.pixabay.com/download/audio/2021/08/09/audio_dc39bde808.mp3?filename=soft-rain-ambient-111154.mp3' },
  { id: 'ocean', name: 'Ocean Tides', url: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=ocean-waves-112906.mp3' },
];

export const MAX_PDF_SIZE_MB = 40;
export const MAX_PDF_SIZE_BYTES = MAX_PDF_SIZE_MB * 1024 * 1024;
