import React from 'react';
import { MapPin, Navigation, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useLocationName } from '../hooks/useLocationName';
import { translations, Language } from '../utils/translations';

interface Props {
  coords: { latitude: number; longitude: number };
  lang: Language;
  color: 'green' | 'orange' | 'blue' | 'indigo' | 'emerald';
  accuracy?: number;
  isManual?: boolean;
}

export default function LocationDisplay({ coords, lang, color, accuracy, isManual }: Props) {
  const { locationName, isLoading } = useLocationName(coords, lang);
  const t = translations[lang];

  const colorStyles = {
    green: 'bg-green-50/90 border-green-200 text-green-900',
    orange: 'bg-orange-50/90 border-orange-200 text-orange-900',
    emerald: 'bg-emerald-50/90 border-emerald-200 text-emerald-900',
    blue: 'bg-blue-50/90 border-blue-200 text-blue-900',
    indigo: 'bg-indigo-50/90 border-indigo-200 text-indigo-900',
  };

  const iconColors = {
    green: 'text-green-600',
    orange: 'text-orange-600',
    emerald: 'text-emerald-600',
    blue: 'text-blue-600',
    indigo: 'text-indigo-600',
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mt-4 p-4 rounded-2xl border ${colorStyles[color]} flex items-start space-x-3.5 shadow-sm`}
    >
      <div className={`p-2.5 bg-white rounded-2xl shadow-sm shrink-0 ${iconColors[color]}`}>
        <MapPin className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-75">
            {isManual 
              ? (lang === 'bn' ? 'নির্বাচিত এলাকা' : 'Selected Region')
              : (t.locationDetected || "Location Detected")}
          </p>
          {accuracy ? (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-white/80 border border-black/5 opacity-80">
              {lang === 'bn' ? `নির্ভুলতা: ±${accuracy}মি` : `Accuracy: ±${accuracy}m`}
            </span>
          ) : isManual ? (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-white/80 border border-black/5 opacity-80">
              {lang === 'bn' ? 'ম্যানুয়াল সেট' : 'Manual'}
            </span>
          ) : null}
        </div>
        <div className="flex items-center">
          {isLoading ? (
            <div className="flex items-center space-x-2 text-sm font-bold">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{lang === 'bn' ? 'লোকেশন খোঁজা হচ্ছে...' : 'Loading location name...'}</span>
            </div>
          ) : (
            <p className="text-base sm:text-lg font-black tracking-tight truncate" title={locationName || ''}>
              {locationName}
            </p>
          )}
        </div>
        <div className="flex items-center mt-1 opacity-60 text-[11px] font-mono font-bold">
          <Navigation className="w-3 h-3 mr-1.5 shrink-0" />
          <span>{coords.latitude.toFixed(4)}° N, {coords.longitude.toFixed(4)}° E</span>
        </div>
      </div>
    </motion.div>
  );
}
