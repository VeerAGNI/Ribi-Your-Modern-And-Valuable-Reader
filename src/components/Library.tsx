import React, { useState, useEffect, useRef } from 'react';
import { Upload, Book as BookIcon, Clock, Trash2, FileText, X, Plus } from 'lucide-react';
import { BookMetadata, Theme } from '../types';
import { THEMES } from '../constants';
import { cn, formatTime } from '../utils';

interface LibraryProps {
  books: BookMetadata[];
  onUpload: (file: File, customTitle?: string) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  theme: Theme;
}

export const Library: React.FC<LibraryProps> = ({ books, onUpload, onSelect, onDelete, theme }) => {
  const currentTheme = THEMES[theme];
  const [showTip, setShowTip] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customBookName, setCustomBookName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const hasSeenTip = localStorage.getItem('veuros_seen_tip');
    if (!hasSeenTip) {
      setShowTip(true);
    }
  }, []);

  const dismissTip = () => {
    localStorage.setItem('veuros_seen_tip', 'true');
    setShowTip(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setCustomBookName(''); // Leave empty to allow auto-extraction from metadata
    }
  };

  const handleConfirmUpload = () => {
    if (selectedFile) {
      onUpload(selectedFile, customBookName.trim() || undefined);
      setIsUploadModalOpen(false);
      setSelectedFile(null);
      setCustomBookName('');
    }
  };

  const handleCancelUpload = () => {
    setIsUploadModalOpen(false);
    setSelectedFile(null);
    setCustomBookName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col h-full p-6 relative">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: currentTheme.text }}>Ribi</h1>
          <p className="text-sm opacity-50" style={{ color: currentTheme.text }}>Continue Reading & Becoming</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar mb-4">
        {books.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-3xl opacity-30" style={{ borderColor: currentTheme.text }}>
            <BookIcon size={48} style={{ color: currentTheme.text }} />
            <p className="mt-4 font-medium" style={{ color: currentTheme.text }}>Your library is empty</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {books.sort((a, b) => b.lastRead - a.lastRead).map(book => (
              <div 
                key={book.id}
                onClick={() => onSelect(book.id)}
                className="group relative flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all hover:scale-[1.02]"
                style={{ backgroundColor: currentTheme.secondary }}
              >
                <div className="w-12 h-16 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-500 overflow-hidden shrink-0">
                  {book.coverImage ? (
                    <img src={book.coverImage} alt="Cover" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <FileText size={24} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold truncate" style={{ color: currentTheme.text }}>{book.title}</h3>
                  <div className="flex items-center gap-3 mt-1 opacity-50 text-[10px]" style={{ color: currentTheme.text }}>
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {formatTime(book.lastRead)}
                    </span>
                    <span>Page {book.currentPage} / {book.totalPages}</span>
                  </div>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(book.id);
                  }}
                  className="p-2 rounded-full opacity-50 hover:opacity-100 hover:bg-red-500/10 text-red-500 transition-all md:opacity-0 md:group-hover:opacity-100"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button 
        onClick={() => setIsUploadModalOpen(true)}
        className="flex items-center justify-center gap-2 px-4 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl cursor-pointer transition-all shadow-lg shadow-blue-500/20 w-full mt-auto"
      >
        <Plus size={24} />
      </button>

      {showTip && (
        <div className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-xl relative">
          <button onClick={dismissTip} className="absolute top-2 right-2 p-1 hover:bg-white/20 rounded-full transition-colors">
            <X size={14} />
          </button>
          <h4 className="font-bold mb-1">Reading Tip</h4>
          <p className="text-xs opacity-80 leading-relaxed pr-4">
            Try the "Midnight" theme with background rain sounds for a deeply immersive late-night reading session.
          </p>
        </div>
      )}

      {/* Upload Modal */}
      {isUploadModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 rounded-3xl">
          <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-4" style={{ backgroundColor: currentTheme.bg, color: currentTheme.text }}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-bold">Upload PDF</h3>
              <button onClick={handleCancelUpload} className="p-2 rounded-full hover:bg-black/10 transition-colors">
                <X size={20} />
              </button>
            </div>

            {!selectedFile ? (
              <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-blue-500/50 rounded-2xl cursor-pointer hover:bg-blue-500/5 transition-colors">
                <Upload size={32} className="text-blue-500 mb-2" />
                <span className="font-medium text-blue-500">Select a PDF file</span>
                <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
              </label>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 p-3 bg-blue-500/10 rounded-xl text-blue-500">
                  <FileText size={24} className="shrink-0" />
                  <span className="font-medium truncate text-sm">{selectedFile.name}</span>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold opacity-70">Book Name</label>
                  <input 
                    type="text" 
                    value={customBookName}
                    onChange={(e) => setCustomBookName(e.target.value)}
                    placeholder="Leave empty to auto-detect..."
                    className="w-full px-4 py-3 rounded-xl border-2 border-black/10 bg-transparent focus:border-blue-500 focus:outline-none transition-colors"
                    style={{ color: currentTheme.text }}
                    autoFocus
                  />
                  <p className="text-[10px] opacity-50">If left empty, Ribi will try to extract the real book name from the PDF metadata.</p>
                </div>
                <button 
                  onClick={handleConfirmUpload}
                  className="w-full py-3 mt-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold transition-colors"
                >
                  Confirm Upload
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
