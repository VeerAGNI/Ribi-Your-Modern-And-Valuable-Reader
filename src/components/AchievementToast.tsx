import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy } from 'lucide-react';

interface AchievementToastProps {
  achievement: { title: string; icon: string } | null;
  onClose: () => void;
}

export const AchievementToast: React.FC<AchievementToastProps> = ({ achievement, onClose }) => {
  useEffect(() => {
    if (achievement) {
      const timer = setTimeout(() => {
        onClose();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [achievement, onClose]);

  return (
    <AnimatePresence>
      {achievement && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.9, x: "-50%" }}
          animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
          exit={{ opacity: 0, y: -20, scale: 0.9, x: "-50%" }}
          className="fixed top-6 left-1/2 z-[100] overflow-hidden rounded-full bg-slate-900 text-white px-6 py-4 shadow-2xl border border-white/10 flex items-center gap-4 min-w-[300px]"
        >
          <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center text-xl shrink-0">
            {achievement.icon}
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-500 mb-0.5 flex items-center gap-1">
              <Trophy size={10} />
              Achievement Unlocked
            </p>
            <p className="font-bold text-sm">You've become a {achievement.title}</p>
          </div>

          {/* Progress Line Animation */}
          <motion.div
            initial={{ width: "100%" }}
            animate={{ width: "0%" }}
            transition={{ duration: 4, ease: "linear" }}
            className="absolute bottom-0 left-0 h-1 bg-yellow-500"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};
