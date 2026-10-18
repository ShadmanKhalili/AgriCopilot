import React, { useState, Component, ErrorInfo, ReactNode } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { MapPin, Layers, Satellite, Sun, CloudRain, Plus, Minus, RotateCcw, ExternalLink, ShieldCheck, Compass } from 'lucide-react';
import { Language } from '../utils/translations';

interface Props {
  coords: { latitude: number; longitude: number };
  temp?: number;
  condition?: string;
  rainChance?: number;
  lang: Language;
}

// Lightweight Error Boundary to catch any Google Maps script or marker exceptions safely
interface ErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
  onError?: (error: Error) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class GoogleMapsErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn("Google Maps render failed, engaging GIS fallback:", error, errorInfo);
    if (this.props.onError) {
      this.props.onError(error);
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export default function GoogleWeatherMap({ coords, temp, condition, rainChance, lang }: Props) {
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'hybrid'>('hybrid');
  const [zoomLevel, setZoomLevel] = useState<number>(14);
  const [hasGoogleError, setHasGoogleError] = useState(false);
  const apiKey = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || '';

  // Calculate bounding box for OpenStreetMap fallback based on zoom level
  const zoomFactor = Math.pow(2, 14 - zoomLevel);
  const deltaLat = 0.015 * zoomFactor;
  const deltaLng = 0.025 * zoomFactor;
  const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${(coords.longitude - deltaLng).toFixed(5)}%2C${(coords.latitude - deltaLat).toFixed(5)}%2C${(coords.longitude + deltaLng).toFixed(5)}%2C${(coords.latitude + deltaLat).toFixed(5)}&layer=mapnik&marker=${coords.latitude.toFixed(5)}%2C${coords.longitude.toFixed(5)}`;

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(18, prev + 1));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(9, prev - 1));
  };

  const handleResetZoom = () => {
    setZoomLevel(14);
  };

  // Weather overlay component shared across both Google Maps and GIS fallback
  const renderWeatherChip = () => {
    if (temp === undefined) return null;
    return (
      <div className="absolute top-2.5 left-2.5 z-10 bg-stone-950/85 backdrop-blur-md text-white px-3 py-1.5 rounded-xl border border-white/15 shadow-lg text-xs font-mono flex items-center gap-2.5 select-none">
        <span className="font-bold text-emerald-400 text-sm">{temp.toFixed(1)}°C</span>
        {condition && (
          <span className="text-stone-300 font-sans border-l border-white/20 pl-2">
            {condition}
          </span>
        )}
        {rainChance !== undefined && (
          <span className="text-cyan-400 inline-flex items-center gap-1 border-l border-white/20 pl-2">
            <CloudRain className="w-3.5 h-3.5" />
            {rainChance}%
          </span>
        )}
      </div>
    );
  };

  // Resilient OpenStreetMap Fallback View
  const renderOsmFallback = () => (
    <div className="relative w-full h-64 sm:h-72 rounded-xl overflow-hidden border border-stone-200/80 dark:border-stone-800 bg-stone-100 dark:bg-stone-950">
      <iframe
        title="OpenStreetMap Microclimate Farm View"
        src={osmEmbedUrl}
        className="w-full h-full border-0"
        loading="lazy"
        sandbox="allow-scripts allow-same-origin"
      />

      {/* Weather Overlay */}
      {renderWeatherChip()}

      {/* Floating Interactive Zoom & Reset Controls */}
      <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1 bg-white/90 dark:bg-stone-900/90 backdrop-blur-md rounded-xl p-1 border border-stone-200/80 dark:border-stone-700 shadow-md">
        <button
          type="button"
          onClick={handleZoomIn}
          aria-label={lang === 'bn' ? 'জুম ইন' : 'Zoom in'}
          className="w-8 h-8 flex items-center justify-center text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          aria-label={lang === 'bn' ? 'জুম আউট' : 'Zoom out'}
          className="w-8 h-8 flex items-center justify-center text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleResetZoom}
          aria-label={lang === 'bn' ? 'রিসেট' : 'Reset view'}
          title={lang === 'bn' ? 'মূল অবস্থানে রিসেট' : 'Reset to farm'}
          className="w-8 h-8 flex items-center justify-center text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors cursor-pointer border-t border-stone-200/60 dark:border-stone-800"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Live Coordinate Pin Badge at bottom-left */}
      <div className="absolute bottom-3 left-3 z-10 bg-stone-950/80 backdrop-blur-xs text-white/90 px-2.5 py-1 rounded-lg text-[10px] font-mono border border-white/10 flex items-center gap-1.5">
        <Compass className="w-3 h-3 text-emerald-400 animate-pulse" />
        <span>GPS: {coords.latitude.toFixed(4)}°, {coords.longitude.toFixed(4)}°</span>
      </div>
    </div>
  );

  return (
    <div className="bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 rounded-2xl p-3 sm:p-4 shadow-xs overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2.5 pb-2.5 border-b border-stone-100 dark:border-stone-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100">
                {lang === 'bn' ? 'খামার ও মাইক্রোক্লাইমেট অবস্থান মানচিত্র' : 'Farm & Microclimate Location Map'}
              </h4>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/60">
                <ShieldCheck className="w-2.5 h-2.5" />
                {apiKey && !hasGoogleError ? 'Google Maps Platform' : 'OpenStreetMap GIS'}
              </span>
            </div>
            <span className="text-[11px] text-stone-500 dark:text-stone-400 font-mono">
              {coords.latitude.toFixed(4)}°N, {coords.longitude.toFixed(4)}°E · {lang === 'bn' ? 'কক্সবাজার / চট্টগ্রাম কৃষি অঞ্চল' : 'Bangladesh Agro Zone'}
            </span>
          </div>
        </div>

        {/* Map Type / Layer Toggle */}
        {apiKey && !hasGoogleError && (
          <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800 p-0.5 rounded-xl text-[11px] font-mono self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setMapType('hybrid')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                mapType === 'hybrid'
                  ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white font-bold shadow-xs'
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              {lang === 'bn' ? 'স্যাটেলাইট' : 'Satellite'}
            </button>
            <button
              type="button"
              onClick={() => setMapType('roadmap')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                mapType === 'roadmap'
                  ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white font-bold shadow-xs'
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              {lang === 'bn' ? 'ভেক্টর ম্যাপ' : 'Map'}
            </button>
          </div>
        )}
      </div>

      {/* Main Map Canvas: Google Maps when API key is available; OpenStreetMap fallback if missing/failed */}
      {apiKey && !hasGoogleError ? (
        <GoogleMapsErrorBoundary
          fallback={renderOsmFallback()}
          onError={() => setHasGoogleError(true)}
        >
          <div className="w-full h-64 sm:h-72 rounded-xl overflow-hidden border border-stone-200/70 dark:border-stone-800 relative bg-stone-100 dark:bg-stone-950">
            <APIProvider 
              apiKey={apiKey}
              onError={(e) => {
                console.warn("APIProvider encountered an initialization issue, falling back to GIS view:", e);
                setHasGoogleError(true);
              }}
            >
              <Map
                defaultCenter={{ lat: coords.latitude, lng: coords.longitude }}
                defaultZoom={14}
                mapTypeId={mapType}
                mapId="DEMO_MAP_ID"
                gestureHandling="greedy"
                disableDefaultUI={false}
                internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
                className="w-full h-full"
              >
                <AdvancedMarker position={{ lat: coords.latitude, lng: coords.longitude }} title="Farm Location">
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
            {renderWeatherChip()}
          </div>
        </GoogleMapsErrorBoundary>
      ) : (
        renderOsmFallback()
      )}

      {/* Bottom Attribution and Status Footer */}
      <div className="mt-2.5 flex items-center justify-between text-[11px] text-stone-400 dark:text-stone-500 font-mono">
        <span>
          {apiKey && !hasGoogleError 
            ? 'Google Maps Platform · Vector Rendering' 
            : (lang === 'bn' ? 'মুক্ত ভৌগোলিক উপাত্ত (OpenStreetMap) · জিপিএস ট্র্যাকড' : 'OpenStreetMap GIS · GPS Tracked')}
        </span>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${coords.latitude},${coords.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline"
        >
          <span>{lang === 'bn' ? 'গুগল ম্যাপে দেখুন' : 'Open in Maps'}</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
