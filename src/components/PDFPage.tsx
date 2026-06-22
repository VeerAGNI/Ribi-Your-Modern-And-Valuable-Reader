import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

const PAGE_CACHE_MAX = 6;
const pageCache = new Map<string, HTMLCanvasElement>();

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

function getQualityMultiplier(quality: number): number {
  if (quality >= 4) return 2.0;
  if (quality >= 3) return 1.5;
  if (quality >= 2) return 1.0;
  return 0.75;
}

function buildPdfFilter(theme: string): string {
  if (theme === 'dark' || theme === 'midnight') return 'invert(1)';
  if (theme === 'nord') return 'invert(1) sepia(20%) hue-rotate(185deg)';
  if (theme === 'sepia') return 'sepia(40%)';
  return 'none';
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
  observerRoot?: HTMLElement | null;
}

export const PDFPage = React.memo(({
  pdf,
  pageNumber,
  scale,
  brightness,
  theme,
  isLandscape,
  renderQuality,
  onVisible,
  observerRoot,
}: PDFPageProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const [isRendered, setIsRendered] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number } | null>(null);
  const isMounted = useRef(true);

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const qualityMultiplier = getQualityMultiplier(renderQuality);

  const cacheKey = useMemo(
    () => `${(pdf as any).fingerprints?.[0] ?? 'pdf'}-p${pageNumber}-s${scale.toFixed(3)}-d${dpr.toFixed(1)}-q${renderQuality}`,
    [pdf, pageNumber, scale, dpr, renderQuality]
  );

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (renderTaskRef.current) { renderTaskRef.current.cancel(); renderTaskRef.current = null; }
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!isMounted.current) return;
        if (entry.isIntersecting) { setIsInView(true); onVisible(pageNumber); }
      },
      {
        root: observerRoot ?? null,
        threshold: 0,
        rootMargin: observerRoot ? '800px 0px' : '300px 0px',
      }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [pageNumber, onVisible, observerRoot]);

  const [shouldRender, setShouldRender] = useState(false);
  useEffect(() => {
    if (isInView) {
      setShouldRender(true);
    } else if (!isRendered && pageNumber <= 2) {
      const t = setTimeout(() => { if (isMounted.current) setShouldRender(true); }, (pageNumber - 1) * 80);
      return () => clearTimeout(t);
    }
  }, [isInView, isRendered, pageNumber]);

  useEffect(() => {
    setIsRendered(false);
    setRenderError(null);
  }, [cacheKey]);

  const renderPage = useCallback(async () => {
    if (!shouldRender || !isMounted.current || !canvasContainerRef.current || !pdf) return;
    if (isRendered) return;

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

    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      try { await renderTaskRef.current.promise; } catch { }
      renderTaskRef.current = null;
    }

    await semAcquire();
    if (!isMounted.current) { semRelease(); return; }

    try {
      const page = await pdf.getPage(pageNumber);
      if (!isMounted.current) { semRelease(); return; }

      const viewport = page.getViewport({ scale: 1.0 });
      setPageDimensions({ width: viewport.width, height: viewport.height });

      const scaledViewport = page.getViewport({ scale });
      const maxDim = 8000;
      const effectiveDpr = Math.min(
        dpr * qualityMultiplier,
        maxDim / Math.max(scaledViewport.width, scaledViewport.height)
      );
      const renderViewport = page.getViewport({ scale: scale * effectiveDpr });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
      if (!ctx || !isMounted.current) { semRelease(); return; }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      canvas.width = renderViewport.width;
      canvas.height = renderViewport.height;
      canvas.style.display = 'block';
      canvas.style.width = '100%';
      canvas.style.height = '100%';

      const task = page.render({ canvasContext: ctx, viewport: renderViewport } as any);
      renderTaskRef.current = task;
      await task.promise;
      renderTaskRef.current = null;

      if (!isMounted.current) { semRelease(); return; }

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
      console.error(`[PDFPage] Page ${pageNumber} failed | ${name}: ${err?.message}`);
      if (isMounted.current) {
        if (err?.message?.includes('memory')) setRenderError('Out of memory. Try lowering quality.');
        else setRenderError('Render failed. Tap to retry.');
      }
    } finally {
      semRelease();
      renderTaskRef.current = null;
    }
  }, [pdf, pageNumber, scale, dpr, qualityMultiplier, cacheKey, shouldRender, isRendered]);

  useEffect(() => { renderPage(); }, [renderPage]);

  const retry = () => {
    setRenderError(null);
    setIsRendered(false);
    setShouldRender(false);
    setTimeout(() => setShouldRender(true), 50);
  };

  const filter = buildPdfFilter(theme);
  const brightnessOverlayOpacity = brightness < 100 ? ((100 - brightness) / 100) * 0.88 : 0;
  const bgColor = (theme === 'dark' || theme === 'midnight' || theme === 'nord') ? '#000' : '#fff';

  return (
    <div
      ref={containerRef}
      className={`flex justify-center items-start w-full ${isLandscape ? 'py-1 px-0' : 'py-3 px-3'}`}
      style={{ minHeight: isLandscape ? 80 : 200 }}
    >
      <div
        className="overflow-hidden rounded-sm relative"
        style={{
          filter,
          boxShadow: theme === 'sepia'
            ? '0 12px 32px -6px rgba(91,70,54,0.3)'
            : '0 12px 40px -10px rgba(0,0,0,0.5)',
          width: '100%',
          maxWidth: pageDimensions ? `${pageDimensions.width * scale}px` : 'none',
          aspectRatio: pageDimensions ? `${pageDimensions.width} / ${pageDimensions.height}` : 'auto',
          backgroundColor: bgColor,
        }}
      >
        <div ref={canvasContainerRef} className="w-full h-full" />

        {brightnessOverlayOpacity > 0 && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: `rgba(0,0,0,${brightnessOverlayOpacity.toFixed(3)})`, zIndex: 2 }}
          />
        )}

        {!isRendered && !renderError && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ minWidth: 160, minHeight: 220, background: 'rgba(248,248,248,0.92)', backdropFilter: 'blur(4px)' }}
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-[10px] opacity-30 text-slate-500 font-mono">p.{pageNumber}</span>
            </div>
          </div>
        )}

        {renderError && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 cursor-pointer"
            style={{ minWidth: 160, minHeight: 220, background: 'rgba(248,248,248,0.95)' }}
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
  prev.pdf === next.pdf &&
  prev.observerRoot === next.observerRoot
);
