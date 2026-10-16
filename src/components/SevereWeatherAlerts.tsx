import React, { useState } from 'react';
import { AlertTriangle, AlertOctagon, Info, ShieldAlert, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Language } from '../utils/translations';

export interface WeatherAlertItem {
  id: string;
  event: string;
  severity: 'minor' | 'moderate' | 'severe' | 'extreme';
  headline: string;
  description: string;
  effective: string;
  expires: string;
  agroImpact: string;
  dataSource?: {
    name: string;
    authorityUri: string;
  };
}

interface Props {
  alerts: WeatherAlertItem[];
  lang: Language;
}

export default function SevereWeatherAlerts({ alerts, lang }: Props) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedAlertIndex, setSelectedAlertIndex] = useState(0);

  if (!alerts || alerts.length === 0) {
    return null;
  }

  const activeAlert = alerts[selectedAlertIndex] || alerts[0];

  const getSeverityStyle = (sev: string) => {
    switch (sev.toLowerCase()) {
      case 'extreme':
        return {
          bg: 'bg-rose-950/40 border-rose-600/40 text-rose-200',
          badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          icon: <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0" />,
          accent: 'text-rose-400'
        };
      case 'severe':
        return {
          bg: 'bg-amber-950/40 border-amber-500/40 text-amber-200',
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
          accent: 'text-amber-400'
        };
      case 'moderate':
        return {
          bg: 'bg-yellow-950/30 border-yellow-500/30 text-yellow-200',
          badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
          icon: <ShieldAlert className="w-5 h-5 text-yellow-400 shrink-0" />,
          accent: 'text-yellow-400'
        };
      default:
        return {
          bg: 'bg-blue-950/30 border-blue-500/30 text-blue-200',
          badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
          icon: <Info className="w-5 h-5 text-blue-400 shrink-0" />,
          accent: 'text-blue-400'
        };
    }
  };

  const currentStyle = getSeverityStyle(activeAlert.severity);

  const formatAlertTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' });
    } catch {
      return isoString;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border p-4 sm:p-5 transition-all shadow-sm ${currentStyle.bg} backdrop-blur-xs`}
    >
      {/* Alert Header Ribbon */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2 rounded-xl bg-black/20 shrink-0">
            {currentStyle.icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[11px] font-black tracking-wider uppercase px-2 py-0.5 rounded-md border ${currentStyle.badge}`}>
                {activeAlert.severity} {lang === 'bn' ? 'সতর্কতা' : 'ALERT'}
              </span>
              <span className="text-[11px] text-stone-400 font-mono tabular-nums">
                {lang === 'bn' ? 'মেয়াদ শেষ:' : 'Expires:'} {formatAlertTime(activeAlert.expires)}
              </span>
              {alerts.length > 1 && (
                <span className="text-[11px] text-stone-400 font-mono">
                  ({selectedAlertIndex + 1}/{alerts.length})
                </span>
              )}
            </div>
            <h4 className="text-sm sm:text-base font-bold text-white mt-1 leading-snug">
              {activeAlert.event}
            </h4>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {alerts.length > 1 && (
            <div className="flex items-center gap-1 mr-1">
              {alerts.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedAlertIndex(idx)}
                  className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                    selectedAlertIndex === idx ? 'bg-white w-4' : 'bg-stone-600 hover:bg-stone-500'
                  }`}
                  aria-label={`View Alert ${idx + 1}`}
                />
              ))}
            </div>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg bg-black/20 hover:bg-black/30 text-stone-300 transition-colors cursor-pointer"
            aria-label="Toggle Alert Details"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Alert Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 pt-3 border-t border-white/10 space-y-3 text-xs sm:text-sm text-stone-200"
          >
            {activeAlert.headline && activeAlert.headline !== activeAlert.event && (
              <p className="font-semibold text-white/90">
                {activeAlert.headline}
              </p>
            )}

            <p className="text-stone-300 leading-relaxed text-xs sm:text-sm">
              {activeAlert.description}
            </p>

            {/* Farm Action Impact Guidance */}
            <div className="bg-black/25 rounded-xl p-3 border border-white/10">
              <div className="flex items-center gap-1.5 text-emerald-300 font-bold text-xs uppercase tracking-wider mb-1">
                <span>🌾</span>
                <span>{lang === 'bn' ? 'ফসলি করণীয় ও কৃষকের প্রস্তুতি' : 'Agricultural Action & Crop Protection'}</span>
              </div>
              <p className="text-stone-200 text-xs leading-relaxed">
                {activeAlert.agroImpact}
              </p>
            </div>

            {/* Mandatory Attribution Requirements */}
            <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-stone-400 gap-1 border-t border-white/5">
              <div className="flex items-center gap-1">
                <span>{lang === 'bn' ? 'তথ্য উৎস:' : 'Data Source:'}</span>
                {activeAlert.dataSource ? (
                  <a
                    href={activeAlert.dataSource.authorityUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 underline inline-flex items-center gap-0.5"
                  >
                    <span>{activeAlert.dataSource.name}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span>Google Maps Platform Weather Alerts</span>
                )}
              </div>
              <div className="font-mono text-[10px] text-stone-400">
                Google Maps
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
