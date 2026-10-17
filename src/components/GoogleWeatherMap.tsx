import React, { useState } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { MapPin, Layers, Satellite, Sun, CloudRain } from 'lucide-react';
import { Language } from '../utils/translations';

interface Props {
  coords: { latitude: number; longitude: number };
  temp?: number;
  condition?: string;
  rainChance?: number;
  lang: Language;
}

export default function GoogleWeatherMap({ coords, temp, condition, rainChance, lang }: Props) {
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'hybrid'>('hybrid');
  const apiKey = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || '';

  if (!apiKey) {
    return null;
  }

  const center = { lat: coords.latitude, lng: coords.longitude };

  return (
    <div className="bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 rounded-2xl p-3 sm:p-4 shadow-xs overflow-hidden">
      <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-stone-100 dark:border-stone-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-lg">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100">
              {lang === 'bn' ? 'গুগল ম্যাপে খামার ও মাইক্রোক্লাইমেট অবস্থান' : 'Farm & Microclimate Location Map'}
            </h4>
            <span className="text-[11px] text-stone-400 font-mono">
              Google Maps Platform · {coords.latitude.toFixed(4)}°N, {coords.longitude.toFixed(4)}°E
            </span>
          </div>
        </div>

        {/* Map Type Toggle */}
        <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800 p-0.5 rounded-lg text-[11px] font-mono">
          <button
            type="button"
            onClick={() => setMapType('hybrid')}
            className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
              mapType === 'hybrid' ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white font-bold shadow-xs' : 'text-stone-500'
            }`}
          >
            {lang === 'bn' ? 'স্যাটেলাইট' : 'Satellite'}
          </button>
          <button
            type="button"
            onClick={() => setMapType('roadmap')}
            className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
              mapType === 'roadmap' ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white font-bold shadow-xs' : 'text-stone-500'
            }`}
          >
            {lang === 'bn' ? 'ম্যাপ' : 'Map'}
          </button>
        </div>
      </div>

      <div className="w-full h-56 sm:h-64 rounded-xl overflow-hidden border border-stone-200/70 dark:border-stone-800 relative">
        <APIProvider apiKey={apiKey}>
          <Map
            defaultCenter={center}
            defaultZoom={13}
            mapTypeId={mapType}
            mapId="DEMO_MAP_ID"
            gestureHandling="greedy"
            disableDefaultUI={false}
            internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
            className="w-full h-full"
          >
            <AdvancedMarker position={center} title="Farm Location">
              <Pin
                background="#059669"
                glyphColor="#ffffff"
                borderColor="#047857"
                scale={1.2}
              />
            </AdvancedMarker>
          </Map>
        </APIProvider>

        {/* Live Weather Overlay Chip */}
        {temp !== undefined && (
          <div className="absolute top-2 left-2 z-10 bg-stone-950/85 backdrop-blur-xs text-white px-2.5 py-1.5 rounded-xl border border-white/10 shadow-lg text-xs font-mono flex items-center gap-2">
            <span className="font-bold text-emerald-400">{temp.toFixed(1)}°C</span>
            {condition && <span className="text-stone-300 font-sans">{condition}</span>}
            {rainChance !== undefined && (
              <span className="text-cyan-400 inline-flex items-center gap-0.5">
                <CloudRain className="w-3 h-3" />
                {rainChance}%
              </span>
            )}
          </div>
        )}
      </div>

      <div className="mt-2 text-right">
        <span className="text-[11px] text-stone-400 font-mono">
          Google Maps
        </span>
      </div>
    </div>
  );
}
