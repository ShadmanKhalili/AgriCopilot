import React from 'react';
import { WifiOff, Database } from 'lucide-react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { Language } from '../utils/translations';

interface Props {
  lang: Language;
}

export const OfflineIndicator: React.FC<Props> = ({ lang }) => {
  const isOnline = useNetworkStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center space-x-2.5 rounded-xl bg-stone-900/95 dark:bg-stone-800/95 text-stone-100 border border-stone-700/80 px-3.5 py-2 text-xs shadow-lg backdrop-blur-xs">
      <div className="flex items-center space-x-1.5 text-amber-400">
        <WifiOff className="w-4 h-4" />
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
      </div>
      <div className="flex items-center space-x-1.5 text-[11px] text-stone-200">
        <Database className="w-3.5 h-3.5 text-emerald-400" />
        <span>
          {lang === 'bn' 
            ? 'অফলাইন মোড সক্রিয় — স্থানীয় ও কক্সবাজার সংরক্ষিত আবহাওয়া ও আড়ৎ ক্যাশ ব্যবহৃত হচ্ছে' 
            : "Offline Mode Active — Using cached Cox's Bazar weather & mandi data"}
        </span>
      </div>
    </div>
  );
};
