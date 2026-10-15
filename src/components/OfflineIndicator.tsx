import React, { useState, useEffect } from 'react';
import { WifiOff, Database } from 'lucide-react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { Language } from '../utils/translations';
import { getCacheSummary, formatCacheAge } from '../utils/offlineCache';

interface Props {
  lang: Language;
}

export const OfflineIndicator: React.FC<Props> = ({ lang }) => {
  const isOnline = useNetworkStatus();
  const [cachedEntriesCount, setCachedEntriesCount] = useState<number | null>(null);
  const [cacheAge, setCacheAge] = useState<string | null>(null);

  useEffect(() => {
    if (!isOnline) {
      getCacheSummary().then(summary => {
        setCachedEntriesCount(summary.totalEntries);
        if (summary.lastSyncTimestamp) {
          setCacheAge(formatCacheAge(summary.lastSyncTimestamp, lang));
        }
      });
    }
  }, [isOnline, lang]);

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
          {cachedEntriesCount && cachedEntriesCount > 0
            ? (lang === 'bn' 
                ? `অফলাইন মোড — সংরক্ষিত ক্যাশ সচল (${cachedEntriesCount}টি রেকর্ড${cacheAge ? `, বয়স: ${cacheAge}` : ''})` 
                : `Offline Mode — Using local cache (${cachedEntriesCount} records${cacheAge ? `, age: ${cacheAge}` : ''})`)
            : (lang === 'bn'
                ? 'অফলাইন মোড — কোনো স্থানীয় ক্যাশ নেই, জরুরি রেফারেন্স সক্রিয়'
                : 'Offline Mode — No local cache found, static reference active')}
        </span>
      </div>
    </div>
  );
};
