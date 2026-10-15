import React, { useState, useEffect } from 'react';
import { WifiOff, Database, AlertCircle } from 'lucide-react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { Language } from '../utils/translations';
import { motion, AnimatePresence } from 'motion/react';
import { getCacheSummary, formatCacheAge, CacheSummary } from '../utils/offlineCache';

interface Props {
  lang: Language;
}

export default function OfflineBanner({ lang }: Props) {
  const isOnline = useNetworkStatus();
  const [cacheSummary, setCacheSummary] = useState<CacheSummary | null>(null);

  useEffect(() => {
    if (!isOnline) {
      getCacheSummary().then(setCacheSummary);
    }
  }, [isOnline]);

  const hasCache = (cacheSummary?.totalEntries || 0) > 0;
  const cacheAgeStr = cacheSummary?.lastSyncTimestamp 
    ? formatCacheAge(cacheSummary.lastSyncTimestamp, lang)
    : null;

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
          
          {hasCache ? (
            <div className="flex items-center space-x-1.5 text-stone-200">
              <Database className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                {lang === 'bn' 
                  ? `স্থানীয় ক্যাশ সচল (${cacheSummary?.weatherEntriesCount || 0} আবহাওয়া, ${cacheSummary?.marketEntriesCount || 0} বাজারদর${cacheAgeStr ? ` • বয়স: ${cacheAgeStr}` : ''})`
                  : `Local cache active (${cacheSummary?.weatherEntriesCount || 0} weather, ${cacheSummary?.marketEntriesCount || 0} mandi${cacheAgeStr ? ` • age: ${cacheAgeStr}` : ''})`}
              </span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 text-amber-200">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>
                {lang === 'bn' 
                  ? 'কোনো সংরক্ষিত ক্যাশ রেকর্ড নেই। জরুরি অফলাইন নির্দেশিকা সক্রিয়।'
                  : 'No cached local records found. Emergency static reference guide active.'}
              </span>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

