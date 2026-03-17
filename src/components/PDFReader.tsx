import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Bookmark, BookmarkCheck, ZoomIn, ZoomOut } from 'lucide-react';
import { Theme, Bookmark as BookmarkType, ViewMode, FontFamily, ReaderSettings } from '../types';
import { THEMES, FONT_FAMILIES } from '../constants';
import { cn } from '../utils';
import { PDFPage } from './PDFPage';

// Set up worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface PDFReaderProps {
  file: Blob | string;
  currentPage: number;
  onPageChange: (page: number) => void;
  onUpdate: (updates: Partial<ReaderSettings>) => void;
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
  onUpdate,
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
  const viewportRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1.5);
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentTheme = THEMES[theme];

  // Optimize for landscape mode and responsive scaling
  useEffect(() => {
    const handleResize = () => {
      const landscape = window.innerWidth > window.innerHeight;
      setIsLandscape(landscape);
      
      // Auto-adjust scale for better readability
      // We use a slightly higher scale in landscape to fill the width
      if (landscape) {
        setScale(prev => (prev < 1.0 ? 1.2 : prev));
      } else {
        setScale(prev => (prev > 1.2 ? 1.0 : prev));
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    if (!pdf || !canvasElement || viewMode !== 'page') return;

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
      const pixelRatio = window.devicePixelRatio || 1;
      // Optimized: Render at max 2x scale for quality without excessive memory
      const renderScale = scale * Math.min(pixelRatio, 1.5);
      const renderViewport = page.getViewport({ scale: renderScale });
      
      const canvas = canvasElement;
      const context = canvas.getContext('2d');

      if (!context) return;

      // Enable medium quality image smoothing for better performance
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'medium';

      canvas.height = renderViewport.height;
      canvas.width = renderViewport.width;
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
      canvas.style.aspectRatio = `${viewport.width} / ${viewport.height}`;

      const renderContext = {
        canvasContext: context,
        viewport: renderViewport,
      };

      const renderTask = page.render(renderContext as any);
      renderTaskRef.current = renderTask;

      await renderTask.promise;
      
      if (renderTaskRef.current === renderTask) {
        renderTaskRef.current = null;
      }
    } catch (error: any) {
      if (error.name === 'RenderingCancelledException') {
        return;
      }
      console.error('Error rendering page:', error);
    }
  }, [pdf, scale, canvasElement, viewMode]);

  useEffect(() => {
    if (pdf && canvasElement && viewMode === 'page') {
      renderPage(currentPage);
    }
  }, [pdf, currentPage, renderPage, canvasElement, viewMode]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Background pre-loader to cache all pages
  useEffect(() => {
    if (!pdf || loading) return;

    const cacheAllPages = async () => {
      for (let i = 1; i <= numPages; i++) {
        try {
          // Fetching the page triggers internal PDF.js caching
          await pdf.getPage(i);
          // Small delay to keep UI responsive
          if (i % 5 === 0) await new Promise(resolve => setTimeout(resolve, 100));
        } catch (e) {
          console.warn(`Failed to pre-cache page ${i}`);
        }
      }
    };

    cacheAllPages();
  }, [pdf, loading, numPages]);

  const isBookmarked = bookmarks.some(b => b.pageNumber === currentPage);

  // Theme-aware PDF filters
  const getPdfFilter = () => {
    let filter = `brightness(${brightness}%) contrast(100%)`;
    if (theme === 'dark' || theme === 'midnight' || theme === 'nord') {
      filter += ' invert(90%) hue-rotate(180deg)';
    } else if (theme === 'sepia') {
      filter += ' sepia(40%) brightness(102%)';
    }
    return filter;
  };

  const [scrollPercentage, setScrollPercentage] = useState(0);

  // Track current page and percentage based on scroll position
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !pdf) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = viewport;
      const totalScrollable = scrollHeight - clientHeight;
      const percentage = totalScrollable > 0 ? Math.round((scrollTop / totalScrollable) * 100) : 0;
      setScrollPercentage(percentage);

      if (viewMode === 'continuous') {
        const estimatedPage = Math.max(1, Math.min(numPages, Math.ceil((scrollTop / scrollHeight) * numPages) + 1));
        // We don't call onPageChange here to avoid infinite loops, 
        // but we could if we check if it's different enough.
      }
    };

    viewport.addEventListener('scroll', handleScroll, { passive: true });
    // Initial calculation
    handleScroll();
    
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, [viewMode, pdf, numPages, currentPage]);

  // Handle user interaction to pause auto-scroll
  const handleInteraction = useCallback(() => {
    if (!isAutoScrolling) return;
    
    setIsUserInteracting(true);
    
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }
    
    interactionTimeoutRef.current = setTimeout(() => {
      setIsUserInteracting(false);
    }, 2000); // Resume after 2 seconds of no interaction
  }, [isAutoScrolling]);

  // Smoother auto-scroll using requestAnimationFrame
  useEffect(() => {
    if (!isAutoScrolling || autoScrollSpeed === 0 || !viewportRef.current || isUserInteracting) return;

    let rafId: number;
    const scroll = () => {
      if (viewportRef.current && !isUserInteracting) {
        // Slowed down speed: speed 1 = 0.5px per frame
        const speedMultiplier = 0.5;
        viewportRef.current.scrollTop += autoScrollSpeed * speedMultiplier;

        if (viewMode === 'page') {
          const { scrollTop, scrollHeight, clientHeight } = viewportRef.current;
          if (scrollTop + clientHeight >= scrollHeight - 2) {
            if (currentPage < numPages) {
              onPageChange(currentPage + 1);
              viewportRef.current.scrollTop = 0;
            }
          }
        }
      }
      rafId = requestAnimationFrame(scroll);
    };

    rafId = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(rafId);
  }, [isAutoScrolling, autoScrollSpeed, currentPage, numPages, onPageChange, viewMode, isUserInteracting]);

  // Track current page based on scroll position in continuous mode
  useEffect(() => {
    if (viewMode !== 'continuous' || !viewportRef.current || !pdf) return;

    const handleScroll = () => {
      if (!viewportRef.current) return;
      
      const { scrollTop, clientHeight } = viewportRef.current;
      const scrollCenter = scrollTop + clientHeight / 2;
      
      // Find the page that is currently at the center of the viewport
      const pageElements = Array.from({ length: numPages }, (_, i) => 
        document.getElementById(`pdf-page-${i + 1}`)
      );
      
      let closestPage = 1;
      let minDistance = Infinity;
      
      pageElements.forEach((el, index) => {
        if (el) {
          const distance = Math.abs(el.offsetTop + el.offsetHeight / 2 - scrollCenter);
          if (distance < minDistance) {
            minDistance = distance;
            closestPage = index + 1;
          }
        }
      });
      
      if (closestPage !== currentPage) {
        onPageChange(closestPage);
      }
    };

    const viewport = viewportRef.current;
    viewport.addEventListener('scroll', handleScroll, { passive: true });
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, [viewMode, pdf, numPages, currentPage, onPageChange]);

  // Handle page navigation
  const handlePageNavigation = (newPage: number) => {
    if (newPage < 1 || newPage > numPages) return;
    
    if (viewMode === 'continuous') {
      const pageElement = document.getElementById(`pdf-page-${newPage}`);
      if (pageElement && viewportRef.current) {
        viewportRef.current.scrollTo({
          top: pageElement.offsetTop,
          behavior: 'smooth'
        });
      }
    } else {
      onPageChange(newPage);
      if (viewportRef.current) {
        viewportRef.current.scrollTop = 0;
      }
    }
  };

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
            <div className="flex gap-2 items-center">
              <div className="flex items-center bg-black/10 rounded-full px-2 mr-2">
                <button 
                  onClick={() => setScale(prev => Math.max(0.5, prev - 0.2))}
                  className="p-2 rounded-full hover:bg-black/10 transition-colors"
                  style={{ color: currentTheme.text }}
                  title="Zoom Out"
                >
                  <ZoomOut size={18} />
                </button>
                <span className="text-xs font-mono w-12 text-center" style={{ color: currentTheme.text }}>
                  {Math.round(scale * 100)}%
                </span>
                <button 
                  onClick={() => setScale(prev => Math.min(4, prev + 0.2))}
                  className="p-2 rounded-full hover:bg-black/10 transition-colors"
                  style={{ color: currentTheme.text }}
                  title="Zoom In"
                >
                  <ZoomIn size={18} />
                </button>
              </div>
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
          <div 
            ref={viewportRef}
            className="flex-1 w-full overflow-y-auto custom-scrollbar" 
            id="reader-viewport" 
            style={{ scrollBehavior: isAutoScrolling ? 'auto' : 'smooth' }}
            onMouseDown={handleInteraction}
            onTouchStart={handleInteraction}
            onTouchMove={handleInteraction}
            onWheel={handleInteraction}
          >
            {viewMode === 'continuous' && pdf ? (
              <div className="flex flex-col items-center py-2">
                {Array.from({ length: numPages }, (_, i) => (
                  <div
                    key={i + 1}
                    id={`pdf-page-${i + 1}`}
                    className="w-full max-w-4xl"
                  >
                    <PDFPage 
                      pdf={pdf}
                      pageNumber={i + 1}
                      scale={scale}
                      brightness={brightness}
                      contrast={100}
                      theme={theme}
                      isLandscape={isLandscape}
                      onVisible={() => {}}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className={cn(
                "flex justify-center items-start min-h-full",
                isLandscape ? "p-2" : "p-4"
              )}>
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
              onClick={() => handlePageNavigation(currentPage - 1)}
              className="p-4 rounded-full bg-black/10 backdrop-blur-md text-white hover:bg-black/20 transition-all pointer-events-auto disabled:opacity-30"
            >
              <ChevronLeft size={24} />
            </button>
            <div className="px-6 py-2 rounded-full bg-black/10 backdrop-blur-md text-white font-mono text-sm pointer-events-auto">
              {viewMode === 'continuous' ? `${scrollPercentage}%` : `${Math.round((currentPage / numPages) * 100)}%`}
            </div>
            <button
              disabled={currentPage >= numPages}
              onClick={() => handlePageNavigation(currentPage + 1)}
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
