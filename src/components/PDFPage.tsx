import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// LRU page cache — keep small to prevent OOM on mobile
const PAGE_CACHE_MAX = 6;
const pageCache = new Map<string, HTMLCanvasElement>();

function evictCacheIfNeeded() {
  while (pageCache.size > PAGE_CACHE_MAX) {
    const firstKey = pageCache.keys().next().value;
    if (firstKey) pageCache.delete(firstKey);
    else break;
  }
}

export function clearPageCacheByFingerprint(fingerprint: string) {
  for (const key of Array.from(pageCache.keys())) {
    if (key.startsWith(fingerprint)) pageCache.delete(key);
  }
}

// Global render semaphore — max 3 concurrent page renders to prevent OOM
let activeSemaphoreCount = 0;
const MAX_CONCURRENT_RENDERS = 3;
const semaphoreQueue: Array<() => void> = [];

function acquireSemaphore(): Promise<void> {
  if (activeSemaphoreCount < MAX_CONCURRENT_RENDERS) {
    activeSemaphoreCount++;
    return Promise.resolve();
  }
  return new Promise(resolve => semaphoreQueue.push(resolve));
}

function releaseSemaphore() {
  activeSemaphoreCount = Math.max(0, activeSemaphoreCount - 1);
  const next = semaphoreQueue.shift();
  if (next) {
    activeSemaphoreCount++;
    next();
  }
}

interface PDFPageProps {
  pdf: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  brightness: number;
  contrast: number;
  theme: string;
  isLandscape: boolean;
  renderQuality: number;
  onVisible: (pageNumber: number) => void;
}

export const PDFPage = React.memo(({
  pdf,
  pageNumber,
  scale,
  brightness,
  contrast,
  theme,
  isLandscape,
  renderQuality,
  onVisible,
}: PDFPageProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const [isRendered, setIsRendered] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [renderError, setRenderError] = useState(false);
  const isMounted = useRef(true);

  // Cap quality: continuous mode is heavier, so cap at 2x to prevent OOM
  const quality = Math.max(1, Math.min(2, renderQuality || 1.5));
  const cacheKey = useMemo(
    () => `${(pdf as any).fingerprints?.[0] || 'pdf'}-${pageNumber}-${scale.toFixed(2)}-${quality}`,
    [pdf, pageNumber, scale, quality]
  );

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      // Cancel any in-flight render task on unmount
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, []);

  // IntersectionObserver — render only when near viewport (tight margin to save memory)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!isMounted.current) return;
        const visible = entry.isIntersecting;
        setIsInView(visible);
        if (visible) onVisible(pageNumber);
      },
      { threshold: 0, rootMargin: '600px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [pageNumber, onVisible]);

  // Trigger render when in view — only pre-render first 3 pages to avoid burst OOM
  const [shouldRender, setShouldRender] = useState(false);
  useEffect(() => {
    if (isInView) {
      setShouldRender(true);
    } else if (!isRendered && pageNumber <= 3) {
      const t = setTimeout(() => {
        if (isMounted.current) setShouldRender(true);
      }, (pageNumber - 1) * 200);
      return () => clearTimeout(t);
    }
  }, [isInView, isRendered, pageNumber]);

  const renderPage = useCallback(async () => {
    if (!canvasContainerRef.current || !pdf || !shouldRender || !isMounted.current) return;
    if (isRendered) return;

    // Check cache first — fast path
    const cached = pageCache.get(cacheKey);
    if (cached) {
      if (canvasContainerRef.current && isMounted.current) {
        canvasContainerRef.current.innerHTML = '';
        canvasContainerRef.current.appendChild(cached.cloneNode(true) as HTMLCanvasElement);
        setIsRendered(true);
      }
      return;
    }

    // Cancel any in-flight render for this page
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      try { await renderTaskRef.current.promise; } catch { /* ignored */ }
      renderTaskRef.current = null;
    }

    // Acquire semaphore slot — wait if too many renders active
    await acquireSemaphore();
    if (!isMounted.current) { releaseSemaphore(); return; }

    try {
      const page = await pdf.getPage(pageNumber);
      if (!isMounted.current) { releaseSemaphore(); return; }

      const viewport = page.getViewport({ scale });
      const pixelRatio = window.devicePixelRatio || 1;

      // Clamp canvas size — never exceed 8000px to stay within mobile GPU limits
      const maxDim = 8000;
      const baseMultiplier = pixelRatio * quality;
      const clampedMultiplier = Math.min(
        baseMultiplier,
        maxDim / Math.max(viewport.width, viewport.height)
      );

      const renderViewport = page.getViewport({ scale: scale * clampedMultiplier });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
      if (!ctx || !isMounted.current) { releaseSemaphore(); return; }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      canvas.width = renderViewport.width;
      canvas.height = renderViewport.height;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      canvas.className = 'max-w-full h-auto block';

      const renderTask = page.render({ canvasContext: ctx, viewport: renderViewport } as any);
      renderTaskRef.current = renderTask;

      await renderTask.promise;
      renderTaskRef.current = null;

      if (!isMounted.current) { releaseSemaphore(); return; }

      // Store in LRU cache and display
      evictCacheIfNeeded();
      pageCache.set(cacheKey, canvas);

      if (canvasContainerRef.current) {
        canvasContainerRef.current.innerHTML = '';
        canvasContainerRef.current.appendChild(canvas.cloneNode(true) as HTMLCanvasElement);
      }
      setIsRendered(true);
      setRenderError(false);
    } catch (err: any) {
      if (err?.name === 'RenderingCancelledException') { releaseSemaphore(); return; }
      console.error(`PDFPage: error rendering page ${pageNumber}:`, err);
      if (isMounted.current) setRenderError(true);
    } finally {
      releaseSemaphore();
      renderTaskRef.current = null;
    }
  }, [pdf, pageNumber, scale, cacheKey, shouldRender, quality]);

  // Invalidate cache and re-render when scale/quality/pdf changes
  useEffect(() => {
    setIsRendered(false);
    setRenderError(false);
  }, [cacheKey]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  const getPdfFilter = () => {
    let f = `brightness(${brightness}%) contrast(${contrast}%)`;
    if (theme === 'dark' || theme === 'midnight' || theme === 'nord') f += ' invert(90%) hue-rotate(180deg)';
    else if (theme === 'sepia') f += ' sepia(40%)';
    return f;
  };

  return (
    <div
      ref={containerRef}
      className={`flex justify-center items-start w-full ${isLandscape ? 'p-2' : 'p-6 sm:p-8'}`}
      style={{ minHeight: isLandscape ? 360 : 600 }}
    >
      <div
        className="shadow-2xl bg-white overflow-hidden rounded-sm relative"
        style={{
          filter: getPdfFilter(),
          boxShadow: theme === 'sepia'
            ? '0 20px 40px -8px rgba(91,70,54,0.3)'
            : '0 20px 50px -12px rgba(0,0,0,0.55)',
        }}
      >
        <div ref={canvasContainerRef} className="w-full h-full" />

        {!isRendered && !renderError && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ minWidth: 200, minHeight: 280, background: 'rgba(250,250,250,0.6)', backdropFilter: 'blur(4px)' }}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              {pageNumber > 5 && (
                <span className="text-[10px] opacity-40 text-slate-600">Page {pageNumber}</span>
              )}
            </div>
          </div>
        )}

        {renderError && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-8"
            style={{ minWidth: 200, minHeight: 280, background: 'rgba(250,250,250,0.8)' }}
          >
            <span className="text-2xl">⚠️</span>
            <p className="text-xs text-center opacity-50 text-slate-600">Page {pageNumber} could not be rendered</p>
            <button
              onClick={() => { setIsRendered(false); setRenderError(false); setShouldRender(false); setTimeout(() => setShouldRender(true), 100); }}
              className="text-xs px-3 py-1.5 rounded-lg bg-blue-500 text-white"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}, (prev, next) =>
  prev.pageNumber === next.pageNumber &&
  prev.scale === next.scale &&
  prev.brightness === next.brightness &&
  prev.contrast === next.contrast &&
  prev.theme === next.theme &&
  prev.isLandscape === next.isLandscape &&
  prev.renderQuality === next.renderQuality &&
  prev.pdf === next.pdf
);
