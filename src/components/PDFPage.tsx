import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { cn } from '../utils';

// Simple global cache for rendered pages to prevent re-rendering
const pageCache = new Map<string, HTMLCanvasElement>();

interface PDFPageProps {
  pdf: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  brightness: number;
  contrast: number;
  theme: string;
  onVisible: (pageNumber: number) => void;
}

export const PDFPage = React.memo(({
  pdf,
  pageNumber,
  scale,
  brightness,
  contrast,
  theme,
  onVisible,
}: PDFPageProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const [isRendered, setIsRendered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Unique key for caching this specific page at this scale
  const cacheKey = useMemo(() => `${(pdf as any).fingerprints?.[0] || 'no-fingerprint'}-${pageNumber}-${scale}`, [pdf, pageNumber, scale]);

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
        rootMargin: '2000px 0px' // Pre-load pages 2000px above and below viewport
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [pageNumber, onVisible]);

  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
    } else if (!isRendered) {
      // Staggered background rendering
      const timer = setTimeout(() => {
        setShouldRender(true);
      }, pageNumber * 50);
      return () => clearTimeout(timer);
    }
  }, [isVisible, isRendered, pageNumber]);

  useEffect(() => {
    const renderPage = async () => {
      // If already rendered or cached, just attach it
      if (isRendered || !canvasContainerRef.current || !pdf || !shouldRender) return;

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
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { alpha: false }); // Optimization: no alpha

        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;
        canvas.className = "max-w-full h-auto block";

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext as any);
        renderTaskRef.current = renderTask;
        await renderTask.promise;

        // Save to cache
        pageCache.set(cacheKey, canvas);
        
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
  }, [pdf, pageNumber, scale, isRendered, cacheKey, shouldRender]);

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
      className="flex justify-center p-8 w-full"
      style={{ minHeight: '800px' }}
    >
      <div 
        className={cn(
          "shadow-2xl bg-white overflow-hidden rounded-sm transition-transform duration-500 relative",
          theme === 'sepia' && "sepia-texture",
          (theme === 'dark' || theme === 'nord') && "dark-texture",
          theme === 'midnight' && "midnight-texture",
          "paper-texture"
        )}
        style={{ 
          filter: getPdfFilter(),
          boxShadow: theme === 'sepia' ? '0 25px 50px -12px rgba(91, 70, 54, 0.25)' : '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
        }}
      >
        <div ref={canvasContainerRef} className="w-full h-full" />
        {!isRendered && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100/50 backdrop-blur-sm">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
});
