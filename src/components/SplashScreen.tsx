import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export const SplashScreen: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in');
  const [particles, setParticles] = useState<{ x: number; y: number; size: number; delay: number; duration: number }[]>([]);
  const called = useRef(false);

  useEffect(() => {
    const count = 40;
    setParticles(Array.from({ length: count }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      delay: Math.random() * 3,
      duration: Math.random() * 4 + 3,
    })));

    const holdTimer = setTimeout(() => setPhase('hold'), 400);
    const outTimer = setTimeout(() => setPhase('out'), 4200);
    const doneTimer = setTimeout(() => {
      if (!called.current) {
        called.current = true;
        onComplete();
      }
    }, 5800);

    return () => {
      clearTimeout(holdTimer);
      clearTimeout(outTimer);
      clearTimeout(doneTimer);
    };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {phase !== 'out' ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.4, ease: 'easeInOut' }}
          className="fixed inset-0 flex items-center justify-center overflow-hidden z-[200]"
          style={{ background: '#00040F' }}
        >
          {/* Deep multi-layered background */}
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% 60%, rgba(10,20,60,1) 0%, #00040F 100%)'
          }} />

          {/* Primary Gemini-style glow — large centered blue orb */}
          <motion.div
            className="absolute rounded-full"
            style={{
              width: '70vw',
              height: '70vw',
              maxWidth: 700,
              maxHeight: 700,
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'radial-gradient(circle, rgba(37,99,235,0.22) 0%, rgba(37,99,235,0.08) 40%, transparent 70%)',
              filter: 'blur(8px)',
            }}
            animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Secondary teal/cyan glow — offset */}
          <motion.div
            className="absolute rounded-full"
            style={{
              width: '50vw',
              height: '50vw',
              maxWidth: 500,
              maxHeight: 500,
              top: '38%',
              left: '48%',
              background: 'radial-gradient(circle, rgba(56,189,248,0.18) 0%, transparent 65%)',
              filter: 'blur(12px)',
            }}
            animate={{ scale: [1, 1.12, 1], opacity: [0.5, 0.9, 0.5] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
          />

          {/* Deep violet accent glow */}
          <motion.div
            className="absolute rounded-full"
            style={{
              width: '40vw',
              height: '40vw',
              maxWidth: 400,
              maxHeight: 400,
              top: '55%',
              left: '40%',
              background: 'radial-gradient(circle, rgba(99,60,220,0.14) 0%, transparent 60%)',
              filter: 'blur(20px)',
            }}
            animate={{ scale: [1.05, 1, 1.05], opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          />

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
                background: 'rgba(147,197,253,0.6)',
                boxShadow: '0 0 6px rgba(147,197,253,0.8)',
              }}
              animate={{
                y: [-10, 10, -10],
                opacity: [0, 0.8, 0],
              }}
              transition={{
                duration: p.duration,
                delay: p.delay,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          ))}

          {/* Horizontal scan line */}
          <motion.div
            className="absolute left-0 right-0 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(56,189,248,0.4), transparent)' }}
            animate={{ top: ['20%', '80%', '20%'] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Corner brackets — futuristic HUD */}
          {[
            { top: '20%', left: '10%', rotate: 0 },
            { top: '20%', right: '10%', rotate: 90 },
            { bottom: '20%', left: '10%', rotate: 270 },
            { bottom: '20%', right: '10%', rotate: 180 },
          ].map((pos, i) => (
            <motion.div
              key={i}
              className="absolute w-8 h-8"
              style={{
                ...pos,
                borderTop: '2px solid rgba(56,189,248,0.4)',
                borderLeft: '2px solid rgba(56,189,248,0.4)',
                transform: `rotate(${pos.rotate}deg)`,
              }}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 + i * 0.1, duration: 0.5 }}
            />
          ))}

          {/* Main content */}
          <div className="relative z-10 flex flex-col items-center select-none">
            {/* VEUROS — futuristic Orbitron-style */}
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.88 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
              className="relative"
            >
              <h1
                style={{
                  fontFamily: '"Orbitron", "Space Grotesk", system-ui, sans-serif',
                  fontSize: 'clamp(4rem, 14vw, 9rem)',
                  fontWeight: 900,
                  letterSpacing: '0.15em',
                  background: 'linear-gradient(135deg, #FFFFFF 0%, #93C5FD 35%, #3B82F6 65%, #1D4ED8 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  filter: 'drop-shadow(0 0 40px rgba(59,130,246,0.6)) drop-shadow(0 0 80px rgba(37,99,235,0.3))',
                  lineHeight: 1,
                }}
              >
                VEUROS
              </h1>
              {/* Reflection */}
              <div
                style={{
                  fontFamily: '"Orbitron", "Space Grotesk", system-ui, sans-serif',
                  fontSize: 'clamp(4rem, 14vw, 9rem)',
                  fontWeight: 900,
                  letterSpacing: '0.15em',
                  background: 'linear-gradient(180deg, rgba(59,130,246,0.2) 0%, transparent 80%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  transform: 'scaleY(-1)',
                  lineHeight: 1,
                  marginTop: 2,
                  opacity: 0.4,
                  maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 60%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 60%)',
                  userSelect: 'none',
                  pointerEvents: 'none',
                }}
                aria-hidden="true"
              >
                VEUROS
              </div>
            </motion.div>

            {/* Animated separator line */}
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.9, ease: 'easeOut' }}
              className="mt-4 mb-5"
              style={{
                width: 'clamp(200px, 40vw, 400px)',
                height: 1,
                background: 'linear-gradient(90deg, transparent, rgba(56,189,248,0.8), rgba(59,130,246,1), rgba(56,189,248,0.8), transparent)',
                boxShadow: '0 0 12px rgba(56,189,248,0.6)',
              }}
            />

            {/* Tagline */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.3, duration: 0.8, ease: 'easeOut' }}
              style={{
                fontFamily: '"Orbitron", "Space Grotesk", system-ui, sans-serif',
                fontSize: 'clamp(0.65rem, 2vw, 0.9rem)',
                fontWeight: 500,
                letterSpacing: '0.4em',
                color: 'rgba(147,197,253,0.85)',
                textTransform: 'uppercase',
              }}
            >
              Redefining Technology
            </motion.p>

            {/* Loading dots */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.8, duration: 0.5 }}
              className="flex gap-2 mt-10"
            >
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="rounded-full"
                  style={{ width: 5, height: 5, background: 'rgba(56,189,248,0.7)' }}
                  animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
                  transition={{ duration: 1.2, delay: i * 0.2, repeat: Infinity, ease: 'easeInOut' }}
                />
              ))}
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
