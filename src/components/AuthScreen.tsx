import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { BookOpen, Lock, Mail, Eye, EyeOff, AlertCircle } from 'lucide-react';

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL as string | undefined;
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD as string | undefined;
const ADMIN_DEVICE_KEY = 'veuros_admin_device_v1';

export const AuthScreen: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [adminEmail, setAdminEmail] = useState(ADMIN_EMAIL || '');
  const [adminPassword, setAdminPassword] = useState(ADMIN_PASSWORD || '');
  const [showPassword, setShowPassword] = useState(false);
  const logoClickCount = useRef(0);
  const logoClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-login for admin device on mount
  useEffect(() => {
    const isAdminDevice = localStorage.getItem(ADMIN_DEVICE_KEY) === 'true';
    if (isAdminDevice && ADMIN_EMAIL && ADMIN_PASSWORD) {
      handleAdminLogin(ADMIN_EMAIL, ADMIN_PASSWORD, true);
    }
  }, []);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        setError('Sign-in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (email: string, password: string, silent = false) => {
    if (!email || !password) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      localStorage.setItem(ADMIN_DEVICE_KEY, 'true');
    } catch (err: any) {
      const msgs: Record<string, string> = {
        'auth/invalid-credential': 'Invalid admin credentials.',
        'auth/user-not-found': 'Admin account not found.',
        'auth/wrong-password': 'Incorrect password.',
        'auth/too-many-requests': 'Too many attempts. Try later.',
      };
      if (!silent) setError(msgs[err.code] || 'Admin login failed.');
      if (silent) localStorage.removeItem(ADMIN_DEVICE_KEY);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Secret: click Ribi logo 5 times fast to reveal admin panel
  const handleLogoClick = () => {
    logoClickCount.current += 1;
    if (logoClickTimer.current) clearTimeout(logoClickTimer.current);
    logoClickTimer.current = setTimeout(() => { logoClickCount.current = 0; }, 1500);
    if (logoClickCount.current >= 5) {
      logoClickCount.current = 0;
      setAdminMode(prev => !prev);
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center overflow-hidden font-sans relative"
      style={{ background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1b3e 50%, #0a0f1e 100%)' }}>
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.5) 0%, transparent 70%)', filter: 'blur(60px)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.4) 0%, transparent 70%)', filter: 'blur(60px)' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        <div className="p-8 md:p-10 rounded-3xl text-center"
          style={{
            background: 'rgba(10,15,35,0.7)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(24px)',
            boxShadow: '0 32px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(59,130,246,0.1), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}>

          {/* Logo */}
          <motion.div
            className="flex justify-center mb-6 cursor-pointer"
            onClick={handleLogoClick}
            whileTap={{ scale: 0.92 }}
          >
            <div className="p-4 rounded-2xl relative"
              style={{
                background: 'rgba(59,130,246,0.1)',
                border: '1px solid rgba(59,130,246,0.25)',
                boxShadow: '0 0 30px rgba(59,130,246,0.15)',
              }}>
              <BookOpen className="w-10 h-10 text-blue-400" />
            </div>
          </motion.div>

          <h1 className="text-3xl font-bold text-white mb-1 tracking-tight">
            Welcome to{' '}
            <span style={{
              background: 'linear-gradient(90deg, #f97316, #ef4444, #f59e0b)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>Ribi</span>
          </h1>
          <p className="mb-8 leading-relaxed" style={{ color: 'rgba(148,163,184,0.9)', fontSize: '0.95rem' }}>
            Your next page is waiting.
          </p>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 mb-4 px-4 py-3 rounded-xl text-sm text-red-400"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                <AlertCircle size={15} className="shrink-0" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Admin panel */}
          <AnimatePresence>
            {adminMode && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mb-4"
              >
                <div className="p-4 rounded-2xl flex flex-col gap-3 mb-1"
                  style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
                  <p className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-1 flex items-center gap-1.5">
                    <Lock size={11} /> Admin Access
                  </p>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-3.5 text-slate-500" />
                    <input
                      type="email"
                      value={adminEmail}
                      onChange={e => setAdminEmail(e.target.value)}
                      placeholder="Admin email"
                      className="w-full pl-9 pr-4 py-3 rounded-xl text-sm text-white bg-white/5 border border-white/10 focus:border-purple-500 focus:outline-none transition-colors"
                    />
                  </div>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-3.5 text-slate-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={adminPassword}
                      onChange={e => setAdminPassword(e.target.value)}
                      placeholder="Admin password"
                      className="w-full pl-9 pr-10 py-3 rounded-xl text-sm text-white bg-white/5 border border-white/10 focus:border-purple-500 focus:outline-none transition-colors"
                      onKeyDown={e => e.key === 'Enter' && handleAdminLogin(adminEmail, adminPassword)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(p => !p)}
                      className="absolute right-3 top-3.5 text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <button
                    onClick={() => handleAdminLogin(adminEmail, adminPassword)}
                    disabled={loading || !adminEmail || !adminPassword}
                    className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40"
                    style={{ background: 'rgba(139,92,246,0.7)' }}
                  >
                    {loading ? 'Signing in…' : 'Sign In as Admin'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Google sign in */}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-4 px-6 font-semibold rounded-2xl transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-50"
            style={{
              background: 'rgba(255,255,255,0.97)',
              color: '#1e293b',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.1), 0 8px 24px rgba(0,0,0,0.3)',
            }}
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            {loading ? 'Signing in…' : 'Continue with Google'}
          </button>

          <div className="mt-8 pt-5 text-xs" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', color: 'rgba(100,116,139,0.8)' }}>
            <p>© 2024 Veuros. All rights reserved.</p>
            <p className="mt-1.5 font-medium"
              style={{ background: 'linear-gradient(90deg, #fde68a, #f59e0b, #f97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Founded by Veer Agnihotri
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
