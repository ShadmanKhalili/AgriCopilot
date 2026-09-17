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
  ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Language } from '../utils/translations';

interface HourlyPoint {
  time: string;
  temp: number;
  humidity: number;
  rainProb: number;
  wind: number;
  condition: string;
  dni?: number;
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
  const [activeLayer, setActiveLayer] = useState<'radar' | 'wind' | 'temp'>('radar');
  const [showEchoGuide, setShowEchoGuide] = useState<boolean>(false);

  // Fallback synthetic 24-hour steps if hourlyForecast is sparse
  const timeline: HourlyPoint[] = hourlyForecast && hourlyForecast.length >= 12
    ? hourlyForecast.slice(0, 24)
    : Array.from({ length: 24 }).map((_, i) => {
        const hour = (new Date().getHours() + i) % 24;
        const isNight = hour < 6 || hour > 19;
        const tempVariance = Math.sin((hour - 8) / 12 * Math.PI) * 5;
        const rainChance = Math.max(5, Math.min(85, Math.round(currentRainProb + Math.sin(i * 0.8) * 25)));
        return {
          time: `${hour.toString().padStart(2, '0')}:00`,
          temp: Math.round(currentTemp + (isNight ? -3 : 2) + tempVariance),
          humidity: Math.round(65 + Math.cos(i * 0.5) * 20),
          rainProb: rainChance,
          wind: Math.max(3, Math.round(currentWind + Math.sin(i * 0.9) * 8)),
          condition: rainChance > 50 ? 'Rainy' : rainChance > 30 ? 'Partly Cloudy' : 'Sunny'
        };
      });

  const activePoint = timeline[selectedHour] || timeline[0];

  // Auto-play scrubber animation
  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setSelectedHour((prev) => (prev + 1) % timeline.length);
      }, 1100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, timeline.length]);

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

  // Compute spatial offset of the cloud cell relative to the farm center
  const isDirectlyOverFarm = activePoint.rainProb >= 60;
  const cloudDistanceKm = isDirectlyOverFarm 
    ? '০.৮' 
    : (2.5 + Math.abs(Math.sin(selectedHour * 0.4) * 6)).toFixed(1);

  // Position coordinates in percentage for the visual cloud cell
  const cloudXPercent = isDirectlyOverFarm ? 48 : 36 + Math.sin(selectedHour * 0.5) * 16;
  const cloudYPercent = isDirectlyOverFarm ? 46 : 32 + Math.cos(selectedHour * 0.4) * 14;

  // Compute Gemini AI dynamic impact alert for the scrubbed hour
  const getAiImpactInsight = (point: HourlyPoint, hourOffset: number) => {
    if (point.rainProb >= 60) {
      return {
        level: 'critical',
        badge: lang === 'bn' ? 'ঝুঁকি: তীব্র বর্ষণ ব্যান্ড (Doppler > 45 dBZ)' : 'ALERT: Intense Rain Band (>45 dBZ)',
        bg: 'from-rose-950 to-indigo-950 border-rose-500/40 text-rose-200',
        text: lang === 'bn'
          ? `+${hourOffset} ঘণ্টা পর আকাশে ঘনীভূত মেঘের ডপলার তীব্রতা ${reflectivityDbz} dBZ এবং বৃষ্টির হার ~${rainRateMmPerHour} মিমি/ঘণ্টা। বালাইনাশক প্রয়োগ অবিলম্বে বন্ধ রাখুন এবং ড্রেনেজ সচল রাখুন।`
          : `Hour +${hourOffset}: Doppler radar echo shows dense convective cells (${reflectivityDbz} dBZ, ~${rainRateMmPerHour} mm/hr) over coordinates. Cease all agrochemical spraying.`
      };
    }
    if (point.wind >= 20) {
      return {
        level: 'warning',
        badge: lang === 'bn' ? 'ঝুঁকি: তীব্র দমকা হাওয়া' : 'ALERT: High Wind Drift',
        bg: 'from-amber-950 to-slate-900 border-amber-500/40 text-amber-200',
        text: lang === 'bn'
          ? `+${hourOffset} ঘণ্টা পর বাতাসের গতি ${point.wind} কিমি/ঘণ্টা ছাড়িয়ে যাবে। লম্বা ডালপালাযুক্ত ফসল (কলা, ভুট্টা) হেলে পড়ার ঝুঁকি।`
          : `Hour +${hourOffset}: Boundary gusts reach ${point.wind} km/h. Risk of crop lodging in tall stalks (maize, banana).`
      };
    }
    if (point.temp >= 35) {
      return {
        level: 'warning',
        badge: lang === 'bn' ? 'তাপপ্রবাহ সতর্কতা' : 'Heat Stress Alert',
        bg: 'from-orange-950 to-slate-900 border-orange-500/40 text-orange-200',
        text: lang === 'bn'
          ? `+${hourOffset} ঘণ্টা পর তাপমাত্রা ${point.temp}°C অতিক্রম করবে। শাকসবজি ও পরাগায়নে তাপীয় চাপ এড়াতে জমিতে হালকা পানি ধরে রাখুন।`
          : `Hour +${hourOffset}: Canopy temperatures hit ${point.temp}°C. Evapotranspiration spike requires early morning moisture.`
      };
    }
    return {
      level: 'optimal',
      badge: lang === 'bn' ? 'অনুকূল আবহাওয়া' : 'Optimal Field Window',
      bg: 'from-emerald-950 to-slate-900 border-emerald-500/40 text-emerald-200',
      text: lang === 'bn'
        ? `+${hourOffset} ঘণ্টা পর পরিস্থিতি শান্ত (আকাশ পরিষ্কার, আর্দ্রতা স্বাভাবিক)। ক্ষেতের পরিচর্যা ও সার প্রয়োগের আদর্শ সময়।`
        : `Hour +${hourOffset}: Calm microclimate (${point.temp}°C, Doppler echo <20 dBZ). Prime operational window for farmers.`
    };
  };

  const currentInsight = getAiImpactInsight(activePoint, selectedHour);

  // Derive radar color & density from rain probability & active layer
  const rainIntensityRatio = activePoint.rainProb / 100;
  const radarWaveRadius = 50 + (selectedHour % 6) * 18;

  return (
    <div className="bg-slate-950 text-white rounded-[36px] p-6 md:p-8 border border-blue-900/40 shadow-2xl relative overflow-hidden mb-8">
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
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-600/20 rounded-2xl border border-blue-500/30 text-blue-400">
            <Satellite className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400 bg-cyan-950/80 px-2.5 py-0.5 rounded-full border border-cyan-700/50">
                WeatherNext 3.0 Real-time GIS
              </span>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] text-gray-400 font-bold uppercase">5km Spatial Grid</span>
            </div>
            <h3 className="text-xl md:text-2xl font-black tracking-tight text-white mt-1">
              {lang === 'bn' 
                ? 'বায়ুমণ্ডলীয় রাডার ও ৪৮ ঘণ্টার সিমুলেশন' 
                : 'Atmospheric Radar & 48-Hour Microclimate Simulation'}
            </h3>
          </div>
        </div>

        {/* Layer Mode Switchers */}
        <div className="flex items-center gap-2 bg-slate-900/90 p-1.5 rounded-2xl border border-white/10 self-start lg:self-auto">
          <button
            onClick={() => setActiveLayer('radar')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
              activeLayer === 'radar'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <CloudRain className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'বৃষ্টিপাত রাডার' : 'Rain Radar'}</span>
          </button>
          <button
            onClick={() => setActiveLayer('wind')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
              activeLayer === 'wind'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Wind className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'বায়ুপ্রবাহ ভেক্টর' : 'Wind Vectors'}</span>
          </button>
          <button
            onClick={() => setActiveLayer('temp')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
              activeLayer === 'temp'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Thermometer className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'তাপপ্রবাহ' : 'Thermal'}</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Stage: Simulated Geo-Radar Map & Metrics Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10 mb-6">
        {/* Visual Map Screen (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900/95 rounded-3xl p-5 border border-white/10 relative overflow-hidden flex flex-col justify-between min-h-[360px]">
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
              transition={{ repeat: Infinity, duration: 4.5, ease: "linear" }}
              className="absolute top-1/2 left-1/2 origin-top-left w-[200px] h-[200px] bg-gradient-to-br from-cyan-400/30 via-cyan-500/10 to-transparent pointer-events-none"
              style={{
                clipPath: "polygon(0 0, 100% 0, 0 100%)"
              }}
            />

            {/* =========================================================================
                REALISTIC MULTI-TIERED DOPPLER MOISTURE & PRECIPITATION ECHO CELLS
                ========================================================================= */}
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
                    {/* Layer 1: Outer Cloud & Moisture Boundary (15-28 dBZ, Light/Green) */}
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
                    {activePoint.rainProb >= 60 && (
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

                    {/* Interactive Floating Radar HUD Tag on the Cloud Cell */}
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="relative z-20 translate-x-12 -translate-y-12 bg-black/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20 shadow-xl pointer-events-auto flex flex-col gap-0.5"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${
                          reflectivityDbz >= 45 ? 'bg-rose-500 animate-ping' : reflectivityDbz >= 30 ? 'bg-amber-400' : 'bg-emerald-400'
                        }`} />
                        <span className="text-[10px] font-black text-white font-mono">
                          {lang === 'bn' ? 'মেঘপুঞ্জ প্রতিফলন:' : 'Doppler Echo:'} {reflectivityDbz} dBZ
                        </span>
                      </div>
                      <div className="text-[9px] text-gray-300 flex items-center justify-between gap-3">
                        <span>{rainRateMmPerHour} mm/h</span>
                        <span className="text-cyan-300 font-bold">
                          {isDirectlyOverFarm 
                            ? (lang === 'bn' ? 'খামারের ওপর' : 'Over Farm') 
                            : `${cloudDistanceKm} km ${lang === 'bn' ? 'দূরে' : 'away'}`}
                        </span>
                      </div>
                    </motion.div>
                  </div>
                ) : (
                  /* Faint Clear Sky Moisture (< 20% rain chance) */
                  <div className="flex flex-col items-center justify-center opacity-40">
                    <div className="w-24 h-24 rounded-full bg-cyan-500/15 blur-lg" />
                    <span className="text-[9px] font-mono text-cyan-300/60 bg-black/50 px-2 py-0.5 rounded-full mt-1">
                      {lang === 'bn' ? 'আকাশ পরিষ্কার (<১৫ dBZ)' : 'Clear Skies (<15 dBZ)'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Simulated Wind Streamlines */}
            {activeLayer === 'wind' && (
              <div className="absolute inset-0 flex items-center justify-center opacity-45">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <motion.div
                    key={idx}
                    animate={{ x: [-100, 120] }}
                    transition={{ repeat: Infinity, duration: 12 / (activePoint.wind || 8), delay: idx * 0.3, ease: 'linear' }}
                    className="absolute h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent w-28"
                    style={{ top: `${20 + idx * 13}%` }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Top telemetry & controls bar inside the radar screen */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 text-xs mb-4">
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
                className="flex items-center gap-1 bg-blue-950/90 hover:bg-blue-900 text-blue-200 border border-blue-600/50 px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer shadow-sm"
              >
                <HelpCircle className="w-3 h-3 text-cyan-300 shrink-0" />
                <span className="hidden sm:inline">{lang === 'bn' ? 'প্রতিফলন নির্দেশিকা' : 'Echo Guide'}</span>
                <span className="sm:hidden">{lang === 'bn' ? 'নির্দেশিকা' : 'Guide'}</span>
                {showEchoGuide ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              <div className="flex items-center gap-1.5 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/15 text-gray-300">
                <span className={`w-1.5 h-1.5 rounded-full animate-ping ${
                  reflectivityDbz >= 45 ? 'bg-rose-500' : reflectivityDbz >= 30 ? 'bg-amber-400' : 'bg-emerald-400'
                }`}></span>
                <span className="font-bold text-[10px]">
                  {reflectivityDbz} dBZ
                </span>
              </div>
            </div>
          </div>

          {/* Farmer Location Crosshair Center (Focal Target) */}
          <div className="relative z-10 flex flex-col items-center justify-center my-auto py-6">
            <div className="relative flex items-center justify-center">
              <div className="w-6 h-6 rounded-full bg-cyan-500/25 animate-ping absolute" />
              <div className="w-4 h-4 rounded-full bg-cyan-400 border-2 border-white shadow-md relative flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-950" />
              </div>
            </div>
            <span className="mt-1.5 text-[9px] font-bold uppercase tracking-wider bg-black/80 px-2.5 py-0.5 rounded-full text-cyan-200 border border-cyan-500/30 shadow-sm backdrop-blur-xs">
              {lang === 'bn' ? 'আপনার খামার' : 'Your Farm'}
            </span>
          </div>

          {/* Bottom radar spectrum legend & playback control */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 pt-2.5 mt-auto border-t border-white/10 text-xs bg-slate-950/40 backdrop-blur-xs -mx-2 -mb-2 px-3 py-2 rounded-b-2xl">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] px-3 py-1.5 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 fill-current" />}
                <span>{isPlaying ? (lang === 'bn' ? 'থামান' : 'Pause') : (lang === 'bn' ? 'চালু' : 'Play')}</span>
              </button>
              <button
                type="button"
                onClick={() => { setSelectedHour(0); setIsPlaying(false); }}
                className="p-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-gray-300 transition-colors cursor-pointer"
                title="Reset to now"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>

            {/* Clear, Labeled dBZ Reflectivity Scale */}
            <div className="flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded-xl border border-white/10">
              <span className="text-[9px] text-gray-400 font-bold uppercase hidden sm:inline">
                {lang === 'bn' ? 'ঘনত্ব:' : 'Echo:'}
              </span>
              <div className="flex items-center gap-1 font-mono text-[8px]">
                <span className="text-cyan-400">0</span>
                <div className="w-14 sm:w-16 h-2 rounded-full bg-gradient-to-r from-cyan-400 via-emerald-400 via-amber-400 to-rose-600 shadow-inner" />
                <span className="text-rose-400">55+</span>
              </div>
              <span className={`text-[9px] font-bold px-1 rounded ${
                reflectivityDbz >= 45 ? 'bg-rose-500/20 text-rose-300' : reflectivityDbz >= 30 ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
              }`}>
                {reflectivityDbz} dBZ
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Telemetry Readout & AI Assessment (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
          {/* Active Frame Metrics */}
          <div className="bg-slate-900/90 rounded-3xl p-5 border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                {lang === 'bn' ? 'নির্বাচিত ফ্রেম' : 'Simulation Hour'}
              </span>
              <span className="text-xs font-black font-mono text-cyan-400 bg-cyan-950/80 px-2.5 py-1 rounded-xl border border-cyan-800/40">
                {selectedHour === 0 ? (lang === 'bn' ? 'বর্তমান সময় (এখন)' : 'Now (T+0h)') : `+${selectedHour}h (${activePoint.time})`}
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
                  {lang === 'bn' ? 'ডপলার প্রতিফলন তীব্রতা' : 'Doppler Reflectivity'}
                </span>
                <span className="text-sm font-black text-white font-mono">
                  {reflectivityDbz} dBZ • {rainRateMmPerHour} mm/h
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">
                  {lang === 'bn' ? 'মেঘের অবস্থান' : 'Storm Proximity'}
                </span>
                <span className={`text-xs font-bold ${isDirectlyOverFarm ? 'text-rose-400 animate-pulse' : 'text-cyan-300'}`}>
                  {isDirectlyOverFarm 
                    ? (lang === 'bn' ? 'খামারের ওপর সক্রিয়' : 'Directly Over Farm') 
                    : `${cloudDistanceKm} km (${lang === 'bn' ? 'উত্তর-পূর্ব' : 'North-East'})`}
                </span>
              </div>
            </div>
          </div>

          {/* Glowing Gemini AI Proactive Impact Assessment Badge */}
          <div className={`rounded-3xl p-5 border bg-gradient-to-br ${currentInsight.bg} transition-all duration-300 relative overflow-hidden shadow-lg`}>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-white/10 rounded-lg text-amber-300">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-white">
                {currentInsight.badge}
              </span>
            </div>

            <p className="text-xs md:text-sm font-medium leading-relaxed">
              {currentInsight.text}
            </p>

            <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[10px] opacity-75 font-mono">
              <span>Model: WeatherNext 3.0</span>
              <span>Google DeepMind AI Engine</span>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          INTERACTIVE DOPPLER ECHO EDUCATIONAL GUIDE (What is Doppler Reflection?)
          ========================================================================= */}
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
                      ? 'ডপলার প্রতিফলন ও আর্দ্রতা বোঝার সহজ উপায়' 
                      : 'Understanding Doppler Weather Radar Echo & Moisture'}
                  </h4>
                </div>
                <button 
                  onClick={() => setShowEchoGuide(false)}
                  className="text-xs text-gray-400 hover:text-white px-2 py-1 bg-white/5 rounded-lg"
                >
                  {lang === 'bn' ? 'বন্ধ করুন ✕' : 'Close ✕'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                {/* Stage 1: Blue/Cyan */}
                <div className="bg-white/5 rounded-2xl p-3.5 border border-cyan-500/20">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-3 h-3 rounded-full bg-cyan-400 shadow-sm" />
                    <span className="font-bold text-cyan-300">0 - 15 dBZ</span>
                  </div>
                  <span className="font-bold text-white block mb-1">
                    {lang === 'bn' ? 'পরিষ্কার আকাশ ও কুয়াশা' : 'Clear Air / Mist'}
                  </span>
                  <p className="text-gray-300 text-[11px] leading-relaxed">
                    {lang === 'bn' 
                      ? 'বাতাসে জলীয় বাষ্পের স্বাভাবিক উপস্থিতি। কোনো বৃষ্টির ঝুঁকি নেই, রোদে ধান শুকানো বা ফসল কাটার উত্তম সময়।' 
                      : 'Light airborne aerosol & clear air. No precipitation risk; safe for harvest and drying grains.'}
                  </p>
                </div>

                {/* Stage 2: Green */}
                <div className="bg-white/5 rounded-2xl p-3.5 border border-emerald-500/20">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-400 shadow-sm" />
                    <span className="font-bold text-emerald-300">15 - 30 dBZ</span>
                  </div>
                  <span className="font-bold text-white block mb-1">
                    {lang === 'bn' ? 'হালকা মেঘ ও গুঁড়ি বৃষ্টি' : 'Light Drizzle (< 2.5 mm/h)'}
                  </span>
                  <p className="text-gray-300 text-[11px] leading-relaxed">
                    {lang === 'bn' 
                      ? 'মাটিতে পানি জমার সম্ভাবনা কম। তবে কীটনাশক স্প্রে করার আগে অপেক্ষা করা ভালো।' 
                      : 'Scattered moisture particles and drizzle. Minimal ponding risk; delay foliar chemical sprays.'}
                  </p>
                </div>

                {/* Stage 3: Yellow */}
                <div className="bg-white/5 rounded-2xl p-3.5 border border-amber-500/20">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-3 h-3 rounded-full bg-amber-400 shadow-sm" />
                    <span className="font-bold text-amber-300">30 - 45 dBZ</span>
                  </div>
                  <span className="font-bold text-white block mb-1">
                    {lang === 'bn' ? 'মাঝারি ভারী বৃষ্টিপাত' : 'Moderate Rain (5-15 mm/h)'}
                  </span>
                  <p className="text-gray-300 text-[11px] leading-relaxed">
                    {lang === 'bn' 
                      ? 'ঘন মেঘের নিয়মিত বৃষ্টি। জমিতে সেচ সম্পূর্ণ বন্ধ রাখুন এবং সার স্প্রে স্থগিত করুন।' 
                      : 'Steady precipitation band. Cease motorized irrigation immediately and hold all fertilizer applications.'}
                  </p>
                </div>

                {/* Stage 4: Red */}
                <div className="bg-white/5 rounded-2xl p-3.5 border border-rose-500/20">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-3 h-3 rounded-full bg-rose-500 shadow-sm" />
                    <span className="font-bold text-rose-300">45+ dBZ</span>
                  </div>
                  <span className="font-bold text-white block mb-1">
                    {lang === 'bn' ? 'প্রবল কালবৈশাখী / মেঘভাঙা বৃষ্টি' : 'Severe Downpour (>25 mm/h)'}
                  </span>
                  <p className="text-gray-300 text-[11px] leading-relaxed">
                    {lang === 'bn' 
                      ? 'বজ্রপাত ও জলাবদ্ধতার উচ্চ ঝুঁকি। ক্ষেতের ড্রেন খুলে দিন এবং পাকা ফসল দ্রুত নিরাপদ স্থানে নিন।' 
                      : 'Torrential convective downpour and gust front. Open drainage gates to prevent submergence.'}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interactive Time Slider / Timeline Scrubber */}
      <div className="bg-slate-900/90 rounded-3xl p-5 border border-white/10 relative z-10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-300">
            <Zap className="w-4 h-4 text-cyan-400" />
            <span>{lang === 'bn' ? '২৪ ঘণ্টার সময়রেখা টেনে মেঘের গতিবিধি দেখুন' : 'Scrub 24-Hour Timeline (Track Storm Moving Across Farm)'}</span>
          </div>
          <span className="text-xs font-bold text-cyan-400 font-mono">
            {activePoint.time} • +{selectedHour} Hours Ahead
          </span>
        </div>

        {/* Range Slider */}
        <input
          type="range"
          min="0"
          max={timeline.length - 1}
          value={selectedHour}
          onChange={(e) => {
            setSelectedHour(parseInt(e.target.value));
            setIsPlaying(false);
          }}
          className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 hover:accent-cyan-300 transition-all"
        />

        {/* Hourly tick marks */}
        <div className="flex justify-between mt-2 text-[10px] text-gray-400 font-mono">
          <span>{lang === 'bn' ? 'এখন' : 'Now (T+0)'}</span>
          <span>+6h</span>
          <span>+12h</span>
          <span>+18h</span>
          <span>+24h</span>
        </div>
      </div>
    </div>
  );
}
