import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Library } from './components/Library';
import { PDFReader } from './components/PDFReader';
import { SettingsPanel } from './components/SettingsPanel';
import { MusicPlayer } from './components/MusicPlayer';
import { SplashScreen } from './components/SplashScreen';
import { AuthScreen } from './components/AuthScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AchievementToast } from './components/AchievementToast';
import { BookMetadata, ReaderSettings, Bookmark, ReadingStats } from './types';
import { DEFAULT_SETTINGS, THEMES, ACHIEVEMENTS, STREAK_ACHIEVEMENTS, BACKGROUND_TRACKS } from './constants';
import { Book, Settings, Library as LibraryIcon, Bookmark as BookmarkIcon, ChevronLeft, X, LogOut, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './utils';
import { auth, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import localforage from 'localforage';
import { Howl } from 'howler';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
}

function logFirestoreError(error: unknown, op: OperationType, path: string | null) {
  console.error('Firestore error:', {
    error: error instanceof Error ? error.message : String(error),
    op,
    path,
    userId: auth.currentUser?.uid,
  });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function yesterdayStr() {
  return new Date(Date.now() - 86400000).toISOString().slice(0, 10);
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [books, setBooks] = useState<BookMetadata[]>([]);
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<File | Blob | null>(null);
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'library' | 'settings' | 'bookmarks' | 'about'>('library');

  const [achievementQueue, setAchievementQueue] = useState<{ title: string; icon: string }[]>([]);
  const [currentAchievement, setCurrentAchievement] = useState<{ title: string; icon: string } | null>(null);
  const achievementBusyRef = useRef(false);
  const sessionShownAchievementsRef = useRef<Set<string>>(new Set());

  const soundRef = useRef<Howl | null>(null);
  const settingsRef = useRef<ReaderSettings>(settings);
  settingsRef.current = settings;

  // Process achievement queue — one at a time
  useEffect(() => {
    if (achievementQueue.length === 0) return;
    if (achievementBusyRef.current) return;
    achievementBusyRef.current = true;
    const next = achievementQueue[0];
    setCurrentAchievement(next);
    setAchievementQueue(q => q.slice(1));
  }, [achievementQueue]);

  const handleAchievementClose = useCallback(() => {
    setCurrentAchievement(null);
    setTimeout(() => {
      achievementBusyRef.current = false;
      setAchievementQueue(q => {
        if (q.length > 0) {
          achievementBusyRef.current = true;
          const next = q[0];
          setCurrentAchievement(next);
          return q.slice(1);
        }
        return q;
      });
    }, 600);
  }, []);

  // Background music
  useEffect(() => {
    if (settings.backgroundMusic) {
      const track = BACKGROUND_TRACKS.find(t => t.id === settings.backgroundMusic);
      if (track) {
        if (soundRef.current) { soundRef.current.stop(); soundRef.current.unload(); }
        soundRef.current = new Howl({
          src: [track.url],
          html5: true,
          loop: true,
          volume: settings.volume,
          onloaderror: (_id: any, err: any) => console.warn('Music load error:', err),
        });
        soundRef.current.play();
      }
    } else {
      if (soundRef.current) { soundRef.current.stop(); soundRef.current.unload(); soundRef.current = null; }
    }
    return () => { if (soundRef.current) soundRef.current.stop(); };
  }, [settings.backgroundMusic]);

  useEffect(() => {
    if (soundRef.current) soundRef.current.volume(settings.volume);
  }, [settings.volume]);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => { setUser(u); setAuthReady(true); });
    return () => unsub();
  }, []);

  // Firestore sync
  useEffect(() => {
    if (!user) return;
    const settingsDocRef = doc(db, 'users', user.uid, 'settings', 'reader');
    const unsubSettings = onSnapshot(settingsDocRef, snap => {
      if (snap.exists()) {
        const data = snap.data() as ReaderSettings;
        setSettings(s => ({
          ...DEFAULT_SETTINGS,
          ...s,
          ...data,
          stats: { ...DEFAULT_SETTINGS.stats, ...(s.stats || {}), ...(data.stats || {}) },
        }));
      } else {
        setDoc(settingsDocRef, { ...DEFAULT_SETTINGS, uid: user.uid }).catch(e =>
          logFirestoreError(e, OperationType.CREATE, `users/${user.uid}/settings/reader`)
        );
      }
    }, e => logFirestoreError(e, OperationType.GET, `users/${user.uid}/settings/reader`));

    const booksRef = collection(db, 'users', user.uid, 'books');
    const unsubBooks = onSnapshot(booksRef, snap => {
      const loaded: BookMetadata[] = [];
      snap.forEach(d => loaded.push(d.data() as BookMetadata));
      setBooks(loaded);
    }, e => logFirestoreError(e, OperationType.LIST, `users/${user.uid}/books`));

    return () => { unsubSettings(); unsubBooks(); };
  }, [user]);

  // Load active file when activeBookId changes
  useEffect(() => {
    if (!activeBookId || activeFile) return;
    localforage.getItem<Blob>(`pdf_${activeBookId}`).then(blob => {
      if (blob) setActiveFile(blob);
      else { console.warn('PDF not found in local storage for book', activeBookId); setActiveBookId(null); }
    }).catch(e => { console.error('Error loading PDF from storage:', e); setActiveBookId(null); });
  }, [activeBookId, activeFile]);

  const updateSettings = useCallback(async (updates: Partial<ReaderSettings>) => {
    if (!user) { setSettings(s => ({ ...s, ...updates })); return; }
    const newSettings = { ...settingsRef.current, ...updates };
    setSettings(newSettings);
    try {
      await setDoc(doc(db, 'users', user.uid, 'settings', 'reader'), { ...newSettings, uid: user.uid }, { merge: true });
    } catch (e) {
      logFirestoreError(e, OperationType.UPDATE, `users/${user.uid}/settings/reader`);
    }
  }, [user]);

  const handleUpload = async (file: File, customTitle?: string) => {
    let coverImage: string | undefined;
    let totalPages = 0;
    let title = customTitle || file.name.replace(/\.pdf$/i, '').trim() || 'Untitled PDF';

    try {
      const url = URL.createObjectURL(file);
      const loadingTask = pdfjsLib.getDocument({ url, verbosity: 0 });
      const pdf = await loadingTask.promise;
      totalPages = pdf.numPages;
      if (!customTitle) {
        try {
          const meta = await pdf.getMetadata();
          const info = (meta?.info as any) || {};
          if (info?.Title?.trim() && info.Title.trim().length > 1) title = info.Title.trim();
        } catch { /* ignore */ }
      }
      if (totalPages > 0) {
        try {
          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 0.4 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width; canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            await page.render({ canvasContext: ctx, viewport } as any).promise;
            coverImage = canvas.toDataURL('image/jpeg', 0.7);
          }
        } catch { /* cover is optional */ }
      }
      pdf.destroy();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error extracting PDF metadata during upload:', err);
    }

    const newBook: BookMetadata = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      originalName: file.name,
      totalPages,
      currentPage: 1,
      lastRead: Date.now(),
      bookmarks: [],
      ...(coverImage ? { coverImage } : {}),
    };

    try {
      await localforage.setItem(`pdf_${newBook.id}`, file);
      if (user) await setDoc(doc(db, 'users', user.uid, 'books', newBook.id), { ...newBook, uid: user.uid });
      setActiveBookId(newBook.id);
      setActiveFile(file);
      setSidebarOpen(false);
    } catch (err: any) {
      console.error('Error saving PDF:', err);
      if (err?.name === 'QuotaExceededError' || err?.message?.includes('quota')) {
        alert('Not enough storage space on this device. Please free up some space and try again.');
      } else {
        alert('Failed to save PDF. Please try again.');
      }
    }
  };

  const handleSelectBook = async (id: string) => {
    setActiveBookId(id);
    setSidebarOpen(false);
    if (user) {
      const book = books.find(b => b.id === id);
      if (book) {
        setDoc(doc(db, 'users', user.uid, 'books', id), { ...book, lastRead: Date.now(), uid: user.uid }, { merge: true })
          .catch(e => logFirestoreError(e, OperationType.UPDATE, `users/${user.uid}/books/${id}`));
      }
    }
    try {
      const blob = await localforage.getItem<Blob>(`pdf_${id}`);
      if (blob) setActiveFile(blob);
      else { alert('PDF not found on this device. It may have been cleared by the browser.'); setActiveBookId(null); }
    } catch (err) {
      console.error('Error loading PDF:', err);
      setActiveBookId(null);
    }
  };

  const handleDeleteBook = async (id: string) => {
    if (activeBookId === id) { setActiveBookId(null); setActiveFile(null); }
    try {
      await localforage.removeItem(`pdf_${id}`);
      if (user) await deleteDoc(doc(db, 'users', user.uid, 'books', id));
    } catch (err) {
      console.error('Error deleting book:', err);
    }
  };

  const handlePageChange = useCallback(async (page: number) => {
    if (!activeBookId || !user) return;
    const book = books.find(b => b.id === activeBookId);
    if (!book) return;

    const prevMax = book.maxPageReached || 0;
    const maxPageReached = Math.max(prevMax, page);
    const pagesReadDiff = maxPageReached - prevMax;

    setDoc(doc(db, 'users', user.uid, 'books', activeBookId), { ...book, currentPage: page, maxPageReached, uid: user.uid }, { merge: true })
      .catch(e => logFirestoreError(e, OperationType.UPDATE, `users/${user.uid}/books/${activeBookId}`));

    if (pagesReadDiff > 0) {
      const stats: ReadingStats = {
        totalPagesRead: 0,
        unlockedAchievements: [],
        streak: 0,
        longestStreak: 0,
        lastReadDate: '',
        ...(settingsRef.current.stats || {}),
      };
      const newTotal = stats.totalPagesRead + pagesReadDiff;

      // === Streak logic ===
      const today = todayStr();
      const yesterday = yesterdayStr();
      let newStreak = stats.streak;
      let newLongest = stats.longestStreak;

      if (stats.lastReadDate !== today) {
        if (stats.lastReadDate === yesterday) {
          newStreak += 1;
        } else {
          newStreak = 1; // either first time or missed days → reset to 1
        }
        newLongest = Math.max(newLongest, newStreak);

        // Check streak achievements
        const streakAch = STREAK_ACHIEVEMENTS.filter(a => {
          const sid = `streak_${a.days}`;
          return newStreak >= a.days && !sessionShownAchievementsRef.current.has(sid);
        });
        if (streakAch.length > 0) {
          const highest = streakAch[streakAch.length - 1];
          const sid = `streak_${highest.days}`;
          sessionShownAchievementsRef.current.add(sid);
          setAchievementQueue(q => [...q, { title: `${highest.days}-Day Streak! ${highest.title}`, icon: highest.icon }]);
        }
      }

      // === Page achievements ===
      const alreadyUnlocked = stats.unlockedAchievements;
      const newlyUnlocked = ACHIEVEMENTS.filter(a =>
        newTotal >= a.pages &&
        !alreadyUnlocked.includes(a.id) &&
        !sessionShownAchievementsRef.current.has(a.id)
      );

      if (newlyUnlocked.length > 0) {
        newlyUnlocked.forEach(a => sessionShownAchievementsRef.current.add(a.id));
        const highest = newlyUnlocked[newlyUnlocked.length - 1];
        setAchievementQueue(q => [...q, { title: highest.title, icon: highest.icon }]);

        await updateSettings({
          stats: {
            totalPagesRead: newTotal,
            unlockedAchievements: [...alreadyUnlocked, ...newlyUnlocked.map(a => a.id)],
            streak: newStreak,
            longestStreak: newLongest,
            lastReadDate: today,
          },
        });
      } else {
        updateSettings({
          stats: {
            ...stats,
            totalPagesRead: newTotal,
            streak: newStreak,
            longestStreak: newLongest,
            lastReadDate: today,
          },
        });
      }
    }
  }, [activeBookId, user, books, updateSettings]);

  const toggleBookmark = async (page: number) => {
    if (!activeBookId || !user) return;
    const book = books.find(b => b.id === activeBookId);
    if (!book) return;
    const exists = book.bookmarks.find(bm => bm.pageNumber === page);
    const newBookmarks = exists
      ? book.bookmarks.filter(bm => bm.pageNumber !== page)
      : [...book.bookmarks, { id: Math.random().toString(36).slice(2, 9), pageNumber: page, label: `Page ${page}`, timestamp: Date.now() }];
    setDoc(doc(db, 'users', user.uid, 'books', activeBookId), { ...book, bookmarks: newBookmarks, uid: user.uid }, { merge: true })
      .catch(e => logFirestoreError(e, OperationType.UPDATE, `users/${user.uid}/books/${activeBookId}`));
  };

  // Auto night mode — switches to Midnight at 9 PM, restores Light at 6 AM
  useEffect(() => {
    if (!settings.autoNightMode) return;
    const check = () => {
      const h = new Date().getHours();
      const isNight = h >= 21 || h < 6;
      const isDark = settings.theme === 'midnight' || settings.theme === 'dark' || settings.theme === 'nord';
      if (isNight && !isDark) updateSettings({ theme: 'midnight' });
      if (!isNight && settings.theme === 'midnight') updateSettings({ theme: 'light' });
    };
    check();
    const id = setInterval(check, 60000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.autoNightMode]);

  const activeBook = books.find(b => b.id === activeBookId);
  const currentTheme = THEMES[settings.theme];
  const streak = settings.stats?.streak || 0;
  const totalPages = settings.stats?.totalPagesRead || 0;

  if (showSplash) return <SplashScreen onComplete={() => setShowSplash(false)} />;

  if (!authReady) {
    return (
      <div className="flex h-screen w-screen items-center justify-center" style={{ background: '#00040F' }}>
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  return (
    <ErrorBoundary>
      <div
        className="flex h-screen w-screen overflow-hidden font-sans transition-colors duration-500"
        style={{ backgroundColor: currentTheme.bg, color: currentTheme.text }}
      >
        <AchievementToast achievement={currentAchievement} onClose={handleAchievementClose} />

        {/* Sidebar toggle */}
        <motion.button
          whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
          onClick={() => setSidebarOpen(true)}
          className="fixed top-5 left-5 z-40 p-3 rounded-2xl backdrop-blur-xl border shadow-xl transition-all"
          style={{ color: currentTheme.text, background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.12)', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}
        >
          <LibraryIcon size={22} />
        </motion.button>

        {/* Close book button */}
        {activeBookId && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
            onClick={() => { setActiveBookId(null); setActiveFile(null); }}
            className="fixed top-5 right-5 z-40 p-3 rounded-2xl backdrop-blur-xl border shadow-xl transition-all text-red-400 hover:text-red-300"
            style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.15)' }}
            title="Close book"
          >
            <X size={22} />
          </motion.button>
        )}

        {/* Main content */}
        <main className="flex-1 relative h-full overflow-hidden">
          {activeBookId && (activeFile || activeBook) ? (
            <ErrorBoundary>
              <PDFReader
                file={activeFile || ''}
                currentPage={activeBook?.currentPage || 1}
                onPageChange={handlePageChange}
                onUpdate={updateSettings}
                theme={settings.theme}
                viewMode={settings.viewMode}
                fontFamily={settings.fontFamily}
                brightness={settings.brightness}
                fontSize={settings.fontSize}
                lineHeight={settings.lineHeight}
                isAutoScrolling={settings.isAutoScrolling}
                autoScrollSpeed={settings.autoScrollSpeed}
                renderQuality={settings.renderQuality ?? 2}
                bookmarks={activeBook?.bookmarks || []}
                onToggleBookmark={toggleBookmark}
              />
            </ErrorBoundary>
          ) : (
            <div className="w-full h-full overflow-y-auto custom-scrollbar">
              <div className="min-h-full flex flex-col items-center justify-center text-center px-6 py-14">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="max-w-md w-full"
              >
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8"
                  style={{ background: `${currentTheme.accent}18`, color: currentTheme.accent }}>
                  <Book size={40} />
                </div>
                <h2 className="text-4xl font-bold mb-3 tracking-tight">
                  Welcome, {user.displayName?.split(' ')[0] || 'Reader'}
                </h2>
                <p className="opacity-50 mb-1 text-base">Your personal reading companion, Ribi, is here.</p>
                <p className="font-semibold mb-8 text-base" style={{ color: currentTheme.accent }}>
                  Ribi Missed You.
                </p>

                {/* Duolingo-style streak card */}
                <div
                  className="mx-auto mb-8 px-6 py-5 rounded-3xl flex items-center gap-5 max-w-sm"
                  style={{
                    background: streak > 0
                      ? 'linear-gradient(135deg, rgba(251,146,60,0.15), rgba(249,115,22,0.08))'
                      : `${currentTheme.secondary}`,
                    border: streak > 0
                      ? '1px solid rgba(251,146,60,0.3)'
                      : `1px solid ${currentTheme.text}10`,
                  }}
                >
                  <div className="text-5xl select-none" style={{ filter: streak === 0 ? 'grayscale(1) opacity(0.3)' : 'none' }}>
                    🔥
                  </div>
                  <div className="text-left">
                    <div className="flex items-baseline gap-1.5">
                      <span
                        className="text-4xl font-black tracking-tight"
                        style={{ color: streak > 0 ? '#F97316' : currentTheme.text, opacity: streak > 0 ? 1 : 0.25 }}
                      >
                        {streak}
                      </span>
                      <span className="text-sm font-semibold opacity-60" style={{ color: currentTheme.text }}>
                        day streak
                      </span>
                    </div>
                    <p className="text-xs opacity-40 mt-0.5" style={{ color: currentTheme.text }}>
                      {streak === 0
                        ? 'Read today to start your streak!'
                        : streak === 1
                        ? 'Great start! Come back tomorrow.'
                        : `${totalPages.toLocaleString()} pages read total`}
                    </p>
                  </div>
                  {streak >= 7 && (
                    <div className="ml-auto text-right">
                      <div className="text-xs font-bold px-2 py-1 rounded-full"
                        style={{ background: 'rgba(251,146,60,0.2)', color: '#F97316' }}>
                        {streak >= 30 ? '🏆' : streak >= 14 ? '⚡' : '🗓️'} {streak >= 30 ? 'Epic' : streak >= 14 ? 'Strong' : 'Week'}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16">
                  {books.length > 0 && (
                    <button
                      onClick={() => {
                        const last = [...books].sort((a, b) => b.lastRead - a.lastRead)[0];
                        if (last) handleSelectBook(last.id);
                      }}
                      className="px-8 py-4 text-white rounded-2xl font-bold shadow-xl transition-all w-full sm:w-auto active:scale-95"
                      style={{ background: currentTheme.accent, boxShadow: `0 12px 30px ${currentTheme.accent}40` }}
                    >
                      Pick Up Where You Left
                    </button>
                  )}
                  <button
                    onClick={() => { setSidebarOpen(true); setActiveTab('library'); }}
                    className="px-8 py-4 rounded-2xl font-bold transition-all w-full sm:w-auto border active:scale-95"
                    style={{ background: currentTheme.secondary, borderColor: `${currentTheme.text}10`, color: currentTheme.text }}
                  >
                    Explore Library
                  </button>
                </div>

                <div className="text-xs opacity-40 space-y-1.5 max-w-md mx-auto">
                  <p>© 2024 Veuros. All rights reserved.</p>
                  <p>Veuros — visionized by Veer Agnihotri in 2024, blending technology with life-changing habits.</p>
                  <p className="font-bold mt-3 text-sm"
                    style={{ background: 'linear-gradient(90deg,#fde68a,#f59e0b,#f97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', opacity: 1 }}>
                    Founded by Veer Agnihotri
                  </p>
                </div>
              </motion.div>
              </div>
            </div>
          )}
        </main>

        {/* Sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setSidebarOpen(false)}
                className="fixed inset-0 z-40"
                style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}
              />
              <motion.aside
                initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 260, mass: 0.8 }}
                className="fixed top-0 left-0 bottom-0 w-full max-w-sm z-50 flex shadow-2xl"
                style={{ backgroundColor: currentTheme.bg }}
              >
                {/* Nav rail */}
                <div
                  className="w-[72px] flex flex-col items-center py-8 gap-6 border-r"
                  style={{ backgroundColor: currentTheme.secondary, borderColor: `${currentTheme.text}08` }}
                >
                  {/* Streak mini badge at top of nav */}
                  {streak > 0 && (
                    <div className="flex flex-col items-center gap-0.5 pb-2 border-b w-full justify-center"
                      style={{ borderColor: `${currentTheme.text}10` }}>
                      <span className="text-xl">🔥</span>
                      <span className="text-[10px] font-black" style={{ color: '#F97316' }}>{streak}</span>
                    </div>
                  )}

                  {([
                    { id: 'library' as const, icon: LibraryIcon },
                    { id: 'bookmarks' as const, icon: BookmarkIcon },
                    { id: 'settings' as const, icon: Settings },
                    { id: 'about' as const, icon: Info },
                  ] as const).map(({ id, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => setActiveTab(id)}
                      className={cn('p-3 rounded-2xl transition-all', activeTab === id ? 'shadow-lg' : 'opacity-30 hover:opacity-70')}
                      style={{
                        background: activeTab === id ? currentTheme.accent : 'transparent',
                        color: activeTab === id ? '#fff' : currentTheme.text,
                        boxShadow: activeTab === id ? `0 4px 16px ${currentTheme.accent}40` : undefined,
                      }}
                    >
                      <Icon size={22} />
                    </button>
                  ))}

                  <div className="mt-auto flex flex-col items-center gap-4">
                    <button
                      onClick={() => auth.signOut()}
                      className="p-3 rounded-2xl opacity-30 hover:opacity-80 hover:text-red-500 transition-all"
                      style={{ color: currentTheme.text }}
                      title="Sign Out"
                    >
                      <LogOut size={22} />
                    </button>
                    <button
                      onClick={() => setSidebarOpen(false)}
                      className="p-3 rounded-2xl opacity-30 hover:opacity-80 transition-all"
                      style={{ color: currentTheme.text }}
                    >
                      <ChevronLeft size={22} />
                    </button>
                  </div>
                </div>

                {/* Sidebar content */}
                <div className="flex-1 overflow-hidden flex flex-col">
                  <div className="flex-1 overflow-y-auto">
                    {activeTab === 'library' && (
                      <Library
                        books={books}
                        onUpload={handleUpload}
                        onSelect={handleSelectBook}
                        onDelete={handleDeleteBook}
                        theme={settings.theme}
                      />
                    )}

                    {activeTab === 'settings' && (
                      <div className="flex flex-col h-full">
                        <SettingsPanel settings={settings} onUpdate={updateSettings} />
                        <div className="p-6 mt-auto">
                          <MusicPlayer
                            currentTrackId={settings.backgroundMusic}
                            volume={settings.volume}
                            onTrackChange={id => updateSettings({ backgroundMusic: id })}
                            onVolumeChange={v => updateSettings({ volume: v })}
                            theme={settings.theme}
                          />
                        </div>
                      </div>
                    )}

                    {activeTab === 'bookmarks' && (
                      <div className="p-6">
                        <h2 className="text-2xl font-bold mb-6" style={{ color: currentTheme.text }}>Bookmarks</h2>
                        {!activeBook ? (
                          <p className="text-sm opacity-40" style={{ color: currentTheme.text }}>Open a book to see bookmarks</p>
                        ) : activeBook.bookmarks.length === 0 ? (
                          <p className="text-sm opacity-40" style={{ color: currentTheme.text }}>No bookmarks yet</p>
                        ) : (
                          <div className="space-y-3">
                            {[...activeBook.bookmarks].sort((a, b) => a.pageNumber - b.pageNumber).map(bm => (
                              <button
                                key={bm.id}
                                onClick={() => { handleSelectBook(activeBook.id); handlePageChange(bm.pageNumber); setSidebarOpen(false); }}
                                className="w-full flex items-center gap-3 p-4 rounded-2xl transition-all hover:scale-[1.02] text-left"
                                style={{ backgroundColor: currentTheme.secondary, color: currentTheme.text }}
                              >
                                <BookmarkIcon size={16} style={{ color: currentTheme.accent }} className="shrink-0" />
                                <div>
                                  <p className="text-sm font-bold">{bm.label}</p>
                                  <p className="text-[10px] opacity-40">Page {bm.pageNumber}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'about' && (
                      <div className="p-6">
                        <h2 className="text-2xl font-bold mb-6" style={{ color: currentTheme.text }}>About Ribi</h2>
                        <div className="space-y-4 text-sm opacity-60" style={{ color: currentTheme.text }}>
                          <p>Ribi is your personal reading companion — built to help you read more, retain more, and enjoy more.</p>

                          {settings.stats && (
                            <div className="space-y-3">
                              {/* Streak card in about */}
                              <div
                                className="p-4 rounded-2xl flex items-center gap-4"
                                style={{
                                  background: streak > 0
                                    ? 'linear-gradient(135deg, rgba(251,146,60,0.15), rgba(249,115,22,0.08))'
                                    : currentTheme.secondary,
                                  border: streak > 0 ? '1px solid rgba(251,146,60,0.25)' : 'none',
                                }}
                              >
                                <span className="text-4xl" style={{ filter: streak === 0 ? 'grayscale(1) opacity(0.3)' : 'none' }}>🔥</span>
                                <div>
                                  <p className="font-black text-3xl leading-none" style={{ color: streak > 0 ? '#F97316' : currentTheme.text, opacity: streak > 0 ? 1 : 0.25 }}>
                                    {streak}
                                  </p>
                                  <p className="text-xs opacity-50 mt-0.5" style={{ color: currentTheme.text, opacity: 1 }}>
                                    day streak · longest {settings.stats.longestStreak || 0}d
                                  </p>
                                </div>
                              </div>

                              {/* Stats grid */}
                              <div className="p-4 rounded-2xl" style={{ background: currentTheme.secondary }}>
                                <p className="font-bold text-base mb-3" style={{ color: currentTheme.text, opacity: 1 }}>Reading Stats</p>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="p-3 rounded-xl text-center" style={{ background: `${currentTheme.accent}12` }}>
                                    <p className="font-black text-2xl" style={{ color: currentTheme.accent }}>{settings.stats.totalPagesRead.toLocaleString()}</p>
                                    <p className="text-[10px] opacity-50 mt-0.5" style={{ color: currentTheme.text }}>Pages Read</p>
                                  </div>
                                  <div className="p-3 rounded-xl text-center" style={{ background: `${currentTheme.accent}12` }}>
                                    <p className="font-black text-2xl" style={{ color: currentTheme.accent }}>{settings.stats.unlockedAchievements.length}</p>
                                    <p className="text-[10px] opacity-50 mt-0.5" style={{ color: currentTheme.text }}>Achievements</p>
                                  </div>
                                </div>
                              </div>

                              {/* Achievements */}
                              <div className="p-4 rounded-2xl" style={{ background: currentTheme.secondary }}>
                                <p className="font-bold text-sm mb-3" style={{ color: currentTheme.text, opacity: 1 }}>Achievements Unlocked</p>
                                <div className="flex flex-wrap gap-2">
                                  {ACHIEVEMENTS.filter(a => settings.stats?.unlockedAchievements.includes(a.id)).map(a => (
                                    <span key={a.id} className="text-xl" title={a.title}>{a.icon}</span>
                                  ))}
                                  {settings.stats.unlockedAchievements.length === 0 && (
                                    <p className="text-xs opacity-40" style={{ color: currentTheme.text }}>Start reading to unlock achievements!</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          <p className="text-xs opacity-40" style={{ color: currentTheme.text }}>
                            © 2024 Veuros · Founded by Veer Agnihotri
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}
