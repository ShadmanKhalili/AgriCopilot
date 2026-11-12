import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Wind,
  Sparkles,
  Navigation,
  Droplets,
  Sun,
  Cloud,
  CloudSun,
  CloudRain,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Calendar,
  CloudOff
} from 'lucide-react';
import { motion } from 'motion/react';
import { Language } from '../utils/translations';
import { toBn } from '../utils/banglaNum';
import DataStatusBadge from './DataStatusBadge';

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

// The "current*" props are kept so the call site compiles. They are no longer
// used: every number on screen now comes from `hourlyForecast` only.
interface Props {
  lang: Language;
  coords: { latitude: number; longitude: number };
  hourlyForecast?: HourlyPoint[];
  currentTemp?: number;
  currentWind?: number;
  currentRainProb?: number;
}

/** Returns the number if it is a real finite value, otherwise null (shown as a dash). */
const real = (n: unknown): number | null =>
  typeof n === 'number' && Number.isFinite(n) ? n : null;

export default function MicroclimateRadarSimulator({
  lang,
  coords,
  hourlyForecast
}: Props) {
  const bn = lang === 'bn';
  const num = (n: number | string) => (bn ? toBn(n) : String(n));
  const show = (n: number | null, suffix = '') => (n === null ? '—' : `${num(n)}${suffix}`);

  const [selectedHour, setSelectedHour] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1); // 1x or 2x
  const [dayFilter, setDayFilter] = useState<'all' | 'first' | 'second'>('all');

  // Only the real hourly forecast from the weather feed is used (at most 48 hours).
  // No hours are invented when the feed is missing or short.
  const timeline: HourlyPoint[] = React.useMemo(
    () => (hourlyForecast && hourlyForecast.length > 0 ? hourlyForecast.slice(0, 48) : []),
    [hourlyForecast]
  );

  const totalHours = timeline.length;
  const hasSecondDay = totalHours > 24;
  const firstDayLen = Math.min(24, totalHours);

  // Keep the selected hour inside the available range if the data changes.
  useEffect(() => {
    if (totalHours > 0 && selectedHour > totalHours - 1) setSelectedHour(totalHours - 1);
  }, [totalHours, selectedHour]);

  // Auto-play scrubber animation
  useEffect(() => {
    if (!isPlaying || totalHours === 0) return;
    const stepMs = playbackSpeed === 2 ? 650 : 1200;
    const interval = setInterval(() => {
      setSelectedHour((prev) => {
        if (dayFilter === 'first') return (prev + 1) % firstDayLen;
        if (dayFilter === 'second') {
          const next = prev + 1;
          return next >= totalHours ? 24 : next;
        }
        return (prev + 1) % totalHours;
      });
    }, stepMs);
    return () => clearInterval(interval);
  }, [isPlaying, totalHours, firstDayLen, playbackSpeed, dayFilter]);

  if (totalHours === 0) {
    return (
      <div className="bg-slate-950 text-white rounded-[36px] p-6 md:p-8 border border-blue-900/40 shadow-2xl mb-8">
        <div className="flex items-center gap-3">
          <CloudOff className="w-6 h-6 text-stone-400 shrink-0" />
          <p className="text-base font-bold text-stone-200">
            {bn ? 'ঘণ্টাভিত্তিক তথ্য পাওয়া যায়নি' : 'Hourly data is not available'}
          </p>
        </div>
      </div>
    );
  }

  const activePoint = timeline[Math.min(selectedHour, totalHours - 1)];
  const temp = real(activePoint.temp);
  const rainProb = real(activePoint.rainProb);
  const wind = real(activePoint.wind);

  // First 24 forecast hours vs. the next 24 (counted from the first hour of the feed).
  const isSecondDay = selectedHour >= 24;
  const dayName = isSecondDay
    ? (bn ? 'পরের ২৪ ঘণ্টা' : 'Hours 24-48')
    : (bn ? 'আগামী ২৪ ঘণ্টা' : 'Next 24 hours');

  // Sky picture state, chosen only from the REAL rain chance of the selected hour:
  //   rain chance < 20  -> sun, 20-39 -> sun behind cloud, 40-59 -> cloud, >= 60 -> rain cloud.
  // Wind streaks are shown when the real wind is >= 15 km/h; their speed follows the real wind.
  // This is a picture of the forecast, not a radar image.
  type Sky = 'clear' | 'partly' | 'cloudy' | 'rain';
  const sky: Sky | null =
    rainProb === null ? null
      : rainProb >= 60 ? 'rain'
      : rainProb >= 40 ? 'cloudy'
      : rainProb >= 20 ? 'partly'
      : 'clear';
  const skyLabel =
    sky === 'rain' ? (bn ? 'বৃষ্টির সম্ভাবনা বেশি' : 'Rain is likely')
    : sky === 'cloudy' ? (bn ? 'মেঘলা, বৃষ্টির সম্ভাবনা আছে' : 'Cloudy, rain is possible')
    : sky === 'partly' ? (bn ? 'আংশিক মেঘলা' : 'Partly cloudy')
    : sky === 'clear' ? (bn ? 'বৃষ্টির সম্ভাবনা কম' : 'Rain is unlikely')
    : (bn ? 'বৃষ্টির তথ্য নেই' : 'No rain data');
  const SkyIcon = sky === 'rain' ? CloudRain : sky === 'cloudy' ? Cloud : sky === 'partly' ? CloudSun : Sun;
  const showWindStreaks = wind !== null && wind >= 15;

  // Field work rules for the selected hour. Each rule needs its inputs to be real;
  // if one is missing the result is null and "no data" is shown instead of a verdict.
  //   Spraying:   rain chance <= 20% AND wind <= 15 km/h AND temp <= 32 C
  //   Fertilizer: rain chance <= 35% AND wind <= 18 km/h
  //   Harvest / drying: rain chance <= 20%
  //   Irrigation: rain chance >= 25% -> hold; otherwise temp >= 26 C -> consider; else no special need
  const sprayOk = rainProb === null || wind === null || temp === null ? null : rainProb <= 20 && wind <= 15 && temp <= 32;
  const fertOk = rainProb === null || wind === null ? null : rainProb <= 35 && wind <= 18;
  const harvestOk = rainProb === null ? null : rainProb <= 20;
  const irrigation: 'hold' | 'consider' | 'none' | null =
    rainProb === null ? null
      : rainProb >= 25 ? 'hold'
      : temp !== null && temp >= 26 ? 'consider'
      : 'none';

  const noData = bn ? 'তথ্য নেই' : 'No data';

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

  const handleFilterChange = (filter: 'all' | 'first' | 'second') => {
    setDayFilter(filter);
    setIsPlaying(false);
    if (filter === 'first') {
      if (selectedHour >= 24) setSelectedHour(0);
    } else if (filter === 'second') {
      if (selectedHour < 24) setSelectedHour(24);
    }
  };

  const adviceBox = (
    ok: boolean | null,
    okClass: string,
    badClass: string
  ) =>
    ok === null
      ? 'bg-slate-800/40 border-slate-700/40 text-gray-300'
      : ok ? okClass : badClass;

  const okBox = 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200';
  const badBox = 'bg-rose-950/40 border-rose-500/30 text-rose-200';
  const warnBox = 'bg-amber-950/40 border-amber-500/30 text-amber-200';

  return (
    <div className="bg-slate-950 text-white rounded-[36px] p-5 sm:p-7 md:p-8 border border-blue-900/40 shadow-2xl relative overflow-hidden mb-8">
      {/* Header */}
      <div className="flex flex-col gap-3 mb-6 relative z-10 border-b border-white/10 pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <DataStatusBadge
            status="forecast"
            lang={lang}
            source="Hourly weather forecast"
            compact={true}
          />
          <span className="text-sm text-amber-200 bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-800/40">
            {bn ? 'পূর্বাভাসের ছবি, রাডার নয়' : 'Picture of the forecast, not radar'}
          </span>
        </div>
        <h3 className="text-xl md:text-2xl font-black text-white">
          {bn ? 'ঘণ্টাভিত্তিক আবহাওয়া পূর্বাভাস' : 'Hour-by-hour weather forecast'}
        </h3>
        <p className="text-sm text-stone-300">
          {bn
            ? 'এখানের সব সংখ্যা আবহাওয়া পূর্বাভাসের ঘণ্টাভিত্তিক তথ্য থেকে নেওয়া। এখানে কোনো রাডার তথ্য নেই।'
            : 'Every number here comes from the hourly weather forecast. There is no radar data on this screen.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10 mb-6">
        {/* Forecast picture (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900/95 rounded-3xl p-4 sm:p-5 border border-white/10 relative overflow-hidden flex flex-col justify-between min-h-[320px]">
          {/* Wind streaks: shown only when the real wind of this hour is 15 km/h or more */}
          {showWindStreaks && wind !== null && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-40" aria-hidden="true">
              {Array.from({ length: 6 }).map((_, idx) => (
                <motion.div
                  key={idx}
                  animate={{ x: [-160, 520] }}
                  transition={{ repeat: Infinity, duration: Math.max(1, 28 / wind), delay: idx * 0.3, ease: 'linear' }}
                  className="absolute h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent w-32"
                  style={{ top: `${15 + idx * 13}%` }}
                />
              ))}
            </div>
          )}

          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-1.5 bg-black/75 px-2.5 py-1 rounded-xl border border-white/15">
              <Navigation className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="text-sm text-cyan-300">
                {num(coords.latitude.toFixed(2))}°N, {num(coords.longitude.toFixed(2))}°E
              </span>
            </div>
            <span className="text-sm text-stone-300">
              {bn ? 'আপনার খামারের এলাকা' : 'Your farm area'}
            </span>
          </div>

          {/* Sky illustration */}
          <div className="relative z-10 flex flex-col items-center justify-center my-auto py-4 gap-3">
            <SkyIcon
              className={`w-24 h-24 ${
                sky === 'rain' ? 'text-sky-300' : sky === 'cloudy' ? 'text-slate-300' : sky === 'partly' ? 'text-amber-200' : 'text-yellow-300'
              }`}
              aria-hidden="true"
            />
            {sky === 'rain' && (
              <div className="flex gap-2" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((i) => (
                  <motion.span
                    key={i}
                    animate={{ y: [0, 14], opacity: [1, 0] }}
                    transition={{ repeat: Infinity, duration: 1, delay: i * 0.15, ease: 'linear' }}
                    className="block w-0.5 h-4 bg-sky-300 rounded-full"
                  />
                ))}
              </div>
            )}
            <p className="text-lg font-bold text-white text-center">{skyLabel}</p>
            {rainProb !== null && (
              <p className="text-sm text-stone-300 text-center">
                {bn ? 'বৃষ্টির সম্ভাবনা' : 'Chance of rain'}: {show(rainProb, '%')}
              </p>
            )}
            <p className="text-sm text-amber-200 text-center">
              {bn
                ? 'পূর্বাভাসের ছবি, রাডার নয়। ছবিটি বৃষ্টির সম্ভাবনা ও বাতাস দেখে বাছা হয়েছে।'
                : 'Picture of the forecast, not radar. It is chosen from the chance of rain and the wind.'}
            </p>
          </div>

          {/* Playback controls */}
          <div className="relative z-10 flex flex-wrap items-center gap-2 pt-2.5 mt-auto border-t border-white/10">
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-3 py-1.5 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              <span>{isPlaying ? (bn ? 'থামান' : 'Pause') : (bn ? 'প্লে' : 'Play')}</span>
            </button>

            <button
              type="button"
              onClick={() => setPlaybackSpeed(playbackSpeed === 1 ? 2 : 1)}
              className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold text-gray-200 transition-colors cursor-pointer"
              title={bn ? 'গতি বদলান' : 'Change speed'}
            >
              {num(playbackSpeed)}x
            </button>

            <button
              type="button"
              onClick={() => { setSelectedHour(0); setIsPlaying(false); }}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-gray-300 transition-colors cursor-pointer"
              title={bn ? 'শুরুতে ফিরুন' : 'Back to start'}
              aria-label={bn ? 'শুরুতে ফিরুন' : 'Back to start'}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Selected hour values and advice (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
          <div className="bg-slate-900/90 rounded-3xl p-5 border border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold px-2 py-0.5 rounded-lg border ${
                  isSecondDay
                    ? 'bg-purple-950/80 text-purple-300 border-purple-800/40'
                    : 'bg-blue-950/80 text-blue-300 border-blue-800/40'
                }`}>
                  {dayName}
                </span>
                <span className="text-sm font-bold text-gray-300">
                  {bn ? toBn(activePoint.time) : activePoint.time}
                </span>
              </div>

              <span className="text-sm font-bold text-cyan-400 bg-cyan-950/80 px-2.5 py-1 rounded-xl border border-cyan-800/40">
                {selectedHour === 0
                  ? (bn ? 'এখন' : 'Now')
                  : (bn ? `${toBn(selectedHour)} ঘণ্টা পরে` : `In ${selectedHour}h`)}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="bg-white/5 rounded-2xl p-2.5 border border-white/5">
                <span className="text-sm text-gray-300 font-bold block">{bn ? 'তাপমাত্রা' : 'Temp'}</span>
                <span className="text-xl font-black text-white">{show(temp, '°C')}</span>
              </div>
              <div className="bg-white/5 rounded-2xl p-2.5 border border-white/5">
                <span className="text-sm text-gray-300 font-bold block">{bn ? 'বৃষ্টির সম্ভাবনা' : 'Rain chance'}</span>
                <span className={`text-xl font-black ${rainProb !== null && rainProb > 40 ? 'text-cyan-400' : 'text-gray-200'}`}>
                  {show(rainProb, '%')}
                </span>
              </div>
              <div className="bg-white/5 rounded-2xl p-2.5 border border-white/5">
                <span className="text-sm text-gray-300 font-bold block">{bn ? 'বাতাস' : 'Wind'}</span>
                <span className="text-xl font-black text-white">
                  {show(wind)} {wind !== null && <span className="text-sm">{bn ? 'কিমি/ঘণ্টা' : 'km/h'}</span>}
                </span>
              </div>
            </div>
          </div>

          {/* Field work advice for the selected hour (rules are in the comments above) */}
          <div className="bg-slate-900/90 rounded-3xl p-5 border border-white/10 shadow-lg">
            <h4 className="text-sm font-bold text-gray-200 mb-1 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                {bn ? 'এই ঘণ্টার কৃষি কাজের নির্দেশিকা' : 'Field work advice for this hour'}
              </span>
              <span className="text-sm text-gray-300 font-normal">
                {bn ? toBn(activePoint.time) : activePoint.time}
              </span>
            </h4>
            <p className="text-sm text-stone-400 mb-3">
              {bn
                ? 'বৃষ্টির সম্ভাবনা, বাতাস ও তাপমাত্রা দেখে এই পরামর্শ।'
                : 'Based on the chance of rain, wind and temperature.'}
            </p>

            <div className="grid grid-cols-2 gap-2">
              {/* Spraying */}
              <div className={`p-2.5 rounded-2xl border flex items-start gap-2 ${adviceBox(sprayOk, okBox, badBox)}`}>
                {sprayOk === false ? <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" /> : <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${sprayOk ? 'text-emerald-400' : 'text-stone-400'}`} />}
                <div>
                  <span className="font-bold block text-sm">{bn ? 'বালাইনাশক স্প্রে' : 'Crop spraying'}</span>
                  <span className="text-sm opacity-90 leading-tight block">
                    {sprayOk === null ? noData
                      : sprayOk ? (bn ? 'উপযুক্ত সময়' : 'Suitable time')
                      : (bn ? 'স্প্রে বন্ধ রাখুন (বৃষ্টি/বাতাস/গরম)' : 'Hold spraying (rain/wind/heat)')}
                  </span>
                </div>
              </div>

              {/* Irrigation */}
              <div className={`p-2.5 rounded-2xl border flex items-start gap-2 ${
                irrigation === 'consider' ? 'bg-blue-950/40 border-blue-500/30 text-blue-200' : 'bg-slate-800/40 border-slate-700/40 text-gray-300'
              }`}>
                {irrigation === 'consider' ? <Droplets className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />}
                <div>
                  <span className="font-bold block text-sm">{bn ? 'সেচ' : 'Irrigation'}</span>
                  <span className="text-sm opacity-90 leading-tight block">
                    {irrigation === null ? noData
                      : irrigation === 'hold' ? (bn ? 'বৃষ্টির সম্ভাবনা আছে, সেচ স্থগিত রাখুন' : 'Rain is possible, hold irrigation')
                      : irrigation === 'consider' ? (bn ? 'গরম ও বৃষ্টি কম, মাটি দেখে সেচ দিন' : 'Hot and dry, irrigate if soil is dry')
                      : (bn ? 'পূর্বাভাস অনুযায়ী বিশেষ প্রয়োজন নেই' : 'No special need from the forecast')}
                  </span>
                </div>
              </div>

              {/* Fertilizer */}
              <div className={`p-2.5 rounded-2xl border flex items-start gap-2 ${adviceBox(fertOk, okBox, warnBox)}`}>
                {fertOk === false ? <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" /> : <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${fertOk ? 'text-emerald-400' : 'text-stone-400'}`} />}
                <div>
                  <span className="font-bold block text-sm">{bn ? 'সার প্রয়োগ' : 'Fertilizer'}</span>
                  <span className="text-sm opacity-90 leading-tight block">
                    {fertOk === null ? noData
                      : fertOk ? (bn ? 'উপযুক্ত সময়' : 'Suitable time')
                      : (bn ? 'ধুয়ে যাওয়ার ঝুঁকি' : 'Risk of washout')}
                  </span>
                </div>
              </div>

              {/* Harvest & drying */}
              <div className={`p-2.5 rounded-2xl border flex items-start gap-2 ${adviceBox(harvestOk, okBox, badBox)}`}>
                {harvestOk === false ? <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" /> : <Sun className={`w-4 h-4 shrink-0 mt-0.5 ${harvestOk ? 'text-yellow-400' : 'text-stone-400'}`} />}
                <div>
                  <span className="font-bold block text-sm">{bn ? 'ফসল তোলা/শুকানো' : 'Harvest / drying'}</span>
                  <span className="text-sm opacity-90 leading-tight block">
                    {harvestOk === null ? noData
                      : harvestOk ? (bn ? 'রোদে শুকানোর জন্য ভালো' : 'Good for drying')
                      : (bn ? 'ফসল ঢেকে রাখুন' : 'Cover the harvest')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hour slider and controls */}
      <div className="bg-slate-900/90 rounded-3xl p-5 border border-white/10 relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-gray-300 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-cyan-400" />
              {bn ? 'সময়ের সীমা:' : 'Time range:'}
            </span>
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => handleFilterChange('all')}
                className={`px-2.5 py-1 rounded-lg text-sm font-bold transition-all cursor-pointer ${
                  dayFilter === 'all' ? 'bg-cyan-500 text-slate-950' : 'text-gray-300 hover:text-white'
                }`}
              >
                {bn ? `সব (${toBn(totalHours)} ঘণ্টা)` : `All ${totalHours}h`}
              </button>
              <button
                type="button"
                onClick={() => handleFilterChange('first')}
                className={`px-2.5 py-1 rounded-lg text-sm font-bold transition-all cursor-pointer ${
                  dayFilter === 'first' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:text-white'
                }`}
              >
                {bn ? 'আগামী ২৪ ঘণ্টা' : 'Next 24h'}
              </button>
              {hasSecondDay && (
                <button
                  type="button"
                  onClick={() => handleFilterChange('second')}
                  className={`px-2.5 py-1 rounded-lg text-sm font-bold transition-all cursor-pointer ${
                    dayFilter === 'second' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:text-white'
                  }`}
                >
                  {bn ? 'পরের ২৪ ঘণ্টা' : 'Hours 24-48'}
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {[-1, 1, 6, 12].map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => handleStep(step)}
                className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold text-gray-200 transition-colors cursor-pointer"
                title={bn ? `${toBn(Math.abs(step))} ঘণ্টা ${step < 0 ? 'আগে' : 'পরে'}` : `${step < 0 ? '' : '+'}${step} h`}
              >
                {step < 0 ? '-' : '+'}{num(Math.abs(step))}{bn ? ' ঘ.' : 'h'}
              </button>
            ))}
          </div>
        </div>

        <input
          type="range"
          min="0"
          max={totalHours - 1}
          value={selectedHour}
          aria-label={bn ? 'পূর্বাভাসের সময় নির্বাচন করুন' : 'Select forecast hour'}
          onChange={(e) => {
            setSelectedHour(parseInt(e.target.value));
            setIsPlaying(false);
          }}
          className="w-full h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 hover:accent-cyan-300 transition-all"
        />

        <div className="flex justify-between mt-2 text-sm text-gray-300">
          <span className={selectedHour === 0 ? 'text-cyan-400 font-bold' : ''}>
            {bn ? 'এখন' : 'Now'}
          </span>
          {totalHours > 12 && <span>{bn ? `${toBn(12)} ঘণ্টা` : '+12h'}</span>}
          {totalHours > 24 && <span>{bn ? `${toBn(24)} ঘণ্টা` : '+24h'}</span>}
          <span className={selectedHour === totalHours - 1 ? 'text-cyan-400 font-bold' : ''}>
            {bn ? `${toBn(totalHours - 1)} ঘণ্টা` : `+${totalHours - 1}h`}
          </span>
        </div>
      </div>
    </div>
  );
}
