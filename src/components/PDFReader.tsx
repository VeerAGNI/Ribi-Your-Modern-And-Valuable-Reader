import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft, ChevronRight, Maximize2, Minimize2,
  Bookmark, BookmarkCheck, ZoomIn, ZoomOut, AlertCircle, List, X,
} from 'lucide-react';
import { Theme, Bookmark as BookmarkType, ViewMode, ReaderSettings, TocItem } from '../types';
import { THEMES, AVG_PAGES_PER_MIN } from '../constants';
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

function formatReadingTime(pages: number): string {
  const mins = Math.ceil(pages / AVG_PAGES_PER_MIN);
  if (mins < 60) return `~${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `~${h}h ${m}m` : `~${h}h`;
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
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);

  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scale, setScale] = useState(1.0);
  const [isAutoFit, setIsAutoFit] = useState(true);
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const [scrollPercentage, setScrollPercentage] = useState(0);
  const [pageInput, setPageInput] = useState<string | null>(null);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [showToc, setShowToc] = useState(false);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number } | null>(null);

  const currentTheme = THEMES[theme];
  const quality = Math.max(1, Math.min(4, renderQuality ?? 2));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  useEffect(() => {
    const onResize = () => setIsLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Compute fit-to-width scale ──────────────────────────────────────────────
  const computeFitScale = useCallback(async (pdfDoc: pdfjsLib.PDFDocumentProxy): Promise<number> => {
    if (!viewportRef.current) return 1.0;
    try {
      const page = await pdfDoc.getPage(currentPage || 1);
      const naturalVp = page.getViewport({ scale: 1.0 });

      const containerW = viewportRef.current.clientWidth || window.innerWidth;
      const containerH = viewportRef.current.clientHeight || window.innerHeight;

      // In landscape, we want to fill the width (0 padding)
      // In portrait, we want some breathing room (32px total horizontal padding)
      const horizontalPadding = isLandscape ? 0 : 32;
      const verticalPadding = isLandscape ? 0 : 32;

      const scaleW = (containerW - horizontalPadding) / naturalVp.width;

      if (viewMode === 'page') {
        const scaleH = (containerH - verticalPadding) / naturalVp.height;
        // Fit both width and height to ensure no cropping
        return Math.max(0.2, Math.min(scaleW, scaleH));
      }

      return Math.max(0.2, scaleW);
    } catch {
      return 1.0;
    }
  }, [isLandscape, viewMode, currentPage]);

  // ── Load PDF ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let destroyed = false;
    let objectUrl: string | null = null;

    const load = async () => {
      setLoading(true);
      setLoadError(null);
      setToc([]);

      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        try { await renderTaskRef.current.promise; } catch { /* ignore */ }
        renderTaskRef.current = null;
      }

      // Destroy and clear cache for old PDF
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

        const task = pdfjsLib.getDocument({
          url: src,
          disableAutoFetch: false,
          disableStream: false,
          rangeChunkSize: 65536,
          verbosity: 0,
        });

        const pdfDoc = await task.promise;
        if (destroyed) { pdfDoc.destroy(); return; }

        setPdf(pdfDoc);
        setNumPages(pdfDoc.numPages);

        // Auto-fit scale to container width
        const fit = await computeFitScale(pdfDoc);
        setScale(fit);
        setIsAutoFit(true);

        // Extract table of contents
        try {
          const outline = await pdfDoc.getOutline();
          if (outline && outline.length > 0) {
            const items: TocItem[] = [];
            const processItems = async (nodes: any[], level: number) => {
              for (const node of nodes) {
                try {
                  let page = 1;
                  if (node.dest) {
                    const dest = typeof node.dest === 'string'
                      ? await pdfDoc.getDestination(node.dest)
                      : node.dest;
                    if (dest?.[0]) {
                      const idx = await pdfDoc.getPageIndex(dest[0]);
                      page = idx + 1;
                    }
                  }
                  items.push({ title: String(node.title ?? ''), page, level });
                  if (node.items?.length) await processItems(node.items, level + 1);
                } catch { /* skip malformed outline item */ }
              }
            };
            await processItems(outline, 0);
            if (!destroyed) setToc(items);
          }
        } catch (e) {
          console.warn('[PDFReader] Could not extract table of contents:', e);
        }
      } catch (err: any) {
        if (destroyed) return;
        const name = err?.name ?? 'UnknownError';
        const msg = err?.message ?? String(err);
        console.error(`[PDFReader] Load failed | ${name}: ${msg}`, {
          fileType: typeof file === 'string' ? 'url' : file?.constructor?.name,
          ua: navigator.userAgent.slice(0, 80),
        });

        if (name === 'PasswordException' || err?.code === 1) {
          setLoadError('This PDF is password-protected. Password-protected PDFs are not supported yet.');
        } else if (name === 'InvalidPDFException' || msg.includes('Invalid PDF')) {
          setLoadError(`Corrupted or invalid PDF file. (${name})`);
        } else if (name === 'MissingPDFException' || msg.includes('Missing PDF')) {
          setLoadError('PDF file not found or cannot be accessed. Try re-uploading.');
        } else if (msg.includes('network') || msg.includes('fetch') || name === 'NetworkError') {
          setLoadError(`Network error while loading PDF. Check your connection. (${name})`);
        } else {
          setLoadError(`Failed to load PDF. (${name}: ${msg.slice(0, 80)})`);
        }
      } finally {
        if (!destroyed) setLoading(false);
      }
    };

    load();

    return () => {
      destroyed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (renderTaskRef.current) { renderTaskRef.current.cancel(); renderTaskRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  // ── ResizeObserver: re-compute fit scale on container resize ────────────────
  useEffect(() => {
    if (!pdf || !isAutoFit) return;
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(async () => {
      if (!isAutoFit) return;
      const fit = await computeFitScale(pdf);
      setScale(fit);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [pdf, isAutoFit, isLandscape, computeFitScale]);

  // ── Page-mode canvas render ─────────────────────────────────────────────────
  const renderPage = useCallback(async (pageNum: number) => {
    const canvas = canvasRef.current;
    if (!pdf || !canvas || viewMode !== 'page') return;

    if (isRenderingRef.current && renderTaskRef.current) {
      renderTaskRef.current.cancel();
      try { await renderTaskRef.current.promise; } catch { /* ignore cancel */ }
      renderTaskRef.current = null;
    }
    isRenderingRef.current = true;

    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.0 });
      setPageDimensions({ width: viewport.width, height: viewport.height });

      const scaledViewport = page.getViewport({ scale });
      const maxDim = 10000;
      const multiplier = Math.min(dpr, maxDim / Math.max(scaledViewport.width, scaledViewport.height));
      const rv = page.getViewport({ scale: scale * multiplier });

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) { isRenderingRef.current = false; return; }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      canvas.width = rv.width;
      canvas.height = rv.height;

      const task = page.render({ canvasContext: ctx, viewport: rv } as any);
      renderTaskRef.current = task;
      await task.promise;
      renderTaskRef.current = null;
    } catch (err: any) {
      const name = err?.name ?? 'UnknownError';
      if (name !== 'RenderingCancelledException') {
        console.error(`[PDFReader] Page render error | ${name}: ${err?.message}`, { pageNum, scale, dpr });
      }
      renderTaskRef.current = null;
    } finally {
      isRenderingRef.current = false;
    }
  }, [pdf, scale, viewMode, dpr]);

  // Re-render when page/scale/viewMode changes
  useEffect(() => {
    if (pdf && viewMode === 'page' && canvasRef.current) {
      renderPage(currentPage);
    }
  }, [pdf, currentPage, renderPage, viewMode]);

  const setCanvasRef = useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node;
    if (node && pdf && viewMode === 'page') renderPage(currentPage);
  }, [pdf, currentPage, viewMode, renderPage]);

  // ── Fullscreen ──────────────────────────────────────────────────────────────
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

  // ── CSS-only sharpness filter (no render cost) ──────────────────────────────
  const getPdfFilter = useCallback(() => {
    const sharpC = quality >= 4 ? 110 : quality >= 3 ? 107 : quality >= 2 ? 104 : 100;
    const sharpS = quality >= 4 ? 108 : quality >= 3 ? 105 : quality >= 2 ? 103 : 100;
    let f = `brightness(${brightness}%) contrast(${sharpC}%) saturate(${sharpS}%)`;
    if (theme === 'dark' || theme === 'midnight' || theme === 'nord') f += ' invert(90%) hue-rotate(180deg)';
    else if (theme === 'sepia') f += ' sepia(40%)';
    return f;
  }, [brightness, theme, quality]);

  // ── Scroll percentage ───────────────────────────────────────────────────────
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

  // ── Page tracking in continuous mode ───────────────────────────────────────
  useEffect(() => {
    if (viewMode !== 'continuous' || !viewportRef.current || !pdf) return;
    const onScroll = () => {
      if (pageChangeDebounceRef.current) clearTimeout(pageChangeDebounceRef.current);
      pageChangeDebounceRef.current = setTimeout(() => {
        const vp = viewportRef.current;
        if (!vp) return;
        const center = vp.scrollTop + vp.clientHeight / 2;
        let closest = 1, minDist = Infinity;
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
    return () => { vp.removeEventListener('scroll', onScroll); if (pageChangeDebounceRef.current) clearTimeout(pageChangeDebounceRef.current); };
  }, [viewMode, pdf, numPages, currentPage, onPageChange]);

  // ── User interaction / auto-scroll ─────────────────────────────────────────
  const handleInteraction = useCallback(() => {
    if (!isAutoScrolling) return;
    setIsUserInteracting(true);
    if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
    interactionTimeoutRef.current = setTimeout(() => setIsUserInteracting(false), 2000);
  }, [isAutoScrolling]);

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
            onPageChange(currentPage + 1); vp.scrollTop = 0;
          }
        }
      }
      rafRef.current = requestAnimationFrame(scroll);
    };
    rafRef.current = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isAutoScrolling, autoScrollSpeed, currentPage, numPages, onPageChange, viewMode, isUserInteracting]);

  // ── Navigation ──────────────────────────────────────────────────────────────
  const navigate = useCallback((page: number) => {
    const clamped = Math.max(1, Math.min(numPages, page));
    if (viewMode === 'continuous') {
      const el = document.getElementById(`pdf-page-${clamped}`);
      if (el && viewportRef.current) viewportRef.current.scrollTo({ top: el.offsetTop, behavior: 'smooth' });
    } else {
      onPageChange(clamped);
      if (viewportRef.current) viewportRef.current.scrollTop = 0;
    }
  }, [numPages, viewMode, onPageChange]);

  // ── Keyboard navigation ─────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') navigate(currentPage + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') navigate(currentPage - 1);
      else if (e.key === 'f' || e.key === 'F') toggleFullscreen();
      else if (e.key === 'Escape') setShowToc(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentPage, navigate, toggleFullscreen]);

  // ── Swipe gestures (mobile page navigation) ─────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    handleInteraction();
  }, [handleInteraction]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (viewMode !== 'page') return;
    const dx = touchStartXRef.current - e.changedTouches[0].clientX;
    const dy = Math.abs(touchStartYRef.current - e.changedTouches[0].clientY);
    // Only register horizontal swipe if it's clearly horizontal (not a scroll)
    if (Math.abs(dx) > 60 && Math.abs(dx) > dy * 1.5) {
      if (dx > 0) navigate(currentPage + 1);
      else navigate(currentPage - 1);
    }
  }, [viewMode, currentPage, navigate]);

  // ── Zoom controls ───────────────────────────────────────────────────────────
  const zoomIn = () => { setIsAutoFit(false); setScale(s => Math.min(5, parseFloat((s + 0.25).toFixed(2)))); };
  const zoomOut = () => { setIsAutoFit(false); setScale(s => Math.max(0.3, parseFloat((s - 0.25).toFixed(2)))); };
  const resetFit = async () => {
    if (!pdf) return;
    const fit = await computeFitScale(pdf);
    setScale(fit);
    setIsAutoFit(true);
  };

  const isBookmarked = bookmarks.some(b => b.pageNumber === currentPage);
  const progress = numPages > 0 ? Math.round((currentPage / numPages) * 100) : 0;
  const pagesLeft = numPages - currentPage;

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
      {/* ── Loading ── */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 gap-4" style={{ background: currentTheme.bg }}>
          <div className="rounded-full animate-spin" style={{
            width: 44, height: 44,
            border: `3px solid ${currentTheme.accent}30`,
            borderTopColor: currentTheme.accent,
          }} />
          <p className="text-sm opacity-40" style={{ color: currentTheme.text }}>Loading PDF…</p>
        </div>
      )}

      {/* ── Error ── */}
      {loadError && !loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 gap-4 p-8 text-center" style={{ background: currentTheme.bg }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
            <AlertCircle size={32} className="text-red-500" />
          </div>
          <div>
            <p className="font-bold text-lg mb-2" style={{ color: currentTheme.text }}>Unable to Open PDF</p>
            <p className="text-sm opacity-60 max-w-xs font-mono leading-relaxed" style={{ color: currentTheme.text }}>{loadError}</p>
          </div>
        </div>
      )}

      {!loading && !loadError && pdf && (
        <>
          {/* Progress bar */}
          <div className="absolute top-0 left-0 right-0 h-0.5 z-30" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div className="h-full transition-all duration-300" style={{ width: `${progress}%`, background: currentTheme.accent }} />
          </div>

          {/* Top HUD (tap/hover to reveal) */}
          <motion.div
            initial={{ opacity: 0 }}
            whileHover={{ opacity: 1 }}
            className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 100%)' }}
          >
            {/* Page input */}
            <div className="pointer-events-auto">
              {pageInput !== null ? (
                <input
                  type="number" min={1} max={numPages} value={pageInput} autoFocus
                  className="w-20 text-center text-sm font-mono text-white bg-black/40 border border-white/20 rounded-lg px-2 py-1 focus:outline-none"
                  onChange={e => setPageInput(e.target.value)}
                  onBlur={() => { const p = parseInt(pageInput); if (!isNaN(p)) navigate(p); setPageInput(null); }}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setPageInput(null); }}
                />
              ) : (
                <button onClick={() => setPageInput(String(currentPage))}
                  className="text-sm font-medium text-white/80 hover:text-white transition-colors font-mono leading-none">
                  <span>{currentPage}</span>
                  <span className="opacity-40"> / {numPages}</span>
                </button>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1.5 pointer-events-auto">
              {/* Zoom */}
              <div className="flex items-center bg-black/25 backdrop-blur-md rounded-full px-2 border border-white/10">
                <button onClick={zoomOut} className="p-2 text-white/80 hover:text-white transition-colors"><ZoomOut size={15} /></button>
                <button
                  onClick={resetFit}
                  className={cn('text-[11px] font-mono w-12 text-center transition-colors', isAutoFit ? 'text-white/40 hover:text-white/70' : 'text-white/80 hover:text-white')}
                  title={isAutoFit ? 'Auto-fit' : 'Tap to fit'}
                >
                  {isAutoFit ? 'fit' : `${Math.round(scale * 100)}%`}
                </button>
                <button onClick={zoomIn} className="p-2 text-white/80 hover:text-white transition-colors"><ZoomIn size={15} /></button>
              </div>

              {/* TOC button (only if outline exists) */}
              {toc.length > 0 && (
                <button onClick={() => setShowToc(t => !t)}
                  className={cn('p-2 rounded-full transition-all', showToc ? 'bg-white/20 text-white' : 'bg-black/20 text-white/70 hover:text-white')}>
                  <List size={17} />
                </button>
              )}

              {/* Bookmark */}
              <button onClick={() => onToggleBookmark(currentPage)}
                className="p-2 rounded-full transition-all"
                style={{ color: isBookmarked ? '#F59E0B' : 'rgba(255,255,255,0.7)', background: isBookmarked ? 'rgba(245,158,11,0.15)' : 'rgba(0,0,0,0.2)' }}>
                {isBookmarked ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
              </button>

              {/* Fullscreen */}
              <button onClick={toggleFullscreen}
                className="p-2 rounded-full bg-black/20 text-white/70 hover:text-white transition-all">
                {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
              </button>
            </div>
          </motion.div>

          {/* ── Reader viewport ── */}
          <div
            ref={viewportRef}
            className="flex-1 w-full overflow-y-auto custom-scrollbar"
            style={{ scrollBehavior: isAutoScrolling ? 'auto' : 'smooth', overscrollBehavior: 'contain' }}
            onMouseDown={handleInteraction}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleInteraction}
            onWheel={handleInteraction}
          >
            {viewMode === 'continuous' ? (
              <div className="flex flex-col items-center py-4">
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
              // ── Single page mode — persistent canvas, no key remounting ──
              <div className={cn(
                'flex justify-center items-center min-h-full w-full',
                isLandscape ? 'p-0' : 'p-4'
              )}>
                <div
                  className="rounded-sm overflow-hidden bg-white relative transition-all duration-300"
                  style={{
                    filter: getPdfFilter(),
                    boxShadow: theme === 'sepia'
                      ? '0 20px 48px -10px rgba(91,70,54,0.3)'
                      : '0 20px 56px -12px rgba(0,0,0,0.55)',
                    width: '100%',
                    maxWidth: pageDimensions ? `${pageDimensions.width * scale}px` : 'none',
                    aspectRatio: pageDimensions ? `${pageDimensions.width} / ${pageDimensions.height}` : 'auto',
                  }}
                >
                  <canvas ref={setCanvasRef} className="block w-full h-full" />
                </div>
              </div>
            )}
          </div>

          {/* ── Bottom navigation ── */}
          <div className="absolute bottom-5 left-0 right-0 flex justify-center items-center gap-4 z-10 pointer-events-none">
            <button
              disabled={currentPage <= 1}
              onClick={() => navigate(currentPage - 1)}
              className="p-3.5 rounded-full backdrop-blur-md text-white transition-all pointer-events-auto disabled:opacity-25 active:scale-90"
              style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <ChevronLeft size={22} />
            </button>

            <div
              className="flex flex-col items-center px-4 py-2 rounded-2xl backdrop-blur-md text-white pointer-events-auto cursor-pointer"
              style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.12)' }}
              onClick={() => setPageInput(String(currentPage))}
            >
              <span className="font-mono text-xs font-medium">
                {viewMode === 'continuous' ? `${scrollPercentage}%` : `${progress}%`}
              </span>
              {pagesLeft > 2 && (
                <span className="text-[9px] opacity-40 leading-none mt-0.5">{formatReadingTime(pagesLeft)} left</span>
              )}
            </div>

            <button
              disabled={currentPage >= numPages}
              onClick={() => navigate(currentPage + 1)}
              className="p-3.5 rounded-full backdrop-blur-md text-white transition-all pointer-events-auto disabled:opacity-25 active:scale-90"
              style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <ChevronRight size={22} />
            </button>
          </div>

          {/* ── Table of Contents drawer ── */}
          <AnimatePresence>
            {showToc && (
              <>
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 z-30"
                  style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
                  onClick={() => setShowToc(false)}
                />
                <motion.div
                  initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
                  className="absolute bottom-0 left-0 right-0 z-40 rounded-t-3xl overflow-hidden"
                  style={{ backgroundColor: currentTheme.bg, maxHeight: '72vh' }}
                >
                  {/* Handle */}
                  <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 rounded-full opacity-20" style={{ background: currentTheme.text }} />
                  </div>
                  {/* Header */}
                  <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: `${currentTheme.text}10` }}>
                    <div>
                      <h3 className="font-bold text-base" style={{ color: currentTheme.text }}>Table of Contents</h3>
                      <p className="text-[10px] opacity-40 mt-0.5" style={{ color: currentTheme.text }}>{toc.length} sections</p>
                    </div>
                    <button onClick={() => setShowToc(false)} className="p-2 rounded-full opacity-50 hover:opacity-100 transition-opacity" style={{ color: currentTheme.text }}>
                      <X size={18} />
                    </button>
                  </div>
                  {/* Items */}
                  <div className="overflow-y-auto custom-scrollbar" style={{ maxHeight: 'calc(72vh - 88px)' }}>
                    {toc.map((item, i) => (
                      <button
                        key={i}
                        onClick={() => { navigate(item.page); setShowToc(false); }}
                        className={cn(
                          'w-full text-left px-5 py-3 transition-all hover:opacity-80 active:opacity-60 flex items-center justify-between gap-3',
                          item.page === currentPage && 'font-bold',
                        )}
                        style={{
                          paddingLeft: `${20 + item.level * 16}px`,
                          color: item.page === currentPage ? currentTheme.accent : currentTheme.text,
                          background: item.page === currentPage ? `${currentTheme.accent}10` : 'transparent',
                          opacity: 0.9 - item.level * 0.15,
                        }}
                      >
                        <span className={cn('text-sm leading-snug flex-1 truncate', item.level > 0 && 'text-xs')}>{item.title || '(Untitled)'}</span>
                        <span className="text-[10px] font-mono opacity-40 shrink-0">{item.page}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
};
