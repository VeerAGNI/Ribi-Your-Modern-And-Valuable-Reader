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
import { Book, Settings, Library as LibraryIcon, Bookmark as BookmarkIcon, ChevronLeft, X, LogOut, Info, UserX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './utils';
import { auth, db } from './firebase';
import { onAuthStateChanged, User, signOut, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
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

// ── Animated mesh-gradient background ────────────────────────────────────────
const MESH_COLORS: Record<string, [string, string, string]> = {
  light:    ['rgba(59,130,246,0.15)',  'rgba(139,92,246,0.11)', 'rgba(6,182,212,0.10)'],
  dark:     ['rgba(29,78,216,0.22)',   'rgba(109,40,217,0.18)', 'rgba(8,145,178,0.16)'],
  sepia:    ['rgba(180,83,9,0.14)',    'rgba(146,104,73,0.12)', 'rgba(217,119,6,0.10)'],
  nord:     ['rgba(37,99,235,0.18)',   'rgba(88,28,135,0.15)',  'rgba(14,116,144,0.14)'],
  midnight: ['rgba(109,40,217,0.28)',  'rgba(49,46,129,0.22)', 'rgba(15,23,42,0.18)'],
};

function MeshBackground({ theme }: { theme: string }) {
  const [c1, c2, c3] = MESH_COLORS[theme] ?? MESH_COLORS.dark;
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden>
      <div className="mesh-orb mesh-orb-1" style={{ width: '70vw', height: '70vw', top: '-25%', left: '-15%', background: c1 }} />
      <div className="mesh-orb mesh-orb-2" style={{ width: '55vw', height: '55vw', top: '20%', right: '-20%', background: c2 }} />
      <div className="mesh-orb mesh-orb-3" style={{ width: '50vw', height: '50vw', bottom: '-20%', left: '20%', background: c3 }} />
    </div>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [guestBannerDismissed, setGuestBannerDismissed] = useState(false);
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

  // Firestore sync — skipped for anonymous guest users
  useEffect(() => {
    if (!user || user.isAnonymous) return;
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
    const newSettings = { ...settingsRef.current, ...updates };
    setSettings(newSettings);
    if (!user || user.isAnonymous) return; // guests: local state only
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
      if (user && !user.isAnonymous) {
        await setDoc(doc(db, 'users', user.uid, 'books', newBook.id), { ...newBook, uid: user.uid });
      } else {
        // Guest: keep books only in local React state
        setBooks(prev => [...prev, newBook]);
      }
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
    if (user && !user.isAnonymous) {
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
      if (user && !user.isAnonymous) {
        await deleteDoc(doc(db, 'users', user.uid, 'books', id));
      } else {
        setBooks(prev => prev.filter(b => b.id !== id));
      }
    } catch (err) {
      console.error('Error deleting book:', err);
    }
  };

  const handlePageChange = useCallback(async (page: number) => {
    if (!activeBookId) return;
    const book = books.find(b => b.id === activeBookId);
    if (!book) return;

    const prevMax = book.maxPageReached || 0;
    const maxPageReached = Math.max(prevMax, page);
    const pagesReadDiff = maxPageReached - prevMax;

    // Always update local state immediately
    setBooks(prev => prev.map(b =>
      b.id === activeBookId ? { ...b, currentPage: page, maxPageReached, lastRead: Date.now() } : b
    ));

    // === Stats & achievements — runs for ALL users including guests ===
    // (updateSettings already skips Firestore for guests)
    const stats: ReadingStats = {
      totalPagesRead: 0,
      unlockedAchievements: [],
      streak: 0,
      longestStreak: 0,
      lastReadDate: '',
      ...(settingsRef.current.stats || {}),
    };
    const newTotal = stats.totalPagesRead + pagesReadDiff;
    const today = todayStr();
    const yesterday = yesterdayStr();
    let newStreak = stats.streak;
    let newLongest = stats.longestStreak;
    let statsChanged = pagesReadDiff > 0;

    // Update streak on ANY page read on a new day (even re-reads count)
    if (stats.lastReadDate !== today) {
      newStreak = stats.lastReadDate === yesterday ? stats.streak + 1 : 1;
      newLongest = Math.max(newLongest, newStreak);
      statsChanged = true;

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

    // Page achievements (only for newly reached pages)
    const alreadyUnlocked = stats.unlockedAchievements;
    const newlyUnlocked = pagesReadDiff > 0 ? ACHIEVEMENTS.filter(a =>
      newTotal >= a.pages &&
      !alreadyUnlocked.includes(a.id) &&
      !sessionShownAchievementsRef.current.has(a.id)
    ) : [];

    if (newlyUnlocked.length > 0) {
      newlyUnlocked.forEach(a => sessionShownAchievementsRef.current.add(a.id));
      const highest = newlyUnlocked[newlyUnlocked.length - 1];
      setAchievementQueue(q => [...q, { title: highest.title, icon: highest.icon }]);
    }

    if (statsChanged || newlyUnlocked.length > 0) {
      updateSettings({
        stats: {
          totalPagesRead: newTotal,
          unlockedAchievements: [...alreadyUnlocked, ...newlyUnlocked.map(a => a.id)],
          streak: newStreak,
          longestStreak: newLongest,
          lastReadDate: today,
        },
      });
    }

    // Persist book progress to Firestore for signed-in users only
    if (!user || user.isAnonymous) return;
    setDoc(doc(db, 'users', user.uid, 'books', activeBookId), { ...book, currentPage: page, maxPageReached, uid: user.uid }, { merge: true })
      .catch(e => logFirestoreError(e, OperationType.UPDATE, `users/${user.uid}/books/${activeBookId}`));
  }, [activeBookId, user, books, updateSettings]);

  const toggleBookmark = async (page: number) => {
    if (!activeBookId) return;
    const book = books.find(b => b.id === activeBookId);
    if (!book) return;
    const exists = book.bookmarks.find(bm => bm.pageNumber === page);
    const newBookmarks = exists
      ? book.bookmarks.filter(bm => bm.pageNumber !== page)
      : [...book.bookmarks, { id: Math.random().toString(36).slice(2, 9), pageNumber: page, label: `Page ${page}`, timestamp: Date.now() }];
    // Update local state for everyone (guests and signed-in)
    setBooks(prev => prev.map(b => b.id === activeBookId ? { ...b, bookmarks: newBookmarks } : b));
    // Persist to Firestore only for signed-in users
    if (!user || user.isAnonymous) return;
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

  const isGuest = user?.isAnonymous ?? false;
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
        className="flex h-screen w-screen overflow-hidden font-sans transition-colors duration-500 relative"
        style={{ backgroundColor: currentTheme.bg, color: currentTheme.text }}
      >
        {/* Animated mesh-gradient background */}
        <MeshBackground theme={settings.theme} />

        <AchievementToast achievement={currentAchievement} onClose={handleAchievementClose} />

        {/* Guest mode banner */}
        <AnimatePresence>
          {isGuest && !guestBannerDismissed && (
            <motion.div
              initial={{ opacity: 0, y: -48 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -48 }}
              transition={{ type: 'spring', stiffness: 340, damping: 30 }}
              className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2.5 text-sm"
              style={{
                background: 'rgba(15,15,25,0.82)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div className="flex items-center gap-2" style={{ color: 'rgba(148,163,184,0.9)' }}>
                <UserX size={15} className="shrink-0" />
                <span>You're in guest mode — data is local only.</span>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={async () => {
                    try {
                      await signInWithPopup(auth, new GoogleAuthProvider());
                    } catch {
                      /* user closed popup */
                    }
                  }}
                  className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                  style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}
                >
                  Sign in
                </button>
                <button
                  onClick={() => setGuestBannerDismissed(true)}
                  className="p-1 rounded-lg transition-all"
                  style={{ color: 'rgba(100,116,139,0.7)' }}
                  aria-label="Dismiss"
                >
                  <X size={14} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sidebar toggle */}
        <motion.button
          whileHover={{ scale: 1.07 }} whileTap={{ scale: 0.93 }}
          onClick={() => setSidebarOpen(true)}
          className="fixed top-5 left-5 z-40 p-3 rounded-2xl glass border shadow-xl transition-all"
          style={{
            color: currentTheme.text,
            background: `${currentTheme.bg}b0`,
            borderColor: `${currentTheme.text}14`,
            boxShadow: `0 8px 32px rgba(0,0,0,0.18), 0 0 0 1px ${currentTheme.accent}10`,
          }}
        >
          <LibraryIcon size={22} />
        </motion.button>

        {/* Close book button */}
        {activeBookId && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.07 }} whileTap={{ scale: 0.93 }}
            onClick={() => { setActiveBookId(null); setActiveFile(null); }}
            className="fixed top-5 right-5 z-40 p-3 rounded-2xl glass border shadow-xl transition-all text-red-400 hover:text-red-300"
            style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)', boxShadow: '0 8px 32px rgba(239,68,68,0.12)' }}
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
          ) : (() => {
            const hour = new Date().getHours();
            const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
            const firstName = user.displayName?.split(' ')[0] || 'Reader';
            const lastBook = books.length > 0 ? [...books].sort((a, b) => b.lastRead - a.lastRead)[0] : null;
            const achievementCount = settings.stats?.unlockedAchievements?.length || 0;
            const longestStreak = settings.stats?.longestStreak || streak;
            return (
              <div className="w-full h-full overflow-y-auto custom-scrollbar">
                <div className="max-w-lg mx-auto px-4 pt-8 pb-20 space-y-5">

                  {/* ── Greeting header ── */}
                  <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold opacity-35 mb-0.5 tracking-widest uppercase">{greeting}</p>
                        <h1 className="text-3xl font-black tracking-tight leading-none" style={{ color: currentTheme.text }}>
                          {firstName}
                          <span className="ml-2" style={{ color: currentTheme.accent }}>↗</span>
                        </h1>
                        <p className="text-xs mt-2 italic" style={{ color: currentTheme.accent, opacity: 0.7 }}>
                          Visioned for maximizers, created for readers.
                        </p>
                      </div>
                      <div
                        className="w-13 h-13 rounded-2xl flex items-center justify-center text-xl font-black text-white shadow-lg"
                        style={{
                          background: `linear-gradient(135deg, ${currentTheme.accent}, ${currentTheme.accent}99)`,
                          width: 52, height: 52,
                          boxShadow: `0 8px 24px ${currentTheme.accent}40`,
                        }}
                      >
                        {firstName[0]?.toUpperCase() || 'R'}
                      </div>
                    </div>
                  </motion.div>

                  {/* ── Streak card ── */}
                  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.08 }}>
                    <div
                      className="rounded-3xl p-5 glass glass-card"
                      style={{
                        background: streak > 0
                          ? 'linear-gradient(135deg, rgba(251,146,60,0.18), rgba(249,115,22,0.08))'
                          : `${currentTheme.secondary}cc`,
                        border: streak > 0
                          ? '1px solid rgba(251,146,60,0.32)'
                          : `1px solid ${currentTheme.text}10`,
                        boxShadow: streak > 0 ? '0 8px 32px rgba(251,146,60,0.14)' : undefined,
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-5xl select-none" style={{ filter: streak === 0 ? 'grayscale(1) opacity(0.3)' : 'none' }}>🔥</div>
                        <div className="flex-1">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-5xl font-black tracking-tight"
                              style={{ color: streak > 0 ? '#F97316' : currentTheme.text, opacity: streak > 0 ? 1 : 0.2 }}>
                              {streak}
                            </span>
                            <span className="text-sm font-semibold opacity-50" style={{ color: currentTheme.text }}>day streak</span>
                          </div>
                          <p className="text-xs opacity-40 mt-0.5" style={{ color: currentTheme.text }}>
                            {streak === 0 ? 'Read today to start your streak!' : `Best: ${longestStreak} days · ${totalPages.toLocaleString()} pages total`}
                          </p>
                        </div>
                        {streak > 0 && (
                          <div className="text-right flex-shrink-0">
                            <div className="text-2xl mb-1">
                              {streak >= 30 ? '🏆' : streak >= 14 ? '⚡' : streak >= 7 ? '🌟' : '📖'}
                            </div>
                            <div className="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                              style={{ background: 'rgba(251,146,60,0.22)', color: '#F97316' }}>
                              {streak >= 30 ? 'Epic' : streak >= 14 ? 'Strong' : streak >= 7 ? 'Week' : `Day ${streak}`}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>

                  {/* ── Stats row ── */}
                  <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.14 }}>
                    <div className="grid grid-cols-3 gap-3">
                      {([
                        { label: 'Pages', value: totalPages.toLocaleString(), icon: '📖' },
                        { label: 'Books', value: String(books.length), icon: '📚' },
                        { label: 'Awards', value: String(achievementCount), icon: '🏅' },
                      ] as { label: string; value: string; icon: string }[]).map(({ label, value, icon }) => (
                        <div key={label}
                          className="rounded-2xl p-4 text-center glass glass-card"
                          style={{ background: `${currentTheme.secondary}bb`, border: `1px solid ${currentTheme.text}08` }}>
                          <div className="text-xl mb-1">{icon}</div>
                          <div className="text-xl font-black" style={{ color: currentTheme.text }}>{value}</div>
                          <div className="text-[10px] opacity-35 mt-0.5 font-semibold tracking-wide uppercase">{label}</div>
                        </div>
                      ))}
                    </div>
                  </motion.div>

                  {/* ── Continue reading ── */}
                  {lastBook && (
                    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.19 }}>
                      <p className="text-xs font-bold opacity-35 uppercase tracking-widest mb-3">Continue Reading</p>
                      <button
                        onClick={() => handleSelectBook(lastBook.id)}
                        className="w-full text-left rounded-3xl p-5 glass glass-card transition-all active:scale-98"
                        style={{
                          background: `${currentTheme.secondary}cc`,
                          border: `1px solid ${currentTheme.accent}22`,
                          boxShadow: `0 8px 32px ${currentTheme.accent}10`,
                        }}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 rounded-xl flex-shrink-0 flex items-center justify-center text-2xl"
                            style={{ background: `${currentTheme.accent}1a`, color: currentTheme.accent, height: 60 }}>
                            📖
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm leading-tight truncate" style={{ color: currentTheme.text }}>
                              {lastBook.title}
                            </p>
                            <p className="text-xs opacity-40 mt-0.5">
                              Page {lastBook.currentPage || 1} of {lastBook.totalPages}
                            </p>
                            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: `${currentTheme.text}12` }}>
                              <div className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.min(100, Math.round(((lastBook.currentPage || 1) / lastBook.totalPages) * 100))}%`,
                                  background: `linear-gradient(90deg, ${currentTheme.accent}, ${currentTheme.accent}bb)`,
                                }} />
                            </div>
                            <p className="text-[10px] opacity-30 mt-1">
                              {Math.min(100, Math.round(((lastBook.currentPage || 1) / lastBook.totalPages) * 100))}% complete
                            </p>
                          </div>
                          <div className="flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center text-white"
                            style={{ background: `linear-gradient(135deg, ${currentTheme.accent}, ${currentTheme.accent}bb)` }}>
                            <span style={{ fontSize: 14 }}>▶</span>
                          </div>
                        </div>
                      </button>
                    </motion.div>
                  )}

                  {/* ── Recent books grid ── */}
                  {books.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.24 }}>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-bold opacity-35 uppercase tracking-widest">My Library</p>
                        <button
                          onClick={() => { setSidebarOpen(true); setActiveTab('library'); }}
                          className="text-xs font-semibold px-3 py-1 rounded-full transition-all"
                          style={{ color: currentTheme.accent, background: `${currentTheme.accent}14` }}
                        >
                          View all →
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {[...books].sort((a, b) => b.lastRead - a.lastRead).slice(0, 4).map((book, idx) => {
                          const pct = Math.min(100, Math.round(((book.currentPage || 1) / book.totalPages) * 100));
                          return (
                            <motion.button
                              key={book.id}
                              initial={{ opacity: 0, scale: 0.96 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 0.28 + idx * 0.06 }}
                              onClick={() => handleSelectBook(book.id)}
                              className="text-left rounded-2xl p-4 glass glass-card transition-all"
                              style={{ background: `${currentTheme.secondary}cc`, border: `1px solid ${currentTheme.text}08` }}
                            >
                              <div className="w-10 h-12 rounded-lg flex items-center justify-center text-lg mb-3"
                                style={{ background: `${currentTheme.accent}18`, color: currentTheme.accent }}>
                                📖
                              </div>
                              <p className="font-semibold text-xs leading-tight mb-2 line-clamp-2" style={{ color: currentTheme.text }}>
                                {book.title}
                              </p>
                              <div className="h-1 rounded-full overflow-hidden mb-1" style={{ background: `${currentTheme.text}10` }}>
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: currentTheme.accent }} />
                              </div>
                              <p className="text-[10px] opacity-30">{pct}%</p>
                            </motion.button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}

                  {/* ── Empty library ── */}
                  {books.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                      className="text-center py-12"
                    >
                      <div className="text-6xl mb-5 opacity-25">📚</div>
                      <h3 className="text-xl font-bold mb-2" style={{ color: currentTheme.text }}>Your library awaits</h3>
                      <p className="text-sm opacity-40 mb-8">Upload a PDF to begin your journey</p>
                      <motion.button
                        whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                        onClick={() => { setSidebarOpen(true); setActiveTab('library'); }}
                        className="px-10 py-4 rounded-2xl font-bold text-white transition-all"
                        style={{
                          background: `linear-gradient(135deg, ${currentTheme.accent}, ${currentTheme.accent}cc)`,
                          boxShadow: `0 12px 36px ${currentTheme.accent}40`,
                        }}
                      >
                        Upload a PDF
                      </motion.button>
                    </motion.div>
                  )}

                  {/* ── Action buttons ── */}
                  {books.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.34 }}
                      className="flex gap-3"
                    >
                      <motion.button
                        whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                        onClick={() => { setSidebarOpen(true); setActiveTab('library'); }}
                        className="flex-1 py-4 rounded-2xl font-bold text-white transition-all"
                        style={{
                          background: `linear-gradient(135deg, ${currentTheme.accent}, ${currentTheme.accent}cc)`,
                          boxShadow: `0 8px 28px ${currentTheme.accent}35`,
                        }}
                      >
                        Open Library
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                        onClick={() => { setSidebarOpen(true); setActiveTab('settings'); }}
                        className="px-6 py-4 rounded-2xl font-bold glass transition-all"
                        style={{ background: `${currentTheme.secondary}cc`, border: `1px solid ${currentTheme.text}10`, color: currentTheme.text }}
                      >
                        Settings
                      </motion.button>
                    </motion.div>
                  )}

                  {/* ── Veuros brand ── */}
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.42 }}
                    className="pt-6 text-center"
                    style={{ borderTop: `1px solid ${currentTheme.text}08` }}
                  >
                    <h3 style={{
                      fontFamily: '"Orbitron","Space Grotesk",system-ui,sans-serif',
                      fontSize: '1.35rem',
                      fontWeight: 900,
                      letterSpacing: '0.18em',
                      background: 'linear-gradient(135deg,#fff 0%,#93c5fd 40%,#3b82f6 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      marginBottom: 8,
                    }}>
                      VEUROS
                    </h3>
                    <p className="text-xs opacity-25 leading-relaxed max-w-xs mx-auto">
                      Redefining technology — visionized by Veer Agnihotri in 2024, blending innovation with life-changing habits.
                    </p>
                    <p className="text-[10px] font-bold mt-3"
                      style={{
                        background: 'linear-gradient(90deg,#fde68a,#f59e0b,#f97316)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                        opacity: 0.8,
                      }}>
                      Founded by Veer Agnihotri · © 2024 Veuros
                    </p>
                  </motion.div>

                </div>
              </div>
            );
          })()}
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
                className="fixed top-0 left-0 bottom-0 w-full max-w-sm z-50 flex glass"
                style={{
                  backgroundColor: `${currentTheme.bg}e8`,
                  boxShadow: `4px 0 40px rgba(0,0,0,0.25), inset -1px 0 0 ${currentTheme.text}08`,
                  borderRight: `1px solid ${currentTheme.text}10`,
                }}
              >
                {/* Nav rail */}
                <div
                  className="w-[72px] flex flex-col items-center py-8 gap-6 border-r"
                  style={{ background: `${currentTheme.secondary}cc`, borderColor: `${currentTheme.text}08` }}
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
