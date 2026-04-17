import React from 'react';
import { MapPin, Navigation, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useLocationName } from '../hooks/useLocationName';
import { translations, Language } from '../utils/translations';

interface Props {
  coords: { latitude: number; longitude: number };
  lang: Language;
  color: 'green' | 'orange' | 'blue' | 'indigo' | 'emerald';
}

export default function LocationDisplay({ coords, lang, color }: Props) {
  const { locationName, isLoading } = useLocationName(coords, lang);
  const t = translations[lang];

  const colorStyles = {
    green: 'bg-green-50 border-green-200 text-green-800',
    orange: 'bg-orange-50 border-orange-200 text-orange-800',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-800',
  };

  const iconColors = {
    green: 'text-green-600',
    orange: 'text-orange-600',
    blue: 'text-blue-600',
    indigo: 'text-indigo-600',
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mt-4 p-4 rounded-2xl border ${colorStyles[color]} flex items-start space-x-4 shadow-sm`}
    >
      <div className={`p-2.5 bg-white rounded-full shadow-sm shrink-0 ${iconColors[color]}`}>
        <MapPin className="w-6 h-6" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black uppercase tracking-widest opacity-70 mb-1">
          {t.locationDetected || "Location Detected"}
        </p>
        <div className="flex items-center">
          {isLoading ? (
            <div className="flex items-center space-x-2 text-sm font-bold">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{lang === 'bn' ? 'লোকেশন খোঁজা হচ্ছে...' : 'Loading location name...'}</span>
            </div>
          ) : (
            <p className="text-lg font-bold truncate" title={locationName || ''}>
              {locationName}
            </p>
          )}
        </div>
        <div className="flex items-center mt-1.5 opacity-60 text-[11px] font-mono font-bold">
          <Navigation className="w-3 h-3 mr-1.5" />
          {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
        </div>
      </div>
    </motion.div>
  );
}
