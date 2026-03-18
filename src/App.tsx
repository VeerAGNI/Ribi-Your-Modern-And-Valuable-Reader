import React, { useState, useEffect, useCallback } from 'react';
import { Library } from './components/Library';
import { PDFReader } from './components/PDFReader';
import { SettingsPanel } from './components/SettingsPanel';
import { MusicPlayer } from './components/MusicPlayer';
import { SplashScreen } from './components/SplashScreen';
import { AuthScreen } from './components/AuthScreen';
import { BookMetadata, ReaderSettings, Bookmark } from './types';
import { DEFAULT_SETTINGS, THEMES, ACHIEVEMENTS } from './constants';
import { Book, Settings, Library as LibraryIcon, Bookmark as BookmarkIcon, ChevronLeft, X, LogOut, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './utils';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import localforage from 'localforage';
import { AchievementToast } from './components/AchievementToast';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
import * as pdfjsLib from 'pdfjs-dist';
import { Howl } from 'howler';
import { BACKGROUND_TRACKS } from './constants';

// Set up worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

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
  const soundRef = React.useRef<Howl | null>(null);

  // Background Music Logic
  useEffect(() => {
    if (settings.backgroundMusic) {
      const track = BACKGROUND_TRACKS.find(t => t.id === settings.backgroundMusic);
      if (track) {
        if (soundRef.current) {
          soundRef.current.stop();
          soundRef.current.unload();
        }

        soundRef.current = new Howl({
          src: [track.url],
          html5: true,
          loop: true,
          volume: settings.volume,
        });

        soundRef.current.play();
      }
    } else {
      if (soundRef.current) {
        soundRef.current.stop();
      }
    }

    return () => {
      if (soundRef.current) {
        soundRef.current.stop();
      }
    };
  }, [settings.backgroundMusic]);

  useEffect(() => {
    if (soundRef.current) {
      soundRef.current.volume(settings.volume);
    }
  }, [settings.volume]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Firestore Sync
  useEffect(() => {
    if (!user) return;

    // Load settings
    const settingsRef = doc(db, 'users', user.uid, 'settings', 'reader');
    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as ReaderSettings;
        setSettings({ ...DEFAULT_SETTINGS, ...data });
      } else {
        // Create default settings
        setDoc(settingsRef, { ...DEFAULT_SETTINGS, uid: user.uid }).catch(e => handleFirestoreError(e, OperationType.CREATE, `users/${user.uid}/settings/reader`));
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${user.uid}/settings/reader`));

    // Load books
    const booksRef = collection(db, 'users', user.uid, 'books');
    const unsubBooks = onSnapshot(booksRef, (snapshot) => {
      const loadedBooks: BookMetadata[] = [];
      snapshot.forEach((doc) => {
        loadedBooks.push(doc.data() as BookMetadata);
      });
      setBooks(loadedBooks);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/books`));

    return () => {
      unsubSettings();
      unsubBooks();
    };
  }, [user]);

  // Save settings to Firestore
  const updateSettings = async (updates: Partial<ReaderSettings>) => {
    if (!user) return;
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    try {
      await setDoc(doc(db, 'users', user.uid, 'settings', 'reader'), { ...newSettings, uid: user.uid }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/settings/reader`);
    }
  };

  // Load active file from localforage if activeBookId is set but activeFile is null
  useEffect(() => {
    if (activeBookId && !activeFile) {
      localforage.getItem<Blob>(`pdf_${activeBookId}`).then((blob) => {
        if (blob) {
          setActiveFile(blob);
        } else {
          // File not found in storage, reset active book
          setActiveBookId(null);
        }
      }).catch(console.error);
    }
  }, [activeBookId, activeFile]);

  const handleUpload = async (file: File, customTitle?: string) => {
    let coverImage = undefined;
    let totalPages = 0;
    let title = customTitle || file.name.replace('.pdf', '');
    if (!title) title = 'Untitled PDF';

    try {
      const url = URL.createObjectURL(file);
      const loadingTask = pdfjsLib.getDocument(url);
      const pdf = await loadingTask.promise;
      totalPages = pdf.numPages;

      // Try to get metadata if customTitle is not provided
      if (!customTitle) {
        try {
          const metadata = await pdf.getMetadata();
          const info = metadata?.info as any;
          if (info?.Title) {
            title = info.Title;
          }
        } catch (e) {
          console.warn('Could not read PDF metadata', e);
        }
      }

      // Extract cover image
      if (totalPages > 0) {
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 0.5 }); // Small scale for thumbnail
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (context) {
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          const renderContext: any = {
            canvasContext: context,
            viewport,
          };
          await page.render(renderContext).promise;
          coverImage = canvas.toDataURL('image/jpeg', 0.8);
        }
      }
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error extracting PDF metadata:', error);
    }

    const newBook: BookMetadata = {
      id: Math.random().toString(36).substr(2, 9),
      title,
      originalName: file.name,
      totalPages,
      currentPage: 1,
      lastRead: Date.now(),
      bookmarks: [],
      ...(coverImage ? { coverImage } : {}),
    };

    // Save file to localforage and metadata to Firestore
    try {
      await localforage.setItem(`pdf_${newBook.id}`, file);
      if (user) {
        await setDoc(doc(db, 'users', user.uid, 'books', newBook.id), { ...newBook, uid: user.uid });
      }
      setActiveBookId(newBook.id);
      setActiveFile(file);
      setSidebarOpen(false);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Missing or insufficient permissions')) {
        handleFirestoreError(error, OperationType.CREATE, `users/${user?.uid}/books/${newBook.id}`);
      } else {
        console.error('Error saving PDF:', error);
        alert('Failed to save PDF.');
      }
    }
  };

  const handleSelectBook = async (id: string) => {
    setActiveBookId(id);
    if (user) {
      const book = books.find(b => b.id === id);
      if (book) {
        try {
          await setDoc(doc(db, 'users', user.uid, 'books', id), { ...book, lastRead: Date.now(), uid: user.uid }, { merge: true });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/books/${id}`);
        }
      }
    }
    setSidebarOpen(false);

    // Load file from localforage
    try {
      const blob = await localforage.getItem<Blob>(`pdf_${id}`);
      if (blob) {
        setActiveFile(blob);
      } else {
        alert('PDF file not found in local storage. It may have been cleared by the browser.');
        setActiveBookId(null);
      }
    } catch (error) {
      console.error('Error loading PDF:', error);
    }
  };

  const handleDeleteBook = async (id: string) => {
    if (activeBookId === id) {
      setActiveBookId(null);
      setActiveFile(null);
    }
    // Remove from localforage and Firestore
    try {
      await localforage.removeItem(`pdf_${id}`);
      if (user) {
        await deleteDoc(doc(db, 'users', user.uid, 'books', id));
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Missing or insufficient permissions')) {
        handleFirestoreError(error, OperationType.DELETE, `users/${user?.uid}/books/${id}`);
      } else {
        console.error('Error removing PDF:', error);
      }
    }
  };

  const [currentAchievement, setCurrentAchievement] = useState<{ title: string; icon: string } | null>(null);

  const handlePageChange = async (page: number) => {
    if (activeBookId && user) {
      const book = books.find(b => b.id === activeBookId);
      if (book) {
        try {
          const maxPageReached = Math.max(book.maxPageReached || 0, page);
          const pagesReadDiff = maxPageReached - (book.maxPageReached || 0);

          if (pagesReadDiff > 0) {
            const currentStats = settings.stats || { totalPagesRead: 0, unlockedAchievements: [] };
            const newTotalPagesRead = currentStats.totalPagesRead + pagesReadDiff;

            const newAchievements = ACHIEVEMENTS.filter(a => newTotalPagesRead >= a.pages && !currentStats.unlockedAchievements.includes(a.id));

            if (newAchievements.length > 0) {
              const latestAchievement = newAchievements[newAchievements.length - 1];
              setCurrentAchievement({ title: latestAchievement.title, icon: latestAchievement.icon });

              await updateSettings({
                stats: {
                  totalPagesRead: newTotalPagesRead,
                  unlockedAchievements: [...currentStats.unlockedAchievements, ...newAchievements.map(a => a.id)]
                }
              });
            } else {
              await updateSettings({
                stats: {
                  ...currentStats,
                  totalPagesRead: newTotalPagesRead,
                }
              });
            }
          }

          await setDoc(doc(db, 'users', user.uid, 'books', activeBookId), { ...book, currentPage: page, maxPageReached, uid: user.uid }, { merge: true });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/books/${activeBookId}`);
        }
      }
    }
  };

  const toggleBookmark = async (page: number) => {
    if (!activeBookId || !user) return;
    const book = books.find(b => b.id === activeBookId);
    if (!book) return;

    const exists = book.bookmarks.find(bm => bm.pageNumber === page);
    let newBookmarks = [...book.bookmarks];
    if (exists) {
      newBookmarks = newBookmarks.filter(bm => bm.pageNumber !== page);
    } else {
      newBookmarks.push({
        id: Math.random().toString(36).substr(2, 9),
        pageNumber: page,
        label: `Bookmark - Page ${page}`,
        timestamp: Date.now(),
      });
    }

    try {
      await setDoc(doc(db, 'users', user.uid, 'books', activeBookId), { ...book, bookmarks: newBookmarks, uid: user.uid }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/books/${activeBookId}`);
    }
  };

  const activeBook = books.find(b => b.id === activeBookId);
  const currentTheme = THEMES[settings.theme];

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  if (!authReady) {
    return <div className="flex h-screen w-screen items-center justify-center bg-slate-900"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div
      className="flex h-screen w-screen overflow-hidden transition-colors duration-500 font-sans"
      style={{ backgroundColor: currentTheme.bg, color: currentTheme.text }}
    >
      {/* Sidebar Toggle (Floating) */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-6 left-6 z-40 p-3 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl hover:scale-110 transition-all"
        style={{ color: currentTheme.text }}
      >
        <LibraryIcon size={24} />
      </button>

      {/* Close Book Button */}
      {activeBookId && (
        <button
          onClick={() => {
            setActiveBookId(null);
            setActiveFile(null);
          }}
          className="fixed top-6 right-6 z-40 p-3 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl hover:scale-110 transition-all text-red-400 hover:text-red-500"
          title="Close Book"
        >
          <X size={24} />
        </button>
      )}

      {/* Main Reader Area */}
      <main className="flex-1 relative h-full">
        {activeBookId && (activeFile || activeBook) ? (
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
            bookmarks={activeBook?.bookmarks || []}
            onToggleBookmark={toggleBookmark}
          />
        ) : (
          <div className="flex flex-col items-center justify-start h-full text-center p-8 relative overflow-y-auto custom-scrollbar">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-2xl z-10 w-full pb-32 pt-12"
            >
              <div className="w-24 h-24 bg-blue-500/10 rounded-3xl flex items-center justify-center text-blue-500 mx-auto mb-8">
                <Book size={48} />
              </div>
              <h2 className="text-4xl font-bold mb-4 tracking-tight">Welcome, {user.displayName || 'Reader'}</h2>
              <p className="opacity-60 mb-2 leading-relaxed text-lg">
                Your valuable reader, Ribi, is here for you.
              </p>
              <p className="text-blue-400 font-medium mb-8 text-lg">
                Ribi Missed You Alot.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
                {books.length > 0 && (
                  <button
                    onClick={() => {
                      const lastReadBook = [...books].sort((a, b) => b.lastRead - a.lastRead)[0];
                      if (lastReadBook) handleSelectBook(lastReadBook.id);
                    }}
                    className="px-8 py-4 bg-blue-500 text-white rounded-2xl font-bold shadow-xl shadow-blue-500/30 hover:bg-blue-600 transition-all w-full sm:w-auto"
                  >
                    Pick Up Where You Left
                  </button>
                )}
                <button
                  onClick={() => { setSidebarOpen(true); setActiveTab('library'); }}
                  className="px-8 py-4 bg-slate-800 text-white rounded-2xl font-bold shadow-xl hover:bg-slate-700 transition-all w-full sm:w-auto border border-white/10"
                >
                  Explore Your Library
                </button>
              </div>

              <div className="mt-12 text-xs opacity-60 text-center max-w-2xl mx-auto space-y-2">
                <p>© 2024 Veuros. All rights reserved.</p>
                <p>Veuros, an upcoming company, was visionized by Veer Agnihotri in 2024, with the aim of maximizing the potential of building habits that pay off alot in the long-term by blending technology, a big part of our lives, with it.</p>
                <p className="font-medium">Visioned for maximizers, and created for readers.</p>
                <p className="mt-4 text-sm font-medium inline-block">Founded By <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-400 to-orange-400">Veer Agnihotri</span></p>
              </div>
            </motion.div>
          </div>
        )}
      </main>

      {/* Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-full max-w-sm z-50 flex shadow-2xl"
              style={{ backgroundColor: currentTheme.bg }}
            >
              {/* Sidebar Navigation Rail */}
              <div className="w-20 flex flex-col items-center py-8 gap-8 border-r border-black/5" style={{ backgroundColor: currentTheme.secondary }}>
                <button
                  onClick={() => setActiveTab('library')}
                  className={cn("p-3 rounded-2xl transition-all", activeTab === 'library' ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30" : "opacity-40 hover:opacity-100")}
                >
                  <LibraryIcon size={24} />
                </button>
                <button
                  onClick={() => setActiveTab('bookmarks')}
                  className={cn("p-3 rounded-2xl transition-all", activeTab === 'bookmarks' ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30" : "opacity-40 hover:opacity-100")}
                >
                  <BookmarkIcon size={24} />
                </button>
                <button
                  onClick={() => setActiveTab('settings')}
                  className={cn("p-3 rounded-2xl transition-all", activeTab === 'settings' ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30" : "opacity-40 hover:opacity-100")}
                >
                  <Settings size={24} />
                </button>
                <button
                  onClick={() => setActiveTab('about')}
                  className={cn("p-3 rounded-2xl transition-all", activeTab === 'about' ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30" : "opacity-40 hover:opacity-100")}
                >
                  <Info size={24} />
                </button>
                <div className="mt-auto flex flex-col items-center gap-4">
                  <button
                    onClick={() => auth.signOut()}
                    className="p-3 rounded-2xl opacity-40 hover:opacity-100 hover:text-red-500 transition-all"
                    title="Sign Out"
                  >
                    <LogOut size={24} />
                  </button>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="p-3 rounded-2xl opacity-40 hover:opacity-100 transition-all"
                  >
                    <ChevronLeft size={24} />
                  </button>
                </div>
              </div>

              {/* Sidebar Content */}
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
                      <SettingsPanel settings={settings} onUpdate={(u) => setSettings(s => ({ ...s, ...u }))} />
                      <div className="mt-auto p-6">
                        <MusicPlayer
                          currentTrackId={settings.backgroundMusic}
                          volume={settings.volume}
                          onTrackChange={(id) => setSettings(s => ({ ...s, backgroundMusic: id }))}
                          onVolumeChange={(v) => setSettings(s => ({ ...s, volume: v }))}
                          theme={settings.theme}
                        />
                      </div>
                    </div>
                  )}
                  {activeTab === 'bookmarks' && (
                    <div className="p-6">
                      <h2 className="text-2xl font-bold mb-6">Bookmarks</h2>
                      {!activeBook ? (
                        <p className="opacity-50 text-sm">Open a book to see bookmarks</p>
                      ) : activeBook.bookmarks.length === 0 ? (
                        <p className="opacity-50 text-sm">No bookmarks for this book yet</p>
                      ) : (
                        <div className="grid gap-3">
                          {activeBook.bookmarks.map(bm => (
                            <button
                              key={bm.id}
                              onClick={() => {
                                handlePageChange(bm.pageNumber);
                                setSidebarOpen(false);
                              }}
                              className="flex items-center justify-between p-4 rounded-2xl text-left transition-all hover:scale-[1.02]"
                              style={{ backgroundColor: currentTheme.secondary }}
                            >
                              <div>
                                <p className="font-bold text-sm">Page {bm.pageNumber}</p>
                                <p className="text-[10px] opacity-50">{new Date(bm.timestamp).toLocaleDateString()}</p>
                              </div>
                              <BookmarkIcon size={16} className="text-blue-500" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {activeTab === 'about' && (
                    <div className="p-6">
                      <h2 className="text-2xl font-bold mb-6">About Us</h2>
                      <div className="space-y-6">
                        <div className="p-6 rounded-3xl" style={{ backgroundColor: currentTheme.secondary }}>
                          <h3 className="text-xl font-bold mb-4">Our Story</h3>
                          <p className="opacity-80 leading-relaxed text-sm">
                            Ribi was born from a simple desire: to make reading digital books as immersive and distraction-free as reading physical ones. We believe that technology should enhance the reading experience, not get in the way of it.
                          </p>
                          <p className="opacity-80 leading-relaxed text-sm mt-4">
                            Every feature in Ribi is designed with the reader in mind, from the carefully selected typography to the ambient background sounds that help you focus.
                          </p>
                        </div>

                        <div className="p-6 rounded-3xl" style={{ backgroundColor: currentTheme.secondary }}>
                          <h3 className="text-xl font-bold mb-4">Your Reading Journey</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-black/5 dark:bg-white/5 p-4 rounded-2xl text-center">
                              <p className="text-3xl font-bold mb-1">{settings.stats?.totalPagesRead || 0}</p>
                              <p className="text-xs opacity-60 uppercase tracking-wider">Pages Read</p>
                            </div>
                            <div className="bg-black/5 dark:bg-white/5 p-4 rounded-2xl text-center">
                              <p className="text-3xl font-bold mb-1">{settings.stats?.unlockedAchievements?.length || 0}</p>
                              <p className="text-xs opacity-60 uppercase tracking-wider">Achievements</p>
                            </div>
                          </div>
                        </div>

                        <div className="p-6 rounded-3xl" style={{ backgroundColor: currentTheme.secondary }}>
                          <h3 className="text-xl font-bold mb-4">Achievements</h3>
                          <div className="space-y-3">
                            {ACHIEVEMENTS.map(achievement => {
                              const isUnlocked = settings.stats?.unlockedAchievements?.includes(achievement.id);
                              return (
                                <div
                                  key={achievement.id}
                                  className={cn(
                                    "flex items-center gap-4 p-3 rounded-2xl transition-all",
                                    isUnlocked ? "bg-black/5 dark:bg-white/5" : "opacity-40 grayscale"
                                  )}
                                >
                                  <div className="w-10 h-10 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center text-xl shrink-0">
                                    {achievement.icon}
                                  </div>
                                  <div>
                                    <p className="font-bold text-sm">{achievement.title}</p>
                                    <p className="text-xs opacity-60">Read {achievement.pages} pages</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <AchievementToast
        achievement={currentAchievement}
        onClose={() => setCurrentAchievement(null)}
      />
    </div>
  );
}
