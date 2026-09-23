import React, { useState, useEffect } from 'react';
import { Database, RefreshCw, CheckCircle2, Wifi, WifiOff, Clock, HardDrive, Check, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { 
  getCacheSummary, 
  forceRefreshLocalCaches, 
  formatExactSyncTime, 
  formatCacheAge,
  CacheSummary 
} from '../utils/offlineCache';
import { Language } from '../utils/translations';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

interface Props {
  lang: Language;
  className?: string;
  compact?: boolean;
  onRefreshCompleted?: () => void;
}

export const DataStatusCard: React.FC<Props> = ({ 
  lang, 
  className = '', 
  compact = false,
  onRefreshCompleted 
}) => {
  const isOnline = useNetworkStatus();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [justRefreshed, setJustRefreshed] = useState(false);
  const [summary, setSummary] = useState<CacheSummary>({
    lastSyncTimestamp: null,
    weatherEntriesCount: 0,
    marketEntriesCount: 0,
    totalEntries: 0,
    estimatedSizeKb: 0,
    isOnline: true,
    hasServiceWorkerCache: false
  });

  const loadSummary = async () => {
    const data = await getCacheSummary();
    setSummary(data);
  };

  useEffect(() => {
    loadSummary();

    const interval = setInterval(loadSummary, 15000);
    const handleSyncEvent = () => loadSummary();
    
    window.addEventListener('agri:force-refresh-cache', handleSyncEvent);
    window.addEventListener('storage', handleSyncEvent);

    return () => {
      clearInterval(interval);
      window.removeEventListener('agri:force-refresh-cache', handleSyncEvent);
      window.removeEventListener('storage', handleSyncEvent);
    };
  }, []);

  const handleForceRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setJustRefreshed(false);

    try {
      const result = await forceRefreshLocalCaches();
      // Allow brief animation cycle
      await new Promise(res => setTimeout(res, 600));
      await loadSummary();

      setJustRefreshed(true);
      setTimeout(() => setJustRefreshed(false), 2500);

      if (isOnline) {
        toast.success(
          lang === 'bn' 
            ? 'ক্যাশ রিফ্রেশ সম্পন্ন! নতুন লাইভ তথ্য সিঙ্ক হচ্ছে।' 
            : 'Local cache cleared. Fresh data is re-syncing from network.',
          { id: 'cache-refresh-success', duration: 3000 }
        );
      } else {
        toast(
          lang === 'bn' 
            ? 'অফলাইন মোড: কক্সবাজার সংরক্ষিত ডাটাবেজ পুনঃস্থাপিত হয়েছে।' 
            : 'Offline mode: Preserved Cox\'s Bazar local cache reset.',
          { icon: '💾', id: 'cache-refresh-offline', duration: 3500 }
        );
      }

      if (onRefreshCompleted) {
        onRefreshCompleted();
      }
    } catch (err) {
      console.error('Failed to force refresh local cache:', err);
      toast.error(lang === 'bn' ? 'ক্যাশ রিফ্রেশ করতে সমস্যা হয়েছে' : 'Failed to refresh local cache');
    } finally {
      setIsRefreshing(false);
    }
  };

  const syncTimeFormatted = formatExactSyncTime(summary.lastSyncTimestamp, lang);
  const relativeAge = summary.lastSyncTimestamp ? formatCacheAge(summary.lastSyncTimestamp, lang) : null;

  if (compact) {
    return (
      <div 
        id="data-status-card-compact"
        className={`rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-stone-50/90 dark:bg-stone-900/90 p-3 shadow-2xs ${className}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2 min-w-0">
            <span className={`w-2 h-2 rounded-full shrink-0 ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <div className="min-w-0 truncate">
              <span className="text-[11px] font-bold text-stone-900 dark:text-stone-100 block truncate">
                {lang === 'bn' ? 'তথ্য সিঙ্ক স্ট্যাটাস' : 'Data Status'}
              </span>
              <span className="text-[10px] text-stone-500 dark:text-stone-400 block truncate">
                {relativeAge || (lang === 'bn' ? 'সিঙ্ক সক্রিয়' : 'Sync Active')}
              </span>
            </div>
          </div>

          <button
            type="button"
            id="force-refresh-btn-compact"
            onClick={handleForceRefresh}
            disabled={isRefreshing}
            className={`inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-[10.5px] font-semibold transition-all cursor-pointer ${
              justRefreshed
                ? 'bg-emerald-700 text-white dark:bg-emerald-600'
                : 'bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-700 active:scale-95'
            }`}
            title={lang === 'bn' ? 'ক্যাশ রিফ্রেশ করুন' : 'Force Refresh Cache'}
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-emerald-600 dark:text-emerald-400' : ''}`} />
            <span>
              {isRefreshing 
                ? (lang === 'bn' ? 'সিঙ্ক...' : 'Syncing...') 
                : justRefreshed 
                  ? (lang === 'bn' ? 'হালনাগাদ!' : 'Updated!') 
                  : (lang === 'bn' ? 'রিফ্রেশ' : 'Refresh')}
            </span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      id="data-status-card"
      className={`rounded-2xl border border-stone-200/90 dark:border-stone-800/90 bg-white dark:bg-stone-900/95 p-4 shadow-sm text-stone-900 dark:text-stone-100 ${className}`}
    >
      {/* Top Row: Title, Live indicator & Connectivity */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200/60 dark:border-stone-700/60 shrink-0">
            <Database className="w-4 h-4 text-emerald-800 dark:text-emerald-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-1.5">
              <h4 className="text-xs sm:text-sm font-bold tracking-tight text-stone-900 dark:text-stone-100 truncate">
                {lang === 'bn' ? 'তথ্য সিঙ্ক ও লোকাল ক্যাশ' : 'Data Status & Cache'}
              </h4>
            </div>
            <p className="text-[10.5px] text-stone-500 dark:text-stone-400 truncate">
              {lang === 'bn' ? 'অফলাইন সহনশীল কৃষি মেমরি' : 'Offline-Resilient Farm Storage'}
            </p>
          </div>
        </div>

        {/* Network & Persistence Status Badge */}
        <div className="flex items-center space-x-1.5 shrink-0">
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
            isOnline 
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800'
              : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200/80 dark:border-amber-800'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            {isOnline 
              ? (lang === 'bn' ? 'অনলাইন' : 'Live Online') 
              : (lang === 'bn' ? 'অফলাইন মোড' : 'Offline Cache')}
          </span>
        </div>
      </div>

      {/* Sync Details Grid */}
      <div className="rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/70 dark:border-stone-700/60 p-3 mb-3 space-y-2">
        {/* Last Sync Row */}
        <div className="flex items-start justify-between gap-2 text-xs">
          <div className="flex items-center space-x-1.5 text-stone-500 dark:text-stone-400 shrink-0">
            <Clock className="w-3.5 h-3.5 text-stone-400 dark:text-stone-500" />
            <span>{lang === 'bn' ? 'সর্বশেষ সফল সিঙ্ক' : 'Last Sync'}:</span>
          </div>
          <div className="text-right min-w-0">
            <div className="font-semibold text-stone-800 dark:text-stone-200 tabular-nums truncate text-[11.5px]">
              {syncTimeFormatted}
            </div>
            {relativeAge && (
              <div className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5">
                {relativeAge}
              </div>
            )}
          </div>
        </div>

        {/* Cache Payload Row */}
        <div className="flex items-center justify-between gap-2 text-xs pt-2 border-t border-stone-200/60 dark:border-stone-700/50">
          <div className="flex items-center space-x-1.5 text-stone-500 dark:text-stone-400 shrink-0">
            <HardDrive className="w-3.5 h-3.5 text-stone-400 dark:text-stone-500" />
            <span>{lang === 'bn' ? 'সংরক্ষিত ক্যাশ' : 'Local Storage'}:</span>
          </div>
          <div className="text-right text-[11px] font-medium text-stone-700 dark:text-stone-300">
            <span>
              {summary.totalEntries > 0 
                ? (lang === 'bn' 
                    ? `আবহাওয়া ও আড়ৎ (${summary.totalEntries} রেকর্ড • ~${summary.estimatedSizeKb} KB)` 
                    : `Weather & Mandi (${summary.totalEntries} items • ~${summary.estimatedSizeKb} KB)`)
                : (lang === 'bn' ? 'কক্সবাজার ডিফল্ট মডেল প্রস্তুত' : 'Cox\'s Bazar model active')}
            </span>
          </div>
        </div>
      </div>

      {/* Actions: Force Refresh */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10.5px] text-stone-500 dark:text-stone-400">
          {lang === 'bn' ? 'স্থানীয় মেমরি শূন্য করে রি-সিঙ্ক করুন' : 'Flush and re-query network data'}
        </span>

        <button
          type="button"
          id="force-refresh-btn"
          onClick={handleForceRefresh}
          disabled={isRefreshing}
          className={`inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            justRefreshed
              ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
              : 'bg-emerald-900 hover:bg-emerald-800 text-white dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white active:scale-95 shadow-2xs'
          } disabled:opacity-70 disabled:cursor-not-allowed`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>
            {isRefreshing 
              ? (lang === 'bn' ? 'সিঙ্ক হচ্ছে...' : 'Syncing...') 
              : justRefreshed 
                ? (lang === 'bn' ? 'সফল হয়েছে!' : 'Refreshed!') 
                : (lang === 'bn' ? 'ফোর্স রিফ্রেশ' : 'Force Refresh')}
          </span>
        </button>
      </div>
    </div>
  );
};
