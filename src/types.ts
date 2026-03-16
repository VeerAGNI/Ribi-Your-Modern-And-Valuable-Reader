export type Theme = 'light' | 'dark' | 'sepia' | 'nord' | 'midnight';
export type ViewMode = 'page' | 'continuous';
export type FontFamily = 'sans' | 'serif' | 'mono' | 'book';

export interface Bookmark {
  id: string;
  pageNumber: number;
  label: string;
  timestamp: number;
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
}

export interface BookMetadata {
  id: string;
  title: string;
  author?: string;
  totalPages: number;
  currentPage: number;
  lastRead: number;
  bookmarks: Bookmark[];
}
