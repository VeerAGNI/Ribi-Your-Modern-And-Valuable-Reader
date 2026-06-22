import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft, ChevronRight, Maximize2, Minimize2,
  Bookmark, BookmarkCheck, ZoomIn, ZoomOut, AlertCircle, List, X, Volume2, VolumeX,
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
  // Refs so callbacks don't need currentPage in their deps
  const currentPageRef = useRef(currentPage);
  const viewModeRef = useRef(viewMode);
  // Track if an orientation change just happened (suppress page tracking)
  const orientationChangingRef = useRef(false);
  const isLandscapeRef = useRef(window.innerWidth > window.innerHeight);

  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scale, setScale] = useState(1.0);
  const [isAutoFit, setIsAutoFit] = useState(true);
  const [isLandscape, setIsLandscape] = useState(isLandscapeRef.current);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const [scrollPercentage, setScrollPercentage] = useState(0);
  const [pageInput, setPageInput] = useState<string | null>(null);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [showToc, setShowToc] = useState(false);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isReadingAloud, setIsReadingAloud] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const currentTheme = THEMES[theme];
  const quality = Math.max(1, Math.min(4, renderQuality ?? 2));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  // Keep refs in sync
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);
  useEffect(() => { viewModeRef.current = viewMode; }, [viewMode]);

  // ── Orientation / resize ─────────────────────────────────────────────────────
  useEffect(() => {
    const onResize = () => {
      const newLandscape = window.innerWidth > window.innerHeight;
      if (newLandscape !== isLandscapeRef.current) {
        isLandscapeRef.current = newLandscape;
        setIsLandscape(newLandscape);

        // Suppress scroll-based page detection during orientation reflow
        orientationChangingRef.current = true;

        // Re-anchor scroll position in continuous mode after reflow
        setTimeout(() => {
          if (viewModeRef.current === 'continuous') {
            const el = document.getElementById(`pdf-page-${currentPageRef.current}`);
            if (el && viewportRef.current) {
              viewportRef.current.scrollTo({ top: el.offsetTop, behavior: 'instant' as ScrollBehavior });
            }
          }
          orientationChangingRef.current = false;
        }, 320);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []); // stable — uses only refs

  // ── Compute fit-to-width scale ────────────────────────────────────────────────
  // Uses page 1 for size (most PDFs have uniform page sizes, avoids async cascade
  // that previously caused "rumble" on orientation change when currentPage was a dep)
  const computeFitScale = useCallback(async (pdfDoc: pdfjsLib.PDFDocumentProxy): Promise<number> => {
    if (!viewportRef.current) return 1.0;
    try {
      const page = await pdfDoc.getPage(1); // always page 1 — uniform across PDF
      const naturalVp = page.getViewport({ scale: 1.0 });

      const containerW = viewportRef.current.clientWidth || window.innerWidth;
      const containerH = viewportRef.current.clientHeight || window.innerHeight;

      const horizontalPadding = isLandscape ? 0 : 32;
      const verticalPadding   = isLandscape ? 0 : 32;

      const scaleW = (containerW - horizontalPadding) / naturalVp.width;

      if (viewMode === 'page') {
        const scaleH = (containerH - verticalPadding) / naturalVp.height;
        return Math.max(0.2, Math.min(scaleW, scaleH));
      }

      return Math.max(0.2, scaleW);
    } catch {
      return 1.0;
    }
  }, [isLandscape, viewMode]); // ← currentPage intentionally removed

  // ── Load PDF ──────────────────────────────────────────────────────────────────
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

        const fit = await computeFitScale(pdfDoc);
        setScale(fit);
        setIsAutoFit(true);

        // Extract TOC
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
                } catch { /* skip malformed */ }
              }
            };
            await processItems(outline, 0);
            if (!destroyed) setToc(items);
          }
        } catch (e) {
          console.warn('[PDFReader] Could not extract TOC:', e);
        }
      } catch (err: any) {
        if (destroyed) return;
        const name = err?.name ?? 'UnknownError';
        const msg  = err?.message ?? String(err);
        console.error(`[PDFReader] Load failed | ${name}: ${msg}`);

        if (name === 'PasswordException' || err?.code === 1) {
          setLoadError('This PDF is password-protected. Password-protected PDFs are not supported yet.');
        } else if (name === 'InvalidPDFException' || msg.includes('Invalid PDF')) {
          setLoadError(`Corrupted or invalid PDF file. (${name})`);
        } else if (name === 'MissingPDFException' || msg.includes('Missing PDF')) {
          setLoadError('PDF file not found. Try re-uploading.');
        } else if (msg.includes('network') || msg.includes('fetch') || name === 'NetworkError') {
          setLoadError(`Network error while loading PDF. (${name})`);
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

  // ── Restore page position when PDF loads (fixes "last page not restored" bug) ─
  useEffect(() => {
    if (!pdf) return;
    if (viewMode === 'continuous') {
      // In continuous mode, scroll to the saved page after pages render
      const savedPage = currentPageRef.current;
      setTimeout(() => {
        const el = document.getElementById(`pdf-page-${savedPage}`);
        if (el && viewportRef.current) {
          viewportRef.current.scrollTo({ top: el.offsetTop, behavior: 'instant' as ScrollBehavior });
        }
      }, 150);
    }
    // In page mode, renderPage(currentPage) handles it via the [pdf, currentPage, renderPage, viewMode] effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf]);

  // ── ResizeObserver: re-compute fit scale on container resize (debounced) ──────
  useEffect(() => {
    if (!pdf || !isAutoFit) return;
    const el = viewportRef.current;
    if (!el) return;

    let debounceTimer: ReturnType<typeof setTimeout>;

    const ro = new ResizeObserver(() => {
      if (!isAutoFit) return;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const fit = await computeFitScale(pdf);
        setScale(fit);
      }, 120); // debounce prevents rapid scale flicker on orientation change
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      clearTimeout(debounceTimer);
    };
  }, [pdf, isAutoFit, computeFitScale]);

  // ── Page-mode canvas render ───────────────────────────────────────────────────
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
      const qualityMult = quality >= 4 ? 2.0 : quality >= 3 ? 1.5 : quality >= 2 ? 1.0 : 0.75;
      const multiplier = Math.min(dpr * qualityMult, maxDim / Math.max(scaledViewport.width, scaledViewport.height));
      const rv = page.getViewport({ scale: scale * multiplier });

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) { isRenderingRef.current = false; return; }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      canvas.width  = rv.width;
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

  useEffect(() => {
    if (pdf && viewMode === 'page' && canvasRef.current) {
      renderPage(currentPage);
    }
  }, [pdf, currentPage, renderPage, viewMode]);

  const setCanvasRef = useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node;
    if (node && pdf && viewMode === 'page') renderPage(currentPage);
  }, [pdf, currentPage, viewMode, renderPage]);

  // ── Fullscreen ────────────────────────────────────────────────────────────────
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

  // ── Read Aloud ────────────────────────────────────────────────────────────────
  const stopReadAloud = useCallback(() => {
    window.speechSynthesis?.cancel();
    utteranceRef.current = null;
    setIsReadingAloud(false);
  }, []);

  const startReadAloud = useCallback(async (pageNum: number) => {
    if (!pdf) return;
    window.speechSynthesis?.cancel();
    setIsReadingAloud(true);
    try {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map((item: any) => item.str ?? '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (!text) { setIsReadingAloud(false); return; }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1;
      utterance.lang = 'en-US';
      utterance.onend = () => { utteranceRef.current = null; setIsReadingAloud(false); };
      utterance.onerror = () => { utteranceRef.current = null; setIsReadingAloud(false); };
      utteranceRef.current = utterance;
      window.speechSynthesis?.speak(utterance);
    } catch {
      setIsReadingAloud(false);
    }
  }, [pdf]);

  const toggleReadAloud = useCallback(() => {
    if (isReadingAloud) {
      stopReadAloud();
    } else {
      startReadAloud(currentPage);
    }
  }, [isReadingAloud, stopReadAloud, startReadAloud, currentPage]);

  // Stop read aloud when page changes
  useEffect(() => {
    if (isReadingAloud) stopReadAloud();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  // Cleanup on unmount
  useEffect(() => () => { window.speechSynthesis?.cancel(); }, []);

  // ── PDF colour / invert filter (page mode canvas) ────────────────────────────
  const getPdfFilter = useCallback(() => {
    if (theme === 'dark' || theme === 'midnight') return 'invert(1)';
    if (theme === 'nord') return 'invert(1) sepia(20%) hue-rotate(185deg)';
    if (theme === 'sepia') return 'sepia(40%)';
    return 'none';
  }, [theme]);

  // ── Scroll percentage ─────────────────────────────────────────────────────────
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

  // ── Page tracking in continuous mode ─────────────────────────────────────────
  useEffect(() => {
    if (viewMode !== 'continuous' || !viewportRef.current || !pdf) return;
    const onScroll = () => {
      if (orientationChangingRef.current) return; // skip during orientation reflow
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
        if (closest !== currentPageRef.current) onPageChange(closest);
      }, 150);
    };
    const vp = viewportRef.current;
    vp.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      vp.removeEventListener('scroll', onScroll);
      if (pageChangeDebounceRef.current) clearTimeout(pageChangeDebounceRef.current);
    };
  }, [viewMode, pdf, numPages, onPageChange]); // currentPage removed — using ref

  // ── User interaction / auto-scroll ───────────────────────────────────────────
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
          if (scrollTop + clientHeight >= scrollHeight - 2 && currentPageRef.current < numPages) {
            onPageChange(currentPageRef.current + 1);
            vp.scrollTop = 0;
          }
        }
      }
      rafRef.current = requestAnimationFrame(scroll);
    };
    rafRef.current = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isAutoScrolling, autoScrollSpeed, numPages, onPageChange, viewMode, isUserInteracting]);

  // ── Navigation ────────────────────────────────────────────────────────────────
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

  // ── Keyboard navigation ───────────────────────────────────────────────────────
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

  // ── Swipe gestures ────────────────────────────────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    handleInteraction();
  }, [handleInteraction]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (viewMode !== 'page') return;
    const dx = touchStartXRef.current - e.changedTouches[0].clientX;
    const dy = Math.abs(touchStartYRef.current - e.changedTouches[0].clientY);
    if (Math.abs(dx) > 60 && Math.abs(dx) > dy * 1.5) {
      if (dx > 0) navigate(currentPage + 1);
      else navigate(currentPage - 1);
    }
  }, [viewMode, currentPage, navigate]);

  // ── Zoom ─────────────────────────────────────────────────────────────────────
  const zoomIn  = () => { setIsAutoFit(false); setScale(s => Math.min(5, parseFloat((s + 0.25).toFixed(2)))); };
  const zoomOut = () => { setIsAutoFit(false); setScale(s => Math.max(0.3, parseFloat((s - 0.25).toFixed(2)))); };
  const resetFit = async () => {
    if (!pdf) return;
    const fit = await computeFitScale(pdf);
    setScale(fit);
    setIsAutoFit(true);
  };

  const isBookmarked = bookmarks.some(b => b.pageNumber === currentPage);

  // ── Fixed progress calculation ────────────────────────────────────────────────
  // Page 1 = 0%, last page = 100% (was previously 1%–100%, now 0%–100%)
  const progress  = numPages > 1
    ? Math.round(((currentPage - 1) / (numPages - 1)) * 100)
    : numPages === 1 ? 100 : 0;
  const pagesLeft = numPages - currentPage;

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex flex-col w-full h-full overflow-hidden transition-colors duration-500',
        theme === 'sepia'    && 'sepia-texture',
        (theme === 'dark' || theme === 'nord') && 'dark-texture',
        theme === 'midnight' && 'midnight-texture',
        'paper-texture'
      )}
      style={{ backgroundColor: currentTheme.bg }}
    >
      {/* ── Loading ── */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 gap-5" style={{ background: currentTheme.bg }}>
          <div
            className="w-12 h-12 rounded-full"
            style={{
              border: `2px solid ${currentTheme.accent}20`,
              borderTopColor: currentTheme.accent,
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <p className="text-sm" style={{ color: currentTheme.text, opacity: 0.4 }}>Loading PDF…</p>
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
          {/* Thin progress bar */}
          <div className="absolute top-0 left-0 right-0 h-0.5 z-30 overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div
              className="h-full transition-all duration-500 relative progress-shimmer"
              style={{ width: `${progress}%`, background: currentTheme.accent }}
            />
          </div>

          {/* ── Top HUD ── */}
          <motion.div
            initial={{ opacity: 0 }}
            whileHover={{ opacity: 1 }}
            className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.40) 0%, transparent 100%)' }}
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
                <button
                  onClick={() => setPageInput(String(currentPage))}
                  className="text-sm font-medium text-white/80 hover:text-white transition-colors font-mono leading-none"
                >
                  <span>{currentPage}</span>
                  <span className="opacity-40"> / {numPages}</span>
                </button>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1.5 pointer-events-auto">
              {/* Zoom */}
              <div className="flex items-center glass rounded-full px-2 border border-white/10" style={{ background: 'rgba(0,0,0,0.28)' }}>
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

              {toc.length > 0 && (
                <button
                  onClick={() => setShowToc(t => !t)}
                  className={cn('p-2 rounded-full transition-all glass', showToc ? 'text-white' : 'text-white/70 hover:text-white')}
                  style={{ background: showToc ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)' }}
                >
                  <List size={17} />
                </button>
              )}

              <button
                onClick={() => onToggleBookmark(currentPage)}
                className="p-2 rounded-full transition-all glass"
                style={{
                  color: isBookmarked ? '#F59E0B' : 'rgba(255,255,255,0.7)',
                  background: isBookmarked ? 'rgba(245,158,11,0.18)' : 'rgba(0,0,0,0.25)',
                  border: `1px solid ${isBookmarked ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.12)'}`,
                }}
              >
                {isBookmarked ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
              </button>

              <button
                onClick={toggleReadAloud}
                className={cn('p-2 rounded-full glass transition-all', isReadingAloud ? 'text-white' : 'text-white/70 hover:text-white')}
                style={{
                  background: isReadingAloud ? 'rgba(139,92,246,0.35)' : 'rgba(0,0,0,0.25)',
                  border: `1px solid ${isReadingAloud ? 'rgba(139,92,246,0.6)' : 'rgba(255,255,255,0.12)'}`,
                  boxShadow: isReadingAloud ? '0 0 12px rgba(139,92,246,0.4)' : undefined,
                }}
                title={isReadingAloud ? 'Stop reading' : 'Read aloud'}
              >
                {isReadingAloud ? <VolumeX size={17} /> : <Volume2 size={17} />}
              </button>

              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-full glass text-white/70 hover:text-white transition-all"
                style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)' }}
              >
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
                {Array.from({ length: numPages }, (_, i) => {
                  const pageNum = i + 1;
                  const inWindow = Math.abs(pageNum - currentPage) <= 6;
                  return (
                    <div key={pageNum} id={`pdf-page-${pageNum}`} className="w-full">
                      {inWindow ? (
                        <PDFPage
                          pdf={pdf}
                          pageNumber={pageNum}
                          scale={scale}
                          brightness={brightness}
                          contrast={100}
                          theme={theme}
                          isLandscape={isLandscape}
                          renderQuality={quality}
                          onVisible={() => {}}
                        />
                      ) : (
                        <div className={isLandscape ? 'py-1 px-0' : 'py-3 px-3'}>
                          <div style={{
                            width: '100%',
                            aspectRatio: pageDimensions
                              ? `${pageDimensions.width} / ${pageDimensions.height}`
                              : '3 / 4',
                            borderRadius: 2,
                            background: (theme === 'dark' || theme === 'midnight')
                              ? '#0a0a0a'
                              : theme === 'nord'
                              ? '#282C36'
                              : '#f0f0f0',
                          }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={cn(
                'flex justify-center items-center min-h-full w-full',
                isLandscape ? 'p-0' : 'p-4'
              )}>
                <div
                  className="rounded-sm overflow-hidden relative transition-all duration-300"
                  style={{
                    filter: getPdfFilter(),
                    boxShadow: theme === 'sepia'
                      ? '0 20px 48px -10px rgba(91,70,54,0.3)'
                      : '0 20px 56px -12px rgba(0,0,0,0.55)',
                    width: '100%',
                    maxWidth: pageDimensions ? `${pageDimensions.width * scale}px` : 'none',
                    aspectRatio: pageDimensions ? `${pageDimensions.width} / ${pageDimensions.height}` : 'auto',
                    backgroundColor: (theme === 'dark' || theme === 'midnight' || theme === 'nord') ? '#000' : '#fff',
                  }}
                >
                  <canvas ref={setCanvasRef} className="block w-full h-full" />
                  {brightness < 100 && (
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{ background: `rgba(0,0,0,${((100 - brightness) / 100 * 0.88).toFixed(3)})`, zIndex: 2 }}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Bottom navigation — glassmorphic pill ── */}
          <div className="absolute bottom-5 left-0 right-0 flex justify-center items-center gap-3 z-10 pointer-events-none">
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.9 }}
              disabled={currentPage <= 1}
              onClick={() => navigate(currentPage - 1)}
              className="p-3.5 rounded-full glass text-white transition-all pointer-events-auto disabled:opacity-20 active:scale-90"
              style={{
                background: 'rgba(0,0,0,0.38)',
                border: '1px solid rgba(255,255,255,0.14)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
              }}
            >
              <ChevronLeft size={22} />
            </motion.button>

            {/* Center info pill */}
            <motion.div
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-3 px-5 py-2.5 rounded-2xl glass text-white pointer-events-auto cursor-pointer"
              style={{
                background: 'rgba(0,0,0,0.42)',
                border: '1px solid rgba(255,255,255,0.13)',
                boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${currentTheme.accent}18`,
              }}
              onClick={() => setPageInput(String(currentPage))}
            >
              {/* Page dots — visual progress */}
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: currentTheme.accent, boxShadow: `0 0 6px ${currentTheme.accent}` }} />
                <span className="text-[10px] font-mono text-white/50">{currentPage}/{numPages}</span>
              </div>

              <div className="w-px h-4 bg-white/10" />

              {/* Progress & time */}
              <div className="flex flex-col items-center">
                <span className="font-mono text-xs font-semibold leading-none" style={{ color: currentTheme.accent }}>
                  {viewMode === 'continuous' ? `${scrollPercentage}%` : `${progress}%`}
                </span>
                {pagesLeft > 2 && (
                  <span className="text-[9px] text-white/35 leading-none mt-0.5">{formatReadingTime(pagesLeft)} left</span>
                )}
              </div>
            </motion.div>

            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.9 }}
              disabled={currentPage >= numPages}
              onClick={() => navigate(currentPage + 1)}
              className="p-3.5 rounded-full glass text-white transition-all pointer-events-auto disabled:opacity-20 active:scale-90"
              style={{
                background: 'rgba(0,0,0,0.38)',
                border: '1px solid rgba(255,255,255,0.14)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
              }}
            >
              <ChevronRight size={22} />
            </motion.button>
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
                  className="absolute bottom-0 left-0 right-0 z-40 rounded-t-3xl overflow-hidden glass"
                  style={{
                    backgroundColor: currentTheme.bg,
                    maxHeight: '72vh',
                    borderTop: `1px solid ${currentTheme.text}12`,
                    boxShadow: '0 -8px 40px rgba(0,0,0,0.3)',
                  }}
                >
                  <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 rounded-full opacity-20" style={{ background: currentTheme.text }} />
                  </div>
                  <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: `${currentTheme.text}10` }}>
                    <div>
                      <h3 className="font-bold text-base" style={{ color: currentTheme.text }}>Table of Contents</h3>
                      <p className="text-[10px] opacity-40 mt-0.5" style={{ color: currentTheme.text }}>{toc.length} sections</p>
                    </div>
                    <button onClick={() => setShowToc(false)} className="p-2 rounded-full opacity-50 hover:opacity-100 transition-opacity" style={{ color: currentTheme.text }}>
                      <X size={18} />
                    </button>
                  </div>
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
                          background: item.page === currentPage ? `${currentTheme.accent}12` : 'transparent',
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
