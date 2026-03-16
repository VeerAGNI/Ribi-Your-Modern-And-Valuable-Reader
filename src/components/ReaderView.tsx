import React, { useEffect, useState, useCallback, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Theme, FontFamily } from '../types';
import { THEMES, FONT_FAMILIES } from '../constants';
import { motion } from 'motion/react';
import { cn } from '../utils';

interface ReaderViewProps {
  pdf: pdfjsLib.PDFDocumentProxy;
  theme: Theme;
  fontFamily: FontFamily;
  fontSize: number;
  lineHeight: number;
  onPageChange: (page: number) => void;
  currentPage: number;
  isAutoScrolling: boolean;
  autoScrollSpeed: number;
}

interface TextItem {
  text: string;
  isHeading: boolean;
  pageNumber: number;
}

export const ReaderView: React.FC<ReaderViewProps> = ({
  pdf,
  theme,
  fontFamily,
  fontSize,
  lineHeight,
  onPageChange,
  currentPage,
  isAutoScrolling,
  autoScrollSpeed,
}) => {
  const [content, setContent] = useState<TextItem[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentTheme = THEMES[theme];

  const extractText = useCallback(async () => {
    setLoading(true);
    const allItems: TextItem[] = [];
    
    try {
      // Extract first 50 pages for performance, or all if small
      const pagesToExtract = Math.min(pdf.numPages, 100);
      
      for (let i = 1; i <= pagesToExtract; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        let lastY = -1;
        let pageText = '';
        
        textContent.items.forEach((item: any) => {
          if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 5) {
            pageText += '\n';
          }
          pageText += item.str;
          lastY = item.transform[5];
        });

        // Simple heuristic for headings: short lines with no trailing punctuation
        const lines = pageText.split('\n');
        lines.forEach(line => {
          const trimmed = line.trim();
          if (trimmed.length === 0) return;
          
          allItems.push({
            text: trimmed,
            isHeading: trimmed.length < 60 && !trimmed.endsWith('.') && !trimmed.endsWith(','),
            pageNumber: i
          });
        });
      }
      setContent(allItems);
    } catch (error) {
      console.error('Error extracting text:', error);
    } finally {
      setLoading(false);
    }
  }, [pdf]);

  useEffect(() => {
    extractText();
  }, [extractText]);

  // Auto-scrolling logic for Reader Mode
  useEffect(() => {
    if (!isAutoScrolling || autoScrollSpeed === 0 || !containerRef.current) return;

    let rafId: number;
    const scroll = () => {
      if (containerRef.current) {
        const speedMultiplier = 0.5;
        containerRef.current.scrollTop += autoScrollSpeed * speedMultiplier;
      }
      rafId = requestAnimationFrame(scroll);
    };

    rafId = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(rafId);
  }, [isAutoScrolling, autoScrollSpeed]);

  // Handle scroll to update current page
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const scrollPos = container.scrollTop + container.clientHeight / 2;
    
    // Find which page we are on based on content position
    // This is a rough estimate
    const totalHeight = container.scrollHeight;
    const progress = scrollPos / totalHeight;
    const estimatedPage = Math.max(1, Math.min(pdf.numPages, Math.ceil(progress * pdf.numPages)));
    
    if (estimatedPage !== currentPage) {
      onPageChange(estimatedPage);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="h-full w-full overflow-y-auto custom-scrollbar p-8 md:p-16 lg:p-24"
      onScroll={handleScroll}
      style={{ 
        backgroundColor: currentTheme.bg,
        color: currentTheme.text,
        fontFamily: FONT_FAMILIES[fontFamily],
        lineHeight: lineHeight
      }}
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 rounded-full border-t-transparent animate-spin" />
          <p className="text-sm opacity-50 font-mono">Extracting sanctuary text...</p>
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="max-w-3xl mx-auto space-y-6"
          style={{ fontSize: `${fontSize}%` }}
        >
          {content.map((item, idx) => (
            <div key={idx} className={cn(
              item.isHeading ? "text-2xl font-bold mt-12 mb-4" : "text-lg opacity-90 leading-relaxed"
            )}>
              {item.text}
            </div>
          ))}
          <div className="h-32" /> {/* Spacer at bottom */}
        </motion.div>
      )}
    </div>
  );
};
