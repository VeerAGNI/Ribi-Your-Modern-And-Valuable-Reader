import React from 'react';
import { Upload, Book as BookIcon, Clock, Trash2, FileText } from 'lucide-react';
import { BookMetadata, Theme } from '../types';
import { THEMES } from '../constants';
import { cn, formatTime } from '../utils';

interface LibraryProps {
  books: BookMetadata[];
  onUpload: (file: File) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  theme: Theme;
}

export const Library: React.FC<LibraryProps> = ({ books, onUpload, onSelect, onDelete, theme }) => {
  const currentTheme = THEMES[theme];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      onUpload(file);
    }
  };

  return (
    <div className="flex flex-col h-full p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: currentTheme.text }}>Ribi</h1>
          <p className="text-sm opacity-50" style={{ color: currentTheme.text }}>Your Modern Reading Sanctuary</p>
        </div>
        <label className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full cursor-pointer transition-all shadow-lg shadow-blue-500/20">
          <Upload size={18} />
          <span className="text-sm font-semibold">Upload PDF</span>
          <input type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
        </label>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
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
                <div className="w-12 h-16 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-500">
                  <FileText size={24} />
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
                  className="p-2 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-red-500 transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 p-4 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-xl">
        <h4 className="font-bold mb-1">Reading Tip</h4>
        <p className="text-xs opacity-80 leading-relaxed">
          Try the "Midnight" theme with background rain sounds for a deeply immersive late-night reading session.
        </p>
      </div>
    </div>
  );
};
