import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Bookmark, BookmarkCheck, ZoomIn, ZoomOut, AlertCircle } from 'lucide-react';
import { Theme, Bookmark as BookmarkType, ViewMode, ReaderSettings } from '../types';
import { THEMES } from '../constants';
import { cn } from '../utils';
import { PDFPage, clearPageCacheByFingerprint } from './PDFPage';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface PDFReaderProps {
  file: Blob | string;
  currentPage: number;
  onPageChange: (page: number) => void;
  onUpdate: (updates: Partial<ReaderSettings>) => void;
  theme: Theme;
  viewMode: ViewMode;
  fontFamily: string;
  brightness: number;
  fontSize: number;
  lineHeight: number;
  isAutoScrolling: boolean;
  autoScrollSpeed: number;
  renderQuality: number;
  bookmarks: BookmarkType[];
  onToggleBookmark: (page: number) => void;
}

export const PDFReader: React.FC<PDFReaderProps> = ({
  file,
  currentPage,
  onPageChange,
  theme,
  viewMode,
  brightness,
  isAutoScrolling,
  autoScrollSpeed,
  renderQuality,
  bookmarks,
  onToggleBookmark,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const pageChangeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interactionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number>(0);
  const isRenderingRef = useRef(false);

  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scale, setScale] = useState(1.5);
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const [scrollPercentage, setScrollPercentage] = useState(0);
  const [pageInput, setPageInput] = useState<string | null>(null);
  const [pageRenderKey, setPageRenderKey] = useState(0);

  const currentTheme = THEMES[theme];
  const quality = Math.max(1, Math.min(4, renderQuality || 2));

  useEffect(() => {
    const onResize = () => setIsLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Load PDF — properly destroys previous document and clears cache
  useEffect(() => {
    let destroyed = false;
    let objectUrl: string | null = null;
    let newPdf: pdfjsLib.PDFDocumentProxy | null = null;

    const load = async () => {
      setLoading(true);
      setLoadError(null);

      // Cancel in-flight render
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        try { await renderTaskRef.current.promise; } catch { /* ignore cancel */ }
        renderTaskRef.current = null;
      }

      // Destroy previous PDF and clear its cache entries
      setPdf(prev => {
        if (prev) {
          const fp = (prev as any).fingerprints?.[0];
          if (fp) clearPageCacheByFingerprint(fp);
          prev.destroy().catch(() => {});
        }
        return null;
      });

      try {
        if (typeof file === 'string' && file === '') {
          setLoadError('No file provided.');
          setLoading(false);
          return;
        }

        const src = typeof file === 'string' ? file : (() => {
          objectUrl = URL.createObjectURL(file as Blob);
          return objectUrl;
        })();

        const loadingTask = pdfjsLib.getDocument({
          url: src,
          disableAutoFetch: false,
          disableStream: false,
          rangeChunkSize: 65536,
          verbosity: 0,
        });

        newPdf = await loadingTask.promise;
        if (destroyed) { newPdf.destroy(); return; }

        setPdf(newPdf);
        setNumPages(newPdf.numPages);
      } catch (err: any) {
        if (destroyed) return;
        console.error('PDFReader: failed to load PDF', err);
        if (err?.name === 'PasswordException') {
          setLoadError('This PDF is password-protected.');
        } else if (err?.message?.includes('Invalid PDF')) {
          setLoadError('This file appears to be corrupted or invalid.');
        } else {
          setLoadError('Failed to load PDF. The file may be damaged or unsupported.');
        }
      } finally {
        if (!destroyed) setLoading(false);
      }
    };

    load();

    return () => {
      destroyed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [file]);

  // Render page mode — single persistent canvas, no remounting
  const renderPage = useCallback(async (pageNum: number) => {
    const canvas = canvasRef.current;
    if (!pdf || !canvas || viewMode !== 'page') return;
    if (isRenderingRef.current) {
      // Cancel current render before starting new one
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        try { await renderTaskRef.current.promise; } catch { /* ignore cancel */ }
        renderTaskRef.current = null;
      }
    }

    isRenderingRef.current = true;
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const pixelRatio = window.devicePixelRatio || 1;

      const maxDim = 10000;
      const multiplier = Math.min(pixelRatio * quality, maxDim / Math.max(viewport.width, viewport.height));
      const renderViewport = page.getViewport({ scale: scale * multiplier });

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      canvas.width = renderViewport.width;
      canvas.height = renderViewport.height;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      const renderTask = page.render({ canvasContext: ctx, viewport: renderViewport } as any);
      renderTaskRef.current = renderTask;
      await renderTask.promise;
      renderTaskRef.current = null;
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error('PDFReader: render error', err);
      }
      renderTaskRef.current = null;
    } finally {
      isRenderingRef.current = false;
    }
  }, [pdf, scale, viewMode, quality]);

  // Re-render on page/scale/quality change (page mode only)
  useEffect(() => {
    if (pdf && viewMode === 'page' && canvasRef.current) {
      renderPage(currentPage);
    }
  }, [pdf, currentPage, renderPage, viewMode, pageRenderKey]);

  // Canvas callback ref — stable, never reassigned
  const setCanvasRef = useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node;
    if (node && pdf && viewMode === 'page') {
      renderPage(currentPage);
    }
  }, [pdf, currentPage, viewMode, renderPage]);

  // Force re-render when switching to page mode
  useEffect(() => {
    if (viewMode === 'page') {
      setPageRenderKey(k => k + 1);
    }
  }, [viewMode]);

  // Fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFSChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFSChange);
    return () => document.removeEventListener('fullscreenchange', onFSChange);
  }, []);

  // PDF filter
  const getPdfFilter = useCallback(() => {
    let f = `brightness(${brightness}%)`;
    if (quality >= 3) f += ' contrast(108%) saturate(104%)';
    if (theme === 'dark' || theme === 'midnight' || theme === 'nord') f += ' invert(90%) hue-rotate(180deg)';
    else if (theme === 'sepia') f += ' sepia(40%)';
    return f;
  }, [brightness, theme, quality]);

  // Scroll percentage
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = vp;
      const total = scrollHeight - clientHeight;
      setScrollPercentage(total > 0 ? Math.round((scrollTop / total) * 100) : 0);
    };
    vp.addEventListener('scroll', onScroll, { passive: true });
    return () => vp.removeEventListener('scroll', onScroll);
  }, []);

  // Page tracking in continuous mode (debounced 150ms)
  useEffect(() => {
    if (viewMode !== 'continuous' || !viewportRef.current || !pdf) return;

    const onScroll = () => {
      if (pageChangeDebounceRef.current) clearTimeout(pageChangeDebounceRef.current);
      pageChangeDebounceRef.current = setTimeout(() => {
        const vp = viewportRef.current;
        if (!vp) return;
        const center = vp.scrollTop + vp.clientHeight / 2;
        let closest = 1;
        let minDist = Infinity;
        for (let i = 1; i <= numPages; i++) {
          const el = document.getElementById(`pdf-page-${i}`);
          if (el) {
            const dist = Math.abs(el.offsetTop + el.offsetHeight / 2 - center);
            if (dist < minDist) { minDist = dist; closest = i; }
          }
        }
        if (closest !== currentPage) onPageChange(closest);
      }, 150);
    };

    const vp = viewportRef.current;
    vp.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      vp.removeEventListener('scroll', onScroll);
      if (pageChangeDebounceRef.current) clearTimeout(pageChangeDebounceRef.current);
    };
  }, [viewMode, pdf, numPages, currentPage, onPageChange]);

  // User interaction pause for auto-scroll
  const handleInteraction = useCallback(() => {
    if (!isAutoScrolling) return;
    setIsUserInteracting(true);
    if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
    interactionTimeoutRef.current = setTimeout(() => setIsUserInteracting(false), 2000);
  }, [isAutoScrolling]);

  // Auto-scroll via RAF
  useEffect(() => {
    if (!isAutoScrolling || autoScrollSpeed === 0 || isUserInteracting) {
      cancelAnimationFrame(rafRef.current);
      return;
    }
    const scroll = () => {
      const vp = viewportRef.current;
      if (vp && !isUserInteracting) {
        vp.scrollTop += autoScrollSpeed * 0.4;
        if (viewMode === 'page') {
          const { scrollTop, scrollHeight, clientHeight } = vp;
          if (scrollTop + clientHeight >= scrollHeight - 2 && currentPage < numPages) {
            onPageChange(currentPage + 1);
            vp.scrollTop = 0;
          }
        }
      }
      rafRef.current = requestAnimationFrame(scroll);
    };
    rafRef.current = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isAutoScrolling, autoScrollSpeed, currentPage, numPages, onPageChange, viewMode, isUserInteracting]);

  // Navigation
  const navigate = useCallback((page: number) => {
    const clamped = Math.max(1, Math.min(numPages, page));
    if (viewMode === 'continuous') {
      const el = document.getElementById(`pdf-page-${clamped}`);
      if (el && viewportRef.current) {
        viewportRef.current.scrollTo({ top: el.offsetTop, behavior: 'smooth' });
      }
    } else {
      onPageChange(clamped);
      if (viewportRef.current) viewportRef.current.scrollTop = 0;
    }
  }, [numPages, viewMode, onPageChange]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') navigate(currentPage + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') navigate(currentPage - 1);
      else if (e.key === 'f' || e.key === 'F') toggleFullscreen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentPage, navigate, toggleFullscreen]);

  const isBookmarked = bookmarks.some(b => b.pageNumber === currentPage);
  const progress = numPages > 0 ? Math.round((currentPage / numPages) * 100) : 0;

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex flex-col w-full h-full overflow-hidden transition-colors duration-500',
        theme === 'sepia' && 'sepia-texture',
        (theme === 'dark' || theme === 'nord') && 'dark-texture',
        theme === 'midnight' && 'midnight-texture',
        'paper-texture'
      )}
      style={{ backgroundColor: currentTheme.bg }}
    >
      {/* Loading */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 gap-4" style={{ background: currentTheme.bg }}>
          <div className="w-12 h-12 border-t-transparent rounded-full animate-spin" style={{ borderWidth: 3, borderColor: currentTheme.accent, borderTopColor: 'transparent', borderStyle: 'solid' }} />
          <p className="text-sm opacity-40" style={{ color: currentTheme.text }}>Loading PDF…</p>
        </div>
      )}

      {/* Error */}
      {loadError && !loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 gap-4 p-8 text-center" style={{ background: currentTheme.bg }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
            <AlertCircle size={32} className="text-red-500" />
          </div>
          <div>
            <p className="font-bold text-lg mb-2" style={{ color: currentTheme.text }}>Unable to Open PDF</p>
            <p className="text-sm opacity-50 max-w-xs" style={{ color: currentTheme.text }}>{loadError}</p>
          </div>
        </div>
      )}

      {!loading && !loadError && pdf && (
        <>
          {/* Progress bar */}
          <div className="absolute top-0 left-0 right-0 h-0.5 z-30" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div className="h-full transition-all duration-300" style={{ width: `${progress}%`, background: currentTheme.accent }} />
          </div>

          {/* Top HUD */}
          <motion.div
            initial={{ opacity: 0 }}
            whileHover={{ opacity: 1 }}
            className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-5 py-4 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 100%)' }}
          >
            <div className="pointer-events-auto">
              {pageInput !== null ? (
                <input
                  type="number"
                  min={1}
                  max={numPages}
                  value={pageInput}
                  autoFocus
                  className="w-20 text-center text-sm font-mono text-white bg-black/40 border border-white/20 rounded-lg px-2 py-1 focus:outline-none"
                  onChange={e => setPageInput(e.target.value)}
                  onBlur={() => {
                    const p = parseInt(pageInput);
                    if (!isNaN(p)) navigate(p);
                    setPageInput(null);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') setPageInput(null);
                  }}
                />
              ) : (
                <button
                  onClick={() => setPageInput(String(currentPage))}
                  className="text-sm font-medium text-white/80 hover:text-white transition-colors font-mono"
                >
                  {currentPage} / {numPages}
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 pointer-events-auto">
              <div className="flex items-center bg-black/25 backdrop-blur-md rounded-full px-2 border border-white/10">
                <button onClick={() => setScale(s => Math.max(0.5, parseFloat((s - 0.2).toFixed(1))))}
                  className="p-2 text-white/80 hover:text-white transition-colors">
                  <ZoomOut size={16} />
                </button>
                <span className="text-xs font-mono w-11 text-center text-white/70">{Math.round(scale * 100)}%</span>
                <button onClick={() => setScale(s => Math.min(5, parseFloat((s + 0.2).toFixed(1))))}
                  className="p-2 text-white/80 hover:text-white transition-colors">
                  <ZoomIn size={16} />
                </button>
              </div>

              <button
                onClick={() => onToggleBookmark(currentPage)}
                className="p-2 rounded-full transition-all"
                style={{ color: isBookmarked ? '#F59E0B' : 'rgba(255,255,255,0.7)', background: isBookmarked ? 'rgba(245,158,11,0.15)' : 'rgba(0,0,0,0.2)' }}
              >
                {isBookmarked ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
              </button>

              <button onClick={toggleFullscreen}
                className="p-2 rounded-full bg-black/20 text-white/70 hover:text-white transition-all">
                {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
            </div>
          </motion.div>

          {/* Reader viewport */}
          <div
            ref={viewportRef}
            className="flex-1 w-full overflow-y-auto custom-scrollbar"
            style={{ scrollBehavior: isAutoScrolling ? 'auto' : 'smooth' }}
            onMouseDown={handleInteraction}
            onTouchStart={handleInteraction}
            onTouchMove={handleInteraction}
            onWheel={handleInteraction}
          >
            {viewMode === 'continuous' ? (
              <div className="flex flex-col items-center py-6">
                {Array.from({ length: numPages }, (_, i) => (
                  <div key={i + 1} id={`pdf-page-${i + 1}`} className="w-full">
                    <PDFPage
                      pdf={pdf}
                      pageNumber={i + 1}
                      scale={scale}
                      brightness={brightness}
                      contrast={100}
                      theme={theme}
                      isLandscape={isLandscape}
                      renderQuality={quality}
                      onVisible={() => {}}
                    />
                  </div>
                ))}
              </div>
            ) : (
              /* Page mode — single persistent canvas, NO key remounting */
              <div className={cn('flex justify-center items-start min-h-full', isLandscape ? 'p-2' : 'p-6 sm:p-10')}>
                <div
                  className="shadow-2xl rounded-sm overflow-hidden bg-white relative"
                  style={{
                    filter: getPdfFilter(),
                    boxShadow: theme === 'sepia'
                      ? '0 24px 48px -10px rgba(91,70,54,0.3)'
                      : '0 24px 56px -12px rgba(0,0,0,0.55)',
                  }}
                >
                  <canvas ref={setCanvasRef} className="max-w-full h-auto block" />
                </div>
              </div>
            )}
          </div>

          {/* Bottom navigation */}
          <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center gap-5 z-10 pointer-events-none">
            <button
              disabled={currentPage <= 1}
              onClick={() => navigate(currentPage - 1)}
              className="p-3.5 rounded-full backdrop-blur-md text-white transition-all pointer-events-auto disabled:opacity-25 active:scale-90"
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <ChevronLeft size={22} />
            </button>

            <div
              className="px-5 py-2 rounded-full backdrop-blur-md text-white font-mono text-xs font-medium pointer-events-auto cursor-pointer"
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)' }}
              onClick={() => setPageInput(String(currentPage))}
            >
              {viewMode === 'continuous' ? `${scrollPercentage}%` : `${progress}%`}
            </div>

            <button
              disabled={currentPage >= numPages}
              onClick={() => navigate(currentPage + 1)}
              className="p-3.5 rounded-full backdrop-blur-md text-white transition-all pointer-events-auto disabled:opacity-25 active:scale-90"
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <ChevronRight size={22} />
            </button>
          </div>
        </>
      )}
    </div>
  );
};
