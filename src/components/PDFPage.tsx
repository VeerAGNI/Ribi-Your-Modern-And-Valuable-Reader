import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// LRU page cache — stores rendered canvases for fast re-display
const PAGE_CACHE_MAX = 8;
const pageCache = new Map<string, HTMLCanvasElement>();
const MAX_CACHE_SIZE = 15; // Lowered to prevent OOM on mobile devices

const addToCache = (key: string, canvas: HTMLCanvasElement) => {
  if (pageCache.size >= MAX_CACHE_SIZE) {
    const firstKey = pageCache.keys().next().value;
    if (firstKey) pageCache.delete(firstKey);
  }
  pageCache.set(key, canvas);
};

function evictCache() {
  while (pageCache.size > PAGE_CACHE_MAX) {
    const key = pageCache.keys().next().value;
    if (key) pageCache.delete(key);
    else break;
  }
}

export function clearPageCacheByFingerprint(fingerprint: string) {
  for (const key of Array.from(pageCache.keys())) {
    if (key.startsWith(fingerprint)) pageCache.delete(key);
  }
}

// Global semaphore — max 3 concurrent renders to prevent OOM
let activeSemCount = 0;
const MAX_CONCURRENT = 3;
const semQueue: Array<() => void> = [];

function semAcquire(): Promise<void> {
  if (activeSemCount < MAX_CONCURRENT) { activeSemCount++; return Promise.resolve(); }
  return new Promise(res => semQueue.push(res));
}
function semRelease() {
  activeSemCount = Math.max(0, activeSemCount - 1);
  const next = semQueue.shift();
  if (next) { activeSemCount++; next(); }
}

// Draw canvas pixel data to a new canvas (cloneNode does NOT copy pixels)
function copyCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const dst = document.createElement('canvas');
  dst.width = src.width;
  dst.height = src.height;
  dst.style.cssText = src.style.cssText;
  dst.className = src.className;
  const ctx = dst.getContext('2d', { alpha: false });
  if (ctx) ctx.drawImage(src, 0, 0);
  return dst;
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
  const [renderError, setRenderError] = useState<string | null>(null);
  const isMounted = useRef(true);

  // Clamp devicePixelRatio to max 2 to prevent OOM on high-DPI mobile
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const cacheKey = useMemo(
    () => `${(pdf as any).fingerprints?.[0] ?? 'pdf'}-p${pageNumber}-s${scale.toFixed(3)}-d${dpr.toFixed(1)}`,
    [pdf, pageNumber, scale, dpr]
  );

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (renderTaskRef.current) { renderTaskRef.current.cancel(); renderTaskRef.current = null; }
    };
  }, []);

  // IntersectionObserver — 2000px margin so pages preload before they scroll into view
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!isMounted.current) return;
        if (entry.isIntersecting) { setIsInView(true); onVisible(pageNumber); }
      },
      { threshold: 0, rootMargin: '2000px 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [pageNumber, onVisible]);

  // Only pre-render first 4 pages; rest wait for IntersectionObserver
  const [shouldRender, setShouldRender] = useState(false);
  useEffect(() => {
    if (isInView) {
      setShouldRender(true);
    } else if (!isRendered && pageNumber <= 4) {
      const t = setTimeout(() => { if (isMounted.current) setShouldRender(true); }, (pageNumber - 1) * 150);
      return () => clearTimeout(t);
    }
  }, [isInView, isRendered, pageNumber]);

  // Reset rendered state when cache key changes (scale/dpr/page change)
  useEffect(() => {
    setIsRendered(false);
    setRenderError(null);
  }, [cacheKey]);

  const renderPage = useCallback(async () => {
    if (!shouldRender || !isMounted.current || !canvasContainerRef.current || !pdf) return;
    if (isRendered) return;

    // ── Cache hit: draw cached canvas to a new canvas ──
    const cached = pageCache.get(cacheKey);
    if (cached) {
      if (canvasContainerRef.current && isMounted.current) {
        const display = copyCanvas(cached);
        canvasContainerRef.current.innerHTML = '';
        canvasContainerRef.current.appendChild(display);
        setIsRendered(true);
      }
      return;
    }

    // ── Cancel any prior render task ──
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      try { await renderTaskRef.current.promise; } catch { /* ignore cancel */ }
      renderTaskRef.current = null;
    }

    await semAcquire();
    if (!isMounted.current) { semRelease(); return; }

    try {
      const page = await pdf.getPage(pageNumber);
      if (!isMounted.current) { semRelease(); return; }

      const viewport = page.getViewport({ scale });

      // Render at devicePixelRatio only (no quality multiplier — sharpness is via CSS filter)
      // Clamp canvas dimensions to 8000px to stay within mobile GPU limits
      const maxDim = 8000;
      const renderDpr = Math.min(dpr, maxDim / Math.max(viewport.width, viewport.height));
      const renderViewport = page.getViewport({ scale: scale * renderDpr });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
      if (!ctx || !isMounted.current) { semRelease(); return; }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      canvas.width = renderViewport.width;
      canvas.height = renderViewport.height;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      canvas.className = 'block';

      const task = page.render({ canvasContext: ctx, viewport: renderViewport } as any);
      renderTaskRef.current = task;
      await task.promise;
      renderTaskRef.current = null;

      if (!isMounted.current) { semRelease(); return; }

      // Store in cache and display (put original canvas directly in DOM)
      evictCache();
      pageCache.set(cacheKey, canvas);
      if (canvasContainerRef.current) {
        canvasContainerRef.current.innerHTML = '';
        canvasContainerRef.current.appendChild(canvas);
      }
      setIsRendered(true);
      setRenderError(null);
    } catch (err: any) {
      const name = err?.name ?? 'UnknownError';
      if (name === 'RenderingCancelledException') { semRelease(); return; }

      // Detailed error for debugging — no more guesswork
      const detail = `[PDFPage] Page ${pageNumber} render failed | ${name}: ${err?.message ?? err}`;
      console.error(detail, { scale, dpr, cacheKey, ua: navigator.userAgent.slice(0, 80) });

      if (isMounted.current) {
        if (err?.message?.includes('out of memory') || err?.message?.includes('memory')) {
          setRenderError('Out of memory. Try lowering the zoom level or quality in settings.');
        } else if (err?.message?.includes('canvas') || name === 'CanvasError') {
          setRenderError('Canvas size exceeded browser limit. Try zooming out.');
        } else {
          setRenderError(`Render failed (${name}). Tap to retry.`);
        }
      }
    } finally {
      semRelease();
      renderTaskRef.current = null;
    }
  }, [pdf, pageNumber, scale, dpr, cacheKey, shouldRender, isRendered]);

  useEffect(() => { renderPage(); }, [renderPage]);

  // CSS-only sharpness filter — quality 1-4 maps to contrast/saturate boosts
  // This is GPU-composited and adds ZERO render latency unlike resolution multipliers
  const getPdfFilter = () => {
    const sharpContrast = renderQuality >= 4 ? 110 : renderQuality >= 3 ? 107 : renderQuality >= 2 ? 104 : 100;
    const sharpSaturate = renderQuality >= 4 ? 108 : renderQuality >= 3 ? 105 : renderQuality >= 2 ? 103 : 100;
    let f = `brightness(${brightness}%) contrast(${Math.round(contrast * sharpContrast / 100)}%) saturate(${sharpSaturate}%)`;
    if (theme === 'dark' || theme === 'midnight' || theme === 'nord') f += ' invert(90%) hue-rotate(180deg)';
    else if (theme === 'sepia') f += ' sepia(40%)';
    return f;
  };

  const retry = () => { setRenderError(null); setIsRendered(false); setShouldRender(false); setTimeout(() => setShouldRender(true), 50); };

  return (
    <div
      ref={containerRef}
      className={`flex justify-center items-start w-full ${isLandscape ? 'p-2' : 'py-4 px-3'}`}
      style={{ minHeight: isLandscape ? 300 : 500 }}
    >
      <div
        className="bg-white overflow-hidden rounded-sm relative"
        style={{
          filter: getPdfFilter(),
          boxShadow: theme === 'sepia'
            ? '0 16px 40px -8px rgba(91,70,54,0.3)'
            : '0 16px 48px -12px rgba(0,0,0,0.5)',
          maxWidth: '100%',
        }}
      >
        {/* Canvas container — sized by the canvas itself */}
        <div ref={canvasContainerRef} />

        {!isRendered && !renderError && (
          <div className="absolute inset-0 flex items-center justify-center"
            style={{ minWidth: 180, minHeight: 260, background: 'rgba(248,248,248,0.8)', backdropFilter: 'blur(4px)' }}>
            <div className="flex flex-col items-center gap-2.5">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-[10px] opacity-40 text-slate-600 font-mono">p.{pageNumber}</span>
            </div>
          </div>
        )}

        {renderError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6"
            style={{ minWidth: 180, minHeight: 260, background: 'rgba(248,248,248,0.92)' }}
            onClick={retry}
          >
            <span className="text-3xl">⚠️</span>
            <p className="text-xs text-center text-slate-500 leading-relaxed">{renderError}</p>
            <span className="text-[10px] text-blue-500 font-medium">Tap to retry</span>
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
