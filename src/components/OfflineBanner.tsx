import React from 'react';
import { WifiOff } from 'lucide-react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { translations, Language } from '../utils/translations';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  lang: Language;
}

export default function OfflineBanner({ lang }: Props) {
  const isOnline = useNetworkStatus();
  const t = translations[lang];

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className="bg-red-500 text-white px-4 py-2 flex items-center justify-center space-x-2 fixed top-0 left-0 right-0 z-50 shadow-md"
        >
          <WifiOff className="w-5 h-5" />
          <span className="text-sm font-medium">
            {lang === 'bn' 
              ? 'আপনি অফলাইনে আছেন। কিছু এআই ফিচার ইন্টারনেট ছাড়া কাজ করবে না। দয়া করে ছবি তুলে রাখুন, নেটওয়ার্ক পেলে পুনরায় চেষ্টা করুন।'
              : 'You are currently offline. Please take a photo with your camera now, and upload it to AgriCopilot when you return to internet access.'}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
