import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, X } from 'lucide-react';

interface AchievementToastProps {
  achievement: { title: string; icon: string } | null;
  onClose: () => void;
}

export const AchievementToast: React.FC<AchievementToastProps> = ({ achievement, onClose }) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (achievement) {
      timerRef.current = setTimeout(() => {
        onClose();
      }, 4500);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [achievement, onClose]);

  return (
    <AnimatePresence mode="wait">
      {achievement && (
        <motion.div
          key={achievement.title}
          initial={{ opacity: 0, y: -60, x: '-50%', scale: 0.85 }}
          animate={{ opacity: 1, y: 0, x: '-50%', scale: 1 }}
          exit={{ opacity: 0, y: -30, x: '-50%', scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          className="fixed top-5 left-1/2 z-[200] overflow-hidden rounded-2xl flex items-center gap-4 min-w-[300px] max-w-sm"
          style={{
            background: 'linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(30,41,59,0.98) 100%)',
            border: '1px solid rgba(234,179,8,0.25)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(234,179,8,0.1), 0 0 30px rgba(234,179,8,0.08)',
            backdropFilter: 'blur(20px)',
            padding: '14px 16px',
          }}
        >
          {/* Icon */}
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0"
            style={{ background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.2)' }}>
            {achievement.icon}
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="flex items-center gap-1.5 mb-0.5"
              style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', color: '#F59E0B', textTransform: 'uppercase' }}>
              <Trophy size={10} />
              Achievement Unlocked
            </p>
            <p className="text-white font-bold text-sm truncate">
              {achievement.title}
            </p>
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            <X size={13} />
          </button>

          {/* Progress bar */}
          <motion.div
            initial={{ scaleX: 1 }}
            animate={{ scaleX: 0 }}
            transition={{ duration: 4.5, ease: 'linear' }}
            className="absolute bottom-0 left-0 h-0.5 w-full origin-left"
            style={{ background: 'linear-gradient(90deg, #F59E0B, #FBBF24)' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};
