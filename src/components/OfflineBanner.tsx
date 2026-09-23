import React from 'react';
import { WifiOff, Database } from 'lucide-react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { Language } from '../utils/translations';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  lang: Language;
}

export default function OfflineBanner({ lang }: Props) {
  const isOnline = useNetworkStatus();

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          className="bg-stone-900 text-stone-100 border-b border-stone-700/80 px-4 py-2 flex flex-wrap items-center justify-center gap-2 fixed top-0 left-0 right-0 z-50 shadow-md backdrop-blur-xs text-xs font-medium"
        >
          <div className="flex items-center space-x-1.5 text-amber-400 font-semibold">
            <WifiOff className="w-4 h-4" />
            <span>{lang === 'bn' ? 'অফলাইন মোড' : 'Offline Mode'}</span>
          </div>
          <span className="hidden sm:inline text-stone-500">•</span>
          <div className="flex items-center space-x-1.5 text-stone-200">
            <Database className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              {lang === 'bn' 
                ? "কক্সবাজার ও স্থানীয় অঞ্চলের সংরক্ষিত আবহাওয়া ও আড়ৎ বাজারদর ক্যাশ থেকে সচল রয়েছে।"
                : "Preserved Cox's Bazar weather advisory and mandi rates are active from offline cache."}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

