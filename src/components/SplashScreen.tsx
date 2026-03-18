import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export const SplashScreen: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onComplete, 2000); // Wait for fade out animation
    }, 5000); // 5 seconds display
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 2, ease: "easeInOut" }}
          className="fixed inset-0 flex items-center justify-center bg-black overflow-hidden z-[100]"
        >
          {/* Deep space background */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-[#000000] to-black" />

          {/* Flowing gradient nebula */}
          <motion.div
            className="absolute inset-0 opacity-40"
            animate={{
              backgroundPosition: ['0% 0%', '100% 100%'],
              scale: [1, 1.1, 1],
            }}
            transition={{ duration: 15, repeat: Infinity, repeatType: 'reverse' }}
            style={{
              backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(56, 189, 248, 0.15) 0%, transparent 60%)',
              backgroundSize: '150% 150%',
            }}
          />

          {/* Glowing tech orbs */}
          <motion.div
            className="absolute w-96 h-96 bg-blue-600 rounded-full blur-[120px] opacity-20"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.1, 0.3, 0.1],
            }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="relative z-10 text-center flex flex-col items-center"
          >
            <h1
              className="text-7xl md:text-9xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-blue-200 to-blue-600"
              style={{
                fontFamily: '"Space Grotesk", "Outfit", system-ui, sans-serif',
                filter: 'drop-shadow(0 0 30px rgba(56, 189, 248, 0.4))'
              }}
            >
              VEUROS
            </h1>
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: '100%' }}
              transition={{ delay: 0.8, duration: 1 }}
              className="h-[1px] bg-gradient-to-r from-transparent via-blue-400 to-transparent mt-2 mb-6"
            />
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2, duration: 0.8 }}
              className="text-blue-300/80 tracking-[0.3em] text-sm uppercase font-bold"
            >
              Redefining Reading
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
