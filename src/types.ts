export type Theme = 'light' | 'dark' | 'sepia' | 'nord' | 'midnight';
export type ViewMode = 'page' | 'continuous';
export type FontFamily = 'sans' | 'serif' | 'mono' | 'book';

export interface Bookmark {
  id: string;
  pageNumber: number;
  label: string;
  timestamp: number;
}

export interface ReadingStats {
  totalPagesRead: number;
  unlockedAchievements: string[];
  streak: number;
  longestStreak: number;
  lastReadDate: string;
  totalReadingMins?: number;
}

export interface ReaderSettings {
  theme: Theme;
  viewMode: ViewMode;
  fontFamily: FontFamily;
  fontSize: number;
  lineHeight: number;
  autoScrollSpeed: number;
  isAutoScrolling: boolean;
  backgroundMusic: string | null;
  volume: number;
  brightness: number;
  renderQuality: number;
  autoNightMode?: boolean;
  stats?: ReadingStats;
}

export interface BookMetadata {
  id: string;
  title: string;
  originalName?: string;
  author?: string;
  totalPages: number;
  currentPage: number;
  maxPageReached?: number;
  lastRead: number;
  bookmarks: Bookmark[];
  coverImage?: string;
}

export interface TocItem {
  title: string;
  page: number;
  level: number;
}
