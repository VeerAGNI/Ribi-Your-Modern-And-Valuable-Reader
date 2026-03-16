import React, { useState, useEffect, useCallback } from 'react';
import { Library } from './components/Library';
import { PDFReader } from './components/PDFReader';
import { SettingsPanel } from './components/SettingsPanel';
import { MusicPlayer } from './components/MusicPlayer';
import { BookMetadata, ReaderSettings, Bookmark } from './types';
import { DEFAULT_SETTINGS, THEMES } from './constants';
import { Book, Settings, Library as LibraryIcon, Bookmark as BookmarkIcon, ChevronLeft, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './utils';

export default function App() {
  const [books, setBooks] = useState<BookMetadata[]>([]);
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<File | null>(null);
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'library' | 'settings' | 'bookmarks'>('library');

  // Load state from localStorage
  useEffect(() => {
    const savedBooks = localStorage.getItem('ribi_books');
    const savedSettings = localStorage.getItem('ribi_settings');
    if (savedBooks) setBooks(JSON.parse(savedBooks));
    if (savedSettings) setSettings(JSON.parse(savedSettings));
  }, []);

  // Save state to localStorage
  useEffect(() => {
    localStorage.setItem('ribi_books', JSON.stringify(books));
  }, [books]);

  useEffect(() => {
    localStorage.setItem('ribi_settings', JSON.stringify(settings));
  }, [settings]);

  const handleUpload = (file: File) => {
    const newBook: BookMetadata = {
      id: Math.random().toString(36).substr(2, 9),
      title: file.name.replace('.pdf', ''),
      totalPages: 0, // Will be updated when opened
      currentPage: 1,
      lastRead: Date.now(),
      bookmarks: [],
    };
    setBooks(prev => [...prev, newBook]);
    setActiveBookId(newBook.id);
    setActiveFile(file);
    setSidebarOpen(false);
  };

  const handleSelectBook = (id: string) => {
    setActiveBookId(id);
    setBooks(prev => prev.map(b => b.id === id ? { ...b, lastRead: Date.now() } : b));
    setSidebarOpen(false);
    // Note: In a real app, we'd need to handle re-uploading or persistent storage of the File
  };

  const handleDeleteBook = (id: string) => {
    setBooks(prev => prev.filter(b => b.id !== id));
    if (activeBookId === id) {
      setActiveBookId(null);
      setActiveFile(null);
    }
  };

  const handlePageChange = (page: number) => {
    if (activeBookId) {
      setBooks(prev => prev.map(b => b.id === activeBookId ? { ...b, currentPage: page } : b));
    }
  };

  const toggleBookmark = (page: number) => {
    if (!activeBookId) return;
    setBooks(prev => prev.map(b => {
      if (b.id !== activeBookId) return b;
      const exists = b.bookmarks.find(bm => bm.pageNumber === page);
      if (exists) {
        return { ...b, bookmarks: b.bookmarks.filter(bm => bm.pageNumber !== page) };
      }
      const newBookmark: Bookmark = {
        id: Math.random().toString(36).substr(2, 9),
        pageNumber: page,
        label: `Bookmark - Page ${page}`,
        timestamp: Date.now(),
      };
      return { ...b, bookmarks: [...b.bookmarks, newBookmark] };
    }));
  };

  const activeBook = books.find(b => b.id === activeBookId);
  const currentTheme = THEMES[settings.theme];

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

      {/* Main Reader Area */}
      <main className="flex-1 relative h-full">
        {activeBookId && (activeFile || activeBook) ? (
          <PDFReader 
            file={activeFile || ''} 
            currentPage={activeBook?.currentPage || 1}
            onPageChange={handlePageChange}
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
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-md"
            >
              <div className="w-24 h-24 bg-blue-500/10 rounded-3xl flex items-center justify-center text-blue-500 mx-auto mb-8">
                <Book size={48} />
              </div>
              <h2 className="text-4xl font-bold mb-4 tracking-tight">Welcome to Ribi</h2>
              <p className="opacity-60 mb-8 leading-relaxed">
                Your personal sanctuary for deep reading. Upload a PDF to begin your journey into the world of knowledge.
              </p>
              <button 
                onClick={() => { setSidebarOpen(true); setActiveTab('library'); }}
                className="px-8 py-4 bg-blue-500 text-white rounded-2xl font-bold shadow-xl shadow-blue-500/30 hover:bg-blue-600 transition-all"
              >
                Open Library
              </button>
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
                <div className="mt-auto">
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
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

