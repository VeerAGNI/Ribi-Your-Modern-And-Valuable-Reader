import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { cn } from '../utils';

// Simple global cache for rendered pages to prevent re-rendering
const pageCache = new Map<string, HTMLCanvasElement>();
const MAX_CACHE_SIZE = 15; // Lowered to prevent OOM on mobile devices

const addToCache = (key: string, canvas: HTMLCanvasElement) => {
  if (pageCache.size >= MAX_CACHE_SIZE) {
    const firstKey = pageCache.keys().next().value;
    if (firstKey) pageCache.delete(firstKey);
  }
  pageCache.set(key, canvas);
};

interface PDFPageProps {
  pdf: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  brightness: number;
  contrast: number;
  theme: string;
  isLandscape: boolean;
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
  onVisible,
}: PDFPageProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const [isRendered, setIsRendered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number>(isLandscape ? 1.414 : 0.707);

  // Unique key for caching this specific page at this scale
  const cacheKey = useMemo(() => `${(pdf as any).fingerprints?.[0] || 'no-fingerprint'}-${pageNumber}-${scale}`, [pdf, pageNumber, scale]);

  // Fetch aspect ratio early to prevent layout shifts
  useEffect(() => {
    let active = true;
    const getRatio = async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });
        if (active) {
          setAspectRatio(viewport.width / viewport.height);
        }
      } catch (e) {
        console.warn("Failed to get aspect ratio", e);
      }
    };
    getRatio();
    return () => { active = false; };
  }, [pdf, pageNumber]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          onVisible(pageNumber);
        } else {
          setIsVisible(false);
        }
      },
      {
        threshold: 0,
        rootMargin: '800px 0px' // Pre-load pages 800px above and below viewport
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [pageNumber, onVisible]);

  useEffect(() => {
    const renderPage = async () => {
      // If already rendered or cached, just attach it
      if (isRendered || !canvasContainerRef.current || !pdf || !isVisible) return;

      // Check cache first
      const cachedCanvas = pageCache.get(cacheKey);
      if (cachedCanvas) {
        canvasContainerRef.current.innerHTML = '';
        canvasContainerRef.current.appendChild(cachedCanvas);
        setIsRendered(true);
        return;
      }

      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      try {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale });
        const pixelRatio = window.devicePixelRatio || 1;
        // Optimized: Render at max 2x scale for quality without excessive memory
        const renderScale = scale * Math.min(pixelRatio, 1.5);
        const renderViewport = page.getViewport({ scale: renderScale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { alpha: false }); // Optimization: no alpha

        if (!context) return;

        // Enable high quality image smoothing
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'medium'; // Faster than high

        canvas.height = renderViewport.height;
        canvas.width = renderViewport.width;
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
        canvas.style.aspectRatio = `${viewport.width} / ${viewport.height}`;
        canvas.className = "max-w-full block object-contain";

        const renderContext = {
          canvasContext: context,
          viewport: renderViewport,
        };

        const renderTask = page.render(renderContext as any);
        renderTaskRef.current = renderTask;
        await renderTask.promise;

        // Save to cache
        addToCache(cacheKey, canvas);

        if (canvasContainerRef.current) {
          canvasContainerRef.current.innerHTML = '';
          canvasContainerRef.current.appendChild(canvas);
        }
        setIsRendered(true);
      } catch (error: any) {
        if (error.name !== 'RenderingCancelledException') {
          console.error(`Error rendering page ${pageNumber}:`, error);
        }
      }
    };

    renderPage();
  }, [pdf, pageNumber, scale, isRendered, cacheKey, isVisible]);

  const getPdfFilter = () => {
    let filter = `brightness(${brightness}%) contrast(${contrast}%)`;
    if (theme === 'dark' || theme === 'midnight' || theme === 'nord') {
      filter += ' invert(90%) hue-rotate(180deg)';
    } else if (theme === 'sepia') {
      filter += ' sepia(40%) brightness(102%)';
    }
    return filter;
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex justify-center items-start w-full",
        isLandscape ? "py-1 px-2" : "py-2 px-4"
      )}
      style={{
        minHeight: '200px'
      }}
    >
      <div
        className={cn(
          "shadow-2xl bg-white overflow-hidden rounded-sm transition-transform duration-500 relative w-full",
          theme === 'sepia' && "sepia-texture",
          (theme === 'dark' || theme === 'nord') && "dark-texture",
          theme === 'midnight' && "midnight-texture",
          "paper-texture"
        )}
        style={{
          filter: getPdfFilter(),
          aspectRatio: `${aspectRatio}`,
          boxShadow: theme === 'sepia' ? '0 25px 50px -12px rgba(91, 70, 54, 0.25)' : '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
        }}
      >
        <div ref={canvasContainerRef} className="w-full h-full flex items-center justify-center" />
        {!isRendered && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100/50 backdrop-blur-sm">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
});
