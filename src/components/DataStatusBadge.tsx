import React from 'react';
import { 
  Eye, 
  CloudSun, 
  BrainCircuit, 
  Database, 
  PlayCircle, 
  HelpCircle,
  Clock,
  MapPin,
  ExternalLink
} from 'lucide-react';
import { Language } from '../utils/translations';

export type DataStatus = 
  | 'observed'       // Direct sensor or validated recorded observation
  | 'forecast'       // Numerical meteorological forecast (e.g., BMD, Open-Meteo)
  | 'ai_estimate'    // Model inference / derived calculation
  | 'cached'         // Stored locally from a previous session
  | 'demo'           // Illustrative simulation / scenario
  | 'unavailable';   // Missing / not measured

export interface DataStatusBadgeProps {
  status: DataStatus;
  lang?: Language;
  source?: string;
  timestamp?: string;
  cacheAge?: string;
  location?: string;
  compact?: boolean;
  className?: string;
}

export default function DataStatusBadge({
  status,
  lang = 'en',
  source,
  timestamp,
  cacheAge,
  location,
  compact = false,
  className = ''
}: DataStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'observed':
        return {
          labelEn: 'Observed',
          labelBn: 'সরাসরি পর্যবেক্ষিত',
          icon: Eye,
          bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
          themed: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30'
        };
      case 'forecast':
        return {
          labelEn: 'Forecast',
          labelBn: 'পূর্বাভাস মডেল',
          icon: CloudSun,
          bg: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
          themed: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-400 dark:border-sky-500/30'
        };
      case 'ai_estimate':
        return {
          labelEn: 'AI Estimate',
          labelBn: 'এআই অনুমান (অনির্ধারিত)',
          icon: BrainCircuit,
          bg: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
          themed: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30'
        };
      case 'cached':
        return {
          labelEn: 'Cached Data',
          labelBn: 'সংরক্ষিত ক্যাশ',
          icon: Database,
          bg: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
          themed: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30'
        };
      case 'demo':
        return {
          labelEn: 'Simulation / Demo',
          labelBn: 'সিমুলেশন মডেল',
          icon: PlayCircle,
          bg: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
          themed: 'bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-500/30'
        };
      case 'unavailable':
      default:
        return {
          labelEn: 'Unavailable',
          labelBn: 'অপ্রাপ্য',
          icon: HelpCircle,
          bg: 'bg-stone-500/15 text-stone-400 border-stone-500/30',
          themed: 'bg-stone-100 text-stone-600 border-stone-200 dark:bg-stone-500/15 dark:text-stone-400 dark:border-stone-500/30'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;
  const label = lang === 'bn' ? config.labelBn : config.labelEn;

  if (compact) {
    return (
      <span 
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border tracking-wider ${config.bg} ${className}`}
        title={`${label}${source ? ` • ${source}` : ''}${cacheAge ? ` • ${cacheAge}` : ''}`}
      >
        <Icon className="w-3 h-3 shrink-0" />
        <span>{label}</span>
      </span>
    );
  }

  return (
    <div className={`inline-flex flex-wrap items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-medium border ${config.themed} ${className}`}>
      <div className="flex items-center gap-1 font-mono font-bold uppercase tracking-wider">
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span>{label}</span>
      </div>

      {source && (
        <>
          <span aria-hidden="true" className="opacity-40">•</span>
          <span>{source}</span>
        </>
      )}

      {cacheAge && (
        <>
          <span aria-hidden="true" className="opacity-40">•</span>
          <span className="flex items-center gap-0.5 font-mono text-[10px]">
            <Clock className="w-2.5 h-2.5" />
            {cacheAge}
          </span>
        </>
      )}

      {timestamp && !cacheAge && (
        <>
          <span aria-hidden="true" className="opacity-40">•</span>
          <span className="text-[10px]">{timestamp}</span>
        </>
      )}

      {location && (
        <>
          <span aria-hidden="true" className="opacity-40">•</span>
          <span className="flex items-center gap-0.5 text-[10px]">
            <MapPin className="w-2.5 h-2.5" />
            {location}
          </span>
        </>
      )}
    </div>
  );
}
