import React, { useState, useEffect, useRef } from 'react';
import { Upload, Book as BookIcon, Clock, Trash2, FileText, X, Plus, AlertCircle, CheckCircle2, Edit2 } from 'lucide-react';
import { BookMetadata, Theme } from '../types';
import { THEMES, MAX_PDF_SIZE_BYTES, MAX_PDF_SIZE_MB } from '../constants';
import { cn, formatTime } from '../utils';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

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
  const [bookName, setBookName] = useState('');
  const [extractingMeta, setExtractingMeta] = useState(false);
  const [metaExtracted, setMetaExtracted] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const hasSeenTip = localStorage.getItem('veuros_seen_tip');
    if (!hasSeenTip) setShowTip(true);
  }, []);

  const dismissTip = () => {
    localStorage.setItem('veuros_seen_tip', 'true');
    setShowTip(false);
  };

  // Extract metadata (title) from PDF file
  const extractPdfTitle = async (file: File): Promise<string> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        verbosity: 0,
      } as any);
      const pdf = await loadingTask.promise;
      const metadata = await pdf.getMetadata().catch(() => null);
      pdf.destroy();
      const info = (metadata?.info as any) || {};
      const title = info?.Title?.trim();
      if (title && title.length > 1 && title.toLowerCase() !== 'untitled') {
        return title;
      }
    } catch {
      // fall through to filename
    }
    return file.name.replace(/\.pdf$/i, '').trim() || 'Untitled PDF';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setUploadError(null);
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setUploadError('Please select a valid PDF file.');
      return;
    }
    if (file.size > MAX_PDF_SIZE_BYTES) {
      setUploadError(`File too large. Maximum allowed size is ${MAX_PDF_SIZE_MB} MB.`);
      return;
    }

    setSelectedFile(file);
    setMetaExtracted(false);
    setExtractingMeta(true);
    setBookName('');

    const title = await extractPdfTitle(file);
    setBookName(title);
    setMetaExtracted(true);
    setExtractingMeta(false);
  };

  const handleConfirmUpload = () => {
    if (selectedFile) {
      onUpload(selectedFile, bookName.trim() || undefined);
      resetModal();
    }
  };

  const resetModal = () => {
    setIsUploadModalOpen(false);
    setSelectedFile(null);
    setBookName('');
    setUploadError(null);
    setMetaExtracted(false);
    setExtractingMeta(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (deleteConfirm === id) {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      onDelete(id);
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(id);
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = setTimeout(() => setDeleteConfirm(null), 2500);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col h-full p-6 relative">
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: currentTheme.text }}>Ribi</h1>
          <p className="text-xs opacity-40 mt-0.5" style={{ color: currentTheme.text }}>Continue Reading & Becoming</p>
        </div>
        <div className="text-xs opacity-30 font-mono" style={{ color: currentTheme.text }}>
          {books.length} book{books.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Book list */}
      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar mb-4 space-y-3">
        {books.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-56 border-2 border-dashed rounded-3xl transition-all"
            style={{ borderColor: `${currentTheme.text}25` }}>
            <BookIcon size={40} style={{ color: currentTheme.text, opacity: 0.2 }} />
            <p className="mt-3 text-sm font-medium opacity-25" style={{ color: currentTheme.text }}>Your library is empty</p>
            <p className="text-xs opacity-20 mt-1" style={{ color: currentTheme.text }}>Tap + to add your first book</p>
          </div>
        ) : (
          books
            .slice()
            .sort((a, b) => b.lastRead - a.lastRead)
            .map(book => {
              const progress = book.totalPages > 0 ? Math.round((book.currentPage / book.totalPages) * 100) : 0;
              return (
                <div
                  key={book.id}
                  onClick={() => onSelect(book.id)}
                  className="group relative flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all active:scale-[0.98] hover:scale-[1.015]"
                  style={{ backgroundColor: currentTheme.secondary, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                >
                  {/* Cover thumbnail */}
                  <div className="w-12 h-16 rounded-xl flex items-center justify-center overflow-hidden shrink-0"
                    style={{ background: 'rgba(59,130,246,0.1)' }}>
                    {book.coverImage ? (
                      <img src={book.coverImage} alt="Cover" className="w-full h-full object-cover" />
                    ) : (
                      <FileText size={22} style={{ color: currentTheme.accent, opacity: 0.6 }} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm truncate leading-tight" style={{ color: currentTheme.text }}>
                      {book.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 opacity-40 text-[10px]" style={{ color: currentTheme.text }}>
                      <Clock size={9} />
                      <span>{formatTime(book.lastRead)}</span>
                      <span>·</span>
                      <span>p.{book.currentPage}/{book.totalPages}</span>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-2 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.1)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${progress}%`, background: currentTheme.accent }}
                      />
                    </div>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={e => handleDeleteClick(e, book.id)}
                    className={cn(
                      'p-2 rounded-full transition-all shrink-0',
                      deleteConfirm === book.id
                        ? 'bg-red-500 text-white scale-110'
                        : 'opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-red-500/10 text-red-500'
                    )}
                    title={deleteConfirm === book.id ? 'Confirm delete' : 'Delete'}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })
        )}
      </div>

      {/* Add button */}
      <button
        onClick={() => setIsUploadModalOpen(true)}
        className="flex items-center justify-center gap-2 px-4 py-4 text-white rounded-2xl cursor-pointer transition-all shadow-lg w-full mt-auto active:scale-95"
        style={{ background: currentTheme.accent, boxShadow: `0 8px 24px ${currentTheme.accent}40` }}
      >
        <Plus size={22} />
        <span className="font-bold text-sm">Add PDF</span>
      </button>

      {/* Tip card */}
      {showTip && (
        <div className="mt-3 p-4 rounded-2xl relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.9), rgba(99,60,220,0.9))', color: '#fff' }}>
          <button onClick={dismissTip} className="absolute top-2.5 right-2.5 p-1 hover:bg-white/20 rounded-full transition-colors">
            <X size={13} />
          </button>
          <h4 className="font-bold text-sm mb-1">Pro Tip</h4>
          <p className="text-xs opacity-80 leading-relaxed pr-5">
            Try the Midnight theme with rain sounds for an immersive late-night reading session.
          </p>
        </div>
      )}

      {/* Upload Modal */}
      {isUploadModalOpen && (
        <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center p-4 rounded-3xl"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}>
          <div
            className="w-full max-w-sm rounded-3xl p-6 shadow-2xl flex flex-col gap-4"
            style={{
              backgroundColor: currentTheme.bg,
              border: `1px solid rgba(255,255,255,0.06)`,
              boxShadow: '0 32px 64px rgba(0,0,0,0.4)',
            }}
          >
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold" style={{ color: currentTheme.text }}>Add to Library</h3>
              <button onClick={resetModal} className="p-2 rounded-full hover:bg-black/10 transition-colors"
                style={{ color: currentTheme.text }}>
                <X size={18} />
              </button>
            </div>

            {/* Error */}
            {uploadError && (
              <div className="flex items-start gap-2 px-4 py-3 rounded-xl text-sm"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171' }}>
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                {uploadError}
              </div>
            )}

            {!selectedFile ? (
              <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-2xl cursor-pointer transition-colors hover:bg-blue-500/5"
                style={{ borderColor: `${currentTheme.accent}50` }}>
                <Upload size={28} style={{ color: currentTheme.accent, marginBottom: 8 }} />
                <span className="font-semibold text-sm" style={{ color: currentTheme.accent }}>Select PDF File</span>
                <span className="text-[10px] opacity-40 mt-1" style={{ color: currentTheme.text }}>Max {MAX_PDF_SIZE_MB} MB</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            ) : (
              <div className="flex flex-col gap-4">
                {/* File info */}
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: `${currentTheme.accent}15`, border: `1px solid ${currentTheme.accent}25` }}>
                  <FileText size={20} style={{ color: currentTheme.accent }} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" style={{ color: currentTheme.text }}>{selectedFile.name}</p>
                    <p className="text-[10px] opacity-50" style={{ color: currentTheme.text }}>{formatFileSize(selectedFile.size)}</p>
                  </div>
                  {metaExtracted && <CheckCircle2 size={16} className="text-green-500 shrink-0" />}
                </div>

                {/* Book name */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-50" style={{ color: currentTheme.text }}>
                    Book Name
                  </label>
                  <div className="relative">
                    {extractingMeta ? (
                      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 opacity-60"
                        style={{ borderColor: `${currentTheme.text}15`, color: currentTheme.text }}>
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm">Extracting title…</span>
                      </div>
                    ) : (
                      <>
                        <input
                          type="text"
                          value={bookName}
                          onChange={e => setBookName(e.target.value)}
                          placeholder="Book name"
                          className="w-full pl-4 pr-10 py-3 rounded-xl border-2 bg-transparent focus:outline-none transition-colors text-sm"
                          style={{
                            borderColor: `${currentTheme.text}15`,
                            color: currentTheme.text,
                          }}
                          onFocus={e => e.target.style.borderColor = currentTheme.accent}
                          onBlur={e => e.target.style.borderColor = `${currentTheme.text}15`}
                          autoFocus
                        />
                        <Edit2 size={13} className="absolute right-3.5 top-3.5 opacity-30" style={{ color: currentTheme.text }} />
                      </>
                    )}
                  </div>
                  {metaExtracted && (
                    <p className="text-[10px] opacity-40 flex items-center gap-1" style={{ color: currentTheme.text }}>
                      <CheckCircle2 size={10} /> Title extracted from PDF metadata — edit if needed
                    </p>
                  )}
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={resetModal}
                    className="flex-1 py-3 rounded-xl font-semibold text-sm transition-colors"
                    style={{ background: 'rgba(0,0,0,0.08)', color: currentTheme.text }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmUpload}
                    disabled={extractingMeta || !bookName.trim()}
                    className="flex-1 py-3 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-40"
                    style={{ background: currentTheme.accent }}
                  >
                    Add to Library
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
