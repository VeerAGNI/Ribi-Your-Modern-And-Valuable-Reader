import React, { useState } from 'react';
import { motion } from 'motion/react';
import { signInWithPopup, signInWithRedirect, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebase';
import { BookOpen, Loader2 } from 'lucide-react';

interface AuthScreenProps {
  error?: string | null;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ error: parentError }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(parentError || null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    const provider = new GoogleAuthProvider();

    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error('Error signing in:', err);

      if (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment') {
        // Popup was blocked or not supported — fall back to redirect
        try {
          await signInWithRedirect(auth, provider);
          return; // Page will redirect
        } catch (redirectErr: any) {
          console.error('Redirect sign-in also failed:', redirectErr);
          setError('Unable to sign in. Please allow popups for this site and try again.');
        }
      } else if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        // User closed the popup — no error needed
      } else if (err.code === 'auth/unauthorized-domain') {
        setError('This domain is not authorized for sign-in. Please contact the app owner.');
      } else {
        setError(err.message || 'Unable to sign in. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 overflow-hidden font-sans">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 w-full max-w-md p-8 md:p-12 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl text-center"
      >
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-blue-500/20 rounded-2xl border border-blue-500/30">
            <BookOpen className="w-12 h-12 text-blue-400" />
          </div>
        </div>

        <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
          Welcome To <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500">Ribi</span>
        </h1>
        <p className="text-slate-400 mb-10 leading-relaxed text-lg">
          Your Next Page Is Waiting..
        </p>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full py-4 px-6 bg-white hover:bg-slate-100 text-slate-900 font-semibold rounded-2xl transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
          )}
          {loading ? 'Signing in...' : 'Continue with Google'}
        </button>

        <div className="mt-8 pt-6 border-t border-white/5 text-xs text-slate-500">
          <p>&copy; 2024 Veuros. All rights reserved.</p>
          <p className="mt-2 text-sm font-medium text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-400 to-orange-400">Founded By Veer Agnihotri</p>
        </div>
      </motion.div>
    </div>
  );
};
