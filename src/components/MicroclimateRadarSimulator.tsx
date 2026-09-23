import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  CloudRain, 
  Wind, 
  Thermometer, 
  ShieldAlert, 
  Sparkles, 
  Navigation, 
  Layers, 
  Satellite, 
  Zap, 
  Eye, 
  Info, 
  HelpCircle, 
  Radio, 
  ArrowUpRight, 
  Droplets,
  ChevronDown,
  ChevronUp,
  Sun,
  Clock,
  Compass,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Language } from '../utils/translations';

export interface HourlyPoint {
  time: string;
  temp: number;
  humidity: number;
  rainProb: number;
  wind: number;
  condition: string;
  dni?: number;
  rawTime?: string;
}

interface Props {
  lang: Language;
  coords: { latitude: number; longitude: number };
  hourlyForecast?: HourlyPoint[];
  currentTemp?: number;
  currentWind?: number;
  currentRainProb?: number;
}

export default function MicroclimateRadarSimulator({
  lang,
  coords,
  hourlyForecast,
  currentTemp = 28,
  currentWind = 9,
  currentRainProb = 15
}: Props) {
  const [selectedHour, setSelectedHour] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1); // 1x or 2x
  const [activeLayer, setActiveLayer] = useState<'radar' | 'wind' | 'temp'>('radar');
  const [showEchoGuide, setShowEchoGuide] = useState<boolean>(false);
  const [dayFilter, setDayFilter] = useState<'all' | 'today' | 'tomorrow'>('all');

  // Build authentic 48-Hour Timeline
  // If hourlyForecast is provided, use up to 48 hours; otherwise generate a realistic 48-hour diurnal cycle
  const timeline: HourlyPoint[] = React.useMemo(() => {
    if (hourlyForecast && hourlyForecast.length >= 24) {
      return hourlyForecast.slice(0, 48);
    }

    const now = new Date();
    return Array.from({ length: 48 }).map((_, i) => {
      const d = new Date(now.getTime() + i * 60 * 60 * 1000);
      const hour = d.getHours();
      const isNight = hour < 6 || hour > 19;
      // Diurnal temperature curve
      const solarAngle = Math.sin(((hour - 6) / 14) * Math.PI);
      const tempVariance = isNight ? -3.5 : Math.max(0, solarAngle * 6);
      
      // Rain wave cycle
      const rainWave = Math.sin((i / 8) * Math.PI);
      const rainChance = Math.max(5, Math.min(90, Math.round(currentRainProb + rainWave * 30 + (i > 24 ? 10 : 0))));

      let cond = 'Sunny';
      if (rainChance >= 60) cond = 'Thunderstorm';
      else if (rainChance >= 40) cond = 'Rainy';
      else if (rainChance >= 20) cond = 'Partly Cloudy';

      return {
        time: d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        temp: Math.round(currentTemp + tempVariance),
        humidity: Math.round(Math.min(95, Math.max(45, 75 - tempVariance * 2))),
        rainProb: rainChance,
        wind: Math.max(4, Math.round(currentWind + Math.sin(i * 0.4) * 6)),
        condition: cond,
        rawTime: d.toISOString()
      };
    });
  }, [hourlyForecast, currentTemp, currentWind, currentRainProb]);

  const totalHours = timeline.length;
  const activePoint = timeline[selectedHour] || timeline[0];

  // Auto-play scrubber animation
  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      const stepMs = playbackSpeed === 2 ? 650 : 1200;
      interval = setInterval(() => {
        setSelectedHour((prev) => {
          if (dayFilter === 'today') {
            return (prev + 1) % Math.min(24, totalHours);
          } else if (dayFilter === 'tomorrow') {
            const next = prev + 1;
            return next >= totalHours ? 24 : next;
          }
          return (prev + 1) % totalHours;
        });
      }, stepMs);
    }
    return () => clearInterval(interval);
  }, [isPlaying, totalHours, playbackSpeed, dayFilter]);

  // Determine whether the active point is today or tomorrow
  const isDay2 = selectedHour >= 24;
  const dayName = isDay2 
    ? (lang === 'bn' ? 'আগামীকাল' : 'Tomorrow') 
    : (lang === 'bn' ? 'আজ' : 'Today');

  // Derived meteorological Doppler Reflectivity (dBZ) & Rain Rate
  const reflectivityDbz = activePoint.rainProb < 15 
    ? Math.round(5 + activePoint.rainProb * 0.5)
    : activePoint.rainProb < 35 
      ? Math.round(15 + (activePoint.rainProb - 15) * 0.7)
      : activePoint.rainProb < 65 
        ? Math.round(29 + (activePoint.rainProb - 35) * 0.5)
        : Math.round(44 + Math.min(16, (activePoint.rainProb - 65) * 0.5));

  const rainRateMmPerHour = activePoint.rainProb < 18 
    ? 0.0 
    : activePoint.rainProb < 45 
      ? Number(((activePoint.rainProb - 18) * 0.14).toFixed(1))
      : activePoint.rainProb < 75 
        ? Number((3.8 + (activePoint.rainProb - 45) * 0.45).toFixed(1))
        : Number((17.5 + (activePoint.rainProb - 75) * 0.85).toFixed(1));

  // Compute spatial offset of cloud cell relative to farm center
  const isDirectlyOverFarm = activePoint.rainProb >= 55;
  const cloudDistanceKm = isDirectlyOverFarm 
    ? '০.৫' 
    : (1.8 + Math.abs(Math.sin(selectedHour * 0.35) * 8)).toFixed(1);

  // Position coordinates in percentage for visual cloud cell
  const cloudXPercent = isDirectlyOverFarm ? 49 : 34 + Math.sin(selectedHour * 0.45) * 22;
  const cloudYPercent = isDirectlyOverFarm ? 47 : 30 + Math.cos(selectedHour * 0.38) * 18;

  // Farm Action Checks for Current Hour
  const isSprayingSafe = activePoint.rainProb <= 20 && activePoint.wind <= 15 && activePoint.temp <= 32;
  const isIrrigationNeeded = activePoint.rainProb < 25 && activePoint.temp >= 26;
  const isFertilizerSafe = activePoint.rainProb <= 35 && activePoint.wind <= 18;
  const isHarvestingSafe = activePoint.rainProb <= 20;

  // Jump controls
  const handleStep = (step: number) => {
    setIsPlaying(false);
    setSelectedHour((prev) => {
      const next = prev + step;
      if (next < 0) return 0;
      if (next >= totalHours) return totalHours - 1;
      return next;
    });
  };

  const handleFilterChange = (filter: 'all' | 'today' | 'tomorrow') => {
    setDayFilter(filter);
    setIsPlaying(false);
    if (filter === 'today') {
      if (selectedHour >= 24) setSelectedHour(0);
    } else if (filter === 'tomorrow') {
      if (selectedHour < 24) setSelectedHour(24);
    }
  };

  return (
    <div className="bg-slate-950 text-white rounded-[36px] p-5 sm:p-7 md:p-8 border border-blue-900/40 shadow-2xl relative overflow-hidden mb-8">
      {/* Background radar grid pattern */}
      <div 
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.4) 1px, transparent 1px)`,
          backgroundSize: '24px 24px'
        }}
      />

      {/* Top Header & Layer Toggles */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 relative z-10 border-b border-white/10 pb-5">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-3 bg-blue-600/20 rounded-2xl border border-blue-500/30 text-blue-400 shrink-0">
            <Satellite className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400 bg-cyan-950/80 px-2.5 py-0.5 rounded-full border border-cyan-700/50">
                {lang === 'bn' ? 'বাস্তবসম্মত ডপলার রাডার' : 'Calibrated Doppler Radar'}
              </span>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-bold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-800/40">
                {lang === 'bn' ? 'পূর্ণাঙ্গ ৪৮ ঘণ্টা সিমুলেশন' : 'True 48-Hour Coverage'}
              </span>
            </div>
            <h3 className="text-xl md:text-2xl font-black tracking-tight text-white mt-1">
              {lang === 'bn' 
                ? 'বায়ুমণ্ডলীয় রাডার ও ৪৮ ঘণ্টার সিমুলেশন' 
                : 'Atmospheric Radar & 48-Hour Microclimate Simulation'}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {lang === 'bn'
                ? 'মেঘের বিস্তার, ডপলার প্রতিফলন তীব্রতা (dBZ) এবং ক্ষেতের জরুরি সতর্কতা'
                : 'Cloud cell tracking, Doppler reflectivity (dBZ) & farm operational timing'}
            </p>
          </div>
        </div>

        {/* Layer Mode Switchers */}
        <div className="flex items-center gap-2 bg-slate-900/90 p-1.5 rounded-2xl border border-white/10 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => setActiveLayer('radar')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeLayer === 'radar'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <CloudRain className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'মেঘ ও বৃষ্টিপাত' : 'Rain Radar'}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveLayer('wind')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeLayer === 'wind'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Wind className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'বাতাসের প্রবাহ' : 'Wind Vectors'}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveLayer('temp')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeLayer === 'temp'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Thermometer className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'তাপমাত্রা' : 'Thermal'}</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Stage: Simulated Geo-Radar Map & Metrics Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10 mb-6">
        {/* Visual Map Screen (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900/95 rounded-3xl p-4 sm:p-5 border border-white/10 relative overflow-hidden flex flex-col justify-between min-h-[380px]">
          {/* Radar Background Compass Crosshairs & Calibrated Range Rings */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
            {/* Grid Crosshair Lines */}
            <div className="absolute top-1/2 left-0 right-0 h-px bg-cyan-500/15" />
            <div className="absolute top-0 bottom-0 left-1/2 w-px bg-cyan-500/15" />

            {/* 15 km Outer Range Ring */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] border border-cyan-500/20 rounded-full flex items-start justify-center pt-1">
              <span className="text-[9px] font-mono text-cyan-400/60 bg-slate-950/90 px-1.5 py-0.5 rounded -translate-y-2.5">
                {lang === 'bn' ? '১৫ কিমি' : '15 km'}
              </span>
            </div>

            {/* 10 km Mid Range Ring */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[190px] h-[190px] border border-cyan-500/30 rounded-full flex items-start justify-center pt-1">
              <span className="text-[9px] font-mono text-cyan-400/70 bg-slate-950/90 px-1.5 py-0.5 rounded -translate-y-2.5">
                {lang === 'bn' ? '১০ কিমি' : '10 km'}
              </span>
            </div>

            {/* 5 km Inner Range Ring */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100px] h-[100px] border border-cyan-500/40 rounded-full flex items-start justify-center pt-1">
              <span className="text-[9px] font-mono text-cyan-400/80 bg-slate-950/90 px-1.5 py-0.5 rounded -translate-y-2.5">
                {lang === 'bn' ? '৫ কিমি' : '5 km'}
              </span>
            </div>

            {/* Cardinal Direction Markers */}
            <span className="absolute top-2 left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold text-cyan-400/50 bg-slate-900/60 px-1 rounded">
              {lang === 'bn' ? 'উ (N)' : 'N'}
            </span>
            <span className="absolute bottom-16 left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold text-cyan-400/50 bg-slate-900/60 px-1 rounded">
              {lang === 'bn' ? 'দ (S)' : 'S'}
            </span>
            <span className="absolute top-1/2 right-2 -translate-y-1/2 text-[9px] font-mono font-bold text-cyan-400/50 bg-slate-900/60 px-1 rounded">
              {lang === 'bn' ? 'পূ (E)' : 'E'}
            </span>
            <span className="absolute top-1/2 left-2 -translate-y-1/2 text-[9px] font-mono font-bold text-cyan-400/50 bg-slate-900/60 px-1 rounded">
              {lang === 'bn' ? 'প (W)' : 'W'}
            </span>

            {/* Rotating Doppler Radar Scanner Beam */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
              className="absolute top-1/2 left-1/2 origin-top-left w-[200px] h-[200px] bg-gradient-to-br from-cyan-400/30 via-cyan-500/10 to-transparent pointer-events-none"
              style={{
                clipPath: "polygon(0 0, 100% 0, 0 100%)"
              }}
            />

            {/* REALISTIC MULTI-TIERED DOPPLER MOISTURE & PRECIPITATION ECHO CELLS */}
            {activeLayer === 'radar' && (
              <div 
                className="absolute transition-all duration-700 ease-out pointer-events-none"
                style={{
                  top: `${cloudYPercent}%`,
                  left: `${cloudXPercent}%`,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                {activePoint.rainProb >= 20 ? (
                  <div className="relative flex items-center justify-center">
                    {/* Layer 1: Outer Cloud & Moisture Boundary (15-28 dBZ, Light Green) */}
                    <motion.div
                      animate={{
                        scale: [1, 1.08, 1],
                        opacity: [0.55, 0.75, 0.55]
                      }}
                      transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut' }}
                      className="w-48 h-48 rounded-full blur-xl absolute"
                      style={{
                        background: 'radial-gradient(circle, rgba(34, 197, 94, 0.55) 0%, rgba(6, 182, 212, 0.35) 45%, transparent 75%)'
                      }}
                    />

                    {/* Layer 2: Moderate Rain Band (28-42 dBZ, Yellow/Amber) */}
                    {activePoint.rainProb >= 35 && (
                      <motion.div
                        animate={{
                          scale: [1, 1.05, 1],
                          opacity: [0.7, 0.9, 0.7]
                        }}
                        transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
                        className="w-32 h-32 rounded-full blur-md absolute"
                        style={{
                          background: 'radial-gradient(circle, rgba(234, 179, 8, 0.75) 0%, rgba(34, 197, 94, 0.45) 60%, transparent 80%)'
                        }}
                      />
                    )}

                    {/* Layer 3: High-Intensity Convective Rain Core (44+ dBZ, Orange/Crimson) */}
                    {activePoint.rainProb >= 55 && (
                      <motion.div
                        animate={{
                          scale: [0.95, 1.1, 0.95],
                          opacity: [0.85, 1, 0.85]
                        }}
                        transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                        className="w-20 h-20 rounded-full blur-sm absolute"
                        style={{
                          background: 'radial-gradient(circle, rgba(239, 68, 68, 0.9) 0%, rgba(249, 115, 22, 0.75) 55%, transparent 85%)'
                        }}
                      />
                    )}

                    {/* Floating Radar Tag */}
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="relative z-20 translate-x-10 -translate-y-10 bg-black/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20 shadow-xl pointer-events-auto flex flex-col gap-0.5"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${
                          reflectivityDbz >= 45 ? 'bg-rose-500 ring-2 ring-rose-500/30' : reflectivityDbz >= 30 ? 'bg-amber-400' : 'bg-emerald-400'
                        }`} />
                        <span className="text-[10px] font-black text-white font-mono">
                          {reflectivityDbz} dBZ • {rainRateMmPerHour} mm/h
                        </span>
                      </div>
                      <div className="text-[9px] text-gray-300 flex items-center justify-between gap-3">
                        <span className="text-cyan-300 font-bold">
                          {isDirectlyOverFarm 
                            ? (lang === 'bn' ? 'খামারের ওপর সক্রিয়' : 'Over Farm') 
                            : `${cloudDistanceKm} km ${lang === 'bn' ? 'দূরে' : 'away'}`}
                        </span>
                      </div>
                    </motion.div>
                  </div>
                ) : (
                  /* Clear Sky (< 20% rain chance) */
                  <div className="flex flex-col items-center justify-center opacity-40">
                    <div className="w-24 h-24 rounded-full bg-cyan-500/15 blur-lg" />
                    <span className="text-[9px] font-mono text-cyan-300/60 bg-black/50 px-2 py-0.5 rounded-full mt-1">
                      {lang === 'bn' ? 'পরিষ্কার শান্ত আবহাওয়া (<১৫ dBZ)' : 'Clear Calm Sky (<15 dBZ)'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Simulated Wind Streamlines */}
            {activeLayer === 'wind' && (
              <div className="absolute inset-0 flex items-center justify-center opacity-45">
                {Array.from({ length: 7 }).map((_, idx) => (
                  <motion.div
                    key={idx}
                    animate={{ x: [-120, 140] }}
                    transition={{ repeat: Infinity, duration: Math.max(1, 14 / (activePoint.wind || 8)), delay: idx * 0.25, ease: 'linear' }}
                    className="absolute h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent w-32"
                    style={{ top: `${15 + idx * 12}%` }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Top telemetry & controls bar inside the radar screen */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 text-xs mb-3">
            <div className="flex items-center gap-1.5 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/15">
              <Navigation className="w-3 h-3 text-cyan-400 shrink-0" />
              <span className="font-mono text-[10px] text-cyan-300">
                {coords.latitude.toFixed(2)}°N, {coords.longitude.toFixed(2)}°E
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowEchoGuide(!showEchoGuide)}
                className="flex items-center gap-1 bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-600/50 px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer shadow-sm"
              >
                <HelpCircle className="w-3 h-3 text-cyan-300 shrink-0" />
                <span>{lang === 'bn' ? 'ডপলার গাইড' : 'Echo Guide'}</span>
                {showEchoGuide ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              <div className="flex items-center gap-1.5 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/15 text-gray-300">
                <span className={`w-2 h-2 rounded-full ${
                  reflectivityDbz >= 45 ? 'bg-rose-500 ring-2 ring-rose-500/30' : reflectivityDbz >= 30 ? 'bg-amber-400' : 'bg-emerald-400'
                }`}></span>
                <span className="font-bold text-[10px]">
                  {reflectivityDbz} dBZ
                </span>
              </div>
            </div>
          </div>

          {/* Farmer Location Crosshair Center (Focal Target) */}
          <div className="relative z-10 flex flex-col items-center justify-center my-auto py-5">
            <div className="relative flex items-center justify-center">
              <div className="w-7 h-7 rounded-full bg-cyan-500/20 border border-cyan-400/40 absolute animate-ping" />
              <div className="w-5 h-5 rounded-full bg-cyan-400 border-2 border-white shadow-md relative flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-slate-900" />
              </div>
            </div>
            <span className="mt-1.5 text-[9px] font-black uppercase tracking-wider bg-black/85 px-3 py-0.5 rounded-full text-cyan-200 border border-cyan-500/40 shadow-sm backdrop-blur-xs">
              {lang === 'bn' ? 'আপনার খামার' : 'Your Farm'}
            </span>
          </div>

          {/* Bottom radar spectrum legend & playback control */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 pt-2.5 mt-auto border-t border-white/10 text-xs bg-slate-950/60 backdrop-blur-xs -mx-2 -mb-2 px-3 py-2 rounded-b-2xl">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] px-3 py-1.5 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 fill-current" />}
                <span>{isPlaying ? (lang === 'bn' ? 'থামান' : 'Pause') : (lang === 'bn' ? 'প্লে' : 'Play')}</span>
              </button>

              <button
                type="button"
                onClick={() => setPlaybackSpeed(playbackSpeed === 1 ? 2 : 1)}
                className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-bold text-gray-200 transition-colors cursor-pointer"
                title="Toggle Speed"
              >
                {playbackSpeed}x
              </button>

              <button
                type="button"
                onClick={() => { setSelectedHour(0); setIsPlaying(false); }}
                className="p-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-gray-300 transition-colors cursor-pointer"
                title={lang === 'bn' ? 'শুরুতে ফিরুন' : 'Reset to T+0'}
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>

            {/* Clear, Labeled dBZ Reflectivity Scale */}
            <div className="flex items-center gap-1.5 bg-black/70 px-2.5 py-1 rounded-xl border border-white/10">
              <span className="text-[9px] text-gray-400 font-bold uppercase hidden sm:inline">
                {lang === 'bn' ? 'তীব্রতা:' : 'Reflectivity:'}
              </span>
              <div className="flex items-center gap-1 font-mono text-[8px]">
                <span className="text-cyan-400">০</span>
                <div className="w-16 h-2 rounded-full bg-gradient-to-r from-cyan-400 via-emerald-400 via-amber-400 to-rose-600 shadow-inner" />
                <span className="text-rose-400">৫৫+</span>
              </div>
              <span className={`text-[9px] font-bold px-1.5 rounded ${
                reflectivityDbz >= 45 ? 'bg-rose-500/20 text-rose-300' : reflectivityDbz >= 30 ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
              }`}>
                {reflectivityDbz} dBZ
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Telemetry Readout & Farm Advisory (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
          {/* Active Frame Metrics */}
          <div className="bg-slate-900/90 rounded-3xl p-5 border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border ${
                  isDay2 
                    ? 'bg-purple-950/80 text-purple-300 border-purple-800/40' 
                    : 'bg-blue-950/80 text-blue-300 border-blue-800/40'
                }`}>
                  {dayName}
                </span>
                <span className="text-xs font-bold text-gray-400">
                  {activePoint.time}
                </span>
              </div>

              <span className="text-xs font-black font-mono text-cyan-400 bg-cyan-950/80 px-2.5 py-1 rounded-xl border border-cyan-800/40">
                {selectedHour === 0 ? (lang === 'bn' ? 'এখন (T+০ ঘণ্টা)' : 'Now (T+0h)') : `+${selectedHour}h (${dayName})`}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center mb-3">
              <div className="bg-white/5 rounded-2xl p-2.5 border border-white/5">
                <span className="text-[10px] text-gray-400 uppercase font-bold block">{lang === 'bn' ? 'তাপমাত্রা' : 'Temp'}</span>
                <span className="text-xl font-black text-white">{activePoint.temp}°C</span>
              </div>
              <div className="bg-white/5 rounded-2xl p-2.5 border border-white/5">
                <span className="text-[10px] text-gray-400 uppercase font-bold block">{lang === 'bn' ? 'বৃষ্টির হার' : 'Rain Prob'}</span>
                <span className={`text-xl font-black ${activePoint.rainProb > 40 ? 'text-cyan-400' : 'text-gray-200'}`}>
                  {activePoint.rainProb}%
                </span>
              </div>
              <div className="bg-white/5 rounded-2xl p-2.5 border border-white/5">
                <span className="text-[10px] text-gray-400 uppercase font-bold block">{lang === 'bn' ? 'বাতাস' : 'Wind'}</span>
                <span className="text-xl font-black text-white">{activePoint.wind} <span className="text-[10px]">km/h</span></span>
              </div>
            </div>

            {/* Granular Doppler Microclimate Readout */}
            <div className="bg-cyan-950/40 rounded-2xl p-3 border border-cyan-800/30 flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] text-cyan-400 font-bold block uppercase tracking-wider">
                  {lang === 'bn' ? 'ডপলার প্রতিফলন ও বর্ষণ হার' : 'Doppler Echo & Rate'}
                </span>
                <span className="text-sm font-black text-white font-mono">
                  {reflectivityDbz} dBZ • {rainRateMmPerHour} mm/h
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">
                  {lang === 'bn' ? 'মেঘপুঞ্জের নৈকট্য' : 'Cloud Proximity'}
                </span>
                <span className={`text-xs font-bold ${isDirectlyOverFarm ? 'text-rose-400 animate-pulse' : 'text-cyan-300'}`}>
                  {isDirectlyOverFarm 
                    ? (lang === 'bn' ? 'খামারের ওপর সক্রিয়' : 'Directly Over Farm') 
                    : `${cloudDistanceKm} km (${lang === 'bn' ? 'দূরত্বে' : 'away'})`}
                </span>
              </div>
            </div>
          </div>

          {/* Actionable Field Operations Checklist for Selected Hour */}
          <div className="bg-slate-900/90 rounded-3xl p-5 border border-white/10 shadow-lg">
            <h4 className="text-xs font-black uppercase tracking-wider text-gray-300 mb-3 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                {lang === 'bn' ? 'এই ঘণ্টার কৃষি কাজের নির্দেশিকা' : 'Hourly Field Work Advisory'}
              </span>
              <span className="text-[10px] text-gray-400 font-normal">
                {activePoint.time}
              </span>
            </h4>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* Chemical Spray Window */}
              <div className={`p-2.5 rounded-2xl border flex items-start gap-2 ${
                isSprayingSafe 
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200' 
                  : 'bg-rose-950/40 border-rose-500/30 text-rose-200'
              }`}>
                {isSprayingSafe ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />}
                <div>
                  <span className="font-bold block text-[11px]">
                    {lang === 'bn' ? 'বালাইনাশক স্প্রে' : 'Crop Spraying'}
                  </span>
                  <span className="text-[10px] opacity-80 leading-tight block">
                    {isSprayingSafe 
                      ? (lang === 'bn' ? 'নিরাপদ উপযুক্ত সময়' : 'Safe window') 
                      : (lang === 'bn' ? 'স্প্রে বন্ধ রাখুন (বৃষ্টি/বাতাস)' : 'Hold spraying')}
                  </span>
                </div>
              </div>

              {/* Irrigation Window */}
              <div className={`p-2.5 rounded-2xl border flex items-start gap-2 ${
                isIrrigationNeeded 
                  ? 'bg-blue-950/40 border-blue-500/30 text-blue-200' 
                  : 'bg-slate-800/40 border-slate-700/40 text-gray-300'
              }`}>
                {isIrrigationNeeded ? <Droplets className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />}
                <div>
                  <span className="font-bold block text-[11px]">
                    {lang === 'bn' ? 'সেচ ব্যবস্থাপনা' : 'Irrigation'}
                  </span>
                  <span className="text-[10px] opacity-80 leading-tight block">
                    {isIrrigationNeeded 
                      ? (lang === 'bn' ? 'মাঝারি সেচ প্রয়োজন' : 'Irrigation suited') 
                      : (lang === 'bn' ? 'বৃষ্টির কারণে সেচ স্থগিত' : 'Hold irrigation')}
                  </span>
                </div>
              </div>

              {/* Fertilizer Application */}
              <div className={`p-2.5 rounded-2xl border flex items-start gap-2 ${
                isFertilizerSafe 
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200' 
                  : 'bg-amber-950/40 border-amber-500/30 text-amber-200'
              }`}>
                {isFertilizerSafe ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />}
                <div>
                  <span className="font-bold block text-[11px]">
                    {lang === 'bn' ? 'সার প্রয়োগ' : 'Fertilizer'}
                  </span>
                  <span className="text-[10px] opacity-80 leading-tight block">
                    {isFertilizerSafe 
                      ? (lang === 'bn' ? 'উপযুক্ত সময়' : 'Safe to apply') 
                      : (lang === 'bn' ? 'ধুয়ে যাওয়ার ঝুঁকি' : 'Washout risk')}
                  </span>
                </div>
              </div>

              {/* Harvest & Sun Drying */}
              <div className={`p-2.5 rounded-2xl border flex items-start gap-2 ${
                isHarvestingSafe 
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200' 
                  : 'bg-rose-950/40 border-rose-500/30 text-rose-200'
              }`}>
                {isHarvestingSafe ? <Sun className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />}
                <div>
                  <span className="font-bold block text-[11px]">
                    {lang === 'bn' ? 'ফসল তোলা/শুকানো' : 'Harvest / Drying'}
                  </span>
                  <span className="text-[10px] opacity-80 leading-tight block">
                    {isHarvestingSafe 
                      ? (lang === 'bn' ? 'রোদে শুকানো অনুকূল' : 'Good drying') 
                      : (lang === 'bn' ? 'ফসল ঢেকে রাখুন' : 'Protect harvest')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DOPPLER ECHO EDUCATIONAL GUIDE (What do the colors mean?) */}
      <AnimatePresence>
        {showEchoGuide && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden mb-6"
          >
            <div className="bg-slate-900/95 border border-cyan-500/30 rounded-3xl p-5 md:p-6 shadow-xl relative">
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                <div className="flex items-center gap-2 text-cyan-300">
                  <Info className="w-4 h-4" />
                  <h4 className="text-sm font-black uppercase tracking-wider">
                    {lang === 'bn' 
                      ? 'ডপলার রাডার প্রতিফলন (dBZ) সহজে বোঝার গাইড' 
                      : 'Understanding Doppler Radar Reflectivity (dBZ)'}
                  </h4>
                </div>
                <button 
                  type="button"
                  onClick={() => setShowEchoGuide(false)}
                  className="text-xs text-gray-400 hover:text-white px-2 py-1 bg-white/5 rounded-lg cursor-pointer"
                >
                  {lang === 'bn' ? 'বন্ধ করুন ✕' : 'Close ✕'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                {/* 0-15 dBZ */}
                <div className="bg-white/5 rounded-2xl p-3.5 border border-cyan-500/20">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-3 h-3 rounded-full bg-cyan-400 shadow-sm" />
                    <span className="font-bold text-cyan-300">০ - ১৫ dBZ</span>
                  </div>
                  <span className="font-bold text-white block mb-1">
                    {lang === 'bn' ? 'শান্ত ও পরিষ্কার আকাশ' : 'Clear Skies / Mist'}
                  </span>
                  <p className="text-gray-300 text-[11px] leading-relaxed">
                    {lang === 'bn' 
                      ? 'বৃষ্টির সম্ভাবনা নেই। ধান শুকানো, গম কাটা ও বালাইনাশক স্প্রে করার জন্য সবচেয়ে উত্তম সময়।' 
                      : 'No rain risk. Optimal window for harvesting, drying grain, and spraying.'}
                  </p>
                </div>

                {/* 15-30 dBZ */}
                <div className="bg-white/5 rounded-2xl p-3.5 border border-emerald-500/20">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-400 shadow-sm" />
                    <span className="font-bold text-emerald-300">১৫ - ৩০ dBZ</span>
                  </div>
                  <span className="font-bold text-white block mb-1">
                    {lang === 'bn' ? 'হালকা মেঘ ও গুঁড়ি বৃষ্টি' : 'Light Drizzle (< 2.5 mm/h)'}
                  </span>
                  <p className="text-gray-300 text-[11px] leading-relaxed">
                    {lang === 'bn' 
                      ? 'মাটিতে পানি জমার সম্ভাবনা কম। তবে তরল কীটনাশক স্প্রে করার আগে ১-২ ঘণ্টা অপেক্ষা করুন।' 
                      : 'Scattered moisture particles. Minimal water accumulation; wait before foliar spraying.'}
                  </p>
                </div>

                {/* 30-45 dBZ */}
                <div className="bg-white/5 rounded-2xl p-3.5 border border-amber-500/20">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-3 h-3 rounded-full bg-amber-400 shadow-sm" />
                    <span className="font-bold text-amber-300">৩০ - ৪৫ dBZ</span>
                  </div>
                  <span className="font-bold text-white block mb-1">
                    {lang === 'bn' ? 'মাঝারি নিয়মিত বৃষ্টি' : 'Moderate Rain (5-15 mm/h)'}
                  </span>
                  <p className="text-gray-300 text-[11px] leading-relaxed">
                    {lang === 'bn' 
                      ? 'ঘন বর্ষণ। সেচ পাম্প সম্পূর্ণ বন্ধ রাখুন এবং সব ধরনের রাসায়নিক সার স্প্রে স্থগিত করুন।' 
                      : 'Steady rain band. Turn off motor irrigation immediately and pause chemical spraying.'}
                  </p>
                </div>

                {/* 45+ dBZ */}
                <div className="bg-white/5 rounded-2xl p-3.5 border border-rose-500/20">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-3 h-3 rounded-full bg-rose-500 shadow-sm" />
                    <span className="font-bold text-rose-300">৪৫+ dBZ</span>
                  </div>
                  <span className="font-bold text-white block mb-1">
                    {lang === 'bn' ? 'প্রবল কালবৈশাখী / মেঘভাঙা বৃষ্টি' : 'Torrential Storm (>25 mm/h)'}
                  </span>
                  <p className="text-gray-300 text-[11px] leading-relaxed">
                    {lang === 'bn' 
                      ? 'বজ্রপাত ও দ্রুত জলাবদ্ধতার ঝুঁকি। ক্ষেতের ড্রেনেজ নালা কেটে দিন এবং ফসল দ্রুত ঘরে তুলুন।' 
                      : 'Flash flood and gust risk. Open field trenches immediately and safely shelter.'}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Authentic 48-Hour Time Slider & Controls */}
      <div className="bg-slate-900/90 rounded-3xl p-5 border border-white/10 relative z-10">
        {/* Day Filters & Step Buttons Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              {lang === 'bn' ? 'সময়রেখা সীমা:' : 'Timeline Range:'}
            </span>
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => handleFilterChange('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  dayFilter === 'all' ? 'bg-cyan-500 text-slate-950 font-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                {lang === 'bn' ? 'সব (৪৮ ঘণ্টা)' : 'All 48h'}
              </button>
              <button
                type="button"
                onClick={() => handleFilterChange('today')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  dayFilter === 'today' ? 'bg-blue-600 text-white font-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                {lang === 'bn' ? 'আজ (১ম ২৪ ঘণ্টা)' : 'Today (0-24h)'}
              </button>
              <button
                type="button"
                onClick={() => handleFilterChange('tomorrow')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  dayFilter === 'tomorrow' ? 'bg-purple-600 text-white font-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                {lang === 'bn' ? 'আগামীকাল (২য় ২৪ ঘণ্টা)' : 'Tomorrow (24-48h)'}
              </button>
            </div>
          </div>

          {/* Quick Hour Steppers */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleStep(-1)}
              className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-[11px] font-mono text-gray-300 transition-colors cursor-pointer"
              title="-1 hour"
            >
              -1h
            </button>
            <button
              type="button"
              onClick={() => handleStep(1)}
              className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-[11px] font-mono text-gray-300 transition-colors cursor-pointer"
              title="+1 hour"
            >
              +1h
            </button>
            <button
              type="button"
              onClick={() => handleStep(6)}
              className="px-2 py-1 bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 rounded-lg text-[11px] font-mono font-bold transition-colors cursor-pointer"
              title="+6 hours"
            >
              +6h
            </button>
            <button
              type="button"
              onClick={() => handleStep(12)}
              className="px-2 py-1 bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 rounded-lg text-[11px] font-mono font-bold transition-colors cursor-pointer"
              title="+12 hours"
            >
              +12h
            </button>
          </div>
        </div>

        {/* Range Slider for full 48 hours */}
        <input
          type="range"
          min="0"
          max={totalHours - 1}
          value={selectedHour}
          onChange={(e) => {
            setSelectedHour(parseInt(e.target.value));
            setIsPlaying(false);
          }}
          className="w-full h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 hover:accent-cyan-300 transition-all"
        />

        {/* 48-Hour Tick Marks */}
        <div className="flex justify-between mt-2 text-[10px] text-gray-400 font-mono">
          <span className={selectedHour === 0 ? 'text-cyan-400 font-bold' : ''}>
            {lang === 'bn' ? 'এখন (T+০)' : 'Now (T+0)'}
          </span>
          <span className={selectedHour === 12 ? 'text-cyan-400 font-bold' : ''}>+12h</span>
          <span className={selectedHour === 24 ? 'text-purple-400 font-bold' : 'text-purple-400/70'}>
            +24h ({lang === 'bn' ? 'আগামীকাল' : 'Tomorrow'})
          </span>
          <span className={selectedHour === 36 ? 'text-cyan-400 font-bold' : ''}>+36h</span>
          <span className={selectedHour === totalHours - 1 ? 'text-cyan-400 font-bold' : ''}>
            +{totalHours - 1}h
          </span>
        </div>
      </div>
    </div>
  );
}
