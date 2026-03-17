import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { cn } from '../utils';

// LRU page cache — limits memory usage while keeping recent pages fast
const PAGE_CACHE_MAX = 20;
const pageCache = new Map<string, HTMLCanvasElement>();

function evictCacheIfNeeded() {
  if (pageCache.size > PAGE_CACHE_MAX) {
    const firstKey = pageCache.keys().next().value;
    if (firstKey) pageCache.delete(firstKey);
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

  const quality = Math.max(1, Math.min(4, renderQuality || 2));
  const cacheKey = useMemo(
    () => `${(pdf as any).fingerprints?.[0] || 'pdf'}-${pageNumber}-${scale.toFixed(2)}-${quality}`,
    [pdf, pageNumber, scale, quality]
  );

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // IntersectionObserver — only render when near viewport
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
      { threshold: 0, rootMargin: '1500px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [pageNumber, onVisible]);

  // Trigger render when in view or soon after mount (staggered)
  const [shouldRender, setShouldRender] = useState(false);
  useEffect(() => {
    if (isInView) {
      setShouldRender(true);
    } else if (!isRendered) {
      const t = setTimeout(() => {
        if (isMounted.current) setShouldRender(true);
      }, pageNumber * 40);
      return () => clearTimeout(t);
    }
  }, [isInView, isRendered, pageNumber]);

  const renderPage = useCallback(async () => {
    if (!canvasContainerRef.current || !pdf || !shouldRender) return;
    if (isRendered) return;

    // Check cache
    const cached = pageCache.get(cacheKey);
    if (cached) {
      if (canvasContainerRef.current && isMounted.current) {
        canvasContainerRef.current.innerHTML = '';
        canvasContainerRef.current.appendChild(cached);
        setIsRendered(true);
      }
      return;
    }

    // Cancel any in-flight render
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      try { await renderTaskRef.current.promise; } catch { /* ignored */ }
      renderTaskRef.current = null;
    }

    try {
      const page = await pdf.getPage(pageNumber);
      if (!isMounted.current) return;

      const viewport = page.getViewport({ scale });
      const pixelRatio = window.devicePixelRatio || 1;

      // Quality multiplier: Draft=1x, Standard=2x, High=3x, Ultra=4x
      // Clamp so canvas doesn't exceed browser limits (~16384px)
      const baseMultiplier = pixelRatio * quality;
      const maxDim = 12000;
      const clampedMultiplier = Math.min(
        baseMultiplier,
        maxDim / Math.max(viewport.width, viewport.height)
      );

      const renderViewport = page.getViewport({ scale: scale * clampedMultiplier });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
      if (!ctx || !isMounted.current) return;

      ctx.imageSmoothingEnabled = quality >= 3 ? false : true;
      ctx.imageSmoothingQuality = quality >= 3 ? 'high' : 'medium';

      canvas.width = renderViewport.width;
      canvas.height = renderViewport.height;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      canvas.className = 'max-w-full h-auto block';

      const renderTask = page.render({ canvasContext: ctx, viewport: renderViewport } as any);
      renderTaskRef.current = renderTask;

      await renderTask.promise;

      if (!isMounted.current) return;

      // Cache and display
      evictCacheIfNeeded();
      pageCache.set(cacheKey, canvas);

      if (canvasContainerRef.current) {
        canvasContainerRef.current.innerHTML = '';
        canvasContainerRef.current.appendChild(canvas);
      }
      setIsRendered(true);
      setRenderError(false);
    } catch (err: any) {
      if (err?.name === 'RenderingCancelledException') return;
      console.error(`PDFPage: error rendering page ${pageNumber}:`, err);
      if (isMounted.current) setRenderError(true);
    } finally {
      renderTaskRef.current = null;
    }
  }, [pdf, pageNumber, scale, cacheKey, shouldRender, quality]);

  // Re-render when scale/quality changes — invalidate cache entry and re-render
  useEffect(() => {
    setIsRendered(false);
    setRenderError(false);
  }, [cacheKey]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  const getPdfFilter = () => {
    let f = `brightness(${brightness}%) contrast(${contrast}%)`;
    if (quality >= 3) f += ' contrast(108%) saturate(105%)'; // subtle sharpness boost
    if (theme === 'dark' || theme === 'midnight' || theme === 'nord') f += ' invert(90%) hue-rotate(180deg)';
    else if (theme === 'sepia') f += ' sepia(40%)';
    return f;
  };

  return (
    <div
      ref={containerRef}
      className={cn('flex justify-center items-start w-full', isLandscape ? 'p-2' : 'p-6 sm:p-8')}
      style={{ minHeight: isLandscape ? 360 : 600 }}
    >
      <div
        className={cn(
          'shadow-2xl bg-white overflow-hidden rounded-sm relative transition-shadow duration-300',
          theme === 'sepia' && 'sepia-texture',
          (theme === 'dark' || theme === 'nord') && 'dark-texture',
          theme === 'midnight' && 'midnight-texture',
          'paper-texture'
        )}
        style={{
          filter: getPdfFilter(),
          boxShadow: theme === 'sepia'
            ? '0 20px 40px -8px rgba(91,70,54,0.3)'
            : '0 20px 50px -12px rgba(0,0,0,0.55)',
        }}
      >
        <div ref={canvasContainerRef} className="w-full h-full" />

        {/* Loading overlay */}
        {!isRendered && !renderError && (
          <div className="absolute inset-0 flex items-center justify-center"
            style={{ minWidth: 200, minHeight: 280, background: 'rgba(250,250,250,0.6)', backdropFilter: 'blur(4px)' }}>
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              {pageNumber > 10 && (
                <span className="text-[10px] opacity-40 text-slate-600">Page {pageNumber}</span>
              )}
            </div>
          </div>
        )}

        {/* Error state */}
        {renderError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-8"
            style={{ minWidth: 200, minHeight: 280, background: 'rgba(250,250,250,0.8)' }}>
            <span className="text-2xl">⚠️</span>
            <p className="text-xs text-center opacity-50 text-slate-600">Page {pageNumber} could not be rendered</p>
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
