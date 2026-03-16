import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Bookmark, BookmarkCheck } from 'lucide-react';
import { Theme, Bookmark as BookmarkType, ViewMode, FontFamily } from '../types';
import { THEMES, FONT_FAMILIES } from '../constants';
import { cn } from '../utils';
import { ReaderView } from './ReaderView';

// Set up worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface PDFReaderProps {
  file: File | string;
  currentPage: number;
  onPageChange: (page: number) => void;
  theme: Theme;
  viewMode: ViewMode;
  fontFamily: FontFamily;
  brightness: number;
  fontSize: number;
  lineHeight: number;
  isAutoScrolling: boolean;
  autoScrollSpeed: number;
  bookmarks: BookmarkType[];
  onToggleBookmark: (page: number) => void;
}

export const PDFReader: React.FC<PDFReaderProps> = ({
  file,
  currentPage,
  onPageChange,
  theme,
  viewMode,
  fontFamily,
  brightness,
  fontSize,
  lineHeight,
  isAutoScrolling,
  autoScrollSpeed,
  bookmarks,
  onToggleBookmark,
}) => {
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1.5);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const currentTheme = THEMES[theme];

  // Callback ref to handle canvas mounting
  const canvasRef = useCallback((node: HTMLCanvasElement | null) => {
    setCanvasElement(node);
  }, []);

  useEffect(() => {
    const loadPdf = async () => {
      setLoading(true);
      try {
        const url = typeof file === 'string' ? file : URL.createObjectURL(file);
        const loadingTask = pdfjsLib.getDocument(url);
        const pdfDoc = await loadingTask.promise;
        setPdf(pdfDoc);
        setNumPages(pdfDoc.numPages);
      } catch (error) {
        console.error('Error loading PDF:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPdf();

    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [file]);

  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdf || !canvasElement) return;

    // Cancel and WAIT for any ongoing render task to finish/fail
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
        // We await the promise to ensure the canvas is released
        await renderTaskRef.current.promise;
      } catch (error: any) {
        // Ignore cancellation errors
        if (error.name !== 'RenderingCancelledException') {
          console.error('Error during task cancellation:', error);
        }
      }
      renderTaskRef.current = null;
    }

    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = canvasElement;
      const context = canvas.getContext('2d');

      if (!context) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;

      await renderTask.promise;
      
      // Only clear the ref if it's still pointing to this task
      if (renderTaskRef.current === renderTask) {
        renderTaskRef.current = null;
      }
    } catch (error: any) {
      if (error.name === 'RenderingCancelledException') {
        return;
      }
      console.error('Error rendering page:', error);
    }
  }, [pdf, scale, canvasElement]);

  useEffect(() => {
    if (pdf && canvasElement) {
      renderPage(currentPage);
    }
  }, [pdf, currentPage, renderPage, canvasElement]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const isBookmarked = bookmarks.some(b => b.pageNumber === currentPage);

  // Theme-aware PDF filters
  const getPdfFilter = () => {
    let filter = `brightness(${brightness}%) contrast(${fontSize}%)`;
    if (theme === 'dark' || theme === 'midnight' || theme === 'nord') {
      filter += ' invert(90%) hue-rotate(180deg)';
    } else if (theme === 'sepia') {
      filter += ' sepia(40%) brightness(102%)';
    }
    return filter;
  };

  // Smoother auto-scroll using requestAnimationFrame
  useEffect(() => {
    if (!isAutoScrolling || autoScrollSpeed === 0 || !containerRef.current) return;

    let rafId: number;
    const scroll = () => {
      if (containerRef.current) {
        // Slowed down speed: speed 1 = 0.5px per frame
        const speedMultiplier = 0.5;
        containerRef.current.scrollTop += autoScrollSpeed * speedMultiplier;

        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
        if (scrollTop + clientHeight >= scrollHeight - 2) {
          if (currentPage < numPages) {
            onPageChange(currentPage + 1);
            containerRef.current.scrollTop = 0;
          }
        }
      }
      rafId = requestAnimationFrame(scroll);
    };

    rafId = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(rafId);
  }, [isAutoScrolling, autoScrollSpeed, currentPage, numPages, onPageChange]);

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative flex flex-col items-center w-full h-full overflow-hidden transition-colors duration-700",
        theme === 'sepia' && "sepia-texture",
        (theme === 'dark' || theme === 'nord') && "dark-texture",
        theme === 'midnight' && "midnight-texture",
        "paper-texture"
      )}
      style={{ 
        backgroundColor: currentTheme.bg,
      }}
    >
      {loading ? (
        <div className="flex items-center justify-center h-full">
          <div className="w-12 h-12 border-4 border-blue-500 rounded-full border-t-transparent animate-spin" />
        </div>
      ) : (
        <>
          {/* Top Bar Overlay */}
          <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/20 to-transparent opacity-0 hover:opacity-100 transition-opacity">
            <div className="text-sm font-medium" style={{ color: currentTheme.text }}>
              Page {currentPage} of {numPages}
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => onToggleBookmark(currentPage)}
                className="p-2 rounded-full hover:bg-black/10 transition-colors"
                style={{ color: isBookmarked ? currentTheme.accent : currentTheme.text }}
              >
                {isBookmarked ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}
              </button>
              <button 
                onClick={toggleFullscreen}
                className="p-2 rounded-full hover:bg-black/10 transition-colors"
                style={{ color: currentTheme.text }}
              >
                {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
              </button>
            </div>
          </div>

          {/* Reader Viewport */}
          <div className="flex-1 w-full overflow-y-auto custom-scrollbar" id="reader-viewport" style={{ scrollBehavior: isAutoScrolling ? 'auto' : 'smooth' }}>
            {viewMode === 'reader' && pdf ? (
              <ReaderView 
                pdf={pdf}
                theme={theme}
                fontFamily={fontFamily}
                fontSize={fontSize}
                lineHeight={lineHeight}
                currentPage={currentPage}
                onPageChange={onPageChange}
                isAutoScrolling={isAutoScrolling}
                autoScrollSpeed={autoScrollSpeed}
              />
            ) : (
              <div className="flex justify-center p-8 min-h-full">
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="shadow-2xl rounded-sm overflow-hidden bg-white relative"
                  style={{ 
                    filter: getPdfFilter(),
                    boxShadow: theme === 'sepia' ? '0 25px 50px -12px rgba(91, 70, 54, 0.25)' : '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                  }}
                >
                  <canvas ref={canvasRef} className="max-w-full h-auto block" />
                </motion.div>
              </div>
            )}
          </div>

          {/* Navigation Controls */}
          <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center gap-8 z-10 pointer-events-none">
            <button
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
              className="p-4 rounded-full bg-black/10 backdrop-blur-md text-white hover:bg-black/20 transition-all pointer-events-auto disabled:opacity-30"
            >
              <ChevronLeft size={24} />
            </button>
            <div className="px-6 py-2 rounded-full bg-black/10 backdrop-blur-md text-white font-mono text-sm pointer-events-auto">
              {Math.round((currentPage / numPages) * 100)}%
            </div>
            <button
              disabled={currentPage >= numPages}
              onClick={() => onPageChange(currentPage + 1)}
              className="p-4 rounded-full bg-black/10 backdrop-blur-md text-white hover:bg-black/20 transition-all pointer-events-auto disabled:opacity-30"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </>
      )}
    </div>
  );
};
