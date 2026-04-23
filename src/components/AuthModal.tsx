import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, Lock, User, LogIn, ArrowRight, Loader2, Globe } from 'lucide-react';
import { useAuth } from './AuthProvider';
import toast from 'react-hot-toast';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'en' | 'bn';
}

export default function AuthModal({ isOpen, onClose, lang }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUpWithEmail, loginWithEmail } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'signup') {
        if (!name) {
          toast.error(lang === 'en' ? 'Name is required' : 'নাম প্রয়োজন');
          setLoading(false);
          return;
        }
        await signUpWithEmail(email, password, name);
        toast.success(lang === 'en' ? 'Account created!' : 'অ্যাকাউন্ট তৈরি হয়েছে!');
      } else {
        await loginWithEmail(email, password);
        toast.success(lang === 'en' ? 'Welcome back!' : 'স্বাগতম!');
      }
      onClose();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signIn();
      onClose();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-white w-full max-w-md rounded-[40px] shadow-2xl relative overflow-hidden"
          >
            {/* Header Gradient */}
            <div className="h-24 bg-gradient-to-r from-green-600 to-emerald-700 p-8 flex items-end">
              <h2 className="text-white font-display font-black text-2xl uppercase tracking-tighter">
                {mode === 'login' ? (lang === 'en' ? 'Welcome Back' : 'স্বাগতম') : (lang === 'en' ? 'Join Community' : 'যোগদান করুন')}
              </h2>
            </div>

            <button
              onClick={onClose}
              className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <button
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full flex items-center justify-center space-x-3 bg-white border-2 border-gray-100 p-4 rounded-2xl hover:bg-gray-50 transition-all font-bold text-gray-700 shadow-sm disabled:opacity-50"
                >
                  <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                  <span>{lang === 'en' ? 'Continue with Google' : 'গুগল দিয়ে চালিয়ে যান'}</span>
                </button>

                <div className="flex items-center space-x-4 py-2">
                  <div className="flex-1 h-[1px] bg-gray-100"></div>
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{lang === 'en' ? 'Or use email' : 'অথবা ইমেইল ব্যবহার করুন'}</span>
                  <div className="flex-1 h-[1px] bg-gray-100"></div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {mode === 'signup' && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{lang === 'en' ? 'Full Name' : 'পুরো নাম'}</label>
                      <div className="relative group">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-green-600 transition-colors" />
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full bg-gray-50 border-2 border-transparent focus:border-green-600 focus:bg-white rounded-2xl py-3.5 pl-12 pr-4 transition-all outline-none font-bold"
                          placeholder="John Doe"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{lang === 'en' ? 'Email Address' : 'ইমেইল ঠিকানা'}</label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-green-600 transition-colors" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-gray-50 border-2 border-transparent focus:border-green-600 focus:bg-white rounded-2xl py-3.5 pl-12 pr-4 transition-all outline-none font-bold"
                        placeholder="you@email.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{lang === 'en' ? 'Secure Password' : 'পাসওয়ার্ড'}</label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-green-600 transition-colors" />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-gray-50 border-2 border-transparent focus:border-green-600 focus:bg-white rounded-2xl py-3.5 pl-12 pr-4 transition-all outline-none font-bold"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={loading}
                    type="submit"
                    className="w-full bg-green-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-green-900/10 hover:bg-green-700 transition-all flex items-center justify-center space-x-2 text-sm uppercase tracking-widest mt-6 disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <LogIn className="w-4 h-4" />
                        <span>{mode === 'login' ? (lang === 'en' ? 'Sign In' : 'সাইন ইন') : (lang === 'en' ? 'Create Account' : 'অ্যাকাউন্ট তৈরি করুন')}</span>
                      </>
                    )}
                  </motion.button>
                </form>
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                  className="text-xs font-bold text-gray-500 hover:text-green-600 transition-colors group"
                >
                  {mode === 'login' ? (
                    <>
                      {lang === 'en' ? "Don't have an account?" : "অ্যাকাউন্ট নেই?"} <span className="text-green-600 underline underline-offset-2">{lang === 'en' ? 'Sign Up' : 'সাইন আপ'}</span>
                    </>
                  ) : (
                    <>
                      {lang === 'en' ? 'Already have an account?' : 'অ্যাকাউন্ট আছে?'} <span className="text-green-600 underline underline-offset-2">{lang === 'en' ? 'Log In' : 'লগ ইন'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
