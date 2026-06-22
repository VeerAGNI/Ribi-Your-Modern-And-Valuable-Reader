import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export const SplashScreen: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in');
  const [particles] = useState(() =>
    Array.from({ length: 28 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      delay: Math.random() * 3,
      duration: Math.random() * 4 + 3,
    }))
  );
  const called = useRef(false);

  useEffect(() => {
    const holdTimer = setTimeout(() => setPhase('hold'), 400);
    const outTimer  = setTimeout(() => setPhase('out'),  4200);
    const doneTimer = setTimeout(() => {
      if (!called.current) { called.current = true; onComplete(); }
    }, 5800);
    return () => { clearTimeout(holdTimer); clearTimeout(outTimer); clearTimeout(doneTimer); };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {phase !== 'out' && (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.1, ease: 'easeInOut' }}
          className="fixed inset-0 flex items-center justify-center overflow-hidden z-[200]"
        >
          {/* Real splash background */}
          <img
            src="/splash-bg.png"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ userSelect: 'none', pointerEvents: 'none' }}
          />

          {/* Readability overlay */}
          <div className="absolute inset-0" style={{ background: 'rgba(8,4,30,0.38)' }} />

          {/* Floating particles */}
          {particles.map((p, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: p.size,
                height: p.size,
                background: 'rgba(210,180,255,0.75)',
                boxShadow: '0 0 6px rgba(210,180,255,0.9)',
              }}
              animate={{ y: [-12, 12, -12], opacity: [0, 0.85, 0] }}
              transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
            />
          ))}

          {/* Main content */}
          <div className="relative z-10 flex flex-col items-center select-none px-8 text-center">

            {/* Ribi logo */}
            <motion.img
              src="/ribi-logo.png"
              alt="Ribi"
              initial={{ opacity: 0, y: 28, scale: 0.82 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1], delay: 0.25 }}
              style={{
                width: 108,
                height: 108,
                objectFit: 'contain',
                filter: 'drop-shadow(0 0 32px rgba(180,100,255,0.55)) drop-shadow(0 0 12px rgba(100,160,255,0.4))',
                marginBottom: 22,
              }}
            />

            {/* Veuros logo */}
            <motion.img
              src="/veuros-logo.png"
              alt="Veuros"
              initial={{ opacity: 0, y: 18, scale: 0.88 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
              style={{
                width: 230,
                objectFit: 'contain',
                filter: 'brightness(1.15) drop-shadow(0 0 28px rgba(147,97,253,0.5))',
              }}
            />

            {/* Separator */}
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ delay: 0.95, duration: 0.85, ease: 'easeOut' }}
              style={{
                marginTop: 20,
                marginBottom: 16,
                width: 220,
                height: 1,
                background: 'linear-gradient(90deg,transparent,rgba(200,155,255,0.85),rgba(147,97,253,1),rgba(200,155,255,0.85),transparent)',
                boxShadow: '0 0 14px rgba(147,97,253,0.55)',
              }}
            />

            {/* Tagline */}
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.25, duration: 0.75, ease: 'easeOut' }}
              style={{
                fontFamily: '"Space Grotesk","Inter",system-ui,sans-serif',
                fontSize: 'clamp(0.6rem, 2vw, 0.78rem)',
                fontWeight: 500,
                letterSpacing: '0.38em',
                color: 'rgba(220,195,255,0.88)',
                textTransform: 'uppercase',
              }}
            >
              Redefining Technology
            </motion.p>

            {/* Loading dots */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.75, duration: 0.5 }}
              className="flex gap-2 mt-10"
            >
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="rounded-full"
                  style={{ width: 5, height: 5, background: 'rgba(200,155,255,0.85)' }}
                  animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.25, 0.8] }}
                  transition={{ duration: 1.2, delay: i * 0.2, repeat: Infinity, ease: 'easeInOut' }}
                />
              ))}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
